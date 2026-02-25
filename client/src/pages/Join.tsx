/*
 * OTB Chess — Player Join Page
 * Mobile-first design: primary touchpoint for in-person tournament registration
 *
 * Mobile Design Principles Applied:
 * - Bottom-anchored CTAs: thumb-reachable, fixed to viewport bottom
 * - Safe area insets: iOS notch + home indicator respected
 * - 52px minimum touch targets: no missed taps
 * - Spring animations: native-feel step transitions (springIn, slideUpFade)
 * - Font-size 16px+ on inputs: prevents iOS auto-zoom
 * - Scroll-locked step cards: content above, CTA always visible below
 * - Haptic-feel active states: scale(0.97) on press
 * - Social share sheet: native Web Share API with fallback
 */

import { useState, useRef, useEffect } from "react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useCountUp } from "@/hooks/useCountUp";
import { useChessComProfile } from "@/hooks/useChessComProfile";
import { useLichessProfile } from "@/hooks/useLichessProfile";
import { useParams, Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEMO_TOURNAMENT } from "@/lib/tournamentData";
import type { Player } from "@/lib/tournamentData";
import { resolveTournament, type TournamentConfig } from "@/lib/tournamentRegistry";
import { addPlayerToTournament } from "@/lib/directorState";
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
  Star,
  Share2,
  Copy,
  Check,
  Twitter,
  MessageCircle,
  ChevronLeft,
  Phone,
  Mail,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
import type { ChessComProfile } from "@/hooks/useChessComProfile";
import type { LichessProfile } from "@/hooks/useLichessProfile";

/** Unified profile type covering both chess.com and Lichess */
type UnifiedProfile = (ChessComProfile & { platform: "chesscom" }) | LichessProfile;
type Platform = "chesscom" | "lichess";
type Step = "code" | "username" | "confirm" | "success";

function eloTier(elo: number) {
  if (elo >= 2500) return { label: "Grandmaster", color: "text-amber-700", bg: "bg-amber-50 border border-amber-200" };
  if (elo >= 2200) return { label: "Master", color: "text-purple-700", bg: "bg-purple-50 border border-purple-200" };
  if (elo >= 1800) return { label: "Expert", color: "text-blue-700", bg: "bg-blue-50 border border-blue-200" };
  if (elo >= 1400) return { label: "Intermediate", color: "text-[#3D6B47]", bg: "bg-[#3D6B47]/08 border border-[#3D6B47]/20" };
  return { label: "Beginner", color: "text-gray-600", bg: "bg-gray-50 border border-gray-200" };
}

function eloTierDark(elo: number) {
  if (elo >= 2500) return { label: "Grandmaster", color: "text-amber-300", bg: "bg-amber-400/10 border border-amber-400/20" };
  if (elo >= 2200) return { label: "Master", color: "text-purple-300", bg: "bg-purple-400/10 border border-purple-400/20" };
  if (elo >= 1800) return { label: "Expert", color: "text-blue-300", bg: "bg-blue-400/10 border border-blue-400/20" };
  if (elo >= 1400) return { label: "Intermediate", color: "text-[#4CAF50]", bg: "bg-[#4CAF50]/10 border border-[#4CAF50]/20" };
  return { label: "Beginner", color: "text-white/50", bg: "bg-white/05 border border-white/10" };
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepProgress({ step }: { step: Step }) {
  const steps: Step[] = ["code", "username", "confirm", "success"];
  const idx = steps.indexOf(step);
  const pct = step === "success" ? 100 : ((idx) / 3) * 100;

  return (
    <div className="w-full h-0.5 bg-gray-100 dark:bg-white/08 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#3D6B47] rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── ELO Animated Stat Box ────────────────────────────────────────────────────
function EloStatBox({
  label, target, isPrimary, isDark, textMain, textMuted,
}: {
  label: string; target: number; isPrimary: boolean;
  isDark: boolean; textMain: string; textMuted: string;
}) {
  const { displayValue, done } = useCountUp({
    target, duration: isPrimary ? 1600 : 1200, start: 0, easing: "easeOutExpo", trigger: true,
  });
  return (
    <div className={`rounded-2xl px-3 py-3 text-center relative overflow-hidden ${
      isPrimary
        ? isDark ? "bg-[#3D6B47]/20 ring-1 ring-[#4CAF50]/30" : "bg-[#3D6B47]/07 ring-1 ring-[#3D6B47]/18"
        : isDark ? "bg-white/05" : "bg-gray-50"
    }`}>
      {isPrimary && !done && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(61,107,71,0.15) 50%, transparent 100%)",
          animation: "shimmer 1.6s ease-out forwards",
        }} />
      )}
      <p className={`text-2xl font-bold tabular-nums leading-none ${
        isPrimary ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]" : textMain
      }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
        {displayValue}
      </p>
      <p className={`text-xs font-medium mt-1 ${textMuted}`}>{label}</p>
    </div>
  );
}

// ─── Social Share Sheet ───────────────────────────────────────────────────────
function ShareSheet({
  profile, tournament, onClose, isDark,
}: {
  profile: UnifiedProfile; tournament: typeof DEMO_TOURNAMENT;
  onClose: () => void; isDark: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = `Just registered for ${tournament.name} on OTB Chess! 🏆 Playing as @${profile.username} (${profile.rapid} Rapid ELO). See you at the board!`;
  const shareUrl = window.location.href;

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "OTB Chess Tournament", text: shareText, url: shareUrl });
      } catch { /* user cancelled */ }
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const border = isDark ? "border-white/08" : "border-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />

      {/* Sheet */}
      <div
        className={`relative w-full rounded-t-3xl border-t ${bg} ${border} animate-slide-up-fade safe-bottom`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="px-5 pt-2 pb-2">
          <h3 className={`text-base font-bold text-center mb-4 ${textMain}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Share your registration
          </h3>

          {/* Preview card */}
          <div className={`rounded-2xl p-4 mb-4 ${isDark ? "bg-[#3D6B47]/15 border border-[#4CAF50]/15" : "bg-[#3D6B47]/05 border border-[#3D6B47]/12"}`}>
            <p className={`text-sm leading-relaxed ${isDark ? "text-white/80" : "text-gray-700"}`}>
              {shareText}
            </p>
          </div>

          {/* Share actions */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* Native share (mobile) */}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={handleNativeShare}
                className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95 ${
                  isDark ? "bg-white/06 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <Share2 className={`w-5 h-5 ${isDark ? "text-white/70" : "text-gray-600"}`} />
                <span className={`text-xs font-medium ${textMuted}`}>Share</span>
              </button>
            )}

            {/* Twitter/X */}
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank")}
              className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95 ${
                isDark ? "bg-white/06 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <Twitter className={`w-5 h-5 ${isDark ? "text-white/70" : "text-gray-600"}`} />
              <span className={`text-xs font-medium ${textMuted}`}>Twitter</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank")}
              className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95 ${
                isDark ? "bg-white/06 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <MessageCircle className={`w-5 h-5 ${isDark ? "text-white/70" : "text-gray-600"}`} />
              <span className={`text-xs font-medium ${textMuted}`}>WhatsApp</span>
            </button>
          </div>

          {/* Copy link */}
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-97 ${
              copied
                ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                : isDark ? "bg-white/08 text-white/80 hover:bg-white/12" : "bg-gray-100 text-gray-700 hover:bg-gray-150"
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy message + link"}
          </button>

          <button
            onClick={onClose}
            className={`w-full mt-2 py-3 text-sm font-medium ${textMuted} active:opacity-60`}
          >
            Cancel
          </button>
        </div>
      </div>
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
  const [platform, setPlatform] = useState<Platform>("chesscom");

  // Both hooks are always mounted; only the active one is called
  const chesscom = useChessComProfile();
  const lichess = useLichessProfile();
  const active = platform === "chesscom" ? chesscom : lichess;
  const lookupStatus = active.status;
  const lookupError = active.error;

  // Unified profile state — normalised from whichever platform was used
  const [unifiedProfile, setUnifiedProfile] = useState<UnifiedProfile | null>(null);
  // Alias for backwards compat with existing JSX that references `profile`
  const profile = unifiedProfile;

  const loading = lookupStatus === "loading";
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [stepKey, setStepKey] = useState(0); // force re-mount for animation
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "username") setTimeout(() => usernameRef.current?.focus(), 350);
    // Scroll to top of content on step change
    setTimeout(() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }, [step]);

  // Resolve the real tournament config from the registry (by invite code or slug)
  // Falls back to DEMO_TOURNAMENT for the demo code
  const resolvedConfig: TournamentConfig | null = tournamentCode
    ? resolveTournament(tournamentCode)
    : null;
  const isDemoCode = tournamentCode.toUpperCase() === "OTB2026";
  // Display name/venue/format/timeControl for the tournament chip and success card
  const tournamentDisplay = {
    name: resolvedConfig?.name ?? DEMO_TOURNAMENT.name,
    venue: resolvedConfig?.venue ?? DEMO_TOURNAMENT.venue,
    format: resolvedConfig
      ? (resolvedConfig.format === "swiss" ? "Swiss" : resolvedConfig.format === "roundrobin" ? "Round Robin" : "Elimination")
      : DEMO_TOURNAMENT.format,
    timeControl: resolvedConfig?.timePreset ?? DEMO_TOURNAMENT.timeControl,
    playerCount: DEMO_TOURNAMENT.players.length,
  };
  // Keep tournament as DEMO_TOURNAMENT for ShareSheet type compatibility
  const tournament = DEMO_TOURNAMENT;
  const isValidCode = isDemoCode || (tournamentCode.length >= 4 && (isDemoCode || resolvedConfig !== null || tournamentCode.length >= 6));

  function advanceStep(next: Step) {
    setStepKey((k) => k + 1);
    setStep(next);
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCode) { setError("Invalid tournament code. Check with your host."); return; }
    setError("");
    advanceStep("username");
  }

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setError("");
    await active.lookup(username.trim());
    // advance handled via useEffect watching lookupStatus
  }
  // Advance to confirm step once lookup succeeds; normalise into UnifiedProfile
  useEffect(() => {
    if (lookupStatus === "success" && step === "username") {
      const raw = active.profile;
      if (raw) {
        setUnifiedProfile(raw as UnifiedProfile);
        advanceStep("confirm");
      }
    }
    if (lookupStatus === "not_found" || lookupStatus === "error") {
      setError(lookupError);
    }
  }, [lookupStatus]);;

  const [confirming, setConfirming] = useState(false);
  async function handleConfirm() {
    setConfirming(true);
    // Persist the player to the tournament's localStorage store so the Director
    // Dashboard picks them up immediately (via storage event listener)
    if (profile) {
      const config = resolveTournament(tournamentCode);
      if (config) {
        const player: Player = {
          id: `player-${profile.username}-${Date.now()}`,
          name: profile.name || profile.username,
          username: profile.username,
          elo: profile.elo ?? profile.rapid ?? profile.blitz ?? profile.bullet ?? 1200,
          title: profile.title as Player["title"] | undefined,
          country: profile.country ?? "",
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          buchholz: 0,
          colorHistory: [],
          platform: profile.platform,
          avatarUrl: profile.platform === "chesscom" ? (profile as ChessComProfile).avatar : undefined,
          flairEmoji: profile.platform === "lichess" ? (profile as LichessProfile).flairEmoji : undefined,
          joinedAt: Date.now(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        };
        addPlayerToTournament(config.id, player);
      }
    }
    await new Promise((r) => setTimeout(r, 900));
    setConfirming(false);
    advanceStep("success");
  }

  // ── Shared style tokens ─────────────────────────────────────────────────────
  const bg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]";
  const card = isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100/80";
  const inputBase = `mobile-input ${isDark
    ? "!bg-[oklch(0.26_0.06_145)] !border-white/12 !text-white placeholder:text-white/25 focus:!border-[#4CAF50] focus:!shadow-[0_0_0_3px_oklch(0.55_0.13_145/0.20)]"
    : "!bg-white !border-gray-200 !text-gray-900 placeholder:text-gray-300 focus:!border-[#3D6B47] focus:!shadow-[0_0_0_3px_oklch(0.44_0.12_145/0.10)]"}`;
  const labelCls = isDark ? "text-white/45" : "text-gray-400";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";
  const divider = isDark ? "bg-white/06" : "bg-gray-100";

  return (
    <div className={`min-h-screen ${bg} flex flex-col transition-colors duration-300`}
      style={{ WebkitTapHighlightColor: "transparent" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className={`flex items-center justify-between px-4 pt-safe-top pb-3 pt-3 border-b ${
        isDark ? "border-white/06 bg-[oklch(0.18_0.05_145)]" : "border-gray-100 bg-[#F7FAF8]"
      } sticky top-0 z-30 backdrop-blur-md`}
        style={{ paddingTop: `max(env(safe-area-inset-top), 0.75rem)` }}>
        <div className="flex items-center gap-3">
          {step !== "code" && step !== "success" && (
            <button
              onClick={() => {
                if (step === "username") advanceStep("code");
                else if (step === "confirm") { advanceStep("username"); active.reset(); setUnifiedProfile(null); }
              }}
              className={`touch-target -ml-2 rounded-xl ${isDark ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-700"} transition-colors`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <Link href="/" className="flex items-center">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
              alt="OTB Chess"
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>
        <ThemeToggle />
      </header>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <StepProgress step={step} />

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-none">
        <div className="px-4 pt-5 pb-32 max-w-sm mx-auto space-y-4">

          {/* Tournament info chip */}
          {step !== "code" && step !== "success" && (
            <div key={`chip-${stepKey}`} className={`animate-slide-down-fade rounded-2xl border px-4 py-3 flex items-center gap-3 ${
              isDark ? "bg-[#3D6B47]/12 border-[#4CAF50]/18" : "bg-[#3D6B47]/05 border-[#3D6B47]/12"
            }`}>
              <div className="w-9 h-9 bg-[#3D6B47] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#3D6B47]/30">
                <Trophy className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {tournamentDisplay.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <MapPin className="w-2.5 h-2.5" />{tournamentDisplay.venue}
                  </span>
                  <span className={`text-xs ${isDark ? "text-white/15" : "text-gray-200"}`}>·</span>
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <Users className="w-2.5 h-2.5" />{tournamentDisplay.playerCount} players
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 1 — Tournament code ══════════════════════════════════════ */}
          {step === "code" && (
            <div key={`step1-${stepKey}`} className="animate-spring-in space-y-5">
              {/* Hero */}
              <div className="text-center pt-4 pb-2">
                <div className="w-16 h-16 bg-[#3D6B47] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#3D6B47]/25 animate-pulse-ring">
                  <Crown className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <h1 className={`text-2xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  Join Tournament
                </h1>
                <p className={`text-sm mt-1.5 leading-relaxed ${textMuted}`}>
                  Enter the code from your host<br />or scan their QR code
                </p>
              </div>

              <div className={`mobile-card border ${card} p-5`}>
                <label className={`mobile-section-label block mb-2 ${labelCls}`}>
                  Tournament Code
                </label>
                <div className="relative">
                  <Hash className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} pointer-events-none`} />
                  <input
                    type="text"
                    value={tournamentCode}
                    onChange={(e) => { setTournamentCode(e.target.value.toUpperCase()); setError(""); }}
                    placeholder="e.g. OTB2026"
                    maxLength={12}
                    className={`${inputBase} !pl-10 font-mono font-bold tracking-widest uppercase text-base`}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    inputMode="text"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-red-500 text-xs mt-2.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setTournamentCode("OTB2026"); setError(""); }}
                  className={`mt-3 text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"} underline underline-offset-2`}
                >
                  Try the demo → OTB2026
                </button>
              </div>
            </div>
          )}
          {/* ══ STEP 2 — Platform + username ═════════════════════════════════════════════════════════ */}
          {step === "username" && (
            <div key={`step2-${stepKey}`} className="animate-spring-in space-y-4">
              <div className="pt-2">
                <h2 className={`text-xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  Your chess profile
                </h2>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  We'll pull your rating and set up your pairing.
                </p>
              </div>

              {/* Platform toggle */}
              <div className={`mobile-card border ${card} p-1.5 flex gap-1`}>
                {(["chesscom", "lichess"] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPlatform(p); setUsername(""); setError(""); active.reset(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      platform === p
                        ? p === "chesscom"
                          ? isDark ? "bg-[#3D6B47]/30 text-[#4CAF50] shadow-sm" : "bg-[#3D6B47]/10 text-[#3D6B47] shadow-sm"
                          : isDark ? "bg-orange-400/20 text-orange-300 shadow-sm" : "bg-orange-50 text-orange-600 shadow-sm"
                        : isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {p === "chesscom" ? (
                      <>
                        <span className="text-base">&#9812;</span>
                        chess.com
                      </>
                    ) : (
                      <>
                        <span className="text-base">&#9822;</span>
                        Lichess
                      </>
                    )}
                  </button>
                ))}
              </div>

              <div className={`mobile-card border ${card} p-5`}>
                <label className={`mobile-section-label block mb-2 ${labelCls}`}>
                  {platform === "chesscom" ? "chess.com username" : "Lichess username"}
                </label>
                <div className="relative">
                  <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} pointer-events-none`} />
                  <input
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    placeholder={platform === "chesscom" ? "e.g. hikaru" : "e.g. DrNykterstein"}
                    className={`${inputBase} !pl-10 text-base`}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                  />
                </div>
                <p className={`text-xs mt-2 ${textMuted}`}>
                  {platform === "chesscom"
                    ? "Try: hikaru · gothamchess · magnuscarlsen"
                    : "Try: DrNykterstein · Hikaru · penguingim1"}
                </p>
                {error && (
                  <div className="flex items-start gap-2 text-red-500 text-xs mt-2.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ STEP 3 — Confirm profile ══════════════════════════════════════ */}
          {step === "confirm" && profile && (
            <div key={`step3-${stepKey}`} className="animate-spring-in space-y-4">
              <div className="pt-2">
                <h2 className={`text-xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  Confirm your profile
                </h2>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  Is this you? Review your details below.
                </p>
              </div>

              {/* Profile card */}
              <div className={`mobile-card border ${card}`}>
                {/* Accent bar — green for chess.com, orange for Lichess */}
                <div className={`h-1 bg-gradient-to-r ${
                  profile.platform === "lichess"
                    ? "from-orange-600 via-orange-400 to-orange-600"
                    : "from-[#3D6B47] via-[#4CAF50] to-[#3D6B47]"
                }`} />

                <div className="p-5 space-y-4">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-[#3D6B47]/12 flex items-center justify-center overflow-hidden">
                        {profile.avatar ? (
                          <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold text-[#3D6B47]"
                            style={{ fontFamily: "'Clash Display', sans-serif" }}>
                            {profile.username[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                        isDark ? "border-[oklch(0.22_0.06_145)]" : "border-white"
                      } ${profile.platform === "chesscom" && (profile as ChessComProfile).status === "online" ? "status-dot-online" : "status-dot-offline"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-lg leading-tight ${textMain}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          {profile.name ?? profile.username}
                        </span>
                        {profile.title && (
                          <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-2 py-0.5 rounded-md">
                            {profile.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-sm ${textMuted}`}>@{profile.username}</p>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                          profile.platform === "lichess"
                            ? isDark ? "bg-orange-400/15 text-orange-300" : "bg-orange-50 text-orange-600"
                            : isDark ? "bg-[#4CAF50]/10 text-[#4CAF50]" : "bg-[#3D6B47]/08 text-[#3D6B47]"
                        }`}>
                          {profile.platform === "lichess" ? "&#9822; Lichess" : "&#9812; chess.com"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ELO count-up */}
                  <div>
                    <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
                    <div className="grid grid-cols-3 gap-2">
                      {profile.platform === "lichess" ? (
                        <>
                          <EloStatBox label="Classical" target={(profile as LichessProfile).classical} isPrimary={true} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                          <EloStatBox label="Rapid" target={profile.rapid} isPrimary={false} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                          <EloStatBox label="Blitz" target={profile.blitz} isPrimary={false} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                        </>
                      ) : (
                        <>
                          <EloStatBox label="Rapid" target={profile.rapid} isPrimary={true} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                          <EloStatBox label="Blitz" target={profile.blitz} isPrimary={false} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                          <EloStatBox label="Bullet" target={profile.bullet} isPrimary={false} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tier badge */}
                  {(() => {
                    const tier = isDark ? eloTierDark(profile.rapid) : eloTier(profile.rapid);
                    return (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${tier.bg} ${tier.color}`}>
                        <Star className="w-3 h-3" />{tier.label}
                      </div>
                    );
                  })()}

                  <div className={`h-px ${divider}`} />

                  {/* Tournament details */}
                  <div className={`rounded-xl px-4 py-3 space-y-2 ${isDark ? "bg-white/04" : "bg-gray-50"}`}>
                    {[
                      { icon: Trophy, text: tournamentDisplay.name },
                      { icon: MapPin, text: tournamentDisplay.venue },
                      { icon: Clock, text: `${tournamentDisplay.timeControl} · ${tournamentDisplay.format}` },
                      { icon: Users, text: `${tournamentDisplay.playerCount} players registered` },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2.5">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
                        <span className={`text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>{text}</span>
                      </div>
                    ))}
                  </div>
                  {/* ── Optional contact fields ─────────────────────────── */}
                  <div className={`h-px ${divider}`} />
                  <div className="space-y-3">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>Contact (optional)</p>
                    <p className={`text-xs ${textMuted}`}>Let the director send you your results after the tournament.</p>
                    {/* Phone */}
                    <div className="relative">
                      <Phone className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? "text-white/25" : "text-gray-300"}`} />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Phone / WhatsApp number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`${inputBase} w-full pl-10`}
                      />
                    </div>
                    {/* Email */}
                    <div className="relative">
                      <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? "text-white/25" : "text-gray-300"}`} />
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`${inputBase} w-full pl-10`}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 text-red-500 text-xs px-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
            </div>
          )}
          {/* ══ STEP 4 — Success ══════════════════════════════════════════════ */}
          {step === "success" && profile && (
            <div key={`step4-${stepKey}`} className="animate-spring-in space-y-4">
              {/* Hero */}
              <div className="text-center py-4">
                <div className="relative inline-block">
                  <div className="w-20 h-20 bg-[#3D6B47] rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-[#3D6B47]/30">
                    <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center animate-scale-in">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <h2 className={`text-2xl font-bold mt-4 ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  You're in!
                </h2>
                <p className={`text-sm mt-1 ${textMuted}`}>
                  Registered as{" "}
                  <span className={`font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                    {profile.name ?? profile.username}
                  </span>
                </p>
              </div>

              {/* Registration card */}
              <div className={`mobile-card border ${card}`}>
                <div className="h-1 bg-gradient-to-r from-[#3D6B47] via-[#4CAF50] to-[#3D6B47]" />
                <div className="p-5 space-y-4">
                  {/* Player + ELO */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        username={profile.username}
                        name={profile.name ?? profile.username}
                        size={40}
                        showBadge
                        className="rounded-xl"
                        platform={profile.platform}
                        avatarUrl={profile.platform === "chesscom" ? (profile as import("@/hooks/useChessComProfile").ChessComProfile).avatar : undefined}
                        flairEmoji={profile.platform === "lichess" ? (profile as import("@/hooks/useLichessProfile").LichessProfile).flairEmoji : undefined}
                      />
                      <div>
                        <p className={`font-bold text-sm ${textMain}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
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

                  <div className={`h-px ${divider}`} />

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Tournament", value: tournamentDisplay.name, span: true },
                      { label: "Format", value: tournamentDisplay.format },
                      { label: "Time Control", value: tournamentDisplay.timeControl },
                      { label: "Venue", value: tournamentDisplay.venue, span: true },
                    ].map(({ label, value, span }) => (
                      <div key={label} className={span ? "col-span-2" : ""}>
                        <p className={`text-xs ${labelCls} mb-0.5`}>{label}</p>
                        <p className={`text-sm font-semibold ${textMain}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className={`h-px ${divider}`} />

                  {/* What's next */}
                  <div className={`rounded-xl px-4 py-3 ${isDark ? "bg-[#3D6B47]/15" : "bg-[#3D6B47]/06"}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                      What's next
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        "Show up at the venue before Round 1",
                        "Director will announce pairings — check the board list",
                        "First opponent matched by ELO proximity",
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
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed bottom CTA bar ────────────────────────────────────────────── */}
      <div className="mobile-action-bar">
        {step === "code" && (
          <button
            onClick={handleCodeSubmit as unknown as React.MouseEventHandler}
            disabled={!tournamentCode.trim()}
            className="mobile-cta"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {step === "username" && (
          <button
            onClick={handleUsernameSubmit as unknown as React.MouseEventHandler}
            disabled={!username.trim() || loading}
            className="mobile-cta"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Looking up profile…</>
            ) : (
              <>Look up my ELO <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        )}

        {step === "confirm" && profile && (
          <div className="space-y-2">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="mobile-cta"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Confirm Registration</>
              )}
            </button>
          </div>
        )}

        {step === "success" && profile && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/tournament/otb-demo-2026"
                className="mobile-cta !rounded-2xl text-sm"
              >
                <Trophy className="w-4 h-4" /> Standings
              </Link>
              <button
                onClick={() => setShowShare(true)}
                className="mobile-cta-ghost !rounded-2xl text-sm"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
            <Link
              href="/"
              className={`flex items-center justify-center w-full py-2.5 text-xs font-medium ${textMuted} active:opacity-60`}
            >
              Back to OTB Chess
            </Link>
          </div>
        )}
      </div>

      {/* ── Social share sheet ──────────────────────────────────────────────── */}
      {showShare && profile && (
        <ShareSheet
          profile={profile}
          tournament={tournament}
          onClose={() => setShowShare(false)}
          isDark={isDark}
        />
      )}

      {/* ── Bottom branding ─────────────────────────────────────────────────── */}
    </div>
  );
}
