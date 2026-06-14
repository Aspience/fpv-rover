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

# Wait until nginx can reach backend API and frontend (post-OTA / deploy).
wait_for_nginx_stack() {
  local phase="${1:-nginx_stack_check}"
  local max_attempts="${2:-40}"
  local interval="${3:-3}"
  local api_url="${4:-http://localhost/api/health}"
  local frontend_url="${5:-http://localhost/}"

  log_info "$phase" "Waiting for nginx stack api=${api_url} frontend=${frontend_url}"
  wait_for_health "$api_url" "$max_attempts" "$interval" "$phase"
  wait_for_health "$frontend_url" "$max_attempts" "$interval" "$phase"
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
