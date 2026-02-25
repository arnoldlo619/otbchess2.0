/*
 * OTB Chess — Tournament Creation Wizard (Full-Screen Redesign)
 *
 * Design philosophy:
 *   - Full viewport canvas — no modal chrome, no scroll
 *   - Two-column layout on desktop: left = contextual hero, right = focused inputs
 *   - One primary action per step — no cognitive overload
 *   - Thin top progress bar + minimal step labels
 *   - Smooth horizontal slide transitions between steps
 *   - Consistent with platform design system (green/white, Clash Display, OKLCH)
 *
 * Steps:
 *   1. Details      — name, venue, date, description, rating system
 *   2. Format       — Swiss / Round Robin / Elimination, rounds, player cap
 *   3. Time Control — preset tiles or custom stepper
 *   4. Share        — invite link, QR code, confetti
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { useConfetti } from "@/hooks/useConfetti";
import { useKeyboardScroll } from "@/hooks/useKeyboardScroll";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { useLocation } from "wouter";
import { registerTournament, makeSlug } from "@/lib/tournamentRegistry";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  name: string;
  venue: string;
  date: string;
  description: string;
  format: "swiss" | "roundrobin" | "elimination";
  rounds: number;
  maxPlayers: number;
  timeBase: number;
  timeIncrement: number;
  timePreset: string;
  ratingSystem: "chess.com" | "lichess" | "fide" | "unrated";
  inviteCode: string;
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
  inviteCode: "",
};

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
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
    <div
      className="absolute top-0 left-0 right-0 h-[3px] flex gap-[2px]"
      style={{ zIndex: 10 }}
    >
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
  direction,
}: {
  step: number;
  isDark: boolean;
  direction: 1 | -1;
}) {
  const s = STEPS[step];
  const Icon = s.icon;

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
          backgroundImage: `
            repeating-conic-gradient(
              rgba(255,255,255,0.025) 0% 25%,
              transparent 0% 50%
            )`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Logo mark */}
      <div className="relative flex items-center">
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
          alt="OTB Chess"
          style={{ height: 36, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1) opacity(0.85)" }}
        />
      </div>

      {/* Step content */}
      <div
        className="relative"
        key={step}
        style={{ animation: `heroIn 0.45s cubic-bezier(0.22,1,0.36,1) both` }}
      >
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
        <p className="text-white/55 text-sm leading-relaxed max-w-xs">
          {s.hero.body}
        </p>
      </div>

      {/* Step dots */}
      <div className="relative flex items-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-400"
            style={{
              width: i === step ? 20 : 6,
              height: 6,
              background: i === step ? "#FFFFFF" : "rgba(255,255,255,0.25)",
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
    <div className="flex items-baseline gap-2 mb-3">
      <label
        className="text-base font-semibold"
        style={{ color: isDark ? "rgba(255,255,255,0.90)" : "#1F2937" }}
      >
        {children}
      </label>
      {hint && (
        <span className="text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
  autoFocus?: boolean;
  isDark: boolean;
  large?: boolean;
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: isDark ? T.dMuted : T.lMuted }}
        />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-2xl border outline-none transition-all duration-200"
        style={{
          padding: large ? "16px 18px 16px 52px" : Icon ? "14px 16px 14px 50px" : "14px 18px",
          fontSize: large ? 20 : 16,
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
        padding: "14px 18px",
        fontSize: 16,
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

// ─── Step 1: Details ──────────────────────────────────────────────────────────

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
                  background: active
                    ? T.greenBg
                    : isDark ? T.dCard : "#FAFAFA",
                  border: `2px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                  boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                }}
              >
                <span
                  className="text-base font-semibold"
                  style={{ color: active ? T.green : isDark ? T.dText : T.lText }}
                >
                  {opt.label}
                </span>
                <span
                  className="text-sm mt-1"
                  style={{ color: isDark ? T.dMuted : T.lMuted }}
                >
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
    {
      value: "swiss" as const,
      label: "Swiss System",
      desc: "Paired by score — best for large groups.",
      icon: Shuffle,
    },
    {
      value: "roundrobin" as const,
      label: "Round Robin",
      desc: "Everyone plays everyone — best for small groups.",
      icon: Users,
    },
    {
      value: "elimination" as const,
      label: "Elimination",
      desc: "Single knockout bracket — fast and exciting.",
      icon: Trophy,
    },
  ];

  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const playerOptions = [8, 12, 16, 20, 24, 32, 64];

  return (
    <div className="space-y-8">
      {/* Format selector */}
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
                  <p
                    className="text-base font-semibold"
                    style={{ color: active ? T.green : isDark ? T.dText : T.lText }}
                  >
                    {f.label}
                  </p>
                  <p className="text-sm mt-1" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    {f.desc}
                  </p>
                </div>
                {active && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: T.green }}
                  >
                    <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Rounds */}
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

        {/* Max players */}
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

      {/* Hint */}
      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 text-sm"
        style={{
          background: isDark ? "rgba(61,107,71,0.12)" : "#F0F5EE",
          color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280",
        }}
      >
        <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: T.green }} />
        <span>
          {data.format === "swiss"
            ? `Swiss · ${data.rounds} rounds · up to ${data.maxPlayers} players. Optimal for ${Math.pow(2, data.rounds - 1)} players.`
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

  const selectPreset = (p: typeof TIME_PRESETS[0]) => {
    if (p.base === -1) {
      onChange({ timePreset: "custom" });
    } else {
      onChange({ timePreset: p.sub, timeBase: p.base, timeIncrement: p.inc });
    }
  };

  const estimatedDuration = () => {
    const perGame = data.timeBase * 2 + (data.timeIncrement * 40) / 60;
    const totalMins = perGame * data.rounds * 0.6;
    if (totalMins < 60) return `~${Math.round(totalMins)} min`;
    return `~${(totalMins / 60).toFixed(1)} hrs`;
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
                <span
                  className="text-base font-bold"
                  style={{ color: active ? T.green : isDark ? T.dText : T.lText }}
                >
                  {p.sub === "custom" ? "Custom" : p.sub}
                </span>
                <span
                  className="text-xs mt-1 font-medium"
                  style={{ color: isDark ? T.dMuted : T.lMuted }}
                >
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

      {/* Custom stepper */}
      {isCustom && (
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: "Base time",
              unit: "min",
              value: data.timeBase,
              min: 1,
              max: 180,
              key: "timeBase" as const,
            },
            {
              label: "Increment",
              unit: "sec",
              value: data.timeIncrement,
              min: 0,
              max: 60,
              key: "timeIncrement" as const,
            },
          ].map((field) => (
            <div key={field.key}>
              <Label isDark={isDark}>
                {field.label}{" "}
                <span style={{ color: isDark ? T.dMuted : T.lMuted, fontWeight: 400 }}>
                  ({field.unit})
                </span>
              </Label>
              <div
                className="flex items-center gap-3 rounded-2xl border"
                style={{
                  padding: "14px 18px",
                  background: isDark ? T.dCard : "#FAFAFA",
                  border: `2px solid ${isDark ? T.dBorder : T.lBorder}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => onChange({ [field.key]: Math.max(field.min, field.value - 1) })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                    color: isDark ? T.dText : T.lText,
                  }}
                >
                  −
                </button>
                <span
                  className="flex-1 text-center text-xl font-bold font-mono"
                  style={{ color: isDark ? T.dText : T.lText }}
                >
                  {field.value}
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ [field.key]: Math.min(field.max, field.value + 1) })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                    color: isDark ? T.dText : T.lText,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duration estimate */}
      <div
        className="flex items-center justify-between rounded-xl border px-4 py-3"
        style={{
          background: isDark ? T.dCard : "#F9FAF8",
          border: `1.5px solid ${isDark ? T.dBorder : "#EEEED2"}`,
        }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? T.dSub : T.lSub }}>
          <Clock className="w-4 h-4" />
          <span>Estimated tournament duration</span>
        </div>
        <span
          className="text-sm font-bold"
          style={{ color: isDark ? T.dText : T.lText }}
        >
          {estimatedDuration()}
        </span>
      </div>
    </div>
  );
}

// ─── Animated QR ──────────────────────────────────────────────────────────────

function AnimatedQR({ inviteUrl, isDark }: { inviteUrl: string; isDark: boolean }) {
  const [phase, setPhase] = useState<"hidden" | "appear" | "scan" | "done">("hidden");
  const [scanY, setScanY] = useState(0);
  const scanRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const SCAN_DURATION = 1200;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("appear"), 120);
    const t2 = setTimeout(() => {
      setPhase("scan");
      startTimeRef.current = performance.now();
      const animate = (now: number) => {
        const elapsed = now - (startTimeRef.current ?? now);
        const progress = Math.min(elapsed / SCAN_DURATION, 1);
        setScanY(progress * 100);
        if (progress < 1) {
          scanRef.current = requestAnimationFrame(animate);
        } else {
          setPhase("done");
        }
      };
      scanRef.current = requestAnimationFrame(animate);
    }, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (scanRef.current) cancelAnimationFrame(scanRef.current);
    };
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-3 py-6 rounded-2xl border transition-all duration-500"
      style={{
        opacity: phase === "hidden" ? 0 : 1,
        transform: phase === "hidden" ? "translateY(8px)" : "translateY(0)",
        background: isDark ? "rgba(255,255,255,0.03)" : "#F0FDF4",
        border: `1.5px solid ${isDark ? "rgba(255,255,255,0.10)" : "#D1FAE5"}`,
      }}
    >
      <div className="relative" style={{ width: 180, height: 180 }}>
        <div
          className="absolute inset-0 rounded-xl bg-white"
          style={{
            boxShadow:
              phase === "done"
                ? `0 0 0 3px ${T.green}, 0 8px 24px rgba(61,107,71,0.25)`
                : "0 0 0 2px rgba(61,107,71,0.15), 0 4px 12px rgba(0,0,0,0.08)",
            transition: "box-shadow 0.4s ease",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <QRCodeSVG
            value={inviteUrl}
            size={154}
            level="H"
            includeMargin={false}
            fgColor="#1a1a1a"
            bgColor="#ffffff"
          />
        </div>
        {/* Corner brackets */}
        {([
          { vPos: "top", hPos: "left",  cls: "border-t-2 border-l-2 rounded-tl-lg" },
          { vPos: "top", hPos: "right", cls: "border-t-2 border-r-2 rounded-tr-lg" },
          { vPos: "bottom", hPos: "left",  cls: "border-b-2 border-l-2 rounded-bl-lg" },
          { vPos: "bottom", hPos: "right", cls: "border-b-2 border-r-2 rounded-br-lg" },
        ] as const).map(({ vPos, hPos, cls }) => (
          <div
            key={`${vPos}-${hPos}`}
            className={`absolute w-5 h-5 transition-all duration-700 ${cls}`}
            style={{
              borderColor: phase === "done" ? T.green : "rgba(61,107,71,0.4)",
              opacity: phase === "done" ? 1 : 0.6,
              [vPos]: 4,
              [hPos]: 4,
            }}
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
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ animation: "fadeInScale 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: T.green, boxShadow: "0 4px 16px rgba(61,107,71,0.45)" }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <p
        className="text-xs font-semibold transition-colors duration-500"
        style={{ color: phase === "done" ? T.green : isDark ? T.dMuted : T.lMuted }}
      >
        {phase === "done" ? "Ready to scan!" : phase === "scan" ? "Generating QR…" : "Players scan to join"}
      </p>
    </div>
  );
}

// ─── Step 4: Share ────────────────────────────────────────────────────────────

function StepShare({ data, isDark }: { data: WizardData; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `https://otbchess.app/join/${data.inviteCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLabel =
    data.format === "swiss" ? "Swiss" : data.format === "roundrobin" ? "Round Robin" : "Elimination";
  const timeLabel =
    data.timePreset === "custom" ? `${data.timeBase}+${data.timeIncrement}` : data.timePreset;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div
        className="grid grid-cols-3 gap-4 rounded-2xl border p-5"
        style={{
          background: isDark ? T.dCard : "#F9FAF8",
          border: `2px solid ${isDark ? T.dBorder : "#EEEED2"}`,
        }}
      >
        {[
          { icon: Shuffle, label: formatLabel, sub: `${data.rounds} rounds` },
          { icon: Clock, label: timeLabel, sub: "time control" },
          { icon: Users, label: `${data.maxPlayers}`, sub: "max players" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-1.5 text-center">
            <Icon className="w-5 h-5" style={{ color: T.green }} strokeWidth={1.8} />
            <span className="text-base font-bold" style={{ color: isDark ? T.dText : T.lText }}>
              {label}
            </span>
            <span className="text-xs" style={{ color: isDark ? T.dMuted : T.lMuted }}>
              {sub}
            </span>
          </div>
        ))}
      </div>

      {/* Invite link */}
      <div>
        <Label isDark={isDark}>Player Invite Link</Label>
        <div className="flex gap-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-2xl border text-sm font-mono truncate"
            style={{
              padding: "14px 18px",
              background: isDark ? T.dCard : "#FAFAFA",
              border: `2px solid ${isDark ? T.dBorder : T.lBorder}`,
              color: isDark ? T.dSub : T.lSub,
            }}
          >
            <Link2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
            <span className="truncate">{inviteUrl}</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-2xl text-base font-semibold transition-all duration-200 flex-shrink-0"
            style={{
              padding: "14px 20px",
              background: copied ? T.green : isDark ? "rgba(255,255,255,0.10)" : "#F0F5EE",
              color: copied ? "#FFFFFF" : isDark ? T.dText : "#374151",
            }}
          >
            {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* QR */}
      <AnimatedQR inviteUrl={inviteUrl} isDark={isDark} />

      {/* Hint */}
      <div
        className="flex items-start gap-3 rounded-2xl px-5 py-4 text-sm"
        style={{
          background: isDark ? "rgba(61,107,71,0.12)" : "#F0F5EE",
          color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280",
        }}
      >
        <BarChart3 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: T.green }} />
        <span>
          Players join with their{" "}
          <strong style={{ color: isDark ? "rgba(255,255,255,0.80)" : "#374151" }}>
            {data.ratingSystem}
          </strong>{" "}
          username. ELO is fetched automatically and pairings are generated when you start Round 1.
        </span>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface TournamentWizardProps {
  open: boolean;
  onClose: () => void;
}

export function TournamentWizard({ open, onClose }: TournamentWizardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [data, setData] = useState<WizardData>({
    ...DEFAULT_DATA,
    inviteCode: nanoid(8).toUpperCase(),
  });
  const { fireConfetti } = useConfetti();
  const [, navigate] = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardScroll(scrollContainerRef, 24);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setDirection(1);
      setData({ ...DEFAULT_DATA, inviteCode: nanoid(8).toUpperCase() });
    }
  }, [open]);

  // Keyboard: Escape to close, Enter to advance
  const canAdvance = step === 0 ? data.name.trim().length > 0 : true;

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      const next = step + 1;
      setStep(next);
      if (next === STEPS.length - 1) {
        setTimeout(() => fireConfetti(130), 300);
      }
    } else {
      const slug = makeSlug(data.name, data.date);
      registerTournament({
        id: slug,
        inviteCode: data.inviteCode,
        name: data.name,
        venue: data.venue,
        date: data.date,
        description: data.description,
        format: data.format,
        rounds: data.rounds,
        maxPlayers: data.maxPlayers,
        timeBase: data.timeBase,
        timeIncrement: data.timeIncrement,
        timePreset: data.timePreset,
        ratingSystem: data.ratingSystem,
        createdAt: new Date().toISOString(),
      });
      onClose();
      navigate(`/tournament/${slug}/manage`);
    }
  }, [step, data, fireConfetti, onClose, navigate]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    } else {
      onClose();
    }
  }, [step, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && canAdvance && !(e.target instanceof HTMLTextAreaElement)) {
        handleNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, canAdvance, handleNext, onClose]);

  const patch = (p: Partial<WizardData>) => setData((d) => ({ ...d, ...p }));

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex"
      style={{
        background: isDark ? T.dBg : T.lBg,
        animation: "wizardFadeIn 0.3s ease both",
      }}
    >
      {/* ── Left hero panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[32%] xl:w-[34%] flex-shrink-0">
        <HeroPanel step={step} isDark={isDark} direction={direction} />
      </div>

      {/* ── Right input panel ── */}
      <div
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{ background: isDark ? T.dPanel : "#FFFFFF" }}
      >
        {/* Progress bar */}
        <ProgressBar step={step} total={STEPS.length} isDark={isDark} />

        {/* ── Mobile top bar (full-screen, compact, branded) ── */}
        <div
          className="lg:hidden flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0 border-b"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "#F0F0F0" }}
        >
          {/* Brand mark + step label */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: T.green }}
            >
              <Crown className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="text-[9px] font-semibold tracking-widest uppercase"
                style={{ color: isDark ? T.dMuted : T.lMuted }}
              >
                Step {step + 1} of {STEPS.length}
              </span>
              <span
                className="text-sm font-bold"
                style={{ fontFamily: "'Clash Display', sans-serif", color: isDark ? T.dText : T.lText }}
              >
                {STEPS[step].label}
              </span>
            </div>
          </div>
          {/* Mobile step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 18 : 5,
                  height: 5,
                  background:
                    i === step
                      ? T.green
                      : i < step
                      ? "rgba(61,107,71,0.5)"
                      : isDark
                      ? "rgba(255,255,255,0.15)"
                      : "#D1D5DB",
                }}
              />
            ))}
          </div>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              color: isDark ? T.dSub : T.lSub,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Desktop top bar ── */}
        <div
          className="hidden lg:flex items-center justify-between px-16 xl:px-20 pt-8 pb-0 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
            >
              {STEPS[step].label}
            </span>
          </div>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              color: isDark ? T.dSub : T.lSub,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark
                ? "rgba(255,255,255,0.12)"
                : "#E5E7EB";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark
                ? "rgba(255,255,255,0.06)"
                : "#F3F4F6";
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step content — scrollable on mobile, centered on desktop */}
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          <div
            className="w-full px-8 sm:px-12 lg:px-16 xl:px-20 py-10 max-w-3xl mx-auto"
            key={step}
            style={{ animation: `stepSlideIn${direction > 0 ? "Right" : "Left"} 0.30s cubic-bezier(0.22,1,0.36,1) both` }}
          >
            {/* Mobile step eyebrow */}
            <p
              className="lg:hidden text-xs font-semibold tracking-widest uppercase mb-2"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
            >
              {STEPS[step].hero.eyebrow}
            </p>
            {/* Mobile step title */}
            <h2
              className="lg:hidden text-2xl font-bold mb-6"
              style={{
                fontFamily: "'Clash Display', sans-serif",
                color: isDark ? T.dText : T.lText,
              }}
            >
              {STEPS[step].hero.title.replace("\n", " ")}
            </h2>

            {step === 0 && <StepDetails data={data} onChange={patch} isDark={isDark} />}
            {step === 1 && <StepFormat data={data} onChange={patch} isDark={isDark} />}
            {step === 2 && <StepTime data={data} onChange={patch} isDark={isDark} />}
            {step === 3 && <StepShare data={data} isDark={isDark} />}
          </div>
        </div>

        {/* ── Mobile bottom nav: full-width Continue + Back link ── */}
        <div
          className="lg:hidden flex-shrink-0 flex flex-col gap-2 px-5 py-4 border-t"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0",
            background: isDark ? T.dPanel : "#FFFFFF",
          }}
        >
          {/* Full-width Continue button */}
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
            {step === STEPS.length - 1 ? (
              <>
                Go to Tournament
                <ArrowRight className="w-5 h-5" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
          {/* Back / Cancel as a small text link */}
          <button
            type="button"
            onClick={handleBack}
            className="w-full flex items-center justify-center gap-1 text-sm font-medium rounded-xl transition-all duration-200 py-2"
            style={{ color: isDark ? T.dSub : T.lSub }}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancel" : "Back"}
          </button>
        </div>

        {/* ── Desktop bottom nav: Back | dots | Continue ── */}
        <div
          className="hidden lg:flex flex-shrink-0 items-center justify-between px-16 xl:px-20 py-5 border-t"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0",
            background: isDark ? T.dPanel : "#FFFFFF",
          }}
        >
          {/* Back / Cancel */}
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm font-medium rounded-xl transition-all duration-200"
            style={{
              padding: "10px 16px",
              color: isDark ? T.dSub : T.lSub,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark
                ? "rgba(255,255,255,0.06)"
                : "#F3F4F6";
              (e.currentTarget as HTMLButtonElement).style.color = isDark ? T.dText : T.lText;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = isDark ? T.dSub : T.lSub;
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  background:
                    i === step
                      ? T.green
                      : i < step
                      ? "rgba(61,107,71,0.45)"
                      : isDark
                      ? "rgba(255,255,255,0.15)"
                      : "#D1D5DB",
                }}
              />
            ))}
          </div>
          {/* Continue / Go to Tournament */}
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
            onMouseEnter={(e) => {
              if (!canAdvance) return;
              (e.currentTarget as HTMLButtonElement).style.background = T.greenDark;
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 6px 20px rgba(61,107,71,0.40)";
            }}
            onMouseLeave={(e) => {
              if (!canAdvance) return;
              (e.currentTarget as HTMLButtonElement).style.background = T.green;
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 4px 14px rgba(61,107,71,0.30)";
            }}
          >
            {step === STEPS.length - 1 ? (
              <>
                Go to Tournament
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes wizardFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stepSlideInRight {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes stepSlideInLeft {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
