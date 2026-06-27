from __future__ import annotations

import asyncio
import logging
import subprocess

import aiohttp

logger = logging.getLogger(__name__)


def _record_url(api_url: str, path_template: str, stream_path: str) -> str:
    path = path_template.format(stream_path=stream_path)
    return f"{api_url.rstrip('/')}{path}"


async def mediamtx_start_record(
    api_url: str,
    start_path: str,
    stream_path: str,
) -> None:
    url = _record_url(api_url, start_path, stream_path)
    async with aiohttp.ClientSession() as session, session.post(url) as resp:
        if resp.status >= 400:
            text = await resp.text()
            raise OSError(f"MediaMTX record start failed: {resp.status} {text}")


async def mediamtx_stop_record(
    api_url: str,
    stop_path: str,
    stream_path: str,
) -> None:
    url = _record_url(api_url, stop_path, stream_path)
    async with aiohttp.ClientSession() as session, session.post(url) as resp:
        if resp.status >= 400:
            text = await resp.text()
            raise OSError(f"MediaMTX record stop failed: {resp.status} {text}")


async def mediamtx_set_stream_config(
    api_url: str,
    patch_path: str,
    stream_path: str,
    width: int,
    height: int,
    bitrate: int,
) -> None:
    path = patch_path.format(stream_path=stream_path)
    url = f"{api_url.rstrip('/')}{path}"
    payload = {
        "rpiCameraWidth": width,
        "rpiCameraHeight": height,
        "rpiCameraBitrate": bitrate,
    }
    async with (
        aiohttp.ClientSession() as session,
        session.patch(url, json=payload) as resp,
    ):
        if resp.status >= 400:
            text = await resp.text()
            raise OSError(f"MediaMTX stream config failed: {resp.status} {text}")


async def mediamtx_get_stream_config(
    api_url: str,
    get_path: str,
    stream_path: str,
) -> dict[str, int]:
    path = get_path.format(stream_path=stream_path)
    url = f"{api_url.rstrip('/')}{path}"
    async with (
        aiohttp.ClientSession() as session,
        session.get(url) as resp,
    ):
        if resp.status >= 400:
            text = await resp.text()
            raise OSError(f"MediaMTX stream config read failed: {resp.status} {text}")
        data = await resp.json()
    return {
        "width": int(data["rpiCameraWidth"]),
        "height": int(data["rpiCameraHeight"]),
        "bitrate": int(data["rpiCameraBitrate"]),
    }


async def set_night_mode(
    enabled: bool,
    v4l2_device: str,
    v4l2_ctl_bin: str,
) -> None:
    exposure = "night" if enabled else "auto"
    cmd = [
        v4l2_ctl_bin,
        "-d",
        v4l2_device,
        f"--set-ctrl=exposure_auto=auto,exposure_absolute={exposure}",
    ]
    await asyncio.to_thread(subprocess.run, cmd, check=True)
