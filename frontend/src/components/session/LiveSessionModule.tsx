import { useEffect, useState } from "react";
import { useSessionStore } from "../../store/sessionStore";
import { ClayCard } from "../ui/ClayCard";
import { AmbientBlobs } from "../layout/AmbientBlobs";
import { FatigueRing } from "./FatigueRing";
import { DrivingDetectionPopup } from "./DrivingDetectionPopup";
import { Car, Radio } from "lucide-react";

const FATIGUE_COLORS = ["#4ECDC4", "#FFE66D", "#FF6B6B", "#e74c3c"];
const FATIGUE_LABELS = ["Fresh", "Mild fatigue", "Moderate fatigue", "Severe fatigue"];

interface Props { onAck: () => void; onDismiss: () => void; hasBaseline?: boolean; }

export function LiveSessionModule({ onAck, onDismiss, hasBaseline = true }: Props) {
  const { connected, sensorConnected, sensorModel, currentRmssd, currentFatigue, drivingDetected, drivingConfirmed } = useSessionStore();
  const [showSensorToast, setShowSensorToast] = useState(false);

  // Show toast when sensor first connects
  useEffect(() => {
    if (sensorConnected) {
      setShowSensorToast(true);
      const t = setTimeout(() => setShowSensorToast(false), 4000);
      return () => clearTimeout(t);
    }
  }, [sensorConnected]);

  const fatigue = currentFatigue ?? 0;
  const color = FATIGUE_COLORS[fatigue];

  return (
    <>
      {/* Sensor connected toast */}
      {showSensorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl clay-shadow px-5 py-3 flex items-center gap-3">
          <Radio className="w-5 h-5 text-mint-dark" />
          <div>
            <div className="font-semibold text-gray-800 text-sm">Sensor Connected</div>
            {sensorModel && (
              <div className="text-xs text-gray-400">{sensorModel}</div>
            )}
          </div>
          <button onClick={() => setShowSensorToast(false)} className="text-gray-300 hover:text-gray-500 ml-2 text-lg leading-none">✕</button>
        </div>
      )}

      <ClayCard className="relative bg-mint-light p-6">
        {!hasBaseline && (
          <div
            title="Please set up a Baseline before using this feature"
            className="absolute inset-0 z-20 rounded-3xl bg-gray-100/70 backdrop-blur-[2px] flex items-center justify-center cursor-not-allowed"
          >
            <span className="text-xs font-semibold text-gray-400 bg-white/80 rounded-xl px-3 py-2 shadow">
              Please set up a Baseline before using this feature
            </span>
          </div>
        )}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <AmbientBlobs blobs={[
            { color: "bg-mint", size: "w-44 h-44", top: "-15%", left: "65%", delay: "1s" },
            { color: "bg-sky", size: "w-32 h-32", top: "55%", left: "-5%", delay: "4s" },
          ]} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-gray-700" />
              <h2 className="font-bold text-gray-800 text-lg">Live Session</h2>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                connected ? "bg-mint/30 text-mint-dark" : "bg-gray-100 text-gray-400"
              }`}>
                {connected ? (drivingConfirmed ? "● Monitoring" : "● Connected") : "○ Waiting"}
              </span>
              <div className="relative group">
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center cursor-default select-none">?</span>
                <div className="absolute right-0 top-6 z-50 hidden group-hover:block w-64 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 shadow-lg leading-relaxed">
                  <p><span className="font-semibold">Connected</span> — WebSocket connection to the server is active</p>
                  <p className="mt-1"><span className="font-semibold">Monitoring</span> — Drive confirmed, fatigue monitoring in progress</p>
                  <p className="mt-1"><span className="font-semibold">Waiting</span> — Not connected to the server</p>
                  <p className="mt-1 text-gray-400">For sensor status, see the Sensor indicator in the top-right corner.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <FatigueRing fatigue={fatigue} rmssd={currentRmssd} />

            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-1">Fatigue Level</div>
              <div
                className="text-xl font-bold rounded-2xl px-4 py-2 inline-block"
                style={{ backgroundColor: color + "33", color }}
              >
                {FATIGUE_LABELS[fatigue]}
              </div>

              {currentRmssd !== null && (
                <div className="mt-3 text-sm text-gray-500">
                  RMSSD: <span className="font-bold text-gray-800">{currentRmssd.toFixed(1)} ms</span>
                </div>
              )}

              {!connected && (
                <p className="text-xs text-gray-400 mt-2">
                  Connect your sensor or enable demo mode to start monitoring.
                </p>
              )}
            </div>
          </div>
        </div>
      </ClayCard>

      {drivingDetected && !drivingConfirmed && (
        <DrivingDetectionPopup onConfirm={onAck} onDismiss={onDismiss} />
      )}
    </>
  );
}
