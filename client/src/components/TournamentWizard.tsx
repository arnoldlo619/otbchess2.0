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
import { recommendedRounds, roundsHint, roundRangeLabel } from "@/lib/recommendedRounds";
import { registerTournament, makeSlug, generateDirectorCode, grantDirectorSession } from "@/lib/tournamentRegistry";
import {
  X,
  Crown,
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
  Shield,
  Eye,
  EyeOff,
  Bolt,
  ChevronDown,
  Tv2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardMode = "select" | "quickstart" | "schedule" | "large_event";

interface WizardData {
  name: string;
  venue: string;
  date: string;
  description: string;
  format: "swiss" | "doubleswiss" | "roundrobin" | "elimination" | "swiss_elim";
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
  timePreset: "10+5",
  ratingSystem: "chess.com",
  ratingType: "rapid",
  inviteCode: "",
  directorCode: "",
  clubId: null,
  clubName: null,
  customSlug: "",
};

// ─── Schedule steps metadata ──────────────────────────────────────────────────

const SCHEDULE_STEPS = [
  {
    id: 0,
    label: "Details",
    icon: Trophy,
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
  green: "#3D6B47",
  greenDark: "#2A4A32",
  greenBg: "rgba(61,107,71,0.08)",
  greenRing: "rgba(61,107,71,0.25)",
  // light
  lBg: "#FFFFFF",
  lPanel: "#F7F9F6",
  lBorder: "#E5E7EB",
  lBorderFocus: "#3D6B47",
  lText: "#1A1A1A",
  lSub: "#6B7280",
  lMuted: "#9CA3AF",
  lInput: "#FFFFFF",
  lInputBorder: "#D1D5DB",
  // dark
  dBg: "oklch(0.18 0.05 145)",
  dPanel: "oklch(0.22 0.06 145)",
  dCard: "oklch(0.25 0.07 145)",
  dBorder: "rgba(255,255,255,0.10)",
  dBorderFocus: "#3D6B47",
  dText: "#FFFFFF",
  dSub: "rgba(255,255,255,0.55)",
  dMuted: "rgba(255,255,255,0.30)",
  dInput: "oklch(0.25 0.07 145)",
  dInputBorder: "rgba(255,255,255,0.12)",
};

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
  onClose,
}: {
  step: number;
  isDark: boolean;
  mode: "quickstart" | "schedule" | "large_event";
  onClose?: () => void;
}) {
  const s = mode === "quickstart" ? QUICKSTART_HERO : SCHEDULE_STEPS[step];
  const Icon = s.icon;

  const dots = mode === "quickstart" ? 2 : SCHEDULE_STEPS.length; // quickstart: mode-select + quickstart form
  const activeDot = mode === "quickstart" ? 1 : step;

  return (
    <div
      className="relative flex flex-col justify-between h-full px-10 py-12 overflow-hidden"
      style={{
        background: isDark
          ? "oklch(0.20 0.08 145)"
          : "linear-gradient(145deg, #1A3A22 0%, #2A5535 60%, #3D6B47 100%)",
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
            <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
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
    <div className="flex items-baseline gap-2 mb-3 lg:mb-4">
      <label className="text-base lg:text-lg font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.90)" : "#1F2937" }}>
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
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
          style={{ color: isDark ? T.dMuted : T.lMuted }}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-2xl border outline-none transition-all duration-200"
        style={{
          padding: large ? "18px 20px 18px 56px" : Icon ? "16px 18px 16px 52px" : "16px 20px",
          fontSize: large ? 22 : 17,
          fontWeight: large ? 600 : 400,
          background: isDark ? T.dInput : T.lInput,
          border: `2px solid ${isDark ? T.dInputBorder : T.lInputBorder}`,
          color: isDark ? T.dText : T.lText,
          lineHeight: "1.5",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = T.green;
          e.target.style.boxShadow = `0 0 0 3px ${T.greenRing}`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = isDark ? T.dInputBorder : T.lInputBorder;
          e.target.style.boxShadow = "none";
        }}
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
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full rounded-2xl border outline-none transition-all duration-200 resize-none"
      style={{
        padding: "16px 20px",
        fontSize: 17,
        lineHeight: "1.6",
        background: isDark ? T.dInput : T.lInput,
        border: `2px solid ${isDark ? T.dInputBorder : T.lInputBorder}`,
        color: isDark ? T.dText : T.lText,
      }}
      onFocus={(e) => {
        e.target.style.borderColor = T.green;
        e.target.style.boxShadow = `0 0 0 3px ${T.greenRing}`;
      }}
      onBlur={(e) => {
        e.target.style.borderColor = isDark ? T.dInputBorder : T.lInputBorder;
        e.target.style.boxShadow = "none";
      }}
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
  onSelect: (mode: "quickstart" | "schedule" | "large_event") => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-y-auto"
      style={{
        background: isDark
          ? "oklch(0.14 0.04 145)"
          : "linear-gradient(145deg, #1A3A22 0%, #2A5535 60%, #3D6B47 100%)",
        animation: "wizardFadeIn 0.3s ease both",
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

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.70)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.18)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)"; }}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="relative w-full max-w-xl mx-auto px-6 py-8 sm:py-12 flex flex-col items-center gap-6 sm:gap-8 min-h-full justify-center">
        {/* Logo */}
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
          alt="OTB Chess"
          style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1) opacity(0.85)" }}
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

        {/* Mode cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Quickstart */}
          <button
            type="button"
            onClick={() => onSelect("quickstart")}
            className="group relative flex flex-col items-start gap-3 sm:gap-4 rounded-3xl border text-left transition-all duration-250 overflow-hidden"
            style={{
              padding: "16px 16px",
              background: "rgba(61,107,71,0.25)",
              border: "2px solid rgba(61,107,71,0.55)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(61,107,71,0.40)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#3D6B47";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(61,107,71,0.35)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(61,107,71,0.25)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(61,107,71,0.55)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Badge */}
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase"
              style={{ background: T.green, color: "#FFFFFF" }}
            >
              Recommended
            </span>

            {/* Icon */}
            <div
              className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <Bolt className="w-6 h-6 text-white" strokeWidth={1.8} />
            </div>

            <div>
              <h3
                className="text-xl font-bold text-white mb-1.5"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Quickstart
              </h3>
              <p className="text-white/55 text-sm leading-relaxed">
                Fill in just a name and location. We handle the rest — perfect for same-day tournaments.
              </p>
            </div>

            {/* Time estimate */}
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
              <Clock className="w-3.5 h-3.5" />
              Ready in under 30 seconds
            </div>

            {/* Arrow */}
            <ArrowRight
              className="absolute bottom-6 right-6 w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
              style={{ color: "rgba(255,255,255,0.35)" }}
            />
          </button>

          {/* Schedule Tournament */}
          <button
            type="button"
            onClick={() => onSelect("schedule")}
            className="group relative flex flex-col items-start gap-3 sm:gap-4 rounded-3xl border text-left transition-all duration-250 overflow-hidden"
            style={{
              padding: "16px 16px",
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.25)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Icon */}
            <div
              className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center mt-0 sm:mt-7"
              style={{ background: "rgba(255,255,255,0.10)" }}
            >
              <Calendar className="w-6 h-6 text-white" strokeWidth={1.8} />
            </div>

            <div>
              <h3
                className="text-xl font-bold text-white mb-1.5"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Schedule Tournament
              </h3>
              <p className="text-white/55 text-sm leading-relaxed">
                Full setup wizard — choose format, rounds, time control, and rating system.
              </p>
            </div>

            {/* Time estimate */}
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
              <Clock className="w-3.5 h-3.5" />
              ~2 minutes · 4 steps
            </div>

            {/* Arrow */}
            <ArrowRight
              className="absolute bottom-6 right-6 w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
              style={{ color: "rgba(255,255,255,0.25)" }}
            />
          </button>

          {/* Large Event */}
          <button
            type="button"
            onClick={() => onSelect("large_event")}
            className="group relative flex flex-col items-start gap-3 sm:gap-4 rounded-3xl border text-left transition-all duration-250 overflow-hidden"
            style={{
              padding: "16px 16px",
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.25)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {/* Badge */}
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.70)" }}
            >
              New
            </span>

            {/* Icon */}
            <div
              className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center"
              style={{ background: "rgba(255,255,255,0.10)" }}
            >
              <Crown className="w-6 h-6 text-white" strokeWidth={1.8} />
            </div>

            <div>
              <h3
                className="text-xl font-bold text-white mb-1.5"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Large Event
              </h3>
              <p className="text-white/55 text-sm leading-relaxed">
                Swiss rounds to seed players, then a single-elimination bracket. Built for 30+ player events.
              </p>
            </div>

            {/* Details */}
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
              <Users className="w-3.5 h-3.5" />
              Up to 100 players
            </div>

            {/* Arrow */}
            <ArrowRight
              className="absolute bottom-6 right-6 w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
              style={{ color: "rgba(255,255,255,0.25)" }}
            />
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
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
  /** Called when the user presses Enter in a text field and the form is valid. */
  onSubmit?: () => void;
}) {
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  // inline pickers inside the Smart Defaults card
  type InlinePicker = "rounds" | "cap" | "time" | "format" | null;
  const [inlinePicker, setInlinePicker] = useState<InlinePicker>(null);
  const toggleInline = (p: InlinePicker) =>
    setInlinePicker((prev) => (prev === p ? null : p));
  // rounds suggestion banner: shown after user picks a new cap that implies a different optimal rounds
  const [roundsSuggestion, setRoundsSuggestion] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const ratingOptions: { value: WizardData["ratingSystem"]; label: string; sub: string }[] = [
    { value: "chess.com", label: "chess.com", sub: "Rapid / Blitz ELO" },
    { value: "lichess",   label: "Lichess",   sub: "Lichess rating" },
    { value: "fide",      label: "FIDE",      sub: "Classical rating" },
    { value: "unrated",   label: "Unrated",   sub: "No ELO required" },
  ];

  const timeControlOptions: { preset: string; label: string; sub: string; base: number; inc: number }[] = [
    { preset: "1+0",  label: "Bullet",    sub: "1 min · no increment",  base: 1,  inc: 0  },
    { preset: "3+2",  label: "Blitz",     sub: "3 min + 2 sec",         base: 3,  inc: 2  },
    { preset: "10+5", label: "Rapid",     sub: "10 min + 5 sec",        base: 10, inc: 5  },
    { preset: "30+0", label: "Classical", sub: "30 min · no increment", base: 30, inc: 0  },
  ];

  const DEFAULT_TIME_PRESET = "10+5";
  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const DEFAULT_ROUNDS = 5;
  const capOptions = [8, 12, 16, 24, 32];
  const DEFAULT_CAP = 16;

  // Display label for the currently selected rating system
  const activeRating = ratingOptions.find((o) => o.value === data.ratingSystem);
  const activeTime = timeControlOptions.find((o) => o.preset === data.timePreset);
  const isNonDefaultRating = data.ratingSystem !== "chess.com";
  const isNonDefaultRounds = data.rounds !== DEFAULT_ROUNDS;
  const isNonDefaultTime = data.timePreset !== DEFAULT_TIME_PRESET;
  const isNonDefaultCap = data.maxPlayers !== DEFAULT_CAP;
  // keep old alias for existing JSX references
  const isNonDefault = isNonDefaultRating;

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
    <div className="space-y-7 lg:space-y-9">
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

      {/* Smart Defaults — interactive inline card */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: isDark ? "rgba(61,107,71,0.10)" : "#F0F5EE",
          border: `1.5px solid ${isDark ? "rgba(61,107,71,0.25)" : "rgba(61,107,71,0.18)"}`,
        }}
      >
        {/* Card header */}
        <div className="flex items-center gap-2 px-5 lg:px-6 pt-4 lg:pt-5 pb-3">
          <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: T.green }}>
            Smart Defaults Applied
          </span>
          <span className="ml-auto text-[10px] font-medium" style={{ color: isDark ? T.dMuted : T.lMuted }}>
            tap to edit
          </span>
        </div>

        {/* Format row — editable */}
        <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}>
          <button
            type="button"
            onClick={() => toggleInline("format")}
            className="w-full flex items-center justify-between px-5 lg:px-6 py-2.5 transition-colors"
            style={{
              background: inlinePicker === "format"
                ? isDark ? "rgba(61,107,71,0.18)" : "rgba(61,107,71,0.08)"
                : "transparent",
            }}
          >
            <span className="text-xs lg:text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>Format</span>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs lg:text-sm font-semibold"
                style={{ color: data.format !== "swiss" ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.format === "swiss" ? "Swiss" : data.format === "doubleswiss" ? "Double Swiss" : data.format === "roundrobin" ? "Round Robin" : data.format === "swiss_elim" ? "Swiss + Elimination" : "Elimination"}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "format" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "format" && (
            <div
              className="px-5 lg:px-6 pb-4 space-y-3"
              style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                {([
                  { value: "swiss",        label: "Swiss",       sub: "Optimal pairings" },
                  { value: "doubleswiss",  label: "Double Swiss", sub: "Play both colors" },
                  { value: "roundrobin",   label: "Round Robin",  sub: "Everyone plays all" },
                  { value: "elimination",  label: "Elimination",  sub: "Single knockout" },
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
              background: isDark ? "rgba(61,107,71,0.22)" : "rgba(61,107,71,0.10)",
              border: `1px solid ${isDark ? "rgba(61,107,71,0.40)" : "rgba(61,107,71,0.25)"}`,
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

        {/* Rounds row — editable */}
        <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}>
          <button
            type="button"
            onClick={() => toggleInline("rounds")}
            className="w-full flex items-center justify-between px-5 lg:px-6 py-2.5 transition-colors"
            style={{
              background: inlinePicker === "rounds"
                ? isDark ? "rgba(61,107,71,0.18)" : "rgba(61,107,71,0.08)"
                : "transparent",
            }}
          >
            <span className="text-xs lg:text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>Rounds</span>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs lg:text-sm font-semibold"
                style={{ color: isNonDefaultRounds ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.rounds}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "rounds" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "rounds" && (
            <div
              className="px-5 lg:px-6 pb-4 space-y-3"
              style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}
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
                            background: active ? T.green : isDark ? "rgba(61,107,71,0.35)" : "#D1FAE5",
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

        {/* Max Players row — editable */}
        <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}>
          <button
            type="button"
            onClick={() => toggleInline("cap")}
            className="w-full flex items-center justify-between px-5 lg:px-6 py-2.5 transition-colors"
            style={{
              background: inlinePicker === "cap"
                ? isDark ? "rgba(61,107,71,0.18)" : "rgba(61,107,71,0.08)"
                : "transparent",
            }}
          >
            <span className="text-xs lg:text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>Max Players</span>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs lg:text-sm font-semibold"
                style={{ color: isNonDefaultCap ? T.green : isDark ? T.dText : T.lText }}
              >
                {data.maxPlayers}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "cap" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "cap" && (
            <div
              className="px-5 lg:px-6 pb-4 space-y-3"
              style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}
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

        {/* Time Control row — editable */}
        <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}>
          <button
            type="button"
            onClick={() => toggleInline("time")}
            className="w-full flex items-center justify-between px-5 lg:px-6 py-2.5 transition-colors"
            style={{
              background: inlinePicker === "time"
                ? isDark ? "rgba(61,107,71,0.18)" : "rgba(61,107,71,0.08)"
                : "transparent",
            }}
          >
            <span className="text-xs lg:text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>Time Control</span>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs lg:text-sm font-semibold"
                style={{ color: isNonDefaultTime ? T.green : isDark ? T.dText : T.lText }}
              >
                {activeTime ? `${activeTime.preset} ${activeTime.label}` : `${data.timePreset} Rapid`}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: isDark ? T.dMuted : T.lMuted,
                  transform: inlinePicker === "time" ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </div>
          </button>
          {inlinePicker === "time" && (
            <div
              className="px-5 lg:px-6 pb-4"
              style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}
            >
              <div className="grid grid-cols-2 gap-2 pt-3">
                {timeControlOptions.map((opt) => {
                  const active = data.timePreset === opt.preset;
                  return (
                    <button
                      key={opt.preset}
                      type="button"
                      onClick={() => {
                        // Auto-suggest rating type based on time control category
                        const isBlitzTime = opt.label === "Bullet" || opt.label === "Blitz";
                        onChange({
                          timePreset: opt.preset,
                          timeBase: opt.base,
                          timeIncrement: opt.inc,
                          ratingType: isBlitzTime ? "blitz" : "rapid",
                        });
                        setInlinePicker(null);
                      }}
                      className="flex flex-col items-start rounded-xl border text-left transition-all duration-150"
                      style={{
                        padding: "8px 12px",
                        background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                        border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                        boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                      }}
                    >
                      <span className="text-sm font-semibold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                        {opt.label}
                      </span>
                      <span className="text-xs mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rating Type row — Rapid vs Blitz toggle */}
        <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}>
          <div className="flex items-center justify-between px-5 lg:px-6 py-2.5">
            <span className="text-xs lg:text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>ELO Rating</span>
            <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}` }}>
              {(["rapid", "blitz"] as const).map((rt) => {
                const active = data.ratingType === rt;
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => onChange({ ratingType: rt })}
                    className="px-3 py-1 text-xs font-semibold transition-all duration-150"
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
          <p className="px-5 lg:px-6 pb-2 text-[10px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "#9CA3AF" }}>
            Both Rapid &amp; Blitz are fetched automatically. This sets which one is used for pairings. Auto-set by time control — changeable later in Settings.
          </p>
        </div>

        {/* Rating System row — static display (editable via separate toggle below) */}
        <div
          className="flex items-center justify-between px-5 lg:px-6 py-2.5"
          style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(61,107,71,0.10)"}` }}
        >
          <span className="text-xs lg:text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>Platform</span>
          <span
            className="text-xs lg:text-sm font-semibold"
            style={{ color: isNonDefaultRating ? T.green : isDark ? T.dText : T.lText }}
          >
            {activeRating?.label ?? "chess.com"}
          </span>
        </div>
      </div>

      {/* Structure Preview — collapsible panel */}
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
              background: isDark ? "rgba(61,107,71,0.06)" : "#F4F8F3",
              border: `1.5px solid ${isDark ? "rgba(61,107,71,0.20)" : "rgba(61,107,71,0.14)"}`,
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

      {/* Optional rating system toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowRatingPicker((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: isNonDefault ? T.green : isDark ? T.dMuted : T.lMuted }}
        >
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: showRatingPicker ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          {isNonDefault
            ? `Rating: ${activeRating?.label} · Change`
            : "Not using chess.com? Change rating system"}
        </button>

        {showRatingPicker && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ratingOptions.map((opt) => {
              const active = data.ratingSystem === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange({ ratingSystem: opt.value });
                    // Collapse picker after selection (unless already collapsed)
                    if (active) setShowRatingPicker(false);
                  }}
                  className="flex flex-col items-start rounded-xl border text-left transition-all duration-150"
                  style={{
                    padding: "10px 14px",
                    background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                    border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                    boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                    {opt.label}
                  </span>
                  <span className="text-xs mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Details (Schedule path) ─────────────────────────────────────────

function StepDetails({
  data,
  onChange,
  isDark,
}: {
  data: WizardData;
  onChange: (p: Partial<WizardData>) => void;
  isDark: boolean;
}) {
  const ratingOptions: { value: WizardData["ratingSystem"]; label: string; sub: string }[] = [
    { value: "chess.com", label: "chess.com", sub: "Rapid / Blitz ELO" },
    { value: "lichess", label: "Lichess", sub: "Lichess rating" },
    { value: "fide", label: "FIDE", sub: "Classical rating" },
    { value: "unrated", label: "Unrated", sub: "No ELO required" },
  ];

  return (
    <div className="space-y-8">
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
  ];

  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const playerOptions = [8, 12, 16, 20, 24, 32, 64];

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
                    background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                    color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.50)" : "#6B7280",
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
                    background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                    color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.60)" : "#4B5563",
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
                    background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                    color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.60)" : "#4B5563",
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
        style={{ background: isDark ? "rgba(61,107,71,0.12)" : "#F0F5EE", color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280" }}
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
                      background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                      color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.45)" : "#6B7280",
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
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE", color: isDark ? T.dText : T.lText }}
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
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE", color: isDark ? T.dText : T.lText }}
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
        style={{ background: isDark ? "rgba(61,107,71,0.12)" : "#F0F5EE", color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280" }}
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
          boxShadow: phase === "done" ? `0 0 0 3px ${T.green}, 0 8px 24px rgba(61,107,71,0.25)` : `0 4px 16px rgba(0,0,0,0.12)`,
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
            style={{ borderColor: phase === "done" ? T.green : "rgba(61,107,71,0.4)", opacity: phase === "done" ? 1 : 0.6, [vPos]: 4, [hPos]: 4 }}
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
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: T.green, boxShadow: "0 4px 16px rgba(61,107,71,0.45)" }}>
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
          <p className="text-xs mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#6B7280" }}>
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
  // Use encodeURIComponent to make the base64 URL-safe.
  // btoa can produce +, /, = which URLSearchParams decodes incorrectly on Android
  // (+ is treated as a space, corrupting the JSON and breaking the join flow).
  const tParam = encodeURIComponent(btoa(JSON.stringify(embeddedMeta)));
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
    fetch(`/api/auth/join/check-slug/${encodeURIComponent(slug)}${excludeParam}`)
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
        await fetch(`/api/user/tournaments/${encodeURIComponent(tournamentId)}/custom-slug`, {
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

  const formatLabel = data.format === "swiss" ? "Swiss" : data.format === "doubleswiss" ? "Double Swiss" : data.format === "roundrobin" ? "Round Robin" : data.format === "swiss_elim" ? "Swiss + Elimination" : "Elimination";
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
                background: isDark ? "rgba(61,107,71,0.08)" : "#F0F5EE",
                border: `1.5px solid ${isDark ? "rgba(61,107,71,0.18)" : "#D4E6D8"}`,
              }}
            >
              {/* Step number + icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isDark ? "rgba(61,107,71,0.20)" : "#FFFFFF", color: T.green }}
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
          background: isDark ? "rgba(61,107,71,0.10)" : "#F0F5EE",
          border: `1.5px solid ${isDark ? "rgba(61,107,71,0.22)" : "#D4E6D8"}`,
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: isDark ? "rgba(61,107,71,0.25)" : "#FFFFFF", color: T.green }}
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

      {/* ── Player Invite Link ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <p
          className="text-[11px] font-bold tracking-[0.14em] uppercase"
          style={{ color: isDark ? T.dMuted : T.lMuted }}
        >
          Player Invite Link
        </p>
        <div className="flex gap-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-2xl border text-sm font-mono truncate"
            style={{
              padding: "13px 16px",
              background: isDark ? T.dCard : "#FAFAFA",
              border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
              color: isDark ? T.dSub : T.lSub,
            }}
          >
            <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
            <span className="truncate">{inviteUrl}</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-2xl text-sm font-semibold transition-all duration-200 flex-shrink-0"
            style={{
              padding: "13px 18px",
              background: copied ? T.green : isDark ? "rgba(255,255,255,0.10)" : "#F0F5EE",
              color: copied ? "#FFFFFF" : isDark ? T.dText : "#374151",
            }}
          >
            {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* ── Custom short URL ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p
          className="text-[11px] font-bold tracking-[0.14em] uppercase"
          style={{ color: isDark ? T.dMuted : T.lMuted }}
        >
          Custom URL  <span className="font-normal normal-case tracking-normal" style={{ color: isDark ? T.dMuted : T.lMuted }}>— optional</span>
        </p>
        <p className="text-xs" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          Create a memorable link for your event, e.g.{" "}
          <span style={{ color: T.green, fontWeight: 600 }}>chessotb.club/join/ThursdayOTBNight</span>
        </p>
        <div className="flex gap-2 items-center">
          <div
            className="flex-1 flex items-center gap-0 rounded-2xl border overflow-hidden transition-all duration-200"
            style={{
              background: isDark ? T.dCard : "#FAFAFA",
              border: `1.5px solid ${
                slugStatus === "available" ? T.green
                : slugStatus === "taken" || slugStatus === "invalid" ? "#ef4444"
                : isDark ? T.dBorder : T.lBorder
              }`,
            }}
          >
            <span
              className="text-xs font-mono flex-shrink-0 pl-4 pr-1 select-none"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
            >
              /join/
            </span>
            <input
              type="text"
              value={customSlugInput}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="thursday-otb-night"
              className="flex-1 bg-transparent outline-none text-sm font-mono py-3 pr-1"
              style={{ color: isDark ? T.dText : T.lText }}
              maxLength={60}
            />
            {/* Inline status icon */}
            <span className="pr-3 flex-shrink-0">
              {slugStatus === "checking" && (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: isDark ? T.dMuted : T.lMuted }} />
              )}
              {slugStatus === "available" && (
                <CheckCircle2 className="w-4 h-4" style={{ color: T.green }} />
              )}
              {(slugStatus === "taken" || slugStatus === "invalid") && (
                <XCircle className="w-4 h-4" style={{ color: "#ef4444" }} />
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={saveSlug}
            disabled={!customSlugInput.trim() || slugSaving || slugStatus === "taken" || slugStatus === "checking" || slugStatus === "invalid"}
            className="flex items-center gap-1.5 rounded-2xl text-sm font-semibold transition-all duration-200 flex-shrink-0 disabled:opacity-40"
            style={{
              padding: "13px 18px",
              background: slugSaved ? T.green : isDark ? "rgba(255,255,255,0.10)" : "#F0F5EE",
              color: slugSaved ? "#FFFFFF" : isDark ? T.dText : "#374151",
            }}
          >
            {slugSaved ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <ArrowRight className="w-4 h-4" />}
            {slugSaving ? "Saving..." : slugSaved ? "Saved!" : "Set"}
          </button>
        </div>
        {/* Availability status message */}
        {customSlugInput.trim() && slugStatus !== "idle" && (
          <p
            className="text-[11px] flex items-center gap-1"
            style={{
              color: slugStatus === "available" ? T.green
                : slugStatus === "taken" || slugStatus === "invalid" ? "#ef4444"
                : isDark ? T.dMuted : T.lMuted,
            }}
          >
            {slugStatus === "checking" && <><Loader2 className="w-3 h-3 animate-spin" /> Checking availability…</>}
            {slugStatus === "available" && <><CheckCircle2 className="w-3 h-3" /> Available — your link: {window.location.origin}/join/{customSlugInput.trim()}</>}
            {(slugStatus === "taken" || slugStatus === "invalid") && <><AlertCircle className="w-3 h-3" /> {slugConflict ?? "This URL is not available"}</>}
          </p>
        )}
        {customSlugInput.trim() && slugStatus === "idle" && (
          <p className="text-[11px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>
            {window.location.origin}/join/{customSlugInput.trim()}
          </p>
        )}
      </div>

      {/* ── Club badge ──────────────────────────────────────────────────── */}
      {data.clubId && data.clubName && (
        <div
          className="flex items-center gap-2.5 rounded-2xl border px-4 py-3"
          style={{
            background: isDark ? "rgba(61,107,71,0.10)" : "#F0F5EE",
            border: `1.5px solid ${isDark ? "rgba(61,107,71,0.30)" : "#C6D9C9"}`,
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
      // Prevent background scroll on iOS/Android while wizard is open
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // When entering quickstart mode, auto-fill today's date
  const handleSelectMode = (m: "quickstart" | "schedule" | "large_event") => {
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
    setMode(m);
    setStep(0);
    setDirection(1);
  };

  // ── Schedule path: 4 steps (0..3) ──────────────────────────────────────────
  // ── Quickstart path: 1 step (0 = form) then directly to share (step 1) ───

  const scheduleStepCount = SCHEDULE_STEPS.length; // 4
  const quickstartStepCount = 2; // form + share

  const totalSteps = mode === "quickstart" ? quickstartStepCount : scheduleStepCount;

  const canAdvance =
    mode === "select"
      ? false
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
    });
    grantDirectorSession(slug);
    // If signed in, persist to server so My Tournaments history is cross-device
    if (user?.id) {
      fetch(`/api/user/tournaments`, {
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
  }, [data]);

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
        (mode === "schedule" && next === SCHEDULE_STEPS.length - 1);
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
    (mode === "schedule" && step === SCHEDULE_STEPS.length - 1);

  const heroStep = mode === "schedule" ? step : 0;

  const stepLabel =
    mode === "quickstart"
      ? step === 0
        ? "Quickstart"
        : "Share"
      : SCHEDULE_STEPS[step].label;

  const stepEyebrow =
    mode === "quickstart"
      ? step === 0
        ? "Quickstart"
        : "Almost there!"
      : SCHEDULE_STEPS[step].hero.eyebrow;

  const stepTitle =
    mode === "quickstart"
      ? step === 0
        ? "Start in\nseconds"
        : "You're\nready!"
      : SCHEDULE_STEPS[step].hero.title.replace("\n", " ");

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex"
      style={{ background: isDark ? T.dBg : T.lBg, animation: "wizardFadeIn 0.3s ease both" }}
    >
      {/* ── Left hero panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[32%] xl:w-[34%] flex-shrink-0">
        <HeroPanel step={heroStep} isDark={isDark} mode={mode} onClose={() => onClose()} />
      </div>

      {/* ── Right input panel ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden" style={{ background: isDark ? T.dPanel : "#FFFFFF" }}>
        {/* Progress bar */}
        <ProgressBar step={step} total={totalSteps} isDark={isDark} />

        {/* ── Mobile top bar ── */}
        <div
          className="lg:hidden flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0 border-b"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "#F0F0F0" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.green }}>
              <Crown className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                Step {step + 1} of {totalSteps}
              </span>
              <span className="text-sm font-bold" style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? T.dText : T.lText }}>
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
                  width: i === step ? 18 : 5,
                  height: 5,
                  background: i === step ? T.green : i < step ? "rgba(61,107,71,0.5)" : isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB",
                }}
              />
            ))}
          </div>
          <button
            onClick={() => setMode("select")}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", color: isDark ? T.dSub : T.lSub }}
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
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div
            className="w-full px-5 sm:px-12 lg:px-16 xl:px-20 py-8 sm:py-10 pb-6"
            key={`${mode}-${step}`}
            style={{ animation: `stepSlideIn${direction > 0 ? "Right" : "Left"} 0.30s cubic-bezier(0.22,1,0.36,1) both` }}
          >
            {/* Mobile step eyebrow */}
            <p className="lg:hidden text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: isDark ? T.dMuted : T.lMuted }}>
              {stepEyebrow}
            </p>
            {/* Mobile step title */}
            <h2
              className="lg:hidden text-2xl font-bold mb-6"
              style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? T.dText : T.lText }}
            >
              {stepTitle}
            </h2>

            {/* Quickstart path */}
            {mode === "quickstart" && step === 0 && <QuickstartForm data={data} onChange={patch} isDark={isDark} onSubmit={canAdvance ? handleNext : undefined} />}
            {mode === "quickstart" && step === 1 && <StepShare data={data} isDark={isDark} tournamentId={makeSlug(data.name, data.date)} />}

            {/* Schedule path */}
            {mode === "schedule" && step === 0 && <StepDetails data={data} onChange={patch} isDark={isDark} />}
            {mode === "schedule" && step === 1 && <StepFormat data={data} onChange={patch} isDark={isDark} />}
            {mode === "schedule" && step === 2 && <StepTime data={data} onChange={patch} isDark={isDark} />}
            {mode === "schedule" && step === 3 && <StepShare data={data} isDark={isDark} tournamentId={makeSlug(data.name, data.date)} />}
          </div>
        </div>

        {/* ── Mobile bottom nav ── */}
        <div
          className="lg:hidden flex-shrink-0 flex flex-col gap-2 px-5 border-t"
          style={{ paddingTop: '1rem', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0", background: isDark ? T.dPanel : "#FFFFFF" }}
        >
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance}
            className="w-full flex items-center justify-center gap-2 text-base font-semibold rounded-2xl transition-all duration-200"
            style={{
              padding: "14px 24px",
              background: canAdvance ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
              color: canAdvance ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : T.lMuted,
              cursor: canAdvance ? "pointer" : "not-allowed",
              boxShadow: canAdvance ? `0 4px 18px rgba(61,107,71,0.35)` : "none",
            }}
          >
            {isShareStep ? (
              <><ArrowRight className="w-5 h-5" /> Go to Tournament</>
            ) : (
              <>Continue <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="w-full flex items-center justify-center gap-1 text-sm font-medium rounded-xl transition-all duration-200 py-2"
            style={{ color: isDark ? T.dSub : T.lSub }}
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
                  background: i === step ? T.green : i < step ? "rgba(61,107,71,0.45)" : isDark ? "rgba(255,255,255,0.15)" : "#D1D5DB",
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
              background: canAdvance ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
              color: canAdvance ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : T.lMuted,
              cursor: canAdvance ? "pointer" : "not-allowed",
              boxShadow: canAdvance ? `0 4px 14px rgba(61,107,71,0.30)` : "none",
            }}
            onMouseEnter={(e) => { if (!canAdvance) return; (e.currentTarget as HTMLButtonElement).style.background = T.greenDark; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(61,107,71,0.40)"; }}
            onMouseLeave={(e) => { if (!canAdvance) return; (e.currentTarget as HTMLButtonElement).style.background = T.green; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(61,107,71,0.30)"; }}
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
