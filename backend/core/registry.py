"""Hardware module registry and lifecycle orchestration."""

from __future__ import annotations

import logging

from core.config import Settings
from core.event_bus import EventBus
from modules.base import BaseHardwareModule

logger = logging.getLogger(__name__)


class ModuleRegistry:
    def __init__(self, event_bus: EventBus, settings: Settings) -> None:
        self.event_bus = event_bus
        self.settings = settings
        self._modules: dict[str, BaseHardwareModule] = {}

    def _build_module(self, name: str) -> BaseHardwareModule:
        if name == "power":
            from modules.power.module import PowerModule

            return PowerModule(self.event_bus, self.settings)
        if name == "motion":
            from modules.motion.module import MotionModule

            return MotionModule(self.event_bus, self.settings)
        if name == "thermal":
            from modules.thermal.module import ThermalModule

            return ThermalModule(self.event_bus, self.settings)
        if name == "imu":
            from modules.imu.module import ImuModule

            return ImuModule(self.event_bus, self.settings)
        if name == "light":
            from modules.light.module import LightModule

            return LightModule(self.event_bus, self.settings)
        if name == "camera":
            from modules.camera.module import CameraModule

            return CameraModule(self.event_bus, self.settings)
        if name == "bluetooth":
            from modules.bluetooth.module import BluetoothModule

            return BluetoothModule(self.event_bus, self.settings)
        if name == "gamepad":
            from modules.gamepad.module import GamepadModule

            return GamepadModule(self.event_bus, self.settings)
        raise KeyError(f"Unknown module: {name}")

    async def start_enabled(self) -> None:
        for name, enabled in self.settings.enabled_modules().items():
            if not enabled:
                logger.info("Module %s disabled by config", name)
                continue
            module = self._build_module(name)
            self._modules[name] = module
            logger.info("Starting module %s", name)
            await module.start()

    async def stop_all(self) -> None:
        for name, module in list(self._modules.items()):
            logger.info("Stopping module %s", name)
            await module.stop()
        self._modules.clear()

    def get(self, name: str) -> BaseHardwareModule | None:
        return self._modules.get(name)
