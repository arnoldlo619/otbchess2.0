import { eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { populationExplorerCache } from "../../shared/schema.js";
import { fetchOfficialPopulationExplorer, populationExplorerRequestKey, type PopulationExplorerQuery, type PopulationExplorerSnapshot } from "./explorer.js";

const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 48 * 60 * 60 * 1000;

interface StoredSnapshot {
  positionTotal: string;
  white: string;
  draws: string;
  black: string;
  moves: { uci: string; san: string; averageRating: number; count: string; white: string; draws: string; black: string }[];
}

function toStored(snapshot: PopulationExplorerSnapshot): StoredSnapshot {
  return {
    positionTotal: snapshot.positionTotal.toString(), white: snapshot.white.toString(), draws: snapshot.draws.toString(), black: snapshot.black.toString(),
    moves: snapshot.moves.map(move => ({ uci: move.uci, san: move.san, averageRating: move.averageRating, count: move.count.toString(), white: move.white.toString(), draws: move.draws.toString(), black: move.black.toString() })),
  };
}

function parseCount(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid cached population count");
  return BigInt(value);
}

function fromStored(value: unknown): PopulationExplorerSnapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid cached population snapshot");
  const input = value as Partial<StoredSnapshot>;
  if (!Array.isArray(input.moves)) throw new Error("Invalid cached population moves");
  return {
    positionTotal: parseCount(input.positionTotal), white: parseCount(input.white), draws: parseCount(input.draws), black: parseCount(input.black),
    moves: input.moves.map(move => {
      if (!move || typeof move.uci !== "string" || typeof move.san !== "string" || !Number.isSafeInteger(move.averageRating) || move.averageRating < 0) throw new Error("Invalid cached population move");
      return { uci: move.uci, san: move.san, averageRating: move.averageRating, count: parseCount(move.count), white: parseCount(move.white), draws: parseCount(move.draws), black: parseCount(move.black) };
    }),
  };
}

async function refresh(query: PopulationExplorerQuery, requestKey: string): Promise<PopulationExplorerSnapshot> {
  const snapshot = await fetchOfficialPopulationExplorer(query);
  try {
    const db = await getDb();
    const now = new Date();
    await db.insert(populationExplorerCache).values({
      requestKey,
      responseJson: JSON.stringify(toStored(snapshot)),
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + FRESH_MS),
      staleUntil: new Date(now.getTime() + STALE_MS),
      sourceMonthFrom: query.since,
      sourceMonthTo: query.until,
    }).onDuplicateKeyUpdate({ set: { responseJson: JSON.stringify(toStored(snapshot)), fetchedAt: now, expiresAt: new Date(now.getTime() + FRESH_MS), staleUntil: new Date(now.getTime() + STALE_MS), sourceMonthFrom: query.since, sourceMonthTo: query.until } });
  } catch {
    // Database caching is opportunistic. The validated official response remains usable.
  }
  return snapshot;
}

/** Reads a fresh or permitted stale aggregate snapshot without creating network work. */
export async function peekCachedOfficialPopulationExplorer(query: PopulationExplorerQuery): Promise<{ snapshot: PopulationExplorerSnapshot; stale: boolean } | null> {
  const requestKey = populationExplorerRequestKey(query);
  try {
    const db = await getDb();
    const [cached] = await db.select().from(populationExplorerCache).where(eq(populationExplorerCache.requestKey, requestKey)).limit(1);
    if (!cached || cached.staleUntil.getTime() < Date.now()) return null;
    return { snapshot: fromStored(JSON.parse(cached.responseJson)), stale: cached.expiresAt.getTime() < Date.now() };
  } catch {
    return null;
  }
}

/** Starts a bounded refresh in the shared Lichess lane without coupling it to report delivery. */
export function warmOfficialPopulationExplorer(query: PopulationExplorerQuery): void {
  void refresh(query, populationExplorerRequestKey(query)).catch(() => undefined);
}

/** Fresh cache, stale-while-revalidate, then official fallback. Never combines data sources. */
export async function getCachedOfficialPopulationExplorer(query: PopulationExplorerQuery): Promise<PopulationExplorerSnapshot> {
  const requestKey = populationExplorerRequestKey(query);
  try {
    const db = await getDb();
    const [cached] = await db.select().from(populationExplorerCache).where(eq(populationExplorerCache.requestKey, requestKey)).limit(1);
    if (cached) {
      const snapshot = fromStored(JSON.parse(cached.responseJson));
      const now = Date.now();
      if (cached.expiresAt.getTime() >= now) return snapshot;
      if (cached.staleUntil.getTime() >= now) {
        void refresh(query, requestKey).catch(() => undefined);
        return snapshot;
      }
    }
  } catch {
    // Continue to official adapter rather than blocking a report on cache health.
  }
  return refresh(query, requestKey);
}
