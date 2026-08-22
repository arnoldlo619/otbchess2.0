/**
 * SocialAssetGenerator
 *
 * Canvas-based social media asset generator for tournament recaps.
 * Generates shareable images (1080×1080 for Instagram, 1200×630 for Twitter/OG,
 * 1080×1920 for Stories) with champion cards, section standings, and highlights.
 *
 * Features:
 * - 8 built-in themes with gradient/pattern backgrounds
 * - Custom gradient editor (3 stops, direction, accent, brand color, pattern)
 * - Custom background image upload (cover / contain / tile, opacity 0–100%)
 * - Custom logo upload (size slider, 5-position grid: TL/TR/BL/BR/center)
 * - Drag-and-drop for both upload zones
 * - Live canvas preview — re-renders on every change
 * - Download PNG + Web Share API
 * - Caption generator with copy-to-clipboard
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Download, Share2, Instagram, Twitter, Copy, Check,
  ChevronDown, ChevronUp, Palette, Sliders, ImageIcon, X, RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
type BgImageFit = "cover" | "contain" | "tile";

export interface BgImageFilters {
  blur: number;        // 0–20 px
  grayscale: number;  // 0–100 %
  sepia: number;      // 0–100 %
  brightness: number; // 50–150 %
  contrast: number;   // 50–150 %
}

export const DEFAULT_FILTERS: BgImageFilters = {
  blur: 0, grayscale: 0, sepia: 0, brightness: 100, contrast: 100,
};

/** Compose a CSS/canvas filter string from a BgImageFilters object. */
export function buildFilterString(f: BgImageFilters): string {
  const parts: string[] = [];
  if (f.blur > 0)           parts.push(`blur(${f.blur}px)`);
  if (f.grayscale > 0)      parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia > 0)          parts.push(`sepia(${f.sepia}%)`);
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100)   parts.push(`contrast(${f.contrast}%)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}
export interface LogoPlacement {
  x: number; // normalized left position within preview/canvas (0–1)
  y: number; // normalized top position within preview/canvas (0–1)
}

export interface LogoBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_LOGO_PLACEMENT: LogoPlacement = { x: 0.75, y: 0.82 };
const LOGO_MARGIN_RATIO = 0.05;
const LOGO_RESIZE_HANDLE = 16;
const LOGO_MIN_SIZE = 0.5;
const LOGO_MAX_SIZE = 2.0;

export interface CanvasTheme {
  id: string;
  label: string;
  bgStops: [string, string, string];
  accentStart: string;
  accentEnd: string;
  cardFill: string;
  cardBorder: string;
  titleColor: string;
  subtitleColor: string;
  labelColor: string;
  brandColor: string;
  pattern: PatternType;
  gradientDir: GradientDirection;
}

// ─── Built-in Themes ──────────────────────────────────────────────────────────

export const BUILT_IN_THEMES: CanvasTheme[] = [
  {
    id: "dark_forest", label: "Dark Forest",
    bgStops: ["#0d1f12", "#142a18", "#0a1a0e"],
    accentStart: "#4CAF50", accentEnd: "#2E7D32",
    cardFill: "rgba(255,255,255,0.04)", cardBorder: "rgba(76,175,80,0.22)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#4CAF50", pattern: "chess", gradientDir: "vertical",
  },
  {
    id: "midnight_blue", label: "Midnight Blue",
    bgStops: ["#0a0f1e", "#111827", "#070d1a"],
    accentStart: "#3B82F6", accentEnd: "#1D4ED8",
    cardFill: "rgba(255,255,255,0.04)", cardBorder: "rgba(59,130,246,0.22)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#60A5FA", pattern: "dots", gradientDir: "diagonal",
  },
  {
    id: "royal_purple", label: "Royal Purple",
    bgStops: ["#1a0a2e", "#2d1b4e", "#120820"],
    accentStart: "#A855F7", accentEnd: "#7C3AED",
    cardFill: "rgba(255,255,255,0.05)", cardBorder: "rgba(168,85,247,0.25)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#C084FC", pattern: "chess", gradientDir: "diagonal",
  },
  {
    id: "crimson", label: "Crimson",
    bgStops: ["#1a0808", "#2d1010", "#120505"],
    accentStart: "#EF4444", accentEnd: "#B91C1C",
    cardFill: "rgba(255,255,255,0.04)", cardBorder: "rgba(239,68,68,0.22)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#F87171", pattern: "none", gradientDir: "vertical",
  },
  {
    id: "gold", label: "Gold",
    bgStops: ["#1a1200", "#2a1e00", "#0f0b00"],
    accentStart: "#F59E0B", accentEnd: "#D97706",
    cardFill: "rgba(255,255,255,0.04)", cardBorder: "rgba(245,158,11,0.25)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#FCD34D", pattern: "chess", gradientDir: "radial",
  },
  {
    id: "slate", label: "Slate",
    bgStops: ["#0f172a", "#1e293b", "#0a1020"],
    accentStart: "#64748B", accentEnd: "#334155",
    cardFill: "rgba(255,255,255,0.04)", cardBorder: "rgba(100,116,139,0.22)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#94A3B8", pattern: "lines", gradientDir: "horizontal",
  },
  {
    id: "light_clean", label: "Light Clean",
    bgStops: ["#f8fafc", "#f1f5f9", "#e2e8f0"],
    accentStart: "#4CAF50", accentEnd: "#2E7D32",
    cardFill: "rgba(0,0,0,0.03)", cardBorder: "rgba(76,175,80,0.20)",
    titleColor: "#0f172a", subtitleColor: "rgba(15,23,42,0.55)", labelColor: "rgba(15,23,42,0.40)",
    brandColor: "#16a34a", pattern: "none", gradientDir: "vertical",
  },
  {
    id: "neon", label: "Neon",
    bgStops: ["#050510", "#0a0a20", "#030308"],
    accentStart: "#00ff88", accentEnd: "#00cc6a",
    cardFill: "rgba(0,255,136,0.04)", cardBorder: "rgba(0,255,136,0.18)",
    titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.50)", labelColor: "rgba(255,255,255,0.35)",
    brandColor: "#00ff88", pattern: "dots", gradientDir: "diagonal",
  },
];

// ─── Format Sizes ─────────────────────────────────────────────────────────────

const FORMAT_SIZES: Record<AssetFormat, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1080, label: "Instagram Post (1:1)" },
  twitter:   { width: 1200, height: 630,  label: "Twitter/OG (1.91:1)" },
  story:     { width: 1080, height: 1920, label: "Story (9:16)" },
};

// ─── Canvas Helpers ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
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

function drawBackground(ctx: CanvasRenderingContext2D, theme: CanvasTheme, W: number, H: number) {
  const [s0, s1, s2] = theme.bgStops;
  if (theme.gradientDir === "radial") {
    const rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    rg.addColorStop(0, s1); rg.addColorStop(0.6, s0); rg.addColorStop(1, s2);
    ctx.fillStyle = rg;
  } else {
    const [x0, y0, x1, y1] =
      theme.gradientDir === "horizontal" ? [0, 0, W, 0] :
      theme.gradientDir === "diagonal"   ? [0, 0, W, H] :
                                           [0, 0, 0, H];
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, s0); lg.addColorStop(0.5, s1); lg.addColorStop(1, s2);
    ctx.fillStyle = lg;
  }
  ctx.fillRect(0, 0, W, H);
}

function drawPattern(ctx: CanvasRenderingContext2D, theme: CanvasTheme, W: number, H: number, scale: number) {
  if (theme.pattern === "none") return;
  const isLight = theme.bgStops[0].startsWith("#f") || theme.bgStops[0].startsWith("#e");
  const pc = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)";
  ctx.save();
  if (theme.pattern === "chess") {
    const sz = 40 * scale;
    ctx.fillStyle = pc;
    for (let y = 0; y < H; y += sz)
      for (let x = 0; x < W; x += sz)
        if ((Math.floor(x / sz) + Math.floor(y / sz)) % 2 === 0) ctx.fillRect(x, y, sz, sz);
  } else if (theme.pattern === "dots") {
    const sp = 36 * scale, r = 2 * scale;
    ctx.fillStyle = pc;
    for (let y = sp / 2; y < H; y += sp)
      for (let x = sp / 2; x < W; x += sp) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
  } else if (theme.pattern === "lines") {
    ctx.strokeStyle = pc; ctx.lineWidth = 1 * scale;
    const sp = 30 * scale;
    for (let x = 0; x < W + H; x += sp) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - H, H); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBgImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fit: BgImageFit,
  opacity: number,
  filters: BgImageFilters,
  W: number,
  H: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const filterStr = buildFilterString(filters);
  if (filterStr !== "none") ctx.filter = filterStr;
  if (fit === "cover") {
    const scale = Math.max(W / img.width, H / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
  } else if (fit === "contain") {
    const scale = Math.min(W / img.width, H / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
  } else {
    // tile
    const tw = img.width, th = img.height;
    for (let y = 0; y < H; y += th)
      for (let x = 0; x < W; x += tw)
        ctx.drawImage(img, x, y, tw, th);
  }
  ctx.restore();
}

export function clampLogoPlacement(placement: LogoPlacement, bounds: { width: number; height: number }): LogoPlacement {
  return {
    x: Math.min(Math.max(placement.x, LOGO_MARGIN_RATIO), 1 - bounds.width - LOGO_MARGIN_RATIO),
    y: Math.min(Math.max(placement.y, LOGO_MARGIN_RATIO), 1 - bounds.height - LOGO_MARGIN_RATIO),
  };
}

export function snapLogoPlacement(placement: LogoPlacement, bounds: { width: number; height: number }): LogoPlacement {
  const next = { ...placement };
  if (Math.abs(next.x - LOGO_MARGIN_RATIO) <= 0.03) next.x = LOGO_MARGIN_RATIO;
  if (Math.abs(next.y - LOGO_MARGIN_RATIO) <= 0.03) next.y = LOGO_MARGIN_RATIO;
  const rightTarget = 1 - bounds.width - LOGO_MARGIN_RATIO;
  const bottomTarget = 1 - bounds.height - LOGO_MARGIN_RATIO;
  if (Math.abs(next.x - rightTarget) <= 0.03) next.x = rightTarget;
  if (Math.abs(next.y - bottomTarget) <= 0.03) next.y = bottomTarget;
  return clampLogoPlacement(next, bounds);
}

export function getLogoBounds(
  img: HTMLImageElement,
  placement: LogoPlacement,
  sizePct: number,
  W: number,
  H: number
): LogoBounds {
  const maxW = W * 0.25 * sizePct;
  const maxH = H * 0.12 * sizePct;
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  const normalized = clampLogoPlacement(placement, { width: width / W, height: height / H });
  return {
    x: normalized.x * W,
    y: normalized.y * H,
    width,
    height,
  };
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  placement: LogoPlacement,
  sizePct: number,
  W: number,
  H: number
) {
  const bounds = getLogoBounds(img, placement, sizePct, W, H);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.restore();
}

// ─── Main Draw Function ───────────────────────────────────────────────────────

interface DrawExtras {
  bgImage?: HTMLImageElement | null;
  bgImageFit: BgImageFit;
  bgImageOpacity: number;  // 0–1
  bgFilters: BgImageFilters;
  logoImage?: HTMLImageElement | null;
  logoPlacement: LogoPlacement;
  logoSize: number;        // 0.5–2.0
}

function drawChampionCard(
  ctx: CanvasRenderingContext2D,
  config: AssetConfig,
  format: AssetFormat,
  theme: CanvasTheme,
  extras: DrawExtras
) {
  const { width, height } = FORMAT_SIZES[format];
  const scale = window.devicePixelRatio || 1;
  const W = width * scale, H = height * scale;

  // ── Background layer ──
  drawBackground(ctx, theme, W, H);

  // ── Custom background image ──
  if (extras.bgImage) {
    drawBgImage(ctx, extras.bgImage, extras.bgImageFit, extras.bgImageOpacity, extras.bgFilters, W, H);
    // Dark scrim so text stays readable
    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, "rgba(0,0,0,0.55)");
    scrim.addColorStop(1, "rgba(0,0,0,0.70)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Pattern (only when no bg image) ──
  if (!extras.bgImage) drawPattern(ctx, theme, W, H, scale);

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
  const subtitleParts = [config.eventDate, config.venue].filter(Boolean) as string[];
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

    ctx.fillStyle = theme.cardFill;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16 * scale);
    ctx.fill();

    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1 * scale;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16 * scale);
    ctx.stroke();

    const iconX = cardX + 30 * scale;
    const iconY = cardY + cardH / 2;
    const rgb = hexToRgb(theme.accentStart);
    ctx.beginPath();
    ctx.arc(iconX, iconY, 20 * scale, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "rgba(255,193,7,0.15)" : rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)` : "rgba(76,175,80,0.12)";
    ctx.fill();
    ctx.font = `${18 * scale}px -apple-system`;
    ctx.fillStyle = i === 0 ? "#FFC107" : theme.accentStart;
    ctx.textAlign = "center";
    ctx.fillText("🏆", iconX, iconY + 6 * scale);

    ctx.textAlign = "left";
    ctx.font = `bold ${22 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.titleColor;
    ctx.fillText(champ.playerName, iconX + 40 * scale, cardY + 35 * scale);

    ctx.font = `${15 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.subtitleColor;
    ctx.fillText(`${champ.sectionName} • ${champ.finalScore} • ${champ.rating}`, iconX + 40 * scale, cardY + 60 * scale);

    if (champ.prizeWon) {
      ctx.textAlign = "right";
      ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = theme.brandColor;
      ctx.fillText(champ.prizeWon, cardX + cardW - 20 * scale, cardY + 45 * scale);
    }
    if (champ.badges.length > 0) {
      ctx.textAlign = "right";
      ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = theme.labelColor;
      ctx.fillText(champ.badges.slice(0, 3).map(b => b.replace(/_/g, " ")).join(" • "), cardX + cardW - 20 * scale, cardY + cardH - 20 * scale);
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

  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = theme.brandColor;
  ctx.fillText("ChessOTB.club", W / 2, footerY + 25 * scale);

  if (config.sponsorNote) {
    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = theme.labelColor;
    ctx.fillText(config.sponsorNote, W / 2, footerY - 25 * scale);
  }

  // ── Logo (drawn last, on top) ──
  if (extras.logoImage) {
    drawLogo(ctx, extras.logoImage, extras.logoPlacement, extras.logoSize, W, H);
  }
}

// ─── Caption Generator ────────────────────────────────────────────────────────

export function generateCaption(config: AssetConfig): string {
  const lines: string[] = [];
  lines.push(`🏆 ${config.tournamentName} — Results`);
  lines.push("");
  if (config.eventDate || config.venue) {
    lines.push(`📍 ${[config.eventDate, config.venue].filter(Boolean).join(" • ")}`);
    lines.push("");
  }
  lines.push("🥇 Champions:");
  config.champions.forEach((c) => {
    lines.push(`  ${c.sectionName}: ${c.playerName} — ${c.finalScore}${c.prizeWon ? ` (${c.prizeWon})` : ""}`);
  });
  lines.push("");
  const stats = [
    config.playerCount ? `${config.playerCount} players` : null,
    config.format,
    config.timeControl,
  ].filter(Boolean) as string[];
  if (stats.length > 0) lines.push(`📊 ${stats.join(" • ")}`);
  lines.push("");
  lines.push("#OTBChess #ChessOTB #ChessTournament #OverTheBoard");
  if (config.clubName) lines.push(`#${config.clubName.replace(/\s+/g, "")}`);
  return lines.join("\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThemeSwatch({ theme, active, onClick }: { theme: CanvasTheme; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={theme.label}
      className={`relative w-10 h-10 rounded-xl overflow-hidden transition-all flex-shrink-0 ${
        active ? "scale-110" : "hover:scale-105 opacity-80 hover:opacity-100"
      }`}
      style={active ? { outline: `2px solid ${theme.accentStart}`, outlineOffset: "2px" } : {}}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            theme.gradientDir === "radial"      ? `radial-gradient(circle, ${theme.bgStops[1]}, ${theme.bgStops[0]})` :
            theme.gradientDir === "horizontal"  ? `linear-gradient(to right, ${theme.bgStops[0]}, ${theme.bgStops[1]})` :
            theme.gradientDir === "diagonal"    ? `linear-gradient(135deg, ${theme.bgStops[0]}, ${theme.bgStops[1]})` :
                                                  `linear-gradient(to bottom, ${theme.bgStops[0]}, ${theme.bgStops[1]})`,
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-1.5"
        style={{ background: `linear-gradient(to right, ${theme.accentStart}, ${theme.accentEnd})` }} />
      {active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check className="w-4 h-4 text-white drop-shadow" />
        </div>
      )}
    </button>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-white/50 flex-1 truncate">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md border border-white/20 flex-shrink-0" style={{ background: value }} />
        <input type="color" value={value.startsWith("#") ? value : "#4CAF50"} onChange={(e) => onChange(e.target.value)}
          aria-label="Theme color value"
          className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent p-0" style={{ appearance: "none" }} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          aria-label="Theme color hex code"
          className="w-20 text-[11px] font-mono bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70 focus:outline-none focus:border-white/30"
          spellCheck={false} />
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({
  label, hint, onFile, dragging, setDragging,
}: {
  label: string;
  hint: string;
  onFile: (f: File) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file?.type.startsWith("image/")) onFile(file);
        }}
        className={`w-full rounded-xl border-2 border-dashed py-4 flex flex-col items-center gap-1.5 transition-colors ${
          dragging ? "border-[#4CAF50] bg-[#4CAF50]/10" : "border-white/10 hover:border-white/20"
        }`}
      >
        <ImageIcon className="w-5 h-5 text-white/30" />
        <span className="text-xs font-medium text-white/40">{label}</span>
        <span className="text-[10px] text-white/20">{hint}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        aria-label="Upload image"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function SocialAssetGenerator({ config }: { config: AssetConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<AssetFormat>("instagram");
  const [captionCopied, setCaptionCopied] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // ── Theme state ──
  const [selectedThemeId, setSelectedThemeId] = useState("dark_forest");
  const [customTheme, setCustomTheme] = useState<CanvasTheme | null>(null);
  const [editBg0, setEditBg0] = useState(BUILT_IN_THEMES[0].bgStops[0]);
  const [editBg1, setEditBg1] = useState(BUILT_IN_THEMES[0].bgStops[1]);
  const [editBg2, setEditBg2] = useState(BUILT_IN_THEMES[0].bgStops[2]);
  const [editAccentStart, setEditAccentStart] = useState(BUILT_IN_THEMES[0].accentStart);
  const [editAccentEnd, setEditAccentEnd] = useState(BUILT_IN_THEMES[0].accentEnd);
  const [editBrandColor, setEditBrandColor] = useState(BUILT_IN_THEMES[0].brandColor);
  const [editPattern, setEditPattern] = useState<PatternType>(BUILT_IN_THEMES[0].pattern);
  const [editGradDir, setEditGradDir] = useState<GradientDirection>(BUILT_IN_THEMES[0].gradientDir);

  // ── Background image state ──
  const [bgImageDataUrl, setBgImageDataUrl] = useState<string | null>(null);
  const [bgImageEl, setBgImageEl] = useState<HTMLImageElement | null>(null);
  const [bgImageFit, setBgImageFit] = useState<BgImageFit>("cover");
  const [bgImageOpacity, setBgImageOpacity] = useState(0.55);
  const [bgFilters, setBgFilters] = useState<BgImageFilters>({ ...DEFAULT_FILTERS });
  const [bgDragging, setBgDragging] = useState(false);

  const isFiltersDefault = (
    bgFilters.blur === 0 && bgFilters.grayscale === 0 && bgFilters.sepia === 0 &&
    bgFilters.brightness === 100 && bgFilters.contrast === 100
  );
  const resetFilters = useCallback(() => setBgFilters({ ...DEFAULT_FILTERS }), []);

  // ── Logo state ──
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoImageEl, setLogoImageEl] = useState<HTMLImageElement | null>(null);
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>(DEFAULT_LOGO_PLACEMENT);
  const [logoSize, setLogoSize] = useState(1.0);
  const [logoDragging, setLogoDragging] = useState(false);

  // ── Interactive overlay drag/resize state ──
  const previewRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    mode: "drag" | "resize" | null;
    startX: number; startY: number;
    startPlacement: LogoPlacement;
    startSize: number;
  }>({ mode: null, startX: 0, startY: 0, startPlacement: DEFAULT_LOGO_PLACEMENT, startSize: 1.0 });
  const [overlayHover, setOverlayHover] = useState<"logo" | "resize" | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  // Compute logo overlay rect in preview-div coordinates (px)
  const getLogoOverlayRect = useCallback((): { x: number; y: number; w: number; h: number } | null => {
    const preview = previewRef.current;
    const canvas = canvasRef.current;
    if (!preview || !canvas || !logoImageEl) return null;
    const { width: canvasW, height: canvasH } = FORMAT_SIZES[format];
    const previewW = preview.clientWidth;
    const previewH = previewW * (canvasH / canvasW);
    const maxW = canvasW * 0.25 * logoSize;
    const maxH = canvasH * 0.12 * logoSize;
    const ratio = Math.min(maxW / logoImageEl.width, maxH / logoImageEl.height);
    const lw = logoImageEl.width * ratio;
    const lh = logoImageEl.height * ratio;
    const clamped = clampLogoPlacement(logoPlacement, { width: lw / canvasW, height: lh / canvasH });
    return {
      x: clamped.x * previewW,
      y: clamped.y * previewH,
      w: (lw / canvasW) * previewW,
      h: (lh / canvasH) * previewH,
    };
  }, [logoImageEl, logoPlacement, logoSize, format]);

  const getPointerInPreview = useCallback((clientX: number, clientY: number): { nx: number; ny: number } => {
    const preview = previewRef.current;
    if (!preview) return { nx: 0, ny: 0 };
    const rect = preview.getBoundingClientRect();
    const { width: canvasW, height: canvasH } = FORMAT_SIZES[format];
    const previewH = rect.width * (canvasH / canvasW);
    return {
      nx: (clientX - rect.left) / rect.width,
      ny: (clientY - rect.top) / previewH,
    };
  }, [format]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!logoImageEl) return;
    const rect = getLogoOverlayRect();
    if (!rect) return;
    const preview = previewRef.current;
    if (!preview) return;
    const previewRect = preview.getBoundingClientRect();
    const { width: canvasW, height: canvasH } = FORMAT_SIZES[format];
    const previewH = previewRect.width * (canvasH / canvasW);
    const px = e.clientX - previewRect.left;
    const py = e.clientY - previewRect.top;
    const handleSize = LOGO_RESIZE_HANDLE;
    const inResize = (
      px >= rect.x + rect.w - handleSize && px <= rect.x + rect.w + handleSize &&
      py >= rect.y + rect.h - handleSize && py <= rect.y + rect.h + handleSize
    );
    const inLogo = px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
    if (!inResize && !inLogo) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      mode: inResize ? "resize" : "drag",
      startX: e.clientX, startY: e.clientY,
      startPlacement: { ...logoPlacement },
      startSize: logoSize,
    };
    setIsDraggingLogo(true);
    void previewH;
    void previewRect;
  }, [logoImageEl, getLogoOverlayRect, logoPlacement, logoSize, format]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds.mode || !logoImageEl) {
      // Hover detection
      const rect = getLogoOverlayRect();
      if (!rect) { setOverlayHover(null); return; }
      const preview = previewRef.current;
      if (!preview) return;
      const previewRect = preview.getBoundingClientRect();
      const px = e.clientX - previewRect.left;
      const py = e.clientY - previewRect.top;
      const handleSize = LOGO_RESIZE_HANDLE;
      const inResize = (
        px >= rect.x + rect.w - handleSize && px <= rect.x + rect.w + handleSize &&
        py >= rect.y + rect.h - handleSize && py <= rect.y + rect.h + handleSize
      );
      const inLogo = px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
      setOverlayHover(inResize ? "resize" : inLogo ? "logo" : null);
      return;
    }
    e.preventDefault();
    const { width: canvasW, height: canvasH } = FORMAT_SIZES[format];
    const preview = previewRef.current;
    if (!preview) return;
    const previewRect = preview.getBoundingClientRect();
    const previewH = previewRect.width * (canvasH / canvasW);
    const dx = (e.clientX - ds.startX) / previewRect.width;
    const dy = (e.clientY - ds.startY) / previewH;
    if (ds.mode === "drag") {
      const maxW = canvasW * 0.25 * ds.startSize;
      const maxH = canvasH * 0.12 * ds.startSize;
      const ratio = Math.min(maxW / logoImageEl.width, maxH / logoImageEl.height);
      const lw = logoImageEl.width * ratio;
      const lh = logoImageEl.height * ratio;
      const newPlacement = snapLogoPlacement(
        { x: ds.startPlacement.x + dx, y: ds.startPlacement.y + dy },
        { width: lw / canvasW, height: lh / canvasH }
      );
      setLogoPlacement(newPlacement);
    } else {
      // resize: drag distance maps to size change
      const distPx = Math.sqrt(
        Math.pow(e.clientX - ds.startX, 2) + Math.pow(e.clientY - ds.startY, 2)
      ) * (dx + dy > 0 ? 1 : -1);
      const newSize = Math.min(LOGO_MAX_SIZE, Math.max(LOGO_MIN_SIZE, ds.startSize + distPx * 0.02));
      setLogoSize(newSize);
    }
  }, [logoImageEl, getLogoOverlayRect, format]);

  const onPointerUp = useCallback(() => {
    dragStateRef.current.mode = null;
    setIsDraggingLogo(false);
  }, []);

  const onPointerLeave = useCallback(() => {
    if (!dragStateRef.current.mode) setOverlayHover(null);
  }, []);

  // Touch support
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!logoImageEl || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = getLogoOverlayRect();
    if (!rect) return;
    const preview = previewRef.current;
    if (!preview) return;
    const previewRect = preview.getBoundingClientRect();
    const px = touch.clientX - previewRect.left;
    const py = touch.clientY - previewRect.top;
    const handleSize = LOGO_RESIZE_HANDLE;
    const inResize = (
      px >= rect.x + rect.w - handleSize && px <= rect.x + rect.w + handleSize &&
      py >= rect.y + rect.h - handleSize && py <= rect.y + rect.h + handleSize
    );
    const inLogo = px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
    if (!inResize && !inLogo) return;
    e.preventDefault();
    dragStateRef.current = {
      mode: inResize ? "resize" : "drag",
      startX: touch.clientX, startY: touch.clientY,
      startPlacement: { ...logoPlacement },
      startSize: logoSize,
    };
    setIsDraggingLogo(true);
  }, [logoImageEl, getLogoOverlayRect, logoPlacement, logoSize]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds.mode || !logoImageEl || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { width: canvasW, height: canvasH } = FORMAT_SIZES[format];
    const preview = previewRef.current;
    if (!preview) return;
    const previewRect = preview.getBoundingClientRect();
    const previewH = previewRect.width * (canvasH / canvasW);
    const dx = (touch.clientX - ds.startX) / previewRect.width;
    const dy = (touch.clientY - ds.startY) / previewH;
    if (ds.mode === "drag") {
      const maxW = canvasW * 0.25 * ds.startSize;
      const maxH = canvasH * 0.12 * ds.startSize;
      const ratio = Math.min(maxW / logoImageEl.width, maxH / logoImageEl.height);
      const lw = logoImageEl.width * ratio;
      const lh = logoImageEl.height * ratio;
      const newPlacement = snapLogoPlacement(
        { x: ds.startPlacement.x + dx, y: ds.startPlacement.y + dy },
        { width: lw / canvasW, height: lh / canvasH }
      );
      setLogoPlacement(newPlacement);
    } else {
      const distPx = Math.sqrt(
        Math.pow(touch.clientX - ds.startX, 2) + Math.pow(touch.clientY - ds.startY, 2)
      ) * (dx + dy > 0 ? 1 : -1);
      const newSize = Math.min(LOGO_MAX_SIZE, Math.max(LOGO_MIN_SIZE, ds.startSize + distPx * 0.02));
      setLogoSize(newSize);
    }
  }, [logoImageEl, format]);

  const onTouchEnd = useCallback(() => {
    dragStateRef.current.mode = null;
    setIsDraggingLogo(false);
  }, []);

  // ── Derived active theme ──
  const activeTheme: CanvasTheme = customTheme ?? (BUILT_IN_THEMES.find(t => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0]);

  // Load bg image into HTMLImageElement when data URL changes
  useEffect(() => {
    if (!bgImageDataUrl) { setBgImageEl(null); return; }
    const img = new Image();
    img.onload = () => setBgImageEl(img);
    img.src = bgImageDataUrl;
  }, [bgImageDataUrl]);

  // Load logo into HTMLImageElement when data URL changes
  useEffect(() => {
    if (!logoDataUrl) { setLogoImageEl(null); return; }
    const img = new Image();
    img.onload = () => setLogoImageEl(img);
    img.src = logoDataUrl;
  }, [logoDataUrl]);

  const applyBuiltIn = useCallback((theme: CanvasTheme) => {
    setSelectedThemeId(theme.id); setCustomTheme(null);
    setEditBg0(theme.bgStops[0]); setEditBg1(theme.bgStops[1]); setEditBg2(theme.bgStops[2]);
    setEditAccentStart(theme.accentStart); setEditAccentEnd(theme.accentEnd);
    setEditBrandColor(theme.brandColor); setEditPattern(theme.pattern); setEditGradDir(theme.gradientDir);
  }, []);

  const buildCustomTheme = useCallback((): CanvasTheme => {
    const base = BUILT_IN_THEMES.find(t => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0];
    const isLight = editBg0.startsWith("#f") || editBg0.startsWith("#e");
    const rgb = hexToRgb(editAccentStart);
    return {
      ...base, id: "custom", label: "Custom",
      bgStops: [editBg0, editBg1, editBg2],
      accentStart: editAccentStart, accentEnd: editAccentEnd, brandColor: editBrandColor,
      pattern: editPattern, gradientDir: editGradDir,
      titleColor: isLight ? "#0f172a" : "#ffffff",
      subtitleColor: isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.50)",
      labelColor: isLight ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.35)",
      cardFill: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
      cardBorder: rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)` : "rgba(76,175,80,0.22)",
    };
  }, [editBg0, editBg1, editBg2, editAccentStart, editAccentEnd, editBrandColor, editPattern, editGradDir, selectedThemeId]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = FORMAT_SIZES[format];
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale; canvas.height = height * scale;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawChampionCard(ctx, config, format, activeTheme, {
      bgImage: bgImageEl, bgImageFit, bgImageOpacity, bgFilters,
      logoImage: logoImageEl, logoPlacement, logoSize,
    });
  }, [config, format, activeTheme, bgImageEl, bgImageFit, bgImageOpacity, bgFilters, logoImageEl, logoPlacement, logoSize]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // Custom theme editor sync
  useEffect(() => {
    if (!showCustomizer) return;
    setCustomTheme(buildCustomTheme());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editBg0, editBg1, editBg2, editAccentStart, editAccentEnd, editBrandColor, editPattern, editGradDir]);

  // File handlers
  const handleBgFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { if (typeof e.target?.result === "string") setBgImageDataUrl(e.target.result); };
    reader.readAsDataURL(file);
  }, []);

  const handleLogoFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { if (typeof e.target?.result === "string") setLogoDataUrl(e.target.result); };
    reader.readAsDataURL(file);
  }, []);

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
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      if (navigator.share && navigator.canShare?.({ files: [] })) {
        await navigator.share({
          title: `${config.tournamentName} Results`,
          text: generateCaption(config),
          files: [new File([blob], `${config.tournamentName}-recap.png`, { type: "image/png" })],
        });
      } else { downloadImage(); }
    } catch { /* cancelled */ }
  }, [config, downloadImage]);

  const copyCaption = useCallback(() => {
    navigator.clipboard.writeText(generateCaption(config)).then(() => {
      setCaptionCopied(true); setTimeout(() => setCaptionCopied(false), 2000);
    });
  }, [config]);

  return (
    <div className="space-y-5">

      {/* ── Format Selector ── */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FORMAT_SIZES) as AssetFormat[]).map((f) => (
          <button key={f} onClick={() => setFormat(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              format === f ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30" : "bg-white/6 text-white/50 hover:text-white border border-transparent"
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
        <div className="flex gap-2 flex-wrap">
          {BUILT_IN_THEMES.map((t) => (
            <ThemeSwatch key={t.id} theme={t} active={selectedThemeId === t.id && !customTheme} onClick={() => applyBuiltIn(t)} />
          ))}
        </div>
        <p className="text-[11px] text-white/40">
          {customTheme ? "Custom theme" : `${activeTheme.label} — ${activeTheme.gradientDir} gradient, ${activeTheme.pattern === "none" ? "no pattern" : activeTheme.pattern + " pattern"}`}
        </p>
      </div>

      {/* ── Customizer Toggle ── */}
      <button onClick={() => setShowCustomizer((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white/90 bg-white/4 hover:bg-white/8 border border-white/8 transition-colors w-full"
      >
        <Sliders className="w-3.5 h-3.5" />
        Customize Colors &amp; Style
        {showCustomizer ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </button>

      {/* ── Custom Editor Panel ── */}
      {showCustomizer && (
        <div className="rounded-2xl border border-white/8 p-4 space-y-4" style={{ background: "oklch(0.14 0.02 145)" }}>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Background Gradient</p>
            <ColorRow label="Stop 1 (top)" value={editBg0} onChange={setEditBg0} />
            <ColorRow label="Stop 2 (mid)" value={editBg1} onChange={setEditBg1} />
            <ColorRow label="Stop 3 (bottom)" value={editBg2} onChange={setEditBg2} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Gradient Direction</p>
            <div className="flex gap-2 flex-wrap">
              {(["vertical", "horizontal", "diagonal", "radial"] as GradientDirection[]).map((d) => (
                <button key={d} onClick={() => { setEditGradDir(d); setCustomTheme(buildCustomTheme()); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${
                    editGradDir === d ? "bg-white/12 text-white border border-white/20" : "text-white/40 hover:text-white/70 border border-transparent"
                  }`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Accent Bar &amp; Brand</p>
            <ColorRow label="Accent start" value={editAccentStart} onChange={setEditAccentStart} />
            <ColorRow label="Accent end" value={editAccentEnd} onChange={setEditAccentEnd} />
            <ColorRow label="Brand / prize color" value={editBrandColor} onChange={setEditBrandColor} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Background Pattern</p>
            <div className="flex gap-2 flex-wrap">
              {(["chess", "dots", "lines", "none"] as PatternType[]).map((p) => (
                <button key={p} onClick={() => { setEditPattern(p); setCustomTheme(buildCustomTheme()); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors capitalize ${
                    editPattern === p ? "bg-white/12 text-white border border-white/20" : "text-white/40 hover:text-white/70 border border-transparent"
                  }`}>{p === "none" ? "None" : p}</button>
              ))}
            </div>
          </div>
          {customTheme && (
            <button onClick={() => applyBuiltIn(BUILT_IN_THEMES.find(t => t.id === selectedThemeId) ?? BUILT_IN_THEMES[0])}
              className="text-[11px] text-white/40 hover:text-white/70 underline transition-colors">
              Reset to {BUILT_IN_THEMES.find(t => t.id === selectedThemeId)?.label ?? "default"}
            </button>
          )}
        </div>
      )}

      {/* ── Background Image Upload ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Background Image</span>
          {bgImageDataUrl && (
            <button onClick={() => { setBgImageDataUrl(null); setBgImageEl(null); }}
              className="ml-auto flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors">
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>

        {bgImageDataUrl ? (
          <div className="space-y-3">
            {/* Thumbnail */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"
                style={{ background: `url(${bgImageDataUrl}) center/cover no-repeat` }} />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white/70">Image set</p>
                <p className="text-[10px] text-white/30">Dark scrim applied for readability</p>
              </div>
            </div>
            {/* Fit mode */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Fit Mode</p>
              <div className="flex gap-2">
                {(["cover", "contain", "tile"] as BgImageFit[]).map((m) => (
                  <button key={m} onClick={() => setBgImageFit(m)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors ${
                      bgImageFit === m ? "bg-white/12 text-white border border-white/20" : "text-white/40 hover:text-white/70 border border-transparent"
                    }`}>{m}</button>
                ))}
              </div>
            </div>
            {/* Opacity slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Opacity</p>
                <span className="text-[10px] font-bold tabular-nums text-white/50">{Math.round(bgImageOpacity * 100)}%</span>
              </div>
              <input type="range" min={10} max={100} step={5} value={Math.round(bgImageOpacity * 100)}
                aria-label="Background image opacity"
                onChange={(e) => setBgImageOpacity(Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                style={{ background: `linear-gradient(to right, #4CAF50 ${Math.round(bgImageOpacity * 100)}%, rgba(255,255,255,0.12) ${Math.round(bgImageOpacity * 100)}%)` }}
              />
            </div>

            {/* ── Image Filters ── */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Image Filters</p>
                {!isFiltersDefault && (
                  <button onClick={resetFilters}
                    className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors">
                    <RotateCcw className="w-2.5 h-2.5" /> Reset
                  </button>
                )}
              </div>

              {/* Blur */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Blur</span>
                  <span className="text-[10px] font-bold tabular-nums text-white/50">{bgFilters.blur}px</span>
                </div>
                <input type="range" min={0} max={20} step={1} value={bgFilters.blur}
                  aria-label="Blur filter"
                  onChange={(e) => setBgFilters(f => ({ ...f, blur: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                  style={{ background: `linear-gradient(to right, #4CAF50 ${bgFilters.blur / 20 * 100}%, rgba(255,255,255,0.12) ${bgFilters.blur / 20 * 100}%)` }}
                />
              </div>

              {/* Grayscale */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Grayscale</span>
                  <span className="text-[10px] font-bold tabular-nums text-white/50">{bgFilters.grayscale}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={bgFilters.grayscale}
                  aria-label="Grayscale filter"
                  onChange={(e) => setBgFilters(f => ({ ...f, grayscale: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                  style={{ background: `linear-gradient(to right, #4CAF50 ${bgFilters.grayscale}%, rgba(255,255,255,0.12) ${bgFilters.grayscale}%)` }}
                />
              </div>

              {/* Sepia */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Sepia</span>
                  <span className="text-[10px] font-bold tabular-nums text-white/50">{bgFilters.sepia}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={bgFilters.sepia}
                  aria-label="Sepia filter"
                  onChange={(e) => setBgFilters(f => ({ ...f, sepia: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                  style={{ background: `linear-gradient(to right, #4CAF50 ${bgFilters.sepia}%, rgba(255,255,255,0.12) ${bgFilters.sepia}%)` }}
                />
              </div>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Brightness</span>
                  <span className="text-[10px] font-bold tabular-nums text-white/50">{bgFilters.brightness}%</span>
                </div>
                <input type="range" min={50} max={150} step={5} value={bgFilters.brightness}
                  aria-label="Brightness filter"
                  onChange={(e) => setBgFilters(f => ({ ...f, brightness: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                  style={{ background: `linear-gradient(to right, #4CAF50 ${(bgFilters.brightness - 50) / 100 * 100}%, rgba(255,255,255,0.12) ${(bgFilters.brightness - 50) / 100 * 100}%)` }}
                />
                <div className="flex justify-between text-[9px] text-white/20">
                  <span>Dark</span><span>Normal</span><span>Bright</span>
                </div>
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/40">Contrast</span>
                  <span className="text-[10px] font-bold tabular-nums text-white/50">{bgFilters.contrast}%</span>
                </div>
                <input type="range" min={50} max={150} step={5} value={bgFilters.contrast}
                  aria-label="Contrast filter"
                  onChange={(e) => setBgFilters(f => ({ ...f, contrast: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                  style={{ background: `linear-gradient(to right, #4CAF50 ${(bgFilters.contrast - 50) / 100 * 100}%, rgba(255,255,255,0.12) ${(bgFilters.contrast - 50) / 100 * 100}%)` }}
                />
                <div className="flex justify-between text-[9px] text-white/20">
                  <span>Flat</span><span>Normal</span><span>Vivid</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <UploadZone
            label="Upload background image"
            hint="Click or drag & drop · JPG, PNG, WebP"
            onFile={handleBgFile}
            dragging={bgDragging}
            setDragging={setBgDragging}
          />
        )}
      </div>

      {/* ── Logo Upload ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px]">🏅</span>
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Club Logo</span>
          {logoDataUrl && (
            <button onClick={() => { setLogoDataUrl(null); setLogoImageEl(null); }}
              className="ml-auto flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors">
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>

        {logoDataUrl ? (
          <div className="space-y-3">
            {/* Thumbnail + change */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center bg-white/5">
                <img src={logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white/70">Logo uploaded</p>
                <label className="text-[10px] text-[#4CAF50] hover:text-[#66BB6A] cursor-pointer transition-colors">
                  Change image
                  <input type="file" accept="image/*" className="hidden"
                    aria-label="Change logo image"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ""; }} />
                </label>
              </div>
            </div>
            {/* Size slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Logo Size</p>
                <span className="text-[10px] font-bold tabular-nums text-white/50">{Math.round(logoSize * 100)}%</span>
              </div>
              <input type="range" min={50} max={200} step={5} value={Math.round(logoSize * 100)}
                aria-label="Logo size"
                onChange={(e) => setLogoSize(Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#4CAF50]"
                style={{ background: `linear-gradient(to right, #4CAF50 ${(logoSize - 0.5) / 1.5 * 100}%, rgba(255,255,255,0.12) ${(logoSize - 0.5) / 1.5 * 100}%)` }}
              />
              <div className="flex justify-between text-[9px] text-white/20 mt-0.5">
                <span>Small</span><span>Default</span><span>Large</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Logo Placement</p>
                <button
                  onClick={() => { setLogoPlacement(DEFAULT_LOGO_PLACEMENT); setLogoSize(1.0); }}
                  className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors">
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Drag the logo on the preview below to reposition it.
                Drag the <span className="text-white/50 font-medium">corner handle</span> to resize.
              </p>
            </div>
          </div>
        ) : (
          <UploadZone
            label="Upload club logo"
            hint="Click or drag & drop · PNG, SVG, JPG"
            onFile={handleLogoFile}
            dragging={logoDragging}
            setDragging={setLogoDragging}
          />
        )}
      </div>

      {/* ── Live Canvas Preview (with interactive logo overlay) ── */}
      <div
        ref={previewRef}
        className="rounded-2xl overflow-hidden border border-white/10 bg-black/20 relative select-none"
        style={{
          cursor: isDraggingLogo
            ? dragStateRef.current.mode === "resize" ? "nwse-resize" : "grabbing"
            : overlayHover === "resize" ? "nwse-resize"
            : overlayHover === "logo" ? "grab"
            : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} className="w-full h-auto block"
          style={{ maxWidth: FORMAT_SIZES[format].width }} />
        {/* Logo bounding box overlay */}
        {logoImageEl && (() => {
          const rect = getLogoOverlayRect();
          if (!rect) return null;
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
              }}
            >
              {/* Dashed border */}
              <div className={`absolute inset-0 rounded border-2 transition-opacity ${
                isDraggingLogo || overlayHover ? "border-[#4CAF50] opacity-100" : "border-white/30 opacity-60"
              }`} />
              {/* Corner resize handle */}
              <div
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-sm translate-x-1/2 translate-y-1/2 transition-colors ${
                  overlayHover === "resize" || (isDraggingLogo && dragStateRef.current.mode === "resize")
                    ? "bg-[#4CAF50]"
                    : "bg-white/60"
                }`}
                style={{ cursor: "nwse-resize" }}
              />
              {/* Drag hint label */}
              {!isDraggingLogo && overlayHover === "logo" && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[9px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                  Drag to move
                </div>
              )}
              {!isDraggingLogo && overlayHover === "resize" && (
                <div className="absolute -bottom-6 right-0 bg-black/70 text-white text-[9px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                  Drag to resize
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={downloadImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/80 text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors">
          <Download className="w-4 h-4" /> Download PNG
        </button>
        <button onClick={shareImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/80 text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors">
          <Share2 className="w-4 h-4" /> Share
        </button>
      </div>

      {/* ── Caption ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Caption</h3>
          <button onClick={copyCaption}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-colors">
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
