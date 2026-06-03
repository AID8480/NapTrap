import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { ClayCard } from "../ui/ClayCard";
import { ClayButton } from "../ui/ClayButton";
import { AmbientBlobs } from "../layout/AmbientBlobs";
import { getBaseline, selectBaseline, deleteBaseline } from "../../api/baseline";
import type { BaselineOut } from "../../api/baseline";
import { UploadSleepModal } from "./UploadSleepModal";
import { MeasureNowModal } from "./MeasureNowModal";
import { useSessionStore } from "../../store/sessionStore";

interface Props {
  onBaselineChange?: (hasBaseline: boolean) => void;
  demo?: boolean;
}

export interface BaselineModuleHandle {
  openUpload: () => void;
  openMeasure: () => void;
}

export const BaselineModule = forwardRef<BaselineModuleHandle, Props>(function BaselineModule({ onBaselineChange, demo }, ref) {
  const [baselines, setBaselines] = useState<BaselineOut[]>([]);
  const [active, setActive] = useState<BaselineOut | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showMeasure, setShowMeasure] = useState(false);
  const [showNoSensor, setShowNoSensor] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sensorConnected = useSessionStore((s) => s.sensorConnected);

  const load = async () => {
    try {
      const res = await getBaseline();
      setBaselines(res.data.baselines);
      setActive(res.data.active);
      onBaselineChange?.(res.data.baselines.length > 0);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  useImperativeHandle(ref, () => ({
    openUpload: () => setShowUpload(true),
    openMeasure: handleMeasureClick,
  }));

  const handleSelect = async (id: string) => {
    await selectBaseline(id);
    load();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    await deleteBaseline(confirmDeleteId);
    setConfirmDeleteId(null);
    load();
  };

  const handleMeasureClick = () => {
    if (!demo && !sensorConnected) {
      setShowNoSensor(true);
    } else {
      setShowMeasure(true);
    }
  };

  const sleepBaseline = baselines.find((b) => b.method === "sleep");
  const restingBaseline = baselines.find((b) => b.method === "resting");

  return (
    <>
      <ClayCard className="relative bg-coral-light p-6 overflow-hidden">
        <AmbientBlobs blobs={[
          { color: "bg-coral", size: "w-40 h-40", top: "-20%", left: "70%", delay: "0s" },
          { color: "bg-lemon", size: "w-28 h-28", top: "60%", left: "-5%", delay: "3s" },
        ]} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">❤️</span>
            <h2 className="font-bold text-gray-800 text-lg">Baseline HRV</h2>
          </div>

          {active ? (
            <div className="mb-4">
              <div className="text-4xl font-extrabold text-coral">{active.rmssd_value.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-0.5">ms RMSSD</div>
              <span className="inline-block mt-2 text-xs font-semibold bg-coral/20 text-coral-dark rounded-full px-3 py-1">
                {active.method === "sleep" ? "😴 Sleep Data" : "🧘 Resting Measurement"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">No baseline set yet. Upload sleep data or measure now.</p>
          )}

          {/* Show both if available with selector + delete buttons */}
          {sleepBaseline && restingBaseline && (
            <div className="flex gap-2 mb-4">
              {[sleepBaseline, restingBaseline].map((b) => (
                <div key={b.id} className="flex-1 relative group">
                  <button
                    onClick={() => handleSelect(b.id)}
                    className={`w-full rounded-2xl p-3 text-xs font-semibold border-2 transition-all ${
                      b.is_active
                        ? "border-coral bg-coral/10 text-coral-dark"
                        : "border-gray-200 bg-white/60 text-gray-500 hover:border-coral/40"
                    }`}
                  >
                    <div className="text-lg font-bold">{b.rmssd_value.toFixed(1)}</div>
                    <div>{b.method === "sleep" ? "😴 Sleep" : "🧘 Resting"}</div>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(b.id)}
                    title="Delete this baseline"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-200/80 text-gray-400 hover:bg-red-100 hover:text-red-500 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Single baseline with delete button */}
          {baselines.length === 1 && (
            <div className="mb-4">
              <button
                onClick={() => setConfirmDeleteId(baselines[0].id)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
              <span>✕</span> Delete this baseline
              </button>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <ClayButton colorClass="bg-coral text-white" onClick={() => setShowUpload(true)}>
              Upload Sleep Data
            </ClayButton>
            <ClayButton variant="ghost" onClick={handleMeasureClick}>
              Measure Now
            </ClayButton>
          </div>
        </div>
      </ClayCard>

      {showUpload && (
        <UploadSleepModal onClose={() => { setShowUpload(false); load(); }} />
      )}
      {showMeasure && (
        <MeasureNowModal onClose={() => { setShowMeasure(false); load(); }} />
      )}
      {showNoSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">📡</div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">No Sensor Detected</h3>
            <p className="text-sm text-gray-500 mb-5">Please connect a heart rate sensor before starting a resting measurement.</p>
            <ClayButton colorClass="bg-coral text-white w-full" onClick={() => setShowNoSensor(false)}>Got it</ClayButton>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-500 mb-5">Are you sure you want to delete this baseline?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-2xl border-2 border-gray-200 py-2 text-sm font-semibold text-gray-500 hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-2xl bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
