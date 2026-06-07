import { useEffect, useRef, useCallback } from "react";
import type { FatigueLevel } from "../store/sessionStore";
import { useSessionStore } from "../store/sessionStore";

const WS_BASE = import.meta.env.VITE_WS_URL ?? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
const RECONNECT_DELAY_MS = 2000;

export function useWebSocket(userId: string | null, demo: boolean, token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const demoRef = useRef<boolean>(demo);
  demoRef.current = demo;
  const store = useSessionStore();

  const openConnection = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    intentionalCloseRef.current = false;

    const path = demoRef.current
      ? `/ws/demo/${uid}`
      : `/ws/browser/${uid}?token=${encodeURIComponent(tokenRef.current ?? "")}`;
    const ws = new WebSocket(`${WS_BASE}${path}`);
    wsRef.current = ws;

    ws.onopen = () => { store.setConnected(true); };

    ws.onclose = () => {
      store.setConnected(false);
      wsRef.current = null;
      // Reconnect unless this was an intentional cleanup close
      if (!intentionalCloseRef.current && userIdRef.current) {
        reconnectTimerRef.current = setTimeout(openConnection, RECONNECT_DELAY_MS);
      }
    };

    ws.onmessage = (evt) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(evt.data); } catch { return; }

      switch (msg.type) {
        case "sensor_connected":
          store.setSensorConnected((msg.sensor_model as string | null) ?? null);
          break;
        case "sensor_disconnected":
          store.setSensorDisconnected();
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
  }, []);

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
    if (!userId) return;

    openConnection();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      store.reset();
    };
  }, [userId, demo]);

  return { sendAck, sendDismiss };
}

