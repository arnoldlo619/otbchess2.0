/**
 * clubBattleRegistry.ts
 * localStorage-backed registry for club head-to-head battle records.
 */

export type BattleStatus = "pending" | "active" | "completed";
export type BattleResult = "player_a" | "player_b" | "draw";

export interface ClubBattle {
  id: string;
  clubId: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  status: BattleStatus;
  result?: BattleResult;
  notes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BattleLeaderboardEntry {
  playerId: string;
  playerName: string;
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number;
  streak: number;
}

export interface HeadToHeadRecord {
  opponentId: string;
  opponentName: string;
  opponentAvatarUrl?: string | null;
  wins: number;
  draws: number;
  losses: number;
  total: number;
}

export interface PlayerBattleSummary {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  winRate: number;
}

function storageKey(clubId: string): string {
  return `otb_battles_${clubId}`;
}

function loadBattles(clubId: string): ClubBattle[] {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    return raw ? (JSON.parse(raw) as ClubBattle[]) : [];
  } catch {
    return [];
  }
}

function saveBattles(clubId: string, battles: ClubBattle[]): void {
  localStorage.setItem(storageKey(clubId), JSON.stringify(battles));
}

function generateId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listBattles(clubId: string): ClubBattle[] {
  return loadBattles(clubId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function createBattle(
  clubId: string,
  params: {
    playerAId: string;
    playerAName: string;
    playerBId: string;
    playerBName: string;
    notes?: string;
  }
): ClubBattle {
  const battle: ClubBattle = {
    id: generateId(),
    clubId,
    playerAId: params.playerAId,
    playerAName: params.playerAName,
    playerBId: params.playerBId,
    playerBName: params.playerBName,
    status: "pending",
    notes: params.notes,
    createdAt: new Date().toISOString(),
  };
  const battles = loadBattles(clubId);
  battles.push(battle);
  saveBattles(clubId, battles);
  return battle;
}

export function startBattle(clubId: string, battleId: string): void {
  const battles = loadBattles(clubId);
  const idx = battles.findIndex((b) => b.id === battleId);
  if (idx === -1) return;
  battles[idx] = { ...battles[idx], status: "active", startedAt: new Date().toISOString() };
  saveBattles(clubId, battles);
}

export function recordBattleResult(clubId: string, battleId: string, result: BattleResult): void {
  const battles = loadBattles(clubId);
  const idx = battles.findIndex((b) => b.id === battleId);
  if (idx === -1) return;
  battles[idx] = { ...battles[idx], status: "completed", result, completedAt: new Date().toISOString() };
  saveBattles(clubId, battles);
}

export function deleteBattle(clubId: string, battleId: string): void {
  saveBattles(clubId, loadBattles(clubId).filter((b) => b.id !== battleId));
}

export function getBattleLeaderboard(clubId: string): BattleLeaderboardEntry[] {
  const completed = loadBattles(clubId).filter((b) => b.status === "completed" && b.result);
  const map = new Map<string, { name: string; wins: number; draws: number; losses: number; history: string[] }>();

  function ensure(id: string, name: string) {
    if (!map.has(id)) map.set(id, { name, wins: 0, draws: 0, losses: 0, history: [] });
  }

  for (const battle of completed) {
    ensure(battle.playerAId, battle.playerAName);
    ensure(battle.playerBId, battle.playerBName);
    const a = map.get(battle.playerAId)!;
    const b = map.get(battle.playerBId)!;
    if (battle.result === "player_a") {
      a.wins++; a.history.push("win");
      b.losses++; b.history.push("loss");
    } else if (battle.result === "player_b") {
      b.wins++; b.history.push("win");
      a.losses++; a.history.push("loss");
    } else {
      a.draws++; a.history.push("draw");
      b.draws++; b.history.push("draw");
    }
  }

  const entries: BattleLeaderboardEntry[] = [];
  for (const [playerId, stats] of Array.from(map.entries())) {
    const total = stats.wins + stats.draws + stats.losses;
    const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
    let streak = 0;
    for (let i = stats.history.length - 1; i >= 0; i--) {
      const r = stats.history[i];
      if (streak === 0) {
        if (r === "win") streak = 1;
        else if (r === "loss") streak = -1;
        else break;
      } else if (streak > 0 && r === "win") streak++;
      else if (streak < 0 && r === "loss") streak--;
      else break;
    }
    entries.push({ playerId, playerName: stats.name, wins: stats.wins, draws: stats.draws, losses: stats.losses, total, winRate, streak });
  }
  return entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
}

export function getHeadToHeadRecords(
  clubId: string,
  playerId: string,
  members?: Array<{ userId: string; avatarUrl?: string | null }>
): HeadToHeadRecord[] {
  const completed = loadBattles(clubId).filter(
    (b) => b.status === "completed" && b.result && (b.playerAId === playerId || b.playerBId === playerId)
  );
  const map = new Map<string, { name: string; wins: number; draws: number; losses: number }>();
  function ensure(id: string, name: string) {
    if (!map.has(id)) map.set(id, { name, wins: 0, draws: 0, losses: 0 });
  }
  for (const battle of completed) {
    const isA = battle.playerAId === playerId;
    const opponentId = isA ? battle.playerBId : battle.playerAId;
    const opponentName = isA ? battle.playerBName : battle.playerAName;
    ensure(opponentId, opponentName);
    const entry = map.get(opponentId)!;
    if (battle.result === "draw") entry.draws++;
    else if ((battle.result === "player_a" && isA) || (battle.result === "player_b" && !isA)) entry.wins++;
    else entry.losses++;
  }
  return Array.from(map.entries()).map(([opponentId, stats]) => {
    const member = members?.find((m) => m.userId === opponentId);
    return {
      opponentId,
      opponentName: stats.name,
      opponentAvatarUrl: member?.avatarUrl ?? null,
      wins: stats.wins,
      draws: stats.draws,
      losses: stats.losses,
      total: stats.wins + stats.draws + stats.losses,
    };
  }).sort((a, b) => b.total - a.total);
}

export function getPlayerBattleSummary(clubId: string, playerId: string): PlayerBattleSummary {
  const records = getHeadToHeadRecords(clubId, playerId);
  const wins = records.reduce((s, r) => s + r.wins, 0);
  const draws = records.reduce((s, r) => s + r.draws, 0);
  const losses = records.reduce((s, r) => s + r.losses, 0);
  const total = wins + draws + losses;
  return { wins, draws, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
}

// ── Player of the Month Archive ───────────────────────────────────────────────

export interface PotmArchiveEntry {
  clubId: string;
  monthKey: string;   // "YYYY-MM"
  memberId: string;
  memberName: string;
  avatarUrl?: string;
  battleWins: number;
  winRate: number;
  eventsAttended: number;
  score: number;
  savedAt: string;
}

function potmArchiveKey(clubId: string): string {
  return `otb-potm-archive-${clubId}`;
}

export function loadPotmArchive(clubId: string): PotmArchiveEntry[] {
  try {
    const raw = localStorage.getItem(potmArchiveKey(clubId));
    return raw ? (JSON.parse(raw) as PotmArchiveEntry[]) : [];
  } catch {
    return [];
  }
}

export function savePotmArchive(clubId: string, entries: PotmArchiveEntry[]): void {
  localStorage.setItem(potmArchiveKey(clubId), JSON.stringify(entries));
}

/**
 * Snapshot the current POTM winner for the given month if not already stored.
 * Returns the updated archive.
 */
export function snapshotPotmWinner(
  clubId: string,
  monthKey: string,
  winner: Omit<PotmArchiveEntry, "clubId" | "monthKey" | "savedAt">
): PotmArchiveEntry[] {
  const archive = loadPotmArchive(clubId);
  const alreadyStored = archive.some((e) => e.monthKey === monthKey);
  if (alreadyStored) return archive;
  const entry: PotmArchiveEntry = {
    clubId,
    monthKey,
    savedAt: new Date().toISOString(),
    ...winner,
  };
  const updated = [entry, ...archive];
  savePotmArchive(clubId, updated);
  return updated;
}

// ── Demo battle seeder ────────────────────────────────────────────────────────
// Generates realistic ELO-weighted head-to-head battle results for the 18 demo
// chess.com players. Higher-rated players win more often but upsets occur.

const DEMO_PLAYER_RATINGS: Record<string, number> = {
  demo_magnuscarlsen: 2941,
  demo_hikaru: 2839,
  demo_firouzja2003: 2844,
  demo_fabianocaruana: 2766,
  demo_gmwso: 2799,
  demo_ghandeevam2003: 2802,
  demo_rpragchess: 2711,
  demo_gukeshdommaraju: 2709,
  demo_lordillidan: 2744,
  demo_gothamchess: 2453,
  demo_gmcanty: 2457,
  demo_alexandrabotez: 2320,
  demo_annacramling: 2278,
  demo_nemsko: 2114,
  demo_alexbanzea: 2044,
  demo_dinabelenkaya: 2059,
  demo_arnoldadri: 1520,
  demo_pircuhset: 896,
};

const DEMO_PLAYER_NAMES: Record<string, string> = {
  demo_magnuscarlsen: "Magnus Carlsen",
  demo_hikaru: "Hikaru Nakamura",
  demo_firouzja2003: "Alireza Firouzja",
  demo_fabianocaruana: "Fabiano Caruana",
  demo_gmwso: "Wesley So",
  demo_ghandeevam2003: "Arjun Erigaisi",
  demo_rpragchess: "Praggnanandhaa R",
  demo_gukeshdommaraju: "Gukesh D",
  demo_lordillidan: "Richard Rapport",
  demo_gothamchess: "Levy Rozman",
  demo_gmcanty: "James Canty",
  demo_alexandrabotez: "Alexandra Botez",
  demo_annacramling: "Anna Cramling",
  demo_nemsko: "Nemo Zhou",
  demo_alexbanzea: "Alexandru Banzea",
  demo_dinabelenkaya: "Dina Belenkaya",
  demo_arnoldadri: "Arnold",
  demo_pircuhset: "Adrian",
};

/** Expected score for player A vs player B using ELO formula */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Seeded pseudo-random number (deterministic for reproducibility) */
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/**
 * Seed realistic head-to-head battle results for all demo players in a club.
 * Each pair plays between 1–4 games. Results are ELO-weighted with ~10% draw rate.
 * Safe to call multiple times — skips battles already seeded.
 * Returns the number of battles added.
 */
export function seedDemoBattlesToClub(clubId: string): number {
  const existing = loadBattles(clubId);
  // If demo battles already exist, skip
  if (existing.some((b) => b.id.startsWith("demo_battle_"))) return 0;

  const playerIds = Object.keys(DEMO_PLAYER_RATINGS);
  const now = Date.now();
  const msPerDay = 86_400_000;
  const newBattles: ClubBattle[] = [];
  let seed = 42;

  // Generate battles for every pair (upper triangle only)
  playerIds.forEach((idA, i) => {
    playerIds.slice(i + 1).forEach((idB, j) => {
      const ratingA = DEMO_PLAYER_RATINGS[idA];
      const ratingB = DEMO_PLAYER_RATINGS[idB];
      const expA = expectedScore(ratingA, ratingB);

      // Number of games: 1–3 for most pairs, 4 for top rivalries
      const isTopRivalry = ratingA >= 2700 && ratingB >= 2700;
      const numGames = isTopRivalry ? 3 + Math.floor(seededRandom(seed++) * 2) : 1 + Math.floor(seededRandom(seed++) * 3);

      for (let g = 0; g < numGames; g++) {
        const r = seededRandom(seed++);
        let result: BattleResult;
        const drawThreshold = 0.12; // 12% draw rate
        if (r < drawThreshold) {
          result = "draw";
        } else {
          // Adjust for draw threshold: remaining probability split by ELO expectation
          const adjustedR = (r - drawThreshold) / (1 - drawThreshold);
          result = adjustedR < expA ? "player_a" : "player_b";
        }

        // Stagger dates: most recent battles first, spread over last 12 months
        const daysAgo = Math.floor(seededRandom(seed++) * 365);
        const hoursAgo = Math.floor(seededRandom(seed++) * 8);
        const completedAt = new Date(now - daysAgo * msPerDay - hoursAgo * 3_600_000).toISOString();
        const startedAt = new Date(new Date(completedAt).getTime() - (30 + Math.floor(seededRandom(seed++) * 90)) * 60_000).toISOString();
        const createdAt = new Date(new Date(startedAt).getTime() - 5 * 60_000).toISOString();

        newBattles.push({
          id: `demo_battle_${i}_${j}_${g}`,
          clubId,
          playerAId: idA,
          playerAName: DEMO_PLAYER_NAMES[idA],
          playerBId: idB,
          playerBName: DEMO_PLAYER_NAMES[idB],
          status: "completed",
          result,
          createdAt,
          startedAt,
          completedAt,
        });
      }
    });
  });

  saveBattles(clubId, [...existing, ...newBattles]);
  return newBattles.length;
}
