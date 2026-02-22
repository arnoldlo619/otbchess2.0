/*
 * OTB Chess — Tournament Creation Wizard
 * Design: "The Board Room" — Apple Minimalism + Chess.com Green
 *
 * Steps:
 * 1. Tournament Details  (name, venue, date)
 * 2. Format & Rounds     (Swiss/RR, round count, player limit)
 * 3. Time Control        (preset or custom)
 * 4. Invite & Share      (generated link + QR placeholder)
 */

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useConfetti } from "@/hooks/useConfetti";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";
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
  Info,
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
  timeBase: number;   // minutes
  timeIncrement: number; // seconds
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

// ─── Step Indicator ───────────────────────────────────────────────────────────
const STEPS = [
  { label: "Details", icon: Trophy },
  { label: "Format", icon: Shuffle },
  { label: "Time", icon: Clock },
  { label: "Share", icon: Share2 },
];

function StepIndicator({ current }: { current: number }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const done = idx < current;
        const active = idx === current;

        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                  done
                    ? "bg-[#3D6B47] text-white"
                    : active
                    ? isDark
                      ? "bg-[oklch(0.38_0.10_145)] text-white ring-2 ring-[oklch(0.55_0.14_145)] ring-offset-2 ring-offset-[oklch(0.20_0.06_145)]"
                      : "bg-[#3D6B47] text-white ring-2 ring-[#3D6B47]/30 ring-offset-2"
                    : isDark
                    ? "bg-white/08 text-white/30"
                    : "bg-[#F0F5EE] text-[#9CA3AF]"
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  <Icon className="w-4 h-4" strokeWidth={2} />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  active
                    ? isDark ? "text-white" : "text-[#1A1A1A]"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>

            {idx < STEPS.length - 1 && (
              <div
                className={`w-12 h-px mb-5 mx-1 transition-all duration-500 ${
                  done
                    ? "bg-[#3D6B47]"
                    : isDark ? "bg-white/10" : "bg-[#EEEED2]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Input Primitives ─────────────────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-[#374151]"}`}>
          {label}
        </label>
        {hint && (
          <span className="text-xs text-muted-foreground">({hint})</span>
        )}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[#3D6B47]/30 focus:border-[#3D6B47] ${
          Icon ? "pl-9" : ""
        } ${
          isDark
            ? "bg-[oklch(0.25_0.07_145)] border-white/12 text-white placeholder:text-white/30 focus:bg-[oklch(0.27_0.08_145)]"
            : "bg-white border-[#D1D5DB] text-[#1A1A1A] placeholder:text-[#9CA3AF] focus:bg-white"
        }`}
      />
    </div>
  );
}

// ─── Step 1: Tournament Details ───────────────────────────────────────────────
function StepDetails({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Tournament Name" hint="required">
        <TextInput
          value={data.name}
          onChange={(v) => onChange({ name: v })}
          placeholder="e.g. NYC Chess Society — Spring Open 2026"
          icon={Trophy}
        />
      </Field>

      <Field label="Venue" hint="optional">
        <TextInput
          value={data.venue}
          onChange={(v) => onChange({ venue: v })}
          placeholder="e.g. The Marshall Chess Club, New York"
          icon={MapPin}
        />
      </Field>

      <Field label="Date">
        <TextInput
          value={data.date}
          onChange={(v) => onChange({ date: v })}
          type="date"
          icon={Calendar}
        />
      </Field>

      <Field label="Description" hint="optional">
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Any notes for players — prizes, rules, dress code..."
          rows={3}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-200 resize-none focus:ring-2 focus:ring-[#3D6B47]/30 focus:border-[#3D6B47] ${
            useTheme().theme === "dark"
              ? "bg-[oklch(0.25_0.07_145)] border-white/12 text-white placeholder:text-white/30"
              : "bg-white border-[#D1D5DB] text-[#1A1A1A] placeholder:text-[#9CA3AF]"
          }`}
        />
      </Field>

      <Field label="Rating System">
        <RatingSystemPicker
          value={data.ratingSystem}
          onChange={(v) => onChange({ ratingSystem: v })}
        />
      </Field>
    </div>
  );
}

function RatingSystemPicker({
  value,
  onChange,
}: {
  value: WizardData["ratingSystem"];
  onChange: (v: WizardData["ratingSystem"]) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const options: { value: WizardData["ratingSystem"]; label: string; sub: string }[] = [
    { value: "chess.com", label: "chess.com", sub: "Rapid/Blitz ELO" },
    { value: "lichess", label: "Lichess", sub: "Lichess rating" },
    { value: "fide", label: "FIDE", sub: "Classical rating" },
    { value: "unrated", label: "Unrated", sub: "No ELO required" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all duration-200 ${
            value === opt.value
              ? "border-[#3D6B47] bg-[#3D6B47]/08 ring-1 ring-[#3D6B47]/20"
              : isDark
              ? "border-white/10 bg-[oklch(0.25_0.07_145)] hover:border-white/20"
              : "border-[#D1D5DB] bg-white hover:border-[#3D6B47]/40"
          }`}
        >
          <span className={`text-sm font-semibold ${value === opt.value ? "text-[#3D6B47]" : "text-foreground"}`}>
            {opt.label}
          </span>
          <span className="text-xs text-muted-foreground">{opt.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Step 2: Format & Rounds ──────────────────────────────────────────────────
function StepFormat({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const formats = [
    {
      value: "swiss" as const,
      label: "Swiss System",
      desc: "Players are paired by score. Best for large groups.",
      icon: Shuffle,
    },
    {
      value: "roundrobin" as const,
      label: "Round Robin",
      desc: "Everyone plays everyone. Best for small groups.",
      icon: Users,
    },
    {
      value: "elimination" as const,
      label: "Elimination",
      desc: "Single knockout bracket. Fast and exciting.",
      icon: Trophy,
    },
  ];

  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const playerOptions = [8, 12, 16, 24, 32, 48, 64, 128];

  return (
    <div className="space-y-6">
      {/* Format selector */}
      <Field label="Tournament Format">
        <div className="space-y-2">
          {formats.map((f) => {
            const Icon = f.icon;
            const active = data.format === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onChange({ format: f.value })}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                  active
                    ? "border-[#3D6B47] bg-[#3D6B47]/08 ring-1 ring-[#3D6B47]/20"
                    : isDark
                    ? "border-white/10 bg-[oklch(0.25_0.07_145)] hover:border-white/20"
                    : "border-[#D1D5DB] bg-white hover:border-[#3D6B47]/40"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    active ? "bg-[#3D6B47] text-white" : isDark ? "bg-white/08 text-white/50" : "bg-[#F0F5EE] text-[#6B7280]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${active ? "text-[#3D6B47]" : "text-foreground"}`}>
                    {f.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
                {active && (
                  <Check className="w-4 h-4 text-[#3D6B47] ml-auto flex-shrink-0" strokeWidth={2.5} />
                )}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        {/* Rounds */}
        <Field label="Rounds">
          <div className="flex flex-wrap gap-1.5">
            {roundOptions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ rounds: r })}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all duration-200 ${
                  data.rounds === r
                    ? "bg-[#3D6B47] text-white"
                    : isDark
                    ? "bg-white/08 text-white/60 hover:bg-white/15"
                    : "bg-[#F0F5EE] text-[#4B5563] hover:bg-[#3D6B47]/10"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>

        {/* Max players */}
        <Field label="Max Players">
          <div className="flex flex-wrap gap-1.5">
            {playerOptions.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ maxPlayers: p })}
                className={`px-2.5 h-9 rounded-lg text-sm font-bold transition-all duration-200 ${
                  data.maxPlayers === p
                    ? "bg-[#3D6B47] text-white"
                    : isDark
                    ? "bg-white/08 text-white/60 hover:bg-white/15"
                    : "bg-[#F0F5EE] text-[#4B5563] hover:bg-[#3D6B47]/10"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Summary hint */}
      <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs ${
        isDark ? "bg-[#3D6B47]/15 text-white/60" : "bg-[#F0F5EE] text-[#6B7280]"
      }`}>
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#3D6B47]" />
        <span>
          {data.format === "swiss"
            ? `Swiss with ${data.rounds} rounds supports up to ${data.maxPlayers} players. Optimal for ${Math.pow(2, data.rounds - 1)} players.`
            : data.format === "roundrobin"
            ? `Round Robin with ${data.maxPlayers} players = ${(data.maxPlayers * (data.maxPlayers - 1)) / 2} total games.`
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
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isCustom = data.timePreset === "custom";

  const selectPreset = (p: typeof TIME_PRESETS[0]) => {
    if (p.base === -1) {
      onChange({ timePreset: "custom" });
    } else {
      onChange({ timePreset: p.sub, timeBase: p.base, timeIncrement: p.inc });
    }
  };

  const estimatedDuration = () => {
    const perGame = data.timeBase * 2 + (data.timeIncrement * 40) / 60; // rough estimate
    const totalMins = perGame * data.rounds * 0.6; // overlap factor
    if (totalMins < 60) return `~${Math.round(totalMins)} min`;
    return `~${(totalMins / 60).toFixed(1)} hrs`;
  };

  return (
    <div className="space-y-5">
      <Field label="Time Control Preset">
        <div className="grid grid-cols-2 gap-2">
          {TIME_PRESETS.map((p) => {
            const active = data.timePreset === p.sub;
            return (
              <button
                key={p.sub}
                type="button"
                onClick={() => selectPreset(p)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all duration-200 ${
                  active
                    ? "border-[#3D6B47] bg-[#3D6B47]/08 ring-1 ring-[#3D6B47]/20"
                    : isDark
                    ? "border-white/10 bg-[oklch(0.25_0.07_145)] hover:border-white/20"
                    : "border-[#D1D5DB] bg-white hover:border-[#3D6B47]/40"
                }`}
              >
                <div>
                  <p className={`text-sm font-bold ${active ? "text-[#3D6B47]" : "text-foreground"}`}>
                    {p.sub === "custom" ? "Custom" : p.sub}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.sub === "custom" ? "Set manually" : p.label}</p>
                </div>
                {p.tag && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                    active
                      ? "bg-[#3D6B47] text-white"
                      : isDark
                      ? "bg-white/08 text-white/50"
                      : "bg-[#F0F5EE] text-[#6B7280]"
                  }`}>
                    {p.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Custom controls */}
      {isCustom && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Base time (min)">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ timeBase: Math.max(1, data.timeBase - 1) })}
                className={`w-9 h-9 rounded-lg font-bold text-lg flex items-center justify-center transition-colors ${isDark ? "bg-white/08 hover:bg-white/15 text-white" : "bg-[#F0F5EE] hover:bg-[#EEEED2] text-[#1A1A1A]"}`}
              >
                −
              </button>
              <span className="flex-1 text-center text-lg font-bold text-foreground font-mono">{data.timeBase}</span>
              <button
                type="button"
                onClick={() => onChange({ timeBase: Math.min(180, data.timeBase + 1) })}
                className={`w-9 h-9 rounded-lg font-bold text-lg flex items-center justify-center transition-colors ${isDark ? "bg-white/08 hover:bg-white/15 text-white" : "bg-[#F0F5EE] hover:bg-[#EEEED2] text-[#1A1A1A]"}`}
              >
                +
              </button>
            </div>
          </Field>
          <Field label="Increment (sec)">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ timeIncrement: Math.max(0, data.timeIncrement - 1) })}
                className={`w-9 h-9 rounded-lg font-bold text-lg flex items-center justify-center transition-colors ${isDark ? "bg-white/08 hover:bg-white/15 text-white" : "bg-[#F0F5EE] hover:bg-[#EEEED2] text-[#1A1A1A]"}`}
              >
                −
              </button>
              <span className="flex-1 text-center text-lg font-bold text-foreground font-mono">{data.timeIncrement}</span>
              <button
                type="button"
                onClick={() => onChange({ timeIncrement: Math.min(60, data.timeIncrement + 1) })}
                className={`w-9 h-9 rounded-lg font-bold text-lg flex items-center justify-center transition-colors ${isDark ? "bg-white/08 hover:bg-white/15 text-white" : "bg-[#F0F5EE] hover:bg-[#EEEED2] text-[#1A1A1A]"}`}
              >
                +
              </button>
            </div>
          </Field>
        </div>
      )}

      {/* Duration estimate */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
        isDark ? "border-white/10 bg-[oklch(0.25_0.07_145)]" : "border-[#EEEED2] bg-[#F9FAF8]"
      }`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Estimated tournament duration</span>
        </div>
        <span className="text-sm font-bold text-foreground">{estimatedDuration()}</span>
      </div>
    </div>
  );
}

// ─── Animated QR Reveal Component ───────────────────────────────────────────
function AnimatedQR({ inviteUrl, isDark }: { inviteUrl: string; isDark: boolean }) {
  const [phase, setPhase] = useState<"hidden" | "appear" | "scan" | "done">("hidden");
  const [scanY, setScanY] = useState(0);
  const scanRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const SCAN_DURATION = 1200; // ms for one sweep

  useEffect(() => {
    // Phase 1: fade in after short delay
    const t1 = setTimeout(() => setPhase("appear"), 120);
    // Phase 2: start scan-line after appear animation
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
      className={`flex flex-col items-center gap-3 py-5 rounded-xl border transition-all duration-500 ${
        phase === "hidden" ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
      } ${
        isDark ? "border-white/12 bg-white/03" : "border-[#D1FAE5] bg-[#F0FDF4]"
      }`}
      style={{ transition: "opacity 0.5s ease, transform 0.5s ease" }}
    >
      {/* QR wrapper with scan-line overlay */}
      <div className="relative" style={{ width: 160, height: 160 }}>
        {/* White background pad */}
        <div
          className="absolute inset-0 rounded-xl bg-white"
          style={{
            boxShadow: phase === "done"
              ? "0 0 0 3px #3D6B47, 0 8px 24px rgba(61,107,71,0.25)"
              : "0 0 0 2px rgba(61,107,71,0.15), 0 4px 12px rgba(0,0,0,0.08)",
            transition: "box-shadow 0.4s ease",
          }}
        />
        {/* Actual QR code */}
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <QRCodeSVG
            value={inviteUrl}
            size={134}
            level="H"
            includeMargin={false}
            fgColor="#1a1a1a"
            bgColor="#ffffff"
          />
        </div>
        {/* Corner finder brackets */}
        {[
          "top-1 left-1",
          "top-1 right-1",
          "bottom-1 left-1",
          "bottom-1 right-1",
        ].map((pos) => (
          <div
            key={pos}
            className={`absolute w-5 h-5 ${
              pos.includes("top") && pos.includes("left") ? "border-t-2 border-l-2 rounded-tl-lg" :
              pos.includes("top") && pos.includes("right") ? "border-t-2 border-r-2 rounded-tr-lg" :
              pos.includes("bottom") && pos.includes("left") ? "border-b-2 border-l-2 rounded-bl-lg" :
              "border-b-2 border-r-2 rounded-br-lg"
            } transition-all duration-700 ${
              phase === "done" ? "border-[#3D6B47] opacity-100" : "border-[#3D6B47]/40 opacity-60"
            }`}
            style={{ [pos.split(" ")[0]]: 4, [pos.split(" ")[1]]: 4 }}
          />
        ))}
        {/* Scan line */}
        {phase === "scan" && (
          <div
            className="absolute left-2 right-2 pointer-events-none"
            style={{
              top: `${scanY}%`,
              height: 2,
              background: "linear-gradient(90deg, transparent 0%, #4CAF50 20%, #4CAF50 80%, transparent 100%)",
              boxShadow: "0 0 8px 2px rgba(76,175,80,0.6), 0 0 20px 4px rgba(76,175,80,0.25)",
              borderRadius: 2,
            }}
          />
        )}
        {/* Done checkmark overlay */}
        {phase === "done" && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ animation: "fadeInScale 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            <div
              className="w-10 h-10 rounded-full bg-[#3D6B47] flex items-center justify-center"
              style={{ boxShadow: "0 4px 16px rgba(61,107,71,0.45)" }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-1">
        <p
          className={`text-xs font-semibold transition-colors duration-500 ${
            phase === "done"
              ? isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"
              : "text-muted-foreground"
          }`}
        >
          {phase === "done" ? "Ready to scan!" : phase === "scan" ? "Generating QR…" : "QR code — players scan to join"}
        </p>
        <p className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
          {inviteUrl.replace("https://", "")}
        </p>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Step 4: Invite & Share ───────────────────────────────────────────────────
function StepShare({ data }: { data: WizardData }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);
  const inviteUrl = `https://otbchess.app/join/${data.inviteCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLabel = data.format === "swiss" ? "Swiss" : data.format === "roundrobin" ? "Round Robin" : "Elimination";
  const timeLabel = data.timePreset === "custom" ? `${data.timeBase}+${data.timeIncrement}` : data.timePreset;

  return (
    <div className="space-y-5">
      {/* Success banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#3D6B47] rounded-xl text-white">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Check className="w-4 h-4" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-bold">Tournament Created!</p>
          <p className="text-xs text-white/70">Share the link below to invite players</p>
        </div>
      </div>

      {/* Summary card */}
      <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "border-white/10 bg-[oklch(0.25_0.07_145)]" : "border-[#EEEED2] bg-[#F9FAF8]"}`}>
        <p className="text-sm font-bold text-foreground">{data.name || "Untitled Tournament"}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {data.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> {data.venue}
            </span>
          )}
          {data.date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> {data.date}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Shuffle className="w-3 h-3" /> {formatLabel} · {data.rounds} rounds
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> {timeLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Up to {data.maxPlayers} players
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3" /> {data.ratingSystem}
          </span>
        </div>
      </div>

      {/* Invite link */}
      <Field label="Player Invite Link">
        <div className="flex gap-2">
          <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-mono truncate ${
            isDark ? "bg-[oklch(0.25_0.07_145)] border-white/12 text-white/70" : "bg-white border-[#D1D5DB] text-[#6B7280]"
          }`}>
            <Link2 className="w-3.5 h-3.5 flex-shrink-0 text-[#3D6B47]" />
            <span className="truncate">{inviteUrl}</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex-shrink-0 ${
              copied
                ? "bg-[#3D6B47] text-white"
                : isDark
                ? "bg-white/10 text-white hover:bg-white/15"
                : "bg-[#F0F5EE] text-[#374151] hover:bg-[#3D6B47]/10"
            }`}
          >
            {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </Field>

      {/* QR Code — animated reveal */}
      <AnimatedQR inviteUrl={inviteUrl} isDark={isDark} />

      {/* Next steps hint */}
      <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs ${
        isDark ? "bg-[#3D6B47]/15 text-white/60" : "bg-[#F0F5EE] text-[#6B7280]"
      }`}>
        <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#3D6B47]" />
        <span>
          Players join by entering their <strong className={isDark ? "text-white/80" : "text-[#374151]"}>{data.ratingSystem}</strong> username.
          Their ELO is pulled automatically and pairings are generated when you start Round 1.
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
  const [data, setData] = useState<WizardData>({ ...DEFAULT_DATA, inviteCode: nanoid(8) });
  const overlayRef = useRef<HTMLDivElement>(null);
  const { fireConfetti } = useConfetti();

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setData({ ...DEFAULT_DATA, inviteCode: nanoid(8) });
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const patch = (p: Partial<WizardData>) => setData((d) => ({ ...d, ...p }));

  const canAdvance = () => {
    if (step === 0) return data.name.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      // Fire confetti when reaching the final Share step
      if (nextStep === STEPS.length - 1) {
        // Small delay so the modal content has settled into view
        setTimeout(() => fireConfetti(130), 200);
      }
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else onClose();
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${
          isDark
            ? "bg-[oklch(0.22_0.06_145)] border border-white/10"
            : "bg-white border border-[#E5E7EB]"
        }`}
        style={{
          animation: "wizardIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 pt-6 pb-0`}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#3D6B47] rounded-lg flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <span
              className="text-base font-bold text-foreground"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              New Tournament
            </span>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/10 text-white/60 hover:text-white" : "hover:bg-[#F0F5EE] text-[#9CA3AF] hover:text-[#374151]"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-6">
          <StepIndicator current={step} />
        </div>

        {/* Step content */}
        <div
          className="px-6 pb-2 overflow-y-auto"
          style={{ maxHeight: "55vh" }}
          key={step}
        >
          <div style={{ animation: "stepIn 0.2s ease both" }}>
            {step === 0 && <StepDetails data={data} onChange={patch} />}
            {step === 1 && <StepFormat data={data} onChange={patch} />}
            {step === 2 && <StepTime data={data} onChange={patch} />}
            {step === 3 && <StepShare data={data} />}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 mt-2 border-t ${isDark ? "border-white/08" : "border-[#F0F5EE]"}`}>
          <button
            type="button"
            onClick={handleBack}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? "text-white/60 hover:text-white hover:bg-white/08"
                : "text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F0F5EE]"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          <div className="flex items-center gap-2">
            {/* Dot progress */}
            <div className="flex gap-1 mr-2">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-4 h-1.5 bg-[#3D6B47]"
                      : i < step
                      ? "w-1.5 h-1.5 bg-[#3D6B47]/50"
                      : isDark
                      ? "w-1.5 h-1.5 bg-white/15"
                      : "w-1.5 h-1.5 bg-[#D1D5DB]"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 ${
                canAdvance()
                  ? "bg-[#3D6B47] text-white hover:bg-[#2A4A32] hover:-translate-y-0.5 hover:shadow-md"
                  : isDark
                  ? "bg-white/08 text-white/25 cursor-not-allowed"
                  : "bg-[#F0F5EE] text-[#9CA3AF] cursor-not-allowed"
              }`}
            >
              {step === STEPS.length - 1 ? (
                <>
                  Go to Tournament
                  <ChevronRight className="w-4 h-4" />
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
      </div>

      <style>{`
        @keyframes wizardIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
