/**
 * TournamentOverview
 *
 * Clean post-tournament recap page for Quads (and all formats).
 * Route: /tournament/:id/overview
 *
 * Shows:
 *  1. Tournament header (name, format, date)
 *  2. Winners podium — per-section for Quads, global top-3 otherwise
 *  3. Player Report Cards grid (full PlayerStatsCard, one per player)
 *
 * No extra tabs, no cross-table, no round timeline — just the results.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { Trophy, ArrowLeft, BarChart3, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLogo } from "@/components/NavLogo";
import { loadTournamentState } from "@/lib/directorState";
import { getTournamentConfig } from "@/lib/tournamentRegistry";
import {
  computeAllPerformances,
  computeQuadSectionPerformances,
  type PlayerPerformance,
  type QuadSectionPerformances,
} from "@/lib/performanceStats";
import PlayerStatsCard, {
  defaultAccentForBadge,
} from "@/components/PlayerStatsCard";
import PlayerCardExpandedModal from "@/components/PlayerCardExpandedModal";
import { useChessAvatars, toProxiedAvatarUrl } from "@/hooks/useChessAvatar";
import { OTBLoader } from "@/components/OTBLoader";
import type { DirectorState } from "@/lib/directorState";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtPts(pts: number): string {
  return pts % 1 !== 0 ? `${Math.floor(pts)}½` : String(pts);
}

// ─── Per-section podium card ──────────────────────────────────────────────────
function SectionPodiumCard({
  sectionName,
  performances,
  isDark,
  avatarById,
}: {
  sectionName: string;
  performances: PlayerPerformance[];
  isDark: boolean;
  avatarById: Map<string, string | null>;
}) {
  const top3 = performances.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const heights = ["h-16", "h-10", "h-6"];
  const order = [1, 0, 2]; // podium order: 2nd, 1st, 3rd

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isDark
          ? "bg-white/04 border-white/10"
          : "bg-white border-[#ADBC9F]/60 shadow-sm"
      }`}
    >
      {/* Section label */}
      <p
        className={`text-xs font-bold uppercase tracking-widest mb-4 ${
          isDark ? "text-[#4CAF50]/70" : "text-[#436850]"
        }`}
      >
        {sectionName}
      </p>

      {/* Podium visual */}
      {top3.length >= 2 ? (
        <div className="grid grid-cols-3 gap-2 items-end mb-4">
          {order.map((idx) => {
            const p = top3[idx];
            if (!p) return <div key={idx} />;
            const avatarUrl = avatarById.get(p.player.id);
            return (
              <div key={p.player.id} className="flex flex-col items-center">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden mb-1.5 border-2 border-white/20 flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={toProxiedAvatarUrl(avatarUrl) ?? avatarUrl}
                      alt={p.player.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center text-sm font-black ${
                        isDark ? "bg-white/10 text-white/60" : "bg-[#436850]/10 text-[#436850]"
                      }`}
                    >
                      {p.player.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-lg mb-1">{medals[idx]}</span>
                <p
                  className={`text-xs font-black truncate max-w-full text-center ${
                    isDark ? "text-white" : "text-[#12372A]"
                  }`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {p.player.name}
                </p>
                <p
                  className={`text-xs font-semibold ${
                    idx === 0
                      ? isDark
                        ? "text-[#4CAF50]"
                        : "text-[#436850]"
                      : isDark
                      ? "text-white/50"
                      : "text-[#436850]/70"
                  }`}
                >
                  {fmtPts(p.points)} pts
                </p>
                {/* Podium bar */}
                <div
                  className={`w-full mt-2 rounded-t-lg ${heights[idx]} ${
                    idx === 0
                      ? isDark
                        ? "bg-[#4CAF50]/20"
                        : "bg-[#436850]/15"
                      : isDark
                      ? "bg-white/08"
                      : "bg-[#ADBC9F]/40"
                  }`}
                />
              </div>
            );
          })}
        </div>
      ) : top3.length === 1 ? (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🏆</span>
          <div>
            <p
              className={`text-sm font-black ${isDark ? "text-white" : "text-[#12372A]"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {top3[0].player.name}
            </p>
            <p className={`text-xs ${isDark ? "text-white/50" : "text-[#436850]"}`}>
              {fmtPts(top3[0].points)} pts · {top3[0].wins}W {top3[0].draws}D {top3[0].losses}L
            </p>
          </div>
        </div>
      ) : null}

      {/* Full standings list */}
      <div className="space-y-2">
        {performances.map((p, i) => (
          <div key={p.player.id} className="flex items-center gap-2.5">
            <span
              className={`w-5 text-center text-xs font-bold ${
                i === 0
                  ? isDark
                    ? "text-[#4CAF50]"
                    : "text-[#436850]"
                  : isDark
                  ? "text-white/40"
                  : "text-[#436850]/60"
              }`}
            >
              {i + 1}
            </span>
            <p
              className={`flex-1 text-sm font-semibold truncate ${
                isDark ? "text-white" : "text-[#12372A]"
              }`}
            >
              {p.player.name}
            </p>
            <span
              className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]/70"}`}
            >
              {p.wins}W {p.draws}D {p.losses}L
            </span>
            <span
              className={`text-sm font-black tabular-nums ml-1 ${
                i === 0
                  ? isDark
                    ? "text-[#4CAF50]"
                    : "text-[#436850]"
                  : isDark
                  ? "text-white"
                  : "text-[#12372A]"
              }`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {fmtPts(p.points)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Global podium (non-Quads) ────────────────────────────────────────────────
function GlobalPodium({
  performances,
  isDark,
  avatarById,
}: {
  performances: PlayerPerformance[];
  isDark: boolean;
  avatarById: Map<string, string | null>;
}) {
  const top3 = performances.slice(0, 3);
  if (top3.length < 1) return null;
  const medals = ["🥇", "🥈", "🥉"];
  const heights = ["h-20", "h-14", "h-8"];
  const order = [1, 0, 2];

  return (
    <div
      className={`rounded-2xl border p-6 mb-8 ${
        isDark
          ? "bg-white/04 border-white/10"
          : "bg-white border-[#ADBC9F]/60 shadow-sm"
      }`}
    >
      <h2
        className={`text-base font-black mb-5 ${isDark ? "text-white" : "text-[#12372A]"}`}
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        🏆 Final Podium
      </h2>
      <div className="grid grid-cols-3 gap-3 items-end">
        {order.map((idx) => {
          const p = top3[idx];
          if (!p) return <div key={idx} />;
          const avatarUrl = avatarById.get(p.player.id);
          return (
            <div key={p.player.id} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full overflow-hidden mb-2 border-2 border-white/20 flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={toProxiedAvatarUrl(avatarUrl) ?? avatarUrl}
                    alt={p.player.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center text-base font-black ${
                      isDark ? "bg-white/10 text-white/60" : "bg-[#436850]/10 text-[#436850]"
                    }`}
                  >
                    {p.player.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-2xl mb-1">{medals[idx]}</span>
              <p
                className={`text-sm font-black truncate max-w-full text-center ${
                  isDark ? "text-white" : "text-[#12372A]"
                }`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {p.player.name}
              </p>
              <p
                className={`text-xs font-semibold ${
                  idx === 0
                    ? isDark
                      ? "text-[#4CAF50]"
                      : "text-[#436850]"
                    : isDark
                    ? "text-white/50"
                    : "text-[#436850]/70"
                }`}
              >
                {fmtPts(p.points)} pts
              </p>
              <div
                className={`w-full mt-2 rounded-t-lg ${heights[idx]} ${
                  idx === 0
                    ? isDark
                      ? "bg-[#4CAF50]/20"
                      : "bg-[#436850]/15"
                    : isDark
                    ? "bg-white/08"
                    : "bg-[#ADBC9F]/40"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TournamentOverview() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = id ?? "";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── Data loading ────────────────────────────────────────────────────────────
  const config = getTournamentConfig(tournamentId);
  const localState = loadTournamentState(tournamentId);
  const [serverState, setServerState] = useState<DirectorState | null>(null);
  const [serverLoading, setServerLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournament/${tournamentId}/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { state?: DirectorState } | null) => {
        if (data?.state) setServerState(data.state);
      })
      .catch(() => {})
      .finally(() => setServerLoading(false));
  }, [tournamentId]);

  const rawState = serverState ?? localState;
  const players = rawState?.players ?? [];
  const rounds = rawState?.rounds ?? [];
  const tournamentName = config?.name ?? rawState?.tournamentName ?? "Tournament";
  const tournamentDate = config?.date ?? "";
  const isQuads = rawState?.format === "quads";
  const quadSections = (rawState?.quadSections ?? []) as {
    id: string;
    name: string;
    type: "quad" | "bottom_swiss";
    playerIds: string[];
  }[];

  const performances = computeAllPerformances(players, rounds);
  const quadSectionPerfs: QuadSectionPerformances[] = isQuads
    ? computeQuadSectionPerformances(players, rounds, quadSections)
    : [];

  // ── Avatars ─────────────────────────────────────────────────────────────────
  const allUsernames = performances.map((p) => p.player.username);
  const usernamesNeedingFetch = performances
    .filter((p) => !p.player.avatarUrl)
    .map((p) => p.player.username);
  const { avatars: fetchedAvatars, allLoaded: fetchedLoaded } = useChessAvatars(usernamesNeedingFetch);
  const avatarById = new Map<string, string | null>();
  for (const perf of performances) {
    if (perf.player.avatarUrl) {
      avatarById.set(perf.player.id, perf.player.avatarUrl);
    } else {
      avatarById.set(perf.player.id, fetchedAvatars.get(perf.player.username.toLowerCase()) ?? null);
    }
  }
  const avatarsLoaded = performances.every((p) => p.player.avatarUrl) || fetchedLoaded;

  // ── Accent colors ────────────────────────────────────────────────────────────
  const [accentMap, setAccentMap] = useState<Map<string, string>>(new Map());
  const getAccent = useCallback(
    (perf: PlayerPerformance) =>
      accentMap.get(perf.player.id) ?? defaultAccentForBadge(perf.badge),
    [accentMap]
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setAccent = useCallback((_playerId: string, _hex: string) => {
    setAccentMap((prev) => new Map(prev).set(_playerId, _hex));
  }, []);

  // ── Export refs ──────────────────────────────────────────────────────────────
  const exportRefs = useRef<Map<string, { current: HTMLDivElement | null }>>(new Map());
  const getExportRef = useCallback((playerId: string) => {
    if (!exportRefs.current.has(playerId)) {
      exportRefs.current.set(playerId, { current: null });
    }
    return exportRefs.current.get(playerId)!;
  }, []);

  // ── Expanded modal ───────────────────────────────────────────────────────────
  const [expandedPerf, setExpandedPerf] = useState<PlayerPerformance | null>(null);

  // ── Format label ─────────────────────────────────────────────────────────────
  const formatLabel = (() => {
    const fmt = rawState?.format;
    if (fmt === "quads")
      return `Quads · ${quadSections.length} Section${quadSections.length !== 1 ? "s" : ""}`;
    if (fmt === "swiss") return `Swiss · ${rawState?.totalRounds ?? 0}R`;
    if (fmt === "roundrobin") return "Round Robin";
    if (fmt === "doubleswiss") return `Double Swiss · ${rawState?.totalRounds ?? 0}R`;
    return fmt ?? "Tournament";
  })();

  if (serverLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-[#0D1F13]" : "bg-[#F5F5F0]"
        }`}
      >
        <OTBLoader />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${isDark ? "bg-[#0D1F13] text-white" : "bg-[#F5F5F0] text-[#12372A]"}`}
    >
      {/* ── Nav bar ─────────────────────────────────────────────────────────── */}
      <nav
        className={`sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b ${
          isDark
            ? "bg-[#0D1F13]/95 border-white/08 backdrop-blur-md"
            : "bg-white/95 border-[#ADBC9F]/50 backdrop-blur-md shadow-sm"
        }`}
      >
        <div className="flex items-center gap-3">
          <NavLogo />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tournament/${tournamentId}/report`}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              isDark
                ? "bg-white/08 text-white/70 hover:bg-white/12"
                : "bg-[#436850]/10 text-[#436850] hover:bg-[#436850]/15"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Full Report
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={`/tournament/${tournamentId}/manage`}
          className={`inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors ${
            isDark ? "text-white/50 hover:text-white/80" : "text-[#436850]/60 hover:text-[#436850]"
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Tournament header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Trophy
              className={`w-5 h-5 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-widest ${
                isDark ? "text-[#4CAF50]/70" : "text-[#436850]"
              }`}
            >
              Tournament Complete
            </span>
          </div>
          <h1
            className={`text-2xl font-black mb-1 ${isDark ? "text-white" : "text-[#12372A]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {tournamentName}
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-[#436850]/70"}`}>
            {formatLabel}
            {tournamentDate ? ` · ${tournamentDate}` : ""}
            {` · ${players.length} players`}
          </p>
        </div>

        {/* ── Podium ──────────────────────────────────────────────────────────── */}
        {isQuads && quadSectionPerfs.length > 0 ? (
          <div className="mb-10">
            <h2
              className={`text-lg font-black mb-4 ${isDark ? "text-white" : "text-[#12372A]"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              🏆 Section Champions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quadSectionPerfs.map((sp) => (
                <SectionPodiumCard
                  key={sp.sectionId}
                  sectionName={sp.sectionName}
                  performances={sp.performances}
                  isDark={isDark}
                  avatarById={avatarById}
                />
              ))}
            </div>
          </div>
        ) : (
          <GlobalPodium
            performances={performances}
            isDark={isDark}
            avatarById={avatarById}
          />
        )}

        {/* ── Player Report Cards ──────────────────────────────────────────── */}
        <div className="mb-6">
          <h2
            className={`text-lg font-black mb-1 ${isDark ? "text-white" : "text-[#12372A]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Player Reports
          </h2>
          <p className={`text-sm mb-5 ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>
            {performances.length} players · tap a card to expand
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {performances.map((perf) => {
            const exportRef = getExportRef(perf.player.id);
            const accent = getAccent(perf);
            return (
              <div
                key={perf.player.id}
                className="cursor-pointer"
                onClick={() => setExpandedPerf(perf)}
              >
                <PlayerStatsCard
                  ref={(el) => {
                    exportRef.current = el;
                  }}
                  perf={perf}
                  tournamentName={tournamentName}
                  tournamentDate={tournamentDate}
                  avatarUrl={toProxiedAvatarUrl(avatarById.get(perf.player.id))}
                  avatarStatus={avatarsLoaded ? "loaded" : "loading"}
                  accentColor={accent}
                  clubName={config?.clubName ?? undefined}
                />
              </div>
            );
          })}
        </div>

        <div className="h-16" />
      </div>

      {/* ── Expanded modal ───────────────────────────────────────────────────── */}
      {expandedPerf && (
        <PlayerCardExpandedModal
          perf={expandedPerf}
          accentColor={getAccent(expandedPerf)}
          onClose={() => setExpandedPerf(null)}
        />
      )}
    </div>
  );
}
