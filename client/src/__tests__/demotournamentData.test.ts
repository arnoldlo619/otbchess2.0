/**
 * Unit tests for the updated demo tournament data (18 real chess.com players)
 */
import { describe, it, expect } from "vitest";
import {
  DEMO_TOURNAMENT,
  getPlayerById,
  getStandings,
  getResultLabel,
  FLAG_EMOJI,
} from "../lib/tournamentData";

describe("DEMO_TOURNAMENT structure", () => {
  it("has exactly 18 players", () => {
    expect(DEMO_TOURNAMENT.players).toHaveLength(18);
  });
  it("has 5 rounds", () => {
    expect(DEMO_TOURNAMENT.rounds).toBe(5);
    expect(DEMO_TOURNAMENT.roundData).toHaveLength(5);
  });
  it("has currentRound set to 5", () => {
    expect(DEMO_TOURNAMENT.currentRound).toBe(5);
  });
  it("rounds 1-4 are completed", () => {
    for (let i = 0; i < 4; i++) {
      expect(DEMO_TOURNAMENT.roundData[i].status).toBe("completed");
    }
  });
  it("round 5 is in_progress", () => {
    expect(DEMO_TOURNAMENT.roundData[4].status).toBe("in_progress");
  });
  it("each completed round has 9 games", () => {
    for (let i = 0; i < 4; i++) {
      expect(DEMO_TOURNAMENT.roundData[i].games).toHaveLength(9);
    }
  });
  it("round 5 has 9 games all with result *", () => {
    const r5 = DEMO_TOURNAMENT.roundData[4];
    expect(r5.games).toHaveLength(9);
    r5.games.forEach((g) => expect(g.result).toBe("*"));
  });
  it("all player IDs are unique", () => {
    const ids = DEMO_TOURNAMENT.players.map((p) => p.id);
    expect(new Set(ids).size).toBe(18);
  });
  it("all player usernames are unique", () => {
    const usernames = DEMO_TOURNAMENT.players.map((p) => p.username.toLowerCase());
    expect(new Set(usernames).size).toBe(18);
  });
});

describe("required chess.com players present", () => {
  const usernames = DEMO_TOURNAMENT.players.map((p) => p.username.toLowerCase());
  const required = [
    "magnuscarlsen","hikaru","nemsko","alexandrabotez","fabianocaruana",
    "firouzja2003","gmwso","gukeshdommaraju","annacramling","rpragchess",
    "lordillidan","ghandeevam2003","gothamchess","alex_banzea","gmcanty",
    "dinabelenkaya","pircuhset","arnoldadri",
  ];
  required.forEach((u) => {
    it(`includes ${u}`, () => {
      expect(usernames).toContain(u.toLowerCase());
    });
  });
});

describe("player data integrity", () => {
  it("all players have positive ELO", () => {
    DEMO_TOURNAMENT.players.forEach((p) => expect(p.elo).toBeGreaterThan(0));
  });
  it("all players have a 2-char country code", () => {
    DEMO_TOURNAMENT.players.forEach((p) => {
      expect(p.country).toBeTruthy();
      expect(p.country.length).toBe(2);
    });
  });
  it("wins + draws + losses = 4 for all players", () => {
    DEMO_TOURNAMENT.players.forEach((p) => {
      expect(p.wins + p.draws + p.losses).toBe(4);
    });
  });
  it("points = wins + draws * 0.5", () => {
    DEMO_TOURNAMENT.players.forEach((p) => {
      expect(p.points).toBe(p.wins + p.draws * 0.5);
    });
  });
  it("Magnus Carlsen leads standings with 4.0 points", () => {
    const standings = getStandings(DEMO_TOURNAMENT.players);
    expect(standings[0].username).toBe("Magnuscarlsen");
    expect(standings[0].points).toBe(4.0);
  });
});

describe("getPlayerById", () => {
  it("returns the correct player for p1", () => {
    const p = getPlayerById("p1");
    expect(p).toBeDefined();
    expect(p!.username).toBe("Magnuscarlsen");
  });
  it("returns undefined for unknown ID", () => {
    expect(getPlayerById("p99")).toBeUndefined();
  });
});

describe("getStandings", () => {
  it("sorts by points descending", () => {
    const standings = getStandings(DEMO_TOURNAMENT.players);
    for (let i = 0; i < standings.length - 1; i++) {
      expect(standings[i].points).toBeGreaterThanOrEqual(standings[i + 1].points);
    }
  });
  it("does not mutate the original array", () => {
    const original = [...DEMO_TOURNAMENT.players];
    getStandings(DEMO_TOURNAMENT.players);
    expect(DEMO_TOURNAMENT.players).toEqual(original);
  });
});

describe("getResultLabel", () => {
  it("returns In Progress for *", () => {
    expect(getResultLabel("*", "white").label).toBe("In Progress");
  });
  it("returns half for draw", () => {
    expect(getResultLabel("½-½", "white").label).toBe("½");
  });
  it("Win for white on 1-0", () => {
    expect(getResultLabel("1-0", "white").label).toBe("Win");
  });
  it("Loss for white on 0-1", () => {
    expect(getResultLabel("0-1", "white").label).toBe("Loss");
  });
  it("Win for black on 0-1", () => {
    expect(getResultLabel("0-1", "black").label).toBe("Win");
  });
  it("Loss for black on 1-0", () => {
    expect(getResultLabel("1-0", "black").label).toBe("Loss");
  });
});

describe("FLAG_EMOJI", () => {
  it("includes flags for all player countries", () => {
    DEMO_TOURNAMENT.players.forEach((p) => {
      expect(FLAG_EMOJI[p.country]).toBeDefined();
    });
  });
});

describe("game referential integrity", () => {
  it("all game player IDs reference valid players", () => {
    const validIds = new Set(DEMO_TOURNAMENT.players.map((p) => p.id));
    DEMO_TOURNAMENT.roundData.forEach((round) => {
      round.games.forEach((g) => {
        expect(validIds.has(g.whiteId)).toBe(true);
        expect(validIds.has(g.blackId)).toBe(true);
      });
    });
  });
  it("no player plays themselves", () => {
    DEMO_TOURNAMENT.roundData.forEach((round) => {
      round.games.forEach((g) => {
        expect(g.whiteId).not.toBe(g.blackId);
      });
    });
  });
  it("board numbers are positive integers", () => {
    DEMO_TOURNAMENT.roundData.forEach((round) => {
      round.games.forEach((g) => {
        expect(g.board).toBeGreaterThan(0);
      });
    });
  });
});
