"""
Demo simulator: scripted 4-minute walkthrough of all fatigue levels.
Emits packets directly to the WebSocket — no HRV pipeline dependency.

Timeline (clock starts after driving is auto-confirmed at ~t=5s):
  0–60s:    Level 0 Fresh     (RMSSD ~5 % below baseline)
  60–120s:  Level 1 Mild      (RMSSD ~18 % below baseline)
  120–180s: Level 2 Moderate  (RMSSD ~32 % below baseline)  → ⚡ Warning
  180s+:    Level 3 Severe    (RMSSD ~45 % below baseline)  → GPS 25 km/h → ⚠️ ALERT
"""
import asyncio
import time

import numpy as np

_BASE_LAT = 23.0215
_BASE_LNG = 113.7517

# RMSSD drop ratios that land solidly in each fatigue band.
# Pipeline thresholds: <10 % = L0, 10–25 % = L1, 25–40 % = L2, ≥40 % = L3
_DROP_BY_LEVEL = [0.05, 0.18, 0.32, 0.45]

# Duration (seconds) of phases 0 / 1 / 2; phase 3 runs until disconnect
_PHASE_SEC = [60.0, 60.0, 60.0]

# Base cruise speed — fatigue makes it erratic, not slower
_BASE_SPEED = 72.0
# Speed std-dev (km/h) per fatigue level — higher = more erratic
_SPEED_NOISE = [3.0, 7.0, 14.0, 22.0]
# Lateral drift std-dev (degrees) per fatigue level
# 0.00003° ≈ 3 m (normal lane), 0.0005° ≈ 55 m (severe swerve)
_LATERAL_NOISE = [0.00003, 0.00008, 0.00020, 0.00050]

_HRV_INTERVAL = 3.0   # seconds between hrv_update packets
_GPS_INTERVAL = 1.0   # seconds between gps_update packets


class DemoSimulator:
    def __init__(self, baseline_rmssd: float = 50.0) -> None:
        self._baseline = baseline_rmssd

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _level_at(self, elapsed: float) -> int:
        t = 0.0
        for i, dur in enumerate(_PHASE_SEC):
            t += dur
            if elapsed < t:
                return i
        return 3

    def _rmssd_for(self, level: int) -> float:
        drop = _DROP_BY_LEVEL[level]
        noise = float(np.random.normal(0, self._baseline * 0.015))
        return round(max(5.0, self._baseline * (1.0 - drop) + noise), 2)

    def _gps_for(self, level: int, elapsed: float) -> tuple:
        speed = round(
            max(0.0, _BASE_SPEED + float(np.random.normal(0, _SPEED_NOISE[level]))), 1
        )
        drift = elapsed * 0.00001
        lat = round(_BASE_LAT + drift + float(np.random.normal(0, _LATERAL_NOISE[level])), 6)
        lng = round(_BASE_LNG + drift + float(np.random.normal(0, _LATERAL_NOISE[level])), 6)
        return speed, lat, lng

    # ------------------------------------------------------------------
    # Main stream
    # ------------------------------------------------------------------

    async def stream(self, send_json, buffer) -> None:
        """
        Continuously emit demo packets via send_json(dict).
        Mutates buffer.driving_confirmed / max_fatigue / alert_count in place
        so _finalize() records correct session stats.
        """
        # 1. Brief pause, then show the driving-detection popup
        await asyncio.sleep(10.0)
        await send_json({"type": "driving_detected"})

        # 2. Auto-confirm driving 3 seconds later (simulates user clicking OK)
        await asyncio.sleep(3.0)
        buffer.driving_confirmed = True
        await send_json({"type": "monitoring_started"})

        start = time.time()
        hrv_acc = 0.0
        gps_acc = 0.0
        alert_sent: set = set()
        tick = 0.05  # 50 ms poll loop

        while True:
            await asyncio.sleep(tick)
            elapsed = time.time() - start
            hrv_acc += tick
            gps_acc += tick

            ts = int(time.time() * 1000)
            level = self._level_at(elapsed)
            buffer.max_fatigue = max(buffer.max_fatigue, level)

            # --- HRV packet ---
            if hrv_acc >= _HRV_INTERVAL:
                hrv_acc -= _HRV_INTERVAL
                rmssd = self._rmssd_for(level)
                await send_json({
                    "type": "hrv_update",
                    "rmssd": rmssd,
                    "fatigue": level,
                    "timestamp": ts,
                })

                # Fire alert once per qualifying level (≥ 2, driving confirmed)
                if level >= 2 and level not in alert_sent:
                    alert_sent.add(level)
                    buffer.alert_count += 1
                    await send_json({
                        "type": "alert",
                        "fatigue_level": level,
                        "timestamp": ts,
                    })

            # --- GPS packet ---
            if gps_acc >= _GPS_INTERVAL:
                gps_acc -= _GPS_INTERVAL
                speed, lat, lng = self._gps_for(level, elapsed)
                await send_json({
                    "type": "gps_update",
                    "speed": speed,
                    "lat": lat,
                    "lng": lng,
                    "driving_detected": False,
                    "driving_confirmed": True,
                    "timestamp": ts,
                })
