import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from fastapi import WebSocket


@dataclass
class SessionBuffer:
    user_id: str
    baseline_rmssd: float
    session_id: Optional[uuid.UUID] = None
    rr_values: List[float] = field(default_factory=list)
    rr_timestamps: List[int] = field(default_factory=list)
    gps_history: List[dict] = field(default_factory=list)  # {speed, lat, lng, timestamp}
    driving_confirmed: bool = False
    driving_dismissed_until: int = 0  # ms timestamp; suppress driving_detected until this time
    sensor_connected: bool = False  # True after first RR packet received
    last_rmssd: float = 0.0
    last_fatigue: int = 0
    max_fatigue: int = 0
    alert_count: int = 0


class ConnectionManager:
    def __init__(self) -> None:
        # ESP32 hardware connections: user_id → WebSocket
        self._hardware: Dict[str, WebSocket] = {}
        # Browser client connections: user_id → WebSocket
        self._browser: Dict[str, WebSocket] = {}
        self._buffers: Dict[str, SessionBuffer] = {}
        # Test modal connections: user_id → WebSocket
        self._test_connections: Dict[str, WebSocket] = {}

    # ── Hardware (ESP32) ──────────────────────────────────────────────────────

    async def connect_hardware(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._hardware[user_id] = ws

    def disconnect_hardware(self, user_id: str) -> None:
        self._hardware.pop(user_id, None)
        self._buffers.pop(user_id, None)

    # ── Browser client ────────────────────────────────────────────────────────

    async def connect_browser(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._browser[user_id] = ws

    def disconnect_browser(self, user_id: str) -> None:
        self._browser.pop(user_id, None)

    async def send_to_browser(self, user_id: str, data: dict) -> None:
        ws = self._browser.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self._browser.pop(user_id, None)

    # ── Legacy single-connection API (used by demo endpoint) ─────────────────

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._hardware[user_id] = ws

    def disconnect(self, user_id: str) -> None:
        self._hardware.pop(user_id, None)
        self._buffers.pop(user_id, None)

    async def send(self, user_id: str, data: dict) -> None:
        ws = self._hardware.get(user_id)
        if ws:
            await ws.send_json(data)

    # ── Buffer ────────────────────────────────────────────────────────────────

    def set_buffer(self, user_id: str, buffer: SessionBuffer) -> None:
        self._buffers[user_id] = buffer

    def get_buffer(self, user_id: str) -> Optional[SessionBuffer]:
        return self._buffers.get(user_id)

    # ── Test modal ────────────────────────────────────────────────────────────

    def connect_test(self, user_id: str, ws: WebSocket) -> None:
        self._test_connections[user_id] = ws

    def disconnect_test(self, user_id: str) -> None:
        self._test_connections.pop(user_id, None)

    async def forward_to_test(self, user_id: str, data: dict) -> None:
        ws = self._test_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self._test_connections.pop(user_id, None)


manager = ConnectionManager()
