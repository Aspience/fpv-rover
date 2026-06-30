"""REST + WebSocket Bluetooth device management endpoints."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from core.config import get_settings
from modules.bluetooth.schema import (
    BluetoothActionResponse,
    BluetoothDevice,
    PairRequest,
)
from modules.bluetooth.service import get_bluetooth_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _ensure_enabled() -> None:
    if not get_settings().modules_bluetooth_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bluetooth module is disabled",
        )


@router.get("/bluetooth/devices", response_model=list[BluetoothDevice], tags=["bluetooth"])
async def list_devices() -> list[BluetoothDevice]:
    _ensure_enabled()
    service = get_bluetooth_service()
    try:
        return await asyncio.to_thread(service.get_paired_devices)
    except (OSError, RuntimeError) as exc:
        logger.exception("Failed to list paired Bluetooth devices")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list devices: {exc}",
        ) from exc


@router.post(
    "/bluetooth/pair",
    response_model=BluetoothActionResponse,
    tags=["bluetooth"],
)
async def pair_device(payload: PairRequest) -> BluetoothActionResponse:
    _ensure_enabled()
    service = get_bluetooth_service()
    try:
        await asyncio.to_thread(service.pair_and_connect, payload.mac)
    except (OSError, RuntimeError) as exc:
        logger.exception("Failed to pair Bluetooth device %s", payload.mac)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to pair device: {exc}",
        ) from exc
    return BluetoothActionResponse(status="ok")


@router.delete(
    "/bluetooth/devices/{mac}",
    response_model=BluetoothActionResponse,
    tags=["bluetooth"],
)
async def remove_device(mac: str) -> BluetoothActionResponse:
    _ensure_enabled()
    service = get_bluetooth_service()
    try:
        await asyncio.to_thread(service.remove_device, mac)
    except (OSError, RuntimeError) as exc:
        logger.exception("Failed to remove Bluetooth device %s", mac)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to remove device: {exc}",
        ) from exc
    return BluetoothActionResponse(status="ok")


@router.websocket("/bluetooth/scan-ws")
async def scan_ws(websocket: WebSocket) -> None:
    if not get_settings().modules_bluetooth_enabled:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    bluetooth_service = get_bluetooth_service()
    try:
        await websocket.accept()
        async for device in bluetooth_service.start_scan():
            await websocket.send_json(device)
    except WebSocketDisconnect:
        pass
    finally:
        # Guaranteed teardown when the browser/modal closes the socket.
        bluetooth_service.stop_scan()
