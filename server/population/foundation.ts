import { createHash } from "crypto";
import { Chess } from "chess.js";

export const LICHESS_RATING_GROUPS = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500] as const;
export type LichessRatingGroup = (typeof LICHESS_RATING_GROUPS)[number];
export type PopulationSpeed = "bullet" | "blitz" | "rapid";
export const POPULATION_SCHEMA_VERSION = 1;
export const TRACKED_SET_VERSION = 1;

const ARCHIVE_HOST = "database.lichess.org";
const ARCHIVE_PATH = "/standard/";
const ARCHIVE_FILE_RE = /^lichess_db_standard_rated_(\d{4}-(0[1-9]|1[0-2]))\.pgn\.zst$/;
const CHECKSUM_ROW_RE = /^([a-f0-9]{64}) {2}(lichess_db_standard_rated_\d{4}-(?:0[1-9]|1[0-2])\.pgn\.zst)$/;

export interface ArchiveCandidate {
  filename: string;
  month: string;
  url: string;
  expectedSha256: string;
}

export interface CanonicalPosition {
  epd: string;
  key: string;
  sideToMove: "white" | "black";
}

/** Canonicalizes a trusted standard position without volatile move counters. */
export function canonicalPosition(fen: string): CanonicalPosition {
  const chess = new Chess(fen);
  const fields = chess.fen().split(" ");
  const epd = fields.slice(0, 4).join(" ");
  return {
    epd,
    key: createHash("sha256").update(epd).digest("hex"),
    sideToMove: fields[1] === "w" ? "white" : "black",
  };
}

export function classifyArchiveSpeed(estimatedSeconds: number): PopulationSpeed | "excluded" {
  if (!Number.isFinite(estimatedSeconds)) return "excluded";
  if (estimatedSeconds >= 30 && estimatedSeconds < 180) return "bullet";
  if (estimatedSeconds >= 180 && estimatedSeconds < 480) return "blitz";
  if (estimatedSeconds >= 480 && estimatedSeconds < 1500) return "rapid";
  return "excluded";
}

export function ratingBandForAverage(averageRating: number): LichessRatingGroup | null {
  if (!Number.isSafeInteger(averageRating) || averageRating < 0) return null;
  let selected: LichessRatingGroup = 0;
  for (const group of LICHESS_RATING_GROUPS) {
    if (averageRating >= group) selected = group;
  }
  return selected;
}

function validArchiveUrl(value: string): { filename: string; month: string; url: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== ARCHIVE_HOST || url.port || url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.startsWith(ARCHIVE_PATH) || url.pathname !== `${ARCHIVE_PATH}${url.pathname.split("/").pop()}`) return null;
    const filename = url.pathname.slice(ARCHIVE_PATH.length);
    const match = filename.match(ARCHIVE_FILE_RE);
    if (!match || decodeURIComponent(url.pathname) !== url.pathname) return null;
    return { filename, month: match[1], url: url.toString() };
  } catch {
    return null;
  }
}

/** Intersects only fully validated official catalog/checksum pairs. */
export function intersectArchiveCatalogs(listText: string, checksumText: string): ArchiveCandidate[] {
  const catalog = new Map<string, { month: string; url: string }>();
  for (const line of listText.split(/\r?\n/)) {
    const candidate = validArchiveUrl(line.trim());
    if (candidate) catalog.set(candidate.filename, { month: candidate.month, url: candidate.url });
  }
  const checksums = new Map<string, string>();
  for (const line of checksumText.split(/\r?\n/)) {
    const row = line.match(CHECKSUM_ROW_RE);
    if (row) checksums.set(row[2], row[1]);
  }
  return Array.from(catalog.entries())
    .filter(([filename]) => checksums.has(filename))
    .map(([filename, value]) => ({ filename, month: value.month, url: value.url, expectedSha256: checksums.get(filename)! }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Population can contextualize a qualifying evidence node, never create one. */
export function shouldShowPopulationComparison(input: {
  opponentReached: number;
  opponentMoveCount: number;
  populationTotal: number;
  complete: boolean;
}): boolean {
  return input.complete && input.opponentReached >= 8 && input.opponentMoveCount >= 6 && input.populationTotal >= 100;
}

export function isSignatureChoice(input: {
  opponentReached: number;
  opponentMoveCount: number;
  opponentSecondMoveCount: number;
  populationTotal: number;
  opponentShare: number;
  populationShare: number;
  complete: boolean;
}): boolean {
  return input.complete
    && input.opponentReached >= 8
    && input.opponentMoveCount >= 6
    && input.opponentShare >= 0.6
    && input.opponentShare - (input.opponentSecondMoveCount / input.opponentReached) >= 0.15
    && input.populationTotal >= 1000
    && input.opponentShare - input.populationShare >= 0.2;
}
