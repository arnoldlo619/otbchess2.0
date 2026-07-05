/**
 * SocialAssetGenerator
 *
 * Canvas-based social media asset generator for tournament recaps.
 * Generates shareable images (1080×1080 for Instagram, 1200×630 for Twitter/OG,
 * 1080×1920 for Stories) with champion cards, section standings, and highlights.
 *
 * Features:
 * - 8 built-in themes (Dark Forest, Midnight Blue, Royal Purple, Crimson, Gold,
 *   Slate, Light Clean, Neon)
 * - Custom gradient editor (two color stops + direction)
 * - Accent color picker
 * - Pattern overlay toggle (chess board / dots / none)
 * - Live canvas preview — re-renders on every theme change
 * - Download PNG + Web Share API
 * - Caption generator with copy-to-clipboard
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Download, Share2, Instagram, Twitter, Copy, Check,
  ChevronDown, ChevronUp, Palette, Sliders,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChampionData {
  playerName: string;
  rating: number;
  sectionName: string;
  finalScore: string;
  badges: string[];
  prizeWon?: string;
}

export interface AssetConfig {
  tournamentName: string;
  clubName?: string;
  eventDate?: string;
  venue?: string;
  champions: ChampionData[];
  playerCount?: number;
  format?: string;
  timeControl?: string;
  sponsorNote?: string;
}

type AssetFormat = "instagram" | "twitter" | "story";
type PatternType = "chess" | "dots" | "lines" | "none";
type GradientDirection = "vertical" | "diagonal" | "radial" | "horizontal";

export interface CanvasTheme {
  id: string;
  label: string;
  /** Three gradient stops for the background */
  bgStops: [string, string, string];
  /** Horizontal accent bar gradient */
  accentStart: string;
  accentEnd: string;
  /** Card fill / border tint */
  cardFill: string;
  cardBorder: string;
  /** Text colors */
  titleColor: string;
  subtitleColor: string;
  labelColor: string;
  /** Branding accent */
  brandColor: string;
  /** Pattern overlay */
  pattern: PatternType;
  gradientDir: GradientDirection;
}

// ─── Built-in Themes ─────────────────────────────────────────────────────────

export const BUILT_IN_THEMES: CanvasTheme[] = [
  {
    id: "dark_forest",
    label: "Dark Forest",
    bgStops: ["#0d1f12", "#142a18", "#0a1a0e"],
    accentStart: "#4CAF50",
    accentEnd: "#2E7D32",
    cardFill: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(76,175,80,0.22)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#4CAF50",
    pattern: "chess",
    gradientDir: "vertical",
  },
  {
    id: "midnight_blue",
    label: "Midnight Blue",
    bgStops: ["#0a0f1e", "#111827", "#070d1a"],
    accentStart: "#3B82F6",
    accentEnd: "#1D4ED8",
    cardFill: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(59,130,246,0.22)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#60A5FA",
    pattern: "dots",
    gradientDir: "diagonal",
  },
  {
    id: "royal_purple",
    label: "Royal Purple",
    bgStops: ["#1a0a2e", "#2d1b4e", "#120820"],
    accentStart: "#A855F7",
    accentEnd: "#7C3AED",
    cardFill: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(168,85,247,0.25)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#C084FC",
    pattern: "chess",
    gradientDir: "diagonal",
  },
  {
    id: "crimson",
    label: "Crimson",
    bgStops: ["#1a0808", "#2d1010", "#120505"],
    accentStart: "#EF4444",
    accentEnd: "#B91C1C",
    cardFill: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(239,68,68,0.22)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#F87171",
    pattern: "none",
    gradientDir: "vertical",
  },
  {
    id: "gold",
    label: "Gold",
    bgStops: ["#1a1200", "#2a1e00", "#0f0b00"],
    accentStart: "#F59E0B",
    accentEnd: "#D97706",
    cardFill: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(245,158,11,0.25)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#FCD34D",
    pattern: "chess",
    gradientDir: "radial",
  },
  {
    id: "slate",
    label: "Slate",
    bgStops: ["#0f172a", "#1e293b", "#0a1020"],
    accentStart: "#64748B",
    accentEnd: "#334155",
    cardFill: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(100,116,139,0.22)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#94A3B8",
    pattern: "lines",
    gradientDir: "horizontal",
  },
  {
    id: "light_clean",
    label: "Light Clean",
    bgStops: ["#f8fafc", "#f1f5f9", "#e2e8f0"],
    accentStart: "#4CAF50",
    accentEnd: "#2E7D32",
    cardFill: "rgba(0,0,0,0.03)",
    cardBorder: "rgba(76,175,80,0.20)",
    titleColor: "#0f172a",
    subtitleColor: "rgba(15,23,42,0.55)",
    labelColor: "rgba(15,23,42,0.40)",
    brandColor: "#16a34a",
    pattern: "none",
    gradientDir: "vertical",
  },
  {
    id: "neon",
    label: "Neon",
    bgStops: ["#050510", "#0a0a20", "#030308"],
    accentStart: "#00ff88",
    accentEnd: "#00cc6a",
    cardFill: "rgba(0,255,136,0.04)",
    cardBorder: "rgba(0,255,136,0.18)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.50)",
    labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#00ff88",
    pattern: "dots",
    gradientDir: "diagonal",
  },
];

// ─── Format Sizes ─────────────────────────────────────────────────────────────

const FORMAT_SIZES: Record<AssetFormat, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1080, label: "Instagram Post (1:1)" },
  twitter:   { width: 1200, height: 630,  label: "Twitter/OG (1.91:1)" },
  story:     { width: 1080, height: 1920, label: "Story (9:16)" },
};

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: CanvasTheme,
  W: number,
  H: number
) {
  const [s0, s1, s2] = theme.bgStops;

  if (theme.gradientDir === "radial") {
    const rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    rg.addColorStop(0, s1);
    rg.addColorStop(0.6, s0);
    rg.addColorStop(1, s2);
    ctx.fillStyle = rg;
  } else {
    const [x0, y0, x1, y1] =
      theme.gradientDir === "horizontal"  ? [0, 0, W, 0] :
      theme.gradientDir === "diagonal"    ? [0, 0, W, H] :
      /* vertical */                        [0, 0, 0, H];
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0,   s0);
    lg.addColorStop(0.5, s1);
    lg.addColorStop(1,   s2);
    ctx.fillStyle = lg;
  }
  ctx.fillRect(0, 0, W, H);
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  theme: CanvasTheme,
  W: number,
  H: number,
  scale: number
) {
  if (theme.pattern === "none") return;

  const isLight = theme.bgStops[0].startsWith("#f") || theme.bgStops[0].startsWith("#e");
  const patternColor = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";

  ctx.save();
  ctx.globalAlpha = 1;

  if (theme.pattern === "chess") {
    const sz = 40 * scale;
    ctx.fillStyle = patternColor;
    for (let y = 0; y < H; y += sz) {
      for (let x = 0; x < W; x += sz) {
        if ((Math.floor(x / sz) + Math.floor(y / sz)) % 2 === 0) {
          ctx.fillRect(x, y, sz, sz);
        }
      }
    }
  } else if (theme.pattern === "dots") {
    const spacing = 36 * scale;
    const r = 2 * scale;
    ctx.fillStyle = patternColor;
    for (let y = spacing / 2; y < H; y += spacing) {
      for (let x = spacing / 2; x < W; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (theme.pattern === "lines") {
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 1 * scale;
    const spacing = 30 * scale;
    for (let x = 0; x < W + H; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - H, H);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawChampionCard(
  ctx: CanvasRenderingContext2D,
  config: AssetConfig,
  format: AssetFormat,
  theme: CanvasTheme
) {
  const { width, height } = FORMAT_SIZES[format];
  const scale = window.devicePixelRatio || 1;
  const W = width * scale;
  const H = height * scale;

  // ── Background ──
  drawBackground(ctx, theme, W, H);
  drawPattern(ctx, theme, W, H, scale);

  // ── Accent bar ──
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, theme.accentStart);
  accentGrad.addColorStop(1, theme.accentEnd);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 6 * scale);

  // ── Title ──
  const padding = 60 * scale;
  const titleY = format === "story" ? 180 * scale : 100 * scale;

  ctx.font = `bold ${(format === "story" ? 48 : 40) * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.titleColor;
  ctx.textAlign = "center";
  ctx.fillText(config.tournamentName, W / 2, titleY);

  // ── Subtitle ──
  const subtitleParts: string[] = [];
  if (config.eventDate) subtitleParts.push(config.eventDate);
  if (config.venue) subtitleParts.push(config.venue);
  if (subtitleParts.length > 0) {
    ctx.font = `${18 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.subtitleColor;
    ctx.fillText(subtitleParts.join(" • "), W / 2, titleY + 40 * scale);
  }

  // ── Champions ──
  const champStartY = titleY + (format === "story" ? 120 : 100) * scale;
  const champSpacing = format === "story" ? 200 : format === "instagram" ? 180 : 120;
  const maxChamps = format === "twitter" ? 3 : format === "instagram" ? 4 : 6;
  const visibleChamps = config.champions.slice(0, maxChamps);

  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.labelColor;
  ctx.textAlign = "center";
  ctx.fillText("CHAMPIONS", W / 2, champStartY - 20 * scale);

  visibleChamps.forEach((champ, i) => {
    const cardY = champStartY + i * champSpacing * scale;
    const cardX = padding;
    const cardW = (width - 120) * scale;
    const cardH = (champSpacing - 20) * scale;

    // Card bg
    ctx.fillStyle = theme.cardFill;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16 * scale);
    ctx.fill();

    // Card border
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1 * scale;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16 * scale);
    ctx.stroke();

    // Trophy circle
    const iconX = cardX + 30 * scale;
    const iconY = cardY + cardH / 2;
    const rgb = hexToRgb(theme.accentStart);
    ctx.beginPath();
    ctx.arc(iconX, iconY, 20 * scale, 0, Math.PI * 2);
    ctx.fillStyle = i === 0
      ? "rgba(255,193,7,0.15)"
      : rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)` : "rgba(76,175,80,0.12)";
    ctx.fill();
    ctx.font = `${18 * scale}px -apple-system`;
    ctx.fillStyle = i === 0 ? "#FFC107" : theme.accentStart;
    ctx.textAlign = "center";
    ctx.fillText("🏆", iconX, iconY + 6 * scale);

    // Player name
    ctx.textAlign = "left";
    ctx.font = `bold ${22 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.titleColor;
    ctx.fillText(champ.playerName, iconX + 40 * scale, cardY + 35 * scale);

    // Section + score
    ctx.font = `${15 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.subtitleColor;
    ctx.fillText(
      `${champ.sectionName} • ${champ.finalScore} • ${champ.rating}`,
      iconX + 40 * scale,
      cardY + 60 * scale
    );

    // Prize
    if (champ.prizeWon) {
      ctx.textAlign = "right";
      ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = theme.brandColor;
      ctx.fillText(champ.prizeWon, cardX + cardW - 20 * scale, cardY + 45 * scale);
    }

    // Badges
    if (champ.badges.length > 0) {
      ctx.textAlign = "right";
      ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = theme.labelColor;
      const badgeText = champ.badges.slice(0, 3).map(b => b.replace(/_/g, " ")).join(" • ");
      ctx.fillText(badgeText, cardX + cardW - 20 * scale, cardY + cardH - 20 * scale);
    }
  });

  // ── Footer ──
  const footerY = (height - 60) * scale;
  ctx.textAlign = "center";
  ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.subtitleColor;

  const footerParts: string[] = [];
  if (config.clubName) footerParts.push(config.clubName);
  if (config.playerCount) footerParts.push(`${config.playerCount} players`);
  if (config.format) footerParts.push(config.format);
  if (config.timeControl) footerParts.push(config.timeControl);
  if (footerParts.length > 0) ctx.fillText(footerParts.join(" • "), W / 2, footerY);

  // Branding
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.brandColor;
  ctx.fillText("ChessOTB.club", W / 2, footerY + 25 * scale);

  // Sponsor
  if (config.sponsorNote) {
    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.labelColor;
    ctx.fillText(config.sponsorNote, W / 2, footerY - 25 * scale);
  }
}

// ─── Caption Generator ────────────────────────────────────────────────────────

export function generateCaption(config: AssetConfig): string {
  const lines: string[] = [];
  lines.push(`🏆 ${config.tournamentName} — Results`);
  lines.push("");

  if (config.eventDate || config.venue) {
    const parts = [config.eventDate, config.venue].filter(Boolean);
    lines.push(`📍 ${parts.join(" • ")}`);
    lines.push("");
  }

  lines.push("🥇 Champions:");
  config.champions.forEach((c) => {
    const prizeStr = c.prizeWon ? ` (${c.prizeWon})` : "";
    lines.push(`  ${c.sectionName}: ${c.playerName} — ${c.finalScore}${prizeStr}`);
  });
  lines.push("");

  const stats: string[] = [];
  if (config.playerCount) stats.push(`${config.playerCount} players`);
  if (config.format) stats.push(config.format);
  if (config.timeControl) stats.push(config.timeControl);
  if (stats.length > 0) lines.push(`📊 ${stats.join(" • ")}`);

  lines.push("");
  lines.push("#OTBChess #ChessOTB #ChessTournament #OverTheBoard");
  if (config.clubName) lines.push(`#${config.clubName.replace(/\s+/g, "")}`);

  return lines.join("\n");
}

// ─── Theme Swatch ─────────────────────────────────────────────────────────────

function ThemeSwatch({
  theme,
  active,
  onClick,
}: {
  theme: CanvasTheme;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={theme.label}
      className={`relative w-10 h-10 rounded-xl overflow-hidden transition-all flex-shrink-0 ${
        active ? "scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
      }`}
      style={active ? { outline: `2px solid ${theme.accentStart}`, outlineOffset: "2px" } : {}}
    >
      {/* Gradient preview */}
      <div
        className="absolute inset-0"
        style={{
          background:
            theme.gradientDir === "radial"
              ? `radial-gradient(circle, ${theme.bgStops[1]}, ${theme.bgStops[0]})`
              : theme.gradientDir === "horizontal"
              ? `linear-gradient(to right, ${theme.bgStops[0]}, ${theme.bgStops[1]})`
              : theme.gradientDir === "diagonal"
              ? `linear-gradient(135deg, ${theme.bgStops[0]}, ${theme.bgStops[1]})`
              : `linear-gradient(to bottom, ${theme.bgStops[0]}, ${theme.bgStops[1]})`,
        }}
      />
      {/* Accent stripe */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5"
        style={{ background: `linear-gradient(to right, ${theme.accentStart}, ${theme.accentEnd})` }}
      />
      {active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check className="w-4 h-4 text-white drop-shadow" />
        </div>
      )}
    </button>
  );
}

// ─── Custom Color Row ─────────────────────────────────────────────────────────

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-white/50 flex-1 truncate">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-md border border-white/20 flex-shrink-0"
          style={{ background: value }}
        />
        <input
          type="color"
          value={value.startsWith("#") ? value : "#4CAF50"}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
          style={{ appearance: "none" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 text-[11px] font-mono bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70 focus:outline-none focus:border-white/30"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SocialAssetGenerator({ config }: { config: AssetConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<AssetFormat>("instagram");
  const [captionCopied, setCaptionCopied] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Theme state
  const [selectedThemeId, setSelectedThemeId] = useState<string>("dark_forest");
  const [customTheme, setCustomTheme] = useState<CanvasTheme | null>(null);

  // Custom editor state (mirrors active theme, editable)
  const [editBg0, setEditBg0] = useState(BUILT_IN_THEMES[0].bgStops[0]);
  const [editBg1, setEditBg1] = useState(BUILT_IN_THEMES[0].bgStops[1]);
  const [editBg2, setEditBg2] = useState(BUILT_IN_THEMES[0].bgStops[2]);
  const [editAccentStart, setEditAccentStart] = useState(BUILT_IN_THEMES[0].accentStart);
  const [editAccentEnd, setEditAccentEnd] = useState(BUILT_IN_THEMES[0].accentEnd);
  const [editBrandColor, setEditBrandColor] = useState(BUILT_IN_THEMES[0].brandColor);
  const [editPattern, setEditPattern] = useState<PatternType>(BUILT_IN_THEMES[0].pattern);
  const [editGradDir, setEditGradDir] = useState<GradientDirection>(BUILT_IN_THEMES[0].gradientDir);

  // Derive the active theme (built-in or custom)
  const activeTheme: CanvasTheme = customTheme ?? (BUILT_IN_THEMES.find(t => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0]);

  // Sync editor fields when a built-in theme is selected
  const applyBuiltIn = useCallback((theme: CanvasTheme) => {
    setSelectedThemeId(theme.id);
    setCustomTheme(null);
    setEditBg0(theme.bgStops[0]);
    setEditBg1(theme.bgStops[1]);
    setEditBg2(theme.bgStops[2]);
    setEditAccentStart(theme.accentStart);
    setEditAccentEnd(theme.accentEnd);
    setEditBrandColor(theme.brandColor);
    setEditPattern(theme.pattern);
    setEditGradDir(theme.gradientDir);
  }, []);

  // Build a custom theme from editor fields
  const buildCustomTheme = useCallback((): CanvasTheme => {
    const base = BUILT_IN_THEMES.find(t => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0];
    const isLight = editBg0.startsWith("#f") || editBg0.startsWith("#e");
    return {
      ...base,
      id: "custom",
      label: "Custom",
      bgStops: [editBg0, editBg1, editBg2],
      accentStart: editAccentStart,
      accentEnd: editAccentEnd,
      brandColor: editBrandColor,
      pattern: editPattern,
      gradientDir: editGradDir,
      titleColor: isLight ? "#0f172a" : "#ffffff",
      subtitleColor: isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.50)",
      labelColor: isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)",
      cardFill: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
      cardBorder: (() => {
        const rgb = hexToRgb(editAccentStart);
        return rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)` : "rgba(76,175,80,0.22)";
      })(),
    };
  }, [editBg0, editBg1, editBg2, editAccentStart, editAccentEnd, editBrandColor, editPattern, editGradDir, selectedThemeId]);

  // Render canvas whenever theme or format changes
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = FORMAT_SIZES[format];
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawChampionCard(ctx, config, format, activeTheme);
  }, [config, format, activeTheme]);

  // Auto-render on mount and whenever theme/format changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // When any custom editor field changes, build + apply custom theme
  useEffect(() => {
    if (!showCustomizer) return;
    setCustomTheme(buildCustomTheme());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editBg0, editBg1, editBg2, editAccentStart, editAccentEnd, editBrandColor, editPattern, editGradDir]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${config.tournamentName.replace(/\s+/g, "-").toLowerCase()}-${format}-${activeTheme.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [config.tournamentName, format, activeTheme.id]);

  const shareImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      if (navigator.share && navigator.canShare?.({ files: [] })) {
        const file = new File([blob], `${config.tournamentName}-recap.png`, { type: "image/png" });
        await navigator.share({
          title: `${config.tournamentName} Results`,
          text: generateCaption(config),
          files: [file],
        });
      } else {
        downloadImage();
      }
    } catch {
      // cancelled
    }
  }, [config, downloadImage]);

  const copyCaption = useCallback(() => {
    navigator.clipboard.writeText(generateCaption(config)).then(() => {
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    });
  }, [config]);

  return (
    <div className="space-y-5">

      {/* ── Format Selector ── */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FORMAT_SIZES) as AssetFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              format === f
                ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30"
                : "bg-white/6 text-white/50 hover:text-white border border-transparent"
            }`}
          >
            {f === "instagram" && <Instagram className="w-3 h-3" />}
            {f === "twitter" && <Twitter className="w-3 h-3" />}
            {f === "story" && <span className="text-[10px]">📱</span>}
            {FORMAT_SIZES[f].label}
          </button>
        ))}
      </div>

      {/* ── Theme Picker ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Theme</span>
        </div>

        {/* Swatch row */}
        <div className="flex gap-2 flex-wrap">
          {BUILT_IN_THEMES.map((t) => (
            <ThemeSwatch
              key={t.id}
              theme={t}
              active={selectedThemeId === t.id && !customTheme}
              onClick={() => applyBuiltIn(t)}
            />
          ))}
        </div>

        {/* Theme label */}
        <p className="text-[11px] text-white/40">
          {customTheme ? "Custom theme" : `${activeTheme.label} — ${activeTheme.gradientDir} gradient, ${activeTheme.pattern === "none" ? "no pattern" : activeTheme.pattern + " pattern"}`}
        </p>
      </div>

      {/* ── Customizer Toggle ── */}
      <button
        onClick={() => setShowCustomizer((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white/90 bg-white/4 hover:bg-white/8 border border-white/8 transition-colors w-full"
      >
        <Sliders className="w-3.5 h-3.5" />
        Customize Colors &amp; Style
        {showCustomizer ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {/* ── Custom Editor Panel ── */}
      {showCustomizer && (
        <div
          className="rounded-2xl border border-white/8 p-4 space-y-4"
          style={{ background: "oklch(0.14 0.02 145)" }}
        >
          {/* Background gradient stops */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Background Gradient</p>
            <ColorRow label="Stop 1 (top)" value={editBg0} onChange={setEditBg0} />
            <ColorRow label="Stop 2 (mid)" value={editBg1} onChange={setEditBg1} />
            <ColorRow label="Stop 3 (bottom)" value={editBg2} onChange={setEditBg2} />
          </div>

          {/* Gradient direction */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Gradient Direction</p>
            <div className="flex gap-2 flex-wrap">
              {(["vertical", "horizontal", "diagonal", "radial"] as GradientDirection[]).map((d) => (
                <button
                  key={d}
                  onClick={() => { setEditGradDir(d); setCustomTheme(buildCustomTheme()); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${
                    editGradDir === d
                      ? "bg-white/12 text-white border border-white/20"
                      : "text-white/40 hover:text-white/70 border border-transparent"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Accent colors */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Accent Bar &amp; Brand</p>
            <ColorRow label="Accent start" value={editAccentStart} onChange={setEditAccentStart} />
            <ColorRow label="Accent end" value={editAccentEnd} onChange={setEditAccentEnd} />
            <ColorRow label="Brand / prize color" value={editBrandColor} onChange={setEditBrandColor} />
          </div>

          {/* Pattern overlay */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Background Pattern</p>
            <div className="flex gap-2 flex-wrap">
              {(["chess", "dots", "lines", "none"] as PatternType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setEditPattern(p); setCustomTheme(buildCustomTheme()); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${
                    editPattern === p
                      ? "bg-white/12 text-white border border-white/20"
                      : "text-white/40 hover:text-white/70 border border-transparent"
                  }`}
                >
                  {p === "none" ? "None" : p}
                </button>
              ))}
            </div>
          </div>

          {/* Reset to built-in */}
          {customTheme && (
            <button
              onClick={() => {
                const base = BUILT_IN_THEMES.find(t => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0];
                applyBuiltIn(base);
              }}
              className="text-[11px] text-white/40 hover:text-white/70 underline transition-colors"
            >
              Reset to {BUILT_IN_THEMES.find(t => t.id === selectedThemeId)?.label ?? "default"}
            </button>
          )}
        </div>
      )}

      {/* ── Live Canvas Preview ── */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
          style={{ maxWidth: FORMAT_SIZES[format].width }}
        />
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={downloadImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/80 text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PNG
        </button>
        <button
          onClick={shareImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/80 text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* ── Caption ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Caption</h3>
          <button
            onClick={copyCaption}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
          >
            {captionCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {captionCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="text-xs text-white/60 whitespace-pre-wrap bg-white/3 rounded-xl p-4 border border-white/5 font-mono leading-relaxed max-h-48 overflow-y-auto">
          {generateCaption(config)}
        </pre>
      </div>
    </div>
  );
}
