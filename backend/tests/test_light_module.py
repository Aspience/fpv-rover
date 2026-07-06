"""Light module and telemetry integration tests."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from api.websocket import TelemetryHub
from core.config import ENV_EXAMPLE, Settings, Topics
from core.event_bus import EventBus
from modules.light.module import LightModule
from modules.light.utils import read_lux


def test_read_lux_converts_i2c_bytes() -> None:
    mock_bus = MagicMock()
    mock_bus.__enter__ = MagicMock(return_value=mock_bus)
    mock_bus.__exit__ = MagicMock(return_value=False)
    mock_bus.read_i2c_block_data.return_value = [0x03, 0xE8]  # 1000 raw

    with patch("smbus2.SMBus", return_value=mock_bus):
        lux = read_lux(1, 0x23)

    mock_bus.write_byte.assert_called_once_with(0x23, 0x10)
    mock_bus.read_i2c_block_data.assert_called_once_with(0x23, 0x00, 2)
    assert lux == pytest.approx(1000 / 1.2)


@pytest.mark.asyncio
async def test_light_module_publishes_telemetry(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("modules.light.module.config.POLL_INTERVAL_SEC", 0.0)

    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(f"{Topics.TELEMETRY_PREFIX}light")

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    module = LightModule(bus, settings)

    with patch("modules.light.module.read_lux", return_value=42.5):
        await module.setup()
        await module.loop()
        await module.cleanup()

    collector.cancel()
    with pytest.raises(asyncio.CancelledError):
        await collector

    payload = received.get_nowait()
    assert payload == {"module": "light", "data": {"lux": 42.5}}


@pytest.mark.asyncio
async def test_light_module_night_mode_when_auto_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("modules.light.module.config.POLL_INTERVAL_SEC", 0.0)

    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.CAMERA_NIGHT_MODE)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    module = LightModule(bus, settings)

    await module.setup()
    await bus.publish(
        Topics.COMMAND_LIGHT_AUTO_NIGHT,
        {"enabled": True, "threshold_lux": 10.0},
    )
    await asyncio.sleep(0)

    with patch("modules.light.module.read_lux", return_value=5.0):
        await module.loop()

    low = received.get_nowait()
    assert low == {"enabled": True, "lux": 5.0}

    with patch("modules.light.module.read_lux", return_value=100.0):
        await module.loop()
        await module.cleanup()

    high = received.get_nowait()
    assert high == {"enabled": False, "lux": 100.0}

    collector.cancel()
    with pytest.raises(asyncio.CancelledError):
        await collector


@pytest.mark.asyncio
async def test_light_module_skips_duplicate_night_mode_events(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("modules.light.module.config.POLL_INTERVAL_SEC", 0.0)

    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.CAMERA_NIGHT_MODE)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    module = LightModule(bus, settings)

    await module.setup()
    await bus.publish(
        Topics.COMMAND_LIGHT_AUTO_NIGHT,
        {"enabled": True, "threshold_lux": 10.0},
    )
    await asyncio.sleep(0)

    with patch("modules.light.module.read_lux", return_value=100.0):
        await module.loop()
        await module.loop()
        await module.loop()
        await module.cleanup()

    assert received.qsize() == 1
    assert received.get_nowait() == {"enabled": False, "lux": 100.0}

    collector.cancel()
    with pytest.raises(asyncio.CancelledError):
        await collector


@pytest.mark.asyncio
async def test_light_module_skips_night_mode_when_auto_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("modules.light.module.config.POLL_INTERVAL_SEC", 0.0)

    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.CAMERA_NIGHT_MODE)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    settings = Settings(_env_file=str(ENV_EXAMPLE))
    module = LightModule(bus, settings)

    with patch("modules.light.module.read_lux", return_value=5.0):
        await module.setup()
        await module.loop()
        await module.cleanup()

    collector.cancel()
    with pytest.raises(asyncio.CancelledError):
        await collector

    assert received.empty()


@pytest.mark.asyncio
async def test_set_auto_night_mode_command_publishes_event() -> None:
    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.COMMAND_LIGHT_AUTO_NIGHT)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    hub = TelemetryHub(bus)

    await hub.handle_command(
        {"cmd": "set_auto_night_mode", "enabled": True, "threshold_lux": 15.0}
    )

    payload = await asyncio.wait_for(received.get(), timeout=1.0)
    collector.cancel()
    assert payload == {"enabled": True, "threshold_lux": 15.0}


@pytest.mark.asyncio
async def test_set_brightness_command_publishes_event() -> None:
    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.COMMAND_LIGHT)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    hub = TelemetryHub(bus)

    await hub.handle_command({"cmd": "set_brightness", "level": 50})

    payload = await asyncio.wait_for(received.get(), timeout=1.0)
    collector.cancel()
    assert payload == {"level": 50}


@pytest.mark.asyncio
async def test_light_telemetry_in_hub_broadcast(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bus = EventBus()
    hub = TelemetryHub(bus)
    await hub.start()

    await bus.publish(
        f"{Topics.TELEMETRY_PREFIX}light",
        {"module": "light", "data": {"lux": 123.0}},
    )
    await asyncio.sleep(0.05)

    assert hub._telemetry.get("light") == {"lux": 123.0}

    await hub.stop()
