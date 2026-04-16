/**
 * InstagramCarouselModal — Tournament Recap Instagram Carousel Generator
 *
 * Generates 6 branded slides from tournament data in two formats:
 *   Square  1080×1080 — Instagram carousel / feed post
 *   Story   1080×1920 — Instagram Story / Reel cover
 *
 * Slides:
 *   1. Cover    — Tournament name, club, date, champion (full-bleed hero)
 *   2. Podium   — Top 3 players with ELO, points, medals (tall podium blocks)
 *   3. Standings — Full ranked player list with scores (dense, readable rows)
 *   4. Stats    — Players, rounds, format, avg ELO, top performer (big numbers)
 *   5. CTA      — "Play at [Club]" with OTB branding (bold centered)
 *   6. Round-by-Round — W/D/L/BYE grid per player per round
 *
 * Export: individual PNG or ZIP of all slides via html-to-image + JSZip
 * Mobile: uses Web Share API for individual slide downloads on mobile
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { X, Download, Instagram, ChevronLeft, ChevronRight, Loader2, Share2, LayoutGrid, Smartphone } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { StandingRow } from "@/lib/swiss";
import type { TournamentConfig } from "@/lib/tournamentRegistry";
import type { Round } from "@/lib/tournamentData";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlideFormat = "square" | "story";

interface Props {
  open: boolean;
  onClose: () => void;
  rows: StandingRow[];
  config: TournamentConfig | null;
  tournamentName: string;
  totalRounds: number;
  /** Optional: completed round data for Slide 6 (Round-by-Round grid) */
  rounds?: Round[];
  /** Optional: club avatar URL — pre-seeds the host logo slot; director can override */
  clubLogoUrl?: string | null;
}

// ─── Design tokens (OTB brand) ────────────────────────────────────────────────

const BRAND = {
  white: "#FFFFFF",
  offWhite: "#F0F5EE",
  gold: "#F5C842",
  silver: "#C8D0D8",
  bronze: "#CD7F32",
};

/** Fixed slide width — always 1080px */
const SLIDE_W = 1080;
/** Slide heights per format */
const SLIDE_H: Record<SlideFormat, number> = {
  square: 1080,
  story: 1920,
};

// ─── Slide colour themes ──────────────────────────────────────────────────────

export interface SlideTheme {
  id: string;
  label: string;
  bg: string;
  bgDark: string;
  accent: string;
  accentLight: string;
  accentBright: string;
  glow: string;
  swatch: string;
}

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: "classic-green",
    label: "Classic",
    bg: "#2A4A32",
    bgDark: "#0A1A0E",
    accent: "#3D6B47",
    accentLight: "#769656",
    accentBright: "#4CAF50",
    glow: "#3D6B47",
    swatch: "#3D6B47",
  },
  {
    id: "midnight-blue",
    label: "Midnight",
    bg: "#1A2A4A",
    bgDark: "#080E1A",
    accent: "#2A4A7A",
    accentLight: "#5B8DD9",
    accentBright: "#4A90E2",
    glow: "#2A4A7A",
    swatch: "#2A4A7A",
  },
  {
    id: "crimson",
    label: "Crimson",
    bg: "#4A1A1A",
    bgDark: "#1A0808",
    accent: "#7A2A2A",
    accentLight: "#D95B5B",
    accentBright: "#E24A4A",
    glow: "#7A2A2A",
    swatch: "#7A2A2A",
  },
  {
    id: "gold-rush",
    label: "Gold",
    bg: "#3A2A0A",
    bgDark: "#1A1205",
    accent: "#7A5A0A",
    accentLight: "#D4A017",
    accentBright: "#F5C842",
    glow: "#7A5A0A",
    swatch: "#7A5A0A",
  },
  {
    id: "monochrome",
    label: "Mono",
    bg: "#2A2A2A",
    bgDark: "#0A0A0A",
    accent: "#4A4A4A",
    accentLight: "#B0B0B0",
    accentBright: "#E0E0E0",
    glow: "#4A4A4A",
    swatch: "#4A4A4A",
  },
  {
    id: "purple-reign",
    label: "Purple",
    bg: "#2A1A4A",
    bgDark: "#0E0818",
    accent: "#4A2A7A",
    accentLight: "#9B5BD9",
    accentBright: "#8B4AE2",
    glow: "#4A2A7A",
    swatch: "#4A2A7A",
  },
];

const DEFAULT_THEME = SLIDE_THEMES[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function avgElo(rows: StandingRow[]): number {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((s, r) => s + r.player.elo, 0) / rows.length);
}

function formatFormat(fmt?: string): string {
  if (fmt === "swiss") return "Swiss";
  if (fmt === "doubleswiss") return "Double Swiss";
  if (fmt === "roundrobin") return "Round Robin";
  if (fmt === "elimination") return "Elimination";
  if (fmt === "swiss_elim") return "Swiss + Elimination";
  return fmt ?? "Swiss";
}

/** Clamp font size so very long names don't overflow */
function clampFont(base: number, text: string, maxChars = 20): number {
  if (text.length <= maxChars) return base;
  return Math.max(base * 0.6, base * (maxChars / text.length));
}

// ─── Slide components ─────────────────────────────────────────────────────────

interface SlideProps {
  rows: StandingRow[];
  config: TournamentConfig | null;
  tournamentName: string;
  totalRounds: number;
  scale?: number;
  hostLogoUrl?: string | null;
  theme?: SlideTheme;
  /** Optional round data for Slide 6 */
  rounds?: Round[];
  /** Slide format — square (1080×1080) or story (1080×1920) */
  format?: SlideFormat;
}

/** Shared slide wrapper — themed background with chess board texture */
function SlideWrapper({
  children,
  scale = 1,
  theme = DEFAULT_THEME,
  format = "square",
}: {
  children: React.ReactNode;
  scale?: number;
  theme?: SlideTheme;
  format?: SlideFormat;
}) {
  const w = SLIDE_W * scale;
  const h = SLIDE_H[format] * scale;
  return (
    <div
      style={{
        width: w,
        height: h,
        background: `linear-gradient(145deg, ${theme.bg} 0%, ${theme.bgDark} 100%)`,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        flexShrink: 0,
      }}
    >
      {/* Chess board texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-conic-gradient(rgba(255,255,255,0.028) 0% 25%, transparent 0% 50%)`,
          backgroundSize: `${72 * scale}px ${72 * scale}px`,
          zIndex: 0,
        }}
      />
      {/* Radial glow — top right */}
      <div
        style={{
          position: "absolute",
          top: -w * 0.25,
          right: -w * 0.15,
          width: w * 0.9,
          height: w * 0.9,
          background: `radial-gradient(circle, ${theme.glow}60 0%, transparent 65%)`,
          zIndex: 0,
        }}
      />
      {/* Radial glow — bottom left (secondary) */}
      <div
        style={{
          position: "absolute",
          bottom: -w * 0.2,
          left: -w * 0.1,
          width: w * 0.6,
          height: w * 0.6,
          background: `radial-gradient(circle, ${theme.glow}30 0%, transparent 65%)`,
          zIndex: 0,
        }}
      />
      {/* Story format: extra glow in the middle for the tall canvas */}
      {format === "story" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: w * 1.2,
            height: w * 1.2,
            background: `radial-gradient(circle, ${theme.glow}18 0%, transparent 60%)`,
            zIndex: 0,
          }}
        />
      )}
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

/** OTB brand footer — always at the very bottom of every slide */
function OTBBrand({
  scale = 1,
  clubName,
  hostLogoUrl,
  theme = DEFAULT_THEME,
}: {
  scale?: number;
  clubName?: string | null;
  hostLogoUrl?: string | null;
  theme?: SlideTheme;
}) {
  const s = scale;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 80 * s,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14 * s,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
        background: "rgba(0,0,0,0.18)",
        backdropFilter: "blur(4px)",
      }}
    >
      {hostLogoUrl && (
        <>
          <img
            src={hostLogoUrl}
            alt="Host logo"
            style={{ height: 38 * s, maxWidth: 110 * s, objectFit: "contain", borderRadius: 4 * s }}
            crossOrigin="anonymous"
          />
          <div style={{ width: 1, height: 28 * s, background: "rgba(255,255,255,0.18)" }} />
        </>
      )}
      <div
        style={{
          fontWeight: 900,
          fontStyle: "italic",
          fontSize: 26 * s,
          color: theme.accentLight,
          letterSpacing: "0.02em",
        }}
      >
        OTB!!
      </div>
      {!hostLogoUrl && clubName && (
        <>
          <div style={{ width: 1, height: 20 * s, background: "rgba(255,255,255,0.18)" }} />
          <div style={{ fontSize: 15 * s, color: "rgba(255,255,255,0.45)", fontWeight: 600, letterSpacing: "0.04em" }}>
            {clubName}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Slide counter badge ──────────────────────────────────────────────────────

function SlideCounter({ current, total, scale = 1 }: { current: number; total: number; scale?: number }) {
  const s = scale;
  return (
    <div style={{ position: "absolute", top: 36 * s, right: 44 * s, fontSize: 14 * s, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: "0.12em" }}>
      {current} / {total}
    </div>
  );
}

const TOTAL_SLIDES = 6;

// ─── Slide 1 — Cover ─────────────────────────────────────────────────────────

function Slide1Cover({ rows, config, tournamentName, totalRounds, scale = 1, hostLogoUrl, theme = DEFAULT_THEME, format = "square" }: SlideProps) {
  const s = scale;
  const champion = rows[0]?.player;
  const clubName = config?.clubName;
  const date = formatDate(config?.date);
  const FOOTER = 80 * s;
  const PAD = 64 * s;
  const isStory = format === "story";
  const _H = SLIDE_H[format] * s;

  // Dynamic font size for tournament name — fills width
  const nameFontSize = Math.min(
    isStory ? 108 * s : 96 * s,
    (SLIDE_W * s * 0.88) / Math.max(1, tournamentName.length * 0.52)
  );

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={1} total={TOTAL_SLIDES} scale={scale} />

      {/* ── TOP SECTION: Club pill + Tournament name ── */}
      <div style={{ position: "absolute", top: isStory ? PAD * 1.5 : PAD, left: PAD, right: PAD }}>
        {/* Club badge — shows logo image when available, falls back to text-only */}
        {clubName && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: hostLogoUrl ? 10 * s : 0,
              background: `${theme.accent}44`,
              border: `1.5px solid ${theme.accentLight}55`,
              borderRadius: 100 * s,
              padding: hostLogoUrl ? `${7 * s}px ${18 * s}px ${7 * s}px ${7 * s}px` : `${9 * s}px ${22 * s}px`,
              fontSize: 13 * s,
              color: theme.accentLight,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase" as const,
              marginBottom: 28 * s,
            }}
          >
            {hostLogoUrl && (
              <img
                src={hostLogoUrl}
                alt={clubName}
                crossOrigin="anonymous"
                style={{
                  width: 30 * s,
                  height: 30 * s,
                  borderRadius: 50 * s,
                  objectFit: "cover",
                  flexShrink: 0,
                  border: `1px solid ${theme.accentLight}40`,
                }}
              />
            )}
            {clubName}
          </div>
        )}

        {/* Label */}
        <div style={{ fontSize: 14 * s, color: "rgba(255,255,255,0.38)", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" as const, marginBottom: 18 * s }}>
          Tournament Recap
        </div>

        {/* Tournament name — BIG */}
        <div
          style={{
            fontSize: nameFontSize,
            fontWeight: 900,
            color: BRAND.white,
            lineHeight: 1.0,
            letterSpacing: "-0.025em",
            textTransform: "uppercase" as const,
          }}
        >
          {tournamentName}
        </div>
      </div>

      {/* ── CENTER: Divider line ── */}
      <div
        style={{
          position: "absolute",
          top: isStory ? "38%" : "46%",
          left: PAD,
          right: PAD,
          height: 1.5 * s,
          background: `linear-gradient(90deg, ${theme.accentLight}80 0%, ${theme.accentLight}20 100%)`,
        }}
      />

      {/* Story format: extra decorative element in the middle gap */}
      {isStory && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: PAD,
            right: PAD,
            display: "flex",
            alignItems: "center",
            gap: 20 * s,
          }}
        >
          <div style={{ fontSize: 16 * s, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
            {rows.length} Players · {totalRounds} Rounds{date ? ` · ${date}` : ""}
          </div>
        </div>
      )}

      {/* ── BOTTOM SECTION: Champion + meta ── */}
      {champion && (
        <div
          style={{
            position: "absolute",
            bottom: FOOTER + (isStory ? 120 * s : 48 * s),
            left: PAD,
            right: PAD,
            display: "flex",
            flexDirection: "column" as const,
            gap: 0,
          }}
        >
          {/* CHAMPION label */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 * s, marginBottom: 16 * s }}>
            <div style={{ fontSize: isStory ? 56 * s : 42 * s, lineHeight: 1 }}>🏆</div>
            <div style={{ fontSize: 13 * s, color: BRAND.gold, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>
              Champion
            </div>
          </div>

          {/* Champion name — massive */}
          <div
            style={{
              fontSize: clampFont(isStory ? 130 * s : 110 * s, champion.name, 12),
              fontWeight: 900,
              color: BRAND.white,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              marginBottom: 20 * s,
            }}
          >
            {champion.name}
          </div>

          {/* Username + ELO + score */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 * s, flexWrap: "wrap" as const }}>
            <div style={{ fontSize: isStory ? 28 * s : 22 * s, color: theme.accentLight, fontWeight: 700 }}>
              @{champion.username}
            </div>
            <div style={{ width: 1, height: 20 * s, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ fontSize: isStory ? 28 * s : 22 * s, color: BRAND.gold, fontWeight: 800 }}>
              {champion.elo} ELO
            </div>
            <div style={{ width: 1, height: 20 * s, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ fontSize: isStory ? 28 * s : 22 * s, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
              {rows[0]?.points ?? 0} / {totalRounds} pts
            </div>
          </div>

          {/* Date + format meta — only in square (story shows it in middle) */}
          {!isStory && (date || rows.length) && (
            <div style={{ marginTop: 24 * s, display: "flex", gap: 20 * s, flexWrap: "wrap" as const }}>
              {date && (
                <div style={{ fontSize: 16 * s, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>{date}</div>
              )}
              <div style={{ fontSize: 16 * s, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
                {rows.length} Players · {totalRounds} Rounds
              </div>
            </div>
          )}

          {/* Story: runner-up + 3rd place mini cards */}
          {isStory && rows.length >= 2 && (
            <div style={{ marginTop: 48 * s, display: "flex", gap: 20 * s }}>
              {rows.slice(1, 3).map((row, idx) => (
                <div
                  key={row.player.id}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 16 * s,
                    padding: `${20 * s}px ${24 * s}px`,
                    display: "flex",
                    alignItems: "center",
                    gap: 14 * s,
                  }}
                >
                  <div style={{ fontSize: 32 * s }}>{idx === 0 ? "🥈" : "🥉"}</div>
                  <div>
                    <div style={{ fontSize: 20 * s, fontWeight: 800, color: BRAND.white }}>{row.player.name}</div>
                    <div style={{ fontSize: 15 * s, color: "rgba(255,255,255,0.40)", marginTop: 2 * s }}>{row.points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Story: website URL pill near footer */}
      {isStory && (
        <div
          style={{
            position: "absolute",
            bottom: FOOTER + 36 * s,
            left: "50%",
            transform: "translateX(-50%)",
            background: `${theme.accent}44`,
            border: `1.5px solid ${theme.accentLight}55`,
            borderRadius: 100 * s,
            padding: `${12 * s}px ${36 * s}px`,
            fontSize: 20 * s,
            fontWeight: 800,
            color: theme.accentLight,
            letterSpacing: "0.06em",
            whiteSpace: "nowrap" as const,
          }}
        >
          otbchess.club
        </div>
      )}

      <OTBBrand scale={scale} clubName={null} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide 2 — Podium ────────────────────────────────────────────────────────

function Slide2Podium({ rows, config, tournamentName, totalRounds: _totalRounds, scale = 1, hostLogoUrl, theme = DEFAULT_THEME, format = "square" }: SlideProps) {
  const s = scale;
  const top3 = rows.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const ranks = [2, 1, 3];
  const medals = ["🥈", "🥇", "🥉"];
  const medalColors = [BRAND.silver, BRAND.gold, BRAND.bronze];
  const isStory = format === "story";
  const FOOTER = 80 * s;
  const PAD = 48 * s;
  const HEADER_H = isStory ? 220 * s : 160 * s;
  const H = SLIDE_H[format] * s;
  const availH = H - FOOTER - HEADER_H;
  // Story: taller podium blocks
  const podiumHeightFrac = isStory ? [0.28, 0.38, 0.22] : [0.30, 0.40, 0.24];

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={2} total={TOTAL_SLIDES} scale={scale} />

      {/* Header */}
      <div style={{ paddingTop: isStory ? 80 * s : 56 * s, paddingLeft: PAD, paddingRight: PAD }}>
        <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.32)", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 10 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: isStory ? 88 * s : 72 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.025em", lineHeight: 1 }}>
          Top Players
        </div>
        {isStory && (
          <div style={{ fontSize: 22 * s, color: "rgba(255,255,255,0.35)", marginTop: 16 * s, fontWeight: 500 }}>
            Final Podium · {rows.length} Players
          </div>
        )}
      </div>

      {/* Podium */}
      <div
        style={{
          position: "absolute",
          bottom: FOOTER,
          left: PAD,
          right: PAD,
          display: "flex",
          alignItems: "flex-end",
          gap: isStory ? 28 * s : 20 * s,
        }}
      >
        {podiumOrder.map((row, idx) => {
          if (!row) return null;
          const isFirst = ranks[idx] === 1;
          const blockH = availH * podiumHeightFrac[idx];
          const nameSize = clampFont(isFirst ? (isStory ? 44 * s : 38 * s) : (isStory ? 32 * s : 28 * s), row.player.name, 14);

          return (
            <div
              key={row.player.id}
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                flex: isFirst ? 1.2 : 1,
              }}
            >
              {/* Player info above block */}
              <div style={{ textAlign: "center", marginBottom: 16 * s, padding: `0 ${8 * s}px` }}>
                <div style={{ fontSize: isFirst ? (isStory ? 64 * s : 52 * s) : (isStory ? 44 * s : 36 * s), lineHeight: 1, marginBottom: 10 * s }}>
                  {medals[idx]}
                </div>
                <div style={{ fontSize: nameSize, fontWeight: 900, color: BRAND.white, lineHeight: 1.1, marginBottom: 8 * s }}>
                  {row.player.name}
                </div>
                <div style={{ fontSize: isFirst ? (isStory ? 20 * s : 16 * s) : (isStory ? 16 * s : 13 * s), color: theme.accentLight, fontWeight: 700, marginBottom: 10 * s }}>
                  @{row.player.username}
                </div>
                {/* Score */}
                <div style={{ fontSize: isFirst ? (isStory ? 72 * s : 56 * s) : (isStory ? 52 * s : 40 * s), fontWeight: 900, color: medalColors[idx], lineHeight: 1 }}>
                  {row.points}
                </div>
                <div style={{ fontSize: 12 * s, color: "rgba(255,255,255,0.38)", marginTop: 4 * s }}>pts</div>
                <div style={{ fontSize: isFirst ? (isStory ? 20 * s : 16 * s) : (isStory ? 16 * s : 13 * s), color: "rgba(255,255,255,0.40)", marginTop: 6 * s, fontWeight: 600 }}>
                  {row.player.elo} ELO
                </div>
              </div>

              {/* Podium block */}
              <div
                style={{
                  width: "100%",
                  height: blockH,
                  background: `linear-gradient(180deg, ${medalColors[idx]}40 0%, ${medalColors[idx]}18 100%)`,
                  border: `1.5px solid ${medalColors[idx]}60`,
                  borderBottom: "none",
                  borderRadius: `${12 * s}px ${12 * s}px 0 0`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: isFirst ? (isStory ? 64 * s : 52 * s) : (isStory ? 48 * s : 38 * s), fontWeight: 900, color: `${medalColors[idx]}70` }}>
                  #{ranks[idx]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <OTBBrand scale={scale} clubName={config?.clubName} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide 3 — Final Standings ────────────────────────────────────────────────

function Slide3Standings({ rows, config, tournamentName, totalRounds: _totalRounds, scale = 1, hostLogoUrl, theme = DEFAULT_THEME, format = "square" }: SlideProps) {
  const s = scale;
  const isStory = format === "story";
  const FOOTER = 80 * s;
  const PAD_H = 52 * s;
  // Larger header to match Slide 1/2 visual weight
  const HEADER_H = isStory ? 240 * s : 180 * s;
  const COL_HDR_H = isStory ? 56 * s : 50 * s;
  const H = SLIDE_H[format] * s;
  const availH = H - FOOTER - HEADER_H - COL_HDR_H;
  // Taller rows — up from 78 → 100 (square), 90 → 110 (story)
  const ROW_H = isStory ? 110 * s : 100 * s;
  const maxRows = Math.min(rows.length, Math.floor(availH / ROW_H));
  const displayRows = rows.slice(0, maxRows);

  const rankColors: Record<number, string> = { 1: BRAND.gold, 2: BRAND.silver, 3: BRAND.bronze };
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={3} total={TOTAL_SLIDES} scale={scale} />

      {/* Header — larger title matching Slide 1 weight */}
      <div style={{ paddingTop: isStory ? 90 * s : 56 * s, paddingLeft: PAD_H, paddingRight: PAD_H, marginBottom: 24 * s }}>
        <div style={{ fontSize: 15 * s, color: "rgba(255,255,255,0.38)", letterSpacing: "0.22em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 12 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: isStory ? 96 * s : 80 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Final Standings
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `0 ${PAD_H}px`,
          height: COL_HDR_H,
          borderBottom: `2px solid rgba(255,255,255,0.12)`,
          borderTop: `1px solid rgba(255,255,255,0.07)`,
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ width: 60 * s, fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>#</div>
        <div style={{ flex: 1, fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Player</div>
        <div style={{ width: 90 * s, textAlign: "right", fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>ELO</div>
        <div style={{ width: 80 * s, textAlign: "right", fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>PTS</div>
        <div style={{ width: 90 * s, textAlign: "right", fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>W-D-L</div>
      </div>

      {/* Rows */}
      {displayRows.map((row, idx) => {
        const isTop3 = row.rank <= 3;
        const rankColor = isTop3 ? rankColors[row.rank] : "rgba(255,255,255,0.45)";
        // Larger name font — up from 22 → 28 (square), 26 → 32 (story)
        const nameSize = clampFont(isStory ? 32 * s : 28 * s, row.player.name, 18);

        return (
          <div
            key={row.player.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: `0 ${PAD_H}px`,
              height: ROW_H,
              background: idx % 2 === 0 ? "rgba(255,255,255,0.028)" : "transparent",
              borderLeft: isTop3 ? `6px solid ${rankColor}` : "6px solid transparent",
            }}
          >
            {/* Rank — bigger */}
            <div style={{ width: 60 * s, fontSize: isTop3 ? (isStory ? 40 * s : 34 * s) : (isStory ? 28 * s : 24 * s), lineHeight: 1 }}>
              {isTop3
                ? medals[row.rank]
                : <span style={{ fontSize: isStory ? 28 * s : 24 * s, color: rankColor, fontWeight: 800 }}>{row.rank}</span>
              }
            </div>

            {/* Name + username */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: nameSize, fontWeight: 800, color: BRAND.white, lineHeight: 1.15, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.player.name}
                {row.player.title && (
                  <span style={{ marginLeft: 8 * s, fontSize: 13 * s, color: theme.accentLight, fontWeight: 800, background: `${theme.accent}55`, padding: `${3 * s}px ${7 * s}px`, borderRadius: 5 * s }}>
                    {row.player.title}
                  </span>
                )}
              </div>
              <div style={{ fontSize: isStory ? 18 * s : 15 * s, color: "rgba(255,255,255,0.35)", marginTop: 3 * s }}>@{row.player.username}</div>
            </div>

            {/* ELO — up from 18 → 22 */}
            <div style={{ width: 90 * s, textAlign: "right", fontSize: isStory ? 26 * s : 22 * s, color: "rgba(255,255,255,0.52)", fontWeight: 600 }}>
              {row.player.elo}
            </div>

            {/* Points — up from 28 → 38 */}
            <div style={{ width: 80 * s, textAlign: "right", fontSize: isStory ? 42 * s : 38 * s, fontWeight: 900, color: isTop3 ? rankColor : BRAND.white }}>
              {row.points}
            </div>

            {/* W-D-L — up from 14 → 18 */}
            <div style={{ width: 90 * s, textAlign: "right", fontSize: isStory ? 20 * s : 18 * s, color: "rgba(255,255,255,0.42)", fontWeight: 700 }}>
              {row.wins}-{row.draws}-{row.losses}
            </div>
          </div>
        );
      })}

      {rows.length > maxRows && (
        <div style={{ textAlign: "center", marginTop: 12 * s, fontSize: 16 * s, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
          +{rows.length - maxRows} more players
        </div>
      )}

      <OTBBrand scale={scale} clubName={config?.clubName} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide 4 — Stats ─────────────────────────────────────────────────────────

function Slide4Stats({ rows, config, tournamentName, totalRounds, scale = 1, hostLogoUrl, theme = DEFAULT_THEME, format = "square" }: SlideProps) {
  const s = scale;
  const isStory = format === "story";
  const totalGames = totalRounds * Math.floor(rows.length / 2);
  const topPerformer = rows.length
    ? rows.reduce((best, r) => (r.wins > best.wins ? r : best), rows[0])
    : null;
  const highestElo = rows.length
    ? rows.reduce((best, r) => (r.player.elo > best.player.elo ? r : best), rows[0])
    : null;
  const _FOOTER = 80 * s;
  const PAD = 52 * s;

  const stats = [
    { label: "Players", value: String(rows.length), sub: "registered" },
    { label: "Rounds", value: String(totalRounds), sub: formatFormat(config?.format) },
    { label: "Avg ELO", value: String(avgElo(rows)), sub: "rating" },
    { label: "Games", value: String(totalGames), sub: "played" },
  ];

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={4} total={TOTAL_SLIDES} scale={scale} />

      {/* Header */}
      <div style={{ paddingTop: isStory ? 80 * s : 52 * s, paddingLeft: PAD, paddingRight: PAD, marginBottom: isStory ? 60 * s : 44 * s }}>
        <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.32)", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 10 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: isStory ? 88 * s : 72 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.025em", lineHeight: 1 }}>
          By the Numbers
        </div>
      </div>

      {/* Stats grid — 2×2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: isStory ? 28 * s : 20 * s,
          padding: `0 ${PAD}px`,
          marginBottom: isStory ? 48 * s : 28 * s,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "rgba(255,255,255,0.045)",
              border: "1.5px solid rgba(255,255,255,0.09)",
              borderRadius: 20 * s,
              padding: isStory ? `${52 * s}px ${36 * s}px` : `${36 * s}px ${28 * s}px`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12 * s, color: theme.accentLight, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" as const, marginBottom: 12 * s }}>
              {stat.label}
            </div>
            <div style={{ fontSize: isStory ? 110 * s : 88 * s, fontWeight: 900, color: BRAND.white, lineHeight: 0.9, letterSpacing: "-0.03em" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: isStory ? 18 * s : 15 * s, color: "rgba(255,255,255,0.32)", marginTop: 10 * s, fontWeight: 600 }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Highlight rows */}
      <div style={{ padding: `0 ${PAD}px`, display: "flex", flexDirection: "column" as const, gap: isStory ? 20 * s : 14 * s }}>
        {topPerformer && (
          <div
            style={{
              background: `${theme.accent}28`,
              border: `1.5px solid ${theme.accent}50`,
              borderRadius: 16 * s,
              padding: isStory ? `${26 * s}px ${32 * s}px` : `${18 * s}px ${24 * s}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: isStory ? 17 * s : 14 * s, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
              Most Wins
            </div>
            <div style={{ fontSize: isStory ? 26 * s : 22 * s, fontWeight: 900, color: BRAND.white }}>
              {topPerformer.player.name}{" "}
              <span style={{ color: theme.accentLight, fontWeight: 700 }}>({topPerformer.wins}W)</span>
            </div>
          </div>
        )}
        {highestElo && (
          <div
            style={{
              background: `${BRAND.gold}14`,
              border: `1.5px solid ${BRAND.gold}38`,
              borderRadius: 16 * s,
              padding: isStory ? `${26 * s}px ${32 * s}px` : `${18 * s}px ${24 * s}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: isStory ? 17 * s : 14 * s, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
              Highest Rated
            </div>
            <div style={{ fontSize: isStory ? 26 * s : 22 * s, fontWeight: 900, color: BRAND.white }}>
              {highestElo.player.name}{" "}
              <span style={{ color: BRAND.gold, fontWeight: 700 }}>({highestElo.player.elo})</span>
            </div>
          </div>
        )}
        {/* Story: additional stat rows to fill the extra canvas */}
        {isStory && rows.length > 0 && (
          <>
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16 * s,
                padding: `${26 * s}px ${32 * s}px`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 17 * s, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
                Champion
              </div>
              <div style={{ fontSize: 26 * s, fontWeight: 900, color: BRAND.white }}>
                {rows[0].player.name}{" "}
                <span style={{ color: BRAND.gold, fontWeight: 700 }}>({rows[0].points} pts)</span>
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16 * s,
                padding: `${26 * s}px ${32 * s}px`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 17 * s, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
                Format
              </div>
              <div style={{ fontSize: 26 * s, fontWeight: 900, color: BRAND.white }}>
                {formatFormat(config?.format)} · {totalRounds} Rounds
              </div>
            </div>
          </>
        )}
      </div>

      <OTBBrand scale={scale} clubName={config?.clubName} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide 5 — CTA ───────────────────────────────────────────────────────────

function Slide5CTA({ rows: _rows, config, tournamentName: _tournamentName, totalRounds: _totalRounds, scale = 1, hostLogoUrl, theme = DEFAULT_THEME, format = "square" }: SlideProps) {
  const s = scale;
  const isStory = format === "story";
  const clubName = config?.clubName;
  const inviteCode = config?.inviteCode;
  const headline = clubName ? `Play at\n${clubName}` : "Play Over\nThe Board";

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={5} total={TOTAL_SLIDES} scale={scale} />

      {/* Giant OTB watermark — fills the background */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: isStory ? 480 * s : 380 * s,
          fontWeight: 900,
          fontStyle: "italic",
          color: `${theme.accent}1A`,
          letterSpacing: "-0.05em",
          userSelect: "none",
          lineHeight: 0.85,
          whiteSpace: "nowrap" as const,
          pointerEvents: "none",
        }}
      >
        OTB
      </div>

      {/* Content — vertically centered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          bottom: 80 * s,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "flex-start",
          justifyContent: "center",
          padding: `0 ${64 * s}px`,
          gap: isStory ? 40 * s : 28 * s,
        }}
      >
        {/* Eyebrow */}
        <div style={{ fontSize: isStory ? 18 * s : 14 * s, color: "rgba(255,255,255,0.38)", letterSpacing: "0.22em", fontWeight: 800, textTransform: "uppercase" as const }}>
          Join the Community
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: clampFont(isStory ? 130 * s : 100 * s, headline, 14),
            fontWeight: 900,
            color: BRAND.white,
            lineHeight: 0.95,
            letterSpacing: "-0.03em",
            whiteSpace: "pre-line" as const,
          }}
        >
          {headline}
        </div>

        {/* Body copy */}
        <div style={{ fontSize: isStory ? 28 * s : 22 * s, color: "rgba(255,255,255,0.45)", lineHeight: 1.55, maxWidth: 820 * s }}>
          Chess tournaments, organised in minutes.{"\n"}
          Swiss pairings · ELO tracking · Live standings
        </div>

        {/* CTA pill */}
        <div
          style={{
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.bgDark === "#0A1A0E" ? "#1A3A22" : theme.bgDark} 100%)`,
            border: `1.5px solid ${theme.accentLight}55`,
            borderRadius: 100 * s,
            padding: isStory ? `${28 * s}px ${72 * s}px` : `${20 * s}px ${52 * s}px`,
            fontSize: isStory ? 32 * s : 24 * s,
            fontWeight: 900,
            color: BRAND.white,
            letterSpacing: "0.04em",
            display: "inline-block",
          }}
        >
          otbchess.club
        </div>

        {inviteCode && (
          <div style={{ fontSize: isStory ? 20 * s : 16 * s, color: "rgba(255,255,255,0.28)", marginTop: -8 * s }}>
            Tournament code:{" "}
            <span style={{ color: theme.accentLight, fontWeight: 800 }}>{inviteCode}</span>
          </div>
        )}

        {/* Story: QR-like decorative element */}
        {isStory && (
          <div style={{ display: "flex", alignItems: "center", gap: 16 * s, marginTop: 8 * s }}>
            <div style={{ width: 80 * s, height: 80 * s, background: `${theme.accent}30`, border: `2px solid ${theme.accentLight}40`, borderRadius: 12 * s, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 * s }}>
              ♟
            </div>
            <div style={{ fontSize: 18 * s, color: "rgba(255,255,255,0.30)", fontWeight: 600 }}>
              Scan · Join · Play
            </div>
          </div>
        )}
      </div>

      <OTBBrand scale={scale} clubName={clubName} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide 6 — Round-by-Round Results ────────────────────────────────────────

/**
 * Builds a per-player, per-round outcome map from raw Round[] data.
 * Returns: Map<playerId, Array<"W"|"D"|"L"|"BYE"|"—">>
 */
function buildRoundGrid(
  rows: StandingRow[],
  rounds: Round[],
  totalRounds: number
): Map<string, ("W" | "D" | "L" | "BYE" | "—")[]> {
  const grid = new Map<string, ("W" | "D" | "L" | "BYE" | "—")[]>();

  for (const row of rows) {
    grid.set(row.player.id, Array(totalRounds).fill("—"));
  }

  for (const round of rounds) {
    if (round.status !== "completed") continue;
    const rIdx = round.number - 1;
    if (rIdx < 0 || rIdx >= totalRounds) continue;

    for (const game of round.games) {
      const { whiteId, blackId, result } = game;

      if (!blackId || blackId === "BYE" || blackId === "") {
        const byeRow = grid.get(whiteId);
        if (byeRow) byeRow[rIdx] = "BYE";
        continue;
      }

      const whiteRow = grid.get(whiteId);
      const blackRow = grid.get(blackId);

      if (result === "1-0") {
        if (whiteRow) whiteRow[rIdx] = "W";
        if (blackRow) blackRow[rIdx] = "L";
      } else if (result === "0-1") {
        if (whiteRow) whiteRow[rIdx] = "L";
        if (blackRow) blackRow[rIdx] = "W";
      } else if (result === "½-½") {
        if (whiteRow) whiteRow[rIdx] = "D";
        if (blackRow) blackRow[rIdx] = "D";
      }
    }
  }

  return grid;
}

function Slide6RoundResults({ rows, config, tournamentName, totalRounds, scale = 1, hostLogoUrl, theme = DEFAULT_THEME, rounds = [], format = "square" }: SlideProps) {
  const s = scale;
  const isStory = format === "story";
  const FOOTER = 80 * s;
  const PAD = 52 * s;
  // Larger header matching Slide 3 weight
  const HEADER_H = isStory ? 240 * s : 180 * s;
  const H = SLIDE_H[format] * s;

  const grid = buildRoundGrid(rows, rounds, totalRounds);

  // Taller rows — up from 68 → 90 (square), 84 → 104 (story)
  const ROW_H = isStory ? 104 * s : 90 * s;
  const COL_HEADER_H = isStory ? 56 * s : 50 * s;
  const availH = H - FOOTER - HEADER_H - COL_HEADER_H;
  const maxPlayers = Math.min(rows.length, Math.floor(availH / ROW_H));
  const displayRows = rows.slice(0, maxPlayers);

  // Wider name column and rank column to match Slide 3
  const NAME_COL = isStory ? 340 * s : 300 * s;
  const RANK_COL = 56 * s;
  const PTS_COL = 68 * s;
  const tableW = SLIDE_W * s - PAD * 2;
  const roundColsW = tableW - NAME_COL - RANK_COL - PTS_COL;
  const roundColW = Math.min(isStory ? 88 * s : 80 * s, roundColsW / Math.max(1, totalRounds));

  const cellStyle = (outcome: string): React.CSSProperties => {
    if (outcome === "W") return { background: "#2D5A3A", color: "#6FCF97", border: "2px solid #3D7A4A" };
    if (outcome === "L") return { background: "#5A2D2D", color: "#EB5757", border: "2px solid #7A3D3D" };
    if (outcome === "D") return { background: "#3A3A1A", color: "#F2C94C", border: "2px solid #5A5A2A" };
    if (outcome === "BYE") return { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.30)", border: "2px solid rgba(255,255,255,0.08)" };
    return { background: "transparent", color: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.06)" };
  };

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={6} total={TOTAL_SLIDES} scale={scale} />

      {/* Header — larger title matching Slide 3 */}
      <div style={{ paddingTop: isStory ? 90 * s : 56 * s, paddingLeft: PAD, paddingRight: PAD, marginBottom: 24 * s }}>
        <div style={{ fontSize: 15 * s, color: "rgba(255,255,255,0.38)", letterSpacing: "0.22em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 12 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: isStory ? 88 * s : 74 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Round by Round
        </div>
      </div>

      {/* Column header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `0 ${PAD}px`,
          height: COL_HEADER_H,
          borderBottom: "2px solid rgba(255,255,255,0.12)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ width: RANK_COL, fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>#</div>
        <div style={{ width: NAME_COL, fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Player</div>
        {Array.from({ length: totalRounds }, (_, i) => (
          <div
            key={i}
            style={{
              width: roundColW,
              textAlign: "center",
              fontSize: 13 * s,
              color: "rgba(255,255,255,0.32)",
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            R{i + 1}
          </div>
        ))}
        <div style={{ width: PTS_COL, textAlign: "right", fontSize: 13 * s, color: "rgba(255,255,255,0.32)", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>Pts</div>
      </div>

      {/* Player rows */}
      {displayRows.map((row, idx) => {
        const outcomes = grid.get(row.player.id) ?? Array(totalRounds).fill("—");
        const isTop3 = row.rank <= 3;
        const rankColors: Record<number, string> = { 1: BRAND.gold, 2: BRAND.silver, 3: BRAND.bronze };
        const rankColor = isTop3 ? rankColors[row.rank] : "rgba(255,255,255,0.40)";
        // Larger name font — up from 18 → 26 (square), 22 → 30 (story)
        const nameSize = clampFont(isStory ? 30 * s : 26 * s, row.player.name, 18);

        return (
          <div
            key={row.player.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: `0 ${PAD}px`,
              height: ROW_H,
              background: idx % 2 === 0 ? "rgba(255,255,255,0.028)" : "transparent",
              borderLeft: isTop3 ? `6px solid ${rankColor}` : "6px solid transparent",
            }}
          >
            {/* Rank — up from 14 → 22 (square) */}
            <div style={{ width: RANK_COL, fontSize: isStory ? 22 * s : 20 * s, color: rankColor, fontWeight: 800 }}>
              {row.rank}
            </div>

            <div style={{ width: NAME_COL, minWidth: 0 }}>
              <div style={{ fontSize: nameSize, fontWeight: 800, color: BRAND.white, lineHeight: 1.2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.player.name}
              </div>
              <div style={{ fontSize: isStory ? 16 * s : 14 * s, color: "rgba(255,255,255,0.32)", marginTop: 3 * s }}>@{row.player.username}</div>
            </div>

            {outcomes.map((outcome, rIdx) => (
              <div
                key={rIdx}
                style={{
                  width: roundColW,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    // Bigger cells — up from 48 → 62 (square), 56 → 70 (story)
                    width: Math.min(isStory ? 70 * s : 62 * s, roundColW * 0.82),
                    height: Math.min(isStory ? 70 * s : 62 * s, ROW_H * 0.72),
                    borderRadius: 10 * s,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    // Larger letter inside cell — up from 16 → 22 (square)
                    fontSize: outcome === "BYE" ? (isStory ? 12 * s : 11 * s) : (isStory ? 24 * s : 22 * s),
                    fontWeight: 900,
                    letterSpacing: outcome === "BYE" ? "0.03em" : 0,
                    ...cellStyle(outcome),
                  }}
                >
                  {outcome}
                </div>
              </div>
            ))}

            {/* Points — up from 22 → 30 (square) */}
            <div style={{ width: PTS_COL, textAlign: "right", fontSize: isStory ? 34 * s : 30 * s, fontWeight: 900, color: isTop3 ? rankColor : BRAND.white }}>
              {row.points}
            </div>
          </div>
        );
      })}

      {rows.length > maxPlayers && (
        <div style={{ textAlign: "center", marginTop: 12 * s, fontSize: 16 * s, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
          +{rows.length - maxPlayers} more players
        </div>
      )}

      {/* Legend — larger swatches */}
      <div
        style={{
          position: "absolute",
          bottom: FOOTER + 14 * s,
          left: PAD,
          right: PAD,
          display: "flex",
          gap: 20 * s,
          alignItems: "center",
        }}
      >
        {(["W", "D", "L", "BYE"] as const).map((label) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 * s }}>
            <div
              style={{
                width: 26 * s,
                height: 26 * s,
                borderRadius: 6 * s,
                fontSize: 11 * s,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...cellStyle(label),
              }}
            >
              {label === "BYE" ? "B" : label}
            </div>
            <div style={{ fontSize: 14 * s, color: "rgba(255,255,255,0.40)", fontWeight: 700 }}>
              {label === "W" ? "Win" : label === "D" ? "Draw" : label === "L" ? "Loss" : "Bye"}
            </div>
          </div>
        ))}
      </div>

      <OTBBrand scale={scale} clubName={config?.clubName} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide 7 — Bracket Results ───────────────────────────────────────────────

/**
 * Extract bracket results from elimination rounds.
 * Returns champion, runner-up, and semifinalists.
 */
export function extractBracketResults(
  rounds: Round[],
  players: { id: string; name: string; username: string; elo: number }[],
  elimStartRound = 1
): {
  champion: { id: string; name: string; username: string; elo: number } | null;
  runnerUp: { id: string; name: string; username: string; elo: number } | null;
  semifinalists: { id: string; name: string; username: string; elo: number }[];
  finalRoundLabel: string;
  hasBracketData: boolean;
} {
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Only look at elimination rounds
  const elimRounds = rounds
    .filter((r) => r.number >= elimStartRound && r.status === "completed")
    .sort((a, b) => a.number - b.number);

  if (!elimRounds.length) {
    return { champion: null, runnerUp: null, semifinalists: [], finalRoundLabel: "", hasBracketData: false };
  }

  // Find the final round (last completed elim round with exactly 1 real game)
  const finalRound = [...elimRounds].reverse().find((r) => {
    const realGames = r.games.filter((g) => g.whiteId !== "BYE" && g.blackId !== "BYE");
    return realGames.length === 1;
  }) ?? elimRounds[elimRounds.length - 1];

  const finalGame = finalRound.games.find((g) => g.whiteId !== "BYE" && g.blackId !== "BYE");
  if (!finalGame) {
    return { champion: null, runnerUp: null, semifinalists: [], finalRoundLabel: "", hasBracketData: false };
  }

  // Champion = winner of the final; Runner-up = loser
  let championId: string | null = null;
  let runnerUpId: string | null = null;

  if (finalGame.result === "1-0") {
    championId = finalGame.whiteId;
    runnerUpId = finalGame.blackId;
  } else if (finalGame.result === "0-1") {
    championId = finalGame.blackId;
    runnerUpId = finalGame.whiteId;
  } else {
    // Unresolved final — show both as finalists
    championId = finalGame.whiteId;
    runnerUpId = finalGame.blackId;
  }

  const champion = championId ? (playerMap.get(championId) ?? null) : null;
  const runnerUp = runnerUpId ? (playerMap.get(runnerUpId) ?? null) : null;

  // Semifinalists = losers of the round before the final
  const semifinalists: { id: string; name: string; username: string; elo: number }[] = [];
  const finalRoundIdx = elimRounds.findIndex((r) => r.number === finalRound.number);
  if (finalRoundIdx > 0) {
    const semiRound = elimRounds[finalRoundIdx - 1];
    for (const game of semiRound.games) {
      if (game.whiteId === "BYE" || game.blackId === "BYE") continue;
      let loserId: string | null = null;
      if (game.result === "1-0") loserId = game.blackId;
      else if (game.result === "0-1") loserId = game.whiteId;
      if (loserId) {
        const p = playerMap.get(loserId);
        if (p) semifinalists.push(p);
      }
    }
  }

  // Determine the label for the final round based on player count
  const finalRoundPlayerCount = finalRound.games.filter(
    (g) => g.whiteId !== "BYE" && g.blackId !== "BYE"
  ).length * 2;
  const finalRoundLabel = finalRoundPlayerCount <= 2 ? "Final" : `Round of ${finalRoundPlayerCount}`;

  return {
    champion,
    runnerUp,
    semifinalists,
    finalRoundLabel,
    hasBracketData: champion !== null,
  };
}

function Slide7BracketResults({
  rows,
  config,
  tournamentName,
  scale = 1,
  hostLogoUrl,
  theme = DEFAULT_THEME,
  rounds = [],
  format = "square",
}: SlideProps) {
  const s = scale;
  const isStory = format === "story";
  const FOOTER = 80 * s;
  const PAD = 56 * s;
  const H = SLIDE_H[format] * s;
  const W = SLIDE_W * s;

  // Compute elimStartRound — for swiss_elim, elim rounds start after swiss rounds
  const swissRounds = (config as (typeof config & { swissRounds?: number }))?.swissRounds ?? 0;
  const elimStartRound = swissRounds > 0 ? swissRounds + 1 : 1;

  const players = rows.map((r) => r.player);
  const { champion, runnerUp, semifinalists, hasBracketData } = extractBracketResults(
    rounds,
    players,
    elimStartRound
  );

  const date = formatDate(config?.date);

  // ── Layout helpers ──────────────────────────────────────────────────────────
  const CONTENT_TOP = isStory ? 160 * s : 100 * s;
  const CONTENT_H = H - FOOTER - CONTENT_TOP;

  // Champion card dimensions
  const CHAMP_H = isStory ? 340 * s : 280 * s;
  const CHAMP_W = W - PAD * 2;

  // Runner-up / semifinalist card dimensions
  const CARD_H = isStory ? 180 * s : 150 * s;
  const CARD_GAP = 16 * s;
  const RUNNER_W = CHAMP_W;
  const SEMI_W = (CHAMP_W - CARD_GAP) / 2;

  return (
    <SlideWrapper scale={scale} theme={theme} format={format}>
      <SlideCounter current={7} total={7} scale={scale} />

      {/* ── Header ── */}
      <div
        style={{
          paddingTop: isStory ? 90 * s : 52 * s,
          paddingLeft: PAD,
          paddingRight: PAD,
          marginBottom: 24 * s,
        }}
      >
        <div
          style={{
            fontSize: 13 * s,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.22em",
            fontWeight: 700,
            textTransform: "uppercase" as const,
            marginBottom: 10 * s,
          }}
        >
          {tournamentName}{date ? ` · ${date}` : ""}
        </div>
        <div
          style={{
            fontSize: isStory ? 88 * s : 72 * s,
            fontWeight: 900,
            color: BRAND.white,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Final Results
        </div>
        {/* Accent underline */}
        <div
          style={{
            width: 80 * s,
            height: 5 * s,
            borderRadius: 3 * s,
            background: theme.accentBright,
            marginTop: 14 * s,
          }}
        />
      </div>

      {hasBracketData ? (
        <div
          style={{
            position: "absolute",
            top: CONTENT_TOP,
            left: PAD,
            right: PAD,
            display: "flex",
            flexDirection: "column" as const,
            gap: CARD_GAP,
          }}
        >
          {/* ── Champion card ── */}
          {champion && (
            <div
              style={{
                width: CHAMP_W,
                height: CHAMP_H,
                borderRadius: 20 * s,
                background: `linear-gradient(135deg, ${theme.accent}CC 0%, ${theme.bg}EE 100%)`,
                border: `3px solid ${BRAND.gold}`,
                boxShadow: `0 0 ${60 * s}px ${BRAND.gold}40`,
                display: "flex",
                alignItems: "center",
                padding: `0 ${40 * s}px`,
                gap: 28 * s,
                position: "relative" as const,
                overflow: "hidden",
              }}
            >
              {/* Gold glow behind */}
              <div
                style={{
                  position: "absolute",
                  top: "-30%",
                  right: "-10%",
                  width: CHAMP_H * 1.2,
                  height: CHAMP_H * 1.2,
                  background: `radial-gradient(circle, ${BRAND.gold}22 0%, transparent 65%)`,
                }}
              />
              {/* Trophy icon */}
              <div
                style={{
                  width: isStory ? 100 * s : 80 * s,
                  height: isStory ? 100 * s : 80 * s,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${BRAND.gold}33, ${BRAND.gold}11)`,
                  border: `2px solid ${BRAND.gold}60`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isStory ? 52 * s : 42 * s,
                  flexShrink: 0,
                }}
              >
                🏆
              </div>
              {/* Player info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13 * s,
                    color: BRAND.gold,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase" as const,
                    marginBottom: 8 * s,
                  }}
                >
                  Champion
                </div>
                <div
                  style={{
                    fontSize: clampFont(isStory ? 72 * s : 58 * s, champion.name, 16),
                    fontWeight: 900,
                    color: BRAND.white,
                    lineHeight: 1.1,
                    whiteSpace: "nowrap" as const,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {champion.name}
                </div>
                <div
                  style={{
                    fontSize: isStory ? 26 * s : 22 * s,
                    color: "rgba(255,255,255,0.45)",
                    marginTop: 6 * s,
                    fontWeight: 600,
                  }}
                >
                  @{champion.username} · {champion.elo} ELO
                </div>
              </div>
            </div>
          )}

          {/* ── Runner-up card ── */}
          {runnerUp && (
            <div
              style={{
                width: RUNNER_W,
                height: CARD_H,
                borderRadius: 16 * s,
                background: `linear-gradient(135deg, rgba(200,208,216,0.12) 0%, rgba(0,0,0,0.18) 100%)`,
                border: `2px solid ${BRAND.silver}60`,
                display: "flex",
                alignItems: "center",
                padding: `0 ${32 * s}px`,
                gap: 22 * s,
              }}
            >
              <div
                style={{
                  width: isStory ? 64 * s : 52 * s,
                  height: isStory ? 64 * s : 52 * s,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${BRAND.silver}33, ${BRAND.silver}11)`,
                  border: `2px solid ${BRAND.silver}50`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isStory ? 34 * s : 28 * s,
                  flexShrink: 0,
                }}
              >
                🥈
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11 * s,
                    color: BRAND.silver,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6 * s,
                  }}
                >
                  Runner-Up
                </div>
                <div
                  style={{
                    fontSize: clampFont(isStory ? 48 * s : 38 * s, runnerUp.name, 18),
                    fontWeight: 800,
                    color: BRAND.white,
                    whiteSpace: "nowrap" as const,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {runnerUp.name}
                </div>
                <div style={{ fontSize: isStory ? 20 * s : 16 * s, color: "rgba(255,255,255,0.38)", marginTop: 4 * s }}>
                  @{runnerUp.username} · {runnerUp.elo} ELO
                </div>
              </div>
            </div>
          )}

          {/* ── Semifinalists row ── */}
          {semifinalists.length > 0 && (
            <div style={{ display: "flex", gap: CARD_GAP }}>
              {semifinalists.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  style={{
                    width: SEMI_W,
                    height: CARD_H * 0.85,
                    borderRadius: 14 * s,
                    background: `linear-gradient(135deg, rgba(205,127,50,0.10) 0%, rgba(0,0,0,0.18) 100%)`,
                    border: `2px solid ${BRAND.bronze}40`,
                    display: "flex",
                    alignItems: "center",
                    padding: `0 ${22 * s}px`,
                    gap: 16 * s,
                  }}
                >
                  <div
                    style={{
                      width: isStory ? 52 * s : 42 * s,
                      height: isStory ? 52 * s : 42 * s,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${BRAND.bronze}33, ${BRAND.bronze}11)`,
                      border: `2px solid ${BRAND.bronze}40`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: isStory ? 28 * s : 22 * s,
                      flexShrink: 0,
                    }}
                  >
                    🥉
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10 * s,
                        color: BRAND.bronze,
                        fontWeight: 800,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase" as const,
                        marginBottom: 5 * s,
                      }}
                    >
                      Semifinalist
                    </div>
                    <div
                      style={{
                        fontSize: clampFont(isStory ? 34 * s : 28 * s, p.name, 14),
                        fontWeight: 800,
                        color: BRAND.white,
                        whiteSpace: "nowrap" as const,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: isStory ? 16 * s : 13 * s, color: "rgba(255,255,255,0.35)", marginTop: 3 * s }}>
                      {p.elo} ELO
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Placeholder when bracket isn't complete yet */
        <div
          style={{
            position: "absolute",
            top: CONTENT_TOP,
            left: PAD,
            right: PAD,
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            justifyContent: "center",
            height: CONTENT_H,
            gap: 16 * s,
          }}
        >
          <div style={{ fontSize: isStory ? 80 * s : 64 * s }}>🏆</div>
          <div
            style={{
              fontSize: isStory ? 32 * s : 26 * s,
              color: "rgba(255,255,255,0.35)",
              fontWeight: 700,
              textAlign: "center" as const,
            }}
          >
            Bracket results will appear here when the tournament is complete.
          </div>
        </div>
      )}

      <OTBBrand scale={scale} clubName={config?.clubName} hostLogoUrl={hostLogoUrl} theme={theme} />
    </SlideWrapper>
  );
}

// ─── Slide registry ───────────────────────────────────────────────────────────

const SLIDES_BASE = [
  { id: "cover", label: "Cover", Component: Slide1Cover },
  { id: "podium", label: "Podium", Component: Slide2Podium },
  { id: "standings", label: "Standings", Component: Slide3Standings },
  { id: "stats", label: "Stats", Component: Slide4Stats },
  { id: "cta", label: "CTA", Component: Slide5CTA },
  { id: "rounds", label: "Rounds", Component: Slide6RoundResults },
];

const SLIDES_WITH_BRACKET = [
  ...SLIDES_BASE,
  { id: "bracket", label: "Bracket", Component: Slide7BracketResults },
];

/** Get the slide list based on tournament format */
function getSlides(format?: string | null) {
  if (format === "elimination" || format === "swiss_elim") return SLIDES_WITH_BRACKET;
  return SLIDES_BASE;
}

// ─── Mobile detection ─────────────────────────────────────────────────────────

function isMobileDevice(): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (typeof window !== "undefined" && window.innerWidth < 768);
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function InstagramCarouselModal({ open, onClose, rows, config, tournamentName, totalRounds, rounds = [], clubLogoUrl }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [hostLogoUrl, setHostLogoUrl] = useState<string | null>(clubLogoUrl ?? null);

  // When the club avatar loads asynchronously (useClubAvatar hook), pre-seed it
  // only if the director hasn't manually set or cleared a custom logo yet.
  const clubLogoSeedRef = useRef<string | null | undefined>(clubLogoUrl);
  useEffect(() => {
    // Only auto-update when the incoming URL changes and the director hasn't
    // overridden it with a different custom upload.
    if (clubLogoUrl !== clubLogoSeedRef.current) {
      clubLogoSeedRef.current = clubLogoUrl;
      setHostLogoUrl(clubLogoUrl ?? null);
    }
  }, [clubLogoUrl]);
  const [logoDragging, setLogoDragging] = useState(false);
  const [activeTheme, setActiveTheme] = useState<SlideTheme>(DEFAULT_THEME);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [slideFormat, setSlideFormat] = useState<SlideFormat>("square");
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const slideProps: SlideProps = {
    rows,
    config,
    tournamentName,
    totalRounds,
    scale: 1,
    hostLogoUrl,
    theme: activeTheme,
    rounds,
    format: slideFormat,
  };

  // Dynamic slide list — adds Bracket slide for elimination formats
  const SLIDES = getSlides(config?.format);

  const isStory = slideFormat === "story";
  const slideH = SLIDE_H[slideFormat];

  // Preview scale — fits the modal width; story format is narrower
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const PREVIEW_W_SCALE = isMobile ? 0.30 : 0.42;
  // For story: keep same width scale but height grows proportionally
  const PREVIEW_SCALE = PREVIEW_W_SCALE;
  const previewW = SLIDE_W * PREVIEW_SCALE;
  const previewH = slideH * PREVIEW_SCALE;

  // ── Logo upload handler ──────────────────────────────────────────────────────
  const handleLogoFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") setHostLogoUrl(result);
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Export single slide as Blob ──────────────────────────────────────────────
  const exportSlide = useCallback(async (idx: number): Promise<Blob | null> => {
    const el = slideRefs.current[idx];
    if (!el) return null;
    try {
      const { toBlob: htiToBlob } = await import("html-to-image");
      const blob = await htiToBlob(el, {
        pixelRatio: 1,
        width: SLIDE_W,
        height: slideH,
        fetchRequestInit: { mode: "cors" },
      });
      return blob ?? null;
    } catch (err) {
      logger.error("[carousel] Export error", err);
      return null;
    }
  }, [slideH]);

  // ── Download single slide (with mobile Web Share API fallback) ───────────────
  const downloadSingle = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await exportSlide(activeSlide);
      if (!blob) return;

      const formatSuffix = isStory ? "story" : "carousel";
      const fileName = `${tournamentName.replace(/\s+/g, "_")}_${formatSuffix}_slide_${activeSlide + 1}_${SLIDES[activeSlide].id}.png`;

      if (isMobileDevice() && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${tournamentName} — Slide ${activeSlide + 1}`,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2500);
            return;
          } catch (shareErr) {
            if ((shareErr as Error).name === "AbortError") return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [SLIDES, activeSlide, exportSlide, tournamentName, isStory]);

  // ── Download all as ZIP ──────────────────────────────────────────────────────
  const downloadAll = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const JSZip = (await import("jszip")).default;
      const formatSuffix = isStory ? "Story" : "Carousel";
      const zip = new JSZip();
      const folder = zip.folder(`${tournamentName.replace(/\s+/g, "_")}_Instagram_${formatSuffix}`);
      if (!folder) return;

      for (let i = 0; i < SLIDES.length; i++) {
        setExportProgress(Math.round((i / SLIDES.length) * 80));
        const blob = await exportSlide(i);
        if (blob) {
          folder.file(`slide_${i + 1}_${SLIDES[i].id}.png`, blob);
        }
      }

      setExportProgress(90);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      setExportProgress(100);

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tournamentName.replace(/\s+/g, "_")}_Instagram_${formatSuffix}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [SLIDES, exportSlide, tournamentName, isStory]);

  if (!open) return null;

  const canShare = isMobileDevice() && typeof navigator.canShare === "function";

  return (
    <div
      className="modal-overlay z-[9999]"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative flex flex-col rounded-2xl overflow-hidden shadow-2xl w-full max-w-2xl max-h-[95dvh] ${
          isDark ? "bg-[#0F1F13] border border-white/10" : "bg-white border border-gray-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 ${isDark ? "border-white/08" : "border-gray-100"}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] flex items-center justify-center flex-shrink-0">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Instagram Carousel</h2>
              <p className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {SLIDES.length} slides · {isStory ? "1080×1920 Story" : "1080×1080 Square"} · PNG
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
              isDark ? "hover:bg-white/08 text-white/50" : "hover:bg-gray-100 text-gray-400"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-4 p-5">

            {/* ── Format Toggle ── */}
            <div className={`w-full rounded-2xl border p-1 flex gap-1 ${isDark ? "border-white/08 bg-white/03" : "border-gray-200 bg-gray-50"}`}>
              <button
                onClick={() => setSlideFormat("square")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  slideFormat === "square"
                    ? isDark
                      ? "bg-white/10 text-white shadow-sm"
                      : "bg-white text-gray-900 shadow-sm"
                    : isDark
                    ? "text-white/40 hover:text-white/60"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Square · 1080×1080
              </button>
              <button
                onClick={() => setSlideFormat("story")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  slideFormat === "story"
                    ? "bg-gradient-to-r from-[#833AB4] to-[#FD1D1D] text-white shadow-sm"
                    : isDark
                    ? "text-white/40 hover:text-white/60"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Story · 1080×1920
              </button>
            </div>

            {/* ── Active slide preview ── */}
            <div
              className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex-shrink-0"
              style={{ width: previewW, height: previewH }}
            >
              {SLIDES.map(({ Component }, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    opacity: idx === activeSlide ? 1 : 0,
                    transition: "opacity 0.18s ease",
                    pointerEvents: idx === activeSlide ? "auto" : "none",
                  }}
                >
                  {/* Hidden full-size render for export */}
                  <div
                    ref={(el) => { slideRefs.current[idx] = el; }}
                    style={{
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: "top left",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  >
                    <Component {...slideProps} scale={1} />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Slide navigation ── */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveSlide((p) => Math.max(0, p - 1))}
                disabled={activeSlide === 0}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isDark
                    ? "bg-white/06 hover:bg-white/12 text-white/60 disabled:opacity-30"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-30"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                {SLIDES.map((slide, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlide(idx)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`rounded-full transition-all ${
                        idx === activeSlide
                          ? "w-6 h-2 bg-[#3D6B47]"
                          : isDark
                          ? "w-2 h-2 bg-white/20 hover:bg-white/40"
                          : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                    <span className={`text-[10px] font-medium transition-colors ${
                      idx === activeSlide
                        ? "text-[#3D6B47]"
                        : isDark ? "text-white/30 group-hover:text-white/50" : "text-gray-300 group-hover:text-gray-500"
                    }`}>
                      {slide.label}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveSlide((p) => Math.min(SLIDES.length - 1, p + 1))}
                disabled={activeSlide === SLIDES.length - 1}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isDark
                    ? "bg-white/06 hover:bg-white/12 text-white/60 disabled:opacity-30"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-30"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* ── Host Logo Upload ── */}
            <div className={`w-full rounded-2xl border p-4 ${isDark ? "border-white/08 bg-white/03" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-xs font-bold ${isDark ? "text-white/70" : "text-gray-700"}`}>Club / Host Logo</p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {clubLogoUrl ? "Auto-loaded from your club profile — override or remove below" : "Appears on every slide alongside the OTB!! mark"}
                  </p>
                </div>
                {hostLogoUrl && (
                  <button
                    onClick={() => setHostLogoUrl(null)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50"}`}
                  >
                    Remove
                  </button>
                )}
              </div>

              {hostLogoUrl ? (
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl overflow-hidden border p-2 flex items-center justify-center ${isDark ? "border-white/10 bg-white/05" : "border-gray-200 bg-white"}`} style={{ width: 72, height: 48 }}>
                    <img src={hostLogoUrl} alt="Host logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-700"}`}>Logo uploaded</p>
                    <button onClick={() => logoInputRef.current?.click()} className={`text-[10px] mt-0.5 ${isDark ? "text-[#769656] hover:text-[#4CAF50]" : "text-[#3D6B47] hover:text-[#2A4A32]"}`}>
                      Change image
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setLogoDragging(true); }}
                  onDragLeave={() => setLogoDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setLogoDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleLogoFile(file);
                  }}
                  className={`w-full rounded-xl border-2 border-dashed py-4 flex flex-col items-center gap-1.5 transition-colors ${
                    logoDragging
                      ? isDark ? "border-[#769656] bg-[#769656]/10" : "border-[#3D6B47] bg-[#3D6B47]/05"
                      : isDark ? "border-white/10 hover:border-white/20" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? "text-white/30" : "text-gray-400"}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className={`text-xs font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>Upload logo (PNG, SVG, JPG)</span>
                  <span className={`text-[10px] ${isDark ? "text-white/20" : "text-gray-300"}`}>Click or drag &amp; drop</span>
                </button>
              )}

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            {/* ── Colour Theme Picker ── */}
            <div className={`w-full rounded-2xl border p-4 ${isDark ? "border-white/08 bg-white/03" : "border-gray-200 bg-gray-50"}`}>
              <p className={`text-xs font-bold mb-3 ${isDark ? "text-white/70" : "text-gray-700"}`}>Slide Colour Theme</p>
              <div className="flex items-center gap-2 flex-wrap">
                {SLIDE_THEMES.map((t) => {
                  const isActive = activeTheme.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTheme(t)}
                      title={t.label}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${t.bg} 0%, ${t.bgDark} 100%)`,
                          border: isActive ? `2.5px solid ${t.accentLight}` : isDark ? "2px solid rgba(255,255,255,0.12)" : "2px solid rgba(0,0,0,0.10)",
                          boxShadow: isActive ? `0 0 0 2px ${t.accentLight}44` : "none",
                          transition: "all 0.15s ease",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ position: "absolute", bottom: 7, right: 7, width: 10, height: 10, borderRadius: "50%", background: t.accentLight }} />
                      </div>
                      <span className={`text-[10px] font-semibold leading-none transition-colors ${isActive ? isDark ? "text-white/80" : "text-gray-800" : isDark ? "text-white/35" : "text-gray-400"}`}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile share hint */}
            {canShare && (
              <p className={`text-[11px] text-center ${isDark ? "text-white/25" : "text-gray-400"}`}>
                On mobile, "Download Slide" opens your native share sheet — save directly to Photos or share to Instagram.
              </p>
            )}
          </div>
        </div>

        {/* Export progress bar */}
        {exporting && exportProgress > 0 && (
          <div className={`px-5 py-2 flex-shrink-0 ${isDark ? "bg-white/03" : "bg-gray-50"}`}>
            <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
              <div className="h-full bg-[#3D6B47] transition-all duration-300 rounded-full" style={{ width: `${exportProgress}%` }} />
            </div>
            <p className={`text-xs mt-1 text-center ${isDark ? "text-white/40" : "text-gray-400"}`}>
              Exporting {isStory ? "Story" : "Carousel"} slides… {exportProgress}%
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className={`flex items-center gap-3 px-5 py-4 border-t flex-shrink-0 ${isDark ? "border-white/08" : "border-gray-100"}`}>
          {/* Download / Share single slide */}
          <button
            onClick={downloadSingle}
            disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1 justify-center ${
              isDark
                ? "bg-white/06 hover:bg-white/10 text-white/70 border border-white/10"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
            } disabled:opacity-50`}
          >
            {exporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : shareSuccess
              ? <span className="text-green-400">✓ Shared!</span>
              : canShare
              ? <Share2 className="w-4 h-4" />
              : <Download className="w-4 h-4" />
            }
            {!shareSuccess && (canShare ? `Share Slide ${activeSlide + 1}` : `Download Slide ${activeSlide + 1}`)}
          </button>

          {/* Download all as ZIP */}
          <button
            onClick={downloadAll}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors flex-1 justify-center disabled:opacity-50"
            style={{ background: exporting ? "#2A4A32" : "linear-gradient(135deg, #3D6B47 0%, #2A4A32 100%)" }}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download All (ZIP)
          </button>
        </div>
      </div>
    </div>
  );
}
