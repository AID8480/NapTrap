import { useState, useCallback } from "react";
import { ClayButton } from "../ui/ClayButton";
import { previewBaseline, uploadBaseline } from "../../api/baseline";
import type { BaselinePreview } from "../../api/baseline";

interface Props { onClose: () => void; }

export function UploadSleepModal({ onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BaselinePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    setError("");
    setPreview(null);
    setLoading(true);
    try {
      const res = await previewBaseline(f);
      setPreview(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const confirm = async () => {
    if (!file || !preview) return;
    setLoading(true);
    try {
      await uploadBaseline(file, "sleep");
      setDone(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-lg">😴 Upload Sleep Data</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-700">Baseline saved!</p>
            <p className="text-sm text-gray-500 mt-1">RMSSD: {preview?.rmssd_value.toFixed(2)} ms</p>
            <ClayButton colorClass="bg-coral text-white mt-4" onClick={onClose}>Done</ClayButton>
          </div>
        ) : (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById("rr-file-input")?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragging ? "border-coral bg-coral-light" : "border-gray-200 hover:border-coral/50"
              }`}
            >
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-gray-600 font-medium">
                {file ? file.name : "Drop .txt file here or click to browse"}
              </p>
              <p className="text-xs text-gray-400 mt-1">One RR interval (ms) per line</p>
              <input
                id="rr-file-input"
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {loading && <p className="text-sm text-gray-500 text-center mt-4">Analyzing…</p>}

            {preview && (
              <div className="mt-4 bg-coral-light rounded-2xl p-4 space-y-1.5">
                <Row label="Intervals detected" value={preview.interval_count.toLocaleString()} />
                <Row label="Duration" value={`${preview.duration_minutes.toFixed(1)} min`} />
                <Row label="Calculated RMSSD" value={`${preview.rmssd_value.toFixed(2)} ms`} />
              </div>
            )}

            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

            <div className="flex gap-2 mt-5">
              <ClayButton variant="ghost" onClick={onClose} className="flex-1">Cancel</ClayButton>
              <ClayButton
                colorClass="bg-coral text-white flex-1"
                disabled={!preview || loading}
                onClick={confirm}
              >
                Save as Baseline
              </ClayButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  );
}
