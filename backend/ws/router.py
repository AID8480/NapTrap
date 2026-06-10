import asyncio
import json
import time
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.service import decode_token
from backend.database import AsyncSessionLocal
from backend.models import GPSData, RRData
from backend.session import service as session_service
from backend.user import service as user_service
from backend.ws import pipeline_runner
from backend.ws.demo_simulator import DemoSimulator
from backend.ws.manager import SessionBuffer, manager

router = APIRouter(tags=["websocket"])


async def _init_buffer(user_id: str) -> SessionBuffer:
    async with AsyncSessionLocal() as db:
        baseline = await user_service.get_active_baseline(uuid.UUID(user_id), db)
        baseline_rmssd = baseline.rmssd_value if baseline else 50.0  # fallback default
        session = await session_service.create_session(uuid.UUID(user_id), db)
    return SessionBuffer(
        user_id=user_id,
        baseline_rmssd=baseline_rmssd,
        session_id=session.id,
    )


async def _persist_rr(session_id: uuid.UUID, value: float, timestamp: int) -> None:
    async with AsyncSessionLocal() as db:
        db.add(RRData(session_id=session_id, rr_value=value, timestamp=timestamp))
        await db.commit()


async def _persist_gps(session_id: uuid.UUID, data: dict) -> None:
    async with AsyncSessionLocal() as db:
        db.add(GPSData(
            session_id=session_id,
            speed=data["speed"],
            lat=data["lat"],
            lng=data["lng"],
            timestamp=data["timestamp"],
        ))
        await db.commit()


async def _finalize(buffer: SessionBuffer) -> None:
    async with AsyncSessionLocal() as db:
        await session_service.close_session(buffer.session_id, db)
        await session_service.update_session_stats(
            buffer.session_id, buffer.max_fatigue, buffer.alert_count, db
        )


async def _process_message(raw: dict, buffer: SessionBuffer) -> None:
    """Handle a message from the ESP32; responses go to the browser connection."""
    msg_type = raw.get("type")

    if msg_type == "rr":
        value = float(raw.get("value", 0))
        timestamp = int(raw.get("timestamp", 0))

        hrv_update = pipeline_runner.handle_rr(buffer, value, timestamp)

        # Forward raw RR + HRV update to test modal if open
        asyncio.create_task(manager.forward_to_test(buffer.user_id, {
            "type": "rr_ack", "value": value, "timestamp": timestamp,
        }))
        if hrv_update:
            asyncio.create_task(manager.forward_to_test(buffer.user_id, hrv_update))

        if buffer.driving_confirmed and buffer.session_id:
            asyncio.create_task(_persist_rr(buffer.session_id, value, timestamp))

        if hrv_update:
            await manager.send_to_browser(buffer.user_id, hrv_update)

            # Fire alert if fatigue >= 2 and driving confirmed
            if hrv_update["fatigue"] >= 2 and buffer.driving_confirmed:
                buffer.alert_count += 1
                await manager.send_to_browser(buffer.user_id, {
                    "type": "alert",
                    "fatigue_level": hrv_update["fatigue"],
                    "timestamp": timestamp,
                })
                if buffer.session_id:
                    async with AsyncSessionLocal() as db:
                        await session_service.log_alert(
                            buffer.session_id, hrv_update["fatigue"], True, db
                        )

    elif msg_type == "gps":
        gps_update = pipeline_runner.handle_gps(buffer, raw)
        await manager.send_to_browser(buffer.user_id, gps_update)

        if buffer.driving_confirmed and buffer.session_id:
            asyncio.create_task(_persist_gps(buffer.session_id, raw))

        # Notify browser to show driving detection popup
        if gps_update["driving_detected"] and not buffer.driving_confirmed:
            await manager.send_to_browser(buffer.user_id, {"type": "driving_detected"})


@router.websocket("/ws/sensor/{user_id}")
async def sensor_endpoint(user_id: str, ws: WebSocket):
    await manager.connect_hardware(user_id, ws)
    try:
        buffer = await _init_buffer(user_id)
    except Exception as e:
        print(f"[WS] _init_buffer failed: {type(e).__name__}: {e}")
        await ws.close()
        return
    manager.set_buffer(user_id, buffer)

    # Notify browser immediately when ESP32 hardware connects
    await manager.send_to_browser(user_id, {"type": "sensor_connected", "sensor_model": None})

    try:
        while True:
            raw = await ws.receive_json()
            await _process_message(raw, buffer)
    except WebSocketDisconnect:
        pass
    finally:
        await _finalize(buffer)
        manager.disconnect_hardware(user_id)
        # Grace period: if ESP32 reconnects within 3s, suppress sensor_disconnected flicker
        await asyncio.sleep(3)
        if not manager.get_buffer(user_id):
            await manager.send_to_browser(user_id, {"type": "sensor_disconnected"})


@router.websocket("/ws/browser/{user_id}")
async def browser_endpoint(user_id: str, ws: WebSocket, token: str = Query(...)):
    """Browser dashboard connection — receives HRV/GPS/alert updates, sends driving_ack/dismiss."""
    payload = decode_token(token)
    token_user_id = payload.get("sub")
    print(f"[WS/browser] token={token[:20]}... decoded_sub={token_user_id!r} user_id={user_id!r} match={token_user_id == user_id}")
    if not token_user_id or token_user_id != user_id:
        await ws.accept()
        await ws.close(code=4001)
        return
    await manager.connect_browser(user_id, ws)
    print(f"[WS/browser] {user_id} connected, entering loop")

    # If ESP32 already connected, catch browser up immediately
    buffer = manager.get_buffer(user_id)
    if buffer:
        await ws.send_json({"type": "sensor_connected", "sensor_model": None})
        print(f"[WS/browser] {user_id} replayed sensor_connected (already active)")

    try:
        while True:
            try:
                raw_text = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                try:
                    raw = json.loads(raw_text)
                except Exception:
                    continue
                msg_type = raw.get("type")
                buf = manager.get_buffer(user_id)
                if msg_type == "driving_ack" and buf:
                    buf.driving_confirmed = True
                    await ws.send_json({"type": "monitoring_started"})
                elif msg_type == "driving_dismiss" and buf:
                    buf.driving_dismissed_until = int(time.time() * 1000) + 5 * 60 * 1000
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect as e:
        print(f"[WS/browser] {user_id} disconnected: code={e.code}")
    except Exception as e:
        print(f"[WS/browser] {user_id} error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print(f"[WS/browser] {user_id} cleanup")
        manager.disconnect_browser(user_id)


@router.websocket("/ws/test/{user_id}")
async def test_sensor_endpoint(user_id: str, ws: WebSocket):
    """Receives data forwarded from /ws/sensor/ — no session created, no data persisted."""
    await ws.accept()
    manager.connect_test(user_id, ws)
    try:
        while True:
            # Keep connection alive; client sends nothing meaningful here
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect_test(user_id)


@router.websocket("/ws/demo/{user_id}")
async def demo_endpoint(user_id: str, ws: WebSocket):
    await manager.connect(user_id, ws)
    buffer = await _init_buffer(user_id)
    manager.set_buffer(user_id, buffer)

    simulator = DemoSimulator(baseline_rmssd=buffer.baseline_rmssd)

    try:
        # Simulator sends packets directly to the client and mutates buffer for stats.
        # Also keep a listener so the client can dismiss alerts mid-demo.
        sim_task = asyncio.create_task(simulator.stream(ws.send_json, buffer))

        async def listen_client():
            while True:
                raw = await ws.receive_json()
                # Only handle alert-dismiss in demo; everything else is driven by simulator
                if raw.get("type") == "driving_dismiss":
                    buffer.driving_dismissed_until = int(time.time() * 1000) + 5 * 60 * 1000

        client_task = asyncio.create_task(listen_client())
        done, pending = await asyncio.wait(
            [sim_task, client_task], return_when=asyncio.FIRST_EXCEPTION
        )
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        pass
    finally:
        await _finalize(buffer)
        manager.disconnect(user_id)
