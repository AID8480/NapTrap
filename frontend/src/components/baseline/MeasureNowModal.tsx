import { useState, useEffect, useRef } from "react";
import { ClayButton } from "../ui/ClayButton";
import { uploadBaseline } from "../../api/baseline";
import { useAuth } from "../../hooks/useAuth";
import { Wind } from "lucide-react";

const MEASURE_DURATION = 300; // 5 minutes in seconds
const WS_BASE = typeof window !== "undefined"
  ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
  : "ws://localhost:8000";

interface Props { onClose: () => void; }

export function MeasureNowModal({ onClose }: Props) {
  const { user } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(MEASURE_DURATION);
  const [rmssd, setRmssd] = useState<number | null>(null);
  const [rrCount, setRrCount] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const rmssdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const ws = new WebSocket(`${WS_BASE}/ws/sensor/${user.id}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "hrv_update") {
        setRmssd(msg.rmssd);
        rmssdRef.current = msg.rmssd;
        setRrCount((c) => c + 1);
      }
    };

    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          ws.close();
          setDone(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => { clearInterval(timer); ws.close(); };
  }, [user]);

  const saveBaseline = async () => {
    if (rmssdRef.current === null) return;
    setSaving(true);
    // Create a synthetic single-value file for the API
    const blob = new Blob([String(rmssdRef.current)], { type: "text/plain" });
    const file = new File([blob], "resting.txt");
    try {
      await uploadBaseline(file, "resting");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const progress = ((MEASURE_DURATION - secondsLeft) / MEASURE_DURATION) * 100;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-sm p-6 text-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Wind className="w-5 h-5 text-mint" /> Measure Resting HRV</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Progress ring */}
        <div className="flex justify-center mb-4">
          <svg width="128" height="128" className="-rotate-90">
            <circle cx="64" cy="64" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="64" cy="64" r={r} fill="none"
              stroke="#4ECDC4" strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: "32px" }}>
            <span className="text-2xl font-bold text-gray-800">
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
            <span className="text-xs text-gray-400">remaining</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-3">Sit still and breathe normally</p>

        {rmssd !== null && (
          <div className="bg-mint-light rounded-2xl p-4 mb-4">
            <div className="text-3xl font-extrabold text-mint">{rmssd.toFixed(1)}</div>
            <div className="text-xs text-gray-500">ms RMSSD (updating…)</div>
          </div>
        )}

        {done ? (
          <ClayButton
            colorClass="bg-mint text-white w-full"
            disabled={rmssd === null || saving}
            onClick={saveBaseline}
          >
            {saving ? "Saving…" : "Use this as my baseline"}
          </ClayButton>
        ) : (
          <p className="text-xs text-gray-400">Measuring… {rrCount} beats recorded</p>
        )}
      </div>
    </div>
  );
}
