/**
 * OTB Chess — CSV Export Utility
 *
 * Generates a downloadable CSV file of final tournament standings.
 * Columns: Rank, Name, Username, ELO, Score, Wins, Draws, Losses,
 *          Buchholz, Buchholz Cut-1, Sonneborn-Berger
 *
 * Works entirely in the browser — no server round-trip required.
 */

import type { StandingRow } from "./swiss";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CsvExportOptions {
  /** Tournament name used as the filename prefix, e.g. "Spring Open 2025" */
  tournamentName: string;
  /** Optional date string appended to the filename, e.g. "2025-04-12" */
  date?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape a single CSV cell value.
 * Wraps the value in double-quotes and escapes any internal double-quotes.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If the value contains a comma, newline, or double-quote, wrap in quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialise an array of StandingRow objects into a CSV string.
 *
 * Columns:
 *   Rank, Name, Username, ELO, Score, Wins, Draws, Losses,
 *   Buchholz, Buchholz Cut-1, Sonneborn-Berger
 */
export function standingsToCsv(rows: StandingRow[]): string {
  const header = [
    "Rank",
    "Name",
    "Username",
    "ELO",
    "Score",
    "Wins",
    "Draws",
    "Losses",
    "Buchholz",
    "Buchholz Cut-1",
    "Sonneborn-Berger",
  ]
    .map(escapeCsvCell)
    .join(",");

  const lines = rows.map((row) =>
    [
      row.rank,
      row.player.name,
      row.player.username,
      row.player.elo,
      row.points,
      row.wins,
      row.draws,
      row.losses,
      row.buchholz.toFixed(1),
      row.buchholzCut1.toFixed(1),
      row.sonnebornBerger.toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return [header, ...lines].join("\r\n");
}

/**
 * Build a safe filename for the CSV download.
 * Strips characters that are invalid in filenames and replaces spaces with underscores.
 */
export function buildCsvFilename(options: CsvExportOptions): string {
  const safeName = options.tournamentName
    .replace(/[/\\?%*:|"<>]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const datePart = options.date ? `_${options.date}` : "";
  return `${safeName}${datePart}_standings.csv`;
}

/**
 * Trigger a browser file download for the given CSV content.
 * Creates a temporary anchor element, clicks it, and revokes the object URL.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * One-shot helper: serialise standings and immediately trigger a download.
 */
export function exportStandingsCsv(
  rows: StandingRow[],
  options: CsvExportOptions
): void {
  const csv = standingsToCsv(rows);
  const filename = buildCsvFilename(options);
  downloadCsv(csv, filename);
}
