#!/usr/bin/env bash
# Shared logging and helpers for bootstrap.sh and ota_update.sh

SCRIPT_NAME=""
LOG_FILE=""
CURRENT_PHASE=""
QUIET=false
SESSION_START_EPOCH=0
PHASE_START_EPOCH=0

timestamp() {
  date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z'
}

redact_secrets() {
  local text="$1"
  text="${text//${GHCR_TOKEN:-}/[REDACTED]}"
  text="${text//${GITHUB_PAT:-}/[REDACTED]}"
  text="${text//${ROVER_GITHUB_TOKEN:-}/[REDACTED]}"
  echo "$text"
}

_log_emit() {
  local level="$1"
  local phase="$2"
  local message="$3"
  local line
  line="$(timestamp) ${level} ${phase} ${message}"
  line="$(redact_secrets "$line")"

  if [[ "$QUIET" == true && "$level" != "WARN" && "$level" != "ERROR" ]]; then
    echo "$line" >>"$LOG_FILE"
  else
    echo "$line" | tee -a "$LOG_FILE"
  fi
}

log_info() {
  _log_emit "INFO" "$1" "$2"
}

log_warn() {
  _log_emit "WARN" "$1" "$2"
}

log_error() {
  _log_emit "ERROR" "$1" "$2"
}

log_debug() {
  _log_emit "DEBUG" "$1" "$2"
}

log_init() {
  SCRIPT_NAME="$1"
  LOG_FILE="$2"
  mkdir -p "$(dirname "$LOG_FILE")"
  SESSION_START_EPOCH=$(date +%s)
  CURRENT_PHASE="$SCRIPT_NAME"

  log_info "$SCRIPT_NAME" "=== SESSION START ==="

  local tz_name tz_offset
  tz_name=$(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo "unknown")
  tz_offset=$(date +%z 2>/dev/null || echo "unknown")
  log_info "$SCRIPT_NAME" "timezone=${tz_name} offset=${tz_offset} TZ_env=${TZ:-<unset>}"
  log_info "$SCRIPT_NAME" "local_time=$(date '+%Y-%m-%d %H:%M:%S %Z')"
  log_info "$SCRIPT_NAME" "utc_time=$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
}

phase_start() {
  CURRENT_PHASE="$1"
  PHASE_START_EPOCH=$(date +%s)
  log_info "$1" "=== START ==="
}

phase_ok() {
  local name="$1"
  local duration=0
  if [[ -n "${PHASE_START_EPOCH:-}" && "$PHASE_START_EPOCH" -gt 0 ]]; then
    duration=$(( $(date +%s) - PHASE_START_EPOCH ))
  fi
  log_info "$name" "=== OK (duration: ${duration}s) ==="
}

phase_skip() {
  log_info "$1" "SKIP: $2"
}

# Ask the user to confirm the update. Auto-confirms when ROVER_OTA_ASSUME_YES is
# set or when stdin is not a TTY (e.g. invoked by the backend OTA API), so that
# automated updates keep working without hanging on input.
confirm_update() {
  local phase="$1"
  local from="$2"
  local to="$3"
  local assume_yes="${4:-false}"

  log_info "$phase" "Update requested: ${from} -> ${to}"

  if [[ "$assume_yes" == "true" || "${ROVER_OTA_ASSUME_YES:-}" == "1" || "${ROVER_OTA_ASSUME_YES:-}" == "true" ]]; then
    log_info "$phase" "Auto-confirmed (assume-yes enabled)"
    return 0
  fi

  if [[ ! -t 0 ]]; then
    log_info "$phase" "Non-interactive session; proceeding without prompt"
    return 0
  fi

  local reply=""
  printf 'Update from %s to %s? [y/N] ' "$from" "$to" >/dev/tty
  read -r reply </dev/tty || reply=""
  case "$reply" in
    y | Y | yes | YES | Yes)
      log_info "$phase" "Confirmed by user"
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

run_cmd() {
  local phase="$1"
  local desc="$2"
  shift 2
  log_debug "$phase" "\$ $desc"
  log_debug "$phase" "\$ $*"

  local output exit_code
  set +e
  output=$("$@" 2>&1)
  exit_code=$?
  set -e

  if [[ -n "$output" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      log_debug "$phase" "$line"
    done <<<"$output"
  fi

  if [[ $exit_code -ne 0 ]]; then
    log_error "$phase" "Command failed with exit code $exit_code"
    return "$exit_code"
  fi
  return 0
}

dump_compose_diagnostics() {
  local phase="${1:-diagnostics}"
  local compose_cmd="${2:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"
  log_warn "$phase" "Dumping compose diagnostics (best-effort)"
  set +e
  run_cmd "$phase" "docker compose ps -a" bash -c "cd \"${INSTALL_DIR:-.}\" && ${compose_cmd} ps -a" || true
  run_cmd "$phase" "docker compose logs backend" bash -c "cd \"${INSTALL_DIR:-.}\" && ${compose_cmd} logs --tail=50 backend" || true
  set -e
}

on_error() {
  local line="$1"
  local code="$2"
  log_error "$CURRENT_PHASE" "Failed at line ${line}, exit code ${code}"
  log_error "$CURRENT_PHASE" "Last phase: ${CURRENT_PHASE}"
  log_error "$CURRENT_PHASE" "Last command: ${BASH_COMMAND:-unknown}"
  log_error "$CURRENT_PHASE" "See ${LOG_FILE} for full session log"
  log_error "$CURRENT_PHASE" "Try: docker compose logs backend; check GHCR access and SSH deploy key"
  dump_compose_diagnostics "$CURRENT_PHASE" "${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"
  exit "$code"
}

wait_for_health() {
  local url="$1"
  local max_attempts="${2:-40}"
  local interval="${3:-3}"
  local phase="${4:-health_check}"
  local attempt=0

  while [[ $attempt -lt $max_attempts ]]; do
    attempt=$((attempt + 1))
    local http_code curl_err
    set +e
    http_code=$(curl -sf -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)
    curl_err=$?
    set -e

    if [[ $curl_err -eq 0 && "$http_code" == "200" ]]; then
      log_info "$phase" "Health OK (${attempt}/${max_attempts}) url=${url} code=${http_code}"
      return 0
    fi

    if [[ $curl_err -ne 0 ]]; then
      log_info "$phase" "Health attempt ${attempt}/${max_attempts} url=${url} curl_error=${curl_err}"
    else
      log_info "$phase" "Health attempt ${attempt}/${max_attempts} url=${url} code=${http_code}"
    fi
    sleep "$interval"
  done

  log_error "$phase" "Health check timed out after $((max_attempts * interval)) seconds url=${url}"
  dump_compose_diagnostics "$phase" "${COMPOSE:-docker compose -f docker-compose.yml -f docker-compose.prod.yml}"
  return 1
}

log_session_env() {
  local phase="$1"
  shift
  log_info "$phase" "uname: $(uname -a)"
  log_info "$phase" "id: $(id)"
  log_info "$phase" "pwd: $(pwd)"
  log_info "$phase" "shell: ${SHELL:-unknown}"

  for tool in docker git curl; do
    if command -v "$tool" >/dev/null 2>&1; then
      log_info "$phase" "${tool}: $($tool --version 2>&1 | head -1)"
    else
      log_warn "$phase" "${tool}: not found"
    fi
  done

  if command -v docker >/dev/null 2>&1; then
    log_info "$phase" "docker compose: $(docker compose version 2>&1 | head -1)"
  fi

  local target="${INSTALL_DIR:-.}"
  if [[ -d "$target" ]]; then
    log_info "$phase" "df: $(df -h "$target" 2>/dev/null | tail -1 || echo unavailable)"
  else
    log_info "$phase" "df: $(df -h / 2>/dev/null | tail -1 || echo unavailable)"
  fi

  if command -v free >/dev/null 2>&1; then
    log_info "$phase" "memory: $(free -h 2>/dev/null | awk '/^Mem:/ {print $2 " total, " $3 " used, " $7 " available"}')"
  fi

  while [[ $# -gt 0 ]]; do
    log_info "$phase" "$1"
    shift
  done
}

load_env_files() {
  local phase="$1"
  local dir="${2:-.}"

  if [[ -f "${dir}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${dir}/.env"
    set +a
    log_info "$phase" "Loaded ${dir}/.env"
  else
    log_info "$phase" "Skipped ${dir}/.env (not found)"
  fi

  if [[ -f "${dir}/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${dir}/.env.local"
    set +a
    log_info "$phase" "Loaded ${dir}/.env.local"
  else
    log_info "$phase" "Skipped ${dir}/.env.local (not found)"
  fi
}

source_env_files() {
  local dir="${1:-.}"

  if [[ -f "${dir}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${dir}/.env"
    set +a
  fi

  if [[ -f "${dir}/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${dir}/.env.local"
    set +a
  fi
}

configure_git_ssh() {
  local phase="${1:-git_ssh}"
  if [[ -n "${GIT_SSH_COMMAND:-}" ]]; then
    log_info "$phase" "Using existing GIT_SSH_COMMAND"
    return 0
  fi

  local container_key="/root/.ssh/id_ed25519"
  if [[ -f "$container_key" ]]; then
    export GIT_SSH_COMMAND="ssh -i ${container_key} -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"
    log_info "$phase" "Using container deploy key: ${container_key}"
  elif [[ -n "${ROVER_OTA_SSH_KEY_PATH:-}" && -f "${ROVER_OTA_SSH_KEY_PATH}" ]]; then
    export GIT_SSH_COMMAND="ssh -i ${ROVER_OTA_SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"
    log_info "$phase" "Using host deploy key: ${ROVER_OTA_SSH_KEY_PATH}"
  else
    log_warn "$phase" "No deploy key found; git will use default SSH config (~/.ssh/config)"
  fi
}

set_env_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

persist_image_tags() {
  local env_file="$1"
  local tag="$2"
  set_env_key "$env_file" "IMAGE_TAG" "$tag"
  set_env_key "$env_file" "ROVER_APP_VERSION" "${tag#v}"
  set_env_key "$env_file" "BACKEND_IMAGE_TAG" "${BACKEND_IMAGE_TAG}"
  set_env_key "$env_file" "FRONTEND_IMAGE_TAG" "${FRONTEND_IMAGE_TAG}"
  set_env_key "$env_file" "MEDIAMTX_IMAGE_TAG" "${MEDIAMTX_IMAGE_TAG}"
}

# Map IMAGE_TAG "latest" to a real git ref (newest v* tag, else default branch).
resolve_git_ref() {
  local tag="$1"
  local repo_dir="${2:-.}"

  if [[ "$tag" != "latest" ]]; then
    echo "$tag"
    return 0
  fi

  local newest_tag
  newest_tag=$(git -C "$repo_dir" tag -l 'v*' --sort=-version:refname 2>/dev/null | head -1)
  if [[ -n "$newest_tag" ]]; then
    echo "$newest_tag"
    return 0
  fi

  local default_branch
  default_branch=$(git -C "$repo_dir" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
  echo "${default_branch:-main}"
}

service_image_name() {
  local service="$1"
  local registry="${FPV_ROVER_IMAGE_REGISTRY:-ghcr.io}"
  local owner="${ROVER_GITHUB_OWNER:-aspience}"
  local repo="${ROVER_GITHUB_REPO:-fpv-rover}"
  echo "${registry}/${owner}/${repo}-${service}"
}

service_image_tag_var() {
  case "$1" in
    backend) echo "BACKEND_IMAGE_TAG" ;;
    frontend) echo "FRONTEND_IMAGE_TAG" ;;
    mediamtx) echo "MEDIAMTX_IMAGE_TAG" ;;
    *) return 1 ;;
  esac
}

docker_image_exists() {
  local image_ref="$1"
  docker manifest inspect "$image_ref" >/dev/null 2>&1
}

semver_lte() {
  local a="${1#v}"
  local b="${2#v}"
  [[ "$(printf '%s\n%s\n' "$a" "$b" | sort -V | head -1)" == "$a" ]]
}

normalize_app_tag() {
  local tag="$1"
  local repo_dir="${2:-.}"
  if [[ "$tag" == "latest" ]]; then
    resolve_git_ref "$tag" "$repo_dir"
  else
    echo "$tag"
  fi
}

# Read a single KEY=value from an env-style file without touching the environment.
read_env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1

  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "${line%%=*}" == "$key" ]]; then
      printf '%s\n' "${line#*=}"
      return 0
    fi
  done <"$file"
  return 1
}

# True if KEY is explicitly defined (uncommented) in the given env file.
env_file_has_key() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] && grep -qE "^[[:space:]]*${key}=" "$file"
}

# Find the nearest existing image tag at or below target_tag (fallback for releases without image-tags.env).
resolve_service_image_tag() {
  local service="$1"
  local target_tag="$2"
  local repo_dir="${3:-.}"
  local image="${4:-$(service_image_name "$service")}"
  local tag

  if docker_image_exists "${image}:${target_tag}"; then
    echo "$target_tag"
    return 0
  fi

  while IFS= read -r tag; do
    [[ -z "$tag" ]] && continue
    if ! semver_lte "$tag" "$target_tag"; then
      continue
    fi
    if docker_image_exists "${image}:${tag}"; then
      echo "$tag"
      return 0
    fi
  done < <(git -C "$repo_dir" tag -l 'v*' --sort=-version:refname 2>/dev/null)

  if docker_image_exists "${image}:latest"; then
    echo "latest"
    return 0
  fi

  echo "$target_tag"
}

# Resolve per-service image tags for compose. Precedence (highest first):
#   1. Explicit user override in .env.local (pin/rollback)
#   2. image-tags.env from the checked-out release (authoritative manifest)
#   3. Nearest existing GHCR tag at/below the app tag (fallback for old releases)
# The release manifest deliberately wins over per-service tags previously
# persisted to .env, so a `latest` OTA always advances to the checked-out
# release instead of sticking on the version pinned by the prior run.
export_compose_image_tags() {
  local app_tag="$1"
  local repo_dir="${2:-.}"
  local phase="${3:-compose_tags}"
  local resolved_app_tag
  local service var_name resolved manifest_val
  local env_local="${repo_dir}/.env.local"
  local manifest="${repo_dir}/image-tags.env"

  resolved_app_tag=$(normalize_app_tag "$app_tag" "$repo_dir")
  export IMAGE_TAG="$app_tag"

  for service in backend frontend mediamtx; do
    var_name=$(service_image_tag_var "$service")

    if env_file_has_key "$env_local" "$var_name"; then
      export "${var_name}=${!var_name:-}"
      log_info "$phase" "Using ${var_name}=${!var_name:-} from .env.local override"
      continue
    fi

    manifest_val=$(read_env_value "$manifest" "$var_name" || true)
    if [[ -n "$manifest_val" ]]; then
      export "${var_name}=${manifest_val}"
      log_info "$phase" "Using ${var_name}=${manifest_val} from image-tags.env"
      continue
    fi

    resolved=$(resolve_service_image_tag "$service" "$resolved_app_tag" "$repo_dir")
    export "${var_name}=${resolved}"

    if [[ "$resolved" != "$resolved_app_tag" ]]; then
      log_info "$phase" "Resolved ${var_name}=${resolved} (app tag ${resolved_app_tag}, no manifest)"
    else
      log_info "$phase" "Resolved ${var_name}=${resolved} (no manifest)"
    fi
  done
}
