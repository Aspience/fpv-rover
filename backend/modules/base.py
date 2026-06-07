"""Hardware module lifecycle contract."""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.config import Settings
    from core.event_bus import EventBus

logger = logging.getLogger(__name__)


class BaseHardwareModule(ABC):
    name: str

    def __init__(self, event_bus: EventBus, settings: Settings) -> None:
        self.event_bus = event_bus
        self.settings = settings
        self._task: asyncio.Task[None] | None = None

    @abstractmethod
    async def setup(self) -> None:
        """Prepare hardware or subscribe to EventBus topics."""

    @abstractmethod
    async def loop(self) -> None:
        """Single iteration of I/O work; use await asyncio.sleep() for pacing."""

    @abstractmethod
    async def cleanup(self) -> None:
        """Safe shutdown: reset PWM, close buses, unsubscribe."""

    async def start(self) -> None:
        await self.setup()
        self._task = asyncio.create_task(self._run_loop(), name=f"module-{self.name}")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            finally:
                self._task = None

        try:
            await self.cleanup()
        except Exception:
            logger.exception("Cleanup failed for module %s", self.name)

    async def _run_loop(self) -> None:
        while True:
            try:
                await self.loop()
            except OSError as exc:
                logger.warning(
                    "I/O error in module %s: %s; retry in %.1fs",
                    self.name,
                    exc,
                    self.settings.io_retry_delay_sec,
                )
                await asyncio.sleep(self.settings.io_retry_delay_sec)
            except asyncio.CancelledError:
                break
