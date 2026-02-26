/**
 * OTB Chess — Director Access Page
 * Hosts enter their private director code here to unlock the Director Dashboard.
 * This page is intentionally separate from the player Join page to make the
 * distinction between director and player access clear.
 *
 * Route: /director-access
 * After successful validation: redirects to /tournament/:id/manage
 */
import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  resolveByDirectorCode,
  grantDirectorSession,
} from "@/lib/tournamentRegistry";
import {
  Shield,
  Crown,
  AlertCircle,
  Loader2,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

export default function DirectorAccessPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();

  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  // Style tokens
  const bg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/45" : "text-gray-400";
  const cardBg = isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100";
  const inputBg = isDark
    ? "bg-[oklch(0.26_0.06_145)] border-white/12 text-white placeholder:text-white/25 focus:border-[#4CAF50] focus:shadow-[0_0_0_3px_oklch(0.55_0.13_145/0.20)]"
    : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-300 focus:border-[#3D6B47] focus:shadow-[0_0_0_3px_oklch(0.44_0.12_145/0.10)]";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setStatus("loading");
    setError("");

    // Simulate a brief validation delay for UX polish
    await new Promise((r) => setTimeout(r, 600));

    const config = resolveByDirectorCode(trimmed);
    if (!config) {
      setStatus("error");
      setError("Invalid director code. Check the code from your tournament setup email or the Share step in the wizard.");
      return;
    }

    // Grant director session on this device and navigate to the dashboard
    grantDirectorSession(config.id);
    setStatus("idle");
    navigate(`/tournament/${config.id}/manage`);
  }

  return (
    <div className={`min-h-screen ${bg} flex flex-col transition-colors duration-300`}
      style={{ WebkitTapHighlightColor: "transparent" }}>

      {/* Header */}
      <header className={`flex items-center justify-between px-4 pt-4 pb-3 border-b ${
        isDark ? "border-white/06 bg-[oklch(0.18_0.05_145)]" : "border-gray-100 bg-[#F7FAF8]"
      }`}>
        <Link href="/">
          <span className={`text-lg font-black tracking-tight cursor-pointer ${
            isDark ? "text-white" : "text-gray-900"
          }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            OTB!!
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/join">
            <button className={`text-sm font-medium px-3 py-1.5 rounded-xl transition-colors ${
              isDark
                ? "text-white/60 hover:text-white hover:bg-white/06"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}>
              Join as Player
            </button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">

          {/* Hero */}
          <div className="text-center">
            <div className={`w-18 h-18 w-[72px] h-[72px] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl ${
              isDark
                ? "bg-amber-500/20 shadow-amber-500/20"
                : "bg-amber-50 shadow-amber-200/60"
            }`}>
              <Shield className={`w-9 h-9 ${isDark ? "text-amber-400" : "text-amber-600"}`} strokeWidth={1.5} />
            </div>
            <h1 className={`text-2xl font-bold tracking-tight ${textMain}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Director Access
            </h1>
            <p className={`text-sm mt-2 leading-relaxed ${textMuted}`}>
              Enter your private director code to manage your tournament.
              This code was shown in the final step of the tournament wizard.
            </p>
          </div>

          {/* Code entry card */}
          <div className={`rounded-3xl border p-6 space-y-4 ${cardBg}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Code input */}
              <div className="space-y-2">
                <label className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                  Director Code
                </label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    isDark ? "text-white/25" : "text-gray-300"
                  }`} />
                  <input
                    ref={inputRef}
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      if (status === "error") setStatus("idle");
                    }}
                    placeholder="DIR-XXXXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className={`w-full rounded-2xl border pl-11 pr-12 py-4 text-base font-mono font-semibold tracking-widest outline-none transition-all duration-200 ${inputBg}`}
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode((v) => !v)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
                      isDark ? "text-white/30 hover:text-white/60" : "text-gray-300 hover:text-gray-500"
                    }`}
                    tabIndex={-1}
                  >
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {status === "error" && (
                <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${
                  isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-100"
                }`}>
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className={isDark ? "text-red-300" : "text-red-600"}>{error}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!code.trim() || status === "loading"}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all duration-200 ${
                  !code.trim() || status === "loading"
                    ? isDark ? "bg-white/08 text-white/25 cursor-not-allowed" : "bg-gray-100 text-gray-300 cursor-not-allowed"
                    : "bg-[#3D6B47] text-white hover:bg-[#2d5235] active:scale-[0.98] shadow-lg shadow-[#3D6B47]/25"
                }`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {status === "loading" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Crown className="w-5 h-5" strokeWidth={1.5} />
                    Access Director Dashboard
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Privacy note */}
          <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-xs ${
            isDark
              ? "bg-amber-500/08 border border-amber-500/15"
              : "bg-amber-50 border border-amber-100"
          }`}>
            <Shield className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
              isDark ? "text-amber-400" : "text-amber-600"
            }`} />
            <p className={isDark ? "text-amber-300/70" : "text-amber-700"}>
              <strong>Keep this code private.</strong> Anyone with your director code can manage the tournament, enter results, and generate pairings.
            </p>
          </div>

          {/* Player join link */}
          <p className={`text-center text-sm ${textMuted}`}>
            Are you a player?{" "}
            <Link href="/join">
              <span className={`font-semibold cursor-pointer ${
                isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
              }`}>
                Join a tournament →
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
