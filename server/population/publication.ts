import { and, count, eq } from "drizzle-orm";
import { getDb } from "../db.js";
import { populationAggregates, populationDatasetVersions } from "../../shared/schema.js";

export interface AggregateValidationRow {
  parentTotal: bigint;
  moveTotal: bigint;
  whiteWins: bigint;
  draws: bigint;
  blackWins: bigint;
}

/** Validates monotonic aggregate counters before a staging dataset can publish. */
export function validateAggregateRows(rows: AggregateValidationRow[]): void {
  if (!rows.length) throw new Error("PopulationAggregateValidationEmpty");
  const zero = BigInt("0");
  for (const row of rows) {
    if ([row.parentTotal, row.moveTotal, row.whiteWins, row.draws, row.blackWins].some(value => value < zero)) throw new Error("PopulationAggregateValidationNegative");
    if (row.moveTotal > row.parentTotal) throw new Error("PopulationAggregateValidationMoveExceedsParent");
    if (row.whiteWins + row.draws + row.blackWins !== row.moveTotal) throw new Error("PopulationAggregateValidationOutcomeMismatch");
  }
}

/** Atomically promotes a fully validated staging version and retires the prior published version. */
export async function publishPopulationDataset(datasetId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [candidate] = await tx.select().from(populationDatasetVersions)
      .where(and(eq(populationDatasetVersions.id, datasetId), eq(populationDatasetVersions.status, "staging"))).limit(1);
    if (!candidate) throw new Error("PopulationDatasetNotStaging");
    const [aggregateCount] = await tx.select({ value: count() }).from(populationAggregates).where(eq(populationAggregates.datasetId, datasetId));
    if (!aggregateCount?.value) throw new Error("PopulationDatasetHasNoAggregates");
    const now = new Date();
    await tx.update(populationDatasetVersions).set({ status: "retired" }).where(eq(populationDatasetVersions.status, "published"));
    await tx.update(populationDatasetVersions).set({ status: "published", publishedAt: now }).where(eq(populationDatasetVersions.id, datasetId));
  });
}

/** Rolls back by atomically republishing a known retained version. */
export async function rollbackPopulationDataset(targetDatasetId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [target] = await tx.select().from(populationDatasetVersions)
      .where(and(eq(populationDatasetVersions.id, targetDatasetId), eq(populationDatasetVersions.status, "retired"))).limit(1);
    if (!target) throw new Error("PopulationRollbackTargetUnavailable");
    const now = new Date();
    await tx.update(populationDatasetVersions).set({ status: "retired" }).where(eq(populationDatasetVersions.status, "published"));
    await tx.update(populationDatasetVersions).set({ status: "published", publishedAt: now, rolledBackAt: now }).where(eq(populationDatasetVersions.id, targetDatasetId));
  });
}
