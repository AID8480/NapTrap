import { useSessionStore } from "../../store/sessionStore";
import { ClayCard } from "../ui/ClayCard";
import { AmbientBlobs } from "../layout/AmbientBlobs";
import { FullScreenAlert } from "./FullScreenAlert";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useState, useRef } from "react";

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
  };
  const hide = () => {
    timerRef.current = setTimeout(() => setVisible(false), 100);
  };

  return (
    <span
      className="relative inline-flex items-center justify-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="w-4 h-4 rounded-full bg-gray-400/40 text-gray-500 text-[9px] font-bold flex items-center justify-center cursor-default select-none leading-none">
        ?
      </span>
      <span
        className={`
          pointer-events-none absolute z-50 bottom-[calc(100%+6px)] right-0
          w-[220px] rounded-xl bg-gray-800/95 text-white text-[11px] leading-[1.5]
          px-3 py-2 shadow-lg
          transition-opacity duration-200
          ${visible ? "opacity-100" : "opacity-0"}
        `}
        style={{ whiteSpace: "pre-line" }}
      >
        {text}
        <span className="absolute bottom-[-5px] right-3 w-2.5 h-2.5 bg-gray-800/95 rotate-45" />
      </span>
    </span>
  );
}

export function FusionModule({ hasBaseline = true }: { hasBaseline?: boolean }) {
  const {
    rmssdHistory, currentFatigue, currentSpeed,
    currentLat, currentLng, drivingConfirmed, alertActive,
  } = useSessionStore();

  const hrv_elevated = currentFatigue >= 2;
  const gps_elevated = (currentSpeed ?? 0) > 20 && drivingConfirmed;

  let fusionStatus = "Normal";
  let fusionColor = "text-mint";
  if (hrv_elevated && gps_elevated) { fusionStatus = "⚠️ ALERT"; fusionColor = "text-red-500"; }
  else if (hrv_elevated || gps_elevated) { fusionStatus = "⚡ Warning"; fusionColor = "text-lemon-dark"; }

  return (
    <>
      <ClayCard className="relative bg-sky-light p-6 overflow-hidden">
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
        <AmbientBlobs blobs={[
          { color: "bg-sky", size: "w-40 h-40", top: "-20%", left: "60%", delay: "2s" },
          { color: "bg-lavender", size: "w-28 h-28", top: "65%", left: "5%", delay: "5s" },
        ]} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔀</span>
              <h2 className="font-bold text-gray-800 text-lg">Dual Signal Fusion</h2>
            </div>
            <span className="flex items-center gap-1">
              <span className={`text-sm font-bold ${fusionColor}`}>{fusionStatus}</span>
              {(hrv_elevated && gps_elevated) && (
                <InfoTooltip text={"Both signals elevated simultaneously — physiological fatigue AND abnormal driving detected. Immediate alert triggered."} />
              )}
              {(hrv_elevated || gps_elevated) && !(hrv_elevated && gps_elevated) && (
                <InfoTooltip text={"One signal elevated — either HRV fatigue level reached 2+ or abnormal driving behavior detected. Logged but no alert triggered."} />
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* HRV panel */}
            <div className="bg-white/60 rounded-2xl p-3">
              <div className="flex items-end justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500">❤️ HRV Signal</div>
                <InfoTooltip text={"Elevated when fatigue level reaches Moderate (2) or above.\nBased on RMSSD drop ratio compared to your personal baseline."} />
              </div>
              <div className={`text-sm font-bold mb-2 ${hrv_elevated ? "text-coral" : "text-mint"}`}>
                {hrv_elevated ? "Elevated" : "Normal"}
              </div>
              {rmssdHistory.length > 1 && (
                <ResponsiveContainer width="100%" height={50}>
                  <LineChart data={rmssdHistory.slice(-30)}>
                    <YAxis domain={["auto", "auto"]} hide />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(1)} ms`, "RMSSD"]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="v" stroke="#4ECDC4" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* GPS panel */}
            <div className="bg-white/60 rounded-2xl p-3">
              <div className="flex items-end justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500">📍 GPS Signal</div>
                <InfoTooltip text={"Elevated when speed exceeds 20 km/h during a confirmed driving session."} />
              </div>
              <div className={`text-sm font-bold mb-1 ${gps_elevated ? "text-coral" : "text-mint"}`}>
                {drivingConfirmed ? "Driving" : "Not driving"}
              </div>
              <div className="text-xl font-extrabold text-sky">
                {currentSpeed !== null ? `${currentSpeed.toFixed(0)}` : "—"}
                <span className="text-xs font-normal text-gray-400 ml-1">km/h</span>
              </div>
              {currentLat !== null && (
                <div className="text-xs text-gray-400 mt-1 truncate">
                  {currentLat.toFixed(4)}, {currentLng?.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-400 text-center">
            Alert fires when both HRV and GPS signals are elevated simultaneously
          </div>
        </div>
      </ClayCard>

      {alertActive && <FullScreenAlert />}
    </>
  );
}
