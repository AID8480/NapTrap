import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClayCard } from "../components/ui/ClayCard";
import { ClayButton } from "../components/ui/ClayButton";
import { AmbientBlobs } from "../components/layout/AmbientBlobs";
import { login as apiLogin, register as apiRegister } from "../api/auth";
import { useAuth } from "../hooks/useAuth";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = mode === "login" ? apiLogin : apiRegister;
      const res = await fn(email, password);
      login(res.data.access_token);
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-coral-light via-lemon-light to-mint-light flex items-center justify-center p-4 relative overflow-hidden">
      <AmbientBlobs blobs={[
        { color: "bg-coral", size: "w-72 h-72", top: "-10%", left: "-5%", delay: "0s" },
        { color: "bg-mint", size: "w-64 h-64", top: "60%", left: "70%", delay: "2s" },
        { color: "bg-lemon", size: "w-48 h-48", top: "40%", left: "10%", delay: "4s" },
      ]} />

      <ClayCard className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-sm p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">😴</div>
          <h1 className="text-2xl font-bold text-gray-800">NapTrap</h1>
          <p className="text-gray-500 text-sm mt-1">Driver fatigue detection</p>
        </div>

        <div className="flex rounded-2xl bg-gray-100 p-1 mb-6">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                mode === m ? "bg-white clay-shadow text-gray-800" : "text-gray-500"
              }`}
            >
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-coral/40 transition"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-coral/40 transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <ClayButton
            type="submit"
            disabled={loading}
            colorClass="bg-coral text-white w-full justify-center"
            className="w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </ClayButton>
        </form>
      </ClayCard>
    </div>
  );
}
