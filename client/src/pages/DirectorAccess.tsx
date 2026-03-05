/**
 * OTB Chess — Director Access Page
 * Hosts enter their private director code here to unlock the Director Dashboard.
 * A "Forgot your code?" modal lists all tournaments created on this device
 * and reveals their director codes — no email or server required.
 *
 * Route: /director-access
 * After successful validation: redirects to /tournament/:id/manage
 */
import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  resolveByDirectorCode,
  grantDirectorSession,
  listTournaments,
  type TournamentConfig,
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
  HelpCircle,
  X,
  Copy,
  Check,
  CalendarDays,
  Trophy,
} from "lucide-react";

export default function DirectorAccessPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, navigate] = useLocation();

  // Main code entry state
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Forgot code modal state
  const [showForgot, setShowForgot] = useState(false);
  const [myTournaments, setMyTournaments] = useState<TournamentConfig[]>([]);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  function openForgotModal() {
    setMyTournaments(listTournaments());
    setRevealedIds(new Set());
    setCopiedId(null);
    setShowForgot(true);
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyCode(t: TournamentConfig) {
    try {
      await navigator.clipboard.writeText(t.directorCode);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback: fill the main input
    }
  }

  function useThisCode(t: TournamentConfig) {
    setCode(t.directorCode);
    setShowForgot(false);
    setShowCode(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

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

    await new Promise((r) => setTimeout(r, 600));

    const config = resolveByDirectorCode(trimmed);
    if (!config) {
      setStatus("error");
      setError("Invalid director code. Use the \"Forgot your code?\" link below to find it.");
      return;
    }

    grantDirectorSession(config.id);
    setStatus("idle");
    navigate(`/tournament/${config.id}/manage`);
  }

  return (
    <div
      className={`min-h-screen ${bg} flex flex-col transition-colors duration-300`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Header */}
      <header className={`flex items-center justify-between px-4 pt-4 pb-3 border-b ${
        isDark ? "border-white/06 bg-[oklch(0.18_0.05_145)]" : "border-gray-100 bg-[#F7FAF8]"
      }`}>
        <NavLogo />
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
            <div className={`w-[72px] h-[72px] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl ${
              isDark ? "bg-amber-500/20 shadow-amber-500/20" : "bg-amber-50 shadow-amber-200/60"
            }`}>
              <Shield className={`w-9 h-9 ${isDark ? "text-amber-400" : "text-amber-600"}`} strokeWidth={1.5} />
            </div>
            <h1
              className={`text-2xl font-bold tracking-tight ${textMain}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
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

              {status === "error" && (
                <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${
                  isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-100"
                }`}>
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className={isDark ? "text-red-300" : "text-red-600"}>{error}</p>
                </div>
              )}

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

          {/* Forgot code link */}
          <div className="text-center">
            <button
              onClick={openForgotModal}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                isDark
                  ? "text-white/40 hover:text-white/70"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Forgot your director code?
            </button>
          </div>

          {/* Privacy note */}
          <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-xs ${
            isDark ? "bg-amber-500/08 border border-amber-500/15" : "bg-amber-50 border border-amber-100"
          }`}>
            <Shield className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
            <p className={isDark ? "text-amber-300/70" : "text-amber-700"}>
              <strong>Keep this code private.</strong> Anyone with your director code can manage the tournament, enter results, and generate pairings.
            </p>
          </div>

          {/* Player join link */}
          <p className={`text-center text-sm ${textMuted}`}>
            Are you a player?{" "}
            <Link href="/join">
              <span className={`font-semibold cursor-pointer ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                Join a tournament →
              </span>
            </Link>
          </p>
        </div>
      </div>

      {/* ── Forgot Code Modal ─────────────────────────────────────────────────── */}
      {showForgot && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForgot(false); }}
        >
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${cardBg}`}
            style={{ animation: "slideUpModal 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}
          >
            {/* Modal header */}
            <div className={`flex items-center justify-between px-6 py-5 border-b ${
              isDark ? "border-white/08" : "border-gray-100"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                  isDark ? "bg-amber-500/20" : "bg-amber-50"
                }`}>
                  <HelpCircle className={`w-4.5 h-4.5 w-[18px] h-[18px] ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                </div>
                <div>
                  <h2 className={`text-base font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    Your Tournaments
                  </h2>
                  <p className={`text-xs ${textMuted}`}>Tournaments created on this device</p>
                </div>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isDark ? "hover:bg-white/08 text-white/40" : "hover:bg-gray-100 text-gray-400"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tournament list */}
            <div className="px-4 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {myTournaments.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className={`w-14 h-14 rounded-3xl flex items-center justify-center mx-auto ${
                    isDark ? "bg-white/06" : "bg-gray-50"
                  }`}>
                    <Trophy className={`w-6 h-6 ${isDark ? "text-white/20" : "text-gray-300"}`} />
                  </div>
                  <p className={`text-sm font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    No tournaments found on this device
                  </p>
                  <p className={`text-xs ${isDark ? "text-white/25" : "text-gray-300"}`}>
                    Director codes are only stored on the device used to create the tournament.
                  </p>
                </div>
              ) : (
                myTournaments.map((t) => {
                  const isRevealed = revealedIds.has(t.id);
                  const isCopied = copiedId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                        isDark ? "bg-[oklch(0.26_0.06_145)] border-white/08" : "bg-gray-50 border-gray-100"
                      }`}
                    >
                      {/* Tournament name + date */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${textMain}`}>{t.name}</p>
                          <div className={`flex items-center gap-1 mt-0.5 text-xs ${textMuted}`}>
                            <CalendarDays className="w-3 h-3 flex-shrink-0" />
                            <span>{t.date}</span>
                            {t.venue && <span>· {t.venue}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => useThisCode(t)}
                          className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-xl transition-colors ${
                            isDark
                              ? "bg-[#4CAF50]/15 text-[#4CAF50] hover:bg-[#4CAF50]/25"
                              : "bg-[#3D6B47]/10 text-[#3D6B47] hover:bg-[#3D6B47]/20"
                          }`}
                        >
                          Use this
                        </button>
                      </div>

                      {/* Director code row */}
                      <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${
                        isDark ? "bg-black/20" : "bg-white"
                      }`}>
                        <span className={`flex-1 font-mono text-sm font-semibold tracking-widest ${
                          isRevealed
                            ? isDark ? "text-amber-300" : "text-amber-700"
                            : isDark ? "text-white/20" : "text-gray-200"
                        }`}>
                          {isRevealed ? t.directorCode : "DIR-••••••"}
                        </span>
                        <button
                          onClick={() => toggleReveal(t.id)}
                          className={`p-1 rounded-lg transition-colors ${
                            isDark ? "text-white/30 hover:text-white/60" : "text-gray-300 hover:text-gray-500"
                          }`}
                          title={isRevealed ? "Hide code" : "Reveal code"}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {isRevealed && (
                          <button
                            onClick={() => copyCode(t)}
                            className={`p-1 rounded-lg transition-colors ${
                              isCopied
                                ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                                : isDark ? "text-white/30 hover:text-white/60" : "text-gray-300 hover:text-gray-500"
                            }`}
                            title="Copy code"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal footer */}
            <div className={`px-6 py-4 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
              <p className={`text-xs text-center ${isDark ? "text-white/25" : "text-gray-300"}`}>
                Director codes are stored locally on this device only.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpModal {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
