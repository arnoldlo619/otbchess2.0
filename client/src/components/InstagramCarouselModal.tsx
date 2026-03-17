/**
 * InstagramCarouselModal — Tournament Recap Instagram Carousel Generator
 *
 * Generates 5 branded 1080×1080 Instagram slides from tournament data:
 *   1. Cover    — Tournament name, club, date, champion
 *   2. Podium   — Top 3 players with ELO, points, medals
 *   3. Standings — Full ranked player list with scores
 *   4. Stats    — Players, rounds, format, avg ELO, top performer
 *   5. CTA      — "Play at [Club]" with OTB branding
 *
 * Export: individual PNG or ZIP of all slides via html2canvas + JSZip
 */

import { useRef, useState, useCallback } from "react";
import { X, Download, Instagram, ChevronLeft, ChevronRight, Loader2, Trophy, Medal } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { StandingRow } from "@/lib/swiss";
import type { TournamentConfig } from "@/lib/tournamentRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  rows: StandingRow[];
  config: TournamentConfig | null;
  tournamentName: string;
  totalRounds: number;
}

// ─── Design tokens (OTB brand) ────────────────────────────────────────────────

const BRAND = {
  green: "#3D6B47",
  greenDark: "#2A4A32",
  greenLight: "#769656",
  greenBright: "#4CAF50",
  white: "#FFFFFF",
  offWhite: "#F0F5EE",
  black: "#0A1A0E",
  gold: "#F5C842",
  silver: "#C0C8D0",
  bronze: "#CD7F32",
};

const SLIDE_SIZE = 1080; // px — Instagram square

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
  if (fmt === "roundrobin") return "Round Robin";
  if (fmt === "elimination") return "Elimination";
  return fmt ?? "Swiss";
}

// ─── Slide components (1080×1080 at 0.25 scale for preview) ──────────────────

interface SlideProps {
  rows: StandingRow[];
  config: TournamentConfig | null;
  tournamentName: string;
  totalRounds: number;
  scale?: number;
}

/** Shared slide wrapper — dark green background with chess board texture */
function SlideWrapper({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  const size = SLIDE_SIZE * scale;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${BRAND.greenDark} 0%, ${BRAND.black} 100%)`,
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
          backgroundImage: `
            repeating-conic-gradient(
              rgba(255,255,255,0.025) 0% 25%,
              transparent 0% 50%
            )`,
          backgroundSize: `${80 * scale}px ${80 * scale}px`,
          zIndex: 0,
        }}
      />
      {/* Green gradient glow top-right */}
      <div
        style={{
          position: "absolute",
          top: -SLIDE_SIZE * scale * 0.3,
          right: -SLIDE_SIZE * scale * 0.2,
          width: SLIDE_SIZE * scale * 0.8,
          height: SLIDE_SIZE * scale * 0.8,
          background: `radial-gradient(circle, ${BRAND.green}55 0%, transparent 70%)`,
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

/** OTB logo mark — bottom of every slide */
function OTBBrand({ scale = 1, clubName }: { scale?: number; clubName?: string | null }) {
  const s = scale;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 36 * s,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10 * s,
      }}
    >
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 900,
          fontStyle: "italic",
          fontSize: 22 * s,
          color: BRAND.greenLight,
          letterSpacing: "0.02em",
        }}
      >
        OTB!!
      </div>
      {clubName && (
        <>
          <div style={{ width: 1, height: 18 * s, background: "rgba(255,255,255,0.2)" }} />
          <div
            style={{
              fontSize: 13 * s,
              color: "rgba(255,255,255,0.5)",
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            {clubName}
          </div>
        </>
      )}
    </div>
  );
}

/** Slide 1 — Cover */
function Slide1Cover({ rows, config, tournamentName, totalRounds, scale = 1 }: SlideProps) {
  const s = scale;
  const champion = rows[0]?.player;
  const clubName = config?.clubName;
  const date = formatDate(config?.date);

  return (
    <SlideWrapper scale={scale}>
      {/* Slide number */}
      <div style={{ position: "absolute", top: 32 * s, right: 36 * s, fontSize: 11 * s, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 600 }}>
        1 / 5
      </div>

      {/* Club badge */}
      {clubName && (
        <div
          style={{
            position: "absolute",
            top: 60 * s,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: `${BRAND.green}33`,
              border: `1px solid ${BRAND.green}66`,
              borderRadius: 100 * s,
              padding: `${6 * s}px ${18 * s}px`,
              fontSize: 11 * s,
              color: BRAND.greenLight,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
            }}
          >
            {clubName}
          </div>
        </div>
      )}

      {/* Main title */}
      <div
        style={{
          position: "absolute",
          top: clubName ? 130 * s : 80 * s,
          left: 0,
          right: 0,
          padding: `0 ${60 * s}px`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13 * s,
            color: "rgba(255,255,255,0.45)",
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase" as const,
            marginBottom: 16 * s,
          }}
        >
          TOURNAMENT RECAP
        </div>
        <div
          style={{
            fontSize: Math.min(72 * s, (SLIDE_SIZE * s * 0.9) / (tournamentName.length * 0.55)),
            fontWeight: 900,
            color: BRAND.white,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {tournamentName}
        </div>
      </div>

      {/* Champion spotlight */}
      {champion && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: "translateY(-10%)",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: 12 * s,
          }}
        >
          {/* Trophy icon */}
          <div style={{ fontSize: 56 * s, lineHeight: 1 }}>🏆</div>
          <div style={{ fontSize: 13 * s, color: BRAND.gold, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>
            CHAMPION
          </div>
          <div style={{ fontSize: 52 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.02em", textAlign: "center", padding: `0 ${40 * s}px` }}>
            {champion.name}
          </div>
          <div style={{ fontSize: 18 * s, color: BRAND.greenLight, fontWeight: 600 }}>
            @{champion.username} · {champion.elo} ELO
          </div>
          <div style={{ fontSize: 14 * s, color: "rgba(255,255,255,0.4)", marginTop: 4 * s }}>
            {rows[0]?.points ?? 0} / {totalRounds} pts
          </div>
        </div>
      )}

      {/* Date + format */}
      <div
        style={{
          position: "absolute",
          bottom: 90 * s,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 24 * s,
        }}
      >
        {date && (
          <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
            {date}
          </div>
        )}
        <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
          {rows.length} Players · {totalRounds} Rounds
        </div>
      </div>

      <OTBBrand scale={scale} clubName={null} />
    </SlideWrapper>
  );
}

/** Slide 2 — Podium */
function Slide2Podium({ rows, config, tournamentName, totalRounds, scale = 1 }: SlideProps) {
  const s = scale;
  const top3 = rows.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); // 2nd, 1st, 3rd
  const podiumHeights = [220 * s, 280 * s, 180 * s];
  const medalColors = [BRAND.silver, BRAND.gold, BRAND.bronze];
  const medals = ["🥈", "🥇", "🥉"];
  const ranks = [2, 1, 3];

  return (
    <SlideWrapper scale={scale}>
      {/* Slide number */}
      <div style={{ position: "absolute", top: 32 * s, right: 36 * s, fontSize: 11 * s, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 600 }}>
        2 / 5
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: 60 * s }}>
        <div style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 8 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: 48 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.02em" }}>
          Top Players
        </div>
      </div>

      {/* Podium */}
      <div
        style={{
          position: "absolute",
          bottom: 90 * s,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 16 * s,
          padding: `0 ${40 * s}px`,
        }}
      >
        {podiumOrder.map((row, idx) => {
          if (!row) return null;
          const isFirst = ranks[idx] === 1;
          return (
            <div
              key={row.player.id}
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                flex: 1,
                maxWidth: 300 * s,
              }}
            >
              {/* Player info above podium */}
              <div style={{ textAlign: "center", marginBottom: 12 * s }}>
                <div style={{ fontSize: isFirst ? 40 * s : 28 * s, lineHeight: 1 }}>{medals[idx]}</div>
                <div style={{ fontSize: isFirst ? 22 * s : 17 * s, fontWeight: 800, color: BRAND.white, marginTop: 8 * s, lineHeight: 1.1 }}>
                  {row.player.name}
                </div>
                <div style={{ fontSize: isFirst ? 14 * s : 12 * s, color: BRAND.greenLight, fontWeight: 600, marginTop: 4 * s }}>
                  @{row.player.username}
                </div>
                <div style={{ fontSize: isFirst ? 28 * s : 22 * s, fontWeight: 900, color: medalColors[idx], marginTop: 8 * s }}>
                  {row.points}
                </div>
                <div style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.4)" }}>pts</div>
                <div style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.35)", marginTop: 4 * s }}>
                  {row.player.elo} ELO
                </div>
              </div>

              {/* Podium block */}
              <div
                style={{
                  width: "100%",
                  height: podiumHeights[idx],
                  background: `linear-gradient(180deg, ${medalColors[idx]}33 0%, ${medalColors[idx]}15 100%)`,
                  border: `1px solid ${medalColors[idx]}55`,
                  borderRadius: `${8 * s}px ${8 * s}px 0 0`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: 32 * s, fontWeight: 900, color: `${medalColors[idx]}88` }}>
                  #{ranks[idx]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <OTBBrand scale={scale} clubName={config?.clubName} />
    </SlideWrapper>
  );
}

/** Slide 3 — Full Standings */
function Slide3Standings({ rows, config, tournamentName, totalRounds, scale = 1 }: SlideProps) {
  const s = scale;
  const displayRows = rows.slice(0, 8); // Show top 8

  return (
    <SlideWrapper scale={scale}>
      {/* Slide number */}
      <div style={{ position: "absolute", top: 32 * s, right: 36 * s, fontSize: 11 * s, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 600 }}>
        3 / 5
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: 60 * s, marginBottom: 32 * s }}>
        <div style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 8 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: 44 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.02em" }}>
          Final Standings
        </div>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: `${10 * s}px ${48 * s}px`,
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          marginBottom: 4 * s,
        }}
      >
        <div style={{ width: 40 * s, fontSize: 10 * s, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>#</div>
        <div style={{ flex: 1, fontSize: 10 * s, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>PLAYER</div>
        <div style={{ width: 60 * s, textAlign: "right", fontSize: 10 * s, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>ELO</div>
        <div style={{ width: 50 * s, textAlign: "right", fontSize: 10 * s, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>PTS</div>
        <div style={{ width: 60 * s, textAlign: "right", fontSize: 10 * s, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: "0.1em" }}>W-D-L</div>
      </div>

      {/* Rows */}
      {displayRows.map((row, idx) => {
        const isTop3 = row.rank <= 3;
        const rankColors = ["", BRAND.gold, BRAND.silver, BRAND.bronze];
        const rankColor = isTop3 ? rankColors[row.rank] : "rgba(255,255,255,0.4)";
        const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

        return (
          <div
            key={row.player.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: `${11 * s}px ${48 * s}px`,
              background: idx % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent",
              borderLeft: isTop3 ? `3px solid ${rankColor}` : "3px solid transparent",
            }}
          >
            <div style={{ width: 40 * s, fontSize: 16 * s, lineHeight: 1 }}>
              {isTop3 ? medals[row.rank] : (
                <span style={{ fontSize: 13 * s, color: rankColor, fontWeight: 700 }}>{row.rank}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15 * s, fontWeight: 700, color: BRAND.white, lineHeight: 1.2 }}>
                {row.player.name}
                {row.player.title && (
                  <span style={{ marginLeft: 6 * s, fontSize: 10 * s, color: BRAND.greenLight, fontWeight: 700, background: `${BRAND.green}44`, padding: `${2 * s}px ${5 * s}px`, borderRadius: 3 * s }}>
                    {row.player.title}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.35)", marginTop: 1 * s }}>@{row.player.username}</div>
            </div>
            <div style={{ width: 60 * s, textAlign: "right", fontSize: 13 * s, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
              {row.player.elo}
            </div>
            <div style={{ width: 50 * s, textAlign: "right", fontSize: 18 * s, fontWeight: 800, color: isTop3 ? rankColor : BRAND.white }}>
              {row.points}
            </div>
            <div style={{ width: 60 * s, textAlign: "right", fontSize: 11 * s, color: "rgba(255,255,255,0.4)" }}>
              {row.wins}-{row.draws}-{row.losses}
            </div>
          </div>
        );
      })}

      {rows.length > 8 && (
        <div style={{ textAlign: "center", marginTop: 12 * s, fontSize: 12 * s, color: "rgba(255,255,255,0.25)" }}>
          +{rows.length - 8} more players
        </div>
      )}

      <OTBBrand scale={scale} clubName={config?.clubName} />
    </SlideWrapper>
  );
}

/** Slide 4 — Tournament Stats */
function Slide4Stats({ rows, config, tournamentName, totalRounds, scale = 1 }: SlideProps) {
  const s = scale;
  const totalGames = totalRounds * Math.floor(rows.length / 2);
  const topPerformer = rows.reduce((best, r) => (r.wins > best.wins ? r : best), rows[0] ?? { wins: 0, player: { name: "—", username: "" } } as StandingRow);
  const highestElo = rows.reduce((best, r) => (r.player.elo > best.player.elo ? r : best), rows[0]);

  const stats = [
    { label: "PLAYERS", value: String(rows.length), sub: "registered" },
    { label: "ROUNDS", value: String(totalRounds), sub: formatFormat(config?.format) },
    { label: "AVG ELO", value: String(avgElo(rows)), sub: "rating" },
    { label: "GAMES", value: String(totalGames), sub: "played" },
  ];

  return (
    <SlideWrapper scale={scale}>
      {/* Slide number */}
      <div style={{ position: "absolute", top: 32 * s, right: 36 * s, fontSize: 11 * s, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 600 }}>
        4 / 5
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", paddingTop: 60 * s, marginBottom: 48 * s }}>
        <div style={{ fontSize: 11 * s, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" as const, marginBottom: 8 * s }}>
          {tournamentName}
        </div>
        <div style={{ fontSize: 48 * s, fontWeight: 900, color: BRAND.white, letterSpacing: "-0.02em" }}>
          By the Numbers
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20 * s,
          padding: `0 ${60 * s}px`,
          marginBottom: 40 * s,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16 * s,
              padding: `${28 * s}px ${24 * s}px`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10 * s, color: BRAND.greenLight, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" as const, marginBottom: 8 * s }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 56 * s, fontWeight: 900, color: BRAND.white, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12 * s, color: "rgba(255,255,255,0.35)", marginTop: 6 * s }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Highlights */}
      <div style={{ padding: `0 ${60 * s}px`, display: "flex", flexDirection: "column" as const, gap: 12 * s }}>
        <div
          style={{
            background: `${BRAND.green}22`,
            border: `1px solid ${BRAND.green}44`,
            borderRadius: 12 * s,
            padding: `${14 * s}px ${20 * s}px`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12 * s, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
            Most Wins
          </div>
          <div style={{ fontSize: 16 * s, fontWeight: 800, color: BRAND.white }}>
            {topPerformer?.player.name} <span style={{ color: BRAND.greenLight }}>({topPerformer?.wins}W)</span>
          </div>
        </div>
        {highestElo && (
          <div
            style={{
              background: `${BRAND.gold}11`,
              border: `1px solid ${BRAND.gold}33`,
              borderRadius: 12 * s,
              padding: `${14 * s}px ${20 * s}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12 * s, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              Highest Rated
            </div>
            <div style={{ fontSize: 16 * s, fontWeight: 800, color: BRAND.white }}>
              {highestElo.player.name} <span style={{ color: BRAND.gold }}>({highestElo.player.elo})</span>
            </div>
          </div>
        )}
      </div>

      <OTBBrand scale={scale} clubName={config?.clubName} />
    </SlideWrapper>
  );
}

/** Slide 5 — CTA */
function Slide5CTA({ rows, config, tournamentName, totalRounds, scale = 1 }: SlideProps) {
  const s = scale;
  const clubName = config?.clubName;
  const inviteCode = config?.inviteCode;

  return (
    <SlideWrapper scale={scale}>
      {/* Slide number */}
      <div style={{ position: "absolute", top: 32 * s, right: 36 * s, fontSize: 11 * s, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", fontWeight: 600 }}>
        5 / 5
      </div>

      {/* Big OTB mark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 320 * s,
          fontWeight: 900,
          fontStyle: "italic",
          color: `${BRAND.green}18`,
          letterSpacing: "-0.05em",
          userSelect: "none",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        OTB
      </div>

      {/* Content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          gap: 20 * s,
          padding: `0 ${80 * s}px`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em", fontWeight: 700, textTransform: "uppercase" as const }}>
          JOIN THE COMMUNITY
        </div>
        <div
          style={{
            fontSize: 64 * s,
            fontWeight: 900,
            color: BRAND.white,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
          }}
        >
          {clubName ? `Play at ${clubName}` : "Play Over The Board"}
        </div>
        <div style={{ fontSize: 18 * s, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, maxWidth: 700 * s }}>
          Chess tournaments, organised in minutes.
          <br />
          Swiss pairings · ELO tracking · Live standings
        </div>

        {/* CTA pill */}
        <div
          style={{
            marginTop: 16 * s,
            background: BRAND.green,
            borderRadius: 100 * s,
            padding: `${16 * s}px ${40 * s}px`,
            fontSize: 18 * s,
            fontWeight: 800,
            color: BRAND.white,
            letterSpacing: "0.02em",
          }}
        >
          otbchess.club
        </div>

        {inviteCode && (
          <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.3)", marginTop: 4 * s }}>
            Tournament code: <span style={{ color: BRAND.greenLight, fontWeight: 700 }}>{inviteCode}</span>
          </div>
        )}
      </div>

      {/* OTB!! logo */}
      <div
        style={{
          position: "absolute",
          bottom: 36 * s,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10 * s,
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: 22 * s,
            color: BRAND.greenLight,
            letterSpacing: "0.02em",
          }}
        >
          OTB!!
        </div>
        <div style={{ width: 1, height: 18 * s, background: "rgba(255,255,255,0.2)" }} />
        <div style={{ fontSize: 13 * s, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>
          Over The Board Chess
        </div>
      </div>
    </SlideWrapper>
  );
}

// ─── Slide registry ───────────────────────────────────────────────────────────

const SLIDES = [
  { id: "cover", label: "Cover", Component: Slide1Cover },
  { id: "podium", label: "Podium", Component: Slide2Podium },
  { id: "standings", label: "Standings", Component: Slide3Standings },
  { id: "stats", label: "Stats", Component: Slide4Stats },
  { id: "cta", label: "CTA", Component: Slide5CTA },
];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function InstagramCarouselModal({ open, onClose, rows, config, tournamentName, totalRounds }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const slideProps: SlideProps = { rows, config, tournamentName, totalRounds, scale: 1 };

  // ── Export single slide ──────────────────────────────────────────────────────
  const exportSlide = useCallback(async (idx: number): Promise<Blob | null> => {
    const el = slideRefs.current[idx];
    if (!el) return null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: SLIDE_SIZE,
        height: SLIDE_SIZE,
        logging: false,
      });
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1.0));
    } catch (err) {
      console.error("[carousel] Export error", err);
      return null;
    }
  }, []);

  // ── Download single slide ────────────────────────────────────────────────────
  const downloadSingle = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await exportSlide(activeSlide);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tournamentName.replace(/\s+/g, "_")}_slide_${activeSlide + 1}_${SLIDES[activeSlide].id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [activeSlide, exportSlide, tournamentName]);

  // ── Download all as ZIP ──────────────────────────────────────────────────────
  const downloadAll = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder(`${tournamentName.replace(/\s+/g, "_")}_Instagram_Carousel`);
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
      a.download = `${tournamentName.replace(/\s+/g, "_")}_Instagram_Carousel.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [exportSlide, tournamentName]);

  if (!open) return null;

  const PREVIEW_SCALE = 0.37; // Scale for preview (1080 * 0.37 ≈ 400px)
  const previewSize = SLIDE_SIZE * PREVIEW_SCALE;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative flex flex-col rounded-2xl overflow-hidden shadow-2xl w-full max-w-2xl max-h-[95vh] ${
          isDark ? "bg-[#0F1F13] border border-white/10" : "bg-white border border-gray-200"
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] flex items-center justify-center">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Instagram Carousel</h2>
              <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>5 slides · 1080×1080 · PNG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/08 text-white/50" : "hover:bg-gray-100 text-gray-400"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide preview */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-4 p-6">
            {/* Active slide preview */}
            <div
              className="relative rounded-xl overflow-hidden shadow-xl"
              style={{ width: previewSize, height: previewSize }}
            >
              {SLIDES.map(({ Component }, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    opacity: idx === activeSlide ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    pointerEvents: idx === activeSlide ? "auto" : "none",
                  }}
                >
                  <div
                    ref={(el) => { slideRefs.current[idx] = el; }}
                    style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}
                  >
                    <Component {...slideProps} scale={1} />
                  </div>
                </div>
              ))}
            </div>

            {/* Slide navigation */}
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

              {/* Dot indicators */}
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

            {/* Slide info */}
            <div className={`text-center text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
              Slide {activeSlide + 1} of {SLIDES.length} · {SLIDES[activeSlide].label}
            </div>
          </div>
        </div>

        {/* Export progress bar */}
        {exporting && exportProgress > 0 && (
          <div className={`px-6 py-2 ${isDark ? "bg-white/03" : "bg-gray-50"}`}>
            <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
              <div
                className="h-full bg-[#3D6B47] transition-all duration-300 rounded-full"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <p className={`text-xs mt-1 text-center ${isDark ? "text-white/40" : "text-gray-400"}`}>
              Exporting slides… {exportProgress}%
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className={`flex items-center gap-3 px-6 py-4 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
          <button
            onClick={downloadSingle}
            disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex-1 justify-center ${
              isDark
                ? "bg-white/06 hover:bg-white/10 text-white/70 border border-white/10"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
            } disabled:opacity-50`}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Slide {activeSlide + 1}
          </button>
          <button
            onClick={downloadAll}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors flex-1 justify-center disabled:opacity-50"
            style={{ background: exporting ? "#2A4A32" : "linear-gradient(135deg, #3D6B47 0%, #2A4A32 100%)" }}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download All (ZIP)
          </button>
        </div>
      </div>
    </div>
  );
}
