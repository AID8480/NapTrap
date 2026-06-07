import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useSessionStore } from "../../store/sessionStore";
import { ClayButton } from "../ui/ClayButton";

const ALERT_MESSAGES = [
  "You're doing great! Stay alert.",
  "Mild fatigue detected. Consider a short break.",
  "Moderate fatigue. Please pull over soon.",
  "Severe fatigue! Pull over and rest immediately.",
];

export function FullScreenAlert() {
  const { alertFatigueLevel, dismissAlert } = useSessionStore();

  useEffect(() => {
    // Generate a simple beep using Web Audio API
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch {}
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-600/95 backdrop-blur-sm text-white p-6 text-center">
      {/* Pulsing ring */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-white/20 animate-pulseRing absolute inset-0" />
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center relative z-10">
          <AlertTriangle className="w-12 h-12 text-white" />
        </div>
      </div>

      <h2 className="text-3xl font-extrabold mb-3">Fatigue Alert</h2>
      <p className="text-lg font-medium mb-2 max-w-xs">
        {ALERT_MESSAGES[alertFatigueLevel]}
      </p>
      <p className="text-sm text-white/70 mb-8">
        Level {alertFatigueLevel} fatigue detected while driving
      </p>

      <ClayButton
        colorClass="bg-white text-red-600 text-base font-bold px-8 py-4"
        onClick={dismissAlert}
      >
        I'm pulling over
      </ClayButton>
    </div>
  );
}
