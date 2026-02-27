/**
 * OTB Chess — Tournament Settings Panel
 *
 * Displayed in the Director Dashboard "Settings" tab.
 * Allows editing all tournament metadata before Round 1 starts.
 * Once the tournament is active (rounds > 0), all fields become read-only.
 *
 * Editable fields:
 *   - Tournament Name, Venue, Date, Description
 *   - Format (Swiss / Round Robin / Elimination)
 *   - Rounds, Max Players
 *   - Time Control (preset tiles + custom stepper)
 *   - Rating System
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getTournamentConfig,
  updateTournamentConfig,
  type TournamentConfig,
} from "@/lib/tournamentRegistry";
import {
  Trophy,
  MapPin,
  Calendar,
  FileText,
  Shuffle,
  Users,
  Clock,
  BarChart3,
  Check,
  Lock,
  Save,
  Zap,
} from "lucide-react";

// ─── Design tokens (mirrors TournamentWizard) ─────────────────────────────────
const T = {
  green: "#3D6B47",
  greenDark: "#2A4A32",
  greenBg: "rgba(61,107,71,0.08)",
  greenRing: "rgba(61,107,71,0.25)",
  lBorder: "#E5E7EB",
  lText: "#1A1A1A",
  lSub: "#6B7280",
  lMuted: "#9CA3AF",
  lInput: "#FFFFFF",
  lInputBorder: "#D1D5DB",
  dCard: "oklch(0.25 0.07 145)",
  dBorder: "rgba(255,255,255,0.10)",
  dText: "#FFFFFF",
  dSub: "rgba(255,255,255,0.55)",
  dMuted: "rgba(255,255,255,0.30)",
  dInput: "oklch(0.25 0.07 145)",
  dInputBorder: "rgba(255,255,255,0.12)",
};

const TIME_PRESETS = [
  { label: "Bullet", sub: "1+0",   base: 1,  inc: 0,  tag: "Ultra-fast" },
  { label: "Blitz",  sub: "3+2",   base: 3,  inc: 2,  tag: "Fast" },
  { label: "Blitz",  sub: "5+3",   base: 5,  inc: 3,  tag: "Popular" },
  { label: "Rapid",  sub: "10+5",  base: 10, inc: 5,  tag: "Recommended" },
  { label: "Rapid",  sub: "15+10", base: 15, inc: 10, tag: "Club standard" },
  { label: "Classical", sub: "30+30", base: 30, inc: 30, tag: "Long game" },
  { label: "Classical", sub: "90+30", base: 90, inc: 30, tag: "FIDE standard" },
  { label: "Custom", sub: "custom", base: -1, inc: -1, tag: "" },
];

// ─── Local form state ─────────────────────────────────────────────────────────

interface SettingsForm {
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
}

function configToForm(cfg: TournamentConfig): SettingsForm {
  return {
    name: cfg.name,
    venue: cfg.venue ?? "",
    date: cfg.date ?? "",
    description: cfg.description ?? "",
    format: cfg.format,
    rounds: cfg.rounds,
    maxPlayers: cfg.maxPlayers,
    timeBase: cfg.timeBase,
    timeIncrement: cfg.timeIncrement,
    timePreset: cfg.timePreset,
    ratingSystem: cfg.ratingSystem,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <h3
      className="text-xs font-bold tracking-widest uppercase mb-3"
      style={{ color: isDark ? "rgba(255,255,255,0.35)" : T.lMuted }}
    >
      {title}
    </h3>
  );
}

function FieldInput({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  isDark,
  multiline,
}: {
  label: string;
  icon?: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  isDark: boolean;
  multiline?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: Icon ? "11px 14px 11px 40px" : "11px 14px",
    fontSize: 14,
    background: disabled
      ? isDark ? "rgba(255,255,255,0.04)" : "#F9FAFB"
      : isDark ? T.dInput : T.lInput,
    border: `1.5px solid ${isDark ? T.dInputBorder : T.lInputBorder}`,
    borderRadius: 12,
    color: disabled
      ? isDark ? "rgba(255,255,255,0.30)" : T.lMuted
      : isDark ? T.dText : T.lText,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    cursor: disabled ? "not-allowed" : "text",
    resize: "none" as const,
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (disabled) return;
    e.target.style.borderColor = T.green;
    e.target.style.boxShadow = `0 0 0 3px ${T.greenRing}`;
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = isDark ? T.dInputBorder : T.lInputBorder;
    e.target.style.boxShadow = "none";
  };

  return (
    <div>
      <label
        className="block text-xs font-semibold mb-1.5"
        style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lSub }}
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: isDark ? T.dMuted : T.lMuted }}
          />
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            style={baseStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={baseStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        )}
      </div>
    </div>
  );
}

function OptionChip({
  label,
  active,
  onClick,
  disabled,
  isDark,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl text-sm font-semibold transition-all duration-150"
      style={{
        padding: "8px 14px",
        background: active ? T.green : isDark ? "rgba(255,255,255,0.07)" : "#F0F5EE",
        color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.55)" : T.lSub,
        boxShadow: active ? `0 2px 8px ${T.greenRing}` : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !active ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TournamentSettingsPanelProps {
  tournamentId: string;
  /** Whether the tournament has started (rounds > 0 or status !== registration). */
  isLocked: boolean;
  isDark: boolean;
  /** Called after a successful save so the parent can refresh its state. */
  onSaved?: (updated: TournamentConfig) => void;
}

export function TournamentSettingsPanel({
  tournamentId,
  isLocked,
  isDark,
  onSaved,
}: TournamentSettingsPanelProps) {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load config on mount / tournamentId change
  useEffect(() => {
    const cfg = getTournamentConfig(tournamentId);
    if (cfg) {
      setForm(configToForm(cfg));
      setDirty(false);
    }
  }, [tournamentId]);

  const patch = (p: Partial<SettingsForm>) => {
    setForm((f) => f ? { ...f, ...p } : f);
    setDirty(true);
  };

  const handleSave = () => {
    if (!form || !dirty || isLocked) return;
    setSaving(true);
    const updated = updateTournamentConfig(tournamentId, {
      name: form.name.trim(),
      venue: form.venue.trim(),
      date: form.date,
      description: form.description.trim(),
      format: form.format,
      rounds: form.rounds,
      maxPlayers: form.maxPlayers,
      timeBase: form.timeBase,
      timeIncrement: form.timeIncrement,
      timePreset: form.timePreset,
      ratingSystem: form.ratingSystem,
    });
    setSaving(false);
    if (updated) {
      setDirty(false);
      toast.success("Tournament settings saved");
      onSaved?.(updated);
    } else {
      toast.error("Failed to save — tournament not found in registry");
    }
  };

  if (!form) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          Loading settings…
        </span>
      </div>
    );
  }

  const isCustomTime = form.timePreset === "custom";
  const roundOptions = [3, 4, 5, 6, 7, 9, 11];
  const playerOptions = [8, 12, 16, 20, 24, 32, 64];
  const ratingOptions: { value: SettingsForm["ratingSystem"]; label: string; sub: string }[] = [
    { value: "chess.com", label: "chess.com", sub: "Rapid / Blitz ELO" },
    { value: "lichess",   label: "Lichess",   sub: "Lichess rating" },
    { value: "fide",      label: "FIDE",      sub: "Classical rating" },
    { value: "unrated",   label: "Unrated",   sub: "No ELO required" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Locked banner ── */}
      {isLocked && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: isDark ? "rgba(245,158,11,0.10)" : "#FFFBEB",
            border: `1.5px solid ${isDark ? "rgba(245,158,11,0.25)" : "#FDE68A"}`,
          }}
        >
          <Lock className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? "#FBBF24" : "#D97706" }} />
          <span style={{ color: isDark ? "#FBBF24" : "#92400E" }}>
            Settings are locked once the tournament is active. Reset the tournament to make changes.
          </span>
        </div>
      )}

      {/* ── Event Details ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
        }}
      >
        <div
          className="px-5 py-3 border-b"
          style={{ borderColor: isDark ? T.dBorder : "#F0F0F0" }}
        >
          <SectionHeader title="Event Details" isDark={isDark} />
        </div>
        <div className="px-5 py-4 space-y-4">
          <FieldInput
            label="Tournament Name"
            icon={Trophy}
            value={form.name}
            onChange={(v) => patch({ name: v })}
            placeholder="e.g. Spring Open 2026"
            disabled={isLocked}
            isDark={isDark}
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Venue"
              icon={MapPin}
              value={form.venue}
              onChange={(v) => patch({ venue: v })}
              placeholder="Marshall Chess Club"
              disabled={isLocked}
              isDark={isDark}
            />
            <FieldInput
              label="Date"
              icon={Calendar}
              value={form.date}
              onChange={(v) => patch({ date: v })}
              type="date"
              disabled={isLocked}
              isDark={isDark}
            />
          </div>
          <FieldInput
            label="Description"
            icon={FileText}
            value={form.description}
            onChange={(v) => patch({ description: v })}
            placeholder="Prizes, dress code, parking info…"
            disabled={isLocked}
            isDark={isDark}
            multiline
          />
        </div>
      </div>

      {/* ── Format ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
        }}
      >
        <div className="px-5 py-3 border-b" style={{ borderColor: isDark ? T.dBorder : "#F0F0F0" }}>
          <SectionHeader title="Format" isDark={isDark} />
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Format selector */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lSub }}>
              Tournament Format
            </label>
            <div className="space-y-2">
              {[
                { value: "swiss" as const,       label: "Swiss System",  desc: "Paired by score — best for large groups.", icon: Shuffle },
                { value: "roundrobin" as const,  label: "Round Robin",   desc: "Everyone plays everyone.", icon: Users },
                { value: "elimination" as const, label: "Elimination",   desc: "Single knockout bracket.", icon: Trophy },
              ].map((f) => {
                const Icon = f.icon;
                const active = form.format === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => !isLocked && patch({ format: f.value })}
                    disabled={isLocked}
                    className="w-full flex items-center gap-4 rounded-xl border text-left transition-all duration-150"
                    style={{
                      padding: "12px 14px",
                      background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                      border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                      boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      opacity: isLocked && !active ? 0.6 : 1,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                        color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.45)" : T.lSub,
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" strokeWidth={1.8} style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                        {f.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                        {f.desc}
                      </p>
                    </div>
                    {active && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.green }}>
                        <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rounds */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lSub }}>
              Rounds
            </label>
            <div className="flex flex-wrap gap-2">
              {roundOptions.map((r) => (
                <OptionChip
                  key={r}
                  label={String(r)}
                  active={form.rounds === r}
                  onClick={() => patch({ rounds: r })}
                  disabled={isLocked}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lSub }}>
              Max Players
            </label>
            <div className="flex flex-wrap gap-2">
              {playerOptions.map((p) => (
                <OptionChip
                  key={p}
                  label={String(p)}
                  active={form.maxPlayers === p}
                  onClick={() => patch({ maxPlayers: p })}
                  disabled={isLocked}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Time Control ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
        }}
      >
        <div className="px-5 py-3 border-b" style={{ borderColor: isDark ? T.dBorder : "#F0F0F0" }}>
          <SectionHeader title="Time Control" isDark={isDark} />
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {TIME_PRESETS.map((p) => {
              const active = form.timePreset === p.sub;
              return (
                <button
                  key={p.sub}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    if (p.base === -1) {
                      patch({ timePreset: "custom" });
                    } else {
                      patch({ timePreset: p.sub, timeBase: p.base, timeIncrement: p.inc });
                    }
                  }}
                  className="flex flex-col items-center rounded-xl border transition-all duration-150"
                  style={{
                    padding: "10px 6px",
                    background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                    border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                    boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked && !active ? 0.6 : 1,
                  }}
                >
                  <span className="text-sm font-bold" style={{ color: active ? T.green : isDark ? T.dText : T.lText }}>
                    {p.sub === "custom" ? "Custom" : p.sub}
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    {p.sub === "custom" ? "Manual" : p.label}
                  </span>
                  {p.tag && (
                    <span
                      className="text-[9px] mt-1 px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: active ? T.green : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                        color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.40)" : T.lSub,
                      }}
                    >
                      {p.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom stepper */}
          {isCustomTime && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Base time (min)", value: form.timeBase,      min: 1,  max: 180, key: "timeBase" as const },
                { label: "Increment (sec)", value: form.timeIncrement, min: 0,  max: 60,  key: "timeIncrement" as const },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lSub }}>
                    {field.label}
                  </label>
                  <div
                    className="flex items-center gap-2 rounded-xl border"
                    style={{
                      padding: "10px 14px",
                      background: isDark ? T.dCard : "#FAFAFA",
                      border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
                    }}
                  >
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => patch({ [field.key]: Math.max(field.min, field.value - 1) })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold transition-colors"
                      style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE", color: isDark ? T.dText : T.lText }}
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-base font-bold" style={{ color: isDark ? T.dText : T.lText }}>
                      {field.value}
                    </span>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => patch({ [field.key]: Math.min(field.max, field.value + 1) })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-base font-bold transition-colors"
                      style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE", color: isDark ? T.dText : T.lText }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Duration hint */}
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
            style={{ background: isDark ? "rgba(61,107,71,0.10)" : "#F0F5EE", color: isDark ? "rgba(255,255,255,0.45)" : T.lSub }}
          >
            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: T.green }} />
            <span>
              {(() => {
                const perGame = form.timeBase * 2 + (form.timeIncrement * 40) / 60;
                const totalMins = perGame * form.rounds * 0.6;
                const dur = totalMins < 60 ? `~${Math.round(totalMins)} min` : `~${(totalMins / 60).toFixed(1)} hrs`;
                return `${isCustomTime ? `${form.timeBase}+${form.timeIncrement}` : form.timePreset} · Estimated duration: ${dur}`;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Rating System ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
        }}
      >
        <div className="px-5 py-3 border-b" style={{ borderColor: isDark ? T.dBorder : "#F0F0F0" }}>
          <SectionHeader title="Rating System" isDark={isDark} />
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {ratingOptions.map((opt) => {
              const active = form.ratingSystem === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !isLocked && patch({ ratingSystem: opt.value })}
                  disabled={isLocked}
                  className="flex flex-col items-start rounded-xl border text-left transition-all duration-150"
                  style={{
                    padding: "12px 14px",
                    background: active ? T.greenBg : isDark ? T.dCard : "#FAFAFA",
                    border: `1.5px solid ${active ? T.green : isDark ? T.dBorder : T.lBorder}`,
                    boxShadow: active ? `0 0 0 3px ${T.greenRing}` : "none",
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked && !active ? 0.6 : 1,
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
      </div>

      {/* ── Pairing Info (read-only) ── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1.5px solid ${isDark ? T.dBorder : T.lBorder}`,
        }}
      >
        <div className="px-5 py-3 border-b" style={{ borderColor: isDark ? T.dBorder : "#F0F0F0" }}>
          <SectionHeader title="Pairing Algorithm" isDark={isDark} />
        </div>
        <div className="divide-y" style={{ borderColor: isDark ? T.dBorder : "#F5F5F5" }}>
          {[
            ["Algorithm",            "Swiss (FIDE)"],
            ["Color Balance",        "Automatic"],
            ["Rematch Prevention",   "Enabled"],
            ["Bye Assignment",       "Lowest score"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm" style={{ color: isDark ? T.dMuted : T.lSub }}>{label}</span>
              <span className="text-sm font-medium" style={{ color: isDark ? "rgba(255,255,255,0.70)" : "#374151" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Save button ── */}
      {!isLocked && (
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200"
          style={{
            padding: "13px 20px",
            background: dirty ? T.green : isDark ? "rgba(255,255,255,0.07)" : "#F0F5EE",
            color: dirty ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : T.lMuted,
            boxShadow: dirty ? `0 4px 14px rgba(61,107,71,0.30)` : "none",
            cursor: dirty ? "pointer" : "not-allowed",
          }}
        >
          {saving ? (
            <><Zap className="w-4 h-4 animate-pulse" /> Saving…</>
          ) : dirty ? (
            <><Save className="w-4 h-4" /> Save Changes</>
          ) : (
            <><Check className="w-4 h-4" /> Up to date</>
          )}
        </button>
      )}
    </div>
  );
}
