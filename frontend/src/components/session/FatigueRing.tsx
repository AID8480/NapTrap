interface Props {
  fatigue: 0 | 1 | 2 | 3;
  rmssd?: number | null;
}

const STROKE_COLORS = ["#4ECDC4", "#FFE66D", "#FF6B6B", "#e74c3c"];

export function FatigueRing({ fatigue }: Props) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  // Fill ring proportional to fatigue level (0=empty, 3=full)
  const fill = fatigue === 0 ? 0.08 : fatigue / 3;
  const dash = circ * fill;
  const color = STROKE_COLORS[fatigue];
  const isPulsing = fatigue >= 3;

  return (
    <div className="relative flex-shrink-0" style={{ width: 104, height: 104 }}>
      {isPulsing && (
        <div
          className="absolute inset-0 rounded-full animate-pulseRing"
          style={{ backgroundColor: color, opacity: 0.3 }}
        />
      )}
      <svg width="104" height="104" className="-rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="52" cy="52" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold" style={{ color }}>{fatigue}</span>
        <span className="text-xs text-gray-400">level</span>
      </div>
    </div>
  );
}
