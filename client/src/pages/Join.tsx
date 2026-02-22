/*
 * OTB Chess — Player Join Page
 * Design: Mobile-first, Apple-minimalist, chess.com green/white
 * Philosophy: Frictionless — scan QR → enter username → see ELO → confirm. 3 taps max.
 * Layout: Centered single-column card, full-bleed on mobile
 * Steps:
 *   1. Enter tournament code (pre-filled from URL param)
 *   2. Enter chess.com username → live ELO fetch
 *   3. Confirm registration → success screen with board assignment
 */

import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEMO_TOURNAMENT } from "@/lib/tournamentData";
import {
  Crown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  User,
  Hash,
  Trophy,
  Clock,
  MapPin,
  Users,
  ArrowRight,
  Sparkles,
  Shield,
  Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChessProfile {
  username: string;
  name?: string;
  avatar?: string;
  elo: number;
  rapid: number;
  blitz: number;
  bullet: number;
  country?: string;
  title?: string;
  joined?: number;
  status: "online" | "offline";
}

type Step = "code" | "username" | "confirm" | "success";

// ─── ELO tier helper ─────────────────────────────────────────────────────────
function eloTier(elo: number): { label: string; color: string; bg: string } {
  if (elo >= 2500) return { label: "Grandmaster", color: "text-purple-600", bg: "bg-purple-50" };
  if (elo >= 2300) return { label: "International Master", color: "text-purple-500", bg: "bg-purple-50" };
  if (elo >= 2200) return { label: "FIDE Master", color: "text-indigo-600", bg: "bg-indigo-50" };
  if (elo >= 2000) return { label: "Expert", color: "text-amber-600", bg: "bg-amber-50" };
  if (elo >= 1800) return { label: "Class A", color: "text-sky-600", bg: "bg-sky-50" };
  if (elo >= 1600) return { label: "Class B", color: "text-teal-600", bg: "bg-teal-50" };
  if (elo >= 1400) return { label: "Class C", color: "text-green-600", bg: "bg-green-50" };
  return { label: "Beginner", color: "text-gray-500", bg: "bg-gray-100" };
}

function eloTierDark(elo: number): { label: string; color: string; bg: string } {
  if (elo >= 2500) return { label: "Grandmaster", color: "text-purple-400", bg: "bg-purple-900/30" };
  if (elo >= 2300) return { label: "International Master", color: "text-purple-400", bg: "bg-purple-900/20" };
  if (elo >= 2200) return { label: "FIDE Master", color: "text-indigo-400", bg: "bg-indigo-900/30" };
  if (elo >= 2000) return { label: "Expert", color: "text-amber-400", bg: "bg-amber-900/30" };
  if (elo >= 1800) return { label: "Class A", color: "text-sky-400", bg: "bg-sky-900/30" };
  if (elo >= 1600) return { label: "Class B", color: "text-teal-400", bg: "bg-teal-900/30" };
  if (elo >= 1400) return { label: "Class C", color: "text-green-400", bg: "bg-green-900/30" };
  return { label: "Beginner", color: "text-gray-400", bg: "bg-gray-800" };
}

// ─── Mock chess.com API fetch ─────────────────────────────────────────────────
// In production this would call the chess.com public API:
// GET https://api.chess.com/pub/player/{username}
// GET https://api.chess.com/pub/player/{username}/stats
async function fetchChessProfile(username: string): Promise<ChessProfile> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));

  const lower = username.toLowerCase().trim();

  // Known demo profiles
  const profiles: Record<string, ChessProfile> = {
    hikaru: { username: "Hikaru", name: "Hikaru Nakamura", elo: 3268, rapid: 3268, blitz: 3268, bullet: 3400, title: "GM", status: "online", country: "US" },
    gothamchess: { username: "GothamChess", name: "Levy Rozman", elo: 2492, rapid: 2492, blitz: 2550, bullet: 2480, title: "IM", status: "offline", country: "US" },
    magnuscarlsen: { username: "MagnusCarlsen", name: "Magnus Carlsen", elo: 2882, rapid: 2882, blitz: 2900, bullet: 2850, title: "GM", status: "offline", country: "NO" },
    danielnaroditsky: { username: "DanielNaroditsky", name: "Daniel Naroditsky", elo: 3100, rapid: 3100, blitz: 3150, bullet: 3050, title: "GM", status: "online", country: "US" },
    fabianocaruana: { username: "FabianoCaruana", name: "Fabiano Caruana", elo: 2805, rapid: 2805, blitz: 2820, bullet: 2780, title: "GM", status: "offline", country: "US" },
  };

  if (profiles[lower]) return profiles[lower];

  // For any other username, generate a plausible profile
  if (lower.length < 3) throw new Error("Username not found");

  // Deterministic ELO from username hash
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = (hash * 31 + lower.charCodeAt(i)) & 0xffff;
  const elo = 800 + (hash % 1400);

  return {
    username: username,
    elo,
    rapid: elo,
    blitz: elo - 50 + Math.floor(Math.random() * 100),
    bullet: elo - 100 + Math.floor(Math.random() * 150),
    status: Math.random() > 0.5 ? "online" : "offline",
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ step, isDark }: { step: Step; isDark: boolean }) {
  const steps: Step[] = ["code", "username", "confirm", "success"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 justify-center">
      {steps.slice(0, 3).map((s, i) => (
        <div
          key={s}
          className={`rounded-full transition-all duration-300 ${
            i < idx
              ? "w-2 h-2 bg-[#3D6B47]"
              : i === idx
              ? "w-6 h-2 bg-[#3D6B47]"
              : isDark
              ? "w-2 h-2 bg-white/15"
              : "w-2 h-2 bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const { code: urlCode } = useParams<{ code: string }>();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [step, setStep] = useState<Step>(urlCode ? "username" : "code");
  const [tournamentCode, setTournamentCode] = useState(urlCode ?? "");
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<ChessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registeredBoard, setRegisteredBoard] = useState<number | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Auto-focus username input when step changes
  useEffect(() => {
    if (step === "username") {
      setTimeout(() => usernameRef.current?.focus(), 300);
    }
  }, [step]);

  // Tournament info (in production, fetched by code)
  const tournament = DEMO_TOURNAMENT;
  const isValidCode = tournamentCode.toUpperCase() === "OTB2026" || tournamentCode.length >= 4;

  // ── Step 1: Code entry ──────────────────────────────────────────────────────
  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCode) {
      setError("Invalid tournament code. Please check with your host.");
      return;
    }
    setError("");
    setStep("username");
  }

  // ── Step 2: Username lookup ─────────────────────────────────────────────────
  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    try {
      const p = await fetchChessProfile(username.trim());
      setProfile(p);
      setStep("confirm");
    } catch {
      setError("Username not found on chess.com. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Confirm registration ────────────────────────────────────────────
  async function handleConfirm() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    const board = Math.floor(Math.random() * 8) + 1;
    setRegisteredBoard(board);
    setLoading(false);
    setStep("success");
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]";
  const card = isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100";
  const inputCls = isDark
    ? "bg-[oklch(0.26_0.06_145)] border-white/12 text-white placeholder-white/25 focus:border-[#4CAF50] focus:ring-[#4CAF50]/20"
    : "bg-white border-gray-200 text-gray-900 placeholder-gray-300 focus:border-[#3D6B47] focus:ring-[#3D6B47]/10";
  const labelCls = isDark ? "text-white/50" : "text-gray-500";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bg} flex flex-col`}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className={`flex items-center justify-between px-4 py-3 ${isDark ? "border-b border-white/06" : "border-b border-gray-100/80"}`}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#3D6B47] rounded-md flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </div>
          <span
            className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            OTB Chess
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-5">

          {/* ── Tournament info banner ─────────────────────────────────────── */}
          {step !== "code" && step !== "success" && (
            <div
              className={`rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-all duration-300 ${
                isDark ? "bg-[#3D6B47]/15 border-[#4CAF50]/20" : "bg-[#3D6B47]/06 border-[#3D6B47]/15"
              }`}
            >
              <div className="w-9 h-9 bg-[#3D6B47] rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4.5 h-4.5 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-bold text-sm truncate ${isDark ? "text-white" : "text-gray-900"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {tournament.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <MapPin className="w-3 h-3" /> {tournament.venue}
                  </span>
                  <span className={`text-xs ${isDark ? "text-white/20" : "text-gray-200"}`}>·</span>
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <Clock className="w-3 h-3" /> {tournament.timeControl}
                  </span>
                  <span className={`text-xs ${isDark ? "text-white/20" : "text-gray-200"}`}>·</span>
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <Users className="w-3 h-3" /> {tournament.players.length} registered
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step dots ─────────────────────────────────────────────────── */}
          {step !== "success" && <StepDots step={step} isDark={isDark} />}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 1 — Enter tournament code
          ══════════════════════════════════════════════════════════════════ */}
          {step === "code" && (
            <div className={`rounded-2xl border p-6 shadow-sm ${card}`}>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-[#3D6B47] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#3D6B47]/25">
                  <Crown className="w-7 h-7 text-white" strokeWidth={1.5} />
                </div>
                <h1
                  className={`text-2xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Join Tournament
                </h1>
                <p className={`text-sm mt-1.5 ${textMuted}`}>
                  Enter the code from your host or scan their QR code
                </p>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>
                    Tournament Code
                  </label>
                  <div className="relative">
                    <Hash className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
                    <input
                      type="text"
                      value={tournamentCode}
                      onChange={(e) => { setTournamentCode(e.target.value.toUpperCase()); setError(""); }}
                      placeholder="e.g. OTB2026"
                      maxLength={12}
                      className={`w-full pl-10 pr-4 py-3.5 rounded-xl border text-sm font-mono font-bold tracking-widest uppercase transition-all outline-none focus:ring-2 ${inputCls}`}
                      autoFocus
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!tournamentCode.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3D6B47] text-white font-semibold rounded-xl transition-all duration-200 hover:bg-[#2A4A32] disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#3D6B47]/30 active:translate-y-0"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>

                <p className={`text-center text-xs ${textMuted}`}>
                  Don't have a code?{" "}
                  <button
                    type="button"
                    onClick={() => { setTournamentCode("OTB2026"); setError(""); }}
                    className={`font-semibold underline underline-offset-2 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
                  >
                    Try the demo
                  </button>
                </p>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 2 — Enter chess.com username
          ══════════════════════════════════════════════════════════════════ */}
          {step === "username" && (
            <div className={`rounded-2xl border p-6 shadow-sm ${card}`}>
              <div className="mb-6">
                <h2
                  className={`text-xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  Your chess.com username
                </h2>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  We'll pull your ELO rating and set up your pairing automatically.
                </p>
              </div>

              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>
                    Username
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
                    <input
                      ref={usernameRef}
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      placeholder="e.g. hikaru"
                      className={`w-full pl-10 pr-4 py-3.5 rounded-xl border text-sm transition-all outline-none focus:ring-2 ${inputCls}`}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className={`text-xs ${textMuted}`}>
                    Try: hikaru · gothamchess · magnuscarlsen
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!username.trim() || loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3D6B47] text-white font-semibold rounded-xl transition-all duration-200 hover:bg-[#2A4A32] disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#3D6B47]/30 active:translate-y-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Looking up profile…
                    </>
                  ) : (
                    <>
                      Look up my ELO
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {!urlCode && (
                  <button
                    type="button"
                    onClick={() => { setStep("code"); setError(""); }}
                    className={`w-full text-xs py-2 ${textMuted} hover:underline`}
                  >
                    ← Change tournament code
                  </button>
                )}
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 3 — Confirm registration
          ══════════════════════════════════════════════════════════════════ */}
          {step === "confirm" && profile && (
            <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
              {/* Profile header */}
              <div className={`px-6 pt-6 pb-5 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#3D6B47]/15 flex items-center justify-center overflow-hidden">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                      ) : (
                        <span
                          className="text-2xl font-bold text-[#3D6B47]"
                          style={{ fontFamily: "'Clash Display', sans-serif" }}
                        >
                          {profile.username[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                        isDark ? "border-[oklch(0.22_0.06_145)]" : "border-white"
                      } ${profile.status === "online" ? "bg-emerald-400" : "bg-gray-300"}`}
                    />
                  </div>

                  {/* Name + title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-bold text-lg leading-tight ${textMain}`}
                        style={{ fontFamily: "'Clash Display', sans-serif" }}
                      >
                        {profile.name ?? profile.username}
                      </span>
                      {profile.title && (
                        <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-2 py-0.5 rounded-md">
                          {profile.title}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${textMuted}`}>@{profile.username}</p>
                  </div>
                </div>

                {/* ELO display */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "Rapid", val: profile.rapid },
                    { label: "Blitz", val: profile.blitz },
                    { label: "Bullet", val: profile.bullet },
                  ].map(({ label, val }) => {
                    const tier = isDark ? eloTierDark(val) : eloTier(val);
                    return (
                      <div
                        key={label}
                        className={`rounded-xl px-3 py-2.5 text-center ${
                          label === "Rapid"
                            ? isDark ? "bg-[#3D6B47]/20 ring-1 ring-[#4CAF50]/30" : "bg-[#3D6B47]/08 ring-1 ring-[#3D6B47]/20"
                            : isDark ? "bg-white/05" : "bg-gray-50"
                        }`}
                      >
                        <p className={`text-xl font-bold tabular-nums ${label === "Rapid" ? (isDark ? "text-[#4CAF50]" : "text-[#3D6B47]") : textMain}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          {val}
                        </p>
                        <p className={`text-xs font-medium mt-0.5 ${textMuted}`}>{label}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Tier badge */}
                {(() => {
                  const tier = isDark ? eloTierDark(profile.rapid) : eloTier(profile.rapid);
                  return (
                    <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${tier.bg} ${tier.color}`}>
                      <Star className="w-3 h-3" />
                      {tier.label}
                    </div>
                  );
                })()}
              </div>

              {/* Confirmation details */}
              <div className="px-6 py-4 space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>
                  Registering for
                </p>
                <div className={`rounded-xl px-4 py-3 space-y-2 ${isDark ? "bg-white/04" : "bg-gray-50"}`}>
                  {[
                    { icon: Trophy, text: tournament.name },
                    { icon: MapPin, text: tournament.venue },
                    { icon: Clock, text: `${tournament.timeControl} · ${tournament.format}` },
                    { icon: Users, text: `${tournament.players.length} players registered` },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                      <span className={`text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6 space-y-3">
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3D6B47] text-white font-semibold rounded-xl transition-all duration-200 hover:bg-[#2A4A32] disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#3D6B47]/30 active:translate-y-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm Registration
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("username"); setProfile(null); setError(""); }}
                  className={`w-full text-xs py-2 ${textMuted} hover:underline`}
                >
                  ← Use a different username
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 4 — Success!
          ══════════════════════════════════════════════════════════════════ */}
          {step === "success" && profile && (
            <div className="space-y-4">
              {/* Confetti-style header */}
              <div className="text-center py-2">
                <div className="relative inline-block">
                  <div className="w-20 h-20 bg-[#3D6B47] rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-[#3D6B47]/30">
                    <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <h2
                  className={`text-2xl font-bold mt-4 ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  You're in!
                </h2>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  Registration confirmed for{" "}
                  <span className={isDark ? "text-[#4CAF50] font-medium" : "text-[#3D6B47] font-medium"}>
                    {profile.name ?? profile.username}
                  </span>
                </p>
              </div>

              {/* Registration card */}
              <div className={`rounded-2xl border overflow-hidden ${card}`}>
                {/* Green accent */}
                <div className="h-1 bg-gradient-to-r from-[#3D6B47] via-[#4CAF50] to-[#3D6B47]" />
                <div className="p-5 space-y-4">
                  {/* Player + ELO */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#3D6B47]/15 flex items-center justify-center">
                        <span className="text-lg font-bold text-[#3D6B47]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          {profile.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          {profile.name ?? profile.username}
                        </p>
                        <p className={`text-xs ${textMuted}`}>@{profile.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold tabular-nums ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
                        style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        {profile.rapid}
                      </p>
                      <p className={`text-xs ${textMuted}`}>Rapid ELO</p>
                    </div>
                  </div>

                  <div className={`h-px ${isDark ? "bg-white/08" : "bg-gray-100"}`} />

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Tournament", value: tournament.name, span: true },
                      { label: "Format", value: tournament.format },
                      { label: "Time Control", value: tournament.timeControl },
                      { label: "Venue", value: tournament.venue, span: true },
                      { label: "Round 1", value: tournament.date },
                      { label: "Players", value: `${tournament.players.length + 1} registered` },
                    ].map(({ label, value, span }) => (
                      <div key={label} className={span ? "col-span-2" : ""}>
                        <p className={`text-xs ${labelCls} mb-0.5`}>{label}</p>
                        <p className={`text-sm font-semibold ${textMain}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className={`h-px ${isDark ? "bg-white/08" : "bg-gray-100"}`} />

                  {/* What's next */}
                  <div className={`rounded-xl px-4 py-3 ${isDark ? "bg-[#3D6B47]/15" : "bg-[#3D6B47]/06"}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                      What's next
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        "Show up at the venue before Round 1 starts",
                        "The director will announce pairings — check the board list",
                        "Your first opponent will be matched by ELO proximity",
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                            {i + 1}.
                          </span>
                          <span className={`text-xs ${isDark ? "text-white/60" : "text-gray-600"}`}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <Link
                  href="/tournament/otb-demo-2026"
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#3D6B47] text-white font-semibold rounded-xl transition-all duration-200 hover:bg-[#2A4A32] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#3D6B47]/30 text-sm"
                >
                  <Trophy className="w-4 h-4" />
                  View Tournament Standings
                </Link>
                <Link
                  href="/"
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors ${
                    isDark
                      ? "border-white/10 text-white/60 hover:bg-white/05"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Back to OTB Chess
                </Link>
              </div>

              <p className={`text-center text-xs ${textMuted}`}>
                A confirmation has been sent to the tournament director.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom branding ──────────────────────────────────────────────────── */}
      <div className={`text-center py-4 text-xs ${textMuted}`}>
        <Link href="/" className="flex items-center justify-center gap-1.5 hover:opacity-70 transition-opacity">
          <Crown className="w-3 h-3" />
          Powered by OTB Chess
        </Link>
      </div>
    </div>
  );
}
