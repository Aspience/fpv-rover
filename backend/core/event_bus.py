"""Async in-process pub/sub for module and API communication."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

DEFAULT_QUEUE_SIZE = 32


@dataclass
class EventMessage:
    topic: str
    payload: dict[str, Any]


@dataclass
class _Subscription:
    pattern: str
    queue: asyncio.Queue[EventMessage] = field(
        default_factory=lambda: asyncio.Queue(maxsize=DEFAULT_QUEUE_SIZE)
    )


class EventBus:
    """Fan-out pub/sub backed by bounded asyncio queues."""

    def __init__(self, queue_size: int = DEFAULT_QUEUE_SIZE) -> None:
        self._queue_size = queue_size
        self._subscriptions: list[_Subscription] = []
        self._closed = False

    @staticmethod
    def _matches(pattern: str, topic: str) -> bool:
        if pattern.endswith("*"):
            return topic.startswith(pattern[:-1])
        return pattern == topic

    def subscribe(self, topic_pattern: str) -> AsyncIterator[dict[str, Any]]:
        subscription = _Subscription(
            pattern=topic_pattern,
            queue=asyncio.Queue(maxsize=self._queue_size),
        )
        self._subscriptions.append(subscription)

        async def _iter() -> AsyncIterator[dict[str, Any]]:
            try:
                while not self._closed:
                    message = await subscription.queue.get()
                    yield message.payload
            finally:
                if subscription in self._subscriptions:
                    self._subscriptions.remove(subscription)

        return _iter()

    async def publish(self, topic: str, payload: dict[str, Any]) -> None:
        if self._closed:
            return

        message = EventMessage(topic=topic, payload=payload)
        for subscription in list(self._subscriptions):
            if not self._matches(subscription.pattern, topic):
                continue
            queue = subscription.queue
            if queue.full():
                with suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
            with suppress(asyncio.QueueFull):
                queue.put_nowait(message)

    async def close(self) -> None:
        self._closed = True
        self._subscriptions.clear()


def subscription_count(bus: EventBus) -> int:
    return len(bus._subscriptions)
