/*
 * OTB Chess — Tournament Creation Wizard (Full-Screen Redesign)
 *
 * Two-path onboarding:
 *   - Mode Select: choose "Quickstart" or "Schedule Tournament"
 *   - Quickstart: single screen — name, location, auto-filled today's date
 *                 smart defaults applied (Swiss, 5 rounds, 16 players, 10+5, chess.com)
 *                 skips directly to Share step
 *   - Schedule Tournament: full 4-step wizard (existing flow, renamed)
 *
 * Design philosophy:
 *   - Full viewport canvas — no modal chrome, no scroll
 *   - Two-column layout on desktop: left = contextual hero, right = focused inputs
 *   - One primary action per step — no cognitive overload
 *   - Thin top progress bar + minimal step labels
 *   - Smooth horizontal slide transitions between steps
 *   - Consistent with platform design system (green/white, Clash Display, OKLCH)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { BracketPreview } from "@/components/tournament/BracketPreview";
import { useAuthContext } from "@/context/AuthContext";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { useConfetti } from "@/hooks/useConfetti";
import { useKeyboardScroll } from "@/hooks/useKeyboardScroll";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { useLocation } from "wouter";
import {recommendedRounds, roundsHint} from "@/lib/recommendedRounds";
import { registerTournament, makeSlug, generateDirectorCode, grantDirectorSession } from "@/lib/tournamentRegistry";
import { encodeMetaParam } from "@/lib/base64";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Clock,
  Users,
  MapPin,
  Calendar,
  Link2,
  Check,
  Copy,
  Share2,
  Shuffle,
  BarChart3,
  Zap,
  ArrowRight,
  Shield as _Shield,
  Eye,
  EyeOff as _EyeOff,
  Bolt,
  ChevronDown,
  Tv2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hash,
  Users2,
  Timer,
  Globe,
} from "lucide-react";

import { authFetch } from "@/lib/apiFetch";
import { getFormatConfig } from "@/lib/formatRegistry";
import { apiListMyClubs } from "@/lib/clubsApi";
import type { Club } from "@/lib/clubRegistry";
// ─── Types ────────────────────────────────────────────────────────────────────

type WizardMode = "select" | "quickstart" | "schedule" | "large_event" | "brackets" | "quads";

interface WizardData {
  name: string;
  venue: string;
  date: string;
  description: string;
  format: "swiss" | "doubleswiss" | "roundrobin" | "elimination" | "swiss_elim" | "quads";
  rounds: number;
  /** For swiss_elim: number of Swiss rounds before elimination cutoff. */
  swissRounds?: number;
  /** For swiss_elim: number of players to advance to elimination bracket. */
  elimCutoff?: number;
  maxPlayers: number;
  timeBase: number;
  timeIncrement: number;
  timePreset: string;
  ratingSystem: "chess.com" | "lichess" | "fide" | "unrated";
  /** Which chess.com rating category to use for pairings */
  ratingType: "rapid" | "blitz";
  inviteCode: string;
  /** Private director access code shown only to the tournament creator. */
  directorCode: string;
  /** Optional club this tournament is linked to. */
  clubId: string | null;
  /** Display name of the linked club. */
  clubName: string | null;
  /** Optional custom short URL slug chosen by the host, e.g. "ThursdayOTBNight" */
  customSlug: string;
  /** Optional cover image data URL for the tournament hero banner. */
  coverImageUrl: string;
  /** Whether this tournament will be split into rating brackets post-registration. */
  isBracketParent?: boolean;
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DEFAULT_DATA: WizardData = {
  name: "",
  venue: "",
  date: "",
  description: "",
  format: "swiss",
  rounds: 5,
  maxPlayers: 16,
  timeBase: 10,
  timeIncrement: 5,
  timePreset: "",
  ratingSystem: "chess.com",
  ratingType: "rapid",
  inviteCode: "",
  directorCode: "",
  clubId: null,
  clubName: null,
  customSlug: "",
  coverImageUrl: "",
  isBracketParent: false,
};

// ─── Schedule steps metadata ──────────────────────────────────────────────────

const OTB_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-thumbnail_8939ab7b.png";

const SCHEDULE_STEPS = [
  {
    id: 0,
    label: "Details",
    icon: Trophy,
    iconImg: OTB_LOGO_URL,
    hero: {
      eyebrow: "Step 1 of 4",
      title: "Name your\ntournament",
      body: "Give your event a name players will remember. Add a venue and date so everyone knows where to show up.",
    },
  },
  {
    id: 1,
    label: "Format",
    icon: Shuffle,
    hero: {
      eyebrow: "Step 2 of 4",
      title: "Choose a\nformat",
      body: "Swiss pairs players by score — ideal for large groups. Round Robin has everyone play everyone. Elimination is pure knockout drama.",
    },
  },
  {
    id: 2,
    label: "Time",
    icon: Clock,
    hero: {
      eyebrow: "Step 3 of 4",
      title: "Set the\nclock",
      body: "Pick a time control that fits your venue. Blitz keeps energy high. Rapid gives players room to think. Classical is for the purists.",
    },
  },
  {
    id: 3,
    label: "Share",
    icon: Share2,
    hero: {
      eyebrow: "Step 4 of 4",
      title: "You're\nready!",
      body: "Share the invite link or QR code with your players. They enter their chess.com username and you're off.",
    },
  },
];

// Quickstart hero panel content
const QUICKSTART_HERO = {
  label: "Quickstart",
  icon: Bolt,
  hero: {
    eyebrow: "Quickstart",
    title: "Start in\nseconds",
    body: "Just give your tournament a name and location. We'll set up Swiss pairings, 5 rounds, and 10+5 time control — you can adjust everything later.",
  },
};

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  green: "#436850",
  greenDark: "#2A4A32",
  greenBg: "rgba(77,105,64,0.08)",
  greenRing: "rgba(77,105,64,0.25)",
  // light
  lBg: "#FFFFFF",
  lPanel: "#F7F9F6",
  lBorder: "#E5E7EB",
  lBorderFocus: "#436850",
  lText: "#12372A",
  lSub: "#436850",
  lMuted: "#9CA3AF",
  lInput: "#FFFFFF",
  lInputBorder: "#D1D5DB",
  // dark
  dBg: "oklch(0.18 0.05 145)",
  dPanel: "oklch(0.22 0.06 145)",
  dCard: "oklch(0.25 0.07 145)",
  dBorder: "rgba(255,255,255,0.10)",
  dBorderFocus: "#436850",
  dText: "#FFFFFF",
  dSub: "rgba(255,255,255,0.55)",
  dMuted: "rgba(255,255,255,0.30)",
  dInput: "oklch(0.25 0.07 145)",
  dInputBorder: "rgba(255,255,255,0.12)",
};

// ─── Club Link Dropdown ─────────────────────────────────────────────────────

/**
 * Shown in the wizard for signed-in users who own at least one club.
 * Lets them link the new tournament to one of their clubs so it appears
 * on that club's Events page automatically.
 */
function ClubLinkDropdown({
  data,
  onChange,
  isDark,
  ownedClubs,
  loading,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
  ownedClubs: Club[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!loading && ownedClubs.length === 0) return null;

  const selected = ownedClubs.find((c) => c.id === data.clubId) ?? null;

  const handleSelect = (club: Club | null) => {
    onChange({ clubId: club?.id ?? null, clubName: club?.name ?? null });
    setOpen(false);
  };

  return (
    <div>
      <label
        className="block text-sm font-semibold mb-2"
        style={{ color: isDark ? "rgba(255,255,255,0.80)" : "#374151" }}
      >
        Link to Club
      </label>
      <div className="relative" ref={dropRef}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${
              open
                ? T.green
                : selected
                ? isDark ? "rgba(77,105,64,0.50)" : "#9DC4A8"
                : isDark ? T.dInputBorder : T.lInputBorder
            }`,
          }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
          ) : selected ? (
            <>
              {selected.avatarUrl ? (
                <img src={selected.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                  style={{ background: selected.accentColor || T.green }}
                >
                  {selected.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 text-sm font-semibold truncate" style={{ color: isDark ? T.dText : T.lText }}>
                {selected.name}
              </span>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: T.green }} />
            </>
          ) : (
            <>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(77,105,64,0.10)" }}
              >
                <Link2 className="w-3.5 h-3.5" style={{ color: isDark ? T.dMuted : T.lSub }} />
              </div>
              <span className="flex-1 text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                No club linked
              </span>
            </>
          )}
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
            style={{
              color: isDark ? T.dMuted : T.lMuted,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl border overflow-hidden shadow-xl"
            style={{
              background: isDark ? T.dPanel : "#FFFFFF",
              border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#E5E7EB"}`,
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.50)"
                : "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            {/* None option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-black/5"
              style={{
                background: !selected ? (isDark ? "rgba(77,105,64,0.12)" : "rgba(77,105,64,0.06)") : "transparent",
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(77,105,64,0.10)" }}
              >
                <XCircle className="w-3.5 h-3.5" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              </div>
              <span className="text-sm" style={{ color: isDark ? T.dSub : T.lSub }}>No club linked</span>
              {!selected && <Check className="w-3.5 h-3.5 ml-auto" style={{ color: T.green }} />}
            </button>

            {/* Owned clubs */}
            {ownedClubs.map((club) => (
              <button
                key={club.id}
                type="button"
                onClick={() => handleSelect(club)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-black/5"
                style={{
                  background:
                    data.clubId === club.id
                      ? isDark ? "rgba(77,105,64,0.15)" : "rgba(77,105,64,0.08)"
                      : "transparent",
                }}
              >
                {club.avatarUrl ? (
                  <img src={club.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: club.accentColor || T.green }}
                  >
                    {club.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: isDark ? T.dText : T.lText }}>
                    {club.name}
                  </p>
                  {club.location && (
                    <p className="text-xs truncate" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                      {club.location}
                    </p>
                  )}
                </div>
                {data.clubId === club.id && (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Helper text */}
      <p className="mt-1.5 text-xs" style={{ color: isDark ? T.dMuted : T.lMuted }}>
        {selected
          ? `This tournament will appear on the ${selected.name} events page.`
          : "Link this tournament to one of your clubs so it shows up on the club's events page."}
      </p>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total, isDark }: { step: number; total: number; isDark: boolean }) {
  return (
    <div className="absolute top-0 left-0 right-0 h-[3px] flex gap-[2px]" style={{ zIndex: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 transition-all duration-500"
          style={{
            background:
              i < step
                ? T.green
                : i === step
                ? `linear-gradient(90deg, ${T.green} 0%, ${isDark ? "rgba(255,255,255,0.12)" : "#E5E7EB"} 100%)`
                : isDark
                ? "rgba(255,255,255,0.10)"
                : "#E5E7EB",
            opacity: i <= step ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─── Hero Panel (left column) ─────────────────────────────────────────────────

function HeroPanel({
  step,
  isDark,
  mode,
  format,
  onClose,
}: {
  step: number;
  isDark: boolean;
  mode: "quickstart" | "schedule" | "large_event" | "brackets" | "quads";
  format?: string;
  onClose?: () => void;
}) {
  // For quickstart mode, use format-aware copy from FORMAT_REGISTRY
  const formatConfig = format ? getFormatConfig(format) : null;
  const quickstartHero = formatConfig
    ? {
        ...QUICKSTART_HERO,
        hero: {
          eyebrow: "Quickstart",
          title: formatConfig.wizardHeroTitle,
          body: formatConfig.wizardHeroBody,
        },
      }
    : QUICKSTART_HERO;
  const s = mode === "quickstart" ? quickstartHero : SCHEDULE_STEPS[step];
  const Icon = s.icon;
  const iconImg = (s as { iconImg?: string }).iconImg;

  const dots = mode === "quickstart" ? 2 : SCHEDULE_STEPS.length; // quickstart: mode-select + quickstart form
  const activeDot = mode === "quickstart" ? 1 : step;

  return (
    <div
      className="relative flex flex-col justify-between h-full px-10 py-12 overflow-hidden"
      style={{
        background: isDark
          ? "oklch(0.20 0.08 145)"
          : "linear-gradient(145deg, #1A3A22 0%, #2A5535 60%, #436850 100%)",
      }}
    >
      {/* Subtle chess-board texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Logo mark — clickable to close wizard */}
      <button
        onClick={onClose}
        className="relative flex items-center cursor-pointer group"
        aria-label="Close wizard and return to home"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
          alt="OTB Chess"
          style={{
            height: 36,
            width: "auto",
            objectFit: "contain",
            filter: "brightness(0) invert(1) opacity(0.85)",
            transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease",
          }}
          className="group-hover:scale-110 group-hover:opacity-100"
        />
      </button>

      {/* Step content */}
      <div className="relative" key={`${mode}-${step}`} style={{ animation: `heroIn 0.45s cubic-bezier(0.22,1,0.36,1) both` }}>
        <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-4">
          {s.hero.eyebrow}
        </p>
        <div className="flex items-start gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            {iconImg ? (
              <img src={iconImg} alt="OTB" className="w-5 h-5 object-contain drop-shadow-sm" />
            ) : (
              <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
            )}
          </div>
          <h2
            className="text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Clash Display', sans-serif", whiteSpace: "pre-line" }}
          >
            {s.hero.title}
          </h2>
        </div>
        <p className="text-white/55 text-sm leading-relaxed max-w-xs">{s.hero.body}</p>
      </div>

      {/* Step dots */}
      <div className="relative flex items-center gap-2">
        {Array.from({ length: dots }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-400"
            style={{
              width: i === activeDot ? 20 : 6,
              height: 6,
              background: i === activeDot ? "#FFFFFF" : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Input primitives ─────────────────────────────────────────────────────────

function Label({ children, hint, isDark }: { children: React.ReactNode; hint?: string; isDark: boolean }) {
  return (
    <div className="flex items-baseline gap-2 mb-3 lg:mb-5">
      <label className="text-base lg:text-xl font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.90)" : "#1F2937" }}>
        {children}
      </label>
      {hint && (
        <span className="text-sm lg:text-base" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  autoFocus,
  isDark,
  large,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
  autoFocus?: boolean;
  isDark: boolean;
  large?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hoverBorder = isDark ? "rgba(255,255,255,0.28)" : "#9CA3AF";
  const idleBorder = isDark ? T.dInputBorder : T.lInputBorder;
  const borderColor = focused ? T.green : hovered ? hoverBorder : idleBorder;
  const boxShadow = focused
    ? `0 0 0 3px ${T.greenRing}, 0 2px 8px rgba(67,104,80,0.12)`
    : hovered
    ? `0 1px 4px rgba(0,0,0,0.08)`
    : "none";
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
          style={{
            color: focused ? T.green : isDark ? T.dMuted : T.lMuted,
            transition: "color 0.18s ease",
          }}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-2xl border outline-none"
        style={{
          padding: large
            ? "18px 20px 18px 56px"
            : Icon
            ? "clamp(16px, 1.8vw, 18px) 18px clamp(16px, 1.8vw, 18px) 52px"
            : "clamp(16px, 1.8vw, 18px) 20px",
          fontSize: large ? "clamp(22px, 2vw, 26px)" : "clamp(16px, 1.2vw, 18px)",
          fontWeight: large ? 600 : 400,
          background: isDark ? T.dInput : T.lInput,
          border: `2px solid ${borderColor}`,
          boxShadow,
          color: isDark ? T.dText : T.lText,
          lineHeight: "1.5",
          transition: "border-color 0.18s ease, box-shadow 0.22s ease, background 0.18s ease",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setHovered(false); }}
      />
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isDark: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hoverBorder = isDark ? "rgba(255,255,255,0.28)" : "#9CA3AF";
  const idleBorder = isDark ? T.dInputBorder : T.lInputBorder;
  const borderColor = focused ? T.green : hovered ? hoverBorder : idleBorder;
  const boxShadow = focused
    ? `0 0 0 3px ${T.greenRing}, 0 2px 8px rgba(67,104,80,0.12)`
    : hovered
    ? `0 1px 4px rgba(0,0,0,0.08)`
    : "none";
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full rounded-2xl border outline-none resize-none"
      style={{
        padding: "16px 20px",
        fontSize: 17,
        lineHeight: "1.6",
        background: isDark ? T.dInput : T.lInput,
        border: `2px solid ${borderColor}`,
        boxShadow,
        color: isDark ? T.dText : T.lText,
        transition: "border-color 0.18s ease, box-shadow 0.22s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setHovered(false); }}
    />
  );
}

// ─── Mode Selection Screen ────────────────────────────────────────────────────

function ModeSelect({
  isDark,
  onSelect,
  onClose,
}: {
  isDark: boolean;
  onSelect: (mode: "quickstart" | "schedule" | "large_event" | "brackets" | "quads") => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-y-auto"
      style={{
        background: isDark
          ? "oklch(0.14 0.04 145)"
          : "linear-gradient(145deg, #1A3A22 0%, #2A5535 60%, #436850 100%)",
        animation: "wizardFadeIn 0.3s ease both",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      {/* Chess-board texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Close button — fixed position so it always floats above scrollable content */}
      <button
        onClick={onClose}
        className="fixed right-4 w-12 h-12 rounded-full flex items-center justify-center transition-colors"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          zIndex: 210,
          background: "rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.70)",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)"; }}
        aria-label="Close wizard"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="relative w-full max-w-5xl mx-auto px-6 sm:px-10 pb-12 sm:pb-16 flex flex-col items-center gap-6 sm:gap-8" style={{ paddingTop: "max(4rem, calc(env(safe-area-inset-top) + 3.5rem))" }}>
        {/* Logo */}
        <img
          src="/manus-storage/otbchesslogo_brilliant_v2_04cf93cb.webp"
          alt="OTB!!"
          style={{ height: 56, width: "auto", objectFit: "contain" }}
        />

        {/* Headline */}
        <div className="text-center">
          <h2
            className="text-2xl sm:text-5xl font-black text-white leading-tight mb-2 sm:mb-3"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Create a Tournament
          </h2>
          <p className="text-white/50 text-base">How would you like to get started?</p>
        </div>

        {/* Mode cards — 2-col grid on mobile, 2-col on desktop */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-6 lg:max-w-5xl">
          {/* Quickstart */}
          <button
            type="button"
            onClick={() => onSelect("quickstart")}
            aria-label="Quickstart — set up a tournament in under 30 seconds"
            className="group relative flex flex-col items-start rounded-[20px] sm:rounded-[28px] border text-left transition-all duration-300 overflow-hidden active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{
              padding: "20px 18px 24px",
              background: "rgba(77,105,64,0.22)",
              border: "2px solid rgba(77,105,64,0.50)",
              backdropFilter: "blur(12px)",
              minHeight: "200px",
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(77,105,64,0.38)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#436850";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.01)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 20px 60px rgba(77,105,64,0.30), 0 0 0 1px rgba(77,105,64,0.15)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(77,105,64,0.22)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(77,105,64,0.50)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Top row: badge + number */}
            <div className="flex items-center justify-between w-full mb-3 sm:mb-5">
              <span
                className="text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full tracking-widest uppercase"
                style={{ background: T.green, color: "#FFFFFF" }}
              >
                Recommended
              </span>
              <span className="text-white/20 text-xs font-bold font-mono hidden sm:block">01</span>
            </div>

            {/* Icon */}
            <div
              className="flex w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl items-center justify-center mb-3 sm:mb-5"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <Bolt className="w-5 h-5 sm:w-7 sm:h-7 text-white" strokeWidth={1.8} />
            </div>

            <div className="flex-1">
              <h3
                className="text-[16px] sm:text-2xl font-black text-white mb-1 sm:mb-2"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Quickstart
              </h3>
              <p className="text-white/50 text-[12px] sm:text-[15px] leading-relaxed">
                Name &amp; location only. Start playing in under 30 seconds.
              </p>
              {/* Metadata chips */}
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>4–32 players</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>Swiss format</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>Auto rounds</span>
              </div>
            </div>

            {/* Footer */}
            <div className="hidden sm:flex items-center justify-between w-full mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                <Clock className="w-3.5 h-3.5" />
                Setup method · picks format for you
              </div>
              <ArrowRight
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: "rgba(255,255,255,0.35)" }}
              />
            </div>
            <ArrowRight className="sm:hidden w-4 h-4 mt-2" style={{ color: "rgba(255,255,255,0.35)" }} />
          </button>

          {/* Schedule Tournament */}
          <button
            type="button"
            onClick={() => onSelect("schedule")}
            aria-label="Schedule — full wizard with format, rounds, time control and ratings"
            className="group relative flex flex-col items-start rounded-[20px] sm:rounded-[28px] border text-left transition-all duration-300 overflow-hidden active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{
              padding: "20px 18px 24px",
              background: "rgba(255,255,255,0.05)",
              border: "2px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(12px)",
              minHeight: "200px",
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.01)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Top row: number */}
            <div className="hidden sm:flex items-center justify-between w-full mb-5">
              <span />
              <span className="text-white/20 text-sm font-bold font-mono">02</span>
            </div>

            {/* Icon */}
            <div
              className="flex w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl items-center justify-center mb-3 sm:mb-5"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <Calendar className="w-5 h-5 sm:w-7 sm:h-7 text-white" strokeWidth={1.8} />
            </div>

            <div className="flex-1">
              <h3
                className="text-[16px] sm:text-2xl font-black text-white mb-1 sm:mb-2"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Schedule
              </h3>
              <p className="text-white/50 text-[12px] sm:text-[15px] leading-relaxed">
                Swiss, Quads, or Elimination. Full config — format, rounds, time &amp; ratings.
              </p>
              {/* Metadata chips */}
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}>4–100 players</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}>Swiss · Quads · Elim</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}>Configurable rounds</span>
              </div>
            </div>

            {/* Footer */}
            <div className="hidden sm:flex items-center justify-between w-full mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                <Clock className="w-3.5 h-3.5" />
                ~2 minutes · 4 steps
              </div>
              <ArrowRight
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: "rgba(255,255,255,0.25)" }}
              />
            </div>
            <ArrowRight className="sm:hidden w-4 h-4 mt-2" style={{ color: "rgba(255,255,255,0.25)" }} />
          </button>

          {/* Large Event */}
          <button
            type="button"
            onClick={() => onSelect("large_event")}
            aria-label="Large Event — Swiss qualification rounds into elimination bracket, 30 to 100 players"
            className="group relative flex flex-col items-start rounded-[20px] sm:rounded-[28px] border text-left transition-all duration-300 overflow-hidden active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{
              padding: "20px 18px 24px",
              background: "rgba(255,255,255,0.05)",
              border: "2px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(12px)",
              minHeight: "200px",
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.01)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Top row: badge + number */}
            <div className="flex items-center justify-between w-full mb-3 sm:mb-5">
              <span
                className="text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full tracking-widest uppercase"
                style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.70)" }}
              >
                New
              </span>
              <span className="text-white/20 text-xs font-bold font-mono hidden sm:block">03</span>
            </div>

            {/* Icon */}
            <div
              className="flex w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl items-center justify-center mb-3 sm:mb-5"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <img src={OTB_LOGO_URL} alt="OTB" className="w-5 h-5 sm:w-7 sm:h-7 object-contain drop-shadow-sm" />
            </div>

            <div className="flex-1">
              <h3
                className="text-[16px] sm:text-2xl font-black text-white mb-1 sm:mb-2"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Large Event (Swiss + Elim)
              </h3>
              <p className="text-white/50 text-[12px] sm:text-[15px] leading-relaxed">
                Swiss qualification rounds, then a seeded elimination bracket. Best for open events.
              </p>
              {/* Metadata chips */}
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}>30–100 players</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}>Swiss + Elimination</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}>Seeded bracket</span>
              </div>
            </div>

            {/* Footer */}
            <div className="hidden sm:flex items-center justify-between w-full mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                <Users className="w-3.5 h-3.5" />
                Up to 100 players · ~5 min setup
              </div>
              <ArrowRight
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: "rgba(255,255,255,0.25)" }}
              />
            </div>
            <ArrowRight className="sm:hidden w-4 h-4 mt-2" style={{ color: "rgba(255,255,255,0.25)" }} />
          </button>

          {/* Quads */}
          <button
            type="button"
            onClick={() => onSelect("quads")}
            aria-label="Quads — 4-player rating-grouped sections, 3-round round robin, no Swiss pairings"
            className="group relative flex flex-col items-start rounded-[20px] sm:rounded-[28px] border text-left transition-all duration-300 overflow-hidden active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            style={{
              padding: "20px 18px 24px",
              background: "rgba(76,175,80,0.06)",
              border: "2px solid rgba(76,175,80,0.25)",
              backdropFilter: "blur(12px)",
              minHeight: "200px",
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(76,175,80,0.14)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(76,175,80,0.45)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.01)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 20px 60px rgba(76,175,80,0.15), 0 0 0 1px rgba(76,175,80,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(76,175,80,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(76,175,80,0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Top row: badge + number */}
            <div className="flex items-center justify-between w-full mb-3 sm:mb-5">
              <span
                className="text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full tracking-widest uppercase"
                style={{ background: "rgba(76,175,80,0.18)", color: "#4CAF50" }}
              >
                Popular
              </span>
              <span className="text-[#4CAF50]/20 text-xs font-bold font-mono hidden sm:block">04</span>
            </div>

            {/* Icon — 2×2 grid representing 4-player sections */}
            <div
              className="flex w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl items-center justify-center mb-3 sm:mb-5"
              style={{ background: "rgba(76,175,80,0.12)" }}
            >
              <Users2 className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: "#4CAF50" }} strokeWidth={1.8} />
            </div>

            <div className="flex-1">
              <h3
                className="text-[16px] sm:text-2xl font-black text-white mb-1 sm:mb-2"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Quads
              </h3>
              <p className="text-white/55 text-[12px] sm:text-[15px] leading-relaxed">
                <span className="hidden sm:inline">Rating-grouped sections of 4. Every player faces each section opponent once. Fair and fast.</span>
                <span className="sm:hidden">4-player sections, round robin. Grouped by rating.</span>
              </p>
              {/* Metadata chips */}
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(76,175,80,0.12)", color: "rgba(76,175,80,0.80)" }}>Multiples of 4 (4, 8, 12…)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(76,175,80,0.12)", color: "rgba(76,175,80,0.80)" }}>3 rounds fixed</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(76,175,80,0.12)", color: "rgba(76,175,80,0.80)" }}>No Swiss pairings</span>
              </div>
            </div>

            {/* Footer */}
            <div className="hidden sm:flex items-center justify-between w-full mt-5 pt-4" style={{ borderTop: "1px solid rgba(76,175,80,0.12)" }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(76,175,80,0.65)" }}>
                <Users2 className="w-3.5 h-3.5" />
                Grouped by rating · ~1 min setup
              </div>
              <ArrowRight
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: "rgba(76,175,80,0.50)" }}
              />
            </div>
            <ArrowRight className="sm:hidden w-4 h-4 mt-2" style={{ color: "rgba(76,175,80,0.50)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quickstart Form ──────────────────────────────────────────────────────────

function QuickstartForm({
  data,
  onChange,
  isDark,
  onSubmit,
  ownedClubs,
  loadingClubs,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
  /** Called when the user presses Enter in a text field and the form is valid. */
  onSubmit?: () => void;
  ownedClubs: Club[];
  loadingClubs: boolean;
}) {
  // Smart Defaults toggle — OFF by default, user opts in
  const [smartDefaults, setSmartDefaults] = useState(false);
  // inline pickers inside the settings card
  type InlinePicker = "rounds" | "cap" | "time" | "format" | null;
  const [inlinePicker, setInlinePicker] = useState<InlinePicker>(null);
  const toggleInline = (p: InlinePicker) =>
    setInlinePicker((prev) => (prev === p ? null : p));
  // two-level time control picker: first pick category, then pick preset within category
  type TcCategory = "Bullet" | "Blitz" | "Rapid" | "Classical" | null;
  const [tcCategory, setTcCategory] = useState<TcCategory>(null);
  const [customBase, setCustomBase] = useState("");
  const [customInc, setCustomInc] = useState("");
  // rounds suggestion banner: shown after user picks a new cap that implies a different optimal rounds
  const [roundsSuggestion, setRoundsSuggestion] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Platform dropdown open state
  const [platformOpen, setPlatformOpen] = useState(false);
  // Recommended Schedule
  const [startTime, setStartTime] = useState("10:00");
  const [showSchedule, setShowSchedule] = useState(false);
  const [roundBuffer, setRoundBuffer] = useState(5); // extra minutes between rounds (on top of setup overhead)
  const [scheduleCopied, setScheduleCopied] = useState(false);
  // Custom breaks: keyed by "after round N"
  type BreakEntry = { label: string; duration: number }; // duration in minutes
  const [breaks, setBreaks] = useState<Record<number, BreakEntry>>({});
  const [addingBreakAfter, setAddingBreakAfter] = useState<number | null>(null);
  const [breakLabel, setBreakLabel] = useState("Lunch");
  const [breakDuration, setBreakDuration] = useState("30");

  // Apply smart defaults when toggle is turned on
  const handleSmartDefaultsToggle = (on: boolean) => {
    setSmartDefaults(on);
    if (on) {
      onChange({
        format: "swiss",
        rounds: 5,
        maxPlayers: 16,
        timeBase: 10,
        timeIncrement: 5,
        timePreset: "",
        ratingSystem: "chess.com",
        ratingType: "rapid",
      });
      setInlinePicker(null);
      setTcCategory(null);
    }
  };

  const ratingOptions: { value: WizardData["ratingSystem"]; label: string; sub: string }[] = [
    { value: "chess.com", label: "chess.com", sub: "Rapid / Blitz ELO" },
    { value: "lichess",   label: "Lichess",   sub: "Lichess rating" },
    { value: "fide",      label: "FIDE",      sub: "Classical rating" },
    { value: "unrated",   label: "Unrated",   sub: "No ELO required" },
  ];

  const timeControlOptions: { preset: string; label: string; sub: string; base: number; inc: number }[] = [
    // Bullet
    { preset: "1+0",  label: "Bullet",    sub: "1 min · no increment",  base: 1,  inc: 0  },
    { preset: "1+1",  label: "Bullet",    sub: "1 min + 1 sec",          base: 1,  inc: 1  },
    { preset: "2+1",  label: "Bullet",    sub: "2 min + 1 sec",          base: 2,  inc: 1  },
    // Blitz
    { preset: "3+0",  label: "Blitz",     sub: "3 min · no increment",  base: 3,  inc: 0  },
    { preset: "3+2",  label: "Blitz",     sub: "3 min + 2 sec",          base: 3,  inc: 2  },
    { preset: "5+0",  label: "Blitz",     sub: "5 min · no increment",  base: 5,  inc: 0  },
    // Rapid
    { preset: "10+0", label: "Rapid",     sub: "10 min · no increment", base: 10, inc: 0  },
    { preset: "10+5", label: "Rapid",     sub: "10 min + 5 sec",         base: 10, inc: 5  },
    { preset: "15+10",label: "Rapid",     sub: "15 min + 10 sec",        base: 15, inc: 10 },
    { preset: "30+0", label: "Rapid",     sub: "30 min · no increment", base: 30, inc: 0  },
    // Classical
    { preset: "45+0", label: "Classical", sub: "45 min · no increment", base: 45, inc: 0  },
    { preset: "60+30",label: "Classical", sub: "60 min + 30 sec",        base: 60, inc: 30 },
    { preset: "90+30",label: "Classical", sub: "90 min + 30 sec",        base: 90, inc: 30 },
  ];

  const DEFAULT_TIME_PRESET = "";
  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const DEFAULT_ROUNDS = 5;
  const capOptions = [8, 12, 16, 24, 32, 48, 64, 100];
  const DEFAULT_CAP = 16;

  // Display label for the currently selected rating system
  const activeTime = timeControlOptions.find((o) => o.preset === data.timePreset);
  const isNonDefaultRating = data.ratingSystem !== "chess.com";
  const isNonDefaultRounds = data.rounds !== DEFAULT_ROUNDS;
  const isNonDefaultTime = data.timePreset !== DEFAULT_TIME_PRESET;
  const isNonDefaultCap = data.maxPlayers !== DEFAULT_CAP;

  // Recommended rounds hint — based on maxPlayers (default 16)
  const optimalRounds = recommendedRounds(data.maxPlayers);
  const currentHint = roundsHint(data.maxPlayers, data.rounds);

  // Enter key: submit the form if the name is filled in
  const handleFieldEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && data.name.trim().length > 0) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className="space-y-7 lg:space-y-10">
      {/* Tournament name */}
      <div>
        <Label isDark={isDark} hint="required">Tournament Name</Label>
        <TextInput
          value={data.name}
          onChange={(v) => onChange({ name: v })}
          onKeyDown={handleFieldEnter}
          placeholder="e.g. Friday Night Blitz"
          icon={Trophy}
          autoFocus
          isDark={isDark}
          large
        />
      </div>

      {/* Location */}
      <div>
        <Label isDark={isDark} hint="optional">Location</Label>
        <TextInput
          value={data.venue}
          onChange={(v) => onChange({ venue: v })}
          onKeyDown={handleFieldEnter}
          placeholder="e.g. Marshall Chess Club"
          icon={MapPin}
          isDark={isDark}
        />
      </div>

      {/* Date — pre-filled with today */}
      <div>
        <Label isDark={isDark}>Date</Label>
        <TextInput
          value={data.date}
          onChange={(v) => onChange({ date: v })}
          onKeyDown={handleFieldEnter}
          type="date"
          icon={Calendar}
          isDark={isDark}
        />
      </div>

      {/* Link to Club — only shown for signed-in owners */}
      {(loadingClubs || ownedClubs.length > 0) && (
        <ClubLinkDropdown
          data={data}
          onChange={onChange}
          isDark={isDark}
          ownedClubs={ownedClubs}
          loading={loadingClubs}
        />
      )}

      {/* Tournament Settings — explicit controls with optional Smart Defaults toggle */}
      <div>
        {/* Section header — matches the Label component style */}
        <div className="flex items-baseline gap-2 mb-3 lg:mb-5">
          <label className="text-base lg:text-xl font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.90)" : "#1F2937" }}>
            Tournament Settings
          </label>
          {/* Smart Defaults toggle pill */}
          <button
            type="button"
            onClick={() => handleSmartDefaultsToggle(!smartDefaults)}
            className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-200"
            style={{
              background: smartDefaults ? T.green : isDark ? "rgba(255,255,255,0.08)" : "rgba(77,105,64,0.10)",
              color: smartDefaults ? "#FFFFFF" : isDark ? T.dMuted : T.lSub,
              border: `1px solid ${smartDefaults ? T.green : isDark ? "rgba(255,255,255,0.12)" : "rgba(77,105,64,0.20)"}`,
            }}
          >
            <Zap className="w-2.5 h-2.5" />
            Smart Defaults
          </button>
        </div>
        <div className="space-y-3">

        {/* Format row — TextInput-style field */}
        <div
          className="rounded-2xl border transition-all duration-200 overflow-hidden"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${inlinePicker === "format" ? T.green : isDark ? T.dInputBorder : T.lInputBorder}`,
            boxShadow: inlinePicker === "format" ? `0 0 0 3px ${T.greenRing}` : "none",
          }}
        >
          <button
            type="button"
            onClick={() => toggleInline("format")}
            className="w-full flex items-center justify-between transition-colors"
            style={{ padding: "16px 18px" }}
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>Format</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-base font-semibold"
                style={{ color: data.format !== "swiss" ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.format === "swiss" ? "Swiss" : data.format === "doubleswiss" ? "Double Swiss" : data.format === "roundrobin" ? "Round Robin" : data.format === "swiss_elim" ? "Swiss + Elimination" : data.format === "quads" ? "Quads" : "Elimination"}
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "format" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "format" && (
            <div
              className="px-4 pb-4 space-y-3"
              style={{ borderTop: `1px solid ${isDark ? T.dInputBorder : T.lInputBorder}` }}
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                {([
                  { value: "swiss",        label: "Swiss",       sub: "Optimal pairings" },
                  { value: "doubleswiss",  label: "Double Swiss", sub: "Play both colors" },
                  { value: "roundrobin",   label: "Round Robin",  sub: "Everyone plays all" },
                  { value: "elimination",  label: "Elimination",  sub: "Single knockout" },
                  { value: "quads",        label: "Quads",        sub: "4-player sections" },
                ] as { value: WizardData["format"]; label: string; sub: string }[]).map((f) => {
                  const active = data.format === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => {
                        onChange({ format: f.value });
                        // For Round Robin, suggest n-1 rounds for n players
                        if (f.value === "roundrobin") {
                          const rrRounds = Math.max(3, data.maxPlayers - 1);
                          if (rrRounds !== data.rounds) setRoundsSuggestion(rrRounds);
                        } else if (f.value === "swiss" || f.value === "doubleswiss") {
                          const suggested = recommendedRounds(data.maxPlayers);
                          if (suggested !== data.rounds) setRoundsSuggestion(suggested);
                        } else if (f.value === "quads") {
                          onChange({ rounds: 3 });
                          setRoundsSuggestion(null);
                        } else {
                          setRoundsSuggestion(null);
                        }
                        setInlinePicker(null);
                      }}
                      className="flex flex-col items-start rounded-xl border transition-all duration-150 px-3 py-2.5"
                      style={{
                        background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                        border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                        boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                        {f.label}
                      </span>
                      <span className="text-[10px] mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                        {f.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? T.dMuted : T.lSub }}>
                {data.format === "doubleswiss" ? "Each round players play two games — once as White, once as Black." : data.format === "roundrobin" ? "Every player faces every other player. Rounds = players − 1." : data.format === "elimination" ? "Single-elimination bracket. Losers are out." : "Standard Swiss system — optimal pairings based on score and rating."}
              </p>
            </div>
          )}
        </div>

        {/* Rounds suggestion banner — appears after Max Players change */}
        {roundsSuggestion !== null && roundsSuggestion !== data.rounds && (
          <div
            className="mx-3 my-2 rounded-xl flex items-center gap-3 px-3 py-2.5"
            style={{
              background: isDark ? "rgba(77,105,64,0.22)" : "rgba(77,105,64,0.10)",
              border: `1px solid ${isDark ? "rgba(77,105,64,0.40)" : "rgba(77,105,64,0.25)"}`,
            }}
          >
            <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
            <span className="text-xs flex-1 leading-snug" style={{ color: isDark ? T.dText : T.lText }}>
              Recommended <strong>{roundsSuggestion} rounds</strong> for {data.maxPlayers} players
            </span>
            <button
              type="button"
              onClick={() => {
                onChange({ rounds: roundsSuggestion });
                setRoundsSuggestion(null);
              }}
              className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{
                background: T.green,
                color: "#FFFFFF",
              }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setRoundsSuggestion(null)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-colors"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
              aria-label="Dismiss suggestion"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Rounds row — TextInput-style field (hidden for Quads — always 3 rounds) */}
        {data.format === "quads" ? (
          <div
            className="rounded-2xl border transition-all duration-200 overflow-hidden opacity-60 cursor-not-allowed"
            style={{
              background: isDark ? T.dInput : T.lInput,
              border: `2px solid ${isDark ? T.dInputBorder : T.lInputBorder}`,
            }}
          >
            <div className="w-full flex items-center justify-between" style={{ padding: "16px 18px" }}>
              <div className="flex items-center gap-3">
                <Hash className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
                <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>Rounds</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold" style={{ color: T.green }}>3</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: isDark ? "rgba(77,105,64,0.25)" : "#D1FAE5", color: T.green }}>Fixed</span>
              </div>
            </div>
          </div>
        ) : (
        <div
          className="rounded-2xl border transition-all duration-200 overflow-hidden"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${inlinePicker === "rounds" ? T.green : isDark ? T.dInputBorder : T.lInputBorder}`,
            boxShadow: inlinePicker === "rounds" ? `0 0 0 3px ${T.greenRing}` : "none",
          }}
        >
          <button
            type="button"
            onClick={() => toggleInline("rounds")}
            className="w-full flex items-center justify-between transition-colors"
            style={{ padding: "16px 18px" }}
          >
            <div className="flex items-center gap-3">
              <Hash className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>Rounds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-base font-semibold"
                style={{ color: isNonDefaultRounds ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.rounds}
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "rounds" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "rounds" && (
            <div
              className="px-4 pb-4 space-y-3"
              style={{ borderTop: `1px solid ${isDark ? T.dInputBorder : T.lInputBorder}` }}
            >
              <div className="flex flex-wrap gap-2 pt-3">
                {roundOptions.map((r) => {
                  const active = data.rounds === r;
                  const isOptimal = r === optimalRounds;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        onChange({ rounds: r });
                        setInlinePicker(null);
                      }}
                      className="flex flex-col items-center rounded-xl border transition-all duration-150 relative"
                      style={{
                        padding: "8px 16px",
                        background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                        border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                        boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                        minWidth: "52px",
                      }}
                    >
                      {isOptimal && (
                        <span
                          className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: active ? T.green : isDark ? "rgba(77,105,64,0.35)" : "#D1FAE5",
                            color: active ? "#FFFFFF" : T.green,
                          }}
                        >
                          ★ Best
                        </span>
                      )}
                      <span className="text-sm font-bold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                        {r}
                      </span>
                      <span className="text-[10px] mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                        {r === 1 ? "round" : "rounds"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? T.dMuted : T.lSub }}>
                {currentHint}
              </p>
            </div>
          )}
        </div>
        )}

        {/* Max Players row — TextInput-style field */}
        <div
          className="rounded-2xl border transition-all duration-200 overflow-hidden"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${inlinePicker === "cap" ? T.green : isDark ? T.dInputBorder : T.lInputBorder}`,
            boxShadow: inlinePicker === "cap" ? `0 0 0 3px ${T.greenRing}` : "none",
          }}
        >
          <button
            type="button"
            onClick={() => toggleInline("cap")}
            className="w-full flex items-center justify-between transition-colors"
            style={{ padding: "16px 18px" }}
          >
            <div className="flex items-center gap-3">
              <Users2 className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>Max Players</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-base font-semibold"
                style={{ color: isNonDefaultCap ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.maxPlayers}
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "cap" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "cap" && (
            <div
              className="px-4 pb-4 space-y-3"
              style={{ borderTop: `1px solid ${isDark ? T.dInputBorder : T.lInputBorder}` }}
            >
              <div className="flex flex-wrap gap-2 pt-3">
                {capOptions.map((cap) => {
                  const active = data.maxPlayers === cap;
                  const optRounds = recommendedRounds(cap);
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => {
                        onChange({ maxPlayers: cap });
                        setInlinePicker(null);
                        // suggest new rounds if the optimal count differs from current selection
                        const suggested = recommendedRounds(cap);
                        if (suggested !== data.rounds) {
                          setRoundsSuggestion(suggested);
                        } else {
                          setRoundsSuggestion(null);
                        }
                      }}
                      className="flex flex-col items-center rounded-xl border transition-all duration-150"
                      style={{
                        padding: "8px 16px",
                        background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                        border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                        boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                        minWidth: "56px",
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                        {cap}
                      </span>
                      <span className="text-[10px] mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                        {cap === 1 ? "player" : "players"}
                      </span>
                      <span
                        className="text-[10px] mt-0.5 font-medium"
                        style={{ color: active ? T.green : isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}
                      >
                        {optRounds}R opt.
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? T.dMuted : T.lSub }}>
                Cap limits how many players can join via the invite link. Recommended rounds updates automatically.
              </p>
            </div>
          )}
        </div>

        {/* Time Control row — TextInput-style field */}
        <div
          className="rounded-2xl border transition-all duration-200 overflow-hidden"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${inlinePicker === "time" ? T.green : isDark ? T.dInputBorder : T.lInputBorder}`,
            boxShadow: inlinePicker === "time" ? `0 0 0 3px ${T.greenRing}` : "none",
          }}
        >
          <button
            type="button"
            onClick={() => toggleInline("time")}
            className="w-full flex items-center justify-between transition-colors"
            style={{ padding: "16px 18px" }}
          >
            <div className="flex items-center gap-3">
              <Timer className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>Time Control</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-base font-semibold"
                style={{ color: data.timePreset ? T.green : isDark ? "rgba(255,255,255,0.35)" : "#9CA3AF" }}
              >
                {!data.timePreset
                  ? "Select time control"
                  : activeTime
                    ? `${activeTime.preset} · ${activeTime.label}`
                    : data.timePreset === "custom"
                      ? `${data.timeBase}+${data.timeIncrement} · ${data.ratingType === "blitz" ? "Blitz" : "Rapid"}`
                      : `${data.timePreset} · ${data.ratingType === "blitz" ? "Blitz" : data.ratingType === "rapid" ? "Rapid" : "Classical"}`
                }
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "time" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "time" && (
            <div
              className="px-4 pb-4"
              style={{ borderTop: `1px solid ${isDark ? T.dInputBorder : T.lInputBorder}` }}
            >
              {/* Level 1 — Category buttons (no caption text) */}
              {!tcCategory && (
                <div className="grid grid-cols-3 gap-2 pt-3">
                  {(["Rapid", "Blitz", "Classical"] as const).map((cat) => {
                    const catActive = cat === "Blitz"
                      ? data.ratingType === "blitz" && timeControlOptions.find(o => o.preset === data.timePreset)?.label === cat
                      : timeControlOptions.find(o => o.preset === data.timePreset)?.label === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setTcCategory(cat); setCustomBase(""); setCustomInc(""); }}
                        className="flex items-center justify-center rounded-xl border text-sm font-semibold transition-all duration-150"
                        style={{
                          padding: "10px 12px",
                          background: catActive ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                          border: `1.5px solid ${catActive ? T.green : isDark ? T.dBorder : T.lBorder}`,
                          boxShadow: catActive ? `0 0 0 3px ${T.greenRing}` : "none",
                          color: catActive ? T.green : isDark ? T.dText : T.lText,
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Level 2 — Preset sub-prompt for selected category */}
              {tcCategory && (() => {
                const presetMap: Record<string, { label: string; base: number; inc: number }[]> = {
                  Rapid:     [{ label: "10 min", base: 10, inc: 0 }, { label: "15 + 10 min", base: 15, inc: 10 }, { label: "30 min", base: 30, inc: 0 }],
                  Blitz:     [{ label: "3 min", base: 3, inc: 0 }, { label: "3 + 2 min", base: 3, inc: 2 }, { label: "5 min", base: 5, inc: 0 }],
                  Classical: [{ label: "45 min", base: 45, inc: 0 }, { label: "60 + 30 min", base: 60, inc: 30 }, { label: "90 + 30 min", base: 90, inc: 30 }],
                };
                const presets = presetMap[tcCategory] ?? [];
                const applyPreset = (base: number, inc: number) => {
                  const preset = inc > 0 ? `${base}+${inc}` : `${base}+0`;
                  const isBlitzCat = tcCategory === "Blitz";
                  onChange({ timePreset: preset, timeBase: base, timeIncrement: inc, ratingType: isBlitzCat ? "blitz" : "rapid" });
                  setTcCategory(null);
                  setInlinePicker(null);
                };
                const handleCustomApply = () => {
                  const b = parseInt(customBase, 10);
                  const i = parseInt(customInc || "0", 10);
                  if (!b || b < 1) return;
                  applyPreset(b, i);
                };
                return (
                  <div
                    className="pt-3 space-y-3"
                    style={{
                      animation: "tcSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",
                    }}
                  >
                    {/* Back button */}
                    <button
                      type="button"
                      onClick={() => setTcCategory(null)}
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{ color: isDark ? T.dMuted : T.lMuted }}
                    >
                      <ChevronDown className="w-3 h-3 rotate-90" /> Back
                    </button>
                    <p className="text-xs font-semibold" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                      {tcCategory} — choose a time control
                    </p>
                    {/* Preset options */}
                    <div className="grid grid-cols-3 gap-2">
                      {presets.map((p) => {
                        const pPreset = p.inc > 0 ? `${p.base}+${p.inc}` : `${p.base}+0`;
                        const active = data.timePreset === pPreset;
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => applyPreset(p.base, p.inc)}
                            className="flex items-center justify-center rounded-xl border text-xs font-semibold transition-all duration-150"
                            style={{
                              padding: "9px 8px",
                              background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                              border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                              boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                              color: active ? T.green : isDark ? T.dText : T.lText,
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Custom time input */}
                    <div
                      className="rounded-xl border p-3 space-y-2"
                      style={{ border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`, background: isDark ? T.dCard : "#FAFAFA" }}
                    >
                      <p className="text-xs font-medium" style={{ color: isDark ? T.dMuted : T.lMuted }}>Custom time</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>Base (min)</label>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            value={customBase}
                            onChange={(e) => setCustomBase(e.target.value)}
                            placeholder="e.g. 15"
                            className="w-full mt-0.5 rounded-lg border px-2 py-1.5 text-sm"
                            style={{
                              background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                              border: `1px solid ${isDark ? T.dBorder : T.lBorder}`,
                              color: isDark ? T.dText : T.lText,
                              outline: "none",
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>Increment (sec)</label>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            value={customInc}
                            onChange={(e) => setCustomInc(e.target.value)}
                            placeholder="e.g. 5"
                            className="w-full mt-0.5 rounded-lg border px-2 py-1.5 text-sm"
                            style={{
                              background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
                              border: `1px solid ${isDark ? T.dBorder : T.lBorder}`,
                              color: isDark ? T.dText : T.lText,
                              outline: "none",
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleCustomApply}
                          disabled={!customBase}
                          className="self-end rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                          style={{
                            background: customBase ? T.green : isDark ? T.dBorder : T.lBorder,
                            color: customBase ? "#fff" : isDark ? T.dMuted : T.lMuted,
                            cursor: customBase ? "pointer" : "not-allowed",
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ELO Rating row — TextInput-style field */}
        <div
          className="rounded-2xl border transition-all duration-200 overflow-hidden"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${isDark ? T.dInputBorder : T.lInputBorder}`,
          }}
        >
          <div className="flex items-center justify-between" style={{ padding: "16px 18px" }}>
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>ELO Rating</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}` }}>
              {(["rapid", "blitz"] as const).map((rt) => {
                const active = data.ratingType === rt;
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => onChange({ ratingType: rt })}
                    className="px-3 py-1.5 text-sm font-semibold transition-all duration-150"
                    style={{
                      background: active ? T.green : "transparent",
                      color: active ? "#FFFFFF" : isDark ? T.dMuted : T.lMuted,
                    }}
                  >
                    {rt === "rapid" ? "Rapid" : "Blitz"}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="pb-3 text-[11px] leading-relaxed" style={{ padding: "0 18px 12px 52px", color: isDark ? "rgba(255,255,255,0.35)" : "#9CA3AF" }}>
            Both Rapid &amp; Blitz are fetched automatically. Auto-set by time control — changeable later in Settings.
          </p>
        </div>

        {/* Platform row — TextInput-style field */}
        <div
          className="rounded-2xl border transition-all duration-200 overflow-hidden"
          style={{
            background: isDark ? T.dInput : T.lInput,
            border: `2px solid ${platformOpen ? T.green : isDark ? T.dInputBorder : T.lInputBorder}`,
            boxShadow: platformOpen ? `0 0 0 3px ${T.greenRing}` : "none",
          }}
        >
          <button
            type="button"
            onClick={() => setPlatformOpen((v) => !v)}
            className="w-full flex items-center justify-between transition-colors"
            style={{ padding: "16px 18px" }}
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              <span className="text-base font-medium" style={{ color: isDark ? T.dSub : T.lMuted }}>Platform</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-base font-semibold"
                style={{ color: isNonDefaultRating ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.ratingSystem === "chess.com" ? "Chess.com" : data.ratingSystem === "lichess" ? "Lichess" : data.ratingSystem === "fide" ? "FIDE" : "Unrated"}
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: platformOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {platformOpen && (
            <div
              className="px-4 pb-4"
              style={{ borderTop: `1px solid ${isDark ? T.dInputBorder : T.lInputBorder}` }}
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                {([
                  { value: "chess.com" as const, label: "Chess.com", sub: "Rapid / Blitz ELO" },
                  { value: "lichess" as const,   label: "Lichess",   sub: "Lichess rating" },
                  { value: "fide" as const,      label: "FIDE",      sub: "Classical rating" },
                  { value: "unrated" as const,   label: "Unrated",   sub: "No ELO required" },
                ]).map((opt) => {
                  const active = data.ratingSystem === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange({ ratingSystem: opt.value });
                        setPlatformOpen(false);
                      }}
                      className="flex flex-col items-start rounded-xl border text-left transition-all duration-150 px-3 py-2.5"
                      style={{
                        background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                        border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                        boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                        {opt.label}
                      </span>
                      <span className="text-[10px] mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>{/* end space-y-3 */}
      </div>{/* end Tournament Settings outer div */}

      {data.format !== "quads" && (
      <div
        className="rounded-2xl transition-all duration-200"
        style={{
          padding: "16px 18px",
          background: data.isBracketParent ? (isDark ? "rgba(255,180,50,0.08)" : "rgba(255,180,50,0.06)") : (isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB"),
          border: `2px solid ${data.isBracketParent ? "rgba(255,180,50,0.30)" : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: data.isBracketParent ? "rgba(255,180,50,0.15)" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}>
              <BarChart3 className="w-4.5 h-4.5" style={{ color: data.isBracketParent ? "#FFB432" : isDark ? T.dMuted : T.lMuted }} />
            </div>
            <div>
              <span className="text-sm font-semibold" style={{ color: isDark ? T.dText : T.lText }}>Split by Rating</span>
              <p className="text-xs mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>Auto-group players into ELO brackets after registration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ isBracketParent: !data.isBracketParent })}
            className="relative w-11 h-6 rounded-full transition-all duration-200"
            style={{ background: data.isBracketParent ? T.green : isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB" }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
              style={{ left: data.isBracketParent ? "calc(100% - 22px)" : "2px" }}
            />
          </button>
        </div>
        {data.isBracketParent && (
          <p className="text-xs mt-3 pl-12" style={{ color: "#FFB432" }}>
            After players register, you'll be able to define bracket thresholds and auto-sort players from the tournament dashboard.
          </p>
        )}
      </div>
      )}

            {/* Structure Preview — collapsible panel */}
      {data.format === "quads" ? (
        <QuadsEloPreview maxPlayers={data.maxPlayers} isDark={isDark} T={T} />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: showPreview ? T.green : isDark ? T.dMuted : T.lMuted }}
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? "Hide structure preview" : "Preview tournament structure"}
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform duration-200"
              style={{ transform: showPreview ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
          {showPreview && (
            <div
              className="mt-3 rounded-2xl border overflow-hidden"
              style={{
                background: isDark ? "rgba(77,105,64,0.06)" : "#F4F8F3",
                border: `1.5px solid ${isDark ? "rgba(77,105,64,0.20)" : "rgba(77,105,64,0.14)"}`,
                padding: "16px 20px",
              }}
            >
              <BracketPreview
                format={data.format}
                rounds={data.rounds}
                maxPlayers={data.maxPlayers}
                isDark={isDark}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Real-time configuration summary ───────────────────────────── */}
      {data.name.trim().length > 0 && (() => {
        const formatLabel =
          data.format === "swiss" ? "Swiss" :
          data.format === "doubleswiss" ? "Double Swiss" :
          data.format === "roundrobin" ? "Round Robin" :
          data.format === "swiss_elim" ? "Swiss + Elim" :
          data.format === "quads" ? "Quads" : "Elimination";

        const timeLabel = (() => {
          const base = data.timeBase;
          const inc  = data.timeIncrement;
          const preset = inc > 0 ? `${base}+${inc}` : `${base} min`;
          const cat = data.ratingType === "blitz" ? "Blitz" : base >= 30 ? "Classical" : "Rapid";
          return `${preset} · ${cat}`;
        })();

        const platformLabel =
          data.ratingSystem === "chess.com" ? "Chess.com" :
          data.ratingSystem === "lichess"   ? "Lichess" :
          data.ratingSystem === "fide"      ? "FIDE" : "Unrated";

        const dateLabel = (() => {
          if (!data.date) return null;
          try {
            return new Date(data.date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            });
          } catch { return data.date; }
        })();

        // ── Estimated duration ──────────────────────────────────────────────
        // Formula: each game = (timeBase * 2 + timeIncrement * 40) minutes
        // (40 moves per side is the standard FIDE average game length estimate)
        // Double Swiss: each round contains 2 games per player (play both colors back-to-back),
        // so the round duration is 2× the single-game time plus a short inter-game gap (5 min).
        const isDoubleSwiss = data.format === "doubleswiss";
        const singleGameMinutes = data.timeBase * 2 + Math.round((data.timeIncrement * 40) / 60);
        const gameMinutes = isDoubleSwiss
          ? singleGameMinutes * 2 + 5   // 2 games + 5 min color-swap gap
          : singleGameMinutes;
        const roundOverhead = roundBuffer; // user-configurable buffer between rounds
        const adminBuffer  = 10; // opening remarks + closing
        const totalMinutes = data.rounds * (gameMinutes + roundOverhead) + adminBuffer;
        const minutesPerGame = gameMinutes; // alias for legacy void suppression
        const durationLabel = (() => {
          if (totalMinutes < 60) return `~${totalMinutes} min`;
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
        })();
        // Pace descriptor
        const paceLabel =
          totalMinutes <= 60  ? "Quick session" :
          totalMinutes <= 120 ? "Half-day event" :
          totalMinutes <= 210 ? "Full afternoon" : "Full-day event";
        void minutesPerGame; // suppress unused warning

        const chips: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }[] = [
          {
            icon: <Trophy className="w-3 h-3" />,
            label: "Format",
            value: formatLabel,
            highlight: data.format !== "swiss",
          },
          {
            icon: <Shuffle className="w-3 h-3" />,
            label: "Rounds",
            value: `${data.rounds} rounds`,
            highlight: data.rounds !== 5,
          },
          {
            icon: <Users className="w-3 h-3" />,
            label: "Max Players",
            value: `${data.maxPlayers} players`,
            highlight: data.maxPlayers !== 16,
          },
          {
            icon: <Clock className="w-3 h-3" />,
            label: "Time Control",
            value: timeLabel,
            highlight: data.timePreset !== "10+5",
          },
          {
            icon: <BarChart3 className="w-3 h-3" />,
            label: "Platform",
            value: platformLabel,
            highlight: data.ratingSystem !== "chess.com",
          },
          ...(dateLabel ? [{
            icon: <Calendar className="w-3 h-3" />,
            label: "Date",
            value: dateLabel,
            highlight: false,
          }] : []),
        ];

        return (
          <div
            className="rounded-2xl border p-4 lg:p-5 space-y-3"
            style={{
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(67,104,80,0.04)",
              border: `1.5px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(67,104,80,0.12)"}`,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.green }}>
                Tournament Summary
              </span>
              {data.venue && (
                <span
                  className="ml-auto text-[11px] font-medium flex items-center gap-1"
                  style={{ color: isDark ? T.dMuted : T.lMuted }}
                >
                  <MapPin className="w-3 h-3" />
                  {data.venue}
                </span>
              )}
            </div>

            {/* Tournament name headline */}
            <p
              className="text-base font-bold leading-tight"
              style={{ color: isDark ? T.dText : T.lText, fontFamily: "'Clash Display', sans-serif" }}
            >
              {data.name}
            </p>

            {/* Config chips grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {chips.map((chip) => (
                <div
                  key={chip.label}
                  className="flex items-start gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: chip.highlight
                      ? isDark ? "rgba(77,105,64,0.18)" : "rgba(77,105,64,0.08)"
                      : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    border: `1px solid ${
                      chip.highlight
                        ? isDark ? "rgba(77,105,64,0.35)" : "rgba(77,105,64,0.20)"
                        : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
                    }`,
                  }}
                >
                  <span
                    className="mt-0.5 flex-shrink-0"
                    style={{ color: chip.highlight ? T.green : isDark ? T.dMuted : T.lMuted }}
                  >
                    {chip.icon}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[10px] leading-none mb-0.5"
                      style={{ color: isDark ? T.dMuted : T.lMuted }}
                    >
                      {chip.label}
                    </p>
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: chip.highlight ? T.green : isDark ? T.dText : T.lText }}
                    >
                      {chip.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Estimated Total Duration — full-width accent row */}
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{
                background: isDark ? "rgba(77,105,64,0.20)" : "rgba(77,105,64,0.10)",
                border: `1px solid ${isDark ? "rgba(77,105,64,0.40)" : "rgba(77,105,64,0.25)"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
                <div>
                  <p className="text-[10px] leading-none mb-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    Estimated Total Duration
                  </p>
                  <p className="text-xs" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    {data.rounds} rounds × {gameMinutes} min/round{isDoubleSwiss ? ' (2 games × ' + singleGameMinutes + 'min + 5min gap)' : ''} + {roundOverhead} min buffer + {adminBuffer} min admin
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-sm font-bold" style={{ color: T.green }}>
                  {durationLabel}
                </p>
                <p className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                  {paceLabel}
                </p>
              </div>
            </div>

            {/* Recommended Schedule — collapsible */}
            <div>
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setShowSchedule((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
                style={{
                  background: showSchedule
                    ? isDark ? "rgba(255,255,255,0.06)" : "rgba(67,104,80,0.07)"
                    : "transparent",
                  border: `1px solid ${showSchedule
                    ? isDark ? "rgba(255,255,255,0.10)" : "rgba(67,104,80,0.15)"
                    : isDark ? "rgba(255,255,255,0.06)" : "rgba(67,104,80,0.10)"}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" style={{ color: showSchedule ? T.green : isDark ? T.dMuted : T.lMuted }} />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: showSchedule ? T.green : isDark ? T.dMuted : T.lMuted }}
                  >
                    Recommended Schedule
                  </span>
                </div>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{
                    color: isDark ? T.dMuted : T.lMuted,
                    transform: showSchedule ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {showSchedule && (() => {
                // Parse start time
                const [startH, startM] = startTime.split(":").map(Number);
                const startTotalMin = (startH || 0) * 60 + (startM || 0);
                const minPerRound = gameMinutes + roundOverhead;

                const formatTime = (totalMin: number) => {
                  const h = Math.floor(totalMin / 60) % 24;
                  const m = totalMin % 60;
                  const period = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 === 0 ? 12 : h % 12;
                  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
                };

                // Build schedule entries accounting for breaks
                type ScheduleEntry =
                  | { type: "round"; round: number; start: string; end: string; isLast: boolean }
                  | { type: "break"; afterRound: number; label: string; duration: number; start: string; end: string };

                const entries: ScheduleEntry[] = [];
                let cursor = startTotalMin;
                for (let i = 0; i < data.rounds; i++) {
                  const roundStart = cursor;
                  const roundEnd   = cursor + gameMinutes;
                  entries.push({
                    type: "round",
                    round: i + 1,
                    start: formatTime(roundStart),
                    end:   formatTime(roundEnd),
                    isLast: i === data.rounds - 1,
                  });
                  cursor = roundEnd + roundOverhead; // setup gap after each round
                  // Insert break if one exists after this round (and it's not the last round)
                  const brk = breaks[i + 1];
                  if (brk && i < data.rounds - 1) {
                    const brkStart = cursor;
                    const brkEnd   = cursor + brk.duration;
                    entries.push({
                      type: "break",
                      afterRound: i + 1,
                      label: brk.label,
                      duration: brk.duration,
                      start: formatTime(brkStart),
                      end:   formatTime(brkEnd),
                    });
                    cursor = brkEnd;
                  }
                }
                const wrapUpTime = formatTime(cursor + adminBuffer);

                // ── Copy schedule to clipboard ──────────────────────────
                const buildScheduleText = () => {
                  const lines: string[] = [];
                  lines.push(`📋 ${data.name} — Tournament Schedule`);
                  if (data.venue) lines.push(`📍 ${data.venue}`);
                  if (dateLabel) lines.push(`📅 ${dateLabel}`);
                  lines.push("");
                  entries.forEach((e) => {
                    if (e.type === "round") {
                      lines.push(`Round ${e.round}:  ${e.start} – ${e.end}`);
                    } else {
                      lines.push(`  ☕ ${e.label} (${e.duration} min):  ${e.start} – ${e.end}`);
                    }
                  });
                  lines.push("");
                  lines.push(`🏆 Awards & wrap-up:  ~${wrapUpTime}`);
                  lines.push("");
                  lines.push(`Format: ${formatLabel}  ·  Time Control: ${timeLabel}  ·  Max Players: ${data.maxPlayers}`);
                  lines.push("Generated by ChessOTB.club");
                  return lines.join("\n");
                };

                const removeBreak = (afterRound: number) => {
                  setBreaks((prev) => {
                    const next = { ...prev };
                    delete next[afterRound];
                    return next;
                  });
                };

                const confirmBreak = (afterRound: number) => {
                  const dur = parseInt(breakDuration, 10);
                  if (!dur || dur < 1) return;
                  setBreaks((prev) => ({ ...prev, [afterRound]: { label: breakLabel.trim() || "Break", duration: dur } }));
                  setAddingBreakAfter(null);
                  setBreakLabel("Lunch");
                  setBreakDuration("30");
                };

                return (
                  <div className="mt-2 space-y-2">
                    {/* Start time input */}
                    <div className="flex items-center gap-3 px-1">
                      <label
                        className="text-[11px] font-medium whitespace-nowrap"
                        style={{ color: isDark ? T.dMuted : T.lMuted }}
                      >
                        Tournament starts at
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="rounded-lg border px-2.5 py-1 text-sm font-semibold"
                        style={{
                          background: isDark ? T.dCard : "#FFFFFF",
                          border: `1.5px solid ${isDark ? T.dBorderFocus : T.lBorderFocus}`,
                          color: isDark ? T.dText : T.lText,
                          outline: "none",
                          colorScheme: isDark ? "dark" : "light",
                        }}
                      />
                    </div>

                    {/* Round Buffer Time control */}
                    <div className="flex items-center gap-3 px-1">
                      <label
                        className="text-[11px] font-medium whitespace-nowrap"
                        style={{ color: isDark ? T.dMuted : T.lMuted }}
                      >
                        Round buffer
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[0, 5, 10, 15, 20].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setRoundBuffer(val)}
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                            style={{
                              background: roundBuffer === val
                                ? isDark ? "rgba(77,105,64,0.30)" : "rgba(77,105,64,0.18)"
                                : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                              color: roundBuffer === val
                                ? T.green
                                : isDark ? T.dMuted : T.lMuted,
                              border: `1px solid ${
                                roundBuffer === val
                                  ? isDark ? "rgba(77,105,64,0.45)" : "rgba(77,105,64,0.30)"
                                  : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
                              }`,
                            }}
                          >
                            {val === 0 ? "None" : `${val}m`}
                          </button>
                        ))}
                        {/* Custom value input */}
                        {![0, 5, 10, 15, 20].includes(roundBuffer) && (
                          <span
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                            style={{
                              background: isDark ? "rgba(77,105,64,0.30)" : "rgba(77,105,64,0.18)",
                              color: T.green,
                              border: `1px solid ${isDark ? "rgba(77,105,64,0.45)" : "rgba(77,105,64,0.30)"}`,
                            }}
                          >
                            {roundBuffer}m
                          </span>
                        )}
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={roundBuffer}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 0 && v <= 60) setRoundBuffer(v);
                          }}
                          className="w-12 rounded-lg border px-2 py-1 text-xs text-center"
                          style={{
                            background: isDark ? T.dCard : "#FFFFFF",
                            border: `1px solid ${isDark ? T.dBorder : T.lBorder}`,
                            color: isDark ? T.dText : T.lText,
                            outline: "none",
                          }}
                          title="Custom buffer in minutes"
                        />
                        <span className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>min</span>
                      </div>
                    </div>

                    {/* Schedule rows */}
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(67,104,80,0.12)"}` }}
                    >
                      {entries.map((entry, idx) => {
                        if (entry.type === "break") {
                          return (
                            <div
                              key={`break-${entry.afterRound}`}
                              className="flex items-center justify-between px-3 py-2"
                              style={{
                                borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(67,104,80,0.08)"}`,
                                background: isDark ? "rgba(255,200,50,0.06)" : "rgba(255,200,50,0.08)",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                  style={{ background: isDark ? "rgba(255,200,50,0.15)" : "rgba(255,200,50,0.20)", color: isDark ? "#FCD34D" : "#92400E" }}
                                >
                                  BREAK
                                </span>
                                <span className="text-xs font-medium" style={{ color: isDark ? "#FCD34D" : "#92400E" }}>
                                  {entry.label}
                                </span>
                                <span className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                                  {entry.duration} min
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                                  {entry.start} – {entry.end}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeBreak(entry.afterRound)}
                                  className="w-4 h-4 flex items-center justify-center rounded-full transition-colors"
                                  style={{ color: isDark ? T.dMuted : T.lMuted }}
                                  aria-label="Remove break"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Round row
                        const r = entry;
                        return (
                          <div key={`round-${r.round}`}>
                            <div
                              className="flex items-center justify-between px-3 py-2"
                              style={{
                                background: idx % 2 === 0
                                  ? isDark ? "rgba(255,255,255,0.02)" : "rgba(67,104,80,0.03)"
                                  : "transparent",
                                borderTop: idx > 0 ? `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(67,104,80,0.08)"}` : "none",
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                  style={{
                                    background: r.isLast ? T.green : isDark ? "rgba(255,255,255,0.08)" : "rgba(67,104,80,0.10)",
                                    color: r.isLast ? "#FFFFFF" : isDark ? T.dMuted : T.lSub,
                                  }}
                                >
                                  {r.round}
                                </span>
                                <span className="text-xs font-medium" style={{ color: isDark ? T.dText : T.lText }}>
                                  Round {r.round}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <span className="text-xs font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
                                    {r.start}
                                  </span>
                                  <span className="text-[10px] ml-1" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                                    – {r.end}
                                  </span>
                                </div>
                                {/* Add break button — only between rounds (not after last) */}
                                {!r.isLast && !breaks[r.round] && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddingBreakAfter(r.round);
                                      setBreakLabel("Lunch");
                                      setBreakDuration("30");
                                    }}
                                    className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-all"
                                    style={{
                                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(67,104,80,0.08)",
                                      color: isDark ? T.dMuted : T.lMuted,
                                      border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(67,104,80,0.12)"}`,
                                    }}
                                    title={`Add break after Round ${r.round}`}
                                  >
                                    + Break
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Inline break editor — appears below the round row */}
                            {addingBreakAfter === r.round && (
                              <div
                                className="px-3 py-3 space-y-2"
                                style={{
                                  borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(67,104,80,0.08)"}`,
                                  background: isDark ? "rgba(255,200,50,0.05)" : "rgba(255,200,50,0.07)",
                                }}
                              >
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isDark ? "#FCD34D" : "#92400E" }}>
                                  Break after Round {r.round}
                                </p>
                                <div className="flex items-center gap-2">
                                  {/* Label presets */}
                                  {["Lunch", "Break", "Dinner"].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setBreakLabel(preset)}
                                      className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                                      style={{
                                        background: breakLabel === preset
                                          ? isDark ? "rgba(255,200,50,0.25)" : "rgba(255,200,50,0.30)"
                                          : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                        color: breakLabel === preset
                                          ? isDark ? "#FCD34D" : "#92400E"
                                          : isDark ? T.dMuted : T.lMuted,
                                        border: `1px solid ${breakLabel === preset
                                          ? isDark ? "rgba(255,200,50,0.35)" : "rgba(255,200,50,0.40)"
                                          : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                      }}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                  {/* Custom label input */}
                                  <input
                                    type="text"
                                    value={breakLabel}
                                    onChange={(e) => setBreakLabel(e.target.value)}
                                    placeholder="Custom"
                                    maxLength={20}
                                    className="flex-1 min-w-0 rounded-lg border px-2 py-1 text-xs"
                                    style={{
                                      background: isDark ? T.dCard : "#FFFFFF",
                                      border: `1px solid ${isDark ? T.dBorder : T.lBorder}`,
                                      color: isDark ? T.dText : T.lText,
                                      outline: "none",
                                    }}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] font-medium whitespace-nowrap" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                                    Duration
                                  </label>
                                  {[15, 30, 45, 60].map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => setBreakDuration(String(d))}
                                      className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                                      style={{
                                        background: breakDuration === String(d)
                                          ? isDark ? "rgba(255,200,50,0.25)" : "rgba(255,200,50,0.30)"
                                          : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                                        color: breakDuration === String(d)
                                          ? isDark ? "#FCD34D" : "#92400E"
                                          : isDark ? T.dMuted : T.lMuted,
                                        border: `1px solid ${breakDuration === String(d)
                                          ? isDark ? "rgba(255,200,50,0.35)" : "rgba(255,200,50,0.40)"
                                          : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                      }}
                                    >
                                      {d}m
                                    </button>
                                  ))}
                                  <input
                                    type="number"
                                    min={5}
                                    max={180}
                                    value={breakDuration}
                                    onChange={(e) => setBreakDuration(e.target.value)}
                                    className="w-14 rounded-lg border px-2 py-1 text-xs text-center"
                                    style={{
                                      background: isDark ? T.dCard : "#FFFFFF",
                                      border: `1px solid ${isDark ? T.dBorder : T.lBorder}`,
                                      color: isDark ? T.dText : T.lText,
                                      outline: "none",
                                    }}
                                  />
                                  <span className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>min</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => confirmBreak(r.round)}
                                    disabled={!breakDuration || parseInt(breakDuration, 10) < 1}
                                    className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all"
                                    style={{
                                      background: T.green,
                                      color: "#FFFFFF",
                                      opacity: !breakDuration || parseInt(breakDuration, 10) < 1 ? 0.5 : 1,
                                    }}
                                  >
                                    Add Break
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddingBreakAfter(null)}
                                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                                    style={{
                                      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                                      color: isDark ? T.dMuted : T.lMuted,
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Wrap-up row */}
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{
                          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(67,104,80,0.08)"}`,
                          background: isDark ? "rgba(77,105,64,0.10)" : "rgba(77,105,64,0.06)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
                          <span className="text-xs font-medium" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                            Awards &amp; wrap-up
                          </span>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: T.green }}>
                          ~{wrapUpTime}
                        </span>
                      </div>
                    </div>
                    {/* Copy Schedule button */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(buildScheduleText());
                          setScheduleCopied(true);
                          setTimeout(() => setScheduleCopied(false), 2500);
                        } catch {
                          // fallback: select a hidden textarea
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all"
                      style={{
                        background: scheduleCopied
                          ? isDark ? "rgba(77,105,64,0.30)" : "rgba(77,105,64,0.18)"
                          : isDark ? "rgba(255,255,255,0.05)" : "rgba(67,104,80,0.06)",
                        border: `1px solid ${
                          scheduleCopied
                            ? isDark ? "rgba(77,105,64,0.50)" : "rgba(77,105,64,0.35)"
                            : isDark ? "rgba(255,255,255,0.09)" : "rgba(67,104,80,0.14)"
                        }`,
                        color: scheduleCopied ? T.green : isDark ? T.dMuted : T.lMuted,
                      }}
                    >
                      {scheduleCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Schedule copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy schedule to clipboard
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

    </div>
  );
}


// ─── Quads ELO Grouping Preview ───────────────────────────────────────────────
function QuadsEloPreview({
  maxPlayers,
  isDark,
  T,
}: {
  maxPlayers: number;
  isDark: boolean;
  T: Record<string, string>;
}) {
  const numSections = Math.ceil(maxPlayers / 4);
  const eloTop = 2200;
  const eloBot = 800;
  const spread = eloTop - eloBot;
  const sectionSpread = numSections > 1 ? Math.round(spread / numSections) : spread;

  const sectionColors = [
    { bg: "rgba(255,215,0,0.12)",   border: "rgba(255,215,0,0.30)",   label: "#FFD700", rank: "Q1" },
    { bg: "rgba(192,192,192,0.10)", border: "rgba(192,192,192,0.28)", label: "#C0C0C0", rank: "Q2" },
    { bg: "rgba(205,127,50,0.10)",  border: "rgba(205,127,50,0.28)",  label: "#CD7F32", rank: "Q3" },
    { bg: "rgba(124,245,98,0.08)",  border: "rgba(124,245,98,0.20)",  label: "#7CF562", rank: "Q4" },
  ];

  const sections = Array.from({ length: numSections }, (_, i) => {
    const hiElo = eloTop - i * sectionSpread;
    const loElo = hiElo - sectionSpread + 1;
    const color = sectionColors[Math.min(i, sectionColors.length - 1)];
    const label = numSections <= 4 ? color.rank : `Q${i + 1}`;
    return { label, hiElo, loElo, color };
  });

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: isDark ? "rgba(77,105,64,0.05)" : "#F4F8F3",
        border: `1.5px solid ${isDark ? "rgba(77,105,64,0.18)" : "rgba(77,105,64,0.14)"}`,
        padding: "16px 18px",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: T.green }} />
          <span className="text-sm font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
            ELO Grouping Preview
          </span>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: isDark ? "rgba(77,105,64,0.20)" : "#D1FAE5", color: T.green }}
        >
          {numSections} section{numSections !== 1 ? "s" : ""} &middot; {maxPlayers} players
        </span>
      </div>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
      >
        {sections.map((sec) => (
          <div
            key={sec.label}
            className="rounded-xl p-3"
            style={{
              background: sec.color.bg,
              border: `1.5px solid ${sec.color.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: sec.color.label }}>
                {sec.label}
              </span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  color: isDark ? "rgba(255,255,255,0.50)" : "rgba(0,0,0,0.45)",
                }}
              >
                {sec.loElo}&ndash;{sec.hiElo}
              </span>
            </div>
            <div className="space-y-1">
              {Array.from({ length: 4 }, (_, pi) => (
                <div
                  key={pi}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)" }}
                  />
                  <div
                    className="h-2 rounded-full"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
                      width: `${55 + pi * 10}%`,
                    }}
                  />
                  <span
                    className="text-[10px] font-mono ml-auto"
                    style={{ color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.30)" }}
                  >
                    ~{Math.round(sec.hiElo - (pi * sectionSpread) / 4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-3" style={{ color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.38)" }}>
        Illustrative grouping only. Actual sections are formed from registered players&apos; live ratings.
      </p>
    </div>
  );
}

// ─── Step 1: Details (Schedule path) ─────────────────────────────────────────

function StepDetails({
  data,
  onChange,
  isDark,
  ownedClubs,
  loadingClubs,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
  ownedClubs: Club[];
  loadingClubs: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Resize to max 1200px wide
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        onChange({ coverImageUrl: compressed });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const ratingOptions: { value: WizardData["ratingSystem"]; label: string; sub: string }[] = [
    { value: "chess.com", label: "chess.com", sub: "Rapid / Blitz ELO" },
    { value: "lichess", label: "Lichess", sub: "Lichess rating" },
    { value: "fide", label: "FIDE", sub: "Classical rating" },
    { value: "unrated", label: "Unrated", sub: "No ELO required" },
  ];

  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Cover Image Upload */}
      <div>
        <Label isDark={isDark} hint="optional">Cover Photo</Label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); }}
        />
        {data.coverImageUrl ? (
          <div className="relative rounded-2xl overflow-hidden" style={{ height: 160 }}>
            <img src={data.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.20)", backdropFilter: "blur(8px)" }}
              >Change</button>
              <button
                type="button"
                onClick={() => onChange({ coverImageUrl: "" })}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "rgba(220,38,38,0.60)", backdropFilter: "blur(8px)" }}
              >Remove</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleCoverFile(f); }}
            className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-200"
            style={{
              height: 120,
              borderColor: isDragging ? T.green : isDark ? "rgba(255,255,255,0.18)" : "#D1D5DB",
              background: isDragging ? T.greenBg : isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB",
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: T.greenBg }}>
              <svg className="w-5 h-5" style={{ color: T.green }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: isDark ? "rgba(255,255,255,0.55)" : "#436850" }}>Drop an image or click to upload</p>
            <p className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}>JPG, PNG, WebP — shown in the tournament banner</p>
          </button>
        )}
      </div>

      {/* Tournament name — hero input */}
      <div>
        <Label isDark={isDark} hint="required">Tournament Name</Label>
        <TextInput
          value={data.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="e.g. Spring Open 2026"
          icon={Trophy}
          autoFocus
          isDark={isDark}
          large
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label isDark={isDark} hint="optional">Venue</Label>
          <TextInput
            value={data.venue}
            onChange={(v) => onChange({ venue: v })}
            placeholder="Marshall Chess Club"
            icon={MapPin}
            isDark={isDark}
          />
        </div>
        <div>
          <Label isDark={isDark}>Date</Label>
          <TextInput
            value={data.date}
            onChange={(v) => onChange({ date: v })}
            type="date"
            icon={Calendar}
            isDark={isDark}
          />
        </div>
      </div>

      <div>
        <Label isDark={isDark} hint="optional">Description</Label>
        <TextArea
          value={data.description}
          onChange={(v) => onChange({ description: v })}
          placeholder="Prizes, dress code, parking info…"
          isDark={isDark}
        />
      </div>

      <div>
        <Label isDark={isDark}>Rating System</Label>
        <div className="grid grid-cols-2 gap-3">
          {ratingOptions.map((opt) => {
            const active = data.ratingSystem === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ratingSystem: opt.value })}
                className="flex flex-col items-start rounded-2xl border text-left transition-all duration-200"
                style={{
                  padding: "16px 18px",
                  background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                  border: `2px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                  boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                }}
              >
                <span className="text-base font-semibold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                  {opt.label}
                </span>
                <span className="text-sm mt-1" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                  {opt.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Link to Club — only shown for signed-in owners with at least one club */}
      {(loadingClubs || ownedClubs.length > 0) && (
        <ClubLinkDropdown
          data={data}
          onChange={onChange}
          isDark={isDark}
          ownedClubs={ownedClubs}
          loading={loadingClubs}
        />
      )}
      {/* Fallback: static badge when pre-linked (e.g. from club dashboard) */}
      {!loadingClubs && ownedClubs.length === 0 && data.clubId && data.clubName && (
        <div
          className="flex items-center gap-2.5 rounded-2xl border px-4 py-3"
          style={{
            background: isDark ? "rgba(77,105,64,0.10)" : "#FBFADA",
            border: `1.5px solid ${isDark ? "rgba(77,105,64,0.30)" : "#C6D9C9"}`,
          }}
        >
          <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: T.green }} strokeWidth={1.8} />
          <span className="text-sm" style={{ color: isDark ? T.dSub : T.lSub }}>Linked to club:</span>
          <span className="text-sm font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
            {data.clubName}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Format ───────────────────────────────────────────────────────────

function StepFormat({
  data,
  onChange,
  isDark,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
}) {
  const formats = [
    { value: "swiss" as const, label: "Swiss System", desc: "Paired by score — best for large groups.", icon: Shuffle },
    { value: "doubleswiss" as const, label: "Double Swiss", desc: "Each pairing plays both colors per round — maximum fairness.", icon: Shuffle },
    { value: "roundrobin" as const, label: "Round Robin", desc: "Everyone plays everyone — best for small groups.", icon: Users },
    { value: "elimination" as const, label: "Elimination", desc: "Single knockout bracket — fast and exciting.", icon: Trophy },
    { value: "quads" as const, label: "Quads", desc: "4-player rating sections — each quad plays a 3-round round robin.", icon: Users2 },
  ];

  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const playerOptions = [8, 12, 16, 20, 24, 32, 48, 64, 100];

  return (
    <div className="space-y-8">
      <div>
        <Label isDark={isDark}>Tournament Format</Label>
        <div className="space-y-2.5">
          {formats.map((f) => {
            const Icon = f.icon;
            const active = data.format === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onChange({ format: f.value })}
                className="w-full flex items-center gap-5 rounded-2xl border text-left transition-all duration-200"
                style={{
                  padding: "18px 20px",
                  background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                  border: `2px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                  boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#FBFADA",
                    color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.50)" : "#436850",
                  }}
                >
                  <Icon className="w-6 h-6" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                    {f.label}
                  </p>
                  <p className="text-sm mt-1" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    {f.desc}
                  </p>
                </div>
                {active && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.green }}>
                    <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label isDark={isDark}>Rounds</Label>
          <div className="flex flex-wrap gap-2">
            {roundOptions.map((r) => {
              const active = data.rounds === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange({ rounds: r })}
                  className="w-12 h-12 rounded-xl text-base font-bold transition-all duration-200"
                  style={{
                    background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#FBFADA",
                    color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.60)" : "#436850",
                    boxShadow: active ? `0 2px 8px ${T.greenRing}` : "none",
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label isDark={isDark}>Max Players</Label>
          <div className="flex flex-wrap gap-2">
            {playerOptions.map((p) => {
              const active = data.maxPlayers === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ maxPlayers: p })}
                  className="h-12 px-4 rounded-xl text-base font-bold transition-all duration-200"
                  style={{
                    background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#FBFADA",
                    color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.60)" : "#436850",
                    boxShadow: active ? `0 2px 8px ${T.greenRing}` : "none",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 text-sm"
        style={{ background: isDark ? "rgba(77,105,64,0.12)" : "#FBFADA", color: isDark ? "rgba(255,255,255,0.55)" : "#436850" }}
      >
        <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: T.green }} />
        <span>
          {data.format === "swiss"
            ? `Swiss · ${data.rounds} rounds · up to ${data.maxPlayers} players. Optimal for ${Math.pow(2, data.rounds - 1)} players.`
            : data.format === "doubleswiss"
            ? `Double Swiss · ${data.rounds} rounds · ${data.maxPlayers} players. Each round: 2 games per pairing (both colors).`
            : data.format === "roundrobin"
            ? `Round Robin · ${data.maxPlayers} players = ${(data.maxPlayers * (data.maxPlayers - 1)) / 2} total games.`
            : `Single elimination bracket for up to ${data.maxPlayers} players.`}
        </span>
      </div>

      {/* Rating Brackets Toggle */}
      <div
        className="rounded-2xl transition-all duration-200"
        style={{
          padding: "16px 18px",
          background: data.isBracketParent ? (isDark ? "rgba(255,180,50,0.08)" : "rgba(255,180,50,0.06)") : (isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB"),
          border: `2px solid ${data.isBracketParent ? "rgba(255,180,50,0.30)" : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: data.isBracketParent ? "rgba(255,180,50,0.15)" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6" }}>
              <BarChart3 className="w-4.5 h-4.5" style={{ color: data.isBracketParent ? "#FFB432" : isDark ? T.dMuted : T.lMuted }} />
            </div>
            <div>
              <span className="text-sm font-semibold" style={{ color: isDark ? T.dText : T.lText }}>Split by Rating</span>
              <p className="text-xs mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>Auto-group players into ELO brackets after registration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ isBracketParent: !data.isBracketParent })}
            className="relative w-11 h-6 rounded-full transition-all duration-200"
            style={{ background: data.isBracketParent ? T.green : isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB" }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200"
              style={{ left: data.isBracketParent ? "calc(100% - 22px)" : "2px" }}
            />
          </button>
        </div>
        {data.isBracketParent && (
          <p className="text-xs mt-3 pl-12" style={{ color: "#FFB432" }}>
            After players register, you'll be able to define bracket thresholds and auto-sort players from the tournament dashboard.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Time Control ─────────────────────────────────────────────────────

const TIME_PRESETS = [
  { label: "Bullet", sub: "1+0", base: 1, inc: 0, tag: "Ultra-fast" },
  { label: "Blitz", sub: "3+2", base: 3, inc: 2, tag: "Fast" },
  { label: "Blitz", sub: "5+3", base: 5, inc: 3, tag: "Popular" },
  { label: "Rapid", sub: "10+5", base: 10, inc: 5, tag: "Recommended" },
  { label: "Rapid", sub: "15+10", base: 15, inc: 10, tag: "Club standard" },
  { label: "Classical", sub: "30+30", base: 30, inc: 30, tag: "Long game" },
  { label: "Classical", sub: "90+30", base: 90, inc: 30, tag: "FIDE standard" },
  { label: "Custom", sub: "custom", base: -1, inc: -1, tag: "" },
];

function StepTime({
  data,
  onChange,
  isDark,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
}) {
  const isCustom = data.timePreset === "custom";

  const selectPreset = (p: (typeof TIME_PRESETS)[0]) => {
    if (p.base === -1) {
      onChange({ timePreset: "custom" });
    } else {
      // Auto-suggest rating type based on time control category
      const isBlitzTime = p.label === "Bullet" || p.label === "Blitz";
      onChange({ timePreset: p.sub, timeBase: p.base, timeIncrement: p.inc, ratingType: isBlitzTime ? "blitz" : "rapid" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <Label isDark={isDark}>Time Control</Label>
        <div className="grid grid-cols-4 gap-3">
          {TIME_PRESETS.map((p) => {
            const active = data.timePreset === p.sub;
            return (
              <button
                key={p.sub}
                type="button"
                onClick={() => selectPreset(p)}
                className="flex flex-col items-center rounded-2xl border transition-all duration-200"
                style={{
                  padding: "16px 10px",
                  background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                  border: `2px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                  boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                }}
              >
                <span className="text-base font-bold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                  {p.sub === "custom" ? "Custom" : p.sub}
                </span>
                <span className="text-xs mt-1 font-medium" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                  {p.sub === "custom" ? "Manual" : p.label}
                </span>
                {p.tag && (
                  <span
                    className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#FBFADA",
                      color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.45)" : "#436850",
                    }}
                  >
                    {p.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isCustom && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Base time", unit: "min", value: data.timeBase, min: 1, max: 180, key: "timeBase" as const },
            { label: "Increment", unit: "sec", value: data.timeIncrement, min: 0, max: 60, key: "timeIncrement" as const },
          ].map((field) => (
            <div key={field.key}>
              <Label isDark={isDark}>
                {field.label}{" "}
                <span style={{ color: isDark ? T.dMuted : T.lMuted, fontWeight: 400 }}>({field.unit})</span>
              </Label>
              <div
                className="flex items-center gap-3 rounded-2xl border"
                style={{ padding: "14px 18px", background: isDark ? T.dCard : "#FAFAFA", border: `2px solid ${isDark ? T.dBorder : T.lBorder}` }}
              >
                <button
                  type="button"
                  onClick={() => onChange({ [field.key]: Math.max(field.min, field.value - 1) })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#FBFADA", color: isDark ? T.dText : T.lText }}
                >
                  −
                </button>
                <span className="flex-1 text-center text-xl font-bold" style={{ color: isDark ? T.dText : T.lText }}>
                  {field.value}
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ [field.key]: Math.min(field.max, field.value + 1) })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#FBFADA", color: isDark ? T.dText : T.lText }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 text-sm"
        style={{ background: isDark ? "rgba(77,105,64,0.12)" : "#FBFADA", color: isDark ? "rgba(255,255,255,0.55)" : "#436850" }}
      >
        <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: T.green }} />
        <span>
          {isCustom
            ? `Custom · ${data.timeBase}+${data.timeIncrement} · estimated ${(() => {
                const perGame = data.timeBase * 2 + (data.timeIncrement * 40) / 60;
                const totalMins = perGame * data.rounds * 0.6;
                return totalMins < 60 ? `~${Math.round(totalMins)} min` : `~${(totalMins / 60).toFixed(1)} hrs`;
              })()}`
            : `${data.timePreset} · estimated ${(() => {
                const perGame = data.timeBase * 2 + (data.timeIncrement * 40) / 60;
                const totalMins = perGame * data.rounds * 0.6;
                return totalMins < 60 ? `~${Math.round(totalMins)} min` : `~${(totalMins / 60).toFixed(1)} hrs`;
              })()}`}
        </span>
      </div>
    </div>
  );
}

// ─── Animated QR ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AnimatedQR({ inviteUrl, isDark }: { inviteUrl: string; isDark: boolean }) {
  const [phase, setPhase] = useState<"idle" | "scan" | "done">("idle");
  const [scanY, setScanY] = useState(10);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setPhase("scan");
      let y = 10;
      let dir = 1;
      const animate = () => {
        y += dir * 1.2;
        if (y >= 88) dir = -1;
        if (y <= 10) dir = 1;
        setScanY(y);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
      setTimeout(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setPhase("done");
      }, 2200);
    }, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          width: 180,
          height: 180,
          background: "#FFFFFF",
          boxShadow: phase === "done" ? `0 0 0 3px ${T.green}, 0 8px 24px rgba(77,105,64,0.25)` : `0 4px 16px rgba(0,0,0,0.12)`,
          transition: "box-shadow 0.5s ease",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <QRCodeSVG value={inviteUrl} size={154} level="H" includeMargin={false} fgColor="#1a1a1a" bgColor="#ffffff" />
        </div>
        {([
          { vPos: "top", hPos: "left", cls: "border-t-2 border-l-2 rounded-tl-lg" },
          { vPos: "top", hPos: "right", cls: "border-t-2 border-r-2 rounded-tr-lg" },
          { vPos: "bottom", hPos: "left", cls: "border-b-2 border-l-2 rounded-bl-lg" },
          { vPos: "bottom", hPos: "right", cls: "border-b-2 border-r-2 rounded-br-lg" },
        ] as const).map(({ vPos, hPos, cls }) => (
          <div
            key={`${vPos}-${hPos}`}
            className={`absolute w-5 h-5 transition-all duration-700 ${cls}`}
            style={{ borderColor: phase === "done" ? T.green : "rgba(77,105,64,0.4)", opacity: phase === "done" ? 1 : 0.6, [vPos]: 4, [hPos]: 4 }}
          />
        ))}
        {phase === "scan" && (
          <div
            className="absolute left-2 right-2 pointer-events-none"
            style={{
              top: `${scanY}%`,
              height: 2,
              background: "linear-gradient(90deg, transparent 0%, #4CAF50 20%, #4CAF50 80%, transparent 100%)",
              boxShadow: "0 0 8px 2px rgba(76,175,80,0.6)",
              borderRadius: 2,
            }}
          />
        )}
        {phase === "done" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ animation: "fadeInScale 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: T.green, boxShadow: "0 4px 16px rgba(77,105,64,0.45)" }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs font-semibold transition-colors duration-500" style={{ color: phase === "done" ? T.green : isDark ? T.dMuted : T.lMuted }}>
        {phase === "done" ? "Ready to scan!" : phase === "scan" ? "Generating QR…" : "Players scan to join"}
      </p>
    </div>
  );
}

// ─── Spectator Share Section (embedded in Step 4) ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SpectatorShareSection({ data, isDark }: { data: WizardData; isDark: boolean }) {
  const [specCopied, setSpecCopied] = useState(false);
  const tournamentId = makeSlug(data.name, data.date);
  const spectatorUrl = `${window.location.origin}/tournament/${tournamentId}`;

  const copySpectatorLink = () => {
    navigator.clipboard.writeText(spectatorUrl);
    setSpecCopied(true);
    toast.success("Spectator link copied!");
    setTimeout(() => setSpecCopied(false), 2000);
  };

  return (
    <div
      className="rounded-2xl border space-y-4 p-5"
      style={{
        background: isDark ? "rgba(29,78,216,0.08)" : "#EFF6FF",
        border: `2px solid ${isDark ? "rgba(59,130,246,0.25)" : "#BFDBFE"}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isDark ? "rgba(59,130,246,0.18)" : "#DBEAFE" }}
        >
          <Tv2 className="w-4 h-4" style={{ color: isDark ? "#93C5FD" : "#2563EB" }} strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: isDark ? "#93C5FD" : "#1D4ED8" }}>
              Spectator View
            </span>
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", color: isDark ? "#93C5FD" : "#1D4ED8" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
              Live
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#436850" }}>
            Share with coaches, parents &amp; spectators — no account needed.
          </p>
        </div>
      </div>

      {/* Spectator URL row */}
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center gap-2 rounded-xl border text-xs font-mono truncate"
          style={{
            padding: "11px 14px",
            background: isDark ? "rgba(0,0,0,0.20)" : "#FFFFFF",
            border: `1.5px solid ${isDark ? "rgba(59,130,246,0.20)" : "#BFDBFE"}`,
            color: isDark ? "rgba(255,255,255,0.60)" : "#374151",
          }}
        >
          <Tv2 className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? "#93C5FD" : "#3B82F6" }} />
          <span className="truncate">{spectatorUrl}</span>
        </div>
        <button
          type="button"
          onClick={copySpectatorLink}
          className="flex items-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0"
          style={{
            padding: "11px 16px",
            background: specCopied ? "#2563EB" : isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE",
            color: specCopied ? "#FFFFFF" : isDark ? "#93C5FD" : "#1D4ED8",
          }}
        >
          {specCopied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
          {specCopied ? "Copied!" : "Copy"}
        </button>
        <a
          href={spectatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0"
          style={{
            padding: "11px 16px",
            background: isDark ? "rgba(59,130,246,0.10)" : "#EFF6FF",
            color: isDark ? "#93C5FD" : "#2563EB",
            border: `1.5px solid ${isDark ? "rgba(59,130,246,0.20)" : "#BFDBFE"}`,
          }}
          title="Open spectator view"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Mini QR code */}
      <div className="flex justify-center">
        <div
          className="rounded-2xl p-3"
          style={{ background: "#FFFFFF", border: `1.5px solid ${isDark ? "rgba(59,130,246,0.20)" : "#BFDBFE"}` }}
        >
          <QRCodeSVG
            value={spectatorUrl}
            size={120}
            bgColor="#FFFFFF"
            fgColor="#1D4ED8"
            level="M"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 / Quickstart final: Share ────────────────────────────────────────

function StepShare({ data, isDark, tournamentId }: { data: WizardData; isDark: boolean; tournamentId?: string }) {
  const [copied, setCopied] = useState(false);
  const [customSlugInput, setCustomSlugInput] = useState(data.customSlug || "");
  const [slugSaved, setSlugSaved] = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  // Real-time availability state
  type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugConflict, setSlugConflict] = useState<string | null>(null);
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build the invite URL — prefer custom slug when set, else inviteCode
  const activeSlug = customSlugInput.trim() || data.inviteCode;
  const embeddedMeta = {
    id: makeSlug(data.name, data.date),
    name: data.name,
    venue: data.venue || undefined,
    format: data.format,
    rounds: data.rounds,
    maxPlayers: data.maxPlayers,
    timePreset: data.timePreset,
    inviteCode: data.inviteCode,
  };
  // Unicode-safe base64 encoding — handles em dashes, CJK, emoji, chess symbols, etc.
  const tParam = encodeMetaParam(embeddedMeta);
  const inviteUrl = `${window.location.origin}/join/${encodeURIComponent(activeSlug)}?t=${tParam}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Sanitise slug: lowercase letters, numbers, hyphens only (no underscores, no uppercase)
  const sanitiseSlug = (v: string) =>
    v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);

  // Validate slug format (must start and end with alphanumeric, no consecutive hyphens)
  const isValidSlugFormat = (s: string): boolean => {
    if (s.length < 2) return false;
    return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s);
  };

  const checkSlugAvailability = (slug: string) => {
    if (!slug || slug.length < 2) { setSlugStatus("idle"); setSlugConflict(null); return; }
    if (!isValidSlugFormat(slug)) {
      setSlugStatus("invalid");
      setSlugConflict("Must start and end with a letter or number, no consecutive hyphens");
      return;
    }
    // Skip check if it's the same as the already-saved value
    if (slug === data.customSlug && slugSaved) { setSlugStatus("available"); setSlugConflict(null); return; }
    setSlugStatus("checking");
    setSlugConflict(null);
    const excludeParam = tournamentId ? `?exclude=${encodeURIComponent(tournamentId)}` : "";
    authFetch(`/api/auth/join/check-slug/${encodeURIComponent(slug)}${excludeParam}`)
      .then((r) => r.json())
      .then((result: { available: boolean; conflict: string | null }) => {
        setSlugStatus(result.available ? "available" : "taken");
        setSlugConflict(result.conflict);
      })
      .catch(() => {
        // Network error — don't block the user, just reset to idle
        setSlugStatus("idle");
        setSlugConflict(null);
      });
  };

  const handleSlugChange = (v: string) => {
    const clean = sanitiseSlug(v);
    setCustomSlugInput(clean);
    setSlugSaved(false);
    setSlugStatus("idle");
    setSlugConflict(null);
    // Propagate to wizard data so registerTournamentNow picks it up
    data.customSlug = clean;
    // Debounce the availability check
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    if (clean.length >= 2) {
      slugDebounceRef.current = setTimeout(() => checkSlugAvailability(clean), 400);
    }
  };

  const saveSlug = async () => {
    const clean = customSlugInput.trim();
    if (!clean || slugStatus === "taken" || slugStatus === "checking" || slugStatus === "invalid") return;
    data.customSlug = clean;
    setSlugSaving(true);
    // Persist to server if we have a tournament ID (user is signed in)
    if (tournamentId) {
      try {
        await authFetch(`/api/auth/user/tournaments/${encodeURIComponent(tournamentId)}/custom-slug`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ customSlug: clean }),
        });
      } catch {
        // Non-critical — localStorage already has the slug
      }
    }
    setSlugSaving(false);
    setSlugSaved(true);
    setSlugStatus("available"); // mark as confirmed available after save
    toast.success("Custom URL saved!");
    setTimeout(() => setSlugSaved(false), 2000);
  };

  const formatLabel = data.format === "swiss" ? "Swiss" : data.format === "doubleswiss" ? "Double Swiss" : data.format === "roundrobin" ? "Round Robin" : data.format === "swiss_elim" ? "Swiss + Elimination" : data.format === "quads" ? "Quads" : "Elimination";
  const timeLabel = data.timePreset === "custom" ? `${data.timeBase}+${data.timeIncrement}` : data.timePreset;

  return (
    <div className="space-y-7">

      {/* ── Welcome header ──────────────────────────────────────────────── */}
      <div className="text-center space-y-1.5">
        <p
          className="text-xs font-bold tracking-[0.18em] uppercase"
          style={{ color: T.green }}
        >
          Welcome!
        </p>
        <h2
          className="text-2xl font-black leading-tight tracking-tight"
          style={{ color: isDark ? T.dText : T.lText }}
        >
          {data.name}
        </h2>
        {data.venue && (
          <p className="text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>
            {data.venue}
          </p>
        )}
      </div>

      {/* ── Summary strip ───────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-3 gap-3 rounded-2xl border p-4"
        style={{
          background: isDark ? T.dCard : "#F9FAF8",
          border: `1.5px solid ${isDark ? T.dBorder : "#EEEED2"}`,
        }}
      >
        {[
          { icon: Shuffle, label: formatLabel, sub: `${data.rounds} rounds` },
          { icon: Clock, label: timeLabel, sub: "time control" },
          { icon: Users, label: `${data.maxPlayers}`, sub: "max players" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-1 text-center">
            <Icon className="w-4 h-4" style={{ color: T.green }} strokeWidth={1.8} />
            <span className="text-sm font-bold" style={{ color: isDark ? T.dText : T.lText }}>{label}</span>
            <span className="text-[11px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>{sub}</span>
          </div>
        ))}
      </div>

      {/* ── How it works — 3-step flow ──────────────────────────────────── */}
      <div className="space-y-2">
        <p
          className="text-[11px] font-bold tracking-[0.14em] uppercase mb-3"
          style={{ color: isDark ? T.dMuted : T.lMuted }}
        >
          How it works
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              step: "1",
              icon: (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z" />
                </svg>
              ),
              title: "Scan QR",
              body: "Players scan the code with their phone",
            },
            {
              step: "2",
              icon: (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              ),
              title: "Enter Username",
              body: "chess.com username — ELO fetched automatically",
            },
            {
              step: "3",
              icon: (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              ),
              title: "Play",
              body: "Pairings generated when you start Round 1",
            },
          ].map(({ step, icon, title, body }) => (
            <div
              key={step}
              className="flex flex-col items-center text-center gap-2 rounded-2xl p-3"
              style={{
                background: isDark ? "rgba(77,105,64,0.08)" : "#FBFADA",
                border: `1.5px solid ${isDark ? "rgba(77,105,64,0.18)" : "#D4E6D8"}`,
              }}
            >
              {/* Step number + icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isDark ? "rgba(77,105,64,0.20)" : "#FFFFFF", color: T.green }}
              >
                {icon}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: isDark ? T.dText : T.lText }}>{title}</p>
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QR code hint ─────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{
          background: isDark ? "rgba(77,105,64,0.10)" : "#FBFADA",
          border: `1.5px solid ${isDark ? "rgba(77,105,64,0.22)" : "#D4E6D8"}`,
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: isDark ? "rgba(77,105,64,0.25)" : "#FFFFFF", color: T.green }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
            QR code ready on the next screen
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: isDark ? T.dMuted : T.lMuted }}>
            Once you tap <strong>Go to Tournament</strong>, a full-screen QR code will appear so players can scan and join instantly.
          </p>
        </div>
      </div>

    </div>
  );
}

// ─── Brackets Step 1: Details ─────────────────────────────────────────────────

function BracketsStepDetails({
  data,
  onChange,
  isDark,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
}) {
  return (
    <div className="space-y-6">
      <Label isDark={isDark}>Event Name</Label>
      <TextInput
        value={data.name}
        onChange={(v) => onChange({ name: v })}
        placeholder="e.g. Saturday Rated Brackets"
        isDark={isDark}
        icon={Trophy}
      />

      <Label isDark={isDark} hint="optional">Location</Label>
      <TextInput
        value={data.venue}
        onChange={(v) => onChange({ venue: v })}
        placeholder="e.g. SD Chess Club"
        isDark={isDark}
        icon={MapPin}
      />

      <Label isDark={isDark}>Date</Label>
      <TextInput
        value={data.date}
        onChange={(v) => onChange({ date: v })}
        placeholder="YYYY-MM-DD"
        isDark={isDark}
        type="date"
        icon={Calendar}
      />
    </div>
  );
}

// ─── Brackets Step 2: Bracket Editor ──────────────────────────────────────────

interface BracketDef {
  label: string;
  minElo: number;
  maxElo: number;
}

const BRACKET_PRESETS: { label: string; brackets: BracketDef[] }[] = [
  {
    label: "2 Brackets",
    brackets: [
      { label: "Under 1500", minElo: 0, maxElo: 1499 },
      { label: "1500+", minElo: 1500, maxElo: 9999 },
    ],
  },
  {
    label: "3 Brackets",
    brackets: [
      { label: "Under 1000", minElo: 0, maxElo: 999 },
      { label: "1000–1500", minElo: 1000, maxElo: 1499 },
      { label: "1500+", minElo: 1500, maxElo: 9999 },
    ],
  },
  {
    label: "4 Brackets",
    brackets: [
      { label: "Under 800", minElo: 0, maxElo: 799 },
      { label: "800–1200", minElo: 800, maxElo: 1199 },
      { label: "1200–1600", minElo: 1200, maxElo: 1599 },
      { label: "1600+", minElo: 1600, maxElo: 9999 },
    ],
  },
];

function BracketsStepEditor({
  data,
  onChange,
  isDark,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
}) {
  const [brackets, setBrackets] = useState<BracketDef[]>(
    BRACKET_PRESETS[1].brackets // default: 3 brackets
  );
  const [selectedPreset, setSelectedPreset] = useState(1);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Shared tournament settings for all brackets
  const [format, setFormat] = useState<WizardData["format"]>(data.format);
  const [rounds, setRounds] = useState(data.rounds);
  const [timeBase, setTimeBase] = useState(data.timeBase);
  const [timeIncrement, setTimeIncrement] = useState(data.timeIncrement);
  const [ratingPlatform, setRatingPlatform] = useState<WizardData["ratingSystem"]>(data.ratingSystem);

  // Sync back to parent data
  useEffect(() => {
    onChange({
      format,
      rounds,
      timeBase,
      timeIncrement,
      ratingSystem: ratingPlatform,
      ratingType: timeBase < 10 ? "blitz" : "rapid",
    });
  }, [format, rounds, timeBase, timeIncrement, ratingPlatform]);

  const applyPreset = (idx: number) => {
    setSelectedPreset(idx);
    setBrackets(BRACKET_PRESETS[idx].brackets);
    setEditingIdx(null);
  };

  const updateBracket = (idx: number, field: keyof BracketDef, value: string | number) => {
    setBrackets((prev) => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    setSelectedPreset(-1); // custom
  };

  const addBracket = () => {
    const last = brackets[brackets.length - 1];
    const newMin = last ? last.maxElo + 1 : 0;
    setBrackets((prev) => [...prev, { label: `${newMin}+`, minElo: newMin, maxElo: 9999 }]);
    setSelectedPreset(-1);
  };

  const removeBracket = (idx: number) => {
    if (brackets.length <= 2) return;
    setBrackets((prev) => prev.filter((_, i) => i !== idx));
    setSelectedPreset(-1);
  };

  const formatOptions: { value: WizardData["format"]; label: string }[] = [
    { value: "swiss", label: "Swiss" },
    { value: "doubleswiss", label: "Double Swiss" },
    { value: "roundrobin", label: "Round Robin" },
    { value: "elimination", label: "Elimination" },
    { value: "quads", label: "Quads" },
  ];

  const timePresets = [
    { label: "3+2 Blitz", base: 3, inc: 2 },
    { label: "5+0 Blitz", base: 5, inc: 0 },
    { label: "5+3 Blitz", base: 5, inc: 3 },
    { label: "10+0 Rapid", base: 10, inc: 0 },
    { label: "10+5 Rapid", base: 10, inc: 5 },
    { label: "15+10 Rapid", base: 15, inc: 10 },
    { label: "30+0 Classical", base: 30, inc: 0 },
  ];

  return (
    <div className="space-y-8">
      {/* Bracket Presets */}
      <div>
        <Label isDark={isDark}>Number of Brackets</Label>
        <div className="flex gap-2 mt-3">
          {BRACKET_PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyPreset(i)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: selectedPreset === i ? T.green : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                color: selectedPreset === i ? "#FFF" : isDark ? T.dSub : T.lSub,
                border: `2px solid ${selectedPreset === i ? T.green : isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB"}`,
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setSelectedPreset(-1); }}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: selectedPreset === -1 ? "rgba(255,180,50,0.15)" : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              color: selectedPreset === -1 ? "#FFB432" : isDark ? T.dSub : T.lSub,
              border: `2px solid ${selectedPreset === -1 ? "rgba(255,180,50,0.40)" : isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB"}`,
            }}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Bracket Definitions */}
      <div>
        <Label isDark={isDark}>Bracket Thresholds</Label>
        <div className="space-y-3 mt-3">
          {brackets.map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl transition-all duration-200"
              style={{
                padding: "14px 16px",
                background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB",
                border: `2px solid ${editingIdx === i ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}`,
              }}
            >
              {/* Order badge */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "rgba(255,180,50,0.15)", color: "#FFB432" }}
              >
                {i + 1}
              </div>

              {/* Label */}
              {editingIdx === i ? (
                <input
                  type="text"
                  value={b.label}
                  onChange={(e) => updateBracket(i, "label", e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-semibold"
                  style={{ color: isDark ? T.dText : T.lText }}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-sm font-semibold cursor-pointer"
                  style={{ color: isDark ? T.dText : T.lText }}
                  onClick={() => setEditingIdx(i)}
                >
                  {b.label}
                </span>
              )}

              {/* ELO range */}
              {editingIdx === i ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={b.minElo}
                    onChange={(e) => updateBracket(i, "minElo", parseInt(e.target.value) || 0)}
                    className="w-16 text-center text-xs rounded-lg py-1.5 bg-transparent outline-none"
                    style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB"}`, color: isDark ? T.dText : T.lText }}
                  />
                  <span className="text-xs" style={{ color: isDark ? T.dMuted : T.lMuted }}>–</span>
                  <input
                    type="number"
                    value={b.maxElo === 9999 ? "" : b.maxElo}
                    placeholder="∞"
                    onChange={(e) => updateBracket(i, "maxElo", parseInt(e.target.value) || 9999)}
                    className="w-16 text-center text-xs rounded-lg py-1.5 bg-transparent outline-none"
                    style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB"}`, color: isDark ? T.dText : T.lText }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingIdx(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: T.green, color: "#FFF" }}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span
                  className="text-xs font-medium cursor-pointer"
                  style={{ color: isDark ? T.dMuted : T.lMuted }}
                  onClick={() => setEditingIdx(i)}
                >
                  {b.minElo}–{b.maxElo === 9999 ? "∞" : b.maxElo}
                </span>
              )}

              {/* Remove */}
              {brackets.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeBracket(i)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#9CA3AF" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Add bracket */}
          <button
            type="button"
            onClick={addBracket}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              border: `2px dashed ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`,
              color: isDark ? T.dSub : T.lSub,
            }}
          >
            + Add Bracket
          </button>
        </div>
      </div>

      {/* Shared Settings */}
      <div>
        <Label isDark={isDark}>Shared Tournament Settings</Label>
        <p className="text-xs mt-1 mb-3" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          Applied to all brackets. Each bracket runs as its own independent tournament.
        </p>

        {/* Format */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {formatOptions.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className="py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: format === f.value ? T.green : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                color: format === f.value ? "#FFF" : isDark ? T.dSub : T.lSub,
                border: `2px solid ${format === f.value ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Rounds */}
        <div className="flex items-center justify-between mb-4 rounded-xl py-3 px-4" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}` }}>
          <span className="text-sm font-medium" style={{ color: isDark ? T.dText : T.lText }}>Rounds</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRounds(Math.max(1, rounds - 1))} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB", color: isDark ? T.dText : T.lText }}>−</button>
            <span className="text-sm font-bold w-6 text-center" style={{ color: isDark ? T.dText : T.lText }}>{rounds}</span>
            <button type="button" onClick={() => setRounds(Math.min(15, rounds + 1))} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB", color: isDark ? T.dText : T.lText }}>+</button>
          </div>
        </div>

        {/* Time Control */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {timePresets.map((tp) => (
            <button
              key={tp.label}
              type="button"
              onClick={() => { setTimeBase(tp.base); setTimeIncrement(tp.inc); }}
              className="py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: timeBase === tp.base && timeIncrement === tp.inc ? T.green : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
                color: timeBase === tp.base && timeIncrement === tp.inc ? "#FFF" : isDark ? T.dSub : T.lSub,
                border: `2px solid ${timeBase === tp.base && timeIncrement === tp.inc ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}`,
              }}
            >
              {tp.label}
            </button>
          ))}
        </div>

        {/* Rating Platform */}
        <div className="flex items-center justify-between rounded-xl py-3 px-4" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB"}` }}>
          <span className="text-sm font-medium" style={{ color: isDark ? T.dText : T.lText }}>Rating Platform</span>
          <div className="flex gap-1.5">
            {(["chess.com", "lichess"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRatingPlatform(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: ratingPlatform === p ? T.green : "transparent",
                  color: ratingPlatform === p ? "#FFF" : isDark ? T.dSub : T.lSub,
                }}
              >
                {p === "chess.com" ? "Chess.com" : "Lichess"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: isDark ? "rgba(255,180,50,0.06)" : "rgba(255,180,50,0.08)",
          border: `1px solid rgba(255,180,50,0.20)`,
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4" style={{ color: "#FFB432" }} />
          <span className="text-sm font-bold" style={{ color: "#FFB432" }}>Bracket Summary</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {brackets.map((b, i) => (
            <span
              key={i}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,180,50,0.15)", color: "#FFB432" }}
            >
              {b.label}
            </span>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          {brackets.length} brackets · {format} · {rounds} rounds · {timeBase}+{timeIncrement} · {ratingPlatform === "chess.com" ? "Chess.com" : "Lichess"}
        </p>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface TournamentWizardProps {
  open: boolean;
  /** Called when the wizard closes. If a tournament was created, the id and name are passed. */
  onClose: (createdTournamentId?: string, createdTournamentName?: string) => void;
  /** Pre-select a club when opening the wizard from a club profile page. */
  initialClubId?: string | null;
  initialClubName?: string | null;
}

export function TournamentWizard({ open, onClose, initialClubId, initialClubName }: TournamentWizardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user } = useAuthContext();
  const [mode, setMode] = useState<WizardMode>("select");
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [data, setData] = useState<WizardData>({
    ...DEFAULT_DATA,
    inviteCode: nanoid(8).toUpperCase(),
    directorCode: generateDirectorCode(),
  });
  const { fireConfetti } = useConfetti();
  const [, navigate] = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardScroll(scrollContainerRef, 24);

  // Owned clubs for the "Link to Club" dropdown
  const [ownedClubs, setOwnedClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  useEffect(() => {
    if (!open || !user || user.isGuest) return;
    setLoadingClubs(true);
    apiListMyClubs()
      .then((clubs) => {
        // Only show clubs where this user is the owner
        setOwnedClubs(clubs.filter((c) => c.ownerId === user.id));
      })
      .catch(() => setOwnedClubs([]))
      .finally(() => setLoadingClubs(false));
  }, [open, user]);

  // Reset on open + body scroll lock
  useEffect(() => {
    if (open) {
      setMode("select");
      setStep(0);
      setDirection(1);
      setData({
        ...DEFAULT_DATA,
        inviteCode: nanoid(8).toUpperCase(),
        directorCode: generateDirectorCode(),
        clubId: initialClubId ?? null,
        clubName: initialClubName ?? null,
      });
      // Prevent background scroll on iOS/Android while wizard is open.
      // iOS Safari requires position:fixed + capturing the current scrollY to
      // avoid the page jumping back to top when the lock is released.
      const scrollY = window.scrollY;
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      const prevTop = document.body.style.top;
      const prevWidth = document.body.style.width;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.position = prevPosition;
        document.body.style.top = prevTop;
        document.body.style.width = prevWidth;
        // Restore scroll position after releasing the lock
        window.scrollTo(0, scrollY);
      };
    }
  }, [open, initialClubId, initialClubName]);

  // When entering quickstart mode, auto-fill today's date
  const handleSelectMode = (m: "quickstart" | "schedule" | "large_event" | "brackets" | "quads") => {
    if (m === "quickstart") {
      setData((d) => ({ ...d, date: todayIso() }));
    }
    if (m === "large_event") {
      // Pre-configure swiss_elim defaults: 100 max, 3 Swiss rounds, top-64 cutoff
      setData((d) => ({
        ...d,
        date: todayIso(),
        format: "swiss_elim" as const,
        rounds: 3,
        swissRounds: 3,
        maxPlayers: 100,
        elimCutoff: 64,
      }));
      // Use quickstart flow with pre-filled large event defaults
      setMode("quickstart");
      setStep(0);
      setDirection(1);
      return;
    }
    if (m === "quads") {
      // Pre-configure Quads defaults: format quads, 3 rounds (fixed)
      setData((d) => ({
        ...d,
        date: todayIso(),
        format: "quads" as const,
        rounds: 3,
      }));
      // Use quickstart flow with pre-filled Quads defaults
      setMode("quickstart");
      setStep(0);
      setDirection(1);
      return;
    }
    if (m === "brackets") {
      setData((d) => ({ ...d, date: todayIso() }));
      setMode("brackets");
      setStep(0);
      setDirection(1);
      return;
    }
    setMode(m);
    setStep(0);
    setDirection(1);
  };

  // ── Schedule path: 4 steps (0..3) ──────────────────────────────────────────
  // ── Quickstart path: 1 step (0 = form) then directly to share (step 1) ───

  const scheduleStepCount = SCHEDULE_STEPS.length; // 4
  const quickstartStepCount = 2; // form + share
  const bracketsStepCount = 3; // details + bracket editor + share

  const totalSteps = mode === "brackets" ? bracketsStepCount : mode === "quickstart" ? quickstartStepCount : scheduleStepCount;

  const canAdvance =
    mode === "select"
      ? false
      : mode === "brackets"
      ? step === 0
        ? data.name.trim().length > 0
        : true
      : mode === "quickstart"
      ? step === 0
        ? data.name.trim().length > 0
        : true
      : step === 0
      ? data.name.trim().length > 0
      : true;

  // registerTournamentNow: persists the tournament config to localStorage immediately.
  // Called when the share step is shown so the QR code is valid before the director
  // clicks "Go to Tournament".
  const registerTournamentNow = useCallback(() => {
    const slug = makeSlug(data.name, data.date);
    registerTournament({
      id: slug,
      inviteCode: data.inviteCode,
      directorCode: data.directorCode,
      name: data.name,
      venue: data.venue,
      date: data.date,
      description: data.description,
      format: data.format,
      rounds: data.rounds,
      ...(data.swissRounds ? { swissRounds: data.swissRounds } : {}),
      ...(data.elimCutoff ? { elimCutoff: data.elimCutoff } : {}),
      maxPlayers: data.maxPlayers,
      timeBase: data.timeBase,
      timeIncrement: data.timeIncrement,
      timePreset: data.timePreset,
      ratingSystem: data.ratingSystem,
      ratingType: data.ratingType,
      createdAt: new Date().toISOString(),
      ownerId: user?.id ? parseInt(user.id, 10) : null,
      clubId: data.clubId ?? null,
      clubName: data.clubName ?? null,
      customSlug: data.customSlug.trim() || null,
      coverImageUrl: data.coverImageUrl || null,
    });
    grantDirectorSession(slug);
    // If signed in, persist to server so My Tournaments history is cross-device
    if (user?.id) {
      authFetch(`/api/auth/user/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tournamentId: slug,
          name: data.name,
          venue: data.venue,
          date: data.date,
          format: data.format,
          rounds: data.rounds,
          inviteCode: data.inviteCode,
        }),
      }).catch(() => { /* non-critical — localStorage is the source of truth */ });
    }
  }, [data, user?.id]);

  const commitTournament = useCallback(() => {
    const slug = makeSlug(data.name, data.date);
    // registerTournamentNow may have already been called; registerTournament is idempotent.
    registerTournamentNow();
    // Pass the tournament id and name back so callers (e.g. ClubProfile) can post feed events.
    onClose(slug, data.name);
    navigate(`/tournament/${slug}/manage`);
  }, [data, onClose, navigate, registerTournamentNow]);

  const handleNext = useCallback(() => {
    if (mode === "select") return;

    if (step < totalSteps - 1) {
      setDirection(1);
      const next = step + 1;
      setStep(next);
      // When reaching the share step, register the tournament immediately so the
      // QR code is valid even before the director clicks "Go to Tournament".
      const reachingShareStep =
        (mode === "quickstart" && next === 1) ||
        (mode === "schedule" && next === SCHEDULE_STEPS.length - 1) ||
        (mode === "brackets" && next === 2);
      if (reachingShareStep) {
        registerTournamentNow();
        setTimeout(() => fireConfetti(130), 300);
      }
    } else {
      commitTournament();
    }
  }, [mode, step, totalSteps, fireConfetti, commitTournament, registerTournamentNow]);

  const handleBack = useCallback(() => {
    if (mode === "select") {
      onClose();
      return;
    }
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    } else {
      // Back from first step of either path → return to mode select
      setMode("select");
    }
  }, [mode, step, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        if (mode === "select") onClose();
        else setMode("select");
      }
      if (e.key === "Enter" && canAdvance && !(e.target instanceof HTMLTextAreaElement)) {
        handleNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, canAdvance, handleNext, mode, onClose]);

  useSwipeGesture(scrollContainerRef, {
    onSwipeLeft: () => { if (canAdvance) handleNext(); },
    onSwipeRight: handleBack,
    threshold: 60,
    maxVerticalDrift: 80,
  });

  const patch = (p: Partial<WizardData>) => setData((d) => ({ ...d, ...p }));

  if (!open) return null;

  // ── Mode selection screen ─────────────────────────────────────────────────
  if (mode === "select") {
    return createPortal(
      <>
        <ModeSelect isDark={isDark} onSelect={handleSelectMode} onClose={onClose} />
        <style>{`
          @keyframes wizardFadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </>,
      document.body
    );
  }

  // ── Determine which step component to render ──────────────────────────────
  const isShareStep =
    (mode === "quickstart" && step === 1) ||
    (mode === "schedule" && step === SCHEDULE_STEPS.length - 1) ||
    (mode === "brackets" && step === 2);

  const heroStep = mode === "schedule" ? step : 0;

  const stepLabel =
    mode === "brackets"
      ? ["Details", "Brackets", "Share"][step]
      : mode === "quickstart"
      ? step === 0
        ? "Quickstart"
        : "Share"
      : SCHEDULE_STEPS[step].label;

  const stepEyebrow =
    mode === "brackets"
      ? `Step ${step + 1} of 3`
      : mode === "quickstart"
      ? step === 0
        ? "Quickstart"
        : ""
      : SCHEDULE_STEPS[step].hero.eyebrow;

  const stepTitle =
    mode === "brackets"
      ? ["Name your event", "Define brackets", ""][step]
      : mode === "quickstart"
      ? step === 0
        ? "Start in\nseconds"
        : ""
      : SCHEDULE_STEPS[step].hero.title.replace("\n", " ");

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex"
      style={{ background: isDark ? T.dBg : T.lBg, animation: "wizardFadeIn 0.3s ease both", overscrollBehavior: "contain", touchAction: "pan-y" }}
    >
      {/* ── Left hero panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[32%] xl:w-[34%] flex-shrink-0">
        <HeroPanel step={heroStep} isDark={isDark} mode={mode} format={data.format} onClose={() => onClose()} />
      </div>

      {/* ── Right input panel ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden" style={{ background: isDark ? T.dPanel : "#FFFFFF", height: "100%", maxHeight: "100dvh", touchAction: "pan-y" }}>
        {/* Progress bar */}
        <ProgressBar step={step} total={totalSteps} isDark={isDark} />

        {/* ── Mobile top bar ── */}
        <div
          className="lg:hidden flex items-center justify-between px-4 pb-3 flex-shrink-0 border-b"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", borderColor: isDark ? "rgba(255,255,255,0.07)" : "#F0F0F0" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.green }}>
              <img src={OTB_LOGO_URL} alt="OTB" className="w-4.5 h-4.5 object-contain" />
            </div>
            <div className="flex flex-col leading-none gap-0.5">
              <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                Step {step + 1} of {totalSteps}
              </span>
              <span className="text-[15px] font-bold leading-none" style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? T.dText : T.lText }}>
                {stepLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  background: i === step ? T.green : i < step ? "rgba(77,105,64,0.5)" : isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB",
                }}
              />
            ))}
          </div>
          {/* 44px close button */}
          <button
            onClick={() => setMode("select")}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: isDark ? T.dSub : T.lSub, touchAction: "manipulation" }}
            aria-label="Back to mode selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Desktop top bar ── */}
        <div className="hidden lg:flex items-center justify-between px-16 xl:px-20 pt-8 pb-0 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: isDark ? T.dMuted : T.lMuted }}>
              {stepLabel}
            </span>
          </div>
          <button
            onClick={() => setMode("select")}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: isDark ? T.dSub : T.lSub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.12)" : "#E5E7EB"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef} style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", scrollPaddingBottom: "8rem" }}>
          <div
            className="w-full px-5 sm:px-12 lg:px-16 xl:px-20 py-5 sm:py-10 pb-6"
            key={`${mode}-${step}`}
            style={{ animation: `stepSlideIn${direction > 0 ? "Right" : "Left"} 0.30s cubic-bezier(0.22,1,0.36,1) both` }}
          >
            {/* Mobile step eyebrow */}
            <p className="lg:hidden text-[11px] font-semibold tracking-widest uppercase mb-1.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
              {stepEyebrow}
            </p>
            {/* Mobile step title */}
            <h2
              className="lg:hidden text-xl font-bold mb-4"
              style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? T.dText : T.lText }}
            >
              {stepTitle}
            </h2>

            {/* Quickstart path */}
            {mode === "quickstart" && step === 0 && <QuickstartForm data={data} onChange={patch} isDark={isDark} onSubmit={canAdvance ? handleNext : undefined} ownedClubs={ownedClubs} loadingClubs={loadingClubs} />}
            {mode === "quickstart" && step === 1 && <StepShare data={data} isDark={isDark} tournamentId={makeSlug(data.name, data.date)} />}

            {/* Schedule path */}
            {mode === "schedule" && step === 0 && <StepDetails data={data} onChange={patch} isDark={isDark} ownedClubs={ownedClubs} loadingClubs={loadingClubs} />}
            {mode === "schedule" && step === 1 && <StepFormat data={data} onChange={patch} isDark={isDark} />}
            {mode === "schedule" && step === 2 && <StepTime data={data} onChange={patch} isDark={isDark} />}
            {mode === "schedule" && step === 3 && <StepShare data={data} isDark={isDark} tournamentId={makeSlug(data.name, data.date)} />}

            {/* Brackets path */}
            {mode === "brackets" && step === 0 && <BracketsStepDetails data={data} onChange={patch} isDark={isDark} />}
            {mode === "brackets" && step === 1 && <BracketsStepEditor data={data} onChange={patch} isDark={isDark} />}
            {mode === "brackets" && step === 2 && <StepShare data={data} isDark={isDark} tournamentId={makeSlug(data.name, data.date)} />}
          </div>
        </div>

        {/* ── Mobile bottom nav ── */}
        <div
          className="lg:hidden flex-shrink-0 flex flex-col gap-2 px-4 border-t"
          style={{
            paddingTop: '0.875rem',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0",
            background: isDark ? T.dPanel : "#FFFFFF",
            position: "sticky",
            bottom: 0,
            zIndex: 10,
          }}
        >
          {/* Primary CTA — 56px height for easy tap */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance}
            className="w-full flex items-center justify-center gap-2 text-base font-bold rounded-2xl transition-all duration-200 active:scale-[0.98]"
            style={{
              minHeight: "52px",
              padding: "14px 24px",
              background: canAdvance ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#FBFADA",
              color: canAdvance ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : T.lMuted,
              cursor: canAdvance ? "pointer" : "not-allowed",
              boxShadow: canAdvance ? `0 4px 18px rgba(77,105,64,0.35)` : "none",
              touchAction: "manipulation",
            }}
          >
            {isShareStep ? (
              <><ArrowRight className="w-5 h-5" /> Go to Tournament</>
            ) : (
              <>Continue <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
          {/* Back — 44px touch target */}
          <button
            type="button"
            onClick={handleBack}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
            style={{ minHeight: "44px", color: isDark ? T.dSub : T.lSub, touchAction: "manipulation" }}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Back to options" : "Back"}
          </button>
        </div>

        {/* ── Desktop bottom nav ── */}
        <div
          className="hidden lg:flex flex-shrink-0 items-center justify-between px-16 xl:px-20 py-5 border-t"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0", background: isDark ? T.dPanel : "#FFFFFF" }}
        >
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm font-medium rounded-xl transition-all duration-200"
            style={{ padding: "10px 16px", color: isDark ? T.dSub : T.lSub }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6"; (e.currentTarget as HTMLButtonElement).style.color = isDark ? T.dText : T.lText; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = isDark ? T.dSub : T.lSub; }}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Back to options" : "Back"}
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  background: i === step ? T.green : i < step ? "rgba(77,105,64,0.45)" : isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB",
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance}
            className="flex items-center gap-2 text-sm font-semibold rounded-xl transition-all duration-200"
            style={{
              padding: "10px 22px",
              background: canAdvance ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#FBFADA",
              color: canAdvance ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : T.lMuted,
              cursor: canAdvance ? "pointer" : "not-allowed",
              boxShadow: canAdvance ? `0 4px 14px rgba(77,105,64,0.30)` : "none",
            }}
            onMouseEnter={(e) => { if (!canAdvance) return; (e.currentTarget as HTMLButtonElement).style.background = T.greenDark; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(77,105,64,0.40)"; }}
            onMouseLeave={(e) => { if (!canAdvance) return; (e.currentTarget as HTMLButtonElement).style.background = T.green; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(77,105,64,0.30)"; }}
          >
            {isShareStep ? (
              <><ArrowRight className="w-4 h-4" /> Go to Tournament</>
            ) : (
              <>Continue <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes wizardFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes heroIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes stepSlideInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes stepSlideInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>,
    document.body
  );
}
