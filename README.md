# FPV Rover

Monorepo for an FPV rover (LEGO Audi e-tron) on Raspberry Pi Zero 2 W.

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
| `ROVER_MEDIAMTX_API_URL` | `http://localhost:9997` | backend | MediaMTX control API |
| `VITE_RPI_HOST` | `localhost` | frontend | Host for API / WebRTC in production builds |
| `VITE_API_PORT` | `8000` | frontend | Backend port (dev proxy + production) |
| `VITE_WEBRTC_PORT` | `8889` | frontend | MediaMTX WebRTC (WHEP) port |

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

When deploying on a Pi or via Docker, set `VITE_RPI_HOST` to the hostname or IP the **browser** uses to reach the rover (not the Docker service name).

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
| `mediamtx` | 8554, 8889, 9997 | RTSP, WebRTC, control API |

Both `backend` and `frontend` services mount the root `.env`. Frontend build args (`VITE_*`) are passed from the same file at image build time.

Pi device mounts (`/dev/i2c-1`, `/dev/video0`, 1-Wire) are configured in [`docker-compose.yml`](docker-compose.yml) for the backend service.

For production access through nginx on port 80, set `VITE_RPI_HOST` to the address clients use in the browser. WebRTC (port 8889) is reached directly by the browser, not through nginx.
