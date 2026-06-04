import { useEffect, useRef, useCallback } from "react";
import type { FatigueLevel } from "../store/sessionStore";
import { useSessionStore } from "../store/sessionStore";

const WS_BASE = import.meta.env.VITE_WS_URL ?? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

export function useWebSocket(userId: string | null, demo: boolean, hasBaseline: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const prevDemoRef = useRef<boolean>(demo);
  const ignoringRef = useRef<boolean>(false);
  const store = useSessionStore();

  const connect = useCallback(() => {
    if (!userId) return;
    ignoringRef.current = false;
    const path = demo ? `/ws/demo/${userId}` : `/ws/sensor/${userId}`;
    const ws = new WebSocket(`${WS_BASE}${path}`);
    wsRef.current = ws;

    ws.onopen = () => { store.setConnected(true); store.setSensorConnected(null); };
    ws.onclose = () => { store.setConnected(false); wsRef.current = null; };

    ws.onmessage = (evt) => {
      if (ignoringRef.current) return;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(evt.data); } catch { return; }

      switch (msg.type) {
        case "sensor_connected":
          store.setSensorConnected((msg.sensor_model as string | null) ?? null);
          break;
        case "hrv_update":
          store.pushRR(
            msg.rmssd as number,
            msg.fatigue as FatigueLevel,
            msg.timestamp as number,
          );
          break;
        case "gps_update":
          store.pushGPS(
            msg.speed as number,
            msg.lat as number,
            msg.lng as number,
          );
          break;
        case "driving_detected":
          store.setDrivingDetected(true);
          break;
        case "monitoring_started":
          store.setDrivingConfirmed(true);
          store.setDrivingDetected(false);
          break;
        case "alert":
          store.triggerAlert(msg.fatigue_level as FatigueLevel);
          break;
      }
    };
  }, [userId, demo, hasBaseline]);

  const sendAck = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "driving_ack" }));
    store.setDrivingConfirmed(true);
    store.setDrivingDetected(false);
  }, []);

  const sendDismiss = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "driving_dismiss" }));
    store.setDrivingDetected(false);
  }, []);

  useEffect(() => {
    const exitingDemo = prevDemoRef.current && !demo;
    prevDemoRef.current = demo;

    if (userId && !exitingDemo && hasBaseline) connect();
    return () => {
      // Stop processing any in-flight messages before resetting state
      ignoringRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
      store.reset();
    };
  }, [userId, demo, hasBaseline]);

  return { sendAck, sendDismiss };
}
