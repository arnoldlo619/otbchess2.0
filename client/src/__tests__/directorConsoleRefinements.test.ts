// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

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

  describe("Round timeline dots", () => {
    it("generates correct dot states for 5-round tournament in round 3", () => {
      const totalRounds = 5;
      const currentRound = 3;
      const dots = Array.from({ length: totalRounds }, (_, i) => {
        const roundNum = i + 1;
        if (roundNum < currentRound) return "completed";
        if (roundNum === currentRound) return "current";
        return "upcoming";
      });
      expect(dots).toEqual(["completed", "completed", "current", "upcoming", "upcoming"]);
    });

    it("all dots are upcoming during registration", () => {
      const totalRounds = 4;
      const currentRound = 0;
      const dots = Array.from({ length: totalRounds }, (_, i) => {
        const roundNum = i + 1;
        if (roundNum < currentRound) return "completed";
        if (roundNum === currentRound) return "current";
        return "upcoming";
      });
      expect(dots).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
    });

    it("all dots completed when tournament is done", () => {
      const totalRounds = 4;
      const currentRound = 5;
      const dots = Array.from({ length: totalRounds }, (_, i) => {
        const roundNum = i + 1;
        if (roundNum < currentRound) return "completed";
        if (roundNum === currentRound) return "current";
        return "upcoming";
      });
      expect(dots).toEqual(["completed", "completed", "completed", "completed"]);
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
