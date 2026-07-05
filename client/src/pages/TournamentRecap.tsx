/**
 * TournamentRecap
 *
 * Public-facing auto-generated recap page for completed quads tournaments.
 * Route: /recap/:slug
 *
 * Sections:
 * 1. Hero banner with tournament name, venue, date
 * 2. Champions showcase (cards with badges, scores, chess.com avatars)
 * 3. Section-by-section results (expandable)
 * 4. Highlights reel (perfect scores, upsets, closest section)
 * 5. Host notes (editable by host before publishing)
 * 6. Share/Download CTA
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  Trophy, Calendar, MapPin, Users, Clock, ChevronDown, ChevronUp,
  ExternalLink, Share2, Crown, Zap, Shield, Target
} from "lucide-react";
import AchievementBadge, { AchievementBadgeGrid, type AchievementType } from "../components/tournament/AchievementBadge";
import SocialAssetGenerator from "../components/tournament/SocialAssetGenerator";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecapChampion {
  playerId: string;
  playerName: string;
  rating: number;
  sectionId: string;
  sectionName: string;
  finalScore: string;
  badges: AchievementType[];
  chesscomUsername?: string;
}

interface RecapSection {
  id: string;
  name: string;
  type: "quad" | "bottom_swiss";
  standings: {
    playerId: string;
    name: string;
    rating: number;
    score: number;
    rank: number;
  }[];
  games: {
    round: number;
    whiteName: string;
    blackName: string;
    result: string;
  }[];
}

interface RecapHighlights {
  perfectScores: { playerName: string; sectionName: string }[];
  biggestUpset: { playerName: string; seed: number; sectionName: string } | null;
  closestSection: { sectionName: string; marginOfVictory: number } | null;
  mostCompetitiveSection: { sectionName: string; drawPercentage: number } | null;
}

interface RecapData {
  meta: {
    tournamentId: string;
    tournamentName: string;
    venue: string;
    date: string;
    hostName: string;
    clubId: string;
    timeControl: string;
    format: string;
    playerCount: number;
  };
  champions: RecapChampion[];
  sections: RecapSection[];
  highlights: RecapHighlights;
  hostNotes?: string;
  publishedAt?: string;
  slug: string;
  privacyMode?: "standard" | "scholastic" | "anonymous";
}

export default function TournamentRecap() {
  const params = useParams<{ slug: string }>();
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecap() {
      try {
        const res = await fetch(`/api/recap/${params.slug}`);
        if (!res.ok) throw new Error(res.status === 404 ? "Recap not found" : "Failed to load recap");
        const raw = await res.json();
        // Map server DB row to RecapData shape
        const privacyMode = raw.privacyMode || "standard";
        const champions = (raw.championsJson || []) as RecapChampion[];
        const sections = (raw.sectionsJson || []) as RecapSection[];
        const highlights = (raw.highlightsJson || {}) as RecapHighlights;
        // Apply privacy masking
        const maskName = (name: string) => {
          if (privacyMode === "anonymous") return "Player";
          if (privacyMode === "scholastic") return name.split(" ")[0] + " " + (name.split(" ")[1]?.[0] || "") + ".";
          return name;
        };
        const maskedChampions = champions.map((c) => ({ ...c, playerName: maskName(c.playerName) }));
        const maskedSections = sections.map((s) => ({
          ...s,
          standings: s.standings?.map((st) => ({ ...st, name: maskName(st.name) })) || [],
          games: s.games?.map((g) => ({ ...g, whiteName: maskName(g.whiteName), blackName: maskName(g.blackName) })) || [],
        }));
        const data: RecapData = {
          meta: {
            tournamentId: raw.tournamentId,
            tournamentName: raw.tournamentName || "Tournament",
            venue: raw.venue || "",
            date: raw.eventDate || "",
            hostName: raw.hostName || "",
            clubId: raw.clubId || "",
            timeControl: raw.timeControl || "",
            format: raw.format || "quads",
            playerCount: raw.playerCount || 0,
          },
          champions: maskedChampions,
          sections: maskedSections,
          highlights,
          hostNotes: raw.customNote || undefined,
          publishedAt: raw.publishedAt || undefined,
          slug: raw.slug,
          privacyMode,
        };
        setRecap(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRecap();
  }, [params.slug]);

  if (loading) return <RecapSkeleton />;
  if (error || !recap) return <RecapError error={error} />;

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.12 0.03 145)" }}>
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.18 0.06 145), oklch(0.12 0.04 145))",
          borderBottom: "1px solid oklch(0.25 0.05 145)",
        }}
      >
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Trophy size={20} style={{ color: "oklch(0.75 0.15 85)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.65 0.08 145)" }}>
              Tournament Recap
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black" style={{ color: "oklch(0.95 0.02 145)" }}>
            {recap.meta.tournamentName}
          </h1>
          <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.60 0.04 145)" }}>
              <MapPin size={12} /> {recap.meta.venue}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.60 0.04 145)" }}>
              <Calendar size={12} /> {new Date(recap.meta.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.60 0.04 145)" }}>
              <Users size={12} /> {recap.meta.playerCount} players
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.60 0.04 145)" }}>
              <Clock size={12} /> {recap.meta.timeControl}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Champions Showcase */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: "oklch(0.92 0.02 145)" }}>
            <Crown size={18} style={{ color: "oklch(0.75 0.15 85)" }} />
            Champions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recap.champions.map((champ) => (
              <ChampionCard key={champ.playerId} champion={champ} />
            ))}
          </div>
        </section>

        {/* Highlights */}
        {(recap.highlights.perfectScores.length > 0 || recap.highlights.biggestUpset || recap.highlights.closestSection) && (
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: "oklch(0.92 0.02 145)" }}>
              <Zap size={18} style={{ color: "oklch(0.70 0.18 30)" }} />
              Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recap.highlights.perfectScores.map((p, i) => (
                <HighlightCard
                  key={i}
                  icon={<Target size={16} style={{ color: "oklch(0.70 0.20 145)" }} />}
                  title="Perfect Score"
                  description={`${p.playerName} won all games in ${p.sectionName}`}
                />
              ))}
              {recap.highlights.biggestUpset && (
                <HighlightCard
                  icon={<Zap size={16} style={{ color: "oklch(0.70 0.18 30)" }} />}
                  title="Biggest Upset"
                  description={`${recap.highlights.biggestUpset.playerName} won as #${recap.highlights.biggestUpset.seed} seed in ${recap.highlights.biggestUpset.sectionName}`}
                />
              )}
              {recap.highlights.closestSection && (
                <HighlightCard
                  icon={<Shield size={16} style={{ color: "oklch(0.65 0.15 250)" }} />}
                  title="Closest Section"
                  description={`${recap.highlights.closestSection.sectionName} — won by ${recap.highlights.closestSection.marginOfVictory} point${recap.highlights.closestSection.marginOfVictory !== 1 ? "s" : ""}`}
                />
              )}
            </div>
          </section>
        )}

        {/* Section Results */}
        <section>
          <h2 className="text-lg font-bold mb-4" style={{ color: "oklch(0.92 0.02 145)" }}>
            Full Results
          </h2>
          <div className="space-y-2">
            {recap.sections.map((section) => {
              const isExpanded = expandedSection === section.id;
              return (
                <div
                  key={section.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: "oklch(0.16 0.03 145)", border: "1px solid oklch(0.25 0.04 145)" }}
                >
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.02 145)" }}>
                        {section.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "oklch(0.22 0.04 145)", color: "oklch(0.60 0.04 145)" }}>
                        {section.type === "bottom_swiss" ? "Swiss" : "Round Robin"}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} style={{ color: "oklch(0.55 0.04 145)" }} /> : <ChevronDown size={16} style={{ color: "oklch(0.55 0.04 145)" }} />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Standings table */}
                      <div className="rounded-lg overflow-hidden" style={{ background: "oklch(0.14 0.02 145)" }}>
                        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-3 py-1.5 text-[10px] font-medium"
                          style={{ color: "oklch(0.50 0.04 145)", borderBottom: "1px solid oklch(0.22 0.04 145)" }}>
                          <span>#</span><span>Player</span><span>Rating</span><span>Score</span>
                        </div>
                        {section.standings.map((s) => (
                          <div key={s.playerId}
                            className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-3 py-2 text-xs"
                            style={{ color: "oklch(0.85 0.02 145)", borderBottom: "1px solid oklch(0.18 0.03 145)" }}>
                            <span style={{ color: s.rank === 1 ? "oklch(0.75 0.15 85)" : "oklch(0.55 0.04 145)" }}>
                              {s.rank}
                            </span>
                            <span className="font-medium truncate">{s.name}</span>
                            <span style={{ color: "oklch(0.55 0.04 145)" }}>{s.rating}</span>
                            <span className="font-bold" style={{ color: s.rank === 1 ? "oklch(0.75 0.15 85)" : "oklch(0.80 0.02 145)" }}>
                              {s.score}/{section.standings.length - 1}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Games list */}
                      {section.games.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold mb-1.5" style={{ color: "oklch(0.55 0.04 145)" }}>Games</h4>
                          <div className="space-y-1">
                            {[1, 2, 3].map((round) => {
                              const roundGames = section.games.filter((g) => g.round === round);
                              if (roundGames.length === 0) return null;
                              return (
                                <div key={round}>
                                  <span className="text-[9px] font-medium" style={{ color: "oklch(0.45 0.04 145)" }}>
                                    Round {round}
                                  </span>
                                  {roundGames.map((g, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px] py-0.5" style={{ color: "oklch(0.75 0.02 145)" }}>
                                      <span className="truncate flex-1 text-right">{g.whiteName}</span>
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                                        style={{ background: "oklch(0.20 0.04 145)", color: "oklch(0.70 0.04 145)" }}>
                                        {g.result}
                                      </span>
                                      <span className="truncate flex-1">{g.blackName}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Host Notes */}
        {recap.hostNotes && (
          <section>
            <h2 className="text-lg font-bold mb-3" style={{ color: "oklch(0.92 0.02 145)" }}>
              Director's Notes
            </h2>
            <div className="p-4 rounded-xl" style={{ background: "oklch(0.16 0.03 145)", border: "1px solid oklch(0.25 0.04 145)" }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "oklch(0.75 0.02 145)" }}>
                {recap.hostNotes}
              </p>
              <p className="text-[10px] mt-2" style={{ color: "oklch(0.45 0.04 145)" }}>
                — {recap.meta.hostName}, Tournament Director
              </p>
            </div>
          </section>
        )}

        {/* Social Media Export */}
        <section>
          <h2 className="text-lg font-bold mb-3" style={{ color: "oklch(0.92 0.02 145)" }}>
            Share on Social Media
          </h2>
          <SocialAssetGenerator
            config={{
              tournamentName: recap.meta.tournamentName,
              clubName: recap.meta.hostName,
              eventDate: recap.meta.date,
              venue: recap.meta.venue,
              champions: recap.champions.map((c) => ({
                playerName: c.playerName,
                rating: c.rating,
                sectionName: c.sectionName,
                finalScore: c.finalScore,
                badges: c.badges,
              })),
              playerCount: recap.meta.playerCount,
              format: recap.meta.format,
              timeControl: recap.meta.timeControl,
            }}
          />
        </section>

        {/* Footer */}
        <footer className="text-center pt-6 pb-10" style={{ borderTop: "1px solid oklch(0.22 0.04 145)" }}>
          <p className="text-xs mb-3" style={{ color: "oklch(0.50 0.04 145)" }}>
            Powered by <Link href="/" className="font-semibold hover:underline" style={{ color: "oklch(0.65 0.10 145)" }}>ChessOTB.club</Link>
          </p>
          <button
            onClick={() => navigator.share?.({ title: recap.meta.tournamentName, url: window.location.href }) || navigator.clipboard.writeText(window.location.href)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "oklch(0.25 0.06 145)", color: "oklch(0.85 0.02 145)" }}
          >
            <Share2 size={13} /> Share Recap
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChampionCard({ champion }: { champion: RecapChampion }) {
  return (
    <div
      className="p-4 rounded-xl relative overflow-hidden"
      style={{ background: "oklch(0.16 0.04 145)", border: "1px solid oklch(0.28 0.06 145)" }}
    >
      {/* Gold shimmer for quad1 champion */}
      {champion.badges.includes("quad1_champion") && (
        <div className="absolute inset-0 opacity-5" style={{ background: "linear-gradient(135deg, oklch(0.75 0.15 85), transparent)" }} />
      )}
      <div className="relative flex items-start gap-3">
        {/* Avatar placeholder */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: "oklch(0.22 0.06 145)", color: "oklch(0.75 0.15 85)" }}
        >
          {champion.playerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate" style={{ color: "oklch(0.92 0.02 145)" }}>
              {champion.playerName}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: "oklch(0.25 0.08 85)", color: "oklch(0.75 0.15 85)" }}>
              {champion.finalScore}
            </span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "oklch(0.55 0.04 145)" }}>
            {champion.sectionName} • {champion.rating}
          </div>
          {champion.badges.length > 0 && (
            <div className="mt-2">
              <AchievementBadgeGrid
                achievements={champion.badges.map((b) => ({ type: b, tournamentName: "", earned: "" }))}
                badgeSize={24}
                maxVisible={5}
              />
            </div>
          )}
          {champion.chesscomUsername && (
            <a
              href={`https://www.chess.com/member/${champion.chesscomUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] mt-1.5 hover:underline"
              style={{ color: "oklch(0.60 0.08 145)" }}
            >
              @{champion.chesscomUsername} <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: "oklch(0.16 0.03 145)", border: "1px solid oklch(0.25 0.04 145)" }}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-semibold" style={{ color: "oklch(0.88 0.02 145)" }}>{title}</span>
      </div>
      <p className="text-[11px]" style={{ color: "oklch(0.60 0.04 145)" }}>{description}</p>
    </div>
  );
}

function RecapSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.12 0.03 145)" }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
          style={{ borderColor: "oklch(0.45 0.10 145)", borderTopColor: "transparent" }} />
        <p className="text-xs" style={{ color: "oklch(0.55 0.04 145)" }}>Loading recap...</p>
      </div>
    </div>
  );
}

function RecapError({ error }: { error: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.12 0.03 145)" }}>
      <div className="text-center max-w-sm px-6">
        <Trophy size={32} style={{ color: "oklch(0.40 0.06 145)" }} className="mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-1" style={{ color: "oklch(0.85 0.02 145)" }}>
          {error === "Recap not found" ? "Recap Not Found" : "Error Loading Recap"}
        </h2>
        <p className="text-xs mb-4" style={{ color: "oklch(0.55 0.04 145)" }}>
          {error === "Recap not found"
            ? "This tournament recap doesn't exist or hasn't been published yet."
            : "Something went wrong. Please try again later."}
        </p>
        <Link href="/" className="text-xs font-semibold hover:underline" style={{ color: "oklch(0.65 0.10 145)" }}>
          ← Back to ChessOTB
        </Link>
      </div>
    </div>
  );
}
