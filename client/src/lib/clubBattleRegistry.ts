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
