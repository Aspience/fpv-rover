import pytest

from core.config import ENV_EXAMPLE, Settings, get_settings


def test_default_feature_flags_are_disabled() -> None:
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    assert settings.enabled_modules() == {
        "power": False,
        "motion": False,
        "thermal": False,
        "imu": False,
        "light": False,
        "camera": False,
        "bluetooth": False,
        "gamepad": False,
    }


def test_feature_flags_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROVER_MODULES_POWER_ENABLED", "true")
    monkeypatch.setenv("ROVER_MODULES_IMU_ENABLED", "1")
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    enabled = settings.enabled_modules()
    assert enabled["power"] is True
    assert enabled["imu"] is True
    assert enabled["motion"] is False


def test_get_settings_singleton(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROVER_LOG_LEVEL", "DEBUG")
    from core.config import clear_settings_cache

    clear_settings_cache()
    first = get_settings()
    second = get_settings()
    assert first is second
    assert first.log_level == "DEBUG"


def test_hardware_values_from_env_example() -> None:
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    assert settings.host == "0.0.0.0"
    assert settings.port == 8000
    assert settings.ws_telemetry_hz == 20
    assert settings.heartbeat_timeout_sec == 1.0
    assert settings.io_retry_delay_sec == 2.0
    assert settings.i2c_bus == 1
    assert settings.w1_gpio == 4
    assert settings.mediamtx_api_url == "http://localhost:9997"
    assert settings.mediamtx_record_start_path == "/v3/recordings/start/{stream_path}"
    assert settings.mediamtx_record_stop_path == "/v3/recordings/stop/{stream_path}"
    assert settings.mediamtx_stream_config_path == "/v3/config/paths/patch/{stream_path}"
    assert (
        settings.mediamtx_stream_config_get_path == "/v3/config/paths/get/{stream_path}"
    )
    assert settings.power_i2c_address == 0x40
    assert settings.imu_i2c_address == 0x68
    assert settings.light_i2c_address == 0x23
    assert settings.w1_base_path == "/sys/bus/w1/devices"
    assert settings.thermal_w1_slave_file == "w1_slave"
    assert settings.camera_v4l2_device == "/dev/video0"
    assert settings.camera_v4l2_ctl_bin == "v4l2-ctl"
    assert settings.camera_stream_path == "rover"
    assert len(settings.thermal_sensor_ids) == 6
    assert settings.app_version == "0.1.0"
    assert settings.github_owner == "aspience"
    assert settings.github_repo == "fpv-rover"
    assert settings.github_token == ""
    assert settings.ota_enabled is False
    assert settings.ota_install_dir == "/opt/fpv-rover"
    assert settings.ota_script == "/opt/fpv-rover/scripts/ota_update.sh"
    assert settings.motion_front_pwma_gpio == 18
    assert settings.pigpio_host == "pigpiod"
    assert settings.pigpio_port == 8888
    assert settings.motion_steer_max_deg == 45.0


def test_i2c_address_accepts_hex_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROVER_POWER_I2C_ADDRESS", "0x48")
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    assert settings.power_i2c_address == 0x48
