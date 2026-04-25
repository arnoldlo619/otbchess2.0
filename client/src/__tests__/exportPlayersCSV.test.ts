/**
 * exportPlayersCSV — unit tests
 *
 * Verifies that the Director players tab CSV export:
 * 1. Includes all required columns (name, username, platform, elo, rapid_elo,
 *    blitz_elo, title, country, checked_in, payment_status, wins, draws, losses, points)
 * 2. Correctly encodes check-in status from the checkedInIds Set
 * 3. Correctly encodes payment_status from the Player object
 * 4. Handles commas and quotes in player names (RFC 4180 escaping)
 * 5. Falls back gracefully for optional fields (rapidElo, blitzElo, title, country)
 * 6. Generates a correct filename slug from the tournament name
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../");

// ── Re-implement the pure logic of exportPlayersCSV for unit testing ──────────
// We extract the CSV-building logic so it can be tested without a DOM.
type PaymentStatus = "unpaid" | "cash" | "card";
type Platform = "chesscom" | "lichess";

interface TestPlayer {
  id: string;
  name: string;
  username: string;
  platform?: Platform;
  elo: number;
  rapidElo?: number;
  blitzElo?: number;
  title?: string;
  country?: string;
  paymentStatus?: PaymentStatus;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

function buildCSV(players: TestPlayer[], checkedInIds: Set<string> = new Set()): string {
  const headers = [
    "name", "username", "platform", "elo", "rapid_elo", "blitz_elo",
    "title", "country", "checked_in", "payment_status",
    "wins", "draws", "losses", "points",
  ];
  const escape = (v: string | number | boolean | undefined): string => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = players.map((p) => [
    escape(p.name),
    escape(p.username),
    escape(p.platform ?? "chesscom"),
    escape(p.elo),
    escape(p.rapidElo ?? ""),
    escape(p.blitzElo ?? ""),
    escape(p.title ?? ""),
    escape(p.country ?? ""),
    escape(checkedInIds.has(p.id) ? "yes" : "no"),
    escape(p.paymentStatus ?? "unpaid"),
    escape(p.wins),
    escape(p.draws),
    escape(p.losses),
    escape(p.points),
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}

function buildFilename(tournamentName: string): string {
  const slug = tournamentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-players-${date}.csv`;
}

// ── Sample players ────────────────────────────────────────────────────────────
const PLAYERS: TestPlayer[] = [
  {
    id: "p1",
    name: "Magnus Carlsen",
    username: "magnuscarlsen",
    platform: "chesscom",
    elo: 2882,
    rapidElo: 2850,
    blitzElo: 2830,
    title: "GM",
    country: "NO",
    paymentStatus: "card",
    wins: 4, draws: 0, losses: 0, points: 4,
  },
  {
    id: "p2",
    name: "Hikaru Nakamura",
    username: "hikaru",
    platform: "chesscom",
    elo: 2794,
    rapidElo: 2780,
    blitzElo: 2760,
    title: "GM",
    country: "US",
    paymentStatus: "cash",
    wins: 3, draws: 1, losses: 0, points: 3.5,
  },
  {
    id: "p3",
    name: "Player, With Comma",
    username: "commauser",
    platform: "lichess",
    elo: 1800,
    paymentStatus: "unpaid",
    wins: 1, draws: 0, losses: 3, points: 1,
  },
  {
    id: "p4",
    name: 'Player "Quoted" Name',
    username: "quoteduser",
    elo: 1600,
    wins: 0, draws: 2, losses: 2, points: 1,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("exportPlayersCSV — header row", () => {
  it("includes all 14 required columns in the correct order", () => {
    const csv = buildCSV(PLAYERS);
    const header = csv.split("\n")[0];
    expect(header).toBe(
      "name,username,platform,elo,rapid_elo,blitz_elo,title,country,checked_in,payment_status,wins,draws,losses,points"
    );
  });

  it("produces exactly players.length + 1 lines (header + one per player)", () => {
    const csv = buildCSV(PLAYERS);
    expect(csv.split("\n").length).toBe(PLAYERS.length + 1);
  });
});

describe("exportPlayersCSV — check-in status", () => {
  it("marks checked-in players as 'yes'", () => {
    const csv = buildCSV(PLAYERS, new Set(["p1", "p2"]));
    const lines = csv.split("\n");
    // p1 (Magnus) → checked_in = yes
    expect(lines[1]).toContain(",yes,");
    // p2 (Hikaru) → checked_in = yes
    expect(lines[2]).toContain(",yes,");
  });

  it("marks players not in checkedInIds as 'no'", () => {
    const csv = buildCSV(PLAYERS, new Set(["p1"]));
    const lines = csv.split("\n");
    // p2 not checked in
    expect(lines[2]).toContain(",no,");
    // p3 not checked in
    expect(lines[3]).toContain(",no,");
  });

  it("marks all players as 'no' when checkedInIds is empty", () => {
    const csv = buildCSV(PLAYERS, new Set());
    const dataLines = csv.split("\n").slice(1);
    dataLines.forEach((line) => expect(line).toContain(",no,"));
  });

  it("marks all players as 'no' when checkedInIds is omitted", () => {
    const csv = buildCSV(PLAYERS);
    const dataLines = csv.split("\n").slice(1);
    dataLines.forEach((line) => expect(line).toContain(",no,"));
  });
});

describe("exportPlayersCSV — payment status", () => {
  it("exports 'card' for card-paying players", () => {
    const csv = buildCSV(PLAYERS);
    const lines = csv.split("\n");
    // p1 paymentStatus = "card"
    expect(lines[1]).toContain(",card,");
  });

  it("exports 'cash' for cash-paying players", () => {
    const csv = buildCSV(PLAYERS);
    const lines = csv.split("\n");
    // p2 paymentStatus = "cash"
    expect(lines[2]).toContain(",cash,");
  });

  it("exports 'unpaid' for unpaid players", () => {
    const csv = buildCSV(PLAYERS);
    const lines = csv.split("\n");
    // p3 paymentStatus = "unpaid"
    expect(lines[3]).toContain(",unpaid,");
  });

  it("defaults to 'unpaid' when paymentStatus is undefined", () => {
    const csv = buildCSV(PLAYERS);
    const lines = csv.split("\n");
    // p4 has no paymentStatus
    expect(lines[4]).toContain(",unpaid,");
  });
});

describe("exportPlayersCSV — platform and ELO columns", () => {
  it("exports platform correctly for chess.com players", () => {
    const csv = buildCSV(PLAYERS);
    expect(csv.split("\n")[1]).toContain("chesscom");
  });

  it("exports platform correctly for Lichess players", () => {
    const csv = buildCSV(PLAYERS);
    expect(csv.split("\n")[3]).toContain("lichess");
  });

  it("defaults platform to 'chesscom' when undefined", () => {
    const csv = buildCSV(PLAYERS);
    // p4 has no platform
    expect(csv.split("\n")[4]).toContain("chesscom");
  });

  it("exports rapidElo and blitzElo when present", () => {
    const csv = buildCSV(PLAYERS);
    const p1Line = csv.split("\n")[1];
    expect(p1Line).toContain("2850"); // rapidElo
    expect(p1Line).toContain("2830"); // blitzElo
  });

  it("exports empty string for rapidElo/blitzElo when absent", () => {
    const csv = buildCSV(PLAYERS);
    const p3Line = csv.split("\n")[3];
    // p3 has no rapidElo/blitzElo — should have two consecutive commas
    expect(p3Line).toMatch(/,1800,,/); // elo=1800, rapid_elo=empty, blitz_elo=empty
  });
});

describe("exportPlayersCSV — RFC 4180 CSV escaping", () => {
  it("wraps values containing commas in double quotes", () => {
    const csv = buildCSV(PLAYERS);
    const p3Line = csv.split("\n")[3];
    expect(p3Line).toContain('"Player, With Comma"');
  });

  it("escapes double quotes inside quoted fields", () => {
    const csv = buildCSV(PLAYERS);
    const p4Line = csv.split("\n")[4];
    expect(p4Line).toContain('"Player ""Quoted"" Name"');
  });
});

describe("exportPlayersCSV — filename generation", () => {
  it("slugifies tournament name and appends today's date", () => {
    const filename = buildFilename("OTB!! Open 2026");
    const today = new Date().toISOString().slice(0, 10);
    expect(filename).toBe(`otb-open-2026-players-${today}.csv`);
  });

  it("strips leading and trailing hyphens from slug", () => {
    const filename = buildFilename("  --My Tournament--  ");
    const today = new Date().toISOString().slice(0, 10);
    expect(filename).toBe(`my-tournament-players-${today}.csv`);
  });
});

describe("exportPlayersCSV — source code verification", () => {
  it("Director.tsx exportPlayersCSV accepts checkedInIds parameter", () => {
    const src = readFileSync(resolve(ROOT, "client/src/pages/Director.tsx"), "utf8");
    expect(src).toContain("checkedInIds: Set<string>");
  });

  it("Director.tsx exportPlayersCSV header includes checked_in and payment_status", () => {
    const src = readFileSync(resolve(ROOT, "client/src/pages/Director.tsx"), "utf8");
    expect(src).toContain('"checked_in"');
    expect(src).toContain('"payment_status"');
  });

  it("Director.tsx exportPlayersCSV header includes rapid_elo and blitz_elo", () => {
    const src = readFileSync(resolve(ROOT, "client/src/pages/Director.tsx"), "utf8");
    expect(src).toContain('"rapid_elo"');
    expect(src).toContain('"blitz_elo"');
  });

  it("Director.tsx button passes checkedInIds to exportPlayersCSV", () => {
    const src = readFileSync(resolve(ROOT, "client/src/pages/Director.tsx"), "utf8");
    expect(src).toContain("exportPlayersCSV(state.players, state.tournamentName, checkedInIds)");
  });

  it("Director.tsx button label is 'Download CSV'", () => {
    const src = readFileSync(resolve(ROOT, "client/src/pages/Director.tsx"), "utf8");
    expect(src).toContain("Download CSV");
  });
});
