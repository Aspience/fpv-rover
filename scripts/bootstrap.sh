#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

INSTALL_DIR="/opt/fpv-rover"
TAG=""
REPO="git@github.com:Aspience/fpv-rover.git"
NON_INTERACTIVE=false
SKIP_CLONE=false
SKIP_SSH=false
SKIP_GHCR_LOGIN=false
SKIP_DEPLOY=false
ENABLE_SYSTEMD=false
CLI_ARGS=()

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
SSH_KEY="${HOME}/.ssh/fpv_rover_deploy"
LOG_FILE=""

usage() {
  cat <<EOF
Usage: scripts/bootstrap.sh [OPTIONS]

  --install-dir PATH     default: /opt/fpv-rover
  --tag TAG              default: latest (or \$IMAGE_TAG from env)
  --repo URL             default: git@github.com:Aspience/fpv-rover.git
  --non-interactive      fail fast if SSH/GitHub/GHCR/data missing
  --skip-clone           repo already in INSTALL_DIR
  --skip-ssh             SSH already configured
  --skip-ghcr-login      skip docker login
  --skip-deploy          only file/setup steps, no compose up
  --enable-systemd       install infra/systemd/fpv-rover.service
  --quiet                less stdout output (log file stays verbose)
  --help                 show this help
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    CLI_ARGS+=("$1")
    case "$1" in
      --install-dir)
        INSTALL_DIR="$2"
        shift 2
        ;;
      --tag)
        TAG="$2"
        shift 2
        ;;
      --repo)
        REPO="$2"
        shift 2
        ;;
      --non-interactive)
        NON_INTERACTIVE=true
        shift
        ;;
      --skip-clone)
        SKIP_CLONE=true
        shift
        ;;
      --skip-ssh)
        SKIP_SSH=true
        shift
        ;;
      --skip-ghcr-login)
        SKIP_GHCR_LOGIN=true
        shift
        ;;
      --skip-deploy)
        SKIP_DEPLOY=true
        shift
        ;;
      --enable-systemd)
        ENABLE_SYSTEMD=true
        shift
        ;;
      --quiet)
        QUIET=true
        shift
        ;;
      --help | -h)
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

resolve_tag() {
  if [[ -z "$TAG" ]]; then
    TAG="${IMAGE_TAG:-latest}"
  fi
}

check_prereqs() {
  phase_start check_prereqs
  for cmd in docker git curl; do
    if command -v "$cmd" >/dev/null 2>&1; then
      run_cmd check_prereqs "$cmd --version" "$cmd" --version
    else
      log_error check_prereqs "Missing required command: $cmd"
      exit 1
    fi
  done

  if ! docker compose version >/dev/null 2>&1; then
    log_error check_prereqs "docker compose plugin not found"
    exit 1
  fi
  run_cmd check_prereqs "docker compose version" docker compose version

  if [[ "$(uname -m)" != "aarch64" ]]; then
    log_warn check_prereqs "Expected aarch64 (Raspberry Pi), got $(uname -m)"
  fi

  for dev in /dev/i2c-1 /dev/video0 /sys/bus/w1; do
    if [[ -e "$dev" ]]; then
      log_info check_prereqs "Hardware device found: $dev"
    else
      log_warn check_prereqs "Hardware device missing (non-fatal): $dev"
    fi
  done
  phase_ok check_prereqs
}

prepare_install_dir() {
  phase_start prepare_install_dir
  if [[ ! -d "$INSTALL_DIR" ]]; then
    run_cmd prepare_install_dir "sudo mkdir -p" sudo mkdir -p "$INSTALL_DIR"
  fi
  local owner
  owner=$(stat -c '%U:%G' "$INSTALL_DIR" 2>/dev/null || echo unknown)
  log_info prepare_install_dir "Before chown: owner=${owner} target_uid=${UID}"
  run_cmd prepare_install_dir "sudo chown user" sudo chown "$USER" "$INSTALL_DIR"
  mkdir -p "${INSTALL_DIR}/logs"
  phase_ok prepare_install_dir
}

setup_ssh_key() {
  if [[ "$SKIP_SSH" == true ]]; then
    phase_skip setup_ssh_key "--skip-ssh"
    return 0
  fi

  phase_start setup_ssh_key
  log_info setup_ssh_key "Current user=$(whoami) HOME=${HOME}"
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"

  local key_generated=false
  if [[ ! -f "$SSH_KEY" ]]; then
    run_cmd setup_ssh_key "ssh-keygen" ssh-keygen -t ed25519 -f "$SSH_KEY" -N ""
    key_generated=true
  else
    log_info setup_ssh_key "SSH key already exists: ${SSH_KEY}"
  fi

  if [[ -f "${SSH_KEY}.pub" ]]; then
    local fingerprint
    fingerprint=$(ssh-keygen -lf "${SSH_KEY}.pub" 2>/dev/null || echo unknown)
    log_info setup_ssh_key "Public key fingerprint: ${fingerprint}"
  fi

  local config_block="Host github.com
  IdentityFile ${SSH_KEY}
  IdentitiesOnly yes"

  if [[ -f "${HOME}/.ssh/config" ]] && grep -q "IdentityFile ${SSH_KEY}" "${HOME}/.ssh/config"; then
    log_info setup_ssh_key "SSH config block already present for fpv_rover_deploy"
  else
    {
      echo ""
      echo "# fpv-rover bootstrap"
      echo "$config_block"
    } >>"${HOME}/.ssh/config"
    chmod 600 "${HOME}/.ssh/config"
    log_info setup_ssh_key "Added github.com block to ~/.ssh/config"
  fi

  if [[ "$key_generated" == true && "$NON_INTERACTIVE" == false ]]; then
    log_info setup_ssh_key "Add this deploy key in GitHub → Settings → Deploy keys (read-only):"
    echo ""
    cat "${SSH_KEY}.pub"
    echo ""
    read -r -p "Press Enter after adding the deploy key to GitHub..."
  elif [[ "$key_generated" == false ]]; then
    log_info setup_ssh_key "Reusing existing deploy key; skipping GitHub prompt"
  fi

  local ssh_test_output ssh_test_code
  set +e
  ssh_test_output=$(ssh -T -o BatchMode=yes -o StrictHostKeyChecking=accept-new git@github.com 2>&1)
  ssh_test_code=$?
  set -e
  log_info setup_ssh_key "ssh -T git@github.com exit=${ssh_test_code}"
  log_debug setup_ssh_key "$ssh_test_output"

  if [[ $ssh_test_code -eq 255 ]]; then
    log_error setup_ssh_key "GitHub SSH authentication failed. Add deploy key and retry."
    exit 1
  fi

  phase_ok setup_ssh_key
}

clone_or_update_repo() {
  if [[ "$SKIP_CLONE" == true && -d "${INSTALL_DIR}/.git" ]]; then
    phase_skip clone_or_update_repo "--skip-clone and repo present"
    return 0
  fi

  phase_start clone_or_update_repo
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    run_cmd clone_or_update_repo "git remote -v" git -C "$INSTALL_DIR" remote -v
    run_cmd clone_or_update_repo "git fetch origin" git -C "$INSTALL_DIR" fetch origin
  else
    run_cmd clone_or_update_repo "git clone" git clone "$REPO" "$INSTALL_DIR"
  fi
  phase_ok clone_or_update_repo
}

checkout_tag() {
  phase_start checkout_tag
  local git_ref
  git_ref=$(resolve_git_ref "$TAG" "$INSTALL_DIR")
  log_info checkout_tag "Resolved TAG=${TAG} git_ref=${git_ref}"
  run_cmd checkout_tag "git fetch --tags" git -C "$INSTALL_DIR" fetch --tags origin
  run_cmd checkout_tag "git checkout ${git_ref}" git -C "$INSTALL_DIR" checkout "$git_ref"
  run_cmd checkout_tag "git rev-parse HEAD" git -C "$INSTALL_DIR" rev-parse HEAD
  run_cmd checkout_tag "git describe --tags" git -C "$INSTALL_DIR" describe --tags --always
  if [[ -n "$(git -C "$INSTALL_DIR" status --porcelain 2>/dev/null)" ]]; then
    log_warn checkout_tag "Working tree has uncommitted changes"
  fi
  phase_ok checkout_tag
}

setup_env_files() {
  phase_start setup_env_files
  local env_file="${INSTALL_DIR}/.env"

  if [[ -f "$env_file" ]]; then
    phase_skip setup_env_files ".env already exists"
    return 0
  fi

  cp "${INSTALL_DIR}/.env.example" "$env_file"

  local vite_host app_version ota_script git_ref
  vite_host="${VITE_RPI_HOST:-$(hostname -I | awk '{print $1}')}"
  git_ref=$(resolve_git_ref "$TAG" "$INSTALL_DIR")
  if [[ "$TAG" == "latest" ]]; then
    app_version="${git_ref#v}"
  else
    app_version="${TAG#v}"
  fi
  ota_script="${INSTALL_DIR}/scripts/ota_update.sh"

  set_env_key "$env_file" "ROVER_OTA_ENABLED" "true"
  set_env_key "$env_file" "ROVER_OTA_INSTALL_DIR" "$INSTALL_DIR"
  set_env_key "$env_file" "VITE_RPI_HOST" "$vite_host"
  set_env_key "$env_file" "IMAGE_TAG" "$TAG"
  set_env_key "$env_file" "ROVER_APP_VERSION" "$app_version"
  set_env_key "$env_file" "ROVER_OTA_SSH_KEY_PATH" "$SSH_KEY"
  set_env_key "$env_file" "ROVER_OTA_SCRIPT" "$ota_script"
  set_env_key "$env_file" "ROVER_MEDIAMTX_API_URL" "http://mediamtx:9997"

  log_info setup_env_files "Created ${env_file} for user $(whoami)"
  log_info setup_env_files "Set keys: ROVER_OTA_ENABLED, ROVER_OTA_INSTALL_DIR, VITE_RPI_HOST=${vite_host}, IMAGE_TAG=${TAG}, ROVER_APP_VERSION=${app_version}, ROVER_OTA_SSH_KEY_PATH=${SSH_KEY}, ROVER_OTA_SCRIPT"
  phase_ok setup_env_files
}

ghcr_login() {
  if [[ "$SKIP_GHCR_LOGIN" == true ]]; then
    phase_skip ghcr_login "--skip-ghcr-login"
    return 0
  fi

  phase_start ghcr_login
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    if [[ -z "${GHCR_USER:-}" ]]; then
      log_error ghcr_login "GHCR_TOKEN is set but GHCR_USER is missing"
      exit 1
    fi
    log_info ghcr_login "Logging in to ghcr.io as user=${GHCR_USER}"
    set +e
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >>"$LOG_FILE" 2>&1
    local login_code=$?
    set -e
    if [[ $login_code -ne 0 ]]; then
      log_error ghcr_login "docker login failed with exit code ${login_code}"
      exit 1
    fi
    log_info ghcr_login "GHCR login succeeded"
  else
    phase_skip ghcr_login "GHCR_TOKEN not set (public packages OK)"
    return 0
  fi
  phase_ok ghcr_login
}

prompt_env_edit() {
  if [[ "$SKIP_DEPLOY" == true ]]; then
    phase_skip prompt_env_edit "--skip-deploy"
    return 0
  fi

  if [[ "$NON_INTERACTIVE" == true ]]; then
    phase_skip prompt_env_edit "--non-interactive"
    return 0
  fi

  phase_start prompt_env_edit
  local env_file="${INSTALL_DIR}/.env"
  local env_local="${INSTALL_DIR}/.env.local"

  log_info prompt_env_edit "Edit env files before pulling images and starting containers"
  log_info prompt_env_edit "${env_file} — ROVER_MODULES_*, VITE_RPI_HOST, shared settings"
  log_info prompt_env_edit "${env_local} (optional) — hardware IDs only; do not copy full .env.example"
  echo ""
  echo "Example .env.local:"
  echo "  ROVER_MODULES_CAMERA_ENABLED=true"
  echo "  ROVER_THERMAL_SENSOR_IDS={\"motor_steering\":\"28-...\"}"
  echo ""

  local editor="${EDITOR:-nano}"
  read -r -p "Open ${env_file} in ${editor}? [Y/n] " open_env
  if [[ "${open_env:-Y}" =~ ^[Yy]$ ]]; then
    "$editor" "$env_file"
  fi

  read -r -p "Create or edit .env.local? [y/N] " edit_local
  if [[ "$edit_local" =~ ^[Yy]$ ]]; then
    if [[ ! -f "$env_local" ]]; then
      touch "$env_local"
    fi
    "$editor" "$env_local"
  fi

  read -r -p "Press Enter when env is ready to start containers..."
  phase_ok prompt_env_edit
}

docker_compose_deploy() {
  if [[ "$SKIP_DEPLOY" == true ]]; then
    phase_skip docker_compose_deploy "--skip-deploy"
    return 0
  fi

  phase_start docker_compose_deploy
  cd "$INSTALL_DIR"
  load_env_files docker_compose_deploy "$INSTALL_DIR"
  export ROVER_OTA_INSTALL_DIR="$INSTALL_DIR"
  export_compose_image_tags "${IMAGE_TAG:-$TAG}" "$INSTALL_DIR" docker_compose_deploy
  persist_image_tags "${INSTALL_DIR}/.env" "${IMAGE_TAG:-$TAG}"
  log_info docker_compose_deploy "Using IMAGE_TAG=${IMAGE_TAG} BACKEND_IMAGE_TAG=${BACKEND_IMAGE_TAG} FRONTEND_IMAGE_TAG=${FRONTEND_IMAGE_TAG} MEDIAMTX_IMAGE_TAG=${MEDIAMTX_IMAGE_TAG}"

  run_cmd docker_compose_deploy "compose pull" $COMPOSE pull
  run_cmd docker_compose_deploy "compose up" $COMPOSE up -d --remove-orphans
  run_cmd docker_compose_deploy "compose ps" $COMPOSE ps
  run_cmd docker_compose_deploy "docker images" bash -c "docker images --format '{{.Repository}}:{{.Tag}}' | grep -E 'fpv-rover|ghcr.io' || true"
  phase_ok docker_compose_deploy
}

health_check() {
  if [[ "$SKIP_DEPLOY" == true ]]; then
    phase_skip health_check "--skip-deploy"
    return 0
  fi

  phase_start health_check
  cd "$INSTALL_DIR"
  load_env_files health_check "$INSTALL_DIR"
  local health_url="http://localhost:${ROVER_PORT:-8000}/health"
  wait_for_health "$health_url" 40 3 health_check
  phase_ok health_check
}

install_systemd() {
  if [[ "$ENABLE_SYSTEMD" != true ]]; then
    phase_skip install_systemd "not requested"
    return 0
  fi

  phase_start install_systemd
  run_cmd install_systemd "copy systemd unit" sudo cp "${INSTALL_DIR}/infra/systemd/fpv-rover.service" /etc/systemd/system/
  run_cmd install_systemd "systemctl daemon-reload" sudo systemctl daemon-reload
  run_cmd install_systemd "systemctl enable --now" sudo systemctl enable --now fpv-rover
  run_cmd install_systemd "systemctl status" systemctl status fpv-rover --no-pager || true
  phase_ok install_systemd
}

print_summary() {
  phase_start print_summary
  cd "$INSTALL_DIR"
  load_env_files print_summary "$INSTALL_DIR"

  local host="${VITE_RPI_HOST:-localhost}"
  local port="${ROVER_PORT:-8000}"
  local duration=$(( $(date +%s) - SESSION_START_EPOCH ))

  log_info print_summary "Bootstrap completed in ${duration}s"
  log_info print_summary "Install dir: ${INSTALL_DIR}"
  log_info print_summary "Tag: ${TAG}"
  log_info print_summary "Log file: ${LOG_FILE}"
  log_info print_summary "Backend health: http://localhost:${port}/health"
  log_info print_summary "Web UI: http://${host}/"
  log_info print_summary "Edit ${INSTALL_DIR}/.env for module flags"
  log_info print_summary "Optional overrides: create ${INSTALL_DIR}/.env.local (hardware IDs only)"
  log_info print_summary "Manual OTA: ${INSTALL_DIR}/scripts/ota_update.sh [TAG]"
  phase_ok print_summary
}

main() {
  parse_args "$@"
  resolve_tag

  if [[ ! -d "$INSTALL_DIR" ]]; then
    sudo mkdir -p "$INSTALL_DIR"
    sudo chown "$USER" "$INSTALL_DIR"
  fi

  LOG_FILE="${INSTALL_DIR}/logs/bootstrap.log"
  mkdir -p "${INSTALL_DIR}/logs"
  log_init bootstrap "$LOG_FILE"
  trap 'on_error $LINENO $?' ERR

  log_info bootstrap "CLI args: ${CLI_ARGS[*]:-<none>}"
  log_session_env bootstrap \
    "INSTALL_DIR=${INSTALL_DIR}" \
    "TAG=${TAG}" \
    "VITE_RPI_HOST=${VITE_RPI_HOST:-<unset>}" \
    "GHCR_USER=${GHCR_USER:-<unset>}" \
    "GHCR_TOKEN=${GHCR_TOKEN:+[REDACTED]}"

  check_prereqs
  prepare_install_dir
  setup_ssh_key
  clone_or_update_repo
  checkout_tag
  setup_env_files
  ghcr_login
  prompt_env_edit
  docker_compose_deploy
  health_check
  install_systemd
  print_summary
}

main "$@"
