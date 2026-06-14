# FPV Rover

Monorepo for an FPV rover (LEGO Audi e-tron) on Raspberry Pi Zero 2 W.

## Contents

### Overview

- [Structure](#structure)
- [Requirements](#requirements)

### Local development

- [Environment](#environment)
- [Backend — quick start](#backend--quick-start)
- [Frontend](#frontend)
- [Backend ↔ frontend sync](#backend--frontend-sync)
  - [Shared configuration (`.env`)](#1-shared-configuration-env)
  - [REST — module flags](#2-rest--module-flags)
  - [WebSocket — telemetry and commands](#3-websocket--telemetry-and-commands)
  - [Video — WebRTC (WHEP)](#4-video--webrtc-whep)
  - [Sync checklist](#sync-checklist)

### Infrastructure

- [Infra / Docker](#infra--docker)

### Production (Raspberry Pi)

- [OTA updates](#ota-updates-production)
  - [Prerequisites on the Pi](#prerequisites-on-the-pi)
  - [First install](#first-install)
  - [Bootstrap options](#bootstrap-options)
  - [Environment variables (OTA)](#environment-variables-ota)
  - [Releasing a new version](#releasing-a-new-version)
  - [Updating from the UI](#updating-from-the-ui)
  - [Manual update / rollback](#manual-update--rollback)
  - [Boot persistence (optional)](#boot-persistence-optional)

---

## Structure

```
fpv-rover/
├── backend/          # Python — FastAPI, hardware modules, WebSocket telemetry
│   └── modules/<name>/   # e.g. power.config.py, power.module.py, power.schema.py, power.utils.py
├── frontend/         # React UI — dashboard, OSD, video, controls
├── infra/            # Nginx reverse proxy, MediaMTX streaming config
├── .env.example      # Shared environment template (backend + frontend)
└── docker-compose.yml
```

## Requirements

- Python **3.14.5** (managed via [uv](https://docs.astral.sh/uv/))
- [uv](https://docs.astral.sh/uv/) for backend dependencies
- **Node.js 22+** and npm for the frontend

---

## Environment

Both backend and frontend read from a **single root `.env` file**:

```bash
cp .env.example .env
```

| Variable | Default | Used by | Description |
|----------|---------|---------|-------------|
| `ROVER_MODULES_POWER_ENABLED` | `false` | backend | INA219 power module |
| `ROVER_MODULES_MOTION_ENABLED` | `false` | backend | TB6612FNG motion module |
| `ROVER_MODULES_THERMAL_ENABLED` | `false` | backend | DS18B20 thermal module |
| `ROVER_MODULES_IMU_ENABLED` | `false` | backend | MPU6050 IMU module |
| `ROVER_MODULES_LIGHT_ENABLED` | `false` | backend | BH1750 light module |
| `ROVER_MODULES_CAMERA_ENABLED` | `false` | backend | MediaMTX camera integration |
| `ROVER_LOG_LEVEL` | `INFO` | backend | Logging level |
| `ROVER_I2C_BUS` | `1` | backend | I2C bus number |
| `ROVER_W1_GPIO` | `4` | backend | 1-Wire GPIO pin |
| `ROVER_WS_TELEMETRY_HZ` | `20` | backend | WebSocket telemetry rate |
| `ROVER_HEARTBEAT_TIMEOUT_SEC` | `1.0` | backend | Watchdog heartbeat timeout |
| `ROVER_IO_RETRY_DELAY_SEC` | `2.0` | backend | Hardware I/O retry delay |
| `ROVER_MEDIAMTX_API_URL` | `http://mediamtx:9997` | backend | MediaMTX control API (Docker service name) |
| `VITE_RPI_HOST` | `localhost` | frontend | Dev server proxy target; production WebRTC fallback |
| `VITE_API_PORT` | `8000` | frontend | Dev server proxy target |
| `VITE_WEBRTC_PORT` | `8889` | frontend | MediaMTX WebRTC (WHEP) port in the browser |

Backend loads `ROVER_*` via pydantic-settings (`backend/core/config.py`).  
Frontend loads `VITE_*` via Vite with `envDir` pointing at the repo root (`frontend/vite.config.ts`).

> **Note:** `VITE_*` variables are embedded at **build time**. After changing them, rebuild the frontend (`npm run build` or `docker compose build frontend`).

## Backend — quick start

```bash
uv sync --project backend
uv run --project backend pytest
uv run --project backend ruff check
uv run --project backend ruff format
uv run --project backend fpv-rover
```

API: `http://localhost:8000` — OpenAPI docs at `/docs`.

Install pre-commit hooks (from repo root):

```bash
uv run --project backend pre-commit install
```

## Frontend

React 19 SPA for driving the rover: live video (WebRTC), telemetry OSD, dashboard controls, keyboard and gamepad input.

**Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Zustand, Zod, Axios.

### Quick start

From the repo root (uses root `.env` automatically):

```bash
cd frontend
npm ci
npm run dev
```

Dev server: `http://localhost:5173`. Vite proxies `/api` and `/ws` to the backend using `VITE_RPI_HOST` and `VITE_API_PORT`.

```bash
npm run build    # production bundle → dist/
npm run lint
npm run preview  # serve dist/ locally
```

For local development, run the backend and frontend in separate terminals:

```bash
# terminal 1
uv run --project backend fpv-rover

# terminal 2
cd frontend && npm run dev
```

## Backend ↔ frontend sync

The UI talks to the backend over three channels. Keep their contracts aligned when you change either side.

### 1. Shared configuration (`.env`)

Use one root `.env` for both services. Module flags (`ROVER_MODULES_*`) are exposed to the UI via `GET /config`; the frontend fetches them on startup and shows or hides controls accordingly.

When deploying on a Pi or via Docker, REST and WebSocket use nginx on port 80 (`/api`, `/ws`) — no per-device frontend rebuild needed. WebRTC/WHEP uses `window.location.hostname` and `VITE_WEBRTC_PORT` (not proxied through nginx).

### 2. REST — module flags

| | Backend | Frontend |
|---|---------|----------|
| Endpoint | `GET /config` | `fetchConfig()` in `frontend/src/api/config.ts` |
| Schema | `backend/core/schemas/config.py` → `ConfigResponse` | `frontend/src/types/schemas.ts` → `ConfigResponseSchema` |
| Types | OpenAPI (`/openapi.json`) | `frontend/src/types/contracts.ts` |

**After changing the REST API:**

1. Update Pydantic models in the matching backend module (`backend/modules/<name>/<name>.schema.py`) or `backend/core/schemas/` / `backend/api/schemas/` for wire envelopes.
2. Run backend tests: `uv run --project backend pytest`.
3. Mirror the shape in `frontend/src/types/schemas.ts` (Zod) and `frontend/src/types/contracts.ts` (TypeScript interfaces).
4. Optionally regenerate REST types (backend must be running):

   ```bash
   cd frontend
   npm run generate:api
   ```

   This fetches `http://localhost:8000/openapi.json`. Today `api.generated.ts` re-exports hand-written types; extend the workflow as OpenAPI coverage grows.

### 3. WebSocket — telemetry and commands

| | Backend | Frontend |
|---|---------|----------|
| Endpoint | `WS /ws` | `frontend/src/api/websocket.ts` |
| Server → client | `backend/modules/<name>/<name>.schema.py`, `backend/api/schemas/telemetry.py`, `errors.py` | `TelemetryMessageSchema`, `ErrorMessageSchema` |
| Client → server | `backend/modules/<name>/<name>.schema.py`, `backend/api/schemas/commands.py` | `ClientCommandSchema` (+ `sendMove`, `sendBrightness`, `sendRecord`) |
| Docs | `GET /ws-protocol` | — |

**Message types (must stay in sync):**

- **Telemetry** (20 Hz): `{ type: "telemetry", modules: { power?, motion?, light?, thermal?, imu? } }`
- **Commands:** `heartbeat` (every 500 ms), `move`, `set_brightness`, `record`
- **Errors:** `{ type: "error", message: string }`

Backend validates incoming commands with Pydantic; the frontend validates outbound commands with Zod before sending.

**After changing WebSocket payloads:**

1. Edit the module schema in `backend/modules/<name>/<name>.schema.py` and, if needed, aggregates in `backend/api/schemas/`.
2. Update matching Zod schemas in `frontend/src/types/schemas.ts`.
3. Update TypeScript interfaces in `frontend/src/types/contracts.ts` if needed.
4. Run `uv run --project backend pytest` and exercise the UI against a running backend.

Use `GET /ws-protocol` on a running backend to inspect the documented JSON shapes.

### 4. Video — WebRTC (WHEP)

Video does not go through the FastAPI backend. MediaMTX serves the stream; the frontend connects via WHEP:

- Stream path: `rover` (see `infra/mediamtx/mediamtx.yml`)
- Frontend: `POST http://{VITE_RPI_HOST}:{VITE_WEBRTC_PORT}/rover/whep` (`frontend/src/api/webrtc.ts`)
- Backend camera module controls recording via `ROVER_MEDIAMTX_API_URL`

Keep `VITE_WEBRTC_PORT` aligned with MediaMTX `webrtcAddress` (default **8889**).

### Sync checklist

When you add or change an API field:

- [ ] Pydantic model in `backend/modules/<name>/<name>.schema.py` (or `backend/api/schemas/` / `backend/core/schemas/` for shared envelopes)
- [ ] Zod schema in `frontend/src/types/schemas.ts`
- [ ] TypeScript interface in `frontend/src/types/contracts.ts` (if applicable)
- [ ] Backend tests (`pytest`)
- [ ] Manual check: backend running + `npm run dev` or built frontend

---

## Infra / Docker

```bash
cp .env.example .env
docker compose up --build
```

| Service | Port(s) | Role |
|---------|---------|------|
| `backend` | 8000 | FastAPI, hardware modules |
| `frontend` | 3000 | Static SPA (Caddy) |
| `nginx` | 80 | Reverse proxy: `/` → frontend, `/api/` and `/ws` → backend |
| `mediamtx` | 8554, 8889, 9997 | RTSP, WebRTC, control API (custom build for Arducam/Pivariety via RPi libcamera) |

Both `backend` and `frontend` services mount the root `.env`. Frontend build args (`VITE_*`) are passed from the same file at image build time. `mediamtx` is built from [`infra/mediamtx/Dockerfile`](infra/mediamtx/Dockerfile) locally; production pulls a pre-built image from GHCR (see [OTA updates](#ota-updates-production)).

Pi device mounts (`/dev/i2c-1`, `/dev/video0`, 1-Wire) are configured in [`docker-compose.yml`](docker-compose.yml) for the backend service.

Production UI on port 80: REST → `/api`, WebSocket → `/ws` (via nginx). WebRTC/WHEP → `http://<pi-ip>:8889/rover/whep` in the browser.

---

## OTA updates (production)

On Raspberry Pi Zero 2 W, backend, frontend, and mediamtx images are built in GitHub Actions (arm64) when their source changes, then pulled at runtime — no local `npm run build` or `docker compose build` on the device.

### Prerequisites on the Pi

Bootstrap requires **git**, **curl**, **Docker**, and the **Docker Compose** plugin (`docker compose`). On a fresh Raspberry Pi OS image these are often missing.

#### 1. Git and curl

```bash
sudo apt update
sudo apt install -y git curl
```

#### 2. Docker and Docker Compose

Install Docker Engine and the Compose plugin (official convenience script for Raspberry Pi OS / Debian):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Log out and back in (or run `newgrp docker` as above) so your user can run Docker without `sudo`. Bootstrap needs daemon access for `compose pull/up`.

Verify:

```bash
docker --version
docker compose version
docker ps
```

#### 3. I2C and 1-Wire

Backend expects `/dev/i2c-1` and `/sys/bus/w1` on the host (see [`docker-compose.yml`](docker-compose.yml)). Enable both before bootstrap — sensors do not need to be connected yet.

```bash
sudo raspi-config
# Interface Options → I2C → Enable
# Interface Options → 1-Wire → Enable
sudo reboot
```

Or add to `/boot/firmware/config.txt` (older images: `/boot/config.txt`):

```
dtparam=i2c_arm=on
dtoverlay=w1-gpio,gpiopin=4
```

After reboot, verify:

```bash
ls /dev/i2c-1
ls /sys/bus/w1
```

`gpiopin=4` matches the default `ROVER_W1_GPIO=4` in `.env.example`.

#### 4. SSH deploy key

Bootstrap can generate one interactively, or configure manually:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/fpv_rover_deploy -N ""
cat ~/.ssh/fpv_rover_deploy.pub
```

Add the public key in GitHub → **Settings → Deploy keys** (read-only).

`~/.ssh/config`:

```sshconfig
Host github.com
  IdentityFile ~/.ssh/fpv_rover_deploy
  IdentitiesOnly yes
```

With `./scripts/bootstrap.sh`, the script generates the key at `$HOME/.ssh/fpv_rover_deploy` (current user), pauses to show the public key, and waits for you to add it in GitHub.

#### 5. GHCR login (only if images are private)

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

PAT needs `read:packages`. Public GHCR packages do not require login.

### First install

```bash
sudo mkdir -p /opt/fpv-rover && sudo chown "$USER" /opt/fpv-rover
git clone git@github.com:Aspience/fpv-rover.git /opt/fpv-rover
cd /opt/fpv-rover
./scripts/bootstrap.sh --enable-systemd
# or pin a release tag:
./scripts/bootstrap.sh --tag v0.1.5 --enable-systemd
```

Bootstrap creates `.env` from `.env.example` with production values (`ROVER_OTA_ENABLED=true`, `VITE_RPI_HOST`, `IMAGE_TAG`, etc.). It does **not** create `.env.local`.

Before pulling images, bootstrap **pauses** so you can edit env interactively (opens `${EDITOR:-nano}` on request). Set module flags, confirm `VITE_RPI_HOST`, and optionally create `.env.local` for hardware IDs — then press Enter to continue.

Example `.env.local` (do **not** copy the full `.env.example` — `.env.local` overrides `.env` and would reset OTA settings to example defaults):

```
ROVER_MODULES_CAMERA_ENABLED=true
ROVER_THERMAL_SENSOR_IDS={"motor_steering":"28-..."}
```

Use `--non-interactive` to skip the env edit pause (e.g. when env is preconfigured via files or env vars).

Production images are pulled from `${FPV_ROVER_IMAGE_REGISTRY}/${ROVER_GITHUB_OWNER}/${ROVER_GITHUB_REPO}-{backend,frontend,mediamtx}` with per-service tags resolved at deploy time. `IMAGE_TAG` in `.env` is the target release; bootstrap and OTA read `image-tags.env` from the checked-out release (or fall back to the nearest existing GHCR tag per service).

### Bootstrap options

| Flag | Default | Description |
|------|---------|-------------|
| `--install-dir PATH` | `/opt/fpv-rover` | Install path on the device |
| `--tag TAG` | `latest` (or `$IMAGE_TAG`) | Git tag and Docker image tag to deploy |
| `--repo URL` | `git@github.com:Aspience/fpv-rover.git` | Git remote for clone/fetch |
| `--non-interactive` | off | Fail fast if SSH/GitHub/GHCR setup is missing |
| `--skip-clone` | off | Skip clone when repo is already in `--install-dir` |
| `--skip-ssh` | off | Skip SSH key generation and GitHub deploy-key prompt |
| `--skip-ghcr-login` | off | Skip `docker login ghcr.io` |
| `--skip-deploy` | off | Setup only (env, clone) — no `compose pull/up` |
| `--enable-systemd` | off | Install and enable `infra/systemd/fpv-rover.service` |
| `--quiet` | off | Less stdout; log file stays verbose |

| Env var | Used for |
|---------|----------|
| `VITE_RPI_HOST` | Browser-facing Pi IP/hostname (non-interactive bootstrap) |
| `IMAGE_TAG` | Default tag when `--tag` is omitted |
| `GHCR_USER` + `GHCR_TOKEN` | Optional GHCR login (public packages skip this) |

**Logs:** `/opt/fpv-rover/logs/bootstrap.log` — full session with timestamps, phases, and command output.

```bash
tail -100 /opt/fpv-rover/logs/bootstrap.log
```

### Environment variables (OTA)

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_OTA_ENABLED` | `false` | Allow `POST /update/apply` (set `true` on Pi) |
| `ROVER_OTA_INSTALL_DIR` | `/opt/fpv-rover` | Install path on the device |
| `ROVER_OTA_SCRIPT` | `/opt/fpv-rover/scripts/ota_update.sh` | Update script path |
| `ROVER_OTA_SSH_KEY_PATH` | *(empty in template)* | Host path to deploy key; bootstrap sets `$HOME/.ssh/fpv_rover_deploy` for the user running install |
| `ROVER_GITHUB_OWNER` | `aspience` | GitHub owner for release check and GHCR image path |
| `ROVER_GITHUB_REPO` | `fpv-rover` | GitHub repo for release check and GHCR image path |
| `ROVER_GITHUB_TOKEN` | *(empty)* | Optional PAT for GitHub API rate limits |
| `FPV_ROVER_IMAGE_REGISTRY` | `ghcr.io` | Container registry for production images |
| `IMAGE_TAG` | `latest` | Target release tag for git checkout and app version |
| `BACKEND_IMAGE_TAG` | *(auto)* | Override backend image tag (pin/rollback) |
| `FRONTEND_IMAGE_TAG` | *(auto)* | Override frontend image tag (pin/rollback) |
| `MEDIAMTX_IMAGE_TAG` | *(auto)* | Override mediamtx image tag (pin/rollback) |

**Custom env on device:** edit `.env` for shared settings; add `.env.local` for overrides only (both are gitignored). Compose loads `.env` then optional `.env.local`. Do not copy the full `.env.example` into `.env.local` — it overrides bootstrap values such as `ROVER_OTA_ENABLED`.

### Releasing a new version

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions (`.github/workflows/release.yml`) builds arm64 backend, frontend, and mediamtx images and pushes them to GHCR. Each service is rebuilt **only when its context changed** since the previous `v*` tag (`backend/`, `frontend/`, `infra/mediamtx/`). Skipped services keep their previous image tag; `:latest` is updated only for services that were rebuilt.

The workflow writes `image-tags.env` with the resolved tag for each service (example when mediamtx was unchanged in `v0.2.0`):

```env
IMAGE_TAG=v0.2.0
BACKEND_IMAGE_TAG=v0.2.0
FRONTEND_IMAGE_TAG=v0.2.0
MEDIAMTX_IMAGE_TAG=v0.1.9
```

Release assets include `image-tags.env`, `docker-compose.yml`, `docker-compose.prod.yml`, `infra/**/*`, `scripts/ota_update.sh`, `scripts/bootstrap.sh`, `scripts/lib/common.sh`, and `.env.example`.

### Updating from the UI

Open **Settings** → **Check for updates** → **Install update**. The UI shows a fullscreen overlay while the rover restarts and polls `GET /health` every 3 seconds until the backend is back.

### Manual update / rollback

```bash
cd /opt/fpv-rover
./scripts/ota_update.sh v0.2.0   # upgrade
./scripts/ota_update.sh v0.1.0   # rollback
```

The script waits 3 seconds (so the API can respond), fetches the git tag, resolves per-service image tags from `image-tags.env` (with nearest-tag fallback for older releases), pulls Docker images, and runs `docker compose up -d`. It never overwrites `.env` or `.env.local`.

**Logs:** `/opt/fpv-rover/logs/ota.log`

```bash
tail -100 /opt/fpv-rover/logs/ota.log
```

### Boot persistence (optional)

Bootstrap can install the systemd unit with `--enable-systemd`, or manually from [`infra/systemd/fpv-rover.service`](infra/systemd/fpv-rover.service):

```bash
sudo cp infra/systemd/fpv-rover.service /etc/systemd/system/
sudo systemctl enable --now fpv-rover
```
