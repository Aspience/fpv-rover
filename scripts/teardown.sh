#!/usr/bin/env bash
# Remove an FPV Rover deployment from the device.
#
# Stops the compose stack and (by default) removes its containers, volumes and
# images, the detached OTA helper container, the systemd unit, and the install
# directory. Use the --keep-* flags for a softer teardown (e.g. before a fresh
# bootstrap that reuses the same .env).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

ASSUME_YES=false
KEEP_DIR=false
KEEP_IMAGES=true
KEEP_VOLUMES=false
REMOVE_SSH_KEY=false
CLI_INSTALL_DIR=""
CLI_ARGS=()

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
OTA_HELPER_CONTAINER="fpv-rover-ota"
SYSTEMD_UNIT="fpv-rover.service"
INSTALL_DIR=""
LOG_FILE=""

usage() {
  cat <<EOF
Usage: scripts/teardown.sh [OPTIONS]

Removes the FPV Rover deployment. Install dir is resolved from (highest first):
  --install-dir, \$ROVER_OTA_INSTALL_DIR, ROVER_OTA_INSTALL_DIR in <dir>/.env,
  then the default /opt/fpv-rover.

  --install-dir PATH    override install dir (default: ROVER_OTA_INSTALL_DIR or /opt/fpv-rover)
  -y, --yes             do not prompt for confirmation
  --keep-dir            keep the install dir (repo, .env, logs)
  --keep-images         keep docker images (skip --rmi all)
  --keep-volumes        keep docker volumes
  --remove-ssh-key      also delete the deploy key (\$HOME/.ssh/fpv_rover_deploy*)
  --quiet               less stdout output (log file stays verbose)
  -h, --help            show this help
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    CLI_ARGS+=("$1")
    case "$1" in
      --install-dir)
        CLI_INSTALL_DIR="$2"
        shift 2
        ;;
      -y | --yes)
        ASSUME_YES=true
        shift
        ;;
      --keep-dir)
        KEEP_DIR=true
        shift
        ;;
      --keep-images)
        KEEP_IMAGES=true
        shift
        ;;
      --keep-volumes)
        KEEP_VOLUMES=true
        shift
        ;;
      --remove-ssh-key)
        REMOVE_SSH_KEY=true
        shift
        ;;
      --quiet)
        QUIET=true
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done
}

# Resolve INSTALL_DIR honouring the .env-driven ROVER_OTA_INSTALL_DIR, exactly
# like ota_update.sh: a CLI override wins, otherwise the env var (possibly
# loaded from <candidate>/.env) wins, otherwise the default.
resolve_install_dir() {
  local candidate="${CLI_INSTALL_DIR:-${ROVER_OTA_INSTALL_DIR:-/opt/fpv-rover}}"
  if [[ -z "$CLI_INSTALL_DIR" && -d "$candidate" ]]; then
    source_env_files "$candidate"
  fi
  INSTALL_DIR="${CLI_INSTALL_DIR:-${ROVER_OTA_INSTALL_DIR:-$candidate}}"
}

confirm_teardown() {
  phase_start confirm
  log_info confirm "Target install dir: ${INSTALL_DIR}"
  log_info confirm "Remove images: $([[ "$KEEP_IMAGES" == true ]] && echo no || echo yes)"
  log_info confirm "Remove volumes: $([[ "$KEEP_VOLUMES" == true ]] && echo no || echo yes)"
  log_info confirm "Remove install dir: $([[ "$KEEP_DIR" == true ]] && echo no || echo yes)"
  log_info confirm "Remove deploy key: $([[ "$REMOVE_SSH_KEY" == true ]] && echo yes || echo no)"

  if [[ "$ASSUME_YES" == true ]]; then
    log_info confirm "Auto-confirmed (--yes)"
    phase_ok confirm
    return 0
  fi

  if [[ ! -t 0 ]]; then
    log_error confirm "Non-interactive session and --yes not given; aborting"
    exit 1
  fi

  local reply=""
  printf 'This will REMOVE the FPV Rover deployment at %s. Continue? [y/N] ' "$INSTALL_DIR" >/dev/tty
  read -r reply </dev/tty || reply=""
  case "$reply" in
    y | Y | yes | YES | Yes) ;;
    *)
      log_warn confirm "Teardown cancelled by user"
      exit 0
      ;;
  esac
  phase_ok confirm
}

stop_systemd() {
  phase_start stop_systemd
  if ! command -v systemctl >/dev/null 2>&1; then
    phase_skip stop_systemd "systemctl not found"
    return 0
  fi

  if systemctl list-unit-files 2>/dev/null | grep -q "^${SYSTEMD_UNIT}"; then
    run_cmd stop_systemd "systemctl disable --now" sudo systemctl disable --now "$SYSTEMD_UNIT" || true
    run_cmd stop_systemd "remove unit file" sudo rm -f "/etc/systemd/system/${SYSTEMD_UNIT}" || true
    run_cmd stop_systemd "systemctl daemon-reload" sudo systemctl daemon-reload || true
  else
    phase_skip stop_systemd "${SYSTEMD_UNIT} not installed"
  fi
  phase_ok stop_systemd
}

remove_helper_container() {
  phase_start remove_helper
  run_cmd remove_helper "docker rm -f ${OTA_HELPER_CONTAINER}" \
    docker rm -f "$OTA_HELPER_CONTAINER" || true
  phase_ok remove_helper
}

compose_down() {
  phase_start compose_down
  if [[ ! -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
    phase_skip compose_down "no docker-compose.yml in ${INSTALL_DIR}; using fallback cleanup"
    fallback_cleanup
    phase_ok compose_down
    return 0
  fi

  cd "$INSTALL_DIR"
  load_env_files compose_down "$INSTALL_DIR"

  local down_args=(down --remove-orphans)
  [[ "$KEEP_VOLUMES" == false ]] && down_args+=(--volumes)
  [[ "$KEEP_IMAGES" == false ]] && down_args+=(--rmi all)

  run_cmd compose_down "compose ${down_args[*]}" $COMPOSE "${down_args[@]}" || true
  phase_ok compose_down
}

# Used when the compose files are already gone: remove containers/images by the
# compose project label and the fpv-rover image name pattern.
fallback_cleanup() {
  local project
  project="$(basename "$INSTALL_DIR")"

  local cids
  cids="$(docker ps -aq --filter "label=com.docker.compose.project=${project}" 2>/dev/null || true)"
  if [[ -n "$cids" ]]; then
    # shellcheck disable=SC2086
    run_cmd compose_down "remove project containers" docker rm -f $cids || true
  fi

  if [[ "$KEEP_IMAGES" == false ]]; then
    local imgs
    imgs="$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep 'fpv-rover' || true)"
    if [[ -n "$imgs" ]]; then
      # shellcheck disable=SC2086
      run_cmd compose_down "remove fpv-rover images" docker rmi -f $imgs || true
    fi
  fi
}

remove_install_dir() {
  phase_start remove_install_dir
  if [[ "$KEEP_DIR" == true ]]; then
    # Still drop the OTA "updating" marker so a kept dir is left in a clean state.
    rm -f "${INSTALL_DIR}/.ota_updating" 2>/dev/null || true
    phase_skip remove_install_dir "--keep-dir"
    phase_ok remove_install_dir
    return 0
  fi

  if [[ -d "$INSTALL_DIR" ]]; then
    # Files under the bind-mounted install dir may be root-owned (containers run
    # as root), so removal needs sudo.
    run_cmd remove_install_dir "sudo rm -rf ${INSTALL_DIR}" sudo rm -rf "$INSTALL_DIR" || true
  else
    phase_skip remove_install_dir "${INSTALL_DIR} not present"
  fi
  phase_ok remove_install_dir
}

remove_ssh_key() {
  phase_start remove_ssh_key
  if [[ "$REMOVE_SSH_KEY" != true ]]; then
    phase_skip remove_ssh_key "not requested"
    return 0
  fi

  local key="${ROVER_OTA_SSH_KEY_PATH:-${HOME}/.ssh/fpv_rover_deploy}"
  run_cmd remove_ssh_key "remove ${key}" rm -f "$key" "${key}.pub" || true
  log_warn remove_ssh_key "Deploy key removed. The matching entry in GitHub Deploy keys and the ~/.ssh/config block (if any) are left untouched."
  phase_ok remove_ssh_key
}

print_summary() {
  phase_start print_summary
  local duration=$(( $(date +%s) - SESSION_START_EPOCH ))
  log_info print_summary "Teardown completed in ${duration}s"
  log_info print_summary "Install dir: ${INSTALL_DIR} ($([[ -d "$INSTALL_DIR" ]] && echo present || echo removed))"
  log_info print_summary "Log file: ${LOG_FILE}"
  if [[ "$KEEP_DIR" != true ]]; then
    log_info print_summary "Redeploy: clone the repo and run scripts/bootstrap.sh"
  else
    log_info print_summary "Redeploy: cd ${INSTALL_DIR} && ./scripts/bootstrap.sh --skip-clone"
  fi
  phase_ok print_summary
}

main() {
  parse_args "$@"
  resolve_install_dir

  # Log to /tmp because the install dir (and its logs/) may be removed below.
  LOG_FILE="/tmp/fpv-rover-teardown.log"
  log_init teardown "$LOG_FILE"
  trap 'on_error $LINENO $?' ERR

  log_info teardown "CLI args: ${CLI_ARGS[*]:-<none>}"
  log_session_env teardown \
    "INSTALL_DIR=${INSTALL_DIR}" \
    "KEEP_DIR=${KEEP_DIR}" \
    "KEEP_IMAGES=${KEEP_IMAGES}" \
    "KEEP_VOLUMES=${KEEP_VOLUMES}" \
    "REMOVE_SSH_KEY=${REMOVE_SSH_KEY}"

  confirm_teardown
  stop_systemd
  remove_helper_container
  compose_down
  remove_install_dir
  remove_ssh_key
  print_summary
}

main "$@"
