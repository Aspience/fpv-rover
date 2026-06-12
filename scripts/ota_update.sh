#!/usr/bin/env bash
set -euo pipefail

sleep 3

INSTALL_DIR="${ROVER_OTA_INSTALL_DIR:-/opt/fpv-rover}"
TAG="${1:-${IMAGE_TAG:-latest}}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
LOG_DIR="${INSTALL_DIR}/logs"
LOG_FILE="${LOG_DIR}/ota.log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

log "Starting OTA update to tag: ${TAG}"

cd "$INSTALL_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export IMAGE_TAG="$TAG"
export ROVER_OTA_INSTALL_DIR="$INSTALL_DIR"

log "Fetching tags from origin..."
git fetch --tags origin
git checkout "$TAG"

log "Pulling Docker images..."
$COMPOSE pull backend frontend

log "Applying update..."
$COMPOSE up -d --remove-orphans

log "Waiting for backend health..."
HEALTH_URL="http://localhost:${ROVER_PORT:-8000}/health"
MAX_ATTEMPTS=40
ATTEMPT=0

until curl -sf "$HEALTH_URL" >/dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [[ $ATTEMPT -ge $MAX_ATTEMPTS ]]; then
    log "ERROR: Health check timed out after $((MAX_ATTEMPTS * 3)) seconds"
    exit 1
  fi
  sleep 3
done

log "OTA update to ${TAG} completed successfully"
