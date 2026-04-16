/**
 * generateResultsPdf
 *
 * Generates a printable A4 PDF for a completed (or in-progress) OTB Chess tournament.
 *
 * Pages:
 *   1. Tournament header + Final Standings
 *   2. Cross-Table (landscape for > 10 players)
 *   3. Scoring System — visual explanation of Win/Draw/Loss/Bye points + Buchholz
 *   4. Swiss Pairing System — how players are paired each round
 *
 * Dependencies: jspdf, jspdf-autotable (loaded dynamically to keep initial bundle small)
 */

import { getStandings } from "./tournamentData";
import type { Player, Round, Result } from "./tournamentData";

// ─── Brand colours ────────────────────────────────────────────────────────────
const GREEN_DARK  = [61, 107, 71]   as [number, number, number]; // #3D6B47
const GREEN_MID   = [76, 175, 80]   as [number, number, number]; // #4CAF50
const GREEN_LIGHT = [232, 245, 233] as [number, number, number]; // #E8F5E9
const GREY_LIGHT  = [245, 245, 245] as [number, number, number]; // #F5F5F5
const GREY_MED    = [200, 200, 200] as [number, number, number]; // #C8C8C8
const GREY_DIAG   = [230, 230, 230] as [number, number, number]; // diagonal cell
const GOLD        = [255, 215, 0]   as [number, number, number];
const SILVER      = [192, 192, 192] as [number, number, number];
const BRONZE      = [205, 127, 50]  as [number, number, number];
const WIN_GREEN   = [34, 139, 34]   as [number, number, number];
const LOSS_RED    = [200, 40, 40]   as [number, number, number];
const DRAW_BLUE   = [30, 100, 200]  as [number, number, number];
const TEXT_DARK   = [30, 30, 30]    as [number, number, number];
const TEXT_MID    = [80, 80, 80]    as [number, number, number];
const TEXT_LIGHT  = [140, 140, 140] as [number, number, number];

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

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Draws the standard OTB Chess page header (green bar + tournament info). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPageHeader(doc: any, tournamentName: string, pageW: number, clubName?: string, clubLogoBase64?: string): void {
  // Green header bar
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, pageW, 22, "F");

  // Club logo (left side) — rendered as a small square image if available
  const logoSize = 14; // mm — fits neatly in the 22mm header
  const logoX = 14;
  const logoY = 4;
  let textStartX = 14;

  if (clubLogoBase64) {
    try {
      // Detect image format from base64 prefix
      const format = clubLogoBase64.startsWith("data:image/png") ? "PNG"
        : clubLogoBase64.startsWith("data:image/webp") ? "WEBP"
        : "JPEG";
      doc.addImage(clubLogoBase64, format, logoX, logoY, logoSize, logoSize);
      textStartX = logoX + logoSize + 4; // shift text right of logo
    } catch {
      // Logo failed to render — fall through to text-only
    }
  }

  // Brand name — club name if provided, otherwise "OTB Chess"
  const brandName = clubName ? clubName : "OTB Chess";
  const subLabel  = clubName ? "Powered by chessotb.club" : "chessotb.club";

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(clubName ? 11 : 14);
  doc.text(brandName, textStartX, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 230, 200);
  doc.text(subLabel, textStartX, 16.5);

  // Tournament name (right-aligned)
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const name = tournamentName.toUpperCase();
  doc.text(name, pageW - 14, 13, { align: "right" });
}

/** Draws the standard footer on the current page. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawFooter(doc: any, pageNum: number, totalPages: number): void {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Green accent line
  doc.setDrawColor(...GREEN_MID);
  doc.setLineWidth(0.5);
  doc.line(0, ph - 10, pw, ph - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(
    `Generated by OTB Chess (chessotb.club) — ${new Date().toLocaleDateString()}`,
    14,
    ph - 5
  );
  doc.text(`Page ${pageNum} / ${totalPages}`, pw - 14, ph - 5, { align: "right" });
}

/** Draws a filled rounded rectangle (approximated with a regular rect since jsPDF lacks native roundRect). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawCard(doc: any, x: number, y: number, w: number, h: number, fillColor: [number,number,number], borderColor?: [number,number,number]): void {
  doc.setFillColor(...fillColor);
  if (borderColor) {
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
  } else {
    doc.roundedRect(x, y, w, h, 2, 2, "F");
  }
}

// ─── Page 3: Scoring System ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addScoringSystemPage(doc: any, tournamentName: string, clubName?: string, clubLogoBase64?: string): void {
  doc.addPage("a4", "portrait");
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 30;

  drawPageHeader(doc, tournamentName, pageW, clubName, clubLogoBase64);

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Scoring System", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MID);
  doc.text("How points are awarded in each game of this tournament.", margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(...GREY_MED);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Score cards row ──
  const cardW = (pageW - margin * 2 - 9) / 4;
  const cardH = 36;
  const cards = [
    { label: "WIN",  symbol: "1",   sub: "point",  color: WIN_GREEN,  bg: [240, 255, 240] as [number,number,number] },
    { label: "DRAW", symbol: "½",   sub: "point",  color: DRAW_BLUE,  bg: [240, 245, 255] as [number,number,number] },
    { label: "LOSS", symbol: "0",   sub: "points", color: LOSS_RED,   bg: [255, 242, 242] as [number,number,number] },
    { label: "BYE",  symbol: "½",   sub: "point",  color: [130, 90, 200] as [number,number,number],  bg: [248, 242, 255] as [number,number,number] },
  ];

  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + 3);
    drawCard(doc, cx, y, cardW, cardH, card.bg, GREY_MED);

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...card.color);
    doc.text(card.label, cx + cardW / 2, y + 8, { align: "center" });

    // Big number
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...card.color);
    doc.text(card.symbol, cx + cardW / 2, y + 23, { align: "center" });

    // Sub-label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(card.sub, cx + cardW / 2, y + 30, { align: "center" });
  });

  y += cardH + 12;

  // ── Tiebreak section ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Tiebreak: Buchholz Score", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  const buchholzText = [
    "When two or more players finish with the same number of points, the Buchholz score",
    "determines the final ranking. The Buchholz score is the sum of all your opponents'",
    "final scores — meaning it rewards players who faced stronger competition.",
  ];
  buchholzText.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  // Buchholz example box
  drawCard(doc, margin, y, pageW - margin * 2, 32, GREEN_LIGHT, [180, 220, 185] as [number,number,number]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Example", margin + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Player A beats opponents who scored 4, 3, and 2 points → Buchholz = 4 + 3 + 2 = 9", margin + 5, y + 14);
  doc.text("Player B beats opponents who scored 3, 2, and 2 points → Buchholz = 3 + 2 + 2 = 7", margin + 5, y + 21);
  doc.text("Both players have the same points, but Player A ranks higher due to a stronger Buchholz.", margin + 5, y + 28);
  y += 40;

  // ── Tiebreak order ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Tiebreak Order Applied", margin, y);
  y += 6;

  const tiebreaks = [
    ["1st", "Total Points", "The primary ranking criterion — most points wins."],
    ["2nd", "Buchholz Score", "Sum of all opponents' final scores."],
    ["3rd", "Direct Encounter", "Head-to-head result between tied players."],
    ["4th", "Number of Wins", "More wins ranks higher than more draws."],
  ];

  tiebreaks.forEach(([rank, name, desc]) => {
    const rowH = 12;
    drawCard(doc, margin, y, pageW - margin * 2, rowH, GREY_LIGHT, GREY_MED);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GREEN_DARK);
    doc.text(rank, margin + 5, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    doc.text(name, margin + 18, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MID);
    doc.text(desc, margin + 70, y + 8);

    y += rowH + 2;
  });
}

// ─── Page 4: Swiss Pairing System ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addSwissPairingPage(doc: any, tournamentName: string, totalRounds: number, playerCount: number, clubName?: string, clubLogoBase64?: string): void {
  doc.addPage("a4", "portrait");
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 30;

  drawPageHeader(doc, tournamentName, pageW, clubName, clubLogoBase64);

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Swiss Pairing System", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MID);
  doc.text("How opponents are selected each round in a Swiss-system tournament.", margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(...GREY_MED);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Tournament stats summary ──
  const statCards = [
    { label: "FORMAT", value: "Swiss System" },
    { label: "PLAYERS", value: String(playerCount) },
    { label: "ROUNDS", value: String(totalRounds) },
    { label: "MAX GAMES", value: String(totalRounds) + " per player" },
  ];
  const scW = (pageW - margin * 2 - 9) / 4;
  statCards.forEach((sc, i) => {
    const cx = margin + i * (scW + 3);
    drawCard(doc, cx, y, scW, 20, GREY_LIGHT, GREY_MED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(sc.label, cx + scW / 2, y + 6, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_DARK);
    doc.text(sc.value, cx + scW / 2, y + 15, { align: "center" });
  });
  y += 28;

  // ── How Swiss works ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_DARK);
  doc.text("How Swiss Pairings Work", margin, y);
  y += 6;

  const principles = [
    ["Round 1", "Players are paired randomly (or by ELO seed). Color (White/Black) is assigned to balance across the tournament."],
    ["Rounds 2+", "Players are grouped by their current score. The top half of each score group plays the bottom half."],
    ["No Rematches", "The system ensures no two players face each other more than once across all rounds."],
    ["Color Balance", "The system tracks White/Black history and alternates colors as evenly as possible each round."],
    ["Odd Players", "If the player count is odd, the lowest-ranked player with no prior bye receives a half-point bye (½ pt)."],
  ];

  principles.forEach(([title, desc]) => {
    const rowH = 16;
    drawCard(doc, margin, y, pageW - margin * 2, rowH, [250, 252, 250] as [number,number,number], [210, 230, 210] as [number,number,number]);

    // Green left accent bar
    doc.setFillColor(...GREEN_MID);
    doc.rect(margin, y, 2.5, rowH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREEN_DARK);
    doc.text(title, margin + 6, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    // Wrap long description
    const lines = doc.splitTextToSize(desc, pageW - margin * 2 - 10) as string[];
    lines.forEach((line: string, li: number) => {
      doc.text(line, margin + 6, y + 7 + (li + 1) * 5);
    });

    y += rowH + 3;
  });

  y += 4;

  // ── Score group diagram ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Score Group Pairing Diagram (Example: Round 2)", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MID);
  doc.text("After Round 1, players are sorted by score. Within each group, top half plays bottom half:", margin, y);
  y += 7;

  // Score groups
  const groups = [
    { score: "1 point", players: ["Player A (1.0)", "Player B (1.0)", "Player C (1.0)", "Player D (1.0)"], color: WIN_GREEN, bg: [240, 255, 240] as [number,number,number] },
    { score: "½ point", players: ["Player E (0.5)", "Player F (0.5)"], color: DRAW_BLUE, bg: [240, 245, 255] as [number,number,number] },
    { score: "0 points", players: ["Player G (0.0)", "Player H (0.0)"], color: LOSS_RED, bg: [255, 242, 242] as [number,number,number] },
  ];

  groups.forEach(group => {
    const groupH = 8 + group.players.length * 7 + 4;
    drawCard(doc, margin, y, pageW - margin * 2, groupH, group.bg, GREY_MED);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...group.color);
    doc.text(`Score Group: ${group.score}`, margin + 5, y + 7);

    const half = Math.ceil(group.players.length / 2);
    group.players.forEach((player, pi) => {
      const isTopHalf = pi < half;
      const _isBottomHalf = pi >= half;
      const pairIdx = isTopHalf ? pi : pi - half;

      doc.setFont("helvetica", isTopHalf ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_DARK);
      doc.text(`${isTopHalf ? "▲" : "▼"} ${player}`, margin + 8, y + 14 + pi * 7);

      // Pairing arrow between top and bottom half
      if (isTopHalf && pairIdx < half && group.players[pairIdx + half]) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...TEXT_LIGHT);
        doc.text(`→ vs ${group.players[pairIdx + half]}`, margin + 70, y + 14 + pi * 7);
      }
    });

    y += groupH + 4;
  });
}

// ─── Image helper ────────────────────────────────────────────────────────────

/**
 * Fetches an image URL and converts it to a base64 data URI string.
 * Returns undefined on failure (network error, CORS, etc.) so callers can
 * fall back to text-only rendering gracefully.
 */
export async function fetchImageAsBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface PdfOptions {
  tournamentName: string;
  date?: string;
  location?: string;
  timeControl?: string;
  totalRounds?: number;
  format?: string;
  players: Player[];
  rounds: Round[];
  /** Optional club branding — replaces "OTB Chess" in the header when present */
  clubName?: string;
  /** Optional club logo URL — rendered as a small image in the header */
  clubLogoUrl?: string;
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
    format = "Swiss",
    players,
    rounds,
    clubName,
    clubLogoUrl,
  } = opts;

  // Fetch club logo as base64 (best-effort — falls back to undefined on error)
  const clubLogoBase64 = clubLogoUrl ? await fetchImageAsBase64(clubLogoUrl) : undefined;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = margin;

  // ── Page 1: Header + Final Standings ──────────────────────────────────────

  drawPageHeader(doc, tournamentName, pageW, clubName, clubLogoBase64);
  cursorY = 30;

  // Meta row
  doc.setTextColor(...TEXT_MID);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const metaParts: string[] = [];
  if (date) metaParts.push(`Date: ${date}`);
  if (location) metaParts.push(`Venue: ${location}`);
  if (timeControl) metaParts.push(`Time Control: ${timeControl}`);
  if (totalRounds) metaParts.push(`Rounds: ${totalRounds}`);
  metaParts.push(`Players: ${players.length}`);
  if (format) metaParts.push(`Format: ${format}`);

  doc.text(metaParts.join("   •   "), margin, cursorY);
  cursorY += 3;

  // Thin divider
  doc.setDrawColor(...GREY_MED);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 6;

  // Final Standings heading
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
    styles: { fontSize: 8.5, cellPadding: 2.8, font: "helvetica", textColor: TEXT_DARK },
    headStyles: {
      fillColor: GREEN_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "left",   cellWidth: 56 },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "center", cellWidth: 10, fontStyle: "bold" },
      4: { halign: "center", cellWidth: 10 },
      5: { halign: "center", cellWidth: 10 },
      6: { halign: "center", cellWidth: 10 },
      7: { halign: "center", cellWidth: 16 },
    },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const rank = parseInt(data.cell.raw as string, 10);
        if (rank === 1) data.cell.styles.fillColor = GOLD;
        if (rank === 2) data.cell.styles.fillColor = SILVER;
        if (rank === 3) data.cell.styles.fillColor = BRONZE;
      }
      // Bold the Pts column
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // ── Page 2: Cross-Table ────────────────────────────────────────────────────
  const needsLandscape = sortedPlayers.length > 10;

  if (needsLandscape) {
    doc.addPage("a4", "landscape");
  } else {
    doc.addPage("a4", "portrait");
  }

  const pageW2 = doc.internal.pageSize.getWidth();
  cursorY = margin;

  drawPageHeader(doc, tournamentName, pageW2, clubName, clubLogoBase64);
  cursorY = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Cross-Table", margin, cursorY);
  cursorY += 4;

  const { headers: ctHeaders, rows: ctRows } = buildCrossTableMatrix(sortedPlayers, rounds);

  const resultCellW = Math.max(6, Math.min(10, (pageW2 - margin * 2 - 10 - 40 - 10) / sortedPlayers.length));
  const nameCellW = Math.min(50, pageW2 - margin * 2 - 10 - resultCellW * sortedPlayers.length - 10);

  const ctColumnStyles: Record<number, object> = {
    0: { halign: "center" as const, cellWidth: 8 },
    1: { halign: "left" as const, cellWidth: nameCellW },
  };
  for (let i = 0; i < sortedPlayers.length; i++) {
    ctColumnStyles[i + 2] = { halign: "center" as const, cellWidth: resultCellW };
  }
  ctColumnStyles[sortedPlayers.length + 2] = { halign: "center" as const, cellWidth: 10, fontStyle: "bold" as const };

  autoTable(doc, {
    startY: cursorY,
    head: [ctHeaders],
    body: ctRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2, font: "helvetica", textColor: TEXT_DARK },
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
        const colIdx = data.column.index;
        const rowIdx = data.row.index;
        if (colIdx >= 2 && colIdx < sortedPlayers.length + 2) {
          const playerCol = colIdx - 2;
          if (playerCol === rowIdx) {
            data.cell.styles.fillColor = GREY_DIAG;
            data.cell.styles.textColor = [160, 160, 160];
          }
        }
        if (data.cell.raw === "1") {
          data.cell.styles.textColor = WIN_GREEN;
          data.cell.styles.fontStyle = "bold";
        } else if (data.cell.raw === "0") {
          data.cell.styles.textColor = LOSS_RED;
        } else if (data.cell.raw === "½") {
          data.cell.styles.textColor = DRAW_BLUE;
        }
      }
    },
  });

  // ── Page 3: Scoring System ─────────────────────────────────────────────────
  addScoringSystemPage(doc, tournamentName, clubName, clubLogoBase64);

  // ── Page 4: Swiss Pairing System ──────────────────────────────────────────
  addSwissPairingPage(doc, tournamentName, totalRounds ?? rounds.length, players.length, clubName, clubLogoBase64);

  // ── Footers on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const safeName = tournamentName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  doc.save(`otb-${safeName}-results.pdf`);
}

/**
 * generateResultsPdfBuffer
 *
 * Same as generateResultsPdf but returns the PDF as a base64-encoded string
 * instead of triggering a browser download. Used for attaching the PDF to
 * server-side emails via the SMTP system.
 */
export async function generateResultsPdfBuffer(opts: PdfOptions): Promise<string> {
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
    format = "Swiss",
    players,
    rounds,
    clubName,
    clubLogoUrl,
  } = opts;

  // Fetch club logo as base64 (best-effort — falls back to undefined on error)
  const clubLogoBase64 = clubLogoUrl ? await fetchImageAsBase64(clubLogoUrl) : undefined;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = margin;

  // Page 1: Header + Final Standings
  drawPageHeader(doc, tournamentName, pageW, clubName, clubLogoBase64);
  cursorY = 30;

  doc.setTextColor(...TEXT_MID);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const metaParts: string[] = [];
  if (date) metaParts.push(`Date: ${date}`);
  if (location) metaParts.push(`Venue: ${location}`);
  if (timeControl) metaParts.push(`Time Control: ${timeControl}`);
  if (totalRounds) metaParts.push(`Rounds: ${totalRounds}`);
  metaParts.push(`Players: ${players.length}`);
  if (format) metaParts.push(`Format: ${format}`);
  doc.text(metaParts.join("   •   "), margin, cursorY);
  cursorY += 3;
  doc.setDrawColor(...GREY_MED);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageW - margin, cursorY);
  cursorY += 6;

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
    styles: { fontSize: 9, cellPadding: 3, font: "helvetica", textColor: TEXT_DARK },
    headStyles: { fillColor: GREEN_DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index < 3 && data.column.index === 0) {
        const colors = [GOLD, SILVER, BRONZE];
        data.cell.styles.fillColor = colors[data.row.index];
        data.cell.styles.textColor = [30, 30, 30];
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Page 2: Cross-Table
  const needsLandscape = sortedPlayers.length > 10;
  if (needsLandscape) { doc.addPage("a4", "landscape"); } else { doc.addPage("a4", "portrait"); }
  const pageW2 = doc.internal.pageSize.getWidth();
  cursorY = margin;
  drawPageHeader(doc, tournamentName, pageW2, clubName, clubLogoBase64);
  cursorY = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN_DARK);
  doc.text("Cross-Table", margin, cursorY);
  cursorY += 4;
  const { headers: ctHeaders, rows: ctRows } = buildCrossTableMatrix(sortedPlayers, rounds);
  const resultCellW = Math.max(6, Math.min(10, (pageW2 - margin * 2 - 10 - 40 - 10) / sortedPlayers.length));
  const nameCellW = Math.min(50, pageW2 - margin * 2 - 10 - resultCellW * sortedPlayers.length - 10);
  const ctColumnStyles: Record<number, object> = {
    0: { halign: "center" as const, cellWidth: 8 },
    1: { halign: "left" as const, cellWidth: nameCellW },
  };
  for (let i = 0; i < sortedPlayers.length; i++) {
    ctColumnStyles[i + 2] = { halign: "center" as const, cellWidth: resultCellW };
  }
  ctColumnStyles[sortedPlayers.length + 2] = { halign: "center" as const, cellWidth: 10, fontStyle: "bold" as const };
  autoTable(doc, {
    startY: cursorY,
    head: [ctHeaders],
    body: ctRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2, font: "helvetica", textColor: TEXT_DARK },
    headStyles: { fillColor: GREEN_DARK, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: ctColumnStyles,
    alternateRowStyles: { fillColor: GREY_LIGHT },
    didParseCell: (data) => {
      if (data.section === "body") {
        const colIdx = data.column.index;
        const rowIdx = data.row.index;
        if (colIdx >= 2 && colIdx < sortedPlayers.length + 2 && colIdx - 2 === rowIdx) {
          data.cell.styles.fillColor = GREY_DIAG;
          data.cell.styles.textColor = [160, 160, 160];
        }
        if (data.cell.raw === "1") { data.cell.styles.textColor = WIN_GREEN; data.cell.styles.fontStyle = "bold"; }
        else if (data.cell.raw === "0") { data.cell.styles.textColor = LOSS_RED; }
        else if (data.cell.raw === "½") { data.cell.styles.textColor = DRAW_BLUE; }
      }
    },
  });

  // Pages 3 & 4: Explanation pages
  addScoringSystemPage(doc, tournamentName, clubName, clubLogoBase64);
  addSwissPairingPage(doc, tournamentName, totalRounds ?? rounds.length, players.length, clubName, clubLogoBase64);

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages);
  }

  // Return as base64 string (no browser download)
  return doc.output("datauristring").split(",")[1];
}
