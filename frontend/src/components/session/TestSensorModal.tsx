import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Activity, Cpu } from "lucide-react";

const WS_BASE = import.meta.env.VITE_WS_URL ?? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
const MAX_RR_HISTORY = 20;
const MIN_RR = 300;
const MAX_RR = 2000;

interface Props { onClose: () => void; }

export function TestSensorModal({ onClose }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [lastRR, setLastRR] = useState<number | null>(null);
  const [rrHistory, setRrHistory] = useState<number[]>([]);
  const [rmssd, setRmssd] = useState<number | null>(null);
  const [beatPulse, setBeatPulse] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const ws = new WebSocket(`${WS_BASE}/ws/test/${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onclose = () => setConnected(false);

    ws.onmessage = (evt) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "rr_ack") {
        const value = msg.value as number;
        setConnected(true);
        setLastRR(value);
        setRrHistory((prev) => [...prev.slice(-MAX_RR_HISTORY + 1), value]);
        setBeatPulse(true);
      } else if (msg.type === "hrv_update") {
        setRmssd(msg.rmssd as number);
      }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [userId]);

  // Reset pulse after animation
  useEffect(() => {
    if (!beatPulse) return;
    const t = setTimeout(() => setBeatPulse(false), 250);
    return () => clearTimeout(t);
  }, [beatPulse]);

  const instBpm = lastRR ? Math.round(60000 / lastRR) : null;

  // SVG waveform dimensions
  const svgW = 260;
  const svgH = 56;
  const barW = 10;
  const barGap = 3;
  const totalBars = MAX_RR_HISTORY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-sm p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Cpu className="w-5 h-5 text-gray-600" /> Test Sensor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 mb-5">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-400" : "bg-gray-300"}`} />
          <span className={`text-sm font-semibold ${connected ? "text-emerald-600" : "text-gray-400"}`}>
            {connected ? "Connected" : "No Signal"}
          </span>
        </div>

        {/* Heartbeat pulse animation */}
        <div className="flex justify-center mb-5">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center transition-transform duration-150"
            style={{
              background: connected ? "rgba(239,68,68,0.1)" : "rgba(229,231,235,0.5)",
              transform: beatPulse ? "scale(1.15)" : "scale(1.0)",
            }}
          >
            <span
              className="text-4xl transition-transform duration-150"
              style={{ transform: beatPulse ? "scale(1.2)" : "scale(1.0)" }}
            >
              <Activity className={`w-10 h-10 transition-colors duration-150 ${connected ? "text-red-400" : "text-gray-300"}`} />
            </span>
          </div>
        </div>

        {/* RR / BPM stats */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-gray-50 rounded-2xl p-3 text-center">
            <div className="text-2xl font-extrabold text-gray-800">
              {lastRR !== null ? `${lastRR}` : "—"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">RR interval (ms)</div>
          </div>
          <div className="bg-gray-50 rounded-2xl p-3 text-center">
            <div className="text-2xl font-extrabold text-gray-800">
              {instBpm !== null ? instBpm : "—"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Inst. BPM</div>
          </div>
        </div>

        {/* RR waveform — bar chart */}
        <div className="mb-5">
          <div className="text-xs text-gray-400 mb-1.5">RR History (last {MAX_RR_HISTORY} beats)</div>
          <svg width={svgW} height={svgH} className="w-full" viewBox={`0 0 ${svgW} ${svgH}`}>
            {Array.from({ length: totalBars }).map((_, i) => {
              const val = rrHistory[i - (totalBars - rrHistory.length)];
              const filled = val !== undefined;
              const normalised = filled
                ? Math.max(0, Math.min(1, (val - MIN_RR) / (MAX_RR - MIN_RR)))
                : 0;
              const barH = filled ? Math.max(4, normalised * (svgH - 4)) : 4;
              const x = i * (barW + barGap);
              const isLatest = filled && i === totalBars - (totalBars - rrHistory.length) - 1 + (totalBars - rrHistory.length);
              return (
                <rect
                  key={i}
                  x={x}
                  y={svgH - barH}
                  width={barW}
                  height={barH}
                  rx={3}
                  fill={filled ? (isLatest && beatPulse ? "#ef4444" : "#4ECDC4") : "#e5e7eb"}
                />
              );
            })}
          </svg>
        </div>

        {/* RMSSD */}
        <div className={`rounded-2xl p-4 text-center ${rmssd !== null ? "bg-teal-50" : "bg-gray-50"}`}>
          {rmssd !== null ? (
            <>
              <div className="text-3xl font-extrabold text-teal-600">{rmssd.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-0.5">ms RMSSD</div>
            </>
          ) : (
            <div className="text-sm text-gray-400">
              {rrHistory.length > 0
                ? `Collecting beats… ${rrHistory.length}/30`
                : "Waiting for sensor data…"}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
