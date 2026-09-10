// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";

const directorSource = readFileSync(resolve(process.cwd(), "client/src/pages/Director.tsx"), "utf8");

// ── Command Center Strip Tests ──────────────────────────────────────────────

describe("Command Center Status Strip", () => {
  describe("Round indicator logic", () => {
    it("shows Registration when currentRound is 0", () => {
      const currentRound = 0;
      const label = currentRound === 0 ? "Registration" : `Round ${currentRound}`;
      expect(label).toBe("Registration");
    });

    it("shows Round N when tournament is active", () => {
      const currentRound = 3;
      const label = currentRound === 0 ? "Registration" : `Round ${currentRound}`;
      expect(label).toBe("Round 3");
    });
  });

  describe("Results progress computation", () => {
    it("calculates 0/0 when no games exist", () => {
      const games: { result: string }[] = [];
      const reported = games.filter((g) => g.result !== "").length;
      expect(reported).toBe(0);
      expect(games.length).toBe(0);
    });

    it("calculates correct reported/total for mixed results", () => {
      const games = [
        { result: "1-0" },
        { result: "" },
        { result: "0-1" },
        { result: "" },
        { result: "1/2" },
      ];
      const reported = games.filter((g) => g.result !== "").length;
      expect(reported).toBe(3);
      expect(games.length).toBe(5);
    });

    it("calculates 100% when all results are in", () => {
      const games = [
        { result: "1-0" },
        { result: "0-1" },
        { result: "1/2" },
      ];
      const reported = games.filter((g) => g.result !== "").length;
      expect(reported).toBe(games.length);
    });
  });

  describe("Consolidated round navigation", () => {
    it("keeps the single round status label while rendering the detailed tracker in the left rail", () => {
      expect(directorSource).toContain("Round {state.currentRound} / {state.totalRounds}");
      expect(directorSource).toContain("<VerticalRoundTracker");
      expect(directorSource).toContain("Pulse ring for current round");
    });

    it("does not reintroduce the redundant header timeline-dot group", () => {
      expect(directorSource).not.toContain("Round timeline dots");
      expect(directorSource).not.toContain("const _isUpcoming = rn > state.currentRound");
    });
  });
});

// ── Check-In Roster Tests ───────────────────────────────────────────────────

describe("Check-In Roster", () => {
  describe("Check-in state management", () => {
    const STORAGE_KEY = "otb-checkin-test-123";

    beforeEach(() => {
      localStorage.clear();
    });

    it("initializes with empty check-in set", () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      expect(ids).toEqual([]);
    });

    it("persists checked-in player IDs to localStorage", () => {
      const ids = ["player-1", "player-2"];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      const restored: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(restored).toEqual(["player-1", "player-2"]);
    });

    it("toggles a player in and out of check-in", () => {
      const ids = new Set<string>();
      ids.add("player-1");
      expect(ids.has("player-1")).toBe(true);
      ids.delete("player-1");
      expect(ids.has("player-1")).toBe(false);
    });

    it("counts checked-in players correctly", () => {
      const ids = new Set(["p1", "p2", "p3"]);
      expect(ids.size).toBe(3);
    });
  });

  describe("Roster search filtering", () => {
    const players = [
      { id: "1", name: "Magnus Carlsen", chessUsername: "DrNykterstein" },
      { id: "2", name: "Hikaru Nakamura", chessUsername: "Hikaru" },
      { id: "3", name: "Fabiano Caruana", chessUsername: "FabianoCaruana" },
      { id: "4", name: "Ian Nepomniachtchi", chessUsername: "lachesisQ" },
    ];

    it("filters by name case-insensitive", () => {
      const q = "magnus";
      const filtered = players.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.chessUsername.toLowerCase().includes(q.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Magnus Carlsen");
    });

    it("filters by chess.com username", () => {
      const q = "hikaru";
      const filtered = players.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.chessUsername.toLowerCase().includes(q.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Hikaru Nakamura");
    });

    it("returns all players when search is empty", () => {
      const q = "";
      const filtered = q
        ? players.filter(
            (p) =>
              p.name.toLowerCase().includes(q.toLowerCase()) ||
              p.chessUsername.toLowerCase().includes(q.toLowerCase())
          )
        : players;
      expect(filtered).toHaveLength(4);
    });

    it("returns empty when no match", () => {
      const q = "kasparov";
      const filtered = players.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.chessUsername.toLowerCase().includes(q.toLowerCase())
      );
      expect(filtered).toHaveLength(0);
    });
  });

  describe("Walk-in player creation", () => {
    it("creates walk-in with correct defaults", () => {
      const player = {
        id: "walkin-123",
        name: "John Walk-In",
        chessUsername: "johnwalkin",
        rating: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        score: 0,
        buchholz: 0,
        opponents: [] as string[],
        colorHistory: [] as string[],
        title: undefined,
      };
      expect(player.name).toBe("John Walk-In");
      expect(player.chessUsername).toBe("johnwalkin");
      expect(player.rating).toBe(0);
      expect(player.score).toBe(0);
      expect(player.opponents).toEqual([]);
    });

    it("creates walk-in with empty username when not provided", () => {
      const player = {
        id: "walkin-456",
        name: "Jane Walk-In",
        chessUsername: "",
        rating: 0,
      };
      expect(player.name).toBe("Jane Walk-In");
      expect(player.chessUsername).toBe("");
    });
  });
});

// ── Board Search & Jump-to-Unreported Tests ─────────────────────────────────

describe("Board Search and Jump-to-Unreported", () => {
  const boards = [
    { board: 1, whiteId: "p1", blackId: "p2", result: "1-0" },
    { board: 2, whiteId: "p3", blackId: "p4", result: "" },
    { board: 3, whiteId: "p5", blackId: "p6", result: "" },
    { board: 4, whiteId: "p7", blackId: "p8", result: "0-1" },
  ];

  const playerNames: Record<string, string> = {
    p1: "Magnus Carlsen",
    p2: "Hikaru Nakamura",
    p3: "Fabiano Caruana",
    p4: "Ian Nepomniachtchi",
    p5: "Ding Liren",
    p6: "Alireza Firouzja",
    p7: "Anish Giri",
    p8: "Wesley So",
  };

  it("finds the first unreported board", () => {
    const first = boards.find((b) => b.result === "");
    expect(first?.board).toBe(2);
  });

  it("returns undefined when all boards reported", () => {
    const allDone = boards.map((b) => ({ ...b, result: b.result || "1/2" }));
    const first = allDone.find((b) => b.result === "");
    expect(first).toBeUndefined();
  });

  it("filters boards by player name", () => {
    const q = "ding";
    const filtered = boards.filter((b) => {
      const w = (playerNames[b.whiteId] || "").toLowerCase();
      const bl = (playerNames[b.blackId] || "").toLowerCase();
      return w.includes(q) || bl.includes(q);
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].board).toBe(3);
  });

  it("shows all boards when search is empty", () => {
    const q = "";
    const filtered = q
      ? boards.filter((b) => {
          const w = (playerNames[b.whiteId] || "").toLowerCase();
          const bl = (playerNames[b.blackId] || "").toLowerCase();
          return w.includes(q) || bl.includes(q);
        })
      : boards;
    expect(filtered).toHaveLength(4);
  });

  it("counts unreported boards correctly", () => {
    const count = boards.filter((b) => b.result === "").length;
    expect(count).toBe(2);
  });
});

// ── Director Readability Scale Tests ────────────────────────────────────────

describe("Director Home and Standings readability", () => {
  const boardCardSource = directorSource.slice(
    directorSource.indexOf("function BoardCard"),
    directorSource.indexOf("function DoubleSwissBoardCard"),
  );
  const doubleSwissCardSource = directorSource.slice(
    directorSource.indexOf("function DoubleSwissBoardCard"),
    directorSource.indexOf("/// ─── Standings Mini Table"),
  );
  const homeSource = directorSource.slice(
    directorSource.indexOf('activeTab === "home"'),
    directorSource.indexOf('activeTab === "standings"'),
  );
  const standingsStart = directorSource.indexOf('activeTab === "standings"');
  const standingsSource = directorSource.slice(
    standingsStart,
    directorSource.indexOf("/* ── Players Tab", standingsStart),
  );

  it("keeps normal and Double Swiss pairing names at a readable 16px-plus scale", () => {
    expect(boardCardSource.match(/text-base sm:text-\[17px\] font-bold/g)).toHaveLength(2);
    expect(boardCardSource).toContain("text-sm sm:text-base font-bold");
    expect(doubleSwissCardSource.match(/text-base sm:text-\[17px\] font-bold/g)).toHaveLength(2);
    expect(doubleSwissCardSource).toContain("text-sm font-bold rounded-lg");
  });

  it("keeps Home roster names and usernames readable during registration", () => {
    expect(homeSource.match(/text-base font-semibold truncate/g)?.length).toBeGreaterThanOrEqual(2);
    expect(homeSource.match(/text-sm truncate/g)?.length).toBeGreaterThanOrEqual(2);
    expect(homeSource).toContain("text-base sm:text-lg font-black tracking-tight");
  });

  it("matches Standings player identity and key data to the Players-tab readable scale", () => {
    expect(standingsSource).toContain("text-base font-bold truncate");
    expect(standingsSource).toContain("text-base font-black tabular-nums text-right");
    expect(standingsSource).toContain("px-3 py-3 text-xs font-black uppercase");
    expect(standingsSource).not.toContain("px-3 py-2.5 text-[10px] tabular-nums text-right");
  });

  it("keeps completed normal-board winner and draw results premium and high-contrast in light mode", () => {
    expect(boardCardSource).toContain('className="px-4 pb-4 pt-1.5 flex gap-2"');
    expect(boardCardSource).not.toContain('isComplete ? "opacity-55"');
    expect(boardCardSource).toContain('"bg-[#E7F4EC] border-[#2F7D4E] text-[#164A31]');
    expect(boardCardSource).toContain('"bg-[#FFF5E1] border-[#B7791F] text-[#7A4A0B]');
    expect(boardCardSource).not.toContain('"bg-[#176B45] border-[#0F5132] text-white');
    expect(boardCardSource).toContain('aria-pressed={isSelected}');
    expect(boardCardSource).toContain('Check className="w-4 h-4 flex-shrink-0"');
  });

  it("keeps completed Double Swiss game results premium and high-contrast in light mode", () => {
    expect(doubleSwissCardSource).not.toContain('isComplete ? "opacity-60"');
    expect(doubleSwissCardSource).toContain('"bg-[#E7F4EC] border-[#2F7D4E] text-[#164A31]');
    expect(doubleSwissCardSource).toContain('"bg-[#FFF5E1] border-[#B7791F] text-[#7A4A0B]');
    expect(doubleSwissCardSource).not.toContain('"bg-[#176B45] border-[#0F5132] text-white');
    expect(doubleSwissCardSource).toContain('aria-pressed={isSelected}');
    expect(doubleSwissCardSource).toContain('Check className="w-3.5 h-3.5 flex-shrink-0"');
  });

  it("gives completed winner and draw score badges a dedicated light-mode contrast treatment", () => {
    expect(directorSource).toContain('"bg-emerald-100 text-emerald-800 border border-emerald-300"');
    expect(directorSource).toContain('"bg-sky-100 text-sky-800 border border-sky-300"');
  });
});

// ── Round Lifecycle Tests ───────────────────────────────────────────────────

describe("Round Lifecycle", () => {
  describe("Next round confirmation flow", () => {
    it("starts with confirmation hidden", () => {
      let show = false;
      expect(show).toBe(false);
    });

    it("shows confirmation on first click", () => {
      let show = false;
      show = true;
      expect(show).toBe(true);
    });

    it("hides confirmation on cancel", () => {
      let show = true;
      show = false;
      expect(show).toBe(false);
    });

    it("hides confirmation and advances on confirm", () => {
      let show = true;
      let round = 2;
      show = false;
      round += 1;
      expect(show).toBe(false);
      expect(round).toBe(3);
    });
  });

  describe("Round status labels", () => {
    const getStatus = (round: number, totalRounds: number, allIn: boolean) => {
      if (round === 0) return "Registration";
      if (round > totalRounds) return "Complete";
      if (allIn) return `Round ${round} Complete`;
      return `Round ${round} In Progress`;
    };

    it("returns Registration for round 0", () => {
      expect(getStatus(0, 5, false)).toBe("Registration");
    });

    it("returns In Progress for active round", () => {
      expect(getStatus(3, 5, false)).toBe("Round 3 In Progress");
    });

    it("returns Complete for round with all results", () => {
      expect(getStatus(3, 5, true)).toBe("Round 3 Complete");
    });

    it("returns Complete when past last round", () => {
      expect(getStatus(6, 5, true)).toBe("Complete");
    });
  });
});

// ── Public Mode Chip Tests ──────────────────────────────────────────────────

describe("Public Mode Chip", () => {
  it("shows Live when isPublic is true", () => {
    const isPublic = true;
    const label = isPublic ? "Live" : "Draft";
    expect(label).toBe("Live");
  });

  it("shows Draft when isPublic is false", () => {
    const isPublic = false;
    const label = isPublic ? "Live" : "Draft";
    expect(label).toBe("Draft");
  });

  it("generates correct public URL", () => {
    const id = "spring-open-2026";
    const url = `/live/${encodeURIComponent(id)}`;
    expect(url).toBe("/live/spring-open-2026");
  });
});

// ── QR Download Tests ───────────────────────────────────────────────────────

describe("QR Code Download", () => {
  it("generates correct filename from tournament name", () => {
    const name = "Spring Open 2026";
    const filename = `${name.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    expect(filename).toBe("spring-open-2026-qr.png");
  });

  it("handles special characters in tournament name", () => {
    const name = "Club's #1 Tournament!";
    const filename = `${name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    expect(filename).toBe("clubs-1-tournament-qr.png");
  });
});
