import asyncio

import pytest

from core.config import ENV_EXAMPLE, Settings
from core.event_bus import EventBus
from modules.base import BaseHardwareModule


class _MockModule(BaseHardwareModule):
    name = "mock"

    def __init__(self, event_bus: EventBus, settings: Settings) -> None:
        super().__init__(event_bus, settings)
        self.setup_called = False
        self.loop_count = 0
        self.cleanup_called = False
        self._stop_after = 3

    async def setup(self) -> None:
        self.setup_called = True

    async def loop(self) -> None:
        self.loop_count += 1
        if self.loop_count >= self._stop_after:
            raise asyncio.CancelledError
        await asyncio.sleep(0)

    async def cleanup(self) -> None:
        self.cleanup_called = True


class _OSErrorModule(BaseHardwareModule):
    name = "io_fail"

    def __init__(self, event_bus: EventBus, settings: Settings) -> None:
        super().__init__(event_bus, settings)
        self.attempts = 0
        self.cleanup_called = False

    async def setup(self) -> None:
        return None

    async def loop(self) -> None:
        self.attempts += 1
        if self.attempts == 1:
            raise OSError("I2C NACK")
        raise asyncio.CancelledError

    async def cleanup(self) -> None:
        self.cleanup_called = True


@pytest.mark.asyncio
async def test_module_lifecycle() -> None:
    bus = EventBus()
    settings = Settings(_env_file=str(ENV_EXAMPLE), io_retry_delay_sec=0.01)
    module = _MockModule(bus, settings)

    await module.start()
    await asyncio.sleep(0.05)
    await module.stop()

    assert module.setup_called is True
    assert module.loop_count >= 1
    assert module.cleanup_called is True
    assert module._task is None


@pytest.mark.asyncio
async def test_oserror_retry_without_crash(monkeypatch: pytest.MonkeyPatch) -> None:
    bus = EventBus()
    settings = Settings(_env_file=str(ENV_EXAMPLE), io_retry_delay_sec=0.01)
    module = _OSErrorModule(bus, settings)

    await module.start()
    await asyncio.sleep(0.05)
    await module.stop()

    assert module.attempts >= 2
    assert module.cleanup_called is True


@pytest.mark.asyncio
async def test_stop_calls_cleanup_even_on_failure() -> None:
    bus = EventBus()
    settings = Settings(_env_file=str(ENV_EXAMPLE))

    class _FailingCleanup(BaseHardwareModule):
        name = "fail_cleanup"

        async def setup(self) -> None:
            return None

        async def loop(self) -> None:
            await asyncio.sleep(10)

        async def cleanup(self) -> None:
            raise RuntimeError("cleanup boom")

    module = _FailingCleanup(bus, settings)
    await module.start()
    await module.stop()

    assert module._task is None
