/**
 * ClubBackgroundPicker — background selector for club pages.
 *
 * Renders a horizontal scroll grid of thumbnail cards. Selecting a template
 * calls onChange with the /manus-storage path. A "None" option resets to the
 * default micro-grid pattern. The special "__silk__" value enables the Silk
 * animated WebGL background.
 */
import React, { useCallback } from "react";
import { Check, X, Sparkles } from "lucide-react";
import Silk from "./Silk";
import { GreenWaves } from "./GreenWaves";
import { NeonNebula } from "./ui/neon-nebula";

/** Sentinel value stored in club.backgroundImage to indicate the Silk animated background */
export const SILK_BG_VALUE = "__silk__";

/** Sentinel value stored in club.backgroundImage to indicate the Neon Nebula animated background */
export const NEON_NEBULA_BG_VALUE = "__neon_nebula__";

/** Sentinel value stored in club.backgroundImage to indicate the Green Waves animated background */
export const GREEN_WAVES_BG_VALUE = "__green_waves__";

/** Default Silk settings */
export const SILK_DEFAULTS = {
  speed: 5,
  color: "#1a4d2e",
  noise: 1.5,
} as const;

export interface SilkSettings {
  speed: number;
  color: string;
  noise: number;
}

/** Named Silk themes — quick full-setting presets */
export const SILK_THEMES: Array<{
  id: string;
  label: string;
  emoji: string;
  settings: SilkSettings;
  /** CSS gradient used for the theme card preview thumbnail */
  gradient: string;
}> = [
  {
    id: "forest",
    label: "Forest",
    emoji: "🌲",
    settings: { speed: 4, color: "#1a4d2e", noise: 1.4 },
    gradient: "linear-gradient(135deg, #0a2e14 0%, #1a4d2e 50%, #0d3320 100%)",
  },
  {
    id: "ocean",
    label: "Ocean",
    emoji: "🌊",
    settings: { speed: 6, color: "#0d2b4d", noise: 2.0 },
    gradient: "linear-gradient(135deg, #061a30 0%, #0d2b4d 50%, #0a3a5c 100%)",
  },
  {
    id: "lava",
    label: "Lava",
    emoji: "🌋",
    settings: { speed: 8, color: "#4d1a0a", noise: 2.8 },
    gradient: "linear-gradient(135deg, #2a0800 0%, #4d1a0a 40%, #7a2200 100%)",
  },
  {
    id: "void",
    label: "Void",
    emoji: "🌌",
    settings: { speed: 3, color: "#0d0d1a", noise: 1.0 },
    gradient: "linear-gradient(135deg, #05050f 0%, #0d0d1a 50%, #12102a 100%)",
  },
  {
    id: "aurora",
    label: "Aurora",
    emoji: "✨",
    settings: { speed: 5, color: "#1a3d4d", noise: 1.8 },
    gradient: "linear-gradient(135deg, #0a2030 0%, #1a3d4d 40%, #0d4d3a 100%)",
  },
  {
    id: "amethyst",
    label: "Amethyst",
    emoji: "💜",
    settings: { speed: 5, color: "#2d1a4d", noise: 1.6 },
    gradient: "linear-gradient(135deg, #160a2a 0%, #2d1a4d 50%, #3d1060 100%)",
  },
  {
    id: "ember",
    label: "Ember",
    emoji: "🔥",
    settings: { speed: 10, color: "#4d2a0a", noise: 3.2 },
    gradient: "linear-gradient(135deg, #2a1000 0%, #4d2a0a 40%, #6b3800 100%)",
  },
  {
    id: "midnight",
    label: "Midnight",
    emoji: "🌙",
    settings: { speed: 2.5, color: "#0d1a2e", noise: 0.8 },
    gradient: "linear-gradient(135deg, #060d18 0%, #0d1a2e 50%, #101e38 100%)",
  },
];

/** Preset color swatches for Silk */
const SILK_COLOR_PRESETS = [
  { hex: "#1a4d2e", label: "Forest" },
  { hex: "#0d2137", label: "Deep Navy" },
  { hex: "#2d1a4d", label: "Violet" },
  { hex: "#4d1a1a", label: "Crimson" },
  { hex: "#1a3d4d", label: "Teal" },
  { hex: "#4d3d1a", label: "Amber" },
  { hex: "#1a1a1a", label: "Obsidian" },
  { hex: "#0a2a0a", label: "Deep Green" },
];

export interface BackgroundTemplate {
  id: string;
  label: string;
  path: string;
}

export const CLUB_BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  {
    id: "floating-board",
    label: "Floating Board",
    path: "/manus-storage/719a4794-06af-4479-a366-8836df058745_ef79895f.png",
  },
  {
    id: "ink-splash",
    label: "Ink Splash",
    path: "/manus-storage/ce30490c-4487-4d1d-810f-62abbe9324e9_68b08db6.png",
  },
  {
    id: "crimson-arena",
    label: "Crimson Arena",
    path: "/manus-storage/54abdfe5-4277-42cc-aa2c-ee5e604604cf_917b5e1d.png",
  },
  {
    id: "levitation",
    label: "Levitation",
    path: "/manus-storage/22d2cdca-1e2b-4322-83b3-193e2c6667cf_b7715d25.png",
  },
  {
    id: "time-kings",
    label: "Time & Kings",
    path: "/manus-storage/ChatGPTImageJul8,2026,06_55_27PM_5f2ba96c.png",
  },
];

interface ClubBackgroundPickerProps {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  accent?: string;
  /** Current Silk settings — used to populate the panel when Silk is active */
  silkSettings?: SilkSettings | null;
  /** Called when any Silk setting changes — parent should persist immediately */
  onSilkSettingsChange?: (settings: SilkSettings) => void;
}

export function ClubBackgroundPicker({
  value,
  onChange,
  accent = "#4CAF50",
  silkSettings,
  onSilkSettingsChange,
}: ClubBackgroundPickerProps) {
  const silkSelected = value === SILK_BG_VALUE;

  // Resolved live settings (fall back to defaults)
  const liveSpeed = silkSettings?.speed ?? SILK_DEFAULTS.speed;
  const liveColor = silkSettings?.color ?? SILK_DEFAULTS.color;
  const liveNoise = silkSettings?.noise ?? SILK_DEFAULTS.noise;

  const updateSilk = useCallback(
    (patch: Partial<SilkSettings>) => {
      onSilkSettingsChange?.({
        speed: liveSpeed,
        color: liveColor,
        noise: liveNoise,
        ...patch,
      });
    },
    [liveSpeed, liveColor, liveNoise, onSilkSettingsChange]
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
        Club Background
      </p>

      {/* Scrollable template grid */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {/* None option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            !value
              ? "border-[--accent] shadow-lg scale-[1.03]"
              : "border-white/10 hover:border-white/30"
          }`}
          style={{
            width: 120,
            height: 72,
            borderColor: !value ? accent : undefined,
          // @ts-expect-error -- CSS custom property not in CSSProperties type
              "--accent": accent,
          }}
          aria-label="No background — use default pattern"
          aria-pressed={!value}
        >
          {/* Micro-grid preview */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(118,255,136,0.07) 1px, transparent 1px),
                linear-gradient(90deg, rgba(118,255,136,0.07) 1px, transparent 1px)
              `,
              backgroundSize: "14px 14px",
              background: "linear-gradient(135deg, rgba(10,45,20,0.96), rgba(2,12,6,0.98))",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(rgba(118,255,136,0.07) 1px, transparent 1px),
                linear-gradient(90deg, rgba(118,255,136,0.07) 1px, transparent 1px)
              `,
              backgroundSize: "14px 14px",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">
              Default
            </span>
          </div>
          {!value && (
            <div
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: accent }}
            >
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </button>

        {/* ── Silk animated option ─────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => onChange(SILK_BG_VALUE)}
          className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            silkSelected
              ? "shadow-lg scale-[1.03]"
              : "border-white/10 hover:border-white/30"
          }`}
          style={{
            width: 120,
            height: 72,
            borderColor: silkSelected ? accent : undefined,
          }}
          aria-label="Silk animated background"
          aria-pressed={silkSelected}
        >
          {/* Live mini Silk preview — uses current settings */}
          <div className="absolute inset-0 pointer-events-none">
            <Silk
              speed={liveSpeed}
              scale={1}
              color={liveColor}
              noiseIntensity={liveNoise}
              rotation={0}
              className="w-full h-full"
            />
          </div>
          {/* Label scrim */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-white/90" />
            <span className="text-[9px] font-semibold text-white/90 tracking-wide">
              Silk
            </span>
          </div>
          {silkSelected && (
            <div
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: accent }}
            >
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </button>

        {/* ── Green Waves animated option ───────────────────────────────── */}
        {(() => {
          const greenWavesSelected = value === GREEN_WAVES_BG_VALUE;
          return (
            <button
              type="button"
              onClick={() => onChange(GREEN_WAVES_BG_VALUE)}
              className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                greenWavesSelected
                  ? "shadow-lg scale-[1.03]"
                  : "border-white/10 hover:border-white/30"
              }`}
              style={{
                width: 120,
                height: 72,
                borderColor: greenWavesSelected ? accent : undefined,
              }}
              aria-label="Green Waves animated background"
              aria-pressed={greenWavesSelected}
            >
              <div className="absolute inset-0 pointer-events-none">
                <GreenWaves className="w-full h-full" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-lime-200" />
                <span className="text-[9px] font-semibold text-white/90 tracking-wide">
                  Green Waves
                </span>
              </div>
              {greenWavesSelected && (
                <div
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: accent }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })()}

        {/* ── Neon Nebula animated option ─────────────────────────────── */}
        {(() => {
          const neonSelected = value === NEON_NEBULA_BG_VALUE;
          return (
            <button
              type="button"
              onClick={() => onChange(NEON_NEBULA_BG_VALUE)}
              className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                neonSelected
                  ? "shadow-lg scale-[1.03]"
                  : "border-white/10 hover:border-white/30"
              }`}
              style={{
                width: 120,
                height: 72,
                borderColor: neonSelected ? accent : undefined,
              }}
              aria-label="Neon Nebula animated background"
              aria-pressed={neonSelected}
            >
              {/* Live mini Neon Nebula preview */}
              <div className="absolute inset-0 pointer-events-none">
                <NeonNebula className="w-full h-full" />
              </div>
              {/* Label scrim */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-300" />
                <span className="text-[9px] font-semibold text-white/90 tracking-wide">
                  Neon Nebula
                </span>
              </div>
              {neonSelected && (
                <div
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: accent }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })()}

        {/* Template cards */}
        {CLUB_BACKGROUND_TEMPLATES.map((tpl) => {
          const selected = value === tpl.path;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.path)}
              className={`relative flex-shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                selected
                  ? "shadow-lg scale-[1.03]"
                  : "border-white/10 hover:border-white/30"
              }`}
              style={{
                width: 120,
                height: 72,
                borderColor: selected ? accent : undefined,
              }}
              aria-label={tpl.label}
              aria-pressed={selected}
            >
              <img
                src={tpl.path}
                alt={tpl.label}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              {/* Label scrim */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                <span className="text-[9px] font-semibold text-white/90 tracking-wide">
                  {tpl.label}
                </span>
              </div>
              {/* Selected checkmark */}
              {selected && (
                <div
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: accent }}
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Silk settings panel (shown only when Silk is selected) ──────── */}
      {silkSelected && onSilkSettingsChange && (
        <div
          className="rounded-2xl border p-4 space-y-4 mt-1"
          style={{
            background: "rgba(10,30,15,0.85)",
            borderColor: "rgba(118,255,136,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Header row */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
            <span className="text-xs font-bold tracking-wide text-white/80">
              Silk Settings
            </span>
            {/* Live preview strip */}
            <div className="ml-auto w-16 h-6 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
              <Silk
                speed={liveSpeed}
                scale={1}
                color={liveColor}
                noiseIntensity={liveNoise}
                rotation={0}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* ── Theme presets ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/55 tracking-wide uppercase block">
              Themes
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {SILK_THEMES.map((theme) => {
                const isActive =
                  liveColor.toLowerCase() === theme.settings.color.toLowerCase() &&
                  Math.abs(liveSpeed - theme.settings.speed) < 0.1 &&
                  Math.abs(liveNoise - theme.settings.noise) < 0.05;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onSilkSettingsChange(theme.settings)}
                    className="flex-shrink-0 flex flex-col items-center gap-1 focus:outline-none group"
                    aria-label={`Apply ${theme.label} theme`}
                    aria-pressed={isActive}
                  >
                    {/* Thumbnail */}
                    <div
                      className="w-14 h-9 rounded-lg border-2 transition-all duration-150 group-hover:scale-105 overflow-hidden relative"
                      style={{
                        background: theme.gradient,
                        borderColor: isActive ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.12)",
                        boxShadow: isActive ? `0 0 0 2px ${accent}` : "none",
                      }}
                    >
                      {/* Subtle shimmer lines to hint at silk motion */}
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          backgroundImage: "repeating-linear-gradient(120deg, transparent, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 9px)",
                        }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-base leading-none">
                        {theme.emoji}
                      </span>
                      {isActive && (
                        <div
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                          style={{ background: accent }}
                        >
                          <Check className="w-2 h-2 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-semibold text-white/45 tracking-wide">
                      {theme.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-white/55 tracking-wide uppercase">
                Speed
              </label>
              <span className="text-[11px] font-mono text-white/40 tabular-nums">
                {liveSpeed.toFixed(1)}
              </span>
            </div>
            <input
              aria-label="Speed"
              type="range"
              min={1}
              max={15}
              step={0.5}
              value={liveSpeed}
              onChange={(e) => updateSilk({ speed: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${accent} 0%, ${accent} ${((liveSpeed - 1) / 14) * 100}%, rgba(255,255,255,0.12) ${((liveSpeed - 1) / 14) * 100}%, rgba(255,255,255,0.12) 100%)`,
                accentColor: accent,
              }}
            />
            <div className="flex justify-between text-[9px] text-white/25">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>

          {/* Noise intensity slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-white/55 tracking-wide uppercase">
                Noise Intensity
              </label>
              <span className="text-[11px] font-mono text-white/40 tabular-nums">
                {liveNoise.toFixed(1)}
              </span>
            </div>
            <input
              aria-label="Noise Intensity"
              type="range"
              min={0.2}
              max={4}
              step={0.1}
              value={liveNoise}
              onChange={(e) => updateSilk({ noise: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${accent} 0%, ${accent} ${((liveNoise - 0.2) / 3.8) * 100}%, rgba(255,255,255,0.12) ${((liveNoise - 0.2) / 3.8) * 100}%, rgba(255,255,255,0.12) 100%)`,
                accentColor: accent,
              }}
            />
            <div className="flex justify-between text-[9px] text-white/25">
              <span>Subtle</span>
              <span>Intense</span>
            </div>
          </div>

          {/* Color presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-white/55 tracking-wide uppercase block">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {SILK_COLOR_PRESETS.map(({ hex, label }) => {
                const isSelected = liveColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    title={label}
                    onClick={() => updateSilk({ color: hex })}
                    className="w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{
                      background: hex,
                      borderColor: isSelected ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.15)",
                      boxShadow: isSelected ? `0 0 0 2px ${accent}` : "none",
                    }}
                    aria-label={label}
                    aria-pressed={isSelected}
                  />
                );
              })}
              {/* Custom color input */}
              <label
                className="w-7 h-7 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors relative overflow-hidden"
                title="Custom color"
              >
                <span className="text-[8px] text-white/40 font-bold select-none">+</span>
                <input
                  type="color"
                  value={liveColor}
                  onChange={(e) => updateSilk({ color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-label="Custom color"
                />
              </label>
            </div>
          </div>

          {/* Reset to defaults */}
          <button
            type="button"
            onClick={() =>
              onSilkSettingsChange({
                speed: SILK_DEFAULTS.speed,
                color: SILK_DEFAULTS.color,
                noise: SILK_DEFAULTS.noise,
              })
            }
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Reset to defaults
          </button>
        </div>
      )}

      {/* Clear button when a template is active */}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Remove background
        </button>
      )}
    </div>
  );
}
