"""Application entry point and lifespan orchestration."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import uvicorn
from fastapi import FastAPI

from api.router import create_app
from api.websocket import get_hub, reset_hub
from core.config import get_settings
from core.event_bus import EventBus
from core.ota_state import complete_update_on_startup
from core.registry import ModuleRegistry
from core.startup import run_post_init

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    event_bus = EventBus()
    app.state.event_bus = event_bus
    registry = ModuleRegistry(event_bus, settings)
    hub = get_hub(event_bus)

    logger.info("Starting FPV Rover backend")
    complete_update_on_startup(settings.ota_install_dir)
    await hub.start()
    await registry.start_enabled()
    await run_post_init(event_bus, settings)

    yield

    logger.info("Shutting down FPV Rover backend")
    await registry.stop_all()
    await hub.stop()
    await event_bus.close()
    reset_hub()


def build_app() -> FastAPI:
    app = create_app(lifespan=lifespan)
    return app


def main() -> None:
    settings = get_settings()
    logging.getLogger().setLevel(settings.log_level)
    uvicorn.run(
        "main:build_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
