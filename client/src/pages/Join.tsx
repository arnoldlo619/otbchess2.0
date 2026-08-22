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
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
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
import { PlayerPaymentMethods } from "@/components/tournament/PlayerPaymentMethods";
import { QrScanner } from "@/components/QrScanner";
import { DEMO_TOURNAMENT } from "@/lib/tournamentData";
import type { Player } from "@/lib/tournamentData";
import {resolveTournament, registerTournament, type TournamentConfig} from "@/lib/tournamentRegistry";
import { getTournamentFormatLabel } from "@/lib/formatRegistry";

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
import { addPlayerToTournament, removeJoinedPlayerFromTournament } from "@/lib/directorState";
import {
  saveRegistration,
  getRegistration,
  clearRegistration,
  pruneOldRegistrations,
  type RegistrationEntry,
} from "@/lib/registrationStore";
import {
  Crown as _Crown,
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
  CalendarDays,
  ShieldCheck,
  Camera,
} from "lucide-react";

// --- Types --------------------------------------------------------------------
import type { ChessComProfile } from "@/hooks/useChessComProfile";
import type { LichessProfile } from "@/hooks/useLichessProfile";

import { authFetch } from "@/lib/apiFetch";
import { decodeMetaParam, encodeMetaParam } from "@/lib/base64";
type Platform = "chesscom" | "lichess";
type ManualJoinProfile = {
  username: string;
  name?: string;
  rapid: number;
  blitz: number;
  bullet: number;
  classical?: number;
  elo: number;
  platform: Platform;
  manualRating: true;
  title?: string;
  country?: string;
  avatar?: string;
  flairEmoji?: string;
};
/** Unified profile type covering provider profiles and a user-entered fallback rating. */
type UnifiedProfile = ((ChessComProfile & { platform: "chesscom" }) | LichessProfile | ManualJoinProfile) & {
  manualRating?: boolean;
};
type Step = "code" | "username" | "confirm" | "success";

export function parseManualRating(value: string): number | null {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 100 && rating <= 3500 ? rating : null;
}

export function isRateLimitError(message: string): boolean {
  return /\b429\b|rate[ -]?limit|too many requests/i.test(message);
}

export function createManualJoinProfile(
  username: string,
  name: string,
  rating: number,
  platform: Platform,
): ManualJoinProfile {
  return {
    username: username.trim(),
    name: name.trim() || username.trim(),
    rapid: rating,
    blitz: rating,
    bullet: rating,
    classical: rating,
    elo: rating,
    platform,
    manualRating: true,
  };
}

function eloTier(elo: number) {
  if (elo >= 2500) return { label: "Grandmaster", color: "text-amber-700", bg: "bg-amber-50 border border-amber-200" };
  if (elo >= 2200) return { label: "Master", color: "text-purple-700", bg: "bg-purple-50 border border-purple-200" };
  if (elo >= 1800) return { label: "Expert", color: "text-blue-700", bg: "bg-blue-50 border border-blue-200" };
  if (elo >= 1400) return { label: "Intermediate", color: "text-[#436850]", bg: "bg-[#436850]/08 border border-[#436850]/20" };
  return { label: "Beginner", color: "text-[#436850]", bg: "bg-[#FBFADA]/70 border border-[#ADBC9F]" };
}

function eloTierDark(elo: number) {
  if (elo >= 2500) return { label: "Grandmaster", color: "text-amber-300", bg: "bg-amber-400/10 border border-amber-400/20" };
  if (elo >= 2200) return { label: "Master", color: "text-purple-300", bg: "bg-purple-400/10 border border-purple-400/20" };
  if (elo >= 1800) return { label: "Expert", color: "text-blue-300", bg: "bg-blue-400/10 border border-blue-400/20" };
  if (elo >= 1400) return { label: "Intermediate", color: "text-[#4CAF50]", bg: "bg-[#4CAF50]/10 border border-[#4CAF50]/20" };
  return { label: "Beginner", color: "text-white/50", bg: "bg-white/05 border border-white/10" };
}

export type RegistrationIssue = "full" | "duplicate" | "closed" | "invalid" | "network" | "rate_limited";

export function getRegistrationIssuePresentation(type: RegistrationIssue, retryAfterSeconds?: number): {
  title: string;
  message: string;
  tone: "amber" | "blue" | "red";
} {
  if (type === "full") return {
    title: "Tournament Full",
    message: "This tournament has reached its player limit. Ask the director to increase the cap.",
    tone: "amber",
  };
  if (type === "duplicate") return {
    title: "Already Registered",
    message: "This username is already registered for the tournament.",
    tone: "blue",
  };
  if (type === "closed") return {
    title: "Registration Closed",
    message: "This tournament has already started or finished. You can still follow pairings and results.",
    tone: "amber",
  };
  if (type === "rate_limited") return {
    title: "Too Many Attempts",
    message: `Please wait ${Math.max(1, retryAfterSeconds ?? 60)} seconds, then try again. Your information is still here.`,
    tone: "amber",
  };
  if (type === "invalid") return {
    title: "Tournament Not Found",
    message: "The QR code or invite link is invalid. Ask the director to share a new one.",
    tone: "red",
  };
  return {
    title: "Could Not Register",
    message: "The roster could not be updated. Check your connection and try again.",
    tone: "red",
  };
}

type RegistrationSyncResult =
  | { success: true }
  | { success: false; reason: RegistrationIssue; retryAfterSeconds?: number };

function mapAddPlayerIssue(reason: "duplicate" | "full" | "closed" | "unknown"): RegistrationIssue {
  return reason === "unknown" ? "invalid" : reason;
}

// Server confirmation is authoritative for cross-device Director rosters. A
// failed sync is surfaced and the optimistic local mutation is rolled back.
export async function postPlayerToServer(tournamentId: string, player: Player): Promise<RegistrationSyncResult> {
  try {
    const response = await authFetch(`/api/tournament/${encodeURIComponent(tournamentId)}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player }),
    });
    if (response.ok) return { success: true };
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      return {
        success: false,
        reason: "rate_limited",
        retryAfterSeconds: Number.isFinite(retryAfter) ? Math.min(300, Math.max(1, retryAfter)) : 60,
      };
    }
    if (response.status === 409 && payload.error === "registration_closed") return { success: false, reason: "closed" };
    if (response.status === 409) return { success: false, reason: "duplicate" };
    if (response.status === 404) return { success: false, reason: "invalid" };
    return { success: false, reason: "network" };
  } catch {
    return { success: false, reason: "network" };
  }
}

function ManualRatingField({
  value,
  onChange,
  inputClassName,
  labelClassName,
  mutedClassName,
  providerLabel,
  inputId,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  labelClassName: string;
  mutedClassName: string;
  providerLabel: string;
  inputId: string;
}) {
  const isInvalid = value.length > 0 && parseManualRating(value) === null;
  const helpId = `${inputId}-help`;

  return (
    <div>
      <label htmlFor={inputId} className={`mobile-section-label block mb-2 ${labelClassName}`}>
        Manual pairing rating <span className="normal-case tracking-normal opacity-70">(optional)</span>
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={100}
        max={3500}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        placeholder="e.g. 1650"
        aria-invalid={isInvalid}
        aria-describedby={helpId}
        className={`${inputClassName} text-base`}
      />
      <p id={helpId} className={`mt-1.5 text-xs ${isInvalid ? "text-red-500" : mutedClassName}`}>
        {isInvalid
          ? "Enter a whole-number rating from 100 to 3500."
          : `Used only if ${providerLabel} cannot provide a rating.`}
      </p>
    </div>
  );
}

// --- Step Progress Bar --------------------------------------------------------
function StepProgress({ step }: { step: Step }) {
  const steps: Step[] = ["code", "username", "confirm", "success"];
  const idx = steps.indexOf(step);
  const pct = step === "success" ? 100 : ((idx) / 3) * 100;

  return (
    <div className="w-full h-0.5 bg-[#ADBC9F]/40 dark:bg-white/08 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#436850] rounded-full transition-all duration-500 ease-out"
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
        ? isDark ? "bg-[#436850]/20 ring-1 ring-[#4CAF50]/30" : "bg-[#436850]/07 ring-1 ring-[#436850]/18"
        : isDark ? "bg-white/05" : "bg-[#FBFADA]/70"
    }`}>
      {isPrimary && !done && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(61,107,71,0.15) 50%, transparent 100%)",
          animation: "shimmer 1.6s ease-out forwards",
        }} />
      )}
      <p className={`text-2xl font-bold tabular-nums leading-none ${
        isPrimary ? isDark ? "text-[#4CAF50]" : "text-[#436850]" : textMain
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleOverlay({
    open: true,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: cancelButtonRef,
  });
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
  const border = isDark ? "border-white/08" : "border-[#ADBC9F]/70";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/50" : "text-[#436850]";

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Share your registration"
      tabIndex={-1}
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
          <div className={`rounded-2xl p-4 mb-4 ${isDark ? "bg-[#436850]/15 border border-[#4CAF50]/15" : "bg-[#436850]/05 border border-[#436850]/12"}`}>
            <p className={`text-sm leading-relaxed ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
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
                  isDark ? "bg-white/06 hover:bg-white/10" : "bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"
                }`}
              >
                <Share2 className={`w-5 h-5 ${isDark ? "text-white/70" : "text-[#436850]"}`} />
                <span className={`text-xs font-medium ${textMuted}`}>Share</span>
              </button>
            )}

            {/* Twitter/X */}
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank")}
              className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95 ${
                isDark ? "bg-white/06 hover:bg-white/10" : "bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"
              }`}
            >
              <Twitter className={`w-5 h-5 ${isDark ? "text-white/70" : "text-[#436850]"}`} />
              <span className={`text-xs font-medium ${textMuted}`}>Twitter</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`, "_blank")}
              className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl transition-all active:scale-95 ${
                isDark ? "bg-white/06 hover:bg-white/10" : "bg-[#FBFADA]/70 hover:bg-[#ADBC9F]/50"
              }`}
            >
              <MessageCircle className={`w-5 h-5 ${isDark ? "text-white/70" : "text-[#436850]"}`} />
              <span className={`text-xs font-medium ${textMuted}`}>WhatsApp</span>
            </button>
          </div>

          {/* Copy link */}
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-97 ${
              copied
                ? isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#436850]/10 text-[#436850]"
                : isDark ? "bg-white/08 text-white/80 hover:bg-white/12" : "bg-[#ADBC9F]/40 text-[#12372A]/85 hover:bg-gray-150"
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy message + link"}
          </button>

          <button
            ref={cancelButtonRef}
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
  date?: string;
  format: "swiss" | "roundrobin" | "elimination" | "swiss_elim" | "quads" | "doubleswiss";
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
    // Unicode-safe decode with backward compatibility for legacy Latin-1 links
    const parsed = decodeMetaParam(t);
    return parsed as EmbeddedTournamentMeta | null;
  } catch {
    return null;
  }
}

export function encodeEmbeddedMeta(meta: EmbeddedTournamentMeta): string {
  // Unicode-safe base64 encoding
  return encodeMetaParam(meta as unknown as Record<string, unknown>);
}

export function formatJoinDate(value?: string): string {
  if (!value) return "Date to be announced";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

// --- Main Page ----------------------------------------------------------------
export default function JoinPage() {
  const { code: urlCode } = useParams<{ code: string }>();
  const search = useSearch();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { triggerForJoin, canPromptNatively } = usePwaInstall();

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
    authFetch(`/api/auth/join/resolve/${encodeURIComponent(urlCode)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: {
        tournamentId: string;
        name: string;
        venue?: string | null;
        format?: string | null;
        rounds?: number | null;
        date?: string | null;
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
            date: data.date ?? "",
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
  const [manualRating, setManualRating] = useState("");
  const [manualRatingUsed, setManualRatingUsed] = useState(false);
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
  const [showQrScanner, setShowQrScanner] = useState(false);
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
  // Auth gate removed from QR join flow — players join with name + chess.com username only.
  // Account creation is prompted post-tournament on the TournamentCompleteScreen.
  const needsAuth = false;

  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Swipe-right to go back (native iOS/Android feel)
  const [swipeProgress, _setSwipeProgress] = useState(0); // kept for the existing edge indicator
  const [swipeFlash, setSwipeFlash] = useState(false);

  const advanceStep = useCallback((next: Step) => {
    setStepKey((k) => k + 1);
    setStep(next);
  }, []);
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
  }, [step, active, advanceStep]);

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

  // Server-side tournament status for completed/closed events (used when localStorage is empty)
  const [serverTournamentStatus, setServerTournamentStatus] = useState<{
    status: string;
    playerCount: number;
    tournamentId: string;
  } | null>(null);

// Display name/venue/format/timeControl — prefer resolvedConfig, then embeddedMeta,
  // and only fall back to DEMO_TOURNAMENT for the explicit demo code.
  const tournamentDisplay = {
    name: resolvedConfig?.name ?? embeddedMeta?.name ?? (isDemoCode ? DEMO_TOURNAMENT.name : ""),
    venue: resolvedConfig?.venue ?? embeddedMeta?.venue ?? (isDemoCode ? DEMO_TOURNAMENT.venue : ""),
    format: resolvedConfig
      ? getTournamentFormatLabel(resolvedConfig.format)
      : embeddedMeta
      ? getTournamentFormatLabel(embeddedMeta.format)
      : (isDemoCode ? DEMO_TOURNAMENT.format : ""),
    timeControl: resolvedConfig?.timePreset ?? embeddedMeta?.timePreset ?? (isDemoCode ? DEMO_TOURNAMENT.timeControl : ""),
    date: formatJoinDate(resolvedConfig?.date ?? embeddedMeta?.date ?? (isDemoCode ? DEMO_TOURNAMENT.date : undefined)),
    playerCount: (() => {
      if (isDemoCode) return DEMO_TOURNAMENT.players.length;
      if (!resolvedConfig) return 0;
      try {
        const raw = localStorage.getItem(`otb-director-state-v2-${resolvedConfig.id}`);
        if (raw) return JSON.parse(raw)?.state?.players?.length ?? 0;
      } catch { /* fall through */ }
      return serverTournamentStatus?.playerCount ?? 0;
    })(),
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

  // Block registration when the tournament has already been completed or is no longer
  // accepting players. Reads from the same localStorage key as isTournamentFull.
  const isTournamentClosed = (() => {
    if (!resolvedConfig || isDemoCode) return false;
    try {
      const raw = localStorage.getItem(`otb-director-state-v2-${resolvedConfig.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const status: string = parsed?.state?.status ?? "";
        return status === "completed" || status === "in_progress" || status === "paused";
      }
      // Fall back to server-fetched status when localStorage is empty (fresh device)
      if (serverTournamentStatus) {
        const s = serverTournamentStatus.status;
        return s === "completed" || s === "in_progress" || s === "paused";
      }
      return false;
    } catch {
      return false;
    }
  })();

  // Whether the tournament is specifically completed (not just closed)
  const isTournamentCompleted = (() => {
    if (!resolvedConfig || isDemoCode) return false;
    try {
      const raw = localStorage.getItem(`otb-director-state-v2-${resolvedConfig.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed?.state?.status ?? "") === "completed";
      }
      return serverTournamentStatus?.status === "completed";
    } catch { return false; }
  })();

  // Real player count: prefer localStorage, fall back to server
  const realPlayerCount = (() => {
    if (isDemoCode) return DEMO_TOURNAMENT.players.length;
    if (!resolvedConfig) return 0;
    try {
      const raw = localStorage.getItem(`otb-director-state-v2-${resolvedConfig.id}`);
      if (raw) return JSON.parse(raw)?.state?.players?.length ?? 0;
    } catch { /* fall through */ }
    return serverTournamentStatus?.playerCount ?? 0;
  })();


  // Fetch server status when resolvedConfig is available — needed for fresh devices
  // where localStorage is empty and we can't read status from director state
  useEffect(() => {
    if (!resolvedConfig) return;
    const localRaw = localStorage.getItem(`otb-director-state-v2-${resolvedConfig.id}`);
    if (localRaw) return; // localStorage has data, no need to fetch
    authFetch(`/api/public/tournament/${encodeURIComponent(resolvedConfig.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { status?: string; players?: unknown[] } | null) => {
        if (!d) return;
        setServerTournamentStatus({
          status: d.status ?? "",
          playerCount: Array.isArray(d.players) ? d.players.length : 0,
          tournamentId: resolvedConfig.id,
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedConfig?.id]);

 const [codeLoading, setCodeLoading] = useState(false);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = tournamentCode.trim();
    if (!code) return;

    // If already resolved locally (localStorage or demo), advance immediately
    if (isValidCode) {
      setError("");
      advanceStep("username");
      // Contextual PWA install prompt: surface after successful code entry
      // (only fires on Android Chrome when a native prompt is available)
      if (canPromptNatively) triggerForJoin();
      return;
    }

    // Not found locally — try server-side resolve
    setCodeLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/auth/join/resolve/${encodeURIComponent(code)}`);
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
        date?: string | null;
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
          date: data.date ?? "",
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
      // Contextual PWA install prompt: surface after successful server-side code resolution
      if (canPromptNatively) triggerForJoin();
    } catch {
      setCodeLoading(false);
      setError("Could not verify tournament code. Check your connection and try again.");
    }
  }

  async function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    if (manualRating.trim() && parseManualRating(manualRating) === null) {
      setError("Enter a manual pairing rating from 100 to 3500.");
      return;
    }
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
        setManualRatingUsed(false);
        setUnifiedProfile(raw as UnifiedProfile);
        advanceStep("confirm");
      }
    }
    if (lookupStatus === "not_found" || lookupStatus === "error") {
      const fallbackRating = parseManualRating(manualRating);
      if (fallbackRating) {
        setManualRatingUsed(true);
        setUnifiedProfile(createManualJoinProfile(username, playerName, fallbackRating, platform));
        setError("");
        advanceStep("confirm");
      } else {
        if (isRateLimitError(lookupError)) showCapToast("rate_limited", 60);
        setError(
          isRateLimitError(lookupError)
            ? "The profile provider is limiting requests. Wait 60 seconds or enter a manual pairing rating."
            : `${lookupError || "Rating unavailable."} Enter a manual pairing rating to continue.`,
        );
      }
    }
  }, [lookupStatus, step, active.profile, lookupError, manualRating, username, playerName, platform, advanceStep]);

  const [confirming, setConfirming] = useState(false);
  const qrRegistrationInFlightRef = useRef(false);
  const [capToast, setCapToast] = useState<{ type: RegistrationIssue; retryAfterSeconds?: number } | null>(null);

  function showCapToast(type: RegistrationIssue, retryAfterSeconds?: number) {
    setCapToast({ type, retryAfterSeconds });
    setTimeout(() => setCapToast(null), type === "rate_limited" ? 8000 : 5000);
  }

  const capToastPresentation = capToast ? getRegistrationIssuePresentation(capToast.type, capToast.retryAfterSeconds) : null;
  const spectatorTournamentId = resolvedConfig?.id ?? embeddedMeta?.id ?? serverTournamentStatus?.tournamentId;

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
    if (isTournamentClosed) { showCapToast("closed"); return; }
    if (isTournamentFull) { showCapToast("full"); return; }
    if (!username.trim()) { setError("Enter your chess.com username."); return; }
    if (manualRating.trim() && parseManualRating(manualRating) === null) {
      setError("Enter a manual pairing rating from 100 to 3500.");
      return;
    }
    setConfirming(true);
    setError("");
    await active.lookup(username.trim());
    // The useEffect below will fire once lookupStatus changes to success/error
  }

  // When QR mode lookup succeeds, auto-register and navigate to tournament
  useEffect(() => {
    if (!isQrMode || !confirming) return;
    const fallbackRating = parseManualRating(manualRating);
    const fallbackProfile = (lookupStatus === "not_found" || lookupStatus === "error") && fallbackRating
      ? createManualJoinProfile(username, playerName, fallbackRating, platform)
      : null;
    if (lookupStatus === "success" || fallbackProfile) {
      if (qrRegistrationInFlightRef.current) return;
      qrRegistrationInFlightRef.current = true;
      void (async () => {
      try {
      const raw = fallbackProfile ?? active.profile;
      if (!raw) return;
      const prof = raw as UnifiedProfile;
      setManualRatingUsed(Boolean(fallbackProfile));
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
          ...(prof.manualRating ? { manualPairingRating: prof.elo, pairingRating: prof.elo, ratingSource: "manual" as const } : {}),
          joinedAt: Date.now(),
        };
        const result = addPlayerToTournament(config.id, player);
        if (!result.success) {
          setConfirming(false);
          showCapToast(mapAddPlayerIssue(result.reason));
          return;
        }
        // Confirm the authoritative roster write before showing success.
        const sync = await postPlayerToServer(config.id, player);
        if (!sync.success) {
          removeJoinedPlayerFromTournament(config.id, player.id);
          setConfirming(false);
          showCapToast(sync.reason, sync.retryAfterSeconds);
          return;
        }
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
        navigate(`/tournament/${config.id}/play?username=${encodeURIComponent(prof.username)}&name=${encodeURIComponent(playerName.trim() || prof.name || prof.username)}`);
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
            ...(prof.manualRating ? { manualPairingRating: prof.elo, pairingRating: prof.elo, ratingSource: "manual" as const } : {}),
            joinedAt: Date.now(),
          };
          const result = addPlayerToTournament(bootstrapped.id, player);
          if (!result.success) {
            setConfirming(false);
            showCapToast(mapAddPlayerIssue(result.reason));
            return;
          }
          const sync = await postPlayerToServer(bootstrapped.id, player);
          if (!sync.success) {
            removeJoinedPlayerFromTournament(bootstrapped.id, player.id);
            setConfirming(false);
            showCapToast(sync.reason, sync.retryAfterSeconds);
            return;
          }
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
          navigate(`/tournament/${bootstrapped.id}/play?username=${encodeURIComponent(prof.username)}&name=${encodeURIComponent(playerName.trim() || prof.name || prof.username)}`);
        } else {
          setConfirming(false);
          setError("Tournament not found. Ask the director to share the QR code again.");
        }
      } else {
        setConfirming(false);
        setError("Tournament not found. Check the code and try again.");
      }
      } finally {
        qrRegistrationInFlightRef.current = false;
      }
      })();
    } else if (lookupStatus === "not_found" || lookupStatus === "error") {
      setConfirming(false);
      if (isRateLimitError(lookupError)) showCapToast("rate_limited", 60);
      setError(
        isRateLimitError(lookupError)
          ? "The profile provider is limiting requests. Wait 60 seconds or enter a manual pairing rating."
          : `${lookupError || "Rating unavailable."} Enter a manual pairing rating to continue.`,
      );
    }
  }, [lookupStatus, isQrMode, confirming, active.profile, embeddedMeta, lookupError, tournamentCode, playerName, username, manualRating, platform, navigate]);

  async function handleConfirm() {
    if (isTournamentClosed) { showCapToast("closed"); return; }
    if (isTournamentFull) { showCapToast("full"); return; }
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
        ...(profile.manualRating ? { manualPairingRating: profile.elo, pairingRating: profile.elo, ratingSource: "manual" as const } : {}),
        joinedAt: Date.now(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      };
      if (config) {
        const result = addPlayerToTournament(config.id, player);
        if (!result.success) {
          setConfirming(false);
          showCapToast(mapAddPlayerIssue(result.reason));
          return;
        }
        const sync = await postPlayerToServer(config.id, player);
        if (!sync.success) {
          removeJoinedPlayerFromTournament(config.id, player.id);
          setConfirming(false);
          showCapToast(sync.reason, sync.retryAfterSeconds);
          return;
        }
      } else if (embeddedMeta?.id) {
        // Fresh device — no localStorage yet; post directly to server using the
        // tournament ID embedded in the QR ?t= payload.
        const sync = await postPlayerToServer(embeddedMeta.id, player);
        if (!sync.success) {
          setConfirming(false);
          showCapToast(sync.reason, sync.retryAfterSeconds);
          return;
        }
      } else {
        setConfirming(false);
        showCapToast("invalid");
        return;
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
      navigate(`/tournament/${resolvedId}/play?username=${encodeURIComponent(profile.username)}&name=${encodeURIComponent(playerName.trim() || profile.name || profile.username)}`);
      return;
    }
    advanceStep("success");
  }

  // -- Shared style tokens -----------------------------------------------------
  const bg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]";
  const card = isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-[#ADBC9F]/70/80";
  const inputBase = `mobile-input ${isDark
    ? "!bg-[oklch(0.26_0.06_145)] !border-white/12 !text-white placeholder:text-white/25 focus:!border-[#4CAF50] focus:!shadow-[0_0_0_3px_oklch(0.55_0.13_145/0.20)]"
    : "!bg-white !border-[#ADBC9F] !text-[#12372A] placeholder:text-[#436850]/70 focus:!border-[#436850] focus:!shadow-[0_0_0_3px_oklch(0.44_0.12_145/0.10)]"}`;
  const labelCls = isDark ? "text-white/45" : "text-[#436850]";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/40" : "text-[#436850]";
  const divider = isDark ? "bg-white/06" : "bg-[#ADBC9F]/40";

  return (
    <div className={`min-h-screen ${bg} flex flex-col transition-colors duration-300`}
      style={{ WebkitTapHighlightColor: "transparent" }}>

      {/* -- Header ----------------------------------------------------------- */}
      <header className={`flex items-center justify-between px-4 pt-safe-top pb-3 pt-3 border-b ${
        isDark ? "border-white/06 bg-[oklch(0.18_0.05_145)]" : "border-[#ADBC9F]/70 bg-[#F7FAF8]"
      } sticky top-0 z-30 backdrop-blur-md otb-header-safe`}
        style={{ paddingTop: `max(env(safe-area-inset-top), 0.75rem)` }}>
        <div className="flex items-center gap-3">
          {step !== "code" && step !== "success" && (
            <button
              onClick={() => {
                if (step === "username") advanceStep("code");
                else if (step === "confirm") { advanceStep("username"); active.reset(); setUnifiedProfile(null); }
              }}
              className={`touch-target -ml-2 rounded-xl ${isDark ? "text-white/60 hover:text-white" : "text-[#436850] hover:text-[#12372A]"} transition-colors`}
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
      {capToast && capToastPresentation && (
        <div
          className={`fixed top-[calc(env(safe-area-inset-top)+60px)] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-slide-down-fade ${
            capToastPresentation.tone === "amber"
              ? isDark
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                : "bg-amber-50 border border-amber-300 text-amber-800"
              : capToastPresentation.tone === "blue"
                ? isDark
                  ? "bg-blue-500/15 border border-blue-500/30 text-blue-300"
                  : "bg-blue-50 border border-blue-300 text-blue-800"
                : isDark
                  ? "bg-red-500/15 border border-red-500/30 text-red-300"
                  : "bg-red-50 border border-red-300 text-red-800"
          } rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-lg`}
          role="alert"
        >
          <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center ${
            capToastPresentation.tone === "amber"
              ? "bg-amber-400/20"
              : capToastPresentation.tone === "blue"
                ? "bg-blue-400/20"
                : "bg-red-400/20"
          }`}>
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">
              {capToastPresentation.title}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {capToastPresentation.message}
            </p>
            {capToast.type === "closed" && spectatorTournamentId && (
              <Link
                href={`/tournament/${spectatorTournamentId}`}
                className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-current/25 px-3 text-xs font-bold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
              >
                View pairings and results
              </Link>
            )}
          </div>
          <button
            onClick={() => setCapToast(null)}
            className="-mr-2 -mt-2 flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center text-lg leading-none opacity-60 transition-opacity hover:opacity-100"
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

          {/* Tournament info chip — QR flows use the primary hero heading instead. */}
          {!isQrMode && step !== "code" && step !== "success" && (
            <div key={`chip-${stepKey}`} className={`animate-slide-down-fade rounded-2xl border px-4 py-3 flex items-center gap-3 ${
              isDark ? "bg-[#436850]/12 border-[#4CAF50]/18" : "bg-[#436850]/05 border-[#436850]/12"
            }`}>
              <div className="w-9 h-9 bg-[#436850] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#436850]/30">
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
                  <span className={`text-xs ${isDark ? "text-white/15" : "text-[#436850]/50"}`}>·</span>
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <Users className="w-2.5 h-2.5" />{tournamentDisplay.playerCount} players
                  </span>
                  <span className={`text-xs ${isDark ? "text-white/15" : "text-[#436850]/50"}`}>·</span>
                  <span className={`text-xs flex items-center gap-1 ${textMuted}`}>
                    <CalendarDays className="w-2.5 h-2.5" />{tournamentDisplay.date}
                  </span>
                  <span className={`text-xs ${isDark ? "text-white/15" : "text-[#436850]/50"}`}>·</span>
                  <span className={`text-xs ${textMuted}`}>{tournamentDisplay.format}</span>
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
                    ? "bg-[#436850]/15 border-[#4CAF50]/25"
                    : "bg-[#436850]/06 border-[#436850]/18"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDark ? "bg-[#4CAF50]/20" : "bg-[#436850]/12"
                    }`}>
                      <CheckCircle2 className={`w-5 h-5 ${
                        isDark ? "text-[#4CAF50]" : "text-[#436850]"
                      }`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${
                        isDark ? "text-[#4CAF50]" : "text-[#436850]"
                      }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                        Already registered
                      </p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${
                        isDark ? "text-white/55" : "text-[#436850]"
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
                          isDark ? "text-white/40 hover:text-white/60" : "text-[#436850] hover:text-[#436850]"
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
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                    alt="OTB!!"
                    className="w-16 h-16 object-contain drop-shadow-lg"
                    style={{ mixBlendMode: "screen" }}
                  />
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
                <label htmlFor="tournament-code" className={`mobile-section-label block mb-2 ${labelCls}`}>
                  Tournament Code
                </label>
                <div className="relative">
                  <Hash className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted} pointer-events-none`} />
                  <input
                    aria-label="Tournament Code"
                    id="tournament-code"
                    type="text"
                    value={tournamentCode}
                    onChange={(e) => { setTournamentCode(e.target.value.toUpperCase()); setError(""); }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const raw = e.clipboardData.getData("text");
                      // Extract code from a /join/:code URL if pasted
                      const urlMatch = raw.match(/\/join\/([A-Za-z0-9]+)/);
                      const code = urlMatch
                        ? urlMatch[1].toUpperCase()
                        : raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
                      setTournamentCode(code);
                      setError("");
                    }}
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
                  <div className={`flex items-start gap-2 text-xs mt-2.5 px-3 py-2.5 rounded-xl border ${
                    isDark ? "bg-red-500/10 border-red-500/25 text-red-300" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setTournamentCode("OTB2026"); setError(""); }}
                  className={`mt-3 text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#436850]"} underline underline-offset-2`}
                >
                  Try the demo → OTB2026
                </button>
                <button
                  type="button"
                  onClick={() => setShowQrScanner(true)}
                  className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                    isDark ? "border-white/15 text-white/75 hover:bg-white/06" : "border-[#436850]/25 text-[#436850] hover:bg-[#436850]/06"
                  }`}
                >
                  <Camera className="h-4 w-4" /> Scan QR code
                </button>
                <p className={`mt-2 text-center text-[11px] leading-relaxed ${textMuted}`}>
                  Camera access is requested only after you tap Scan QR code.
                </p>
              </div>
            </div>
          )}
          {/* == QR MODE — AUTH GATE (shown before chess.com form for unauthenticated users) */}
          {isQrMode && step === "username" && needsAuth && (
            <div key={`auth-gate-${stepKey}`} className="animate-spring-in space-y-5">
              {/* Hero */}
              <div className="text-center pt-6 pb-2">
                <div className="w-20 h-20 flex items-center justify-center mx-auto mb-5">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                    alt="OTB!!"
                    className="w-20 h-20 object-contain drop-shadow-lg"
                    style={{ mixBlendMode: "screen" }}
                  />
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
                        aria-label="Auth Name"
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
                      aria-label="Auth Email"
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
                        aria-label="Auth Password"
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
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition ${isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#436850]"}`}
                      tabIndex={-1}
                    >
                      {authShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {authMode === "signup" && authPassword && (
                    <div className="mt-2 space-y-1">
                      <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`}>
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
                        aria-label="Auth Username"
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
                    className={`text-sm font-medium underline underline-offset-2 ${isDark ? "text-white/50 hover:text-white/80" : "text-[#436850] hover:text-[#12372A]"}`}
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
                <div className="w-20 h-20 flex items-center justify-center mx-auto mb-5">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                    alt="OTB!!"
                    className="w-20 h-20 object-contain drop-shadow-lg"
                    style={{ mixBlendMode: "screen" }}
                  />
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
                <div className={`mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs ${textMuted}`}>
                  <span>{tournamentDisplay.format}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{tournamentDisplay.date}</span>
                  {tournamentDisplay.timeControl && <><span aria-hidden="true">·</span><span>{tournamentDisplay.timeControl}</span></>}
                </div>
              </div>

              {/* Already registered banner */}
              {existingReg && (
                <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
                  isDark ? "bg-[#436850]/15 border-[#4CAF50]/25" : "bg-[#436850]/06 border-[#436850]/18"
                }`}>
                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    isDark ? "text-[#4CAF50]" : "text-[#436850]"
                  }`} strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${
                      isDark ? "text-[#4CAF50]" : "text-[#436850]"
                    }`}>Already registered</p>
                    <p className={`text-xs mt-0.5 ${isDark ? "text-white/55" : "text-[#436850]"}`}>
                      <span className="font-semibold">{existingReg.name}</span> ({existingReg.rating} ELO)
                    </p>
                    <button
                      type="button"
                      onClick={() => { clearRegistration(existingReg.tournamentId, existingReg.username); setExistingReg(null); }}
                      className={`mt-1.5 text-xs font-medium underline underline-offset-2 ${
                        isDark ? "text-white/40 hover:text-white/60" : "text-[#436850] hover:text-[#436850]"
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
                      aria-label="Player Name"
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
                      aria-label="Chesscom Username"
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

                <ManualRatingField
                  inputId="qr-manual-pairing-rating"
                  value={manualRating}
                  onChange={(value) => { setManualRating(value); setError(""); }}
                  inputClassName={inputBase}
                  labelClassName={labelCls}
                  mutedClassName={textMuted}
                  providerLabel="Chess.com"
                />

                {error && (
                  <div className={`flex items-start gap-2 text-sm px-3 py-2.5 rounded-xl border ${
                    isDark ? "bg-red-500/10 border-red-500/25 text-red-300" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
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
                          ? isDark ? "bg-[#436850]/30 text-[#4CAF50] shadow-sm" : "bg-[#436850]/10 text-[#436850] shadow-sm"
                          : isDark ? "bg-orange-400/20 text-orange-300 shadow-sm" : "bg-orange-50 text-orange-600 shadow-sm"
                        : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#436850]"
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
                      aria-label="Platform Username"
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
                          : "bg-[#436850]/10 text-[#436850] hover:bg-[#436850]/18"
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
                    <div className={`flex items-start gap-2 text-xs mt-2.5 px-3 py-2.5 rounded-xl border ${
                      isDark ? "bg-red-500/10 border-red-500/25 text-red-300" : "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <ManualRatingField
                  inputId="manual-flow-pairing-rating"
                  value={manualRating}
                  onChange={(value) => { setManualRating(value); setError(""); }}
                  inputClassName={inputBase}
                  labelClassName={labelCls}
                  mutedClassName={textMuted}
                  providerLabel={platform === "chesscom" ? "Chess.com" : "Lichess"}
                />
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
                    : "from-[#436850] via-[#4CAF50] to-[#436850]"
                }`} />

                <div className="p-5 space-y-4">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-[#436850]/12 flex items-center justify-center overflow-hidden">
                        {profile.avatar ? (
                          <img src={`/api/avatar-proxy?url=${encodeURIComponent(profile.avatar)}`} alt={profile.username} className="w-full h-full object-cover" crossOrigin="anonymous" />
                        ) : (
                          <span className="text-2xl font-bold text-[#436850]"
                            style={{ fontFamily: "'Clash Display', sans-serif" }}>
                            {profile.username[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${
                        isDark ? "border-[oklch(0.22_0.06_145)]" : "border-white"
                      } ${profile.platform === "chesscom" && (profile as ChessComProfile).status === "online" ? "status-dot-online" : "status-dot-offline"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-xl leading-tight ${textMain}`}
                          style={{ fontFamily: "'Clash Display', sans-serif" }}>
                          {profile.name ?? profile.username}
                        </span>
                        {profile.title && (
                          <span className="text-xs font-bold text-[#436850] bg-[#436850]/10 px-2 py-0.5 rounded-md">
                            {profile.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-sm ${textMuted}`}>@{profile.username}</p>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                          profile.platform === "lichess"
                            ? isDark ? "bg-orange-400/15 text-orange-300" : "bg-orange-50 text-orange-600"
                            : isDark ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/20" : "bg-[#436850]/10 text-[#436850] border border-[#436850]/15"
                        }`}>
                          {profile.platform === "lichess" ? "Lichess" : "Chess.com"}
                        </span>
                      </div>
                      <p className={`mt-1 inline-flex items-center gap-1 text-xs ${textMuted}`}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {manualRatingUsed
                          ? "Rating entered manually; not platform or federation verified"
                          : <>Profile matched on {profile.platform === "lichess" ? "Lichess" : "Chess.com"}; not federation verification</>}
                      </p>
                    </div>
                  </div>

                  {/* ELO count-up */}
                  <div>
                    <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }`}</style>
                    <div className="grid grid-cols-3 gap-2">
                      {manualRatingUsed ? (
                        <div className="col-span-3">
                          <EloStatBox label="Manual rating" target={profile.elo} isPrimary={true} isDark={isDark} textMain={textMain} textMuted={textMuted} />
                        </div>
                      ) : profile.platform === "lichess" ? (
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
                    <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs ${isDark ? "bg-[#4CAF50]/08 text-white/70" : "bg-[#436850]/06 text-[#436850]"}`}>
                      <span>Pairing rating</span>
                      <strong>{manualRatingUsed ? "Manual" : resolvedConfig?.ratingType === "blitz" ? "Blitz" : "Rapid"} · {pickRating(profile, resolvedConfig?.ratingType)}</strong>
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
                  <div className={`rounded-xl px-4 py-3 space-y-2 ${isDark ? "bg-white/04" : "bg-[#FBFADA]/70"}`}>
                    {[
                      { icon: Trophy, text: tournamentDisplay.name },
                      { icon: MapPin, text: tournamentDisplay.venue },
                      { icon: CalendarDays, text: tournamentDisplay.date },
                      { icon: Clock, text: `${tournamentDisplay.timeControl} · ${tournamentDisplay.format}` },
                      { icon: Users, text: `${tournamentDisplay.playerCount} players registered` },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2.5">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
                        <span className={`text-sm ${isDark ? "text-white/70" : "text-[#436850]"}`}>{text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => advanceStep("username")}
                      className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${isDark ? "border-white/15 text-white/75" : "border-[#436850]/25 text-[#436850]"}`}
                    >
                      Edit profile
                    </button>
                    {!isQrMode ? (
                      <button
                        type="button"
                        onClick={() => advanceStep("code")}
                        className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${isDark ? "border-white/15 text-white/75" : "border-[#436850]/25 text-[#436850]"}`}
                      >
                        Change tournament
                      </button>
                    ) : <div aria-hidden="true" />}
                  </div>

                  <PlayerPaymentMethods payments={resolvedConfig ?? {}} isDark={isDark} />
                  {/* -- Optional contact fields --------------------------- */}
                  <div className={`h-px ${divider}`} />
                  <div className="space-y-3">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>Contact (optional)</p>
                    <p className={`text-xs ${textMuted}`}>Let the director send you your results after the tournament.</p>
                    {/* Phone */}
                    <div className="relative">
                      <Phone className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? "text-white/25" : "text-[#436850]/70"}`} />
                      <input
                        aria-label="Phone / WhatsApp number"
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
                      <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? "text-white/25" : "text-[#436850]/70"}`} />
                      <input
                        aria-label="Email address"
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
                <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-xl border ${
                  isDark ? "bg-red-500/10 border-red-500/25 text-red-300" : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
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
                  <div className="w-20 h-20 bg-[#436850] rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-[#436850]/30">
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
                  <span className={`font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
                    {profile.name ?? profile.username}
                  </span>
                </p>
              </div>

              {/* Registration card */}
              <div className={`mobile-card border ${card}`}>
                <div className="h-1 bg-gradient-to-r from-[#436850] via-[#4CAF50] to-[#436850]" />
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
                      <p className={`text-xl font-bold tabular-nums ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}
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
                    <div className={`rounded-xl overflow-hidden ${isDark ? "bg-[#436850]/20" : "bg-[#436850]/08"}`}>
                      <NotifyBell
                        tournamentId={resolvedConfig.id}
                        tournamentName={tournamentDisplay.name}
                        className={isDark ? "!bg-transparent !border-0" : "!bg-transparent !border-0"}
                      />
                    </div>
                  )}

                  {/* What's next */}
                  <div className={`rounded-xl px-4 py-3 ${isDark ? "bg-[#436850]/15" : "bg-[#436850]/06"}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
                      What's next
                    </p>
                    <ul className="space-y-1.5">
                      {[
                        "Check in with the director when you arrive",
                        "Round timing is announced by the director",
                        "Open the tournament dashboard to find your board and pairings",
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
                            {i + 1}.
                          </span>
                          <span className={`text-xs ${isDark ? "text-white/60" : "text-[#436850]"}`}>{item}</span>
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
                  <div className="w-12 h-12 bg-[#436850] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-[#436850]/25">
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
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/30 group-hover:text-white/60" : "text-[#436850]/70 group-hover:text-[#436850]"} transition-colors`} />
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
              <>Find My Profile <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        )}

        {step === "confirm" && profile && (
          <div className="space-y-2">
            {isTournamentClosed && (
              <div className={`rounded-2xl border overflow-hidden ${
                isDark ? "border-white/08 bg-[oklch(0.22_0.06_145)]" : "border-[#ADBC9F]/50 bg-white"
              }`}>
                <div className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium ${
                  isDark ? "bg-red-500/08 border-b border-red-500/20 text-red-300" : "bg-red-50 border-b border-red-200 text-red-800"
                }`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{isTournamentCompleted ? "This tournament has concluded." : "Registration is closed — this tournament has already started."}</span>
                </div>
                {isTournamentCompleted && resolvedConfig && (
                  <div className="px-4 py-3">
                    <a
                      href={`/tournament/${resolvedConfig.id}/results`}
                      className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-bold transition-colors ${
                        isDark ? "bg-[#436850]/20 text-[#4CAF50] hover:bg-[#436850]/30" : "bg-[#436850]/08 text-[#436850] hover:bg-[#436850]/15"
                      }`}
                    >
                      <Trophy className="w-4 h-4" />
                      View Results
                    </a>
                  </div>
                )}
              </div>
            )}
            {!isTournamentClosed && isTournamentFull && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
                isDark ? "bg-amber-500/12 border border-amber-500/25 text-amber-300" : "bg-amber-50 border border-amber-300 text-amber-800"
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>This tournament is full. Ask the director to increase the player cap.</span>
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={loading || isTournamentFull || isTournamentClosed}
              className="mobile-cta disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
              ) : isTournamentClosed ? (
                <><AlertCircle className="w-4 h-4" /> Registration Closed</>
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

      {showQrScanner && (
        <QrScanner
          isDark={isDark}
          onClose={() => setShowQrScanner(false)}
          onScan={(code) => {
            setTournamentCode(code.toUpperCase());
            setError("");
            setShowQrScanner(false);
          }}
          onScanUrl={(rawUrl) => {
            try {
              const parsed = new URL(rawUrl, window.location.origin);
              if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith("/join/")) {
                throw new Error("invalid join URL");
              }
              setShowQrScanner(false);
              navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`);
            } catch {
              setShowQrScanner(false);
              setError("That QR code is not a ChessOTB tournament link. Enter the invite code instead.");
            }
          }}
        />
      )}

      {/* -- Bottom branding --------------------------------------------------- */}
    </div>
  );
}
