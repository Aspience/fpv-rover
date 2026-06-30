"""Bluetooth module telemetry and REST contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BluetoothData(BaseModel):
    """Telemetry payload describing the currently connected device (if any)."""

    connected: bool = Field(description="Whether a device is currently connected")
    name: str | None = Field(default=None, description="Connected device name")
    mac: str | None = Field(default=None, description="Connected device MAC address")


class BluetoothDevice(BaseModel):
    """A paired or discovered Bluetooth device."""

    mac: str = Field(description="Device MAC address")
    name: str = Field(description="Device display name")
    connected: bool = Field(default=False, description="Connection state")


class PairRequest(BaseModel):
    mac: str = Field(description="MAC address of the device to pair and connect")


class BluetoothActionResponse(BaseModel):
    status: str = Field(description="Result of the bluetooth action")
