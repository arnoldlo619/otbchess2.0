import { intersectArchiveCatalogs, type ArchiveCandidate } from "./foundation.js";

export const OFFICIAL_ARCHIVE_LIST_URL = "https://database.lichess.org/standard/list.txt";
export const OFFICIAL_ARCHIVE_CHECKSUM_URL = "https://database.lichess.org/standard/sha256sums.txt";

export type ArchiveFetch = (url: string) => Promise<Response>;

/** Discovery has a fixed allowlist; no supplied or redirected host is accepted. */
export async function discoverOfficialArchiveCatalog(fetcher: ArchiveFetch = fetch): Promise<ArchiveCandidate[]> {
  const [listResponse, checksumResponse] = await Promise.all([
    fetcher(OFFICIAL_ARCHIVE_LIST_URL),
    fetcher(OFFICIAL_ARCHIVE_CHECKSUM_URL),
  ]);
  if (!listResponse.ok || !checksumResponse.ok) throw new Error("PopulationArchiveCatalogUnavailable");
  return intersectArchiveCatalogs(await listResponse.text(), await checksumResponse.text());
}

export type IngestionGateResult = { allowed: true } | { allowed: false; reason: "approval_missing" | "batch_runtime_required" | "archive_budget_exceeded" };

/** Never permits whole-file processing from the web worker or a generic server process. */
export function ingestionGate(env: Record<string, string | undefined>, archiveBytes: number): IngestionGateResult {
  if (env.POPULATION_INGESTION_APPROVED !== "1") return { allowed: false, reason: "approval_missing" };
  if (env.POPULATION_INGESTION_ENV !== "batch") return { allowed: false, reason: "batch_runtime_required" };
  const budget = Number(env.POPULATION_INGESTION_MAX_ARCHIVE_BYTES);
  if (!Number.isSafeInteger(budget) || budget < archiveBytes) return { allowed: false, reason: "archive_budget_exceeded" };
  return { allowed: true };
}

/** Selects a catalog entry by exact filename after checksum-backed discovery. */
export function selectArchive(catalog: ArchiveCandidate[], filename: string): ArchiveCandidate | null {
  return catalog.find(candidate => candidate.filename === filename) ?? null;
}
