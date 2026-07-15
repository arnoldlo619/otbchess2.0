// server/prep/openingBook.ts — load and query the EPD-keyed opening book
// Book file: data/ecoByEpd.json (3,733 positions, committed as-is from packet-4)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export interface BookEntry {
  eco: string;
  name: string;
  ply: number;
}

let _book: Record<string, BookEntry> | null = null;

function resolveBookPath(): string {
  // In production, the server bundle is at dist/index.js and data/ is copied
  // alongside it as dist/data/ during build. process.cwd() is /usr/src in
  // the Cloud Run container, so data/ is at /usr/src/data/.
  // In development, process.cwd() is the project root, same layout.
  // We try the cwd-relative path first (works in both envs), then fall back
  // to a path relative to this source file (works in dev with tsx/ts-node).
  const cwdPath = join(process.cwd(), "data/ecoByEpd.json");
  try {
    if (existsSync(cwdPath)) return cwdPath;
  } catch { /* fall through */ }
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, "../../data/ecoByEpd.json");
  } catch {
    return cwdPath;
  }
}

export function getBook(): Record<string, BookEntry> {
  if (_book) return _book;
  const raw = readFileSync(resolveBookPath(), "utf-8");
  const parsed = JSON.parse(raw);
  // The JSON has a { _meta, book } wrapper per packet-4 spec
  _book = (parsed.book ?? parsed) as Record<string, BookEntry>;
  return _book;
}

/** Look up an EPD (first 4 FEN fields) in the opening book. */
export function lookupEpd(epd: string): BookEntry | undefined {
  return getBook()[epd];
}
