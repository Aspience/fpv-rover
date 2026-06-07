"""Domain exceptions for the rover backend."""

from __future__ import annotations


class RoverError(Exception):
    """Base exception for rover backend errors."""


class ModuleSetupError(RoverError):
    def __init__(self, module_name: str, message: str) -> None:
        self.module_name = module_name
        super().__init__(f"[{module_name}] setup failed: {message}")


class ModuleLoopError(RoverError):
    def __init__(self, module_name: str, message: str) -> None:
        self.module_name = module_name
        super().__init__(f"[{module_name}] loop error: {message}")


class HardwareIOError(RoverError, OSError):
    """I2C / 1-Wire / GPIO failure; handled inside module workers."""

    def __init__(
        self,
        module_name: str,
        message: str,
        *,
        errno: int | None = None,
    ) -> None:
        self.module_name = module_name
        super().__init__(errno or 0, f"[{module_name}] {message}")
