/**
 * generateResultsPdf
 *
 * Generates a printable A4 PDF for a completed (or in-progress) OTB Chess tournament.
 *
 * Sections:
 *   1. Tournament header  — name, date, location, format, time control
 *   2. Final Standings    — Rank, Name, ELO, Points, W / D / L, Buchholz
 *   3. Cross-Table        — players as rows & columns; cells show result from row-player's perspective
 *
 * Dependencies: jspdf, jspdf-autotable (loaded dynamically to keep initial bundle small)
 */

import { getStandings } from "./tournamentData";
import type { Player, Round, Result } from "./tournamentData";

// ─── Brand colours ────────────────────────────────────────────────────────────
const GREEN_DARK = [61, 107, 71] as [number, number, number];   // #3D6B47
const GREEN_MID  = [76, 175, 80] as [number, number, number];   // #4CAF50
const GREY_LIGHT = [245, 245, 245] as [number, number, number]; // #F5F5F5
const GREY_MED   = [200, 200, 200] as [number, number, number]; // #C8C8C8
const GREY_DIAG  = [230, 230, 230] as [number, number, number]; // diagonal cell

// ─── Public helpers (also exported for unit testing) ─────────────────────────

/** Returns the result of `rowPlayerId` against `colPlayerId` across all rounds. */
export function getCrossTableCell(
  rounds: Round[],
  rowPlayerId: string,
  colPlayerId: string
): string {
  for (const round of rounds) {
    for (const game of round.games) {
      if (game.result === "*") continue; // pending
      if (game.whiteId === rowPlayerId && game.blackId === colPlayerId) {
        return resultFromWhitePerspective(game.result);
      }
      if (game.blackId === rowPlayerId && game.whiteId === colPlayerId) {
        return resultFromBlackPerspective(game.result);
      }
    }
  }
  return ""; // not yet played
}

function resultFromWhitePerspective(result: Result): string {
  if (result === "1-0") return "1";
  if (result === "0-1") return "0";
  if (result === "½-½") return "½";
  return "";
}

function resultFromBlackPerspective(result: Result): string {
  if (result === "0-1") return "1";
  if (result === "1-0") return "0";
  if (result === "½-½") return "½";
  return "";
}

/** Builds the cross-table data matrix (rows = sorted players, cols = sorted players). */
export function buildCrossTableMatrix(
  sortedPlayers: Player[],
  rounds: Round[]
): { headers: string[]; rows: string[][] } {
  const headers = ["#", "Player", ...sortedPlayers.map((_, i) => String(i + 1)), "Pts"];
  const rows = sortedPlayers.map((rowPlayer, rowIdx) => {
    const cells = sortedPlayers.map((colPlayer, colIdx) => {
      if (rowIdx === colIdx) return "—"; // diagonal
      return getCrossTableCell(rounds, rowPlayer.id, colPlayer.id);
    });
    return [String(rowIdx + 1), rowPlayer.name, ...cells, String(rowPlayer.points)];
  });
  return { headers, rows };
}

/** Builds the standings rows for the PDF table. */
export function buildStandingsRows(sortedPlayers: Player[]): string[][] {
  return sortedPlayers.map((p, i) => [
    String(i + 1),
    p.title ? `${p.title} ${p.name}` : p.name,
    String(p.elo),
    String(p.points),
    `${p.wins}`,
    `${p.draws}`,
    `${p.losses}`,
    p.buchholz.toFixed(1),
  ]);
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface PdfOptions {
  tournamentName: string;
  date?: string;
  location?: string;
  timeControl?: string;
  totalRounds?: number;
  players: Player[];
  rounds: Round[];
}

export async function generateResultsPdf(opts: PdfOptions): Promise<void> {
  // Dynamic imports keep jsPDF + autoTable out of the initial bundle
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const {
    tournamentName,
    date = "",
    location = "",
    timeControl = "",
    totalRounds,
    players,
    rounds,
  } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = margin;

  // ── 1. Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, pageW, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OTB Chess", margin, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("chessotb.club", margin, 16);

  // Tournament name (right-aligned in header)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(tournamentName, pageW - margin, 10, { align: "right" });

  cursorY = 30;

  // ── 2. Meta row ────────────────────────────────────────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const metaParts: string[] = [];
  if (date) metaParts.push(`Date: ${date}`);
  if (location) metaParts.push(`Venue: ${location}`);
  if (timeControl) metaParts.push(`Time Control: ${timeControl}`);
  if (totalRounds) metaParts.push(`Rounds: ${totalRounds}`);
  metaParts.push(`Players: ${players.length}`);

  doc.text(metaParts.join("   •   "), margin, cursorY);
  cursorY += 3;

  // Thin divider
  doc.setDrawColor(...GREY_MED);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 6;

  // ── 3. Final Standings table ───────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Final Standings", margin, cursorY);
  cursorY += 4;

  const sortedPlayers = getStandings(players);
  const standingsRows = buildStandingsRows(sortedPlayers);

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "Player", "ELO", "Pts", "W", "D", "L", "Buch."]],
    body: standingsRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 2.5, font: "helvetica" },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "left", cellWidth: 54 },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "center", cellWidth: 10, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 10 },
      5: { halign: "center", cellWidth: 10 },
      6: { halign: "center", cellWidth: 10 },
      7: { halign: "center", cellWidth: 16 },
    },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didParseCell: (data) => {
      // Highlight rank 1–3 in the # column
      if (data.section === "body" && data.column.index === 0) {
        const rank = parseInt(data.cell.raw as string, 10);
        if (rank === 1) data.cell.styles.fillColor = [255, 215, 0];   // gold
        if (rank === 2) data.cell.styles.fillColor = [192, 192, 192]; // silver
        if (rank === 3) data.cell.styles.fillColor = [205, 127, 50];  // bronze
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // ── 4. Cross-Table ─────────────────────────────────────────────────────────
  // If there are many players the cross-table may be wide — switch to landscape
  // for > 10 players to keep it readable.
  const needsLandscape = sortedPlayers.length > 10;

  if (needsLandscape) {
    doc.addPage("a4", "landscape");
    cursorY = margin;
  } else if (cursorY > 200) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Cross-Table", margin, cursorY);
  cursorY += 4;

  const { headers: ctHeaders, rows: ctRows } = buildCrossTableMatrix(sortedPlayers, rounds);

  // Dynamic column widths: narrow for result cells, wider for name
  const pageWUsed = needsLandscape
    ? doc.internal.pageSize.getWidth()
    : pageW;
  const resultCellW = Math.max(6, Math.min(10, (pageWUsed - margin * 2 - 10 - 40 - 10) / sortedPlayers.length));
  const nameCellW = Math.min(50, pageWUsed - margin * 2 - 10 - resultCellW * sortedPlayers.length - 10);

  const ctColumnStyles: Record<number, object> = {
    0: { halign: "center" as const, cellWidth: 8 },
    1: { halign: "left" as const, cellWidth: nameCellW },
  };
  // Result columns
  for (let i = 0; i < sortedPlayers.length; i++) {
    ctColumnStyles[i + 2] = { halign: "center" as const, cellWidth: resultCellW };
  }
  // Points column (last)
  ctColumnStyles[sortedPlayers.length + 2] = { halign: "center" as const, cellWidth: 10, fontStyle: "bold" as const };

  autoTable(doc, {
    startY: cursorY,
    head: [ctHeaders],
    body: ctRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2, font: "helvetica" },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: ctColumnStyles,
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didParseCell: (data) => {
      if (data.section === "body") {
        // Diagonal cells
        const colIdx = data.column.index;
        const rowIdx = data.row.index;
        if (colIdx >= 2 && colIdx < sortedPlayers.length + 2) {
          const playerCol = colIdx - 2;
          if (playerCol === rowIdx) {
            data.cell.styles.fillColor = GREY_DIAG;
            data.cell.styles.textColor = [160, 160, 160];
          }
        }
        // Colour result cells
        if (data.cell.raw === "1") {
          data.cell.styles.textColor = [34, 139, 34];
          data.cell.styles.fontStyle = "bold";
        } else if (data.cell.raw === "0") {
          data.cell.styles.textColor = [200, 40, 40];
        } else if (data.cell.raw === "½") {
          data.cell.styles.textColor = [30, 100, 200];
        }
      }
    },
  });

  // ── 5. Footer on every page ────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Generated by OTB Chess (chessotb.club) — ${new Date().toLocaleDateString()}`,
      margin,
      ph - 6
    );
    doc.text(`Page ${p} / ${totalPages}`, pw - margin, ph - 6, { align: "right" });
    // Green accent line at bottom
    doc.setDrawColor(...GREEN_MID);
    doc.setLineWidth(0.5);
    doc.line(0, ph - 10, pw, ph - 10);
  }

  // ── 6. Save ────────────────────────────────────────────────────────────────
  const safeName = tournamentName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`otb-${safeName}-results.pdf`);
}
