import asyncio

import pytest

from core.event_bus import DEFAULT_QUEUE_SIZE, EventBus


@pytest.mark.asyncio
async def test_publish_subscribe_exact_topic() -> None:
    bus = EventBus()
    stream = bus.subscribe("telemetry.power")

    await bus.publish("telemetry.power", {"voltage": 7.4})
    payload = await asyncio.wait_for(anext(stream), timeout=1.0)

    assert payload == {"voltage": 7.4}


@pytest.mark.asyncio
async def test_wildcard_subscription() -> None:
    bus = EventBus()
    stream = bus.subscribe("telemetry.*")

    await bus.publish("telemetry.imu", {"pitch": 1.2})
    payload = await asyncio.wait_for(anext(stream), timeout=1.0)

    assert payload == {"pitch": 1.2}


@pytest.mark.asyncio
async def test_bounded_queue_drops_oldest() -> None:
    bus = EventBus(queue_size=2)
    stream = bus.subscribe("telemetry.test")

    await bus.publish("telemetry.test", {"seq": 1})
    await bus.publish("telemetry.test", {"seq": 2})
    await bus.publish("telemetry.test", {"seq": 3})

    first = await asyncio.wait_for(anext(stream), timeout=1.0)
    second = await asyncio.wait_for(anext(stream), timeout=1.0)

    assert first == {"seq": 2}
    assert second == {"seq": 3}


@pytest.mark.asyncio
async def test_close_stops_delivery() -> None:
    bus = EventBus()
    stream = bus.subscribe("command.*")
    await bus.close()
    await bus.publish("command.stop", {"reason": "test"})

    with pytest.raises(StopAsyncIteration):
        await anext(stream)


def test_default_queue_size() -> None:
    assert DEFAULT_QUEUE_SIZE == 32
