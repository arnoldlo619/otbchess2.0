/**
 * Style-Aware Pairings Panel
 *
 * A premium Pro organizer component for the Director Dashboard.
 * Provides:
 *   - Pairing mode selector (Balanced / Style-Aware / Sharp)
 *   - Organizer controls (Elo tolerance, style influence, rematch avoidance)
 *   - Player style profile chips with confidence indicators
 *   - Pool readiness status
 *   - Pairing preview with explainability chips
 *
 * Design: exact chessotb.club design language — green/white, Clash Display,
 * Apple-inspired minimalism, premium restrained polish.
 */

import { useState, useMemo } from "react";
import {
  Zap,
  Scale,
  Swords,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minus,
  Settings2,
  Crown,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  PAIRING_MODES,
  type PairingMode,
  type PairingSettings,
  type StylePairingPlayer,
  type GeneratedPairing,
  type StyleProfileStatus,
  STYLE_PROFILE_STATUS_META,
  assessPoolReadiness,
  generateStyleAwarePairings,
  DEFAULT_PAIRING_SETTINGS,
} from "../lib/styleAwarePairings";

// ─── Design tokens (match Director.tsx) ──────────────────────────────────────

const T = {
  green: "#3D6B47",
  greenLight: "#5A9A68",
  greenRing: "rgba(61,107,71,0.18)",
  dBg: "#0F1A12",
  dCard: "#1A2B1E",
  dBorder: "rgba(255,255,255,0.08)",
  dText: "rgba(255,255,255,0.92)",
  dMuted: "rgba(255,255,255,0.45)",
  lBg: "#FFFFFF",
  lCard: "#F8FAF8",
  lBorder: "#E8EDE8",
  lText: "#1A2B1E",
  lMuted: "#6B7B6E",
  amber: "#D97706",
  red: "#EF4444",
  gray: "#6B7280",
};

// ─── Mode Icon map ────────────────────────────────────────────────────────────

const MODE_ICONS: Record<PairingMode, React.FC<{ className?: string }>> = {
  balanced: Scale,
  style_aware: Sparkles,
  sharp: Zap,
};

const MODE_ACCENT: Record<PairingMode, string> = {
  balanced: T.green,
  style_aware: "#7C3AED",
  sharp: "#DC2626",
};

// ─── Status icon ─────────────────────────────────────────────────────────────

function StatusIcon({
  status,
  size = 14,
}: {
  status: StyleProfileStatus;
  size?: number;
}) {
  const s: React.CSSProperties = { width: size, height: size };
  if (status === "ready") return <CheckCircle2 style={{ ...s, color: T.green }} />;
  if (status === "limited") return <AlertTriangle style={{ ...s, color: T.amber }} />;
  if (status === "low_confidence") return <Minus style={{ ...s, color: T.red }} />;
  return <XCircle style={{ ...s, color: T.gray }} />;
}

// ─── Mode Selector Card ───────────────────────────────────────────────────────

function ModeCard({
  mode,
  selected,
  onSelect,
  isDark,
}: {
  mode: PairingMode;
  selected: boolean;
  onSelect: () => void;
  isDark: boolean;
}) {
  const cfg = PAIRING_MODES[mode];
  const Icon = MODE_ICONS[mode];
  const accent = MODE_ACCENT[mode];

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl border transition-all duration-200 p-3.5 focus:outline-none"
      style={{
        background: selected
          ? isDark
            ? `${accent}14`
            : `${accent}0A`
          : isDark
          ? T.dCard
          : T.lCard,
        borderColor: selected ? accent : isDark ? T.dBorder : T.lBorder,
        boxShadow: selected ? `0 0 0 2px ${accent}30` : "none",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: selected ? accent : isDark ? "rgba(255,255,255,0.06)" : "#F0F4F0" }}
        >
          <span style={{ color: selected ? "#fff" : isDark ? T.dMuted : T.lMuted, display: "flex" }}><Icon className="w-4 h-4" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold"
              style={{
                fontFamily: "'Clash Display', sans-serif",
                color: selected ? accent : isDark ? T.dText : T.lText,
              }}
            >
              {cfg.label}
            </span>
            {selected && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: accent, color: "#fff" }}
              >
                Active
              </span>
            )}
          </div>
          <p
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: isDark ? T.dMuted : T.lMuted }}
          >
            {cfg.description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Style Profile Chip ───────────────────────────────────────────────────────

function StyleProfileChip({
  player,
  isDark,
}: {
  player: StylePairingPlayer;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const profile = player.styleProfile;

  if (!profile) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
        style={{
          background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAF8",
          borderColor: isDark ? T.dBorder : T.lBorder,
          color: isDark ? T.dMuted : T.lMuted,
        }}
      >
        <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: T.gray }} />
        <span className="font-medium truncate max-w-[120px]">{player.name}</span>
        <span className="opacity-60">No data</span>
      </div>
    );
  }

  const statusMeta = STYLE_PROFILE_STATUS_META[profile.status];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all duration-150 focus:outline-none"
        style={{
          background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAF8",
          borderColor: isDark ? T.dBorder : T.lBorder,
        }}
      >
        <StatusIcon status={profile.status} size={12} />
        <span
          className="font-semibold truncate max-w-[90px]"
          style={{ color: isDark ? T.dText : T.lText }}
        >
          {player.name}
        </span>
        <span
          className="truncate max-w-[100px]"
          style={{ color: isDark ? T.dMuted : T.lMuted }}
        >
          {profile.primaryTag}
        </span>
        {open ? (
          <ChevronUp className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
        ) : (
          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? T.dMuted : T.lMuted }} />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-xl p-3 w-64"
          style={{
            background: isDark ? T.dCard : "#FFFFFF",
            borderColor: isDark ? T.dBorder : T.lBorder,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon status={profile.status} size={14} />
            <span
              className="text-xs font-semibold"
              style={{ color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
          </div>
          <p
            className="text-xs mb-2"
            style={{ color: isDark ? T.dMuted : T.lMuted }}
          >
            {statusMeta.description}
          </p>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: isDark ? T.dMuted : T.lMuted }}>Primary Style</span>
              <span className="font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
                {profile.primaryTag}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: isDark ? T.dMuted : T.lMuted }}>Tendency</span>
              <span className="font-medium" style={{ color: isDark ? T.dText : T.lText }}>
                {profile.secondaryTag}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: isDark ? T.dMuted : T.lMuted }}>Confidence</span>
              <span className="font-mono font-bold" style={{ color: isDark ? T.dText : T.lText }}>
                {Math.round(profile.confidence * 100)}%
              </span>
            </div>
          </div>

          <p
            className="text-xs mt-2 pt-2 border-t italic"
            style={{
              color: isDark ? T.dMuted : T.lMuted,
              borderColor: isDark ? T.dBorder : T.lBorder,
            }}
          >
            {profile.summary}
          </p>

          {/* Signal bars */}
          <div className="mt-2 pt-2 border-t space-y-1.5" style={{ borderColor: isDark ? T.dBorder : T.lBorder }}>
            {(
              [
                ["Aggression", profile.signals.aggression],
                ["Tactical", profile.signals.tactical],
                ["Opening Sharpness", profile.signals.openingSharpness],
                ["Volatility", profile.signals.volatility],
              ] as [string, number][]
            ).map(([label, val]) => (
              <div key={label} className="space-y-0.5">
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: isDark ? T.dMuted : T.lMuted }}>{label}</span>
                  <span className="font-mono" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                    {Math.round(val * 100)}
                  </span>
                </div>
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#E8EDE8" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(val * 100)}%`,
                      background:
                        val >= 0.65
                          ? "#DC2626"
                          : val >= 0.45
                          ? T.green
                          : T.gray,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pairing Preview Row ──────────────────────────────────────────────────────

function PairingPreviewRow({
  pairing,
  players,
  isDark,
  mode,
}: {
  pairing: GeneratedPairing;
  players: StylePairingPlayer[];
  isDark: boolean;
  mode: PairingMode;
}) {
  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const white = playerMap.get(pairing.whiteId);
  const black = playerMap.get(pairing.blackId);
  const accent = MODE_ACCENT[pairing.effectiveMode];
  const isFallback = pairing.effectiveMode !== mode;

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{
        background: isDark ? T.dCard : T.lCard,
        borderColor: isDark ? T.dBorder : T.lBorder,
      }}
    >
      {/* Board header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold"
          style={{ color: isDark ? T.dMuted : T.lMuted, fontFamily: "'Clash Display', sans-serif" }}
        >
          Board {pairing.boardNumber}
        </span>
        <div className="flex items-center gap-1.5">
          {isFallback && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
              style={{
                color: T.amber,
                borderColor: `${T.amber}40`,
                background: `${T.amber}10`,
              }}
            >
              Rating fallback
            </span>
          )}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${accent}18`, color: accent }}
          >
            {PAIRING_MODES[pairing.effectiveMode].label}
          </span>
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: "#FFFFFF", border: "1px solid #D1D5DB" }}
            />
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isDark ? T.dText : T.lText, fontFamily: "'Clash Display', sans-serif" }}
            >
              {white?.name ?? pairing.whiteId}
            </span>
            <span
              className="text-xs font-mono"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
            >
              {white?.elo ?? "—"}
            </span>
          </div>
        </div>
        <span className="text-xs font-bold" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          vs
        </span>
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span
              className="text-xs font-mono"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
            >
              {black?.elo ?? "—"}
            </span>
            <span
              className="text-sm font-semibold truncate"
              style={{ color: isDark ? T.dText : T.lText, fontFamily: "'Clash Display', sans-serif" }}
            >
              {black?.name ?? pairing.blackId}
            </span>
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: "#1A1A1A" }}
            />
          </div>
        </div>
      </div>

      {/* Explanation label */}
      <p
        className="text-xs"
        style={{ color: isDark ? T.dMuted : T.lMuted }}
      >
        {pairing.explanation.label}
      </p>

      {/* Chips */}
      {pairing.explanation.chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pairing.explanation.chips.map((chip) => (
            <span
              key={chip}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
              style={{
                color: isDark ? T.dText : T.lText,
                borderColor: isDark ? T.dBorder : T.lBorder,
                background: isDark ? "rgba(255,255,255,0.04)" : "#F0F4F0",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Confidence note */}
      {pairing.explanation.confidenceNote && (
        <div className="flex items-start gap-1.5">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: T.amber }} />
          <p className="text-[10px]" style={{ color: T.amber }}>
            {pairing.explanation.confidenceNote}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Organizer Controls ───────────────────────────────────────────────────────

function OrganizerControls({
  settings,
  onChange,
  isDark,
}: {
  settings: PairingSettings;
  onChange: (s: PairingSettings) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const modeConfig = PAIRING_MODES[settings.mode];

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: isDark ? T.dBorder : T.lBorder }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
        style={{
          background: isDark ? T.dCard : T.lCard,
          color: isDark ? T.dText : T.lText,
          fontFamily: "'Clash Display', sans-serif",
        }}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4" style={{ color: isDark ? T.dMuted : T.lMuted }} />
          Advanced Controls
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: isDark ? T.dMuted : T.lMuted }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: isDark ? T.dMuted : T.lMuted }} />
        )}
      </button>

      {open && (
        <div
          className="px-4 py-4 space-y-4 border-t"
          style={{
            background: isDark ? "rgba(255,255,255,0.02)" : "#FAFCFA",
            borderColor: isDark ? T.dBorder : T.lBorder,
          }}
        >
          {/* Elo Tolerance */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-xs font-semibold"
                style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lMuted }}
              >
                Rating Tolerance Band
              </label>
              <span
                className="text-xs font-mono font-bold"
                style={{ color: isDark ? T.dText : T.lText }}
              >
                ±{settings.eloTolerance ?? modeConfig.eloTolerance}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={600}
              step={50}
              value={settings.eloTolerance ?? modeConfig.eloTolerance}
              onChange={(e) =>
                onChange({ ...settings, eloTolerance: Number(e.target.value) })
              }
              className="w-full accent-[#3D6B47]"
            />
            <p className="text-[10px] mt-1" style={{ color: isDark ? T.dMuted : T.lMuted }}>
              Maximum Elo gap allowed before a pairing is rejected.
            </p>
          </div>

          {/* Style Influence */}
          {settings.mode !== "balanced" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="text-xs font-semibold"
                  style={{ color: isDark ? "rgba(255,255,255,0.55)" : T.lMuted }}
                >
                  Style Influence
                </label>
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: isDark ? T.dText : T.lText }}
                >
                  {Math.round((settings.styleInfluence ?? 1.0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.styleInfluence ?? 1.0}
                onChange={(e) =>
                  onChange({ ...settings, styleInfluence: Number(e.target.value) })
                }
                className="w-full accent-[#3D6B47]"
              />
              <p className="text-[10px] mt-1" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                How strongly style data influences pairings vs. rating alone.
              </p>
            </div>
          )}

          {/* Rematch Avoidance */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
                Avoid Rematches
              </p>
              <p className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                Penalise repeat pairings from earlier rounds.
              </p>
            </div>
            <button
              onClick={() =>
                onChange({ ...settings, avoidRematches: !settings.avoidRematches })
              }
              className="w-10 h-5 rounded-full transition-all duration-200 relative flex-shrink-0"
              style={{
                background: settings.avoidRematches ? T.green : isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB",
              }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                style={{ left: settings.avoidRematches ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
          </div>

          {/* Auto Fallback */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: isDark ? T.dText : T.lText }}>
                Auto-Fallback on Weak Data
              </p>
              <p className="text-[10px]" style={{ color: isDark ? T.dMuted : T.lMuted }}>
                Use rating-based pairing when style confidence is low.
              </p>
            </div>
            <button
              onClick={() =>
                onChange({
                  ...settings,
                  autoFallbackOnWeakData: !settings.autoFallbackOnWeakData,
                })
              }
              className="w-10 h-5 rounded-full transition-all duration-200 relative flex-shrink-0"
              style={{
                background: settings.autoFallbackOnWeakData
                  ? T.green
                  : isDark
                  ? "rgba(255,255,255,0.12)"
                  : "#D1D5DB",
              }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                style={{
                  left: settings.autoFallbackOnWeakData
                    ? "calc(100% - 18px)"
                    : "2px",
                }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pool Readiness Banner ────────────────────────────────────────────────────

function PoolReadinessBanner({
  players,
  mode,
  isDark,
}: {
  players: StylePairingPlayer[];
  mode: PairingMode;
  isDark: boolean;
}) {
  if (mode === "balanced") return null;
  const readiness = assessPoolReadiness(players);
  const meta = STYLE_PROFILE_STATUS_META[readiness.overallStatus];

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl border text-xs"
      style={{
        background: isDark ? `${meta.color}10` : `${meta.color}08`,
        borderColor: `${meta.color}30`,
      }}
    >
      <StatusIcon status={readiness.overallStatus} size={14} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </p>
        <p className="mt-0.5" style={{ color: isDark ? T.dMuted : T.lMuted }}>
          {readiness.readyPct}% of players have usable style data ({readiness.readyCount} ready,{" "}
          {readiness.limitedCount} limited, {readiness.fallbackCount} no data).
        </p>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface StyleAwarePairingsPanelProps {
  players: StylePairingPlayer[];
  isDark: boolean;
  onGeneratePairings?: (pairings: GeneratedPairing[], byePlayerId: string | null) => void;
}

export function StyleAwarePairingsPanel({
  players,
  isDark,
  onGeneratePairings,
}: StyleAwarePairingsPanelProps) {
  const [settings, setSettings] = useState<PairingSettings>({
    ...DEFAULT_PAIRING_SETTINGS,
    mode: "balanced",
  });
  const [previewPairings, setPreviewPairings] = useState<GeneratedPairing[] | null>(null);
  const [byePlayerId, setByePlayerId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);

  const activePlayers = players.filter((p) => p.elo > 0);

  const handleGenerate = () => {
    setGenerating(true);
    // Simulate a brief analysis delay for premium feel
    setTimeout(() => {
      const result = generateStyleAwarePairings(activePlayers, settings);
      setPreviewPairings(result.pairings);
      setByePlayerId(result.byePlayerId);
      setGenerating(false);
    }, 600);
  };

  const handleConfirm = () => {
    if (previewPairings && onGeneratePairings) {
      onGeneratePairings(previewPairings, byePlayerId);
      setPreviewPairings(null);
    }
  };

  const modeAccent = MODE_ACCENT[settings.mode];

  return (
    <div className="space-y-4">
      {/* Pro badge header */}
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4" style={{ color: "#D97706" }} />
        <span
          className="text-sm font-bold"
          style={{
            fontFamily: "'Clash Display', sans-serif",
            color: isDark ? T.dText : T.lText,
          }}
        >
          Style-Aware Pairings
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: "#D97706", color: "#fff" }}
        >
          Pro
        </span>
      </div>

      <p className="text-xs" style={{ color: isDark ? T.dMuted : T.lMuted }}>
        Combines player strength with recent play-style tendencies to create more
        engaging matchups. Designed for smarter club competition.
      </p>

      {/* Mode Selector */}
      <div className="space-y-2">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: isDark ? "rgba(255,255,255,0.45)" : T.lMuted }}
        >
          Pairing Mode
        </p>
        <div className="space-y-2">
          {(["balanced", "style_aware", "sharp"] as PairingMode[]).map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              selected={settings.mode === mode}
              onSelect={() =>
                setSettings((s) => ({ ...s, mode, eloTolerance: undefined, styleInfluence: undefined }))
              }
              isDark={isDark}
            />
          ))}
        </div>
      </div>

      {/* Pool Readiness */}
      <PoolReadinessBanner players={activePlayers} mode={settings.mode} isDark={isDark} />

      {/* Player Style Profiles */}
      {activePlayers.some((p) => p.styleProfile) && (
        <div>
          <button
            onClick={() => setShowProfiles((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold mb-2"
            style={{ color: isDark ? T.dMuted : T.lMuted }}
          >
            {showProfiles ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Player Style Profiles ({activePlayers.filter((p) => p.styleProfile).length} analysed)
          </button>
          {showProfiles && (
            <div className="flex flex-wrap gap-1.5">
              {activePlayers.map((p) => (
                <StyleProfileChip key={p.id} player={p} isDark={isDark} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Advanced Controls */}
      <OrganizerControls settings={settings} onChange={setSettings} isDark={isDark} />

      {/* Generate Button */}
      {!previewPairings && (
        <button
          onClick={handleGenerate}
          disabled={generating || activePlayers.length < 2}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
          style={{
            background: generating ? `${modeAccent}80` : modeAccent,
            color: "#fff",
            fontFamily: "'Clash Display', sans-serif",
            opacity: activePlayers.length < 2 ? 0.5 : 1,
            cursor: activePlayers.length < 2 ? "not-allowed" : "pointer",
          }}
        >
          {generating ? (
            <>
              <div
                className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
              />
              Analysing styles…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate {PAIRING_MODES[settings.mode].label}
            </>
          )}
        </button>
      )}

      {/* Pairing Preview */}
      {previewPairings && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: isDark ? "rgba(255,255,255,0.45)" : T.lMuted }}
            >
              Pairing Preview — {previewPairings.length} board{previewPairings.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setPreviewPairings(null)}
              className="text-xs"
              style={{ color: isDark ? T.dMuted : T.lMuted }}
            >
              Regenerate
            </button>
          </div>

          {byePlayerId && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
              style={{
                background: isDark ? "rgba(217,119,6,0.08)" : "#FFFBEB",
                borderColor: `${T.amber}40`,
                color: T.amber,
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <strong>
                  {players.find((p) => p.id === byePlayerId)?.name ?? byePlayerId}
                </strong>{" "}
                receives a bye this round (odd number of players).
              </span>
            </div>
          )}

          <div className="space-y-2">
            {previewPairings.map((p) => (
              <PairingPreviewRow
                key={`${p.whiteId}-${p.blackId}`}
                pairing={p}
                players={activePlayers}
                isDark={isDark}
                mode={settings.mode}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPreviewPairings(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200"
              style={{
                borderColor: isDark ? T.dBorder : T.lBorder,
                color: isDark ? T.dText : T.lText,
                background: "transparent",
              }}
            >
              Regenerate
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                background: T.green,
                color: "#fff",
                fontFamily: "'Clash Display', sans-serif",
              }}
            >
              Confirm Pairings
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StyleAwarePairingsPanel;
