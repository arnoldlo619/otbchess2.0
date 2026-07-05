/**
 * Quads Completion Engine
 * 
 * Handles the post-tournament lifecycle for Quads:
 * - Prize template generation and assignment
 * - Winner and achievement detection
 * - Tournament recap data generation
 * - Caption generation for social sharing
 * 
 * All functions are pure data transformers that accept tournament state
 * and return structured results for the API layer to persist.
 */

import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuadSection {
  id: string;
  name: string;
  type: "quad" | "bottom_swiss";
  players: QuadPlayer[];
  standings: QuadStanding[];
  games: QuadGame[];
}

export interface QuadPlayer {
  id: string;
  name: string;
  rating: number;
  seed: number;
  chesscomUsername?: string;
  userId?: string;
}

export interface QuadStanding {
  playerId: string;
  name: string;
  rating: number;
  score: number;
  wins: number;
  draws: number;
  losses: number;
  rank: number;
  tiebreak: number;
}

export interface QuadGame {
  id: string;
  round: number;
  whiteId: string;
  blackId: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  sectionId: string;
}

export interface TournamentMeta {
  tournamentId: string;
  tournamentName: string;
  venue?: string;
  date?: string;
  hostName?: string;
  hostId?: string;
  clubId?: string;
  timeControl?: string;
  format: string;
  playerCount: number;
}

// ─── Prize Template Types ────────────────────────────────────────────────────

export type PrizeTemplateType =
  | "winner_each_quad"
  | "top_section_weighted"
  | "every_section_equal"
  | "quad1_podium_plus_winners"
  | "custom";

export interface PrizeSlot {
  id: string;
  sectionId: string;
  sectionName: string;
  placement: number;
  prizeTitle: string;
  prizeType: "cash" | "gift_card" | "merch" | "trophy" | "raffle" | "recognition";
  prizeValue: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  assignedPlayerId?: string;
  assignedPlayerName?: string;
  status: "pending" | "assigned" | "claimed";
  templateType: PrizeTemplateType;
}

// ─── Achievement Types ───────────────────────────────────────────────────────

export type AchievementType =
  | "quad_champion"
  | "quad1_champion"
  | "perfect_score"
  | "undefeated"
  | "upset_winner"
  | "best_comeback"
  | "top_scorer"
  | "section_winner"
  | "first_otb_tournament"
  | "club_champion";

export interface Achievement {
  id: string;
  playerId: string;
  playerName: string;
  tournamentId: string;
  tournamentName: string;
  sectionId: string;
  sectionName: string;
  achievementType: AchievementType;
  title: string;
  description: string;
}

// ─── Recap Types ─────────────────────────────────────────────────────────────

export interface ChampionCard {
  playerId: string;
  playerName: string;
  rating: number;
  sectionName: string;
  sectionId: string;
  finalScore: string;
  badges: AchievementType[];
  prizeWon?: string;
  chesscomUsername?: string;
}

export interface SectionRecap {
  sectionId: string;
  sectionName: string;
  sectionType: "quad" | "bottom_swiss";
  standings: QuadStanding[];
  games: QuadGame[];
  champion: ChampionCard;
}

export interface TournamentHighlights {
  perfectScores: { playerName: string; sectionName: string }[];
  biggestUpset: { playerName: string; sectionName: string; seed: number } | null;
  closestSection: { sectionName: string; marginOfVictory: number } | null;
  undefeatedPlayers: { playerName: string; sectionName: string }[];
  mostCompetitiveSection: { sectionName: string; drawPercentage: number } | null;
}

export interface RecapData {
  meta: TournamentMeta;
  champions: ChampionCard[];
  sections: SectionRecap[];
  highlights: TournamentHighlights;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIZE TEMPLATE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate prize slots from a template type.
 * Returns unassigned prize slots that the host can review and edit.
 */
export function generatePrizeTemplate(
  sections: QuadSection[],
  templateType: PrizeTemplateType,
  tournamentId: string
): PrizeSlot[] {
  switch (templateType) {
    case "winner_each_quad":
      return templateWinnerEachQuad(sections, tournamentId);
    case "top_section_weighted":
      return templateTopSectionWeighted(sections, tournamentId);
    case "every_section_equal":
      return templateEverySectionEqual(sections, tournamentId);
    case "quad1_podium_plus_winners":
      return templateQuad1PodiumPlusWinners(sections, tournamentId);
    case "custom":
      return [];
    default:
      return [];
  }
}

function templateWinnerEachQuad(sections: QuadSection[], tournamentId: string): PrizeSlot[] {
  return sections.map((s, i) => ({
    id: nanoid(),
    sectionId: s.id,
    sectionName: s.name,
    placement: 1,
    prizeTitle: `${s.name} Champion`,
    prizeType: "cash" as const,
    prizeValue: "",
    status: "pending" as const,
    templateType: "winner_each_quad" as const,
  }));
}

function templateTopSectionWeighted(sections: QuadSection[], tournamentId: string): PrizeSlot[] {
  const prizes: PrizeSlot[] = [];
  sections.forEach((s, i) => {
    const value = i === 0 ? "$40" : i === 1 ? "$25" : i === 2 ? "$15" : "";
    const prizeType = i < 3 ? "cash" as const : "recognition" as const;
    prizes.push({
      id: nanoid(),
      sectionId: s.id,
      sectionName: s.name,
      placement: 1,
      prizeTitle: i === 0 ? `${s.name} Champion (Top Section)` : `${s.name} Champion`,
      prizeType,
      prizeValue: value,
      status: "pending" as const,
      templateType: "top_section_weighted" as const,
    });
  });
  return prizes;
}

function templateEverySectionEqual(sections: QuadSection[], tournamentId: string): PrizeSlot[] {
  return sections.map((s) => ({
    id: nanoid(),
    sectionId: s.id,
    sectionName: s.name,
    placement: 1,
    prizeTitle: `${s.name} Champion`,
    prizeType: "cash" as const,
    prizeValue: "",
    status: "pending" as const,
    templateType: "every_section_equal" as const,
  }));
}

function templateQuad1PodiumPlusWinners(sections: QuadSection[], tournamentId: string): PrizeSlot[] {
  const prizes: PrizeSlot[] = [];
  sections.forEach((s, i) => {
    if (i === 0) {
      // Quad 1 gets podium (1st, 2nd, 3rd)
      prizes.push(
        { id: nanoid(), sectionId: s.id, sectionName: s.name, placement: 1, prizeTitle: `${s.name} — 1st Place`, prizeType: "cash", prizeValue: "", status: "pending", templateType: "quad1_podium_plus_winners" },
        { id: nanoid(), sectionId: s.id, sectionName: s.name, placement: 2, prizeTitle: `${s.name} — 2nd Place`, prizeType: "cash", prizeValue: "", status: "pending", templateType: "quad1_podium_plus_winners" },
        { id: nanoid(), sectionId: s.id, sectionName: s.name, placement: 3, prizeTitle: `${s.name} — 3rd Place`, prizeType: "cash", prizeValue: "", status: "pending", templateType: "quad1_podium_plus_winners" }
      );
    } else {
      prizes.push({
        id: nanoid(),
        sectionId: s.id,
        sectionName: s.name,
        placement: 1,
        prizeTitle: `${s.name} Champion`,
        prizeType: "recognition",
        prizeValue: "",
        status: "pending",
        templateType: "quad1_podium_plus_winners",
      });
    }
  });
  return prizes;
}

/**
 * Auto-assign prizes to winners based on final standings.
 * Only assigns to slots that are still "pending".
 */
export function assignPrizesToWinners(
  prizes: PrizeSlot[],
  sections: QuadSection[]
): PrizeSlot[] {
  return prizes.map((prize) => {
    if (prize.status !== "pending") return prize;
    const section = sections.find((s) => s.id === prize.sectionId);
    if (!section) return prize;
    const standing = section.standings.find((st) => st.rank === prize.placement);
    if (!standing) return prize;
    return {
      ...prize,
      assignedPlayerId: standing.playerId,
      assignedPlayerName: standing.name,
      status: "assigned" as const,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WINNER & ACHIEVEMENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect all achievements earned in a completed Quads tournament.
 */
export function detectAchievements(
  sections: QuadSection[],
  meta: TournamentMeta
): Achievement[] {
  const achievements: Achievement[] = [];

  for (const section of sections) {
    if (section.standings.length === 0) continue;

    const champion = section.standings[0];
    if (!champion) continue;

    // Quad Champion badge
    achievements.push({
      id: nanoid(),
      playerId: champion.playerId,
      playerName: champion.name,
      tournamentId: meta.tournamentId,
      tournamentName: meta.tournamentName,
      sectionId: section.id,
      sectionName: section.name,
      achievementType: "quad_champion",
      title: `${section.name} Champion`,
      description: `Won ${section.name} with a score of ${champion.score}/3`,
    });

    // Quad 1 Champion (top section)
    if (sections.indexOf(section) === 0) {
      achievements.push({
        id: nanoid(),
        playerId: champion.playerId,
        playerName: champion.name,
        tournamentId: meta.tournamentId,
        tournamentName: meta.tournamentName,
        sectionId: section.id,
        sectionName: section.name,
        achievementType: "quad1_champion",
        title: "Top Section Champion",
        description: `Won the top-rated section at ${meta.tournamentName}`,
      });
    }

    // Check each player in the section
    for (const standing of section.standings) {
      const player = section.players.find((p) => p.id === standing.playerId);
      const totalGames = standing.wins + standing.draws + standing.losses;

      // Perfect score (3/3)
      if (standing.score === totalGames && totalGames >= 3) {
        achievements.push({
          id: nanoid(),
          playerId: standing.playerId,
          playerName: standing.name,
          tournamentId: meta.tournamentId,
          tournamentName: meta.tournamentName,
          sectionId: section.id,
          sectionName: section.name,
          achievementType: "perfect_score",
          title: "Perfect Score",
          description: `Scored ${standing.score}/${totalGames} — a perfect tournament!`,
        });
      }

      // Undefeated (no losses)
      if (standing.losses === 0 && totalGames >= 3) {
        achievements.push({
          id: nanoid(),
          playerId: standing.playerId,
          playerName: standing.name,
          tournamentId: meta.tournamentId,
          tournamentName: meta.tournamentName,
          sectionId: section.id,
          sectionName: section.name,
          achievementType: "undefeated",
          title: "Undefeated",
          description: `Finished the tournament without a single loss`,
        });
      }

      // Upset winner (won section as seed 3 or 4)
      if (standing.rank === 1 && player && player.seed >= 3) {
        achievements.push({
          id: nanoid(),
          playerId: standing.playerId,
          playerName: standing.name,
          tournamentId: meta.tournamentId,
          tournamentName: meta.tournamentName,
          sectionId: section.id,
          sectionName: section.name,
          achievementType: "upset_winner",
          title: "Upset Winner",
          description: `Won ${section.name} as the #${player.seed} seed — a true underdog story!`,
        });
      }
    }
  }

  return achievements;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENT RECAP GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate the full recap data for a completed Quads tournament.
 */
export function generateRecapData(
  sections: QuadSection[],
  meta: TournamentMeta,
  prizes: PrizeSlot[]
): RecapData {
  const champions: ChampionCard[] = [];
  const sectionRecaps: SectionRecap[] = [];
  const achievements = detectAchievements(sections, meta);

  for (const section of sections) {
    if (section.standings.length === 0) continue;
    const champion = section.standings[0];
    if (!champion) continue;

    const player = section.players.find((p) => p.id === champion.playerId);
    const playerAchievements = achievements
      .filter((a) => a.playerId === champion.playerId && a.sectionId === section.id)
      .map((a) => a.achievementType);

    const prize = prizes.find(
      (p) => p.sectionId === section.id && p.placement === 1 && p.assignedPlayerId === champion.playerId
    );

    const championCard: ChampionCard = {
      playerId: champion.playerId,
      playerName: champion.name,
      rating: champion.rating,
      sectionName: section.name,
      sectionId: section.id,
      finalScore: `${champion.score}/${champion.wins + champion.draws + champion.losses}`,
      badges: playerAchievements,
      prizeWon: prize?.prizeValue || undefined,
      chesscomUsername: player?.chesscomUsername,
    };

    champions.push(championCard);
    sectionRecaps.push({
      sectionId: section.id,
      sectionName: section.name,
      sectionType: section.type,
      standings: section.standings,
      games: section.games,
      champion: championCard,
    });
  }

  const highlights = detectHighlights(sections);

  return { meta, champions, sections: sectionRecaps, highlights };
}

/**
 * Detect tournament highlights for the recap page.
 */
export function detectHighlights(sections: QuadSection[]): TournamentHighlights {
  const perfectScores: { playerName: string; sectionName: string }[] = [];
  const undefeatedPlayers: { playerName: string; sectionName: string }[] = [];
  let biggestUpset: { playerName: string; sectionName: string; seed: number } | null = null;
  let closestSection: { sectionName: string; marginOfVictory: number } | null = null;
  let mostCompetitiveSection: { sectionName: string; drawPercentage: number } | null = null;

  for (const section of sections) {
    if (section.standings.length === 0) continue;

    for (const standing of section.standings) {
      const totalGames = standing.wins + standing.draws + standing.losses;
      if (standing.score === totalGames && totalGames >= 3) {
        perfectScores.push({ playerName: standing.name, sectionName: section.name });
      }
      if (standing.losses === 0 && totalGames >= 3) {
        undefeatedPlayers.push({ playerName: standing.name, sectionName: section.name });
      }
    }

    // Upset detection
    const champion = section.standings[0];
    const player = section.players.find((p) => p.id === champion?.playerId);
    if (champion && player && player.seed >= 3) {
      if (!biggestUpset || player.seed > biggestUpset.seed) {
        biggestUpset = { playerName: champion.name, sectionName: section.name, seed: player.seed };
      }
    }

    // Closest section (smallest margin between 1st and 2nd)
    if (section.standings.length >= 2) {
      const margin = section.standings[0].score - section.standings[1].score;
      if (!closestSection || margin < closestSection.marginOfVictory) {
        closestSection = { sectionName: section.name, marginOfVictory: margin };
      }
    }

    // Most competitive (highest draw percentage)
    const completedGames = section.games.filter((g) => g.result !== "*");
    if (completedGames.length > 0) {
      const draws = completedGames.filter((g) => g.result === "1/2-1/2").length;
      const drawPct = draws / completedGames.length;
      if (!mostCompetitiveSection || drawPct > mostCompetitiveSection.drawPercentage) {
        mostCompetitiveSection = { sectionName: section.name, drawPercentage: drawPct };
      }
    }
  }

  return { perfectScores, biggestUpset, closestSection, undefeatedPlayers, mostCompetitiveSection };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPTION GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate an Instagram-ready caption for the tournament.
 */
export function generateCaption(
  meta: TournamentMeta,
  champions: ChampionCard[],
  recapUrl?: string
): string {
  const lines: string[] = [];
  lines.push(`Another great night of over-the-board chess ♟️`);
  lines.push("");
  lines.push(`Congrats to our Quad Champions from ${meta.tournamentName}:`);
  lines.push("");

  for (const champ of champions) {
    lines.push(`${champ.sectionName}: ${champ.playerName} (${champ.finalScore})`);
  }

  lines.push("");
  lines.push(`${meta.playerCount} players across ${champions.length} sections competed${meta.venue ? ` at ${meta.venue}` : ""}.`);
  lines.push("");

  if (recapUrl) {
    lines.push(`View the full recap: ${recapUrl}`);
    lines.push("");
  }

  lines.push(`#ChessOTB #ChessClub #OverTheBoard #QuadsTournament`);

  return lines.join("\n");
}

/**
 * Generate a sponsor thank-you caption.
 */
export function generateSponsorCaption(
  meta: TournamentMeta,
  sponsors: string[]
): string {
  if (sponsors.length === 0) return "";
  const lines: string[] = [];
  lines.push(`Big thanks to our sponsors for making ${meta.tournamentName} possible! 🙏`);
  lines.push("");
  for (const sponsor of sponsors) {
    lines.push(`• ${sponsor}`);
  }
  lines.push("");
  lines.push(`Your support helps grow the local chess community.`);
  lines.push("");
  lines.push(`#ChessOTB #ChessClub #SupportLocalChess`);
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLUG GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a URL-safe slug for the recap page.
 */
export function generateRecapSlug(tournamentName: string, date?: string): string {
  const base = tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const suffix = date ? `-${date.replace(/\//g, "-")}` : `-${nanoid(6)}`;
  return `${base}${suffix}`;
}
