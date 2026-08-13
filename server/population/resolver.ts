import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db.js";
import { populationAggregates, populationDatasetVersions, populationTrackedPositions } from "../../shared/schema.js";
import type { PopulationReference, PopulationSpeed } from "../../shared/prepTypes.js";
import { canonicalPosition, shouldShowPopulationComparison } from "./foundation.js";
import type { PopulationExplorerQuery, PopulationExplorerSnapshot } from "./explorer.js";
import { getCachedOfficialPopulationExplorer, peekCachedOfficialPopulationExplorer, warmOfficialPopulationExplorer } from "./explorerCache.js";

const ZERO = BigInt("0");
const HUNDRED = BigInt("100");
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

export interface PopulationResolutionInput {
  fen: string;
  uciPath: string[];
  opponentColor: "white" | "black";
  opponentMoveUci: string;
  opponentMoveSan: string;
  opponentCount: number;
  opponentDenominator: number;
  speeds: PopulationSpeed[];
  ratingBand: number;
  since: string;
  until: string;
}

function monthsInRange(from: string, to: string): string[] {
  const result: string[] = [];
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  for (let year = fromYear, month = fromMonth; year < toYear || (year === toYear && month <= toMonth); month++) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    if (month === 12) { year++; month = 0; }
  }
  return result;
}

function asReference(input: PopulationResolutionInput, source: PopulationReference["source"], availability: PopulationReference["availability"], totals?: { parent: bigint; move: bigint }, metadata?: Partial<PopulationReference>): PopulationReference {
  const position = canonicalPosition(input.fen);
  const filters = { speeds: input.speeds, ratingBand: input.ratingBand, months: { from: input.since, to: input.until } };
  return {
    schemaVersion: 1,
    source,
    availability,
    positionKey: position.key,
    uciPath: input.uciPath,
    opponentColor: input.opponentColor,
    opponentMoveUci: input.opponentMoveUci,
    opponentMoveSan: input.opponentMoveSan,
    opponentCount: input.opponentCount,
    opponentDenominator: input.opponentDenominator,
    ...(totals ? { populationMoveCount: totals.move.toString(), populationDenominator: totals.parent.toString() } : {}),
    filters,
    ...metadata,
  };
}

/** Resolves one reference independently. A failure never changes opponent evidence. */
function referenceFromOfficialSnapshot(input: PopulationResolutionInput, snapshot: PopulationExplorerSnapshot, availability: "complete" | "limited" | "stale"): PopulationReference {
  const move = snapshot.moves.find(item => item.uci === input.opponentMoveUci)?.count ?? ZERO;
  const eligible = shouldShowPopulationComparison({ opponentReached: input.opponentDenominator, opponentMoveCount: input.opponentCount, populationTotal: Number(snapshot.positionTotal > MAX_SAFE ? MAX_SAFE : snapshot.positionTotal), complete: snapshot.positionTotal >= HUNDRED });
  return asReference(input, "lichess-opening-explorer", eligible ? availability : "limited", { parent: snapshot.positionTotal, move }, {
    cacheObservedAt: new Date().toISOString(),
    ...(eligible ? {} : { limitedReason: snapshot.positionTotal < HUNDRED ? "population_below_threshold" : "incomplete_coverage" }),
  });
}

/** Cache-only mode keeps primary Matchup Prep report delivery independent of upstream latency. */
export async function resolvePopulationReference(input: PopulationResolutionInput, options: { allowNetwork?: boolean } = {}): Promise<PopulationReference> {
  const position = canonicalPosition(input.fen);
  const requiredMonths = monthsInRange(input.since, input.until);
  try {
    const db = await getDb();
    const [tracked] = await db.select().from(populationTrackedPositions)
      .where(and(eq(populationTrackedPositions.positionKey, position.key), eq(populationTrackedPositions.active, true))).limit(1);
    const [dataset] = await db.select().from(populationDatasetVersions)
      .where(eq(populationDatasetVersions.status, "published")).orderBy(desc(populationDatasetVersions.publishedAt)).limit(1);
    const completeMonths = dataset ? JSON.parse(dataset.completeMonthsJson) as unknown : [];
    const complete = Boolean(tracked && dataset && Array.isArray(completeMonths) && requiredMonths.every(month => completeMonths.includes(month)));
    if (complete && dataset) {
      const rows = await db.select().from(populationAggregates).where(and(
        eq(populationAggregates.datasetId, dataset.id),
        eq(populationAggregates.positionKey, position.key),
        eq(populationAggregates.ratingBand, input.ratingBand),
        inArray(populationAggregates.speed, input.speeds),
      ));
      const parents = new Map<string, bigint>();
      let move = ZERO;
      for (const row of rows) {
        parents.set(row.speed, row.parentTotal);
        if (row.moveUci === input.opponentMoveUci) move += row.moveTotal;
      }
      const parent = Array.from(parents.values()).reduce((sum, count) => sum + count, ZERO);
      return asReference(input, "lichess-open-database-local", parent >= HUNDRED ? "complete" : "limited", { parent, move }, {
        datasetVersion: dataset.id,
        completeMonths: requiredMonths,
        ...(parent < HUNDRED ? { limitedReason: "population_below_threshold" } : {}),
      });
    }
  } catch {
    // Local unavailability is intentionally non-fatal; official fallback remains independent.
  }

  try {
    const query: PopulationExplorerQuery = { uciPath: input.uciPath, speeds: input.speeds, ratingBand: input.ratingBand, since: input.since, until: input.until };
    const cached = await peekCachedOfficialPopulationExplorer(query);
    if (cached) {
      if (cached.stale) warmOfficialPopulationExplorer(query);
      return referenceFromOfficialSnapshot(input, cached.snapshot, cached.stale ? "stale" : "complete");
    }
    if (options.allowNetwork === false) {
      warmOfficialPopulationExplorer(query);
      return asReference(input, "unavailable", "pending");
    }
    return referenceFromOfficialSnapshot(input, await getCachedOfficialPopulationExplorer(query), "complete");
  } catch {
    return asReference(input, "unavailable", "unavailable", undefined, { limitedReason: "upstream_unavailable" });
  }
}
