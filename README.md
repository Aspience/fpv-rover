# FPV Rover

Monorepo for an FPV rover (LEGO Audi e-tron) controlled from a web UI with live video, telemetry OSD, and optional physical gamepad input.

## Contents

- [Overview](#overview)
- [Hardware requirements](#hardware-requirements)
- [Software requirements](#software-requirements)
- [Installation and updates](#installation-and-updates)
  - [Prerequisites on the Pi](#prerequisites-on-the-pi)
  - [First install (bootstrap)](#first-install-bootstrap)
  - [Updating to a new version](#updating-to-a-new-version)
- [Technical reference](#technical-reference)
  - [Repository structure](#repository-structure)
  - [Backend modules](#backend-modules)
  - [Environment variables](#environment-variables)
  - [Local development](#local-development)
  - [Backend ↔ frontend sync](#backend--frontend-sync)
  - [Infra / Docker](#infra--docker)
  - [Releasing a new version](#releasing-a-new-version)
  - [Boot persistence (optional)](#boot-persistence-optional)

---

## Overview

The project follows a **modular architecture**: each hardware capability (motion, power, thermal, IMU, light, camera, gamepad) is an independent backend module under `backend/modules/<name>/`. Gamepads connect over USB or **Bluetooth** (the `bluetooth` module handles wireless pairing; `gamepad` reads input via evdev). Modules are toggled at runtime via `ROVER_MODULES_*` feature flags in `.env` — only enabled modules are loaded, initialized, and exposed to the UI.

This design lets you **mix and match hardware configurations** without changing application code. A minimal bench setup might enable only `camera` and `motion`; a fully instrumented rover can enable every sensor. The frontend reads module flags from `GET /config` on startup and shows or hides controls accordingly.

The stack runs on **Raspberry Pi** (reference build: Pi Zero 2 W) inside Docker Compose: FastAPI backend, React SPA, nginx reverse proxy, MediaMTX for WebRTC video, and a pigpio sidecar for GPIO/PWM motor control.

---

## Hardware requirements

The reference rover is built around a **Raspberry Pi** (64-bit). Peripherals connect over the buses listed below.

| Component | Module / role | Bus / interface |
|-----------|---------------|-----------------|
| **Raspberry Pi Zero 2 W** (or compatible Pi 3/4/5) | Host — runs Docker stack | — |
| **Arducam IMX462** (Pivariety) | FPV camera, night mode | **CSI-2** → libcamera / V4L2 (`/dev/video0`) |
| **GY-302** (BH1750) | Ambient light sensor; triggers camera night mode below threshold | **I2C** (default address `0x23`) |
| **DS18B20** | Temperature sensors (motors, BMS, BEC, charger) | **1-Wire** (default GPIO 4 via `dtoverlay=w1-gpio`) |
| **TB6612FNG** × 3 | Motor drivers — front drive, rear drive, steering (LEGO Control+ hubs) | **GPIO / PWM** via pigpio daemon; encoder tachos on GPIO |
| **GY-521** (MPU6050) | Gyroscope + accelerometer (orientation OSD) | **I2C** (default address `0x68`) |
| **INA219** | Battery voltage and current monitoring | **I2C** (default address `0x40`) |
| **BMS 2S** battery charge controller | 2S Li-ion pack — **2P2S** layout (four 18650 cells) | Passive power path; temperature via DS18B20 on 1-Wire |
| **iFlight Micro 2–8S BEC** | Switched regulator — 5 V supply for the Pi | Power only (no data bus) |
| **TOF400C** | Laser ToF distance sensor | **I2C** (planned; not yet implemented in software) |
| **Gamepad** (USB or Bluetooth) | Physical input (optional); **Bluetooth** is used to pair wireless controllers, then input is read via evdev | **Bluetooth** (pairing, host netns via `nsenter`) → **evdev** (`/dev/input/event*`) |

### Host interfaces to enable

Before deployment, enable these on the Pi (see [Prerequisites on the Pi](#prerequisites-on-the-pi)):

| Interface | Used by |
|-----------|---------|
| I2C (`/dev/i2c-1`) | INA219, BH1750, MPU6050, TOF400C |
| 1-Wire (`/sys/bus/w1`) | DS18B20 |
| GPIO / pigpio (`/dev/gpiochip0`) | TB6612FNG motor drivers |
| CSI camera + Arducam overlay | IMX462 |
| Bluetooth | Gamepad pairing (wireless controllers) |
| evdev (`/dev/input`) | Gamepad input (USB and paired Bluetooth) |

Motion and gamepad modules require the **pigpiod** Docker sidecar. Without pigpio or when the daemon is unreachable, motion falls back to mock hardware (useful for local dev).

---

## Software requirements

| Requirement | Notes |
|-------------|-------|
| **Linux 64-bit** | Required for production images and MediaMTX arm64 build |
| **Raspberry Pi OS Lite 64-bit** (recommended) | Bookworm or Trixie; Bullseye supported on Pi 4 and older |
| **Docker Engine** + **Docker Compose** plugin | Production deployment and OTA updates |
| **git**, **curl** | Bootstrap and OTA scripts |

For local development on any OS: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node.js 20+ for the frontend.

---

## Installation and updates

On Raspberry Pi, backend, frontend, and mediamtx images are built in GitHub Actions (arm64) and pulled at runtime — no local `npm run build` or `docker compose build` on the device.

### Prerequisites on the Pi

Bootstrap requires **git**, **curl**, **Docker**, and the **Docker Compose** plugin. On a fresh Raspberry Pi OS image these are often missing.

#### 1. Git and curl

```bash
sudo apt update
sudo apt install -y git curl
```

#### 2. Docker and Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
```

Log out and back in (or run `newgrp docker`) so your user can run Docker without `sudo`.

Verify:

```bash
docker --version
docker compose version
docker ps
```

#### 3. I2C and 1-Wire

Backend expects `/dev/i2c-1` and `/sys/bus/w1` on the host. Enable both before bootstrap — sensors do not need to be connected yet.

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

#### 4. Arducam IMX462 camera drivers

The IMX462 is an **Arducam Pivariety** module. It requires Arducam's custom libcamera stack and a device-tree overlay on the host (outside Docker). Follow the [Arducam Pivariety Quick Start Guide](https://docs.arducam.com/Raspberry-Pi-Camera/Pivariety-Camera/Quick-Start-Guide/).

**Step 1 — download the install script:**

```bash
wget -O install_pivariety_pkgs.sh https://github.com/ArduCAM/Arducam-Pivariety-V4L2-Driver/releases/download/install_script/install_pivariety_pkgs.sh
chmod +x install_pivariety_pkgs.sh
```

**Step 2 — install Arducam libcamera (on the Pi host, before or after bootstrap):**

```bash
./install_pivariety_pkgs.sh -p libcamera_dev
./install_pivariety_pkgs.sh -p libcamera_apps
```

No reboot yet — proceed to Step 3.

**Step 3 — enable the camera overlay** in `/boot/firmware/config.txt` (Pi 4/5 Bookworm/Trixie; older images may use `/boot/config.txt`):

```
camera_auto_detect=0
dtoverlay=arducam-pivariety
```

On Pi 5 / CM5 with the camera on the **CAM0** port, use `dtoverlay=arducam-pivariety,cam0` instead.

Save and reboot:

```bash
sudo reboot
```

**Verify** after reboot:

```bash
rpicam-still --list-cameras    # Bookworm / Trixie
# or: libcamera-still --list-cameras   # Bullseye
ls /dev/video0
```

The MediaMTX container ships with Arducam libcamera libraries baked in ([`infra/mediamtx/Dockerfile`](infra/mediamtx/Dockerfile)); the **host overlay and libcamera packages** are still required for the camera device node to appear.

> If you see `Configuration file 'arducam-pivariety.json' not found for IPA module 'rpi/pisp'`, it can be safely ignored — the config is embedded in camera firmware.

#### 5. SSH deploy key

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

#### 6. GHCR login (only if images are private)

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

PAT needs `read:packages`. Public GHCR packages do not require login.

### First install (bootstrap)

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
ROVER_MODULES_MOTION_ENABLED=true
ROVER_MODULES_GAMEPAD_ENABLED=true
ROVER_MODULES_CAMERA_ENABLED=true
ROVER_THERMAL_SENSOR_IDS={"motor_steering":"28-..."}
```

Use `--non-interactive` to skip the env edit pause when env is preconfigured.

#### Bootstrap options

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

**Logs:** `/opt/fpv-rover/logs/bootstrap.log`

```bash
tail -100 /opt/fpv-rover/logs/bootstrap.log
```

### Updating to a new version

#### From the UI

Open **Settings** → **Check for updates** → **Install update**. The UI shows a fullscreen overlay while the rover restarts and polls `GET /health` every 3 seconds until the backend is back.

Requires `ROVER_OTA_ENABLED=true` (set by bootstrap on production installs).

#### Manual update / rollback (OTA script)

```bash
cd /opt/fpv-rover
./scripts/ota_update.sh v0.2.0        # upgrade (prompts for confirmation)
./scripts/ota_update.sh v0.1.0        # rollback (prompts for confirmation)
./scripts/ota_update.sh v0.2.0 --yes  # skip the confirmation prompt
```

The script waits 3 seconds (so the API can respond), fetches the git tag, resolves per-service image tags from `image-tags.env` (with nearest-tag fallback for older releases), pulls Docker images, and runs `docker compose up -d`. It never overwrites `.env` or `.env.local`.

Before any destructive step the script asks:

```text
Update from v0.1.0 to v0.2.0? [y/N]
```

The prompt is skipped when running non-interactively (backend OTA API), with `--yes`/`-y`, or when `ROVER_OTA_ASSUME_YES=1`.

**Logs:** `/opt/fpv-rover/logs/ota.log`

```bash
tail -100 /opt/fpv-rover/logs/ota.log
```

---

## Technical reference

### Repository structure

```
fpv-rover/
├── backend/          # Python — FastAPI, hardware modules, WebSocket
│   ├── api/          # REST routes, WebSocket handler, command/telemetry schemas
│   ├── core/         # Settings, event bus, module registry, startup
│   ├── modules/      # Pluggable hardware modules (see below)
│   └── tests/
├── frontend/         # React SPA — live video, OSD, motion levers, settings
├── infra/            # Nginx reverse proxy, MediaMTX, systemd unit
├── scripts/          # Bootstrap and OTA update scripts
├── .env.example      # Shared environment template (backend + frontend)
└── docker-compose.yml
```

Each backend module typically has `*.module.py`, `*.schema.py`, `*.config.py`, and optional `*.utils.py` / `*.service.py`.

### Backend modules

| Module | Role |
|--------|------|
| `motion` | LEGO Control+ drive (front/rear) + steering via TB6612FNG + pigpio; PID closed loop, homing calibration |
| `gamepad` | Physical gamepad over Linux evdev (`/dev/input`); maps to motion commands |
| `power` | INA219 battery monitoring (I2C) |
| `thermal` | DS18B20 temperature sensors (1-Wire) |
| `imu` | MPU6050 orientation (I2C) |
| `light` | BH1750 ambient lux (I2C); triggers camera night mode below threshold |
| `camera` | MediaMTX integration — recording and stream config |
| `bluetooth` | Bluetooth gamepad pairing (host netns via `nsenter`) |

When `ROVER_MODULES_MOTION_ENABLED=true`, the backend runs **steering calibration automatically** on startup (`core/startup.py`). Physical gamepad input requires both `ROVER_MODULES_GAMEPAD_ENABLED` and `ROVER_MODULES_MOTION_ENABLED`.

Motion tuning constants (PID loop rate, homing power, throttle limits) live in `motion.config.py`. Gamepad evdev codes and poll intervals — in `gamepad.config.py`. GPIO pins, PID gains, and speed limits are runtime settings via `ROVER_*` env.

### Environment variables

Both backend and frontend read from a **single root `.env` file**:

```bash
cp .env.example .env
```

On the Pi or in Docker, optional `.env.local` overrides `.env` without touching git-tracked files.

#### Feature flags

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_MODULES_POWER_ENABLED` | `false` | INA219 power module |
| `ROVER_MODULES_MOTION_ENABLED` | `false` | Motion module (LEGO Control+ + TB6612FNG) |
| `ROVER_MODULES_GAMEPAD_ENABLED` | `false` | Physical gamepad via evdev |
| `ROVER_MODULES_THERMAL_ENABLED` | `false` | DS18B20 thermal module |
| `ROVER_MODULES_IMU_ENABLED` | `false` | MPU6050 IMU module |
| `ROVER_MODULES_LIGHT_ENABLED` | `false` | BH1750 light module |
| `ROVER_MODULES_CAMERA_ENABLED` | `false` | MediaMTX camera integration |
| `ROVER_MODULES_BLUETOOTH_ENABLED` | `false` | Bluetooth gamepad pairing |

Backend loads `ROVER_*` via pydantic-settings (`backend/core/config.py`).  
Frontend loads `VITE_*` via Vite with `envDir` pointing at the repo root (`frontend/vite.config.ts`).

> **Note:** `VITE_*` variables are embedded at **build time**. After changing them, rebuild the frontend (`npm run build` or `docker compose build frontend`).

#### Motion & pigpio

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_PIGPIO_HOST` | `pigpiod` | pigpio daemon hostname (Docker service name) |
| `ROVER_PIGPIO_PORT` | `8888` | pigpio daemon TCP port |
| `ROVER_MOTION_FRONT_PWMA_GPIO` | `18` | Front drive — PWM pin (TB6612FNG PWMA) |
| `ROVER_MOTION_FRONT_AIN1_GPIO` | `23` | Front drive — direction AIN1 |
| `ROVER_MOTION_FRONT_AIN2_GPIO` | `24` | Front drive — direction AIN2 |
| `ROVER_MOTION_FRONT_TACHO_A_GPIO` | `17` | Front drive — encoder channel A |
| `ROVER_MOTION_FRONT_TACHO_B_GPIO` | `27` | Front drive — encoder channel B |
| `ROVER_MOTION_REAR_PWMA_GPIO` | `12` | Rear drive — PWM pin |
| `ROVER_MOTION_REAR_AIN1_GPIO` | `16` | Rear drive — direction AIN1 |
| `ROVER_MOTION_REAR_AIN2_GPIO` | `20` | Rear drive — direction AIN2 |
| `ROVER_MOTION_REAR_TACHO_A_GPIO` | `5` | Rear drive — encoder channel A |
| `ROVER_MOTION_REAR_TACHO_B_GPIO` | `6` | Rear drive — encoder channel B |
| `ROVER_MOTION_STEER_PWMA_GPIO` | `13` | Steering — PWM pin |
| `ROVER_MOTION_STEER_AIN1_GPIO` | `19` | Steering — direction AIN1 |
| `ROVER_MOTION_STEER_AIN2_GPIO` | `26` | Steering — direction AIN2 |
| `ROVER_MOTION_STEER_TACHO_A_GPIO` | `21` | Steering — encoder channel A |
| `ROVER_MOTION_STEER_TACHO_B_GPIO` | `22` | Steering — encoder channel B |
| `ROVER_MOTION_MAX_SPEED_TICKS` | `800` | Max drive speed in encoder ticks/s at full throttle |
| `ROVER_MOTION_STEER_MAX_DEG` | `45` | Maximum steering angle (°) |
| `ROVER_MOTION_PID_KP` | `0.8` | PID proportional gain |
| `ROVER_MOTION_PID_KI` | `0.05` | PID integral gain |
| `ROVER_MOTION_PID_KD` | `0.01` | PID derivative gain |

#### Global backend

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_LOG_LEVEL` | `INFO` | Logging level |
| `ROVER_HOST` | `0.0.0.0` | FastAPI bind address |
| `ROVER_PORT` | `8000` | FastAPI port |
| `ROVER_I2C_BUS` | `1` | Linux I2C bus number |
| `ROVER_W1_GPIO` | `4` | 1-Wire GPIO pin (must match `dtoverlay=w1-gpio`) |
| `ROVER_WS_TELEMETRY_HZ` | `20` | WebSocket telemetry broadcast rate (Hz) |
| `ROVER_HEARTBEAT_TIMEOUT_SEC` | `1.0` | Watchdog heartbeat timeout |
| `ROVER_IO_RETRY_DELAY_SEC` | `2.0` | Hardware I/O retry delay |

#### MediaMTX

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_MEDIAMTX_API_URL` | `http://mediamtx:9997` | MediaMTX control API |
| `ROVER_MEDIAMTX_RECORD_START_PATH` | `/v3/recordings/start/{stream_path}` | Start recording API path template |
| `ROVER_MEDIAMTX_RECORD_STOP_PATH` | `/v3/recordings/stop/{stream_path}` | Stop recording API path template |
| `ROVER_MEDIAMTX_STREAM_CONFIG_PATH` | `/v3/config/paths/patch/{stream_path}` | Patch stream config path template |
| `ROVER_MEDIAMTX_STREAM_CONFIG_GET_PATH` | `/v3/config/paths/get/{stream_path}` | Get stream config path template |

#### Hardware addresses & devices

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_POWER_I2C_ADDRESS` | `0x40` | INA219 I2C address |
| `ROVER_IMU_I2C_ADDRESS` | `0x68` | MPU6050 I2C address |
| `ROVER_LIGHT_I2C_ADDRESS` | `0x23` | BH1750 I2C address |
| `ROVER_W1_BASE_PATH` | `/sys/bus/w1/devices` | 1-Wire sysfs base path |
| `ROVER_THERMAL_W1_SLAVE_FILE` | `w1_slave` | Filename inside each sensor directory |
| `ROVER_THERMAL_SENSOR_IDS` | *(JSON map)* | DS18B20 ROM IDs keyed by sensor name |
| `ROVER_CAMERA_V4L2_DEVICE` | `/dev/video0` | Camera V4L2 device |
| `ROVER_CAMERA_V4L2_CTL_BIN` | `v4l2-ctl` | Path to `v4l2-ctl` binary |
| `ROVER_CAMERA_STREAM_PATH` | `rover` | MediaMTX stream path name |

#### Frontend (build-time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_RPI_HOST` | `localhost` | Dev server proxy target; production WebRTC fallback |
| `VITE_API_PORT` | `8000` | Dev server proxy target for REST/WebSocket |
| `VITE_WEBRTC_PORT` | `8889` | MediaMTX WebRTC (WHEP) port in the browser |

#### Docker / OTA (production)

| Variable | Default | Description |
|----------|---------|-------------|
| `ROVER_OTA_ENABLED` | `false` | Allow `POST /update/apply` (set `true` on Pi) |
| `ROVER_OTA_INSTALL_DIR` | `/opt/fpv-rover` | Install path on the device |
| `ROVER_OTA_SCRIPT` | `/opt/fpv-rover/scripts/ota_update.sh` | Update script path |
| `ROVER_OTA_SSH_KEY_PATH` | *(empty)* | Deploy key path; bootstrap sets `$HOME/.ssh/fpv_rover_deploy` |
| `ROVER_OTA_ASSUME_YES` | *(empty)* | Set `1`/`true` to skip manual-update confirmation |
| `ROVER_GITHUB_OWNER` | `aspience` | GitHub owner for release check and GHCR image path |
| `ROVER_GITHUB_REPO` | `fpv-rover` | GitHub repo for release check and GHCR image path |
| `ROVER_GITHUB_TOKEN` | *(empty)* | Optional PAT for GitHub API rate limits |
| `FPV_ROVER_IMAGE_REGISTRY` | `ghcr.io` | Container registry for production images |
| `IMAGE_TAG` | `latest` | Target release tag for git checkout and app version |
| `BACKEND_IMAGE_TAG` | *(auto)* | Pin backend image tag — override in `.env.local` |
| `FRONTEND_IMAGE_TAG` | *(auto)* | Pin frontend image tag — override in `.env.local` |
| `MEDIAMTX_IMAGE_TAG` | *(auto)* | Pin mediamtx image tag — override in `.env.local` |

> **Per-service tag precedence:** on deploy/OTA, tags are resolved as (1) explicit pin in `.env.local`, then (2) `image-tags.env` from the checked-out release, then (3) nearest existing GHCR tag. To pin a specific service tag, put it in `.env.local` (not `.env`, which the OTA script rewrites).

Compose also uses `PIGPIOD_IMAGE` (default `zinen2/alpine-pigpiod:pigpio-v79`) for the GPIO sidecar.

Production images are pulled from `${FPV_ROVER_IMAGE_REGISTRY}/${ROVER_GITHUB_OWNER}/${ROVER_GITHUB_REPO}-{backend,frontend,mediamtx}`.

### Local development

#### Backend

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

#### Frontend

React 19 SPA: live video (WebRTC), telemetry OSD, on-screen throttle/steer levers, keyboard shortcuts, light and camera controls. Physical gamepads are handled on the **backend** (evdev).

**Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Zustand, Zod, Axios.

```bash
cd frontend
npm ci
npm run dev          # http://localhost:5173
npm run build        # production bundle → dist/
npm run lint
npm run preview
```

Run backend and frontend in separate terminals:

```bash
# terminal 1
uv run --project backend fpv-rover

# terminal 2
cd frontend && npm run dev
```

Vite proxies `/api` and `/ws` to the backend using `VITE_RPI_HOST` and `VITE_API_PORT`.

### Backend ↔ frontend sync

The UI talks to the backend over three channels. Keep their contracts aligned when you change either side.

#### 1. Shared configuration (`.env`)

Module flags (`ROVER_MODULES_*`) are exposed via `GET /config`; the frontend fetches them on startup.

When deploying on a Pi or via Docker, REST and WebSocket use nginx on port 80 (`/api`, `/ws`). WebRTC/WHEP uses `window.location.hostname` and `VITE_WEBRTC_PORT` (not proxied through nginx).

#### 2. REST — module flags

| | Backend | Frontend |
|---|---------|----------|
| Endpoint | `GET /config` | `fetchConfig()` in `frontend/src/api/http.ts` |
| Schema | `backend/core/schemas/config.py` → `ConfigResponse` | `frontend/src/types/schemas.ts` → `ConfigResponseSchema` |
| Types | OpenAPI (`/openapi.json`) | `frontend/src/types/contracts.ts` |

**After changing the REST API:**

1. Update Pydantic models in `backend/modules/<name>/<name>.schema.py` or `backend/core/schemas/`.
2. Run `uv run --project backend pytest`.
3. Mirror the shape in `frontend/src/types/schemas.ts` (Zod) and `frontend/src/types/contracts.ts`.
4. Optionally regenerate REST types (backend must be running): `cd frontend && npm run generate:api`

#### 3. WebSocket — telemetry and commands

| | Backend | Frontend |
|---|---------|----------|
| Endpoint | `WS /ws` | `frontend/src/api/websocket.ts` |
| Server → client | `backend/modules/<name>/<name>.schema.py`, `backend/api/schemas/telemetry.py` | `TelemetryMessageSchema`, `ErrorMessageSchema` |
| Client → server | `backend/api/schemas/commands.py` | `ClientCommandSchema` |

**Message types:**

- **Telemetry** (default 20 Hz): `{ type: "telemetry", modules: { power?, motion?, light?, thermal?, imu?, bluetooth?, gamepad? } }`
- **Commands (frontend):** `heartbeat` (every 500 ms), `move`, `calibrate`, `set_brightness`
- **Commands (backend only today):** `record` — not yet sent from the UI
- **Errors:** `{ type: "error", message: string }`

Motion control from the UI, keyboard, or physical gamepad converges on the same backend path. Use `GET /ws-protocol` on a running backend to inspect documented JSON shapes.

> **Note:** `STEER_MAX_DEG` in `frontend/src/constants.ts` is hardcoded (default 45°). Keep it aligned with `ROVER_MOTION_STEER_MAX_DEG` when you change steering limits.

#### 4. Video — WebRTC (WHEP)

Video does not go through FastAPI. MediaMTX serves the stream; the frontend connects via WHEP:

- Stream path: `rover` (see `infra/mediamtx/mediamtx.yml`)
- Frontend: `POST http://{host}:{VITE_WEBRTC_PORT}/rover/whep`
- Backend camera module controls recording via `ROVER_MEDIAMTX_API_URL`

Keep `VITE_WEBRTC_PORT` aligned with MediaMTX `webrtcAddress` (default **8889**).

#### Sync checklist

When you add or change an API field:

- [ ] Pydantic model in `backend/modules/<name>/<name>.schema.py` (or `backend/api/schemas/`)
- [ ] Zod schema in `frontend/src/types/schemas.ts`
- [ ] TypeScript interface in `frontend/src/types/contracts.ts` (if applicable)
- [ ] Backend tests (`pytest`)
- [ ] Manual check: backend running + `npm run dev` or built frontend

### Infra / Docker

```bash
cp .env.example .env
docker compose up --build
```

| Service | Port(s) | Role |
|---------|---------|------|
| `pigpiod` | 8888 (internal) | pigpio daemon — GPIO/PWM for motion motors |
| `backend` | 8000 | FastAPI, hardware modules |
| `frontend` | 3000 | Static SPA (Caddy) |
| `nginx` | 80 | Reverse proxy: `/` → frontend, `/api/` and `/ws` → backend |
| `mediamtx` | 8554, 8889, 8189/udp, 9997 | RTSP, WebRTC, ICE UDP, control API (Arducam/Pivariety libcamera) |

Pi device mounts in [`docker-compose.yml`](docker-compose.yml): `/dev/i2c-1`, `/dev/video0`, `/dev/input` (gamepad), `/sys/bus/w1` (1-Wire), `/dev/gpiochip0` (pigpiod sidecar).

Production UI on port 80: REST → `/api`, WebSocket → `/ws`. WebRTC/WHEP → `http://<pi-ip>:8889/rover/whep`.

Locally, `mediamtx` is built from [`infra/mediamtx/Dockerfile`](infra/mediamtx/Dockerfile); production pulls a pre-built image from GHCR.

### Releasing a new version

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions (`.github/workflows/release.yml`) builds arm64 backend, frontend, and mediamtx images and pushes them to GHCR. Each service is rebuilt **only when its context changed** since the previous `v*` tag. Skipped services keep their previous image tag.

The workflow writes `image-tags.env` with resolved tags per service. Release assets include `image-tags.env`, compose files, `infra/**/*`, OTA/bootstrap scripts, and `.env.example`.

### Boot persistence (optional)

Bootstrap can install the systemd unit with `--enable-systemd`, or manually:

```bash
sudo cp infra/systemd/fpv-rover.service /etc/systemd/system/
sudo systemctl enable --now fpv-rover
```
