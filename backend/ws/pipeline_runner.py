"""
Real-time HRV pipeline runner.

Maintains a rolling buffer of RR values per user and computes RMSSD
incrementally using the existing hrv_pipeline functions.
"""
import sys
import os
import time
from typing import Dict, List, Optional

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from hrv_pipeline import filter_rr, build_windows, batch_java_rmssd, classify_fatigue  # noqa: E402

from backend.ws.manager import SessionBuffer

# Keep at most 5 minutes of RR history for windowing (~400 beats at 75 BPM)
_MAX_RR_BUFFER = 500
# Minimum beats before attempting RMSSD computation
_MIN_BEATS = 30
# Driving detection: speed threshold and sustained duration
_DRIVING_SPEED_KMH = 20.0
_DRIVING_SUSTAIN_SEC = 60.0


def compute_rmssd_from_buffer(rr_values: List[float], baseline: float) -> Optional[Dict]:
    """
    Given a list of recent RR values, compute RMSSD and fatigue level.
    Returns None if there is not enough data.
    """
    if len(rr_values) < _MIN_BEATS:
        return None

    rr = filter_rr(np.array(rr_values, dtype=float))
    if len(rr) < 2:
        return None

    windows = build_windows(rr, window_sec=60, step_sec=5)
    if not windows:
        return None

    # Use only the most recent window
    rmssds = batch_java_rmssd(windows)
    rmssd = float(np.nanmean(rmssds))
    fatigue = classify_fatigue(rmssd, baseline)
    return {"rmssd": round(rmssd, 2), "fatigue": fatigue}


def handle_rr(buffer: SessionBuffer, value: float, timestamp: int) -> Optional[Dict]:
    """
    Append an RR value to the buffer and return an HRV update dict if ready.
    Returns None while still accumulating data.
    """
    # Filter at intake
    if value < 300 or value > 2000:
        return None

    buffer.rr_values.append(value)
    buffer.rr_timestamps.append(timestamp)

    # Trim buffer to avoid unbounded growth
    if len(buffer.rr_values) > _MAX_RR_BUFFER:
        buffer.rr_values = buffer.rr_values[-_MAX_RR_BUFFER:]
        buffer.rr_timestamps = buffer.rr_timestamps[-_MAX_RR_BUFFER:]

    result = compute_rmssd_from_buffer(buffer.rr_values, buffer.baseline_rmssd)
    if result is None:
        return None

    buffer.last_rmssd = result["rmssd"]
    buffer.last_fatigue = result["fatigue"]
    buffer.max_fatigue = max(buffer.max_fatigue, result["fatigue"])

    return {"type": "hrv_update", "rmssd": result["rmssd"], "fatigue": result["fatigue"], "timestamp": timestamp}


def handle_gps(buffer: SessionBuffer, data: dict) -> dict:
    """
    Append a GPS reading and check for driving detection.
    Returns a gps_update dict.
    """
    entry = {
        "speed": data.get("speed", 0.0),
        "lat": data.get("lat", 0.0),
        "lng": data.get("lng", 0.0),
        "timestamp": data.get("timestamp", int(time.time() * 1000)),
    }
    buffer.gps_history.append(entry)

    # Keep only last 3 minutes of GPS history
    cutoff_ms = entry["timestamp"] - 180_000
    buffer.gps_history = [g for g in buffer.gps_history if g["timestamp"] >= cutoff_ms]

    # Driving detection: any reading > threshold sustained for 60s
    driving_detected = False
    if not buffer.driving_confirmed and entry["timestamp"] > buffer.driving_dismissed_until:
        now_ms = entry["timestamp"]
        window_start = now_ms - int(_DRIVING_SUSTAIN_SEC * 1000)
        recent = [g for g in buffer.gps_history if g["timestamp"] >= window_start]
        if recent and all(g["speed"] > _DRIVING_SPEED_KMH for g in recent):
            driving_detected = True

    return {
        "type": "gps_update",
        "speed": entry["speed"],
        "lat": entry["lat"],
        "lng": entry["lng"],
        "driving_detected": driving_detected,
        "driving_confirmed": buffer.driving_confirmed,
        "timestamp": entry["timestamp"],
    }
