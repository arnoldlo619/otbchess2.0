/**
 * Tests for LiveBoardsSection data-sorting and status logic
 */
import { describe, it, expect } from "vitest";

// ─── Broadcast sort helper (mirrors LiveBoardsSection logic) ──────────────────
interface Broadcast {
  id: string;
  boardNumber: number;
  status: string;
  result?: string | null;
  publicSlug: string;
  moveNumber: number;
}

function sortBroadcasts(data: Broadcast[]): Broadcast[] {
  const order: Record<string, number> = { live: 0, paused: 1, ready: 2, ended: 3 };
  return [...data].sort((a, b) => {
    const ao = order[a.status] ?? 4;
    const bo = order[b.status] ?? 4;
    if (ao !== bo) return ao - bo;
    return a.boardNumber - b.boardNumber;
  });
}

function resultLabel(broadcast: Broadcast, white: string, black: string): string | null {
  if (broadcast.result === "1-0") return `${white} wins`;
  if (broadcast.result === "0-1") return `${black} wins`;
  if (broadcast.result === "1/2-1/2") return "Draw";
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("LiveBoardsSection — sort logic", () => {
  it("sorts live boards before paused, ready, and ended", () => {
    const data: Broadcast[] = [
      { id: "1", boardNumber: 1, status: "ended", result: "1-0", publicSlug: "a", moveNumber: 40 },
      { id: "2", boardNumber: 2, status: "ready", result: null, publicSlug: "b", moveNumber: 0 },
      { id: "3", boardNumber: 3, status: "live", result: null, publicSlug: "c", moveNumber: 12 },
      { id: "4", boardNumber: 4, status: "paused", result: null, publicSlug: "d", moveNumber: 8 },
    ];
    const sorted = sortBroadcasts(data);
    expect(sorted[0].status).toBe("live");
    expect(sorted[1].status).toBe("paused");
    expect(sorted[2].status).toBe("ready");
    expect(sorted[3].status).toBe("ended");
  });

  it("sorts by board number within the same status", () => {
    const data: Broadcast[] = [
      { id: "1", boardNumber: 3, status: "live", result: null, publicSlug: "a", moveNumber: 5 },
      { id: "2", boardNumber: 1, status: "live", result: null, publicSlug: "b", moveNumber: 8 },
      { id: "3", boardNumber: 2, status: "live", result: null, publicSlug: "c", moveNumber: 3 },
    ];
    const sorted = sortBroadcasts(data);
    expect(sorted.map((b) => b.boardNumber)).toEqual([1, 2, 3]);
  });

  it("handles empty array", () => {
    expect(sortBroadcasts([])).toEqual([]);
  });
});

describe("LiveBoardsSection — result labels", () => {
  it("returns white wins for 1-0", () => {
    const b: Broadcast = { id: "1", boardNumber: 1, status: "ended", result: "1-0", publicSlug: "a", moveNumber: 40 };
    expect(resultLabel(b, "Alice", "Bob")).toBe("Alice wins");
  });

  it("returns black wins for 0-1", () => {
    const b: Broadcast = { id: "1", boardNumber: 1, status: "ended", result: "0-1", publicSlug: "a", moveNumber: 40 };
    expect(resultLabel(b, "Alice", "Bob")).toBe("Bob wins");
  });

  it("returns Draw for 1/2-1/2", () => {
    const b: Broadcast = { id: "1", boardNumber: 1, status: "ended", result: "1/2-1/2", publicSlug: "a", moveNumber: 35 };
    expect(resultLabel(b, "Alice", "Bob")).toBe("Draw");
  });

  it("returns null for in-progress game", () => {
    const b: Broadcast = { id: "1", boardNumber: 1, status: "live", result: null, publicSlug: "a", moveNumber: 12 };
    expect(resultLabel(b, "Alice", "Bob")).toBeNull();
  });
});

describe("LiveBoardsSection — live count", () => {
  it("counts only live broadcasts", () => {
    const data: Broadcast[] = [
      { id: "1", boardNumber: 1, status: "live", result: null, publicSlug: "a", moveNumber: 5 },
      { id: "2", boardNumber: 2, status: "live", result: null, publicSlug: "b", moveNumber: 8 },
      { id: "3", boardNumber: 3, status: "ended", result: "1-0", publicSlug: "c", moveNumber: 40 },
      { id: "4", boardNumber: 4, status: "paused", result: null, publicSlug: "d", moveNumber: 10 },
    ];
    const liveCount = data.filter((b) => b.status === "live").length;
    expect(liveCount).toBe(2);
  });
});
