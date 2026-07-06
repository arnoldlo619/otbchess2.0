/**
 * ClubPromoModal
 *
 * Full-screen modal that wraps SocialAssetGenerator for club owners/directors.
 * Pre-populates the asset config with club identity data and lets the owner
 * optionally select a past tournament recap to feature in the graphic.
 *
 * Usage:
 *   <ClubPromoModal
 *     isOpen={showPromoModal}
 *     onClose={() => setShowPromoModal(false)}
 *     club={club}
 *     recaps={clubRecaps}
 *     tournaments={[...liveTournaments, ...tournaments]}
 *     isDark={isDark}
 *   />
 */

import { useState, useMemo } from "react";
import { X, Trophy, Sparkles, ChevronDown } from "lucide-react";
import SocialAssetGenerator, {
  type AssetConfig,
  type ChampionData,
} from "@/components/tournament/SocialAssetGenerator";
import type { Club } from "@/lib/clubRegistry";
import type { TournamentConfig } from "@/lib/tournamentRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClubRecapSummary {
  id: string;
  slug: string;
  tournamentName: string | null;
  eventDate: string | null;
  playerCount: number | null;
  format: string | null;
  publishedAt: string | null;
}

interface ClubPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: Club;
  recaps?: ClubRecapSummary[];
  tournaments?: TournamentConfig[];
  isDark?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a generic club-promo AssetConfig (no specific tournament). */
function buildClubConfig(club: Club): AssetConfig {
  return {
    tournamentName: club.name,
    clubName: club.name,
    venue: club.location ?? undefined,
    champions: [],
    playerCount: club.memberCount,
    sponsorNote: "ChessOTB.club",
  };
}

/** Build an AssetConfig from a live TournamentConfig. */
function buildTournamentConfig(
  t: TournamentConfig,
  clubName: string
): AssetConfig {
  // Derive champions from standings if available
  const champions: ChampionData[] = [];
  // TournamentConfig may have a `standings` field if the tournament is complete
  const standings = (t as unknown as { standings?: Array<{ playerName: string; rating: number; score: number }> }).standings;
  if (standings && standings.length > 0) {
    champions.push({
      playerName: standings[0].playerName,
      rating: standings[0].rating,
      sectionName: "Open",
      finalScore: `${standings[0].score}`,
      badges: ["🥇"],
    });
    if (standings[1]) {
      champions.push({
        playerName: standings[1].playerName,
        rating: standings[1].rating,
        sectionName: "Open",
        finalScore: `${standings[1].score}`,
        badges: ["🥈"],
      });
    }
    if (standings[2]) {
      champions.push({
        playerName: standings[2].playerName,
        rating: standings[2].rating,
        sectionName: "Open",
        finalScore: `${standings[2].score}`,
        badges: ["🥉"],
      });
    }
  }

  return {
    tournamentName: t.name,
    clubName,
    eventDate: t.date ?? undefined,
    venue: t.venue ?? undefined,
    champions,
    playerCount: t.maxPlayers,
    format: t.format ?? undefined,
    timeControl: t.timePreset ?? undefined,
    sponsorNote: "ChessOTB.club",
  };
}

/** Build an AssetConfig from a server-side recap summary.
 *  Full recap data would need a fetch; here we build a minimal config
 *  from the summary fields available in the club recaps list. */
function buildRecapConfig(
  recap: ClubRecapSummary,
  clubName: string
): AssetConfig {
  return {
    tournamentName: recap.tournamentName ?? clubName,
    clubName,
    eventDate: recap.eventDate
      ? new Date(recap.eventDate).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : undefined,
    champions: [],
    playerCount: recap.playerCount ?? undefined,
    format: recap.format ?? undefined,
    sponsorNote: "ChessOTB.club",
  };
}

// ─── Source picker option ─────────────────────────────────────────────────────

type SourceType = "club" | `tournament:${string}` | `recap:${string}`;

// ─── Component ────────────────────────────────────────────────────────────────

export function ClubPromoModal({
  isOpen,
  onClose,
  club,
  recaps = [],
  tournaments = [],
  isDark = false,
}: ClubPromoModalProps) {
  const [selectedSource, setSelectedSource] = useState<SourceType>("club");
  const [pickerOpen, setPickerOpen] = useState(false);

  // Derive the active AssetConfig from the selected source
  const config: AssetConfig = useMemo(() => {
    if (selectedSource === "club") return buildClubConfig(club);
    if (selectedSource.startsWith("tournament:")) {
      const id = selectedSource.replace("tournament:", "");
      const t = tournaments.find((x) => x.id === id);
      return t ? buildTournamentConfig(t, club.name) : buildClubConfig(club);
    }
    if (selectedSource.startsWith("recap:")) {
      const id = selectedSource.replace("recap:", "");
      const r = recaps.find((x) => x.id === id);
      return r ? buildRecapConfig(r, club.name) : buildClubConfig(club);
    }
    return buildClubConfig(club);
  }, [selectedSource, club, tournaments, recaps]);

  // Label for the currently selected source
  const selectedLabel = useMemo(() => {
    if (selectedSource === "club") return `${club.name} (Club Profile)`;
    if (selectedSource.startsWith("tournament:")) {
      const id = selectedSource.replace("tournament:", "");
      const t = tournaments.find((x) => x.id === id);
      return t?.name ?? "Tournament";
    }
    if (selectedSource.startsWith("recap:")) {
      const id = selectedSource.replace("recap:", "");
      const r = recaps.find((x) => x.id === id);
      return r?.tournamentName ?? "Recap";
    }
    return club.name;
  }, [selectedSource, club, tournaments, recaps]);

  const hasOptions = tournaments.length > 0 || recaps.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: isDark ? "rgba(5,18,10,0.97)" : "rgba(240,245,232,0.97)", backdropFilter: "blur(12px)" }}
      role="dialog"
      aria-modal
      aria-label="Create Promo Graphic"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0"
        style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(67,104,80,0.18)" }}
      >
        {/* Left: title + icon */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(76,175,80,0.18)" }}
          >
            <Sparkles className="w-4 h-4" style={{ color: "#4CAF50" }} />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
              Create Promo Graphic
            </p>
            <p className={`text-xs ${isDark ? "text-white/45" : "text-[#436850]"}`}>
              {club.name}
            </p>
          </div>
        </div>

        {/* Right: source picker + close */}
        <div className="flex items-center gap-2">
          {/* Source picker — only shown when there are tournaments or recaps */}
          {hasOptions && (
            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all hover:opacity-90 max-w-[200px] truncate ${
                  isDark
                    ? "border-white/12 bg-white/5 text-white/70 hover:bg-white/8"
                    : "border-[#ADBC9F] bg-[#FBFADA] text-[#436850] hover:bg-[#ADBC9F]/30"
                }`}
              >
                <Trophy className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{selectedLabel}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
              </button>

              {pickerOpen && (
                <div
                  className={`absolute right-0 top-full mt-1.5 w-72 rounded-2xl border shadow-2xl z-10 overflow-hidden ${
                    isDark ? "bg-[#0f2016] border-white/10" : "bg-white border-[#ADBC9F]"
                  }`}
                >
                  <div className="max-h-72 overflow-y-auto">
                    {/* Club profile option */}
                    <button
                      onClick={() => { setSelectedSource("club"); setPickerOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors ${
                        selectedSource === "club"
                          ? isDark ? "bg-white/8 text-white" : "bg-[#ADBC9F]/30 text-[#12372A]"
                          : isDark ? "text-white/70 hover:bg-white/5" : "text-[#436850] hover:bg-[#FBFADA]"
                      }`}
                    >
                      <span className="text-base">🏛️</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{club.name}</p>
                        <p className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>Club Profile</p>
                      </div>
                      {selectedSource === "club" && <span className="text-[#4CAF50] text-xs font-bold">✓</span>}
                    </button>

                    {/* Live / completed tournaments */}
                    {tournaments.length > 0 && (
                      <>
                        <div
                          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider border-t ${
                            isDark ? "text-white/30 border-white/5" : "text-[#436850]/50 border-[#ADBC9F]/30"
                          }`}
                        >
                          Tournaments
                        </div>
                        {tournaments.map((t) => {
                          const src: SourceType = `tournament:${t.id}`;
                          const active = selectedSource === src;
                          return (
                            <button
                              key={t.id}
                              onClick={() => { setSelectedSource(src); setPickerOpen(false); }}
                              className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors ${
                                active
                                  ? isDark ? "bg-white/8 text-white" : "bg-[#ADBC9F]/30 text-[#12372A]"
                                  : isDark ? "text-white/70 hover:bg-white/5" : "text-[#436850] hover:bg-[#FBFADA]"
                              }`}
                            >
                              <span className="text-base">♟️</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{t.name}</p>
                                <p className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>
                                  {t.date ?? "No date"} · {t.maxPlayers} max
                                </p>
                              </div>
                              {active && <span className="text-[#4CAF50] text-xs font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </>
                    )}

                    {/* Published recaps */}
                    {recaps.length > 0 && (
                      <>
                        <div
                          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider border-t ${
                            isDark ? "text-white/30 border-white/5" : "text-[#436850]/50 border-[#ADBC9F]/30"
                          }`}
                        >
                          Published Recaps
                        </div>
                        {recaps.map((r) => {
                          const src: SourceType = `recap:${r.id}`;
                          const active = selectedSource === src;
                          return (
                            <button
                              key={r.id}
                              onClick={() => { setSelectedSource(src); setPickerOpen(false); }}
                              className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors ${
                                active
                                  ? isDark ? "bg-white/8 text-white" : "bg-[#ADBC9F]/30 text-[#12372A]"
                                  : isDark ? "text-white/70 hover:bg-white/5" : "text-[#436850] hover:bg-[#FBFADA]"
                              }`}
                            >
                              <span className="text-base">🏆</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{r.tournamentName ?? "Recap"}</p>
                                <p className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>
                                  {r.eventDate
                                    ? new Date(r.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "No date"}
                                  {r.playerCount ? ` · ${r.playerCount} players` : ""}
                                </p>
                              </div>
                              {active && <span className="text-[#4CAF50] text-xs font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/8 text-white/60 hover:text-white" : "hover:bg-[#ADBC9F]/30 text-[#436850]"
            }`}
            aria-label="Close promo graphic editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body: SocialAssetGenerator ── */}
      <div className="flex-1 overflow-y-auto">
        <SocialAssetGenerator config={config} />
      </div>
    </div>
  );
}
