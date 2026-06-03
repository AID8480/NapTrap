import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSessionStore } from "../store/sessionStore";
import { BaselineModule, type BaselineModuleHandle } from "../components/baseline/BaselineModule";
import { LiveSessionModule } from "../components/session/LiveSessionModule";
import { FusionModule } from "../components/fusion/FusionModule";
import { HistoryModule } from "../components/history/HistoryModule";
import { TestSensorModal } from "../components/session/TestSensorModal";
import { ClayButton } from "../components/ui/ClayButton";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const demo = params.get("demo") === "true";
  const { setDemoMode, sensorConnected } = useSessionStore();
  const [hasBaseline, setHasBaseline] = useState<boolean | null>(null);
  const [showTestSensor, setShowTestSensor] = useState(false);
  const baselineRef = useRef<BaselineModuleHandle | null>(null);

  useEffect(() => { setDemoMode(demo); }, [demo]);

  const { sendAck, sendDismiss } = useWebSocket(user?.id ?? null, demo, hasBaseline === true);

  const toggleDemo = () => {
    if (demo) {
      params.delete("demo");
    } else {
      params.set("demo", "true");
    }
    setParams(params);
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-sky-light via-lavender-light to-mint-light">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-md border-b border-white/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">😴</span>
            <span className="font-extrabold text-gray-800 text-lg">NapTrap</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Sensor connection indicator — hidden in demo mode */}
            {!demo && (
              <span
                title={sensorConnected ? "Sensor connected" : "No sensor connected"}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  sensorConnected
                    ? "bg-mint/20 text-mint-dark"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${sensorConnected ? "bg-mint-dark" : "bg-gray-300"}`} />
                {sensorConnected ? "Sensor" : "No sensor"}
              </span>
            )}
            {!demo && (
              <ClayButton variant="ghost" className="text-xs" onClick={() => setShowTestSensor(true)}>
                Test Sensor
              </ClayButton>
            )}
            {demo && (
              <span className="text-xs font-bold bg-lemon text-gray-700 px-3 py-1 rounded-full clay-shadow-btn">
                DEMO
              </span>
            )}
            <ClayButton
              variant="ghost"
              onClick={toggleDemo}
              className="text-xs"
            >
              {demo ? "Exit Demo" : "Demo Mode"}
            </ClayButton>
            <ClayButton variant="ghost" onClick={handleLogout} className="text-xs">
              Sign out
            </ClayButton>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* No-baseline warning banner */}
        {hasBaseline === false && (
          <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 text-sm font-semibold text-amber-800">
              ⚠️ No Baseline set yet. Please upload sleep data or perform a resting measurement first.
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => baselineRef.current?.openUpload()}
                className="rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-900 text-xs font-bold px-4 py-2 transition-colors"
              >
                Upload Sleep Data
              </button>
              <button
                onClick={() => baselineRef.current?.openMeasure()}
                className="rounded-xl bg-white border-2 border-amber-300 hover:border-amber-400 text-amber-800 text-xs font-bold px-4 py-2 transition-colors"
              >
                Measure Now
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div id="baseline-module">
            <BaselineModule ref={baselineRef} onBaselineChange={setHasBaseline} demo={demo} />
          </div>
          <LiveSessionModule onAck={sendAck} onDismiss={sendDismiss} hasBaseline={hasBaseline ?? true} />
        </div>
        <FusionModule hasBaseline={hasBaseline ?? true} />
        <HistoryModule />
      </main>
    </div>

    {showTestSensor && <TestSensorModal onClose={() => setShowTestSensor(false)} />}
    </>
  );
}
