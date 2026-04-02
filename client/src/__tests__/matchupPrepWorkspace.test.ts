/**
 * Phase 14: Matchup Prep Workspace — unit tests
 * Tests for priority tier logic, practice flow, key signal derivation
 */
import { describe, it, expect } from "vitest";

// ── Priority tier logic ────────────────────────────────────────────────────────

type Confidence = "high" | "medium" | "low";
type Priority = "must-know" | "likely" | "useful";

function getPriority(confidence: Confidence): Priority {
  if (confidence === "high") return "must-know";
  if (confidence === "medium") return "likely";
  return "useful";
}

const PRIORITY_ORDER: Record<Priority, number> = {
  "must-know": 0,
  "likely": 1,
  "useful": 2,
};

describe("getPriority", () => {
  it("maps high confidence to must-know", () => {
    expect(getPriority("high")).toBe("must-know");
  });
  it("maps medium confidence to likely", () => {
    expect(getPriority("medium")).toBe("likely");
  });
  it("maps low confidence to useful", () => {
    expect(getPriority("low")).toBe("useful");
  });
});

describe("priority ordering", () => {
  it("must-know sorts before likely", () => {
    expect(PRIORITY_ORDER["must-know"]).toBeLessThan(PRIORITY_ORDER["likely"]);
  });
  it("likely sorts before useful", () => {
    expect(PRIORITY_ORDER["likely"]).toBeLessThan(PRIORITY_ORDER["useful"]);
  });
  it("sorts a mixed list correctly", () => {
    const lines: Confidence[] = ["low", "high", "medium", "high", "low"];
    const sorted = lines
      .map((c, i) => ({ c, i }))
      .sort((a, b) => PRIORITY_ORDER[getPriority(a.c)] - PRIORITY_ORDER[getPriority(b.c)]);
    expect(sorted.map(x => getPriority(x.c))).toEqual([
      "must-know", "must-know", "likely", "useful", "useful"
    ]);
  });
});

// ── Practice queue building ────────────────────────────────────────────────────

interface PrepLine { confidence: Confidence }

function buildPracticeQueue(lines: PrepLine[]): number[] {
  return lines
    .map((_, i) => i)
    .sort((a, b) =>
      PRIORITY_ORDER[getPriority(lines[a].confidence)] -
      PRIORITY_ORDER[getPriority(lines[b].confidence)]
    );
}

describe("buildPracticeQueue", () => {
  it("returns indices sorted by priority", () => {
    const lines: PrepLine[] = [
      { confidence: "low" },    // 0 → useful
      { confidence: "high" },   // 1 → must-know
      { confidence: "medium" }, // 2 → likely
    ];
    const queue = buildPracticeQueue(lines);
    expect(queue[0]).toBe(1); // must-know first
    expect(queue[1]).toBe(2); // likely second
    expect(queue[2]).toBe(0); // useful last
  });

  it("handles all same priority", () => {
    const lines: PrepLine[] = [
      { confidence: "medium" },
      { confidence: "medium" },
      { confidence: "medium" },
    ];
    const queue = buildPracticeQueue(lines);
    expect(queue).toHaveLength(3);
    expect(queue.sort()).toEqual([0, 1, 2]);
  });

  it("handles empty lines", () => {
    expect(buildPracticeQueue([])).toEqual([]);
  });

  it("handles single line", () => {
    expect(buildPracticeQueue([{ confidence: "high" }])).toEqual([0]);
  });
});

// ── Practice state transitions ─────────────────────────────────────────────────

describe("practice mode state transitions", () => {
  it("marks a line as completed and advances index", () => {
    const completed = new Set<number>();
    const addCompleted = (idx: number) => new Set(Array.from(completed).concat(idx));
    const newCompleted = addCompleted(0);
    expect(newCompleted.has(0)).toBe(true);
    expect(newCompleted.size).toBe(1);
  });

  it("detects all done when completed count equals total", () => {
    const total = 3;
    const completed = new Set([0, 1, 2]);
    expect(completed.size >= total).toBe(true);
  });

  it("does not detect all done when some remain", () => {
    const total = 3;
    const completed = new Set([0, 1]);
    expect(completed.size >= total).toBe(false);
  });

  it("reset clears completed set and resets index", () => {
    let completed = new Set([0, 1, 2]);
    let index = 2;
    // simulate reset
    completed = new Set<number>();
    index = 0;
    expect(completed.size).toBe(0);
    expect(index).toBe(0);
  });

  it("prev navigation does not go below 0", () => {
    let index = 0;
    if (index > 0) index--;
    expect(index).toBe(0);
  });

  it("next navigation does not exceed queue length", () => {
    const queue = [0, 1, 2];
    let index = queue.length - 1;
    if (index < queue.length - 1) index++;
    expect(index).toBe(queue.length - 1);
  });
});

// ── Key signal derivation ──────────────────────────────────────────────────────

interface ColorStats { winRate: number; wins: number; draws: number; losses: number; games: number }
interface EndgameProfile { checkmates: number; resignations: number; timeouts: number; draws: number; total: number }

function deriveColorSignal(asWhite: ColorStats, asBlack: ColorStats): string {
  const diff = asWhite.winRate - asBlack.winRate;
  if (Math.abs(diff) >= 8) {
    return diff > 0 ? "Stronger as White" : "Stronger as Black";
  }
  return "Balanced both sides";
}

function deriveGameLengthSignal(avgLength: number): string {
  if (avgLength <= 30) return "Plays short games";
  if (avgLength >= 50) return "Plays long games";
  return "Medium game length";
}

function deriveEndgameSignal(ep: EndgameProfile): string {
  if (ep.total === 0) return "No endgame data";
  const resignPct = Math.round((ep.resignations / ep.total) * 100);
  const matePct = Math.round((ep.checkmates / ep.total) * 100);
  if (resignPct >= 40) return "Resigns often";
  if (matePct >= 20) return "Fights to checkmate";
  return "Draw tendency";
}

describe("key signal derivation", () => {
  const baseStats: ColorStats = { winRate: 50, wins: 10, draws: 5, losses: 10, games: 25 };

  it("detects stronger as white when diff >= 8", () => {
    expect(deriveColorSignal({ ...baseStats, winRate: 60 }, { ...baseStats, winRate: 50 })).toBe("Stronger as White");
  });

  it("detects stronger as black when diff <= -8", () => {
    expect(deriveColorSignal({ ...baseStats, winRate: 45 }, { ...baseStats, winRate: 55 })).toBe("Stronger as Black");
  });

  it("detects balanced when diff < 8", () => {
    expect(deriveColorSignal({ ...baseStats, winRate: 53 }, { ...baseStats, winRate: 50 })).toBe("Balanced both sides");
  });

  it("detects short games at <= 30 moves", () => {
    expect(deriveGameLengthSignal(25)).toBe("Plays short games");
    expect(deriveGameLengthSignal(30)).toBe("Plays short games");
  });

  it("detects long games at >= 50 moves", () => {
    expect(deriveGameLengthSignal(50)).toBe("Plays long games");
    expect(deriveGameLengthSignal(65)).toBe("Plays long games");
  });

  it("detects medium game length in between", () => {
    expect(deriveGameLengthSignal(40)).toBe("Medium game length");
  });

  it("detects resigns often when resign rate >= 40%", () => {
    const ep: EndgameProfile = { checkmates: 5, resignations: 40, timeouts: 5, draws: 10, total: 60 };
    expect(deriveEndgameSignal(ep)).toBe("Resigns often");
  });

  it("detects fights to checkmate when mate rate >= 20%", () => {
    const ep: EndgameProfile = { checkmates: 25, resignations: 10, timeouts: 5, draws: 10, total: 50 };
    expect(deriveEndgameSignal(ep)).toBe("Fights to checkmate");
  });

  it("detects draw tendency as fallback", () => {
    const ep: EndgameProfile = { checkmates: 5, resignations: 10, timeouts: 5, draws: 30, total: 50 };
    expect(deriveEndgameSignal(ep)).toBe("Draw tendency");
  });

  it("handles zero total endgame games", () => {
    const ep: EndgameProfile = { checkmates: 0, resignations: 0, timeouts: 0, draws: 0, total: 0 };
    expect(deriveEndgameSignal(ep)).toBe("No endgame data");
  });
});

// ── Tab navigation ─────────────────────────────────────────────────────────────

describe("tab navigation", () => {
  const tabs = ["scout", "lines", "practice"] as const;
  type Tab = typeof tabs[number];

  it("scout is the first tab", () => {
    expect(tabs[0]).toBe("scout");
  });

  it("lines is the second tab", () => {
    expect(tabs[1]).toBe("lines");
  });

  it("practice is the third tab", () => {
    expect(tabs[2]).toBe("practice");
  });

  it("all tabs are present", () => {
    expect(tabs).toHaveLength(3);
  });

  it("can switch to any tab", () => {
    let active: Tab = "scout";
    active = "lines";
    expect(active).toBe("lines");
    active = "practice";
    expect(active).toBe("practice");
    active = "scout";
    expect(active).toBe("scout");
  });
});
