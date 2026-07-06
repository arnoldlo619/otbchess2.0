// server/prep/openingBook.ts — load and query the EPD-keyed opening book
// Book file: data/ecoByEpd.json (3,733 positions, committed as-is from packet-4)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export interface BookEntry {
  eco: string;
  name: string;
  ply: number;
}

let _book: Record<string, BookEntry> | null = null;

function resolveBookPath(): string {
  // Works in both ESM and CJS contexts
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, "../../data/ecoByEpd.json");
  } catch {
    // CJS fallback
    return join(process.cwd(), "data/ecoByEpd.json");
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
