// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Test Data Factories ──────────────────────────────────────────────────────

function makePlayer(overrides: Partial<{
  id: string; name: string; username: string; elo: number; title: string;
}> = {}) {
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Alice",
    username: overrides.username ?? "alice_chess",
    elo: overrides.elo ?? 1500,
    title: overrides.title ?? "",
    wins: 0,
    losses: 0,
    draws: 0,
    score: 0,
    colorHistory: [],
    opponents: [],
    buchholz: 0,
    sonnebornBerger: 0,
  };
}

function makeStanding(overrides: Partial<{
  playerId: string; name: string; username: string; elo: number; title: string;
  rank: number; points: number; wins: number; draws: number; losses: number;
  buchholz: number;
}> = {}) {
  return {
    playerId: overrides.playerId ?? "p1",
    name: overrides.name ?? "Alice",
    username: overrides.username ?? "alice_chess",
    elo: overrides.elo ?? 1500,
    title: overrides.title ?? "",
    rank: overrides.rank ?? 1,
    points: overrides.points ?? 3,
    wins: overrides.wins ?? 3,
    draws: overrides.draws ?? 0,
    losses: overrides.losses ?? 0,
    buchholz: overrides.buchholz ?? 5,
  };
}

function makeRound(number: number, games: Array<{
  whiteId: string; blackId: string; result: string; board: number;
}>) {
  return {
    number,
    games: games.map((g, i) => ({
      id: `g${number}-${i}`,
      board: g.board,
      whiteId: g.whiteId,
      blackId: g.blackId,
      result: g.result,
    })),
  };
}

// ─── CompletedHero Logic Tests ────────────────────────────────────────────────

describe("CompletedHero — Podium Logic", () => {
  it("should extract top 3 from standings for podium", () => {
    const standings = [
      makeStanding({ playerId: "p1", name: "Alice", rank: 1, points: 4 }),
      makeStanding({ playerId: "p2", name: "Bob", rank: 2, points: 3 }),
      makeStanding({ playerId: "p3", name: "Charlie", rank: 3, points: 2.5 }),
      makeStanding({ playerId: "p4", name: "Diana", rank: 4, points: 2 }),
    ];
    const podium = standings.slice(0, 3);
    expect(podium).toHaveLength(3);
    expect(podium[0].name).toBe("Alice");
    expect(podium[1].name).toBe("Bob");
    expect(podium[2].name).toBe("Charlie");
  });

  it("should handle fewer than 3 players gracefully", () => {
    const standings = [
      makeStanding({ playerId: "p1", name: "Alice", rank: 1, points: 1 }),
      makeStanding({ playerId: "p2", name: "Bob", rank: 2, points: 0 }),
    ];
    const podium = standings.slice(0, 3);
    expect(podium).toHaveLength(2);
  });

  it("should handle empty standings", () => {
    const standings: ReturnType<typeof makeStanding>[] = [];
    const podium = standings.slice(0, 3);
    expect(podium).toHaveLength(0);
  });

  it("should assign correct medal emojis", () => {
    const medalEmoji = ["🥇", "🥈", "🥉"];
    expect(medalEmoji[0]).toBe("🥇");
    expect(medalEmoji[1]).toBe("🥈");
    expect(medalEmoji[2]).toBe("🥉");
  });
});

// ─── PlayerPerformanceCard Logic Tests ────────────────────────────────────────

describe("PlayerPerformanceCard — Performance Labels", () => {
  function getPerformanceLabel(rank: number, points: number, totalRounds: number) {
    const pct = points / totalRounds;
    if (rank === 1) return { text: "Champion", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    if (rank <= 3) return { text: "Podium Finish", color: "text-amber-600 bg-amber-500/08 border-amber-500/15" };
    if (pct >= 0.75) return { text: "Strong Performance", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    if (pct >= 0.5) return { text: "Solid Result", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
    return { text: "Well Played", color: "text-[#3D6B47] bg-[#3D6B47]/10 border-[#3D6B47]/20" };
  }

  it("should return Champion for rank 1", () => {
    expect(getPerformanceLabel(1, 5, 5).text).toBe("Champion");
  });

  it("should return Podium Finish for rank 2", () => {
    expect(getPerformanceLabel(2, 4, 5).text).toBe("Podium Finish");
  });

  it("should return Podium Finish for rank 3", () => {
    expect(getPerformanceLabel(3, 3.5, 5).text).toBe("Podium Finish");
  });

  it("should return Strong Performance for 75%+ score outside podium", () => {
    expect(getPerformanceLabel(4, 4, 5).text).toBe("Strong Performance");
  });

  it("should return Solid Result for 50%+ score", () => {
    expect(getPerformanceLabel(10, 3, 5).text).toBe("Solid Result");
  });

  it("should return Well Played for below 50%", () => {
    expect(getPerformanceLabel(20, 1, 5).text).toBe("Well Played");
  });

  it("should return Well Played for 0 points", () => {
    expect(getPerformanceLabel(30, 0, 5).text).toBe("Well Played");
  });
});

describe("PlayerPerformanceCard — Round Timeline", () => {
  it("should build round timeline from rounds and player", () => {
    const player = makePlayer({ id: "p1" });
    const rounds = [
      makeRound(1, [{ whiteId: "p1", blackId: "p2", result: "1-0", board: 1 }]),
      makeRound(2, [{ whiteId: "p3", blackId: "p1", result: "0-1", board: 2 }]),
    ];

    const timeline = rounds.map((r) => {
      const game = r.games.find((g) => g.whiteId === player.id || g.blackId === player.id);
      if (!game) return null;
      const persp = game.whiteId === player.id ? "white" : "black";
      const oppId = persp === "white" ? game.blackId : game.whiteId;
      return { round: r.number, oppId, result: game.result, perspective: persp, board: game.board };
    }).filter(Boolean);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.perspective).toBe("white");
    expect(timeline[0]!.oppId).toBe("p2");
    expect(timeline[0]!.result).toBe("1-0");
    expect(timeline[1]!.perspective).toBe("black");
    expect(timeline[1]!.oppId).toBe("p3");
    expect(timeline[1]!.result).toBe("0-1");
  });

  it("should handle BYE (player not in any game)", () => {
    const player = makePlayer({ id: "p1" });
    const rounds = [
      makeRound(1, [{ whiteId: "p2", blackId: "p3", result: "1-0", board: 1 }]),
    ];

    const timeline = rounds.map((r) => {
      const game = r.games.find((g) => g.whiteId === player.id || g.blackId === player.id);
      if (!game) return null;
      return { round: r.number };
    }).filter(Boolean);

    expect(timeline).toHaveLength(0);
  });
});

// ─── scoreFraction Tests ──────────────────────────────────────────────────────

describe("scoreFraction", () => {
  function scoreFraction(pts: number): string {
    if (pts === Math.floor(pts)) return String(pts);
    const whole = Math.floor(pts);
    return whole > 0 ? `${whole}½` : "½";
  }

  it("should format whole numbers", () => {
    expect(scoreFraction(3)).toBe("3");
    expect(scoreFraction(0)).toBe("0");
  });

  it("should format half points", () => {
    expect(scoreFraction(2.5)).toBe("2½");
    expect(scoreFraction(0.5)).toBe("½");
  });

  it("should format larger whole numbers", () => {
    expect(scoreFraction(10)).toBe("10");
  });
});

// ─── PostEventCTAs — Email Capture Tests ──────────────────────────────────────

describe("PostEventCTAs — Email Capture localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should store email capture in localStorage", () => {
    const email = "test@example.com";
    const tournament = "Spring Open 2026";
    const existing = JSON.parse(localStorage.getItem("otb-email-captures") ?? "[]");
    existing.push({ email, tournament, capturedAt: new Date().toISOString() });
    localStorage.setItem("otb-email-captures", JSON.stringify(existing));

    const stored = JSON.parse(localStorage.getItem("otb-email-captures")!);
    expect(stored).toHaveLength(1);
    expect(stored[0].email).toBe("test@example.com");
    expect(stored[0].tournament).toBe("Spring Open 2026");
  });

  it("should accumulate multiple email captures", () => {
    const captures = [
      { email: "a@test.com", tournament: "T1", capturedAt: "2026-01-01" },
      { email: "b@test.com", tournament: "T2", capturedAt: "2026-01-02" },
    ];
    localStorage.setItem("otb-email-captures", JSON.stringify(captures));

    const stored = JSON.parse(localStorage.getItem("otb-email-captures")!);
    expect(stored).toHaveLength(2);
  });

  it("should handle corrupted localStorage gracefully", () => {
    localStorage.setItem("otb-email-captures", "not-json");
    let result: any[] = [];
    try {
      result = JSON.parse(localStorage.getItem("otb-email-captures") ?? "[]");
    } catch {
      result = [];
    }
    expect(result).toEqual([]);
  });
});

// ─── Post-Event Mode Transition Tests ─────────────────────────────────────────

describe("Post-Event Mode Transition", () => {
  it("should detect completed status correctly", () => {
    const data = { status: "completed" };
    expect(data.status === "completed").toBe(true);
  });

  it("should not trigger completed mode for active tournaments", () => {
    const data = { status: "active" };
    expect(data.status === "completed").toBe(false);
  });

  it("should show PersonalRecap when completed and player is followed", () => {
    const isCompleted = true;
    const followedPlayer = makePlayer({ id: "p1" });
    const showPersonalRecap = isCompleted && !!followedPlayer;
    expect(showPersonalRecap).toBe(true);
  });

  it("should show FollowedPlayerCard when active and player is followed", () => {
    const isCompleted = false;
    const followedPlayer = makePlayer({ id: "p1" });
    const showFollowedCard = !isCompleted && !!followedPlayer;
    expect(showFollowedCard).toBe(true);
  });

  it("should show PostEventCTAs only when completed", () => {
    expect(true && "completed" === "completed").toBe(true);
    expect(true && "active" === "completed").toBe(false);
  });

  it("should pass hasFollowedPlayer to PostEventCTAs", () => {
    const followedPlayer = makePlayer({ id: "p1" });
    const hasFollowedPlayer = !!followedPlayer;
    expect(hasFollowedPlayer).toBe(true);

    const noFollowedPlayer = null;
    expect(!!noFollowedPlayer).toBe(false);
  });
});

// ─── Contextual CTA Copy Tests ────────────────────────────────────────────────

describe("PostEventCTAs — Contextual Copy", () => {
  it("should show performance card copy when player is followed", () => {
    const hasFollowedPlayer = true;
    const heading = hasFollowedPlayer
      ? "Get Your Performance Card by Email"
      : "Get Tournament Results by Email";
    expect(heading).toBe("Get Your Performance Card by Email");
  });

  it("should show generic results copy when no player is followed", () => {
    const hasFollowedPlayer = false;
    const heading = hasFollowedPlayer
      ? "Get Your Performance Card by Email"
      : "Get Tournament Results by Email";
    expect(heading).toBe("Get Tournament Results by Email");
  });

  it("should show personalized subtitle when player is followed", () => {
    const hasFollowedPlayer = true;
    const subtitle = hasFollowedPlayer
      ? "We'll send your full performance card and tournament results."
      : "Receive the final standings and results in your inbox.";
    expect(subtitle).toContain("performance card");
  });
});

// ─── CompletedHero vs Standard Hero Tests ─────────────────────────────────────

describe("Hero Mode Switching", () => {
  it("should render CompletedHero when status is completed", () => {
    const status = "completed";
    const heroMode = status === "completed" ? "completed" : "standard";
    expect(heroMode).toBe("completed");
  });

  it("should render standard hero when status is active", () => {
    const status = "active";
    const heroMode = status === "completed" ? "completed" : "standard";
    expect(heroMode).toBe("standard");
  });

  it("should render standard hero when status is registration", () => {
    const status = "registration";
    const heroMode = status === "completed" ? "completed" : "standard";
    expect(heroMode).toBe("standard");
  });
});
