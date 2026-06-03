import { useState, useEffect } from "react";
import { ClayCard } from "../ui/ClayCard";
import { AmbientBlobs } from "../layout/AmbientBlobs";
import { ClayButton } from "../ui/ClayButton";
import { getHistory, clearHistory } from "../../api/session";
import type { SessionOut } from "../../api/session";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

const FATIGUE_COLORS = ["#4ECDC4", "#FFE66D", "#FF6B6B", "#e74c3c"];
const FATIGUE_LABELS = ["Fresh", "Mild", "Moderate", "Severe"];

export function HistoryModule() {
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    getHistory().then((r) => setSessions(r.data)).catch(() => {});
  }, []);

  const handleClear = async () => {
    await clearHistory();
    setSessions([]);
    setConfirmClear(false);
  };

  const barData = [0, 1, 2, 3].map((level) => ({
    name: FATIGUE_LABELS[level],
    count: sessions.filter((s) => s.max_fatigue_level === level).length,
    color: FATIGUE_COLORS[level],
  }));

  const lineData = sessions
    .slice()
    .reverse()
    .map((s, i) => ({
      name: `S${i + 1}`,
      alerts: s.alert_count,
      fatigue: s.max_fatigue_level,
    }));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const dur = (s: SessionOut) => {
    if (!s.ended_at) return "ongoing";
    const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    const m = Math.round(ms / 60000);
    return `${m} min`;
  };

  return (
    <ClayCard className="relative bg-lavender-light p-6 overflow-hidden">
      <AmbientBlobs blobs={[
        { color: "bg-lavender", size: "w-44 h-44", top: "-15%", left: "65%", delay: "1.5s" },
        { color: "bg-sky", size: "w-28 h-28", top: "60%", left: "-5%", delay: "3.5s" },
      ]} />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="font-bold text-gray-800 text-lg">Session History</h2>
          </div>
          {sessions.length > 0 && (
            <ClayButton variant="ghost" className="text-xs text-red-400" onClick={() => setConfirmClear(true)}>
              Clear all
            </ClayButton>
          )}
        </div>

        {confirmClear && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl clay-shadow-lg w-full max-w-sm p-6 text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">Clear all history?</h3>
              <p className="text-sm text-gray-500 mb-5">This will permanently delete all session records and cannot be undone.</p>
              <div className="flex gap-3">
                <ClayButton variant="ghost" onClick={() => setConfirmClear(false)} className="flex-1">Cancel</ClayButton>
                <ClayButton colorClass="bg-red-400 text-white flex-1" onClick={handleClear}>Clear all</ClayButton>
              </div>
            </div>
          </div>
        )}

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No sessions recorded yet.</p>
        ) : (
          <>
            {/* Fatigue distribution bar chart */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-2">Fatigue level distribution</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={barData} barSize={32}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Alert count line chart */}
            {lineData.length > 1 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 mb-2">Alerts per session</p>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={lineData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="alerts" stroke="#A8A4E6" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Session table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Date</th>
                    <th className="text-left pb-2 font-semibold">Duration</th>
                    <th className="text-left pb-2 font-semibold">Max fatigue</th>
                    <th className="text-left pb-2 font-semibold">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-white/40 transition-colors">
                      <td className="py-2 text-gray-600">{fmt(s.started_at)}</td>
                      <td className="py-2 text-gray-600">{dur(s)}</td>
                      <td className="py-2">
                        <span
                          className="px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            backgroundColor: FATIGUE_COLORS[s.max_fatigue_level] + "33",
                            color: FATIGUE_COLORS[s.max_fatigue_level],
                          }}
                        >
                          {FATIGUE_LABELS[s.max_fatigue_level]}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600">{s.alert_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ClayCard>
  );
}
