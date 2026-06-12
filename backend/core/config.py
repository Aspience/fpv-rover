"""Application configuration loaded from root `.env`."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import BeforeValidator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / ".env"
ENV_EXAMPLE = REPO_ROOT / ".env.example"


def _settings_env_files() -> tuple[str, ...]:
    """Example file holds defaults; `.env` and optional `.env.local` override when present."""
    files = [str(ENV_EXAMPLE)]
    if ENV_FILE.is_file():
        files.append(str(ENV_FILE))
    env_local = REPO_ROOT / ".env.local"
    if env_local.is_file():
        files.append(str(env_local))
    return tuple(files)


def _parse_int_maybe_hex(value: Any) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        return int(stripped, 16) if stripped.lower().startswith("0x") else int(stripped)
    raise TypeError(f"Expected int or hex string, got {type(value).__name__}")


HexInt = Annotated[int, BeforeValidator(_parse_int_maybe_hex)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ROVER_",
        env_file=_settings_env_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    modules_power_enabled: bool
    modules_motion_enabled: bool
    modules_thermal_enabled: bool
    modules_imu_enabled: bool
    modules_light_enabled: bool
    modules_camera_enabled: bool

    log_level: str
    host: str
    port: int = Field(gt=0, le=65535)
    ws_telemetry_hz: int
    heartbeat_timeout_sec: float
    io_retry_delay_sec: float

    i2c_bus: int
    w1_gpio: int

    mediamtx_api_url: str
    mediamtx_record_start_path: str
    mediamtx_record_stop_path: str

    power_i2c_address: HexInt
    imu_i2c_address: HexInt
    light_i2c_address: HexInt

    w1_base_path: str
    thermal_w1_slave_file: str
    thermal_sensor_ids: dict[str, str]

    camera_v4l2_device: str
    camera_v4l2_ctl_bin: str
    camera_stream_path: str

    app_version: str
    github_owner: str
    github_repo: str
    github_token: str
    ota_enabled: bool
    ota_install_dir: str
    ota_script: str
    ota_ssh_key_path: str

    def enabled_modules(self) -> dict[str, bool]:
        return {
            "power": self.modules_power_enabled,
            "motion": self.modules_motion_enabled,
            "thermal": self.modules_thermal_enabled,
            "imu": self.modules_imu_enabled,
            "light": self.modules_light_enabled,
            "camera": self.modules_camera_enabled,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()


class Topics:
    TELEMETRY_PREFIX = "telemetry."
    COMMAND_PREFIX = "command."
    COMMAND_CONTROL = "command.control"
    COMMAND_LIGHT = "command.light"
    SYSTEM_EMERGENCY_STOP = "system.emergency_stop"
    CAMERA_RECORD_START = "camera.record_start"
    CAMERA_NIGHT_MODE = "camera.night_mode"
