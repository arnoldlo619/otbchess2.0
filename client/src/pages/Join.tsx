/*
 * OTB Chess - Player Join Page
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

import { useState, useRef, useEffect, useCallback } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { NotifyBell } from "@/components/NotifyBell";

import { useCountUp } from "@/hooks/useCountUp";
import { useChessComProfile } from "@/hooks/useChessComProfile";
import { useLichessProfile } from "@/hooks/useLichessProfile";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { validateEmail, validatePassword, validateDisplayName, scorePassword } from "@/components/AuthModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEMO_TOURNAMENT } from "@/lib/tournamentData";
import type { Player } from "@/lib/tournamentData";
import { resolveTournament, registerTournament, makeSlug, type TournamentConfig } from "@/lib/tournamentRegistry";

/**
 * Pick the correct rating from a profile based on the tournament's ratingType.
 * Falls back: preferred → other → bullet → 1200.
 */
function pickRating(
  prof: { rapid: number; blitz: number; bullet: number; elo?: number },
  ratingType: "rapid" | "blitz" = "rapid",
): number {
  if (ratingType === "blitz") return prof.blitz || prof.rapid || prof.bullet || 1200;
  return prof.rapid || prof.blitz || prof.bullet || 1200;
}
import { addPlayerToTournament } from "@/lib/directorState";
import {
  saveRegistration,
  getRegistration,
  clearRegistration,
  pruneOldRegistrations,
  type RegistrationEntry,
} from "@/lib/registrationStore";
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
  ArrowLeft,
  Phone,
  Mail,
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";

// --- Types --------------------------------------------------------------------
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

// --- Server sync helper -------------------------------------------------------
// Fire-and-forget: POST the player to the server so the director dashboard can
// poll it from any device. Failures are silently swallowed so they never block
// the local registration flow.
async function postPlayerToServer(tournamentId: string, player: Player): Promise<void> {
  try {
    await fetch(`/api/tournament/${encodeURIComponent(tournamentId)}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player }),
    });
  } catch {
    // Network error — local registration already succeeded, so ignore.
  }
}

// --- Step Progress Bar --------------------------------------------------------
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

// --- ELO Animated Stat Box ----------------------------------------------------
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

// --- Social Share Sheet -------------------------------------------------------
function ShareSheet({
  profile, tournament, onClose, isDark, ratingType,
}: {
  profile: UnifiedProfile; tournament: typeof DEMO_TOURNAMENT;
  onClose: () => void; isDark: boolean; ratingType?: "rapid" | "blitz";
}) {
  const [copied, setCopied] = useState(false);
  const rType = ratingType ?? "rapid";
  const displayRating = rType === "blitz" ? profile.blitz : profile.rapid;
  const ratingLabel = rType === "blitz" ? "Blitz" : "Rapid";
  const shareText = `Just registered for ${tournament.name} on OTB Chess! 🏆 Playing as @${profile.username} (${displayRating} ${ratingLabel} ELO). See you at the board!`;
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

// --- Compact tournament metadata embedded in QR URL as ?t=<base64json> --------
interface EmbeddedTournamentMeta {
  id: string;
  name: string;
  venue?: string;
  format: "swiss" | "roundrobin" | "elimination";
  rounds: number;
  maxPlayers: number;
  timePreset: string;
  inviteCode: string;
  clubId?: string;
  clubName?: string;
}

function decodeEmbeddedMeta(search: string): EmbeddedTournamentMeta | null {
  try {
    const params = new URLSearchParams(search);
    const t = params.get("t");
    if (!t) return null;
    // The ?t= value may be URL-encoded (new format) or raw base64 (old format).
    // URLSearchParams.get() already decodes %xx sequences, but + is decoded as
    // a space in application/x-www-form-urlencoded — which corrupts raw base64.
    // We try the value as-is first; if atob fails, we try decodeURIComponent.
    let b64 = t;
    let json: string;
    try {
      json = atob(b64);
    } catch {
      // Fallback: the value may still have %xx sequences (e.g. from some QR scanners)
      try {
        b64 = decodeURIComponent(t);
        json = atob(b64);
      } catch {
        return null;
      }
    }
    return JSON.parse(json) as EmbeddedTournamentMeta;
  } catch {
    return null;
  }
}

export function encodeEmbeddedMeta(meta: EmbeddedTournamentMeta): string {
  // Use encodeURIComponent so the base64 is URL-safe in all browsers.
  return encodeURIComponent(btoa(JSON.stringify(meta)));
}

// --- Main Page ----------------------------------------------------------------
export default function JoinPage() {
  const { code: urlCode } = useParams<{ code: string }>();
  const search = useSearch();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Decode embedded tournament metadata from ?t= query param (set by Director QR)
  const embeddedMeta = decodeEmbeddedMeta(search ?? "");

  // Rejoin deep link: ?u=<username> — if the player is already registered, skip
  // the form entirely and navigate straight to their board.
  const urlUsername = (() => {
    try { return new URLSearchParams(search ?? "").get("u") ?? ""; } catch { return ""; }
  })();

  // If the URL carries embedded metadata, bootstrap the registry on this device
  // so resolveTournament() works even without the director's localStorage.
  useEffect(() => {
    if (!embeddedMeta) return;
    const existing = resolveTournament(embeddedMeta.inviteCode);
    if (existing) {
      setServerResolved(true); // already in registry
      return;
    }
    registerTournament({
      id: embeddedMeta.id,
      inviteCode: embeddedMeta.inviteCode,
      directorCode: "", // not needed on player device
      name: embeddedMeta.name,
      venue: embeddedMeta.venue ?? "",
      date: "",
      description: "",
      format: embeddedMeta.format as TournamentConfig["format"],
      rounds: embeddedMeta.rounds,
      maxPlayers: embeddedMeta.maxPlayers,
      timeBase: 10,
      timeIncrement: 0,
      timePreset: embeddedMeta.timePreset,
      ratingSystem: "chess.com",
      createdAt: new Date().toISOString(),
      clubId: embeddedMeta.clubId ?? null,
      clubName: embeddedMeta.clubName ?? null,
    });
    setServerResolved(true); // bootstrapped from ?t= param
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-side fallback bootstrap: when there is no ?t= param (e.g. someone
  // shared the short custom URL like /join/ThursdayOTBNight) and the tournament
  // is not in localStorage (fresh device / Android), fetch from the server and
  // register it locally so the join flow can proceed.
  useEffect(() => {
    if (!urlCode) return;
    // If already resolved locally (from ?t= bootstrap or existing localStorage), skip
    if (resolveTournament(urlCode)) return;
    // Fetch from server by inviteCode or customSlug
    fetch(`/api/auth/join/resolve/${encodeURIComponent(urlCode)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: {
        tournamentId: string;
        name: string;
        venue?: string | null;
        format?: string | null;
        rounds?: number | null;
        inviteCode?: string | null;
        customSlug?: string | null;
      } | null) => {
        if (!data) { setServerResolved(true); return; } // 404 — not in server DB, proceed anyway
        // Don’t re-register if it arrived via the ?t= bootstrap above
        if (!resolveTournament(data.inviteCode ?? urlCode)) {
          registerTournament({
            id: data.tournamentId,
            inviteCode: data.inviteCode ?? urlCode,
            directorCode: "",
            name: data.name,
            venue: data.venue ?? "",
            date: "",
            description: "",
            format: (data.format ?? "swiss") as TournamentConfig["format"],
            rounds: data.rounds ?? 5,
            maxPlayers: 64,
            timeBase: 10,
            timeIncrement: 0,
            timePreset: "10+5",
            ratingSystem: "chess.com",
            customSlug: data.customSlug ?? undefined,
            createdAt: new Date().toISOString(),
          });
        }
        setServerResolved(true);
      })
      .catch(() => {
        // Non-critical — player can still type the code manually
        setServerResolved(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-rejoin: if ?u= is present and the tournament is resolvable, skip the form
  // and go straight to the player lobby. This runs after the bootstrap effect so
  // the registry is populated before we try to resolve.
  useEffect(() => {
    if (!urlUsername || !urlCode) return;
    const config = resolveTournament(urlCode) ??
      (embeddedMeta ? resolveTournament(embeddedMeta.inviteCode) : null);
    if (!config) return;
    // Navigate immediately — no form needed
    navigate(`/tournament/${config.id}/play?username=${encodeURIComponent(urlUsername)}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracks whether the server-side tournament bootstrap has completed.
  // On Android / fresh devices without localStorage, the join button should
  // wait until this is true (or the ?t= bootstrap has already resolved it).
  const [serverResolved, setServerResolved] = useState(() => {
    // Already resolved if the tournament is in localStorage right now
    return urlCode ? Boolean(resolveTournament(urlCode)) : false;
  });

  const [step, setStep] = useState<Step>(urlCode ? "username" : "code");
  const [tournamentCode, setTournamentCode] = useState(urlCode ?? "");
  const [playerName, setPlayerName] = useState("");
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState<Platform>("chesscom");

  // Both hooks are always mounted; only the active one is called
  const chesscom = useChessComProfile();
  const lichess = useLichessProfile();
  const active = platform === "chesscom" ? chesscom : lichess;
  const lookupStatus = active.status;
  const lookupError = active.error;

  // Unified profile state - normalised from whichever platform was used
  const [unifiedProfile, setUnifiedProfile] = useState<UnifiedProfile | null>(null);
  // Alias for backwards compat with existing JSX that references `profile`
  const profile = unifiedProfile;

  const loading = lookupStatus === "loading";
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [stepKey, setStepKey] = useState(0); // force re-mount for animation
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [, navigate] = useLocation();
  // QR mode: code came from URL — show single-screen streamlined join form
  const isQrMode = Boolean(urlCode);

  // Auth context — used for the sign-up gate on QR scan flow
  const { user: authUser, register: authRegister, login: authLogin } = useAuthContext();
  // Inline sign-up form state (shown before chess.com username step for unauthenticated QR users)
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authShowPw, setAuthShowPw] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  // Track whether the user completed auth during this session (to skip the gate)
  const [authCompleted, setAuthCompleted] = useState(false);
  // Show the auth gate when: QR mode + not logged in + hasn't just completed auth
  const needsAuth = isQrMode && !authUser && !authCompleted;

  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Swipe-right to go back (native iOS/Android feel)
  const [swipeProgress, setSwipeProgress] = useState(0); // kept for the existing edge indicator
  const [swipeFlash, setSwipeFlash] = useState(false);

  const handleSwipeBack = useCallback(() => {
    if (step === "username") {
      haptic(30);
      advanceStep("code");
      setSwipeFlash(true);
      setTimeout(() => setSwipeFlash(false), 350);
    } else if (step === "confirm") {
      haptic(30);
      advanceStep("username");
      active.reset();
      setUnifiedProfile(null);
      setSwipeFlash(true);
      setTimeout(() => setSwipeFlash(false), 350);
    }
  }, [step, active]);

  const swipeContainerRef = useRef<HTMLDivElement>(null);
  useSwipeGesture(swipeContainerRef, {
    threshold: 60,
    maxVerticalDrift: 80,
    // Only swipe-right (back) is meaningful in a linear registration flow
    onSwipeRight: handleSwipeBack,
  });

  // Already-registered detection — check localStorage on mount and whenever the code changes
  const [existingReg, setExistingReg] = useState<RegistrationEntry | null>(null);
  useEffect(() => {
    pruneOldRegistrations(90);
  }, []);
  useEffect(() => {
    if (tournamentCode) {
      const reg = getRegistration(tournamentCode);
      setExistingReg(reg);
    } else {
      setExistingReg(null);
    }
  }, [tournamentCode]);

  useEffect(() => {
    if (step === "username") setTimeout(() => usernameRef.current?.focus(), 350);
    // Scroll to top of content on step change
    setTimeout(() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }, [step]);

  // Resolve the real tournament config from the registry (by invite code or slug).
  // After the useEffect above runs, embeddedMeta will have been registered so
  // resolveTournament will find it even on a fresh device.
  const resolvedConfig: TournamentConfig | null = tournamentCode
    ? resolveTournament(tournamentCode)
    : null;
  const isDemoCode = tournamentCode.toUpperCase() === "OTB2026";

  // Display name/venue/format/timeControl — prefer resolvedConfig, then embeddedMeta,
  // and only fall back to DEMO_TOURNAMENT for the explicit demo code.
  const tournamentDisplay = {
    name: resolvedConfig?.name ?? embeddedMeta?.name ?? (isDemoCode ? DEMO_TOURNAMENT.name : ""),
    venue: resolvedConfig?.venue ?? embeddedMeta?.venue ?? (isDemoCode ? DEMO_TOURNAMENT.venue : ""),
    format: resolvedConfig
      ? (resolvedConfig.format === "swiss" ? "Swiss" : resolvedConfig.format === "roundrobin" ? "Round Robin" : "Elimination")
      : embeddedMeta
      ? (embeddedMeta.format === "swiss" ? "Swiss" : embeddedMeta.format === "roundrobin" ? "Round Robin" : "Elimination")
      : (isDemoCode ? DEMO_TOURNAMENT.format : ""),
    timeControl: resolvedConfig?.timePreset ?? embeddedMeta?.timePreset ?? (isDemoCode ? DEMO_TOURNAMENT.timeControl : ""),
    playerCount: DEMO_TOURNAMENT.players.length,
  };
  // Keep tournament as DEMO_TOURNAMENT for ShareSheet type compatibility
  const tournament = DEMO_TOURNAMENT;

  // A code is valid when it resolves to a known tournament, matches embedded metadata,
  // or is the explicit demo code. Never allow an unresolvable code to advance.
  const isValidCode = isDemoCode ||
    (resolvedConfig !== null) ||
    (embeddedMeta !== null && tournamentCode.toUpperCase() === embeddedMeta.inviteCode.toUpperCase());

  // Derive whether the tournament has hit its player cap (for disabling the confirm button).
  // Uses the correct versioned localStorage key: otb-director-state-v2-{id}
  const isTournamentFull = (() => {
    if (!resolvedConfig || isDemoCode) return false;
    try {
      const raw = localStorage.getItem(`otb-director-state-v2-${resolvedConfig.id}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const playerCount: number = parsed?.state?.players?.length ?? 0;
      return playerCount >= (resolvedConfig.maxPlayers ?? Infinity);
    } catch {
      return false;
    }
  })();

  function advanceStep(next: Step) {
    setStepKey((k) => k + 1);
    setStep(next);
  }

  const [codeLoading, setCodeLoading] = useState(false);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = tournamentCode.trim();
    if (!code) return;

    // If already resolved locally (localStorage or demo), advance immediately
    if (isValidCode) {
      setError("");
      advanceStep("username");
      return;
    }

    // Not found locally — try server-side resolve
    setCodeLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/join/resolve/${encodeURIComponent(code)}`);
      if (!res.ok) {
        setCodeLoading(false);
        setError("Invalid tournament code. Check with your host.");
        return;
      }
      const data = await res.json() as {
        tournamentId: string;
        name: string;
        venue?: string | null;
        format?: string | null;
        rounds?: number | null;
        inviteCode?: string | null;
        customSlug?: string | null;
      };
      // Register the tournament locally so the rest of the flow works
      if (!resolveTournament(data.inviteCode ?? code)) {
        registerTournament({
          id: data.tournamentId,
          inviteCode: data.inviteCode ?? code,
          directorCode: "",
          name: data.name,
          venue: data.venue ?? "",
          date: "",
          description: "",
          format: (data.format ?? "swiss") as TournamentConfig["format"],
          rounds: data.rounds ?? 5,
          maxPlayers: 64,
          timeBase: 10,
          timeIncrement: 0,
          timePreset: "10+5",
          ratingSystem: "chess.com",
          customSlug: data.customSlug ?? undefined,
          createdAt: new Date().toISOString(),
        });
      }
      setServerResolved(true);
      setCodeLoading(false);
      advanceStep("username");
    } catch {
      setCodeLoading(false);
      setError("Could not verify tournament code. Check your connection and try again.");
    }
  }

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setError("");
    await active.lookup(username.trim());
    // advance handled via useEffect watching lookupStatus
  }
  // Haptic feedback helper — gracefully no-ops on unsupported devices
  function haptic(pattern: number | number[]) {
    try { if ("vibrate" in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
  }

  // Advance to confirm step once lookup succeeds; normalise into UnifiedProfile
  useEffect(() => {
    if (lookupStatus === "success" && step === "username") {
      const raw = active.profile;
      if (raw) {
        haptic(50); // short buzz — ELO found
        setUnifiedProfile(raw as UnifiedProfile);
        advanceStep("confirm");
      }
    }
    if (lookupStatus === "not_found" || lookupStatus === "error") {
      setError(lookupError);
    }
  }, [lookupStatus]);;

  const [confirming, setConfirming] = useState(false);
  const [capToast, setCapToast] = useState<{ type: "full" | "duplicate" } | null>(null);

  function showCapToast(type: "full" | "duplicate") {
    setCapToast({ type });
    setTimeout(() => setCapToast(null), 5000);
  }

  // Inline auth handler — sign up or sign in before the chess.com username step
  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (authMode === "signup") {
      const nameErr = validateDisplayName(authName);
      if (nameErr) { setAuthError(nameErr); return; }
      const emailErr = validateEmail(authEmail);
      if (emailErr) { setAuthError(emailErr); return; }
      const pwErr = validatePassword(authPassword, true);
      if (pwErr) { setAuthError(pwErr); return; }
      setAuthLoading(true);
      try {
        await authRegister(authEmail, authPassword, authName, username || undefined);
        // Pre-fill the player name from the auth name if not already set
        if (!playerName) setPlayerName(authName);
        setAuthCompleted(true);
        haptic(50);
      } catch (err: unknown) {
        setAuthError(err instanceof Error ? err.message : "Registration failed. Try again.");
      } finally {
        setAuthLoading(false);
      }
    } else {
      // Sign in
      const emailErr = validateEmail(authEmail);
      if (emailErr) { setAuthError(emailErr); return; }
      const pwErr = validatePassword(authPassword);
      if (pwErr) { setAuthError(pwErr); return; }
      setAuthLoading(true);
      try {
        const u = await authLogin(authEmail, authPassword);
        if (!playerName && u.displayName) setPlayerName(u.displayName);
        if (!username && u.chesscomUsername) setUsername(u.chesscomUsername);
        setAuthCompleted(true);
        haptic(50);
      } catch (err: unknown) {
        setAuthError(err instanceof Error ? err.message : "Sign in failed. Check your credentials.");
      } finally {
        setAuthLoading(false);
      }
    }
  }

  // QR mode: single-button join — lookup ELO then register immediately
  async function handleQrJoin() {
    if (!username.trim()) { setError("Enter your chess.com username."); return; }
    setConfirming(true);
    setError("");
    await active.lookup(username.trim());
    // The useEffect below will fire once lookupStatus changes to success/error
  }

  // When QR mode lookup succeeds, auto-register and navigate to tournament
  useEffect(() => {
    if (!isQrMode || !confirming) return;
    if (lookupStatus === "success") {
      const raw = active.profile;
      if (!raw) return;
      const prof = raw as UnifiedProfile;
      setUnifiedProfile(prof);
      // Try registry first; fall back to embeddedMeta (bootstrapped from ?t= param)
      const config = resolveTournament(tournamentCode);
      if (config) {
        const player: Player = {
          id: `player-${prof.username}-${Date.now()}`,
          name: playerName.trim() || prof.name || prof.username,
          username: prof.username,
          elo: pickRating(prof, config.ratingType ?? "rapid"),
          ...(prof.platform === "chesscom" && prof.rapid ? { rapidElo: prof.rapid } : {}),
          ...(prof.platform === "chesscom" && prof.blitz ? { blitzElo: prof.blitz } : {}),
          title: prof.title as Player["title"] | undefined,
          country: prof.country ?? "",
          points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
          colorHistory: [],
          platform: prof.platform,
          avatarUrl: prof.platform === "chesscom" ? (prof as ChessComProfile).avatar : undefined,
          flairEmoji: prof.platform === "lichess" ? (prof as LichessProfile).flairEmoji : undefined,
          joinedAt: Date.now(),
        };
        const result = addPlayerToTournament(config.id, player);
        if (!result.success) {
          setConfirming(false);
          showCapToast(result.reason === "full" ? "full" : "duplicate");
          return;
        }
        // Sync to server so director dashboard picks it up on any device
        postPlayerToServer(config.id, player);
        saveRegistration({
          tournamentId: tournamentCode,
          username: prof.username,
          name: player.name,
          rating: player.elo,
          tournamentName: config.name,
          registeredAt: new Date().toISOString(),
        });
        setConfirming(false);
        haptic([50, 60, 80]); // double-pulse — QR join success
        navigate(`/tournament/${config.id}/play?username=${encodeURIComponent(prof.username)}`);
      } else if (embeddedMeta) {
        // embeddedMeta was registered in the bootstrap useEffect above;
        // re-resolve now that the registry is populated.
        const bootstrapped = resolveTournament(embeddedMeta.inviteCode);
        if (bootstrapped) {
          const player: Player = {
            id: `player-${prof.username}-${Date.now()}`,
            name: playerName.trim() || prof.name || prof.username,
            username: prof.username,
            elo: pickRating(prof, bootstrapped.ratingType ?? "rapid"),
            ...(prof.platform === "chesscom" && prof.rapid ? { rapidElo: prof.rapid } : {}),
            ...(prof.platform === "chesscom" && prof.blitz ? { blitzElo: prof.blitz } : {}),
            title: prof.title as Player["title"] | undefined,
            country: prof.country ?? "",
            points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0,
            colorHistory: [],
            platform: prof.platform,
            avatarUrl: prof.platform === "chesscom" ? (prof as ChessComProfile).avatar : undefined,
            flairEmoji: prof.platform === "lichess" ? (prof as LichessProfile).flairEmoji : undefined,
            joinedAt: Date.now(),
          };
          const result = addPlayerToTournament(bootstrapped.id, player);
          if (!result.success) {
            setConfirming(false);
            showCapToast(result.reason === "full" ? "full" : "duplicate");
            return;
          }
          // Sync to server so director dashboard picks it up on any device
          postPlayerToServer(bootstrapped.id, player);
          saveRegistration({
            tournamentId: tournamentCode,
            username: prof.username,
            name: player.name,
            rating: player.elo,
            tournamentName: bootstrapped.name,
            registeredAt: new Date().toISOString(),
          });
          setConfirming(false);
          haptic([50, 60, 80]); // double-pulse — QR join success (embedded)
          navigate(`/tournament/${bootstrapped.id}/play?username=${encodeURIComponent(prof.username)}`);
        } else {
          setConfirming(false);
          setError("Tournament not found. Ask the director to share the QR code again.");
        }
      } else {
        setConfirming(false);
        setError("Tournament not found. Check the code and try again.");
      }
    } else if (lookupStatus === "not_found" || lookupStatus === "error") {
      setConfirming(false);
      setError(lookupError || "Username not found on chess.com.");
    }
  }, [lookupStatus]);

  async function handleConfirm() {
    setConfirming(true);
    // Persist the player to the tournament's localStorage store so the Director
    // Dashboard picks them up immediately (via storage event listener)
    if (profile) {
      // Resolve tournament config — try invite code first, then embeddedMeta.inviteCode
      // (handles fresh devices where the QR ?t= payload bootstrapped the registry)
      const config =
        resolveTournament(tournamentCode)
        ?? (embeddedMeta ? resolveTournament(embeddedMeta.inviteCode) : null);
      const player: Player = {
        id: `player-${profile.username}-${Date.now()}`,
        name: profile.name || profile.username,
        username: profile.username,
        elo: pickRating(profile, resolvedConfig?.ratingType ?? "rapid"),
        ...(profile.platform === "chesscom" && (profile as ChessComProfile).rapid ? { rapidElo: (profile as ChessComProfile).rapid } : {}),
        ...(profile.platform === "chesscom" && (profile as ChessComProfile).blitz ? { blitzElo: (profile as ChessComProfile).blitz } : {}),
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
      if (config) {
        const result = addPlayerToTournament(config.id, player);
        if (!result.success) {
          setConfirming(false);
          showCapToast(result.reason === "full" ? "full" : "duplicate");
          return;
        }
        postPlayerToServer(config.id, player);
      } else if (embeddedMeta?.id) {
        // Fresh device — no localStorage yet; post directly to server using the
        // tournament ID embedded in the QR ?t= payload.
        postPlayerToServer(embeddedMeta.id, player);
      }
    }
    // Persist registration to localStorage for duplicate detection
    if (profile) {
      saveRegistration({
        tournamentId: tournamentCode,
        username: profile.username,
        name: profile.name ?? profile.username,
        rating: pickRating(profile, resolvedConfig?.ratingType ?? "rapid"),
        tournamentName: tournamentDisplay.name,
        registeredAt: new Date().toISOString(),
      });
      setExistingReg(getRegistration(tournamentCode));
    }
    await new Promise((r) => setTimeout(r, 900));
    setConfirming(false);
    haptic([40, 50, 100]); // double-pulse — registration confirmed
    // Navigate directly to the player game view.
    // Priority: resolved registry id → embeddedMeta.id → raw tournamentCode
    if (profile) {
      const resolvedId =
        resolveTournament(tournamentCode)?.id
        ?? (embeddedMeta ? resolveTournament(embeddedMeta.inviteCode)?.id : undefined)
        ?? embeddedMeta?.id
        ?? tournamentCode;
      navigate(`/tournament/${resolvedId}/play?username=${encodeURIComponent(profile.username)}`);
      return;
    }
    advanceStep("success");
  }

  // -- Shared style tokens -----------------------------------------------------
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

      {/* -- Header ----------------------------------------------------------- */}
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

      {/* -- Progress bar ----------------------------------------------------- */}
      <StepProgress step={step} />

      {/* -- Cap / Duplicate Toast -------------------------------------------- */}
      {capToast && (
        <div
          className={`fixed top-[calc(env(safe-area-inset-top)+60px)] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-slide-down-fade ${
            capToast.type === "full"
              ? isDark
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                : "bg-amber-50 border border-amber-300 text-amber-800"
              : isDark
              ? "bg-blue-500/15 border border-blue-500/30 text-blue-300"
              : "bg-blue-50 border border-blue-300 text-blue-800"
          } rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-lg`}
        >
          <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center ${
            capToast.type === "full" ? "bg-amber-400/20" : "bg-blue-400/20"
          }`}>
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">
              {capToast.type === "full" ? "Tournament Full" : "Already Registered"}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {capToast.type === "full"
                ? `This tournament has reached its player limit. Ask the director to increase the cap or join the waitlist.`
                : `You're already registered for this tournament with this username.`}
            </p>
          </div>
          <button
            onClick={() => setCapToast(null)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none mt-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* -- Swipe-right edge indicator (visible during active swipe from left edge) */}
      {swipeProgress > 0 && (step === "username" || step === "confirm") && (
        <div
          className="fixed left-0 top-0 bottom-0 z-50 w-1 pointer-events-none"
          style={{
            background: `linear-gradient(to right, oklch(0.55 0.13 145 / ${swipeProgress * 0.9}), transparent)`,
            opacity: swipeProgress,
            transition: "opacity 0.05s ease",
          }}
        />
      )}

      {/* -- Swipe-back flash overlay ------------------------------------------ */}
      {swipeFlash && (
        <div
          className="pointer-events-none fixed inset-y-0 left-0 z-50 w-16 bg-gradient-to-r from-[#4CAF50]/20 to-transparent transition-opacity duration-300"
          aria-hidden
        />
      )}

      {/* -- Scrollable content ----------------------------------------------- */}
      <div
        ref={(el) => {
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (swipeContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="flex-1 overflow-y-auto overscroll-none"
      >
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

          {/* == STEP 1 - Tournament code ====================================== */}
          {step === "code" && (
            <div key={`step1-${stepKey}`} className="animate-spring-in space-y-5">
              {/* Already-registered banner — shown when a prior registration is found */}
              {existingReg && (
                <div className={`rounded-2xl border p-4 ${
                  isDark
                    ? "bg-[#3D6B47]/15 border-[#4CAF50]/25"
                    : "bg-[#3D6B47]/06 border-[#3D6B47]/18"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDark ? "bg-[#4CAF50]/20" : "bg-[#3D6B47]/12"
                    }`}>
                      <CheckCircle2 className={`w-5 h-5 ${
                        isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                      }`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${
                        isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                      }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        Already registered
                      </p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${
                        isDark ? "text-white/55" : "text-gray-500"
                      }`}>
                        <span className="font-semibold">{existingReg.name}</span>
                        {" "}({existingReg.rating} ELO) is registered for{" "}
                        <span className="font-semibold">{existingReg.tournamentName}</span>.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          clearRegistration(existingReg.tournamentId, existingReg.username);
                          setExistingReg(null);
                        }}
                        className={`mt-2 text-xs font-medium underline underline-offset-2 ${
                          isDark ? "text-white/40 hover:text-white/60" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Not me — register again
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                  Enter the code from your host
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
                    enterKeyHint="search"
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
          {/* == QR MODE — AUTH GATE (shown before chess.com form for unauthenticated users) */}
          {isQrMode && step === "username" && needsAuth && (
            <div key={`auth-gate-${stepKey}`} className="animate-spring-in space-y-5">
              {/* Hero */}
              <div className="text-center pt-6 pb-2">
                <div className="w-20 h-20 bg-[#3D6B47] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-[#3D6B47]/30">
                  <Crown className="w-10 h-10 text-white" strokeWidth={1.5} />
                </div>
                <h1 className={`text-3xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {tournamentDisplay.name || "Join Tournament"}
                </h1>
                {tournamentDisplay.venue && (
                  <p className={`text-sm mt-1.5 flex items-center justify-center gap-1.5 ${textMuted}`}>
                    <MapPin className="w-3.5 h-3.5" />{tournamentDisplay.venue}
                  </p>
                )}
              </div>

              {/* Auth form card */}
              <form onSubmit={handleAuthSubmit} className={`mobile-card border ${card} p-6 space-y-5`}>
                <div className="text-center">
                  <h2 className={`text-lg font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                    {authMode === "signup" ? "Create your account" : "Welcome back"}
                  </h2>
                  <p className={`text-xs mt-1 ${textMuted}`}>
                    {authMode === "signup" ? "Quick sign-up to join this tournament" : "Sign in to continue"}
                  </p>
                </div>

                {authMode === "signup" && (
                  <div>
                    <label className={`mobile-section-label block mb-2 ${labelCls}`}>Full Name</label>
                    <div className="relative">
                      <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} pointer-events-none`} />
                      <input
                        type="text"
                        value={authName}
                        onChange={(e) => { setAuthName(e.target.value); setAuthError(""); }}
                        placeholder="e.g. Magnus Carlsen"
                        className={`${inputBase} !pl-10 text-base`}
                        autoComplete="name"
                        inputMode="text"
                        enterKeyHint="next"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={`mobile-section-label block mb-2 ${labelCls}`}>Email</label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} pointer-events-none`} />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => { setAuthEmail(e.target.value); setAuthError(""); }}
                      placeholder="you@example.com"
                      className={`${inputBase} !pl-10 text-base`}
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="next"
                      autoFocus={authMode === "signin"}
                    />
                  </div>
                </div>

                <div>
                  <label className={`mobile-section-label block mb-2 ${labelCls}`}>Password</label>
                  <div className="relative">
                      <input
                        type={authShowPw ? "text" : "password"}
                        value={authPassword}
                        onChange={(e) => { setAuthPassword(e.target.value); setAuthError(""); }}
                        placeholder={authMode === "signup" ? "Min 8 characters" : "Password"}
                        className={`${inputBase} !pr-10 text-base`}
                        autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                        enterKeyHint={authMode === "signup" ? "next" : "done"}
                      />
                    <button
                      type="button"
                      onClick={() => setAuthShowPw((s) => !s)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"}`}
                      tabIndex={-1}
                    >
                      {authShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {authMode === "signup" && authPassword && (
                    <div className="mt-2 space-y-1">
                      <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
                        <div className={`h-full rounded-full transition-all duration-300 ${
                          scorePassword(authPassword) === "weak" ? "w-1/3 bg-red-400" :
                          scorePassword(authPassword) === "fair" ? "w-2/3 bg-yellow-400" :
                          scorePassword(authPassword) === "strong" ? "w-full bg-emerald-400" : "w-0"
                        }`} />
                      </div>
                      <p className={`text-xs ${
                        scorePassword(authPassword) === "weak" ? "text-red-400" :
                        scorePassword(authPassword) === "fair" ? "text-yellow-400" : "text-emerald-500"
                      }`}>
                        {scorePassword(authPassword) === "weak" ? "Weak" : scorePassword(authPassword) === "fair" ? "Fair" : "Strong"}
                      </p>
                    </div>
                  )}
                </div>

                {authMode === "signup" && (
                  <div>
                    <label className={`mobile-section-label block mb-2 ${labelCls}`}>Chess.com Username <span className={textMuted}>(optional)</span></label>
                    <div className="relative">
                      <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none ${textMuted}`}>&#9812;</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); }}
                        placeholder="e.g. hikaru"
                        className={`${inputBase} !pl-10 text-base`}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        inputMode="text"
                        enterKeyHint="done"
                      />
                    </div>
                    <p className={`text-xs mt-1.5 ${textMuted}`}>We'll pull your ELO for optimal pairings</p>
                  </div>
                )}

                {authError && (
                  <div className="flex items-start gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="mobile-cta w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {authMode === "signup" ? "Creating account…" : "Signing in…"}</>
                  ) : (
                    <><LogIn className="w-4 h-4" /> {authMode === "signup" ? "Create Account & Join" : "Sign In & Join"}</>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthError(""); }}
                    className={`text-sm font-medium underline underline-offset-2 ${isDark ? "text-white/50 hover:text-white/80" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {authMode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* == QR MODE — streamlined single-screen join ==================== */}
          {isQrMode && step === "username" && !needsAuth && (
            <div key={`qr-join-${stepKey}`} className="animate-spring-in space-y-5">
              {/* Hero */}
              <div className="text-center pt-6 pb-2">
                <div className="w-20 h-20 bg-[#3D6B47] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-[#3D6B47]/30">
                  <Crown className="w-10 h-10 text-white" strokeWidth={1.5} />
                </div>
                <h1 className={`text-3xl font-bold tracking-tight ${textMain}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {tournamentDisplay.name || "Join Tournament"}
                </h1>
                {tournamentDisplay.venue && (
                  <p className={`text-sm mt-1.5 flex items-center justify-center gap-1.5 ${textMuted}`}>
                    <MapPin className="w-3.5 h-3.5" />{tournamentDisplay.venue}
                  </p>
                )}
              </div>

              {/* Already registered banner */}
              {existingReg && (
                <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  isDark ? "bg-[#3D6B47]/15 border-[#4CAF50]/25" : "bg-[#3D6B47]/06 border-[#3D6B47]/18"
                }`}>
                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                  }`} strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${
                      isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
                    }`}>Already registered</p>
                    <p className={`text-xs mt-0.5 ${isDark ? "text-white/55" : "text-gray-500"}`}>
                      <span className="font-semibold">{existingReg.name}</span> ({existingReg.rating} ELO)
                    </p>
                    <button
                      type="button"
                      onClick={() => { clearRegistration(existingReg.tournamentId, existingReg.username); setExistingReg(null); }}
                      className={`mt-1.5 text-xs font-medium underline underline-offset-2 ${
                        isDark ? "text-white/40 hover:text-white/60" : "text-gray-400 hover:text-gray-600"
                      }`}
                    >Not me — register again</button>
                  </div>
                </div>
              )}

              {/* Form card */}
              <div className={`mobile-card border ${card} p-6 space-y-6`}>
                {/* Name field */}
                <div>
                  <label className={`mobile-section-label block mb-2 ${labelCls}`}>Your name</label>
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} pointer-events-none`} />
                    <input
                      ref={nameRef}
                      type="text"
                      value={playerName}
                      onChange={(e) => { setPlayerName(e.target.value); setError(""); }}
                      placeholder="e.g. Magnus Carlsen"
                      className={`${inputBase} !pl-10 text-base`}
                      autoComplete="name"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Chess.com username field */}
                <div>
                  <label className={`mobile-section-label block mb-2 ${labelCls}`}>Chess.com username</label>
                  <div className="relative">
                    <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none ${textMuted}`}>&#9812;</span>
                    <input
                      ref={usernameRef}
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      placeholder="e.g. hikaru"
                      className={`${inputBase} !pl-10 text-base`}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                    />
                  </div>
                  <p className={`text-xs mt-1.5 ${textMuted}`}>We'll pull your ELO for optimal pairings</p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* == STEP 2 - Platform + username (manual flow only) ================ */}
          {!isQrMode && step === "username" && (
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

              <div className={`mobile-card border ${card} p-5 space-y-4`}>
                <div>
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
                      onKeyDown={(e) => { if (e.key === "Enter" && username.trim()) handleUsernameSubmit(e as unknown as React.FormEvent); }}
                      placeholder={platform === "chesscom" ? "e.g. hikaru" : "e.g. DrNykterstein"}
                      className={`${inputBase} !pl-10 !pr-24 text-base`}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                    />
                    {/* Inline lookup button */}
                    <button
                      type="button"
                      onClick={handleUsernameSubmit as unknown as React.MouseEventHandler}
                      disabled={!username.trim() || loading}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30 ${
                        isDark
                          ? "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30"
                          : "bg-[#3D6B47]/10 text-[#3D6B47] hover:bg-[#3D6B47]/18"
                      }`}
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Look up"}
                    </button>
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
            </div>
          )}

          {/* == STEP 3 - Confirm profile ====================================== */}
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
                {/* Accent bar - green for chess.com, orange for Lichess */}
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
                          <EloStatBox label="Rapid" target={profile.rapid} isPrimary={resolvedConfig?.ratingType !== "blitz"} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                          <EloStatBox label="Blitz" target={profile.blitz} isPrimary={resolvedConfig?.ratingType === "blitz"} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                          <EloStatBox label="Bullet" target={profile.bullet} isPrimary={false} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tier badge */}
                  {(() => {
                    const heroRating = resolvedConfig?.ratingType === "blitz" ? profile.blitz : profile.rapid;
                    const tier = isDark ? eloTierDark(heroRating) : eloTier(heroRating);
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
                  {/* -- Optional contact fields --------------------------- */}
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
          {/* == STEP 4 - Success ============================================== */}
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
                        {resolvedConfig?.ratingType === "blitz" ? profile.blitz : profile.rapid}
                      </p>
                      <p className={`text-xs ${textMuted}`}>{resolvedConfig?.ratingType === "blitz" ? "Blitz" : "Rapid"} ELO</p>
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

                  {/* Push notification opt-in */}
                  {resolvedConfig && (
                    <div className={`rounded-xl overflow-hidden ${isDark ? "bg-[#3D6B47]/20" : "bg-[#3D6B47]/08"}`}>
                      <NotifyBell
                        tournamentId={resolvedConfig.id}
                        tournamentName={tournamentDisplay.name}
                        className={isDark ? "!bg-transparent !border-0" : "!bg-transparent !border-0"}
                      />
                    </div>
                  )}

                  {/* What's next */}
                  <div className={`rounded-xl px-4 py-3 ${isDark ? "bg-[#3D6B47]/15" : "bg-[#3D6B47]/06"}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                      What's next
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        "Show up at the venue before Round 1",
                        "Director will announce pairings - check the board list",
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

              {/* Club CTA — prompt player to join the hosting club's group page */}
              {resolvedConfig?.clubId && resolvedConfig?.clubName && (
                <Link
                  href={`/clubs/${resolvedConfig.clubId}`}
                  className={`mobile-card border ${card} p-5 flex items-center gap-4 group hover:border-[#4CAF50]/40 transition-all`}
                >
                  <div className="w-12 h-12 bg-[#3D6B47] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-[#3D6B47]/25">
                    <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${textMain}`}
                      style={{ fontFamily: "'Clash Display', sans-serif" }}>
                      Join {resolvedConfig.clubName}
                    </p>
                    <p className={`text-xs mt-0.5 ${textMuted}`}>
                      Follow this club for future tournaments and events
                    </p>
                  </div>
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/30 group-hover:text-white/60" : "text-gray-300 group-hover:text-gray-500"} transition-colors`} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* -- Fixed bottom CTA bar ---------------------------------------------- */}
      <div className="mobile-action-bar">
        {step === "code" && (
          <button
            onClick={handleCodeSubmit as unknown as React.MouseEventHandler}
            disabled={!tournamentCode.trim() || codeLoading}
            className="mobile-cta disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {codeLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
            ) : (
              <>Continue <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        )}

        {step === "username" && isQrMode && (
          <button
            onClick={handleQrJoin}
            disabled={!username.trim() || confirming || !serverResolved}
            className="mobile-cta disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
            ) : !serverResolved ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Loading tournament…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Join Tournament</>
            )}
          </button>
        )}
        {step === "username" && !isQrMode && (
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
            {isTournamentFull && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
                isDark ? "bg-amber-500/12 border border-amber-500/25 text-amber-300" : "bg-amber-50 border border-amber-300 text-amber-800"
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>This tournament is full. Ask the director to increase the player cap.</span>
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={loading || isTournamentFull}
              className="mobile-cta disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
              ) : isTournamentFull ? (
                <><AlertCircle className="w-4 h-4" /> Tournament Full</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Confirm Registration</>
              )}
            </button>
          </div>
        )}

        {step === "success" && profile && (
          <div className="space-y-2.5">
            <Link
              href={`/tournament/${resolveTournament(tournamentCode)?.id ?? tournamentCode}`}
              className="mobile-cta !rounded-2xl text-sm"
            >
              <Trophy className="w-4 h-4" /> {tournamentDisplay.name || "Tournament Dashboard"}
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowShare(true)}
                className="mobile-cta-ghost !rounded-2xl text-sm"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
              <Link
                href="/"
                className="mobile-cta-ghost !rounded-2xl text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Home
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* -- Social share sheet ------------------------------------------------ */}


      {showShare && profile && (
        <ShareSheet
          profile={profile}
          tournament={tournament}
          onClose={() => setShowShare(false)}
          isDark={isDark}
          ratingType={resolvedConfig?.ratingType}
        />
      )}

      {/* -- Bottom branding --------------------------------------------------- */}
    </div>
  );
}
