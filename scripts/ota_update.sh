#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

CLI_TAG="${1:-}"
INSTALL_DIR_CANDIDATE="${ROVER_OTA_INSTALL_DIR:-/opt/fpv-rover}"

# Load .env early so ROVER_OTA_INSTALL_DIR / IMAGE_TAG from file are visible before logging.
if [[ -d "$INSTALL_DIR_CANDIDATE" ]]; then
  source_env_files "$INSTALL_DIR_CANDIDATE"
fi

INSTALL_DIR="${ROVER_OTA_INSTALL_DIR:-$INSTALL_DIR_CANDIDATE}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
LOG_FILE="${INSTALL_DIR}/logs/ota.log"

mkdir -p "${INSTALL_DIR}/logs"
log_init ota "$LOG_FILE"
trap 'on_error $LINENO $?' ERR

cd "$INSTALL_DIR"

phase_start grace_period
log_info grace_period "Waiting 3s so API can respond before restart"
sleep 3
phase_ok grace_period

phase_start load_env
load_env_files load_env "$INSTALL_DIR"
TAG="${CLI_TAG:-${IMAGE_TAG:-latest}}"
export IMAGE_TAG="$TAG"
export ROVER_OTA_INSTALL_DIR="$INSTALL_DIR"
configure_git_ssh load_env
log_info load_env "Effective TAG=${TAG} INSTALL_DIR=${INSTALL_DIR} ROVER_PORT=${ROVER_PORT:-8000}"
phase_ok load_env

log_session_env ota \
  "INSTALL_DIR=${INSTALL_DIR}" \
  "TAG=${TAG}" \
  "IMAGE_TAG=${IMAGE_TAG}" \
  "ROVER_PORT=${ROVER_PORT:-8000}" \
  "ROVER_OTA_SSH_KEY_PATH=${ROVER_OTA_SSH_KEY_PATH:-<unset>}"

phase_start git_fetch_checkout
GIT_REF=$(resolve_git_ref "$TAG" "$INSTALL_DIR")
log_info git_fetch_checkout "Resolved TAG=${TAG} git_ref=${GIT_REF}"
run_cmd git_fetch_checkout "git remote -v" git remote -v
run_cmd git_fetch_checkout "git fetch --tags" git fetch --tags origin
run_cmd git_fetch_checkout "git checkout ${GIT_REF}" git checkout "$GIT_REF"
run_cmd git_fetch_checkout "git rev-parse HEAD" git rev-parse HEAD
run_cmd git_fetch_checkout "git describe --tags" git describe --tags --always
phase_ok git_fetch_checkout

phase_start compose_pull
run_cmd compose_pull "compose pull backend frontend" $COMPOSE pull backend frontend
phase_ok compose_pull

phase_start compose_up
run_cmd compose_up "compose up -d" $COMPOSE up -d --remove-orphans
run_cmd compose_up "compose ps" $COMPOSE ps
phase_ok compose_up

phase_start health_check
HEALTH_URL="http://localhost:${ROVER_PORT:-8000}/health"
wait_for_health "$HEALTH_URL" 40 3 health_check
phase_ok health_check

phase_start complete
duration=$(( $(date +%s) - SESSION_START_EPOCH ))
log_info complete "OTA update to ${TAG} completed successfully (duration: ${duration}s)"
phase_ok complete
