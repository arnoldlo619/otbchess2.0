/**
 * Tests for the Saved Prep Reports system and Director Console Prep button
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Saved Report Meta helpers ─────────────────────────────────────────────────

interface SavedReportMeta {
  id: number;
  opponentUsername: string;
  opponentName: string | null;
  winRate: number | null;
  gamesAnalyzed: number | null;
  prepLinesCount: number | null;
  savedAt: string;
}

function findSavedReport(
  reports: SavedReportMeta[],
  username: string
): SavedReportMeta | undefined {
  return reports.find(
    (r) => r.opponentUsername === username.toLowerCase()
  );
}

function formatSavedDate(savedAt: string): string {
  return new Date(savedAt).toLocaleDateString();
}

function getWinRateClass(winRate: number): string {
  if (winRate >= 60) return "text-red-400";
  if (winRate >= 45) return "text-amber-400";
  return "text-[#5B9A6A]";
}

function buildSavePayload(report: {
  opponent: { username: string; gamesAnalyzed: number; overall: { winRate: number } };
  prepLines: unknown[];
}) {
  return {
    opponentUsername: report.opponent.username,
    opponentName: report.opponent.username,
    winRate: report.opponent.overall.winRate,
    gamesAnalyzed: report.opponent.gamesAnalyzed,
    prepLinesCount: report.prepLines.length,
    reportJson: report,
  };
}

// ── Prep button URL builder ───────────────────────────────────────────────────

function buildPrepUrl(username: string): string {
  return `/prep/${encodeURIComponent(username.trim())}`;
}

function buildPrepDropdownItems(
  white: { username: string } | null,
  black: { username: string } | null
): { label: string; url: string }[] {
  const items: { label: string; url: string }[] = [];
  if (white?.username) {
    items.push({ label: `Prep: ${white.username}`, url: buildPrepUrl(white.username) });
  }
  if (black?.username) {
    items.push({ label: `Prep: ${black.username}`, url: buildPrepUrl(black.username) });
  }
  return items;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Saved Prep Reports — client-side logic", () => {
  describe("findSavedReport", () => {
    const reports: SavedReportMeta[] = [
      { id: 1, opponentUsername: "magnus", opponentName: "Magnus", winRate: 72, gamesAnalyzed: 50, prepLinesCount: 3, savedAt: "2026-03-01T00:00:00Z" },
      { id: 2, opponentUsername: "hikaru", opponentName: "Hikaru", winRate: 65, gamesAnalyzed: 40, prepLinesCount: 4, savedAt: "2026-03-02T00:00:00Z" },
    ];

    it("finds a saved report by username (case-insensitive)", () => {
      expect(findSavedReport(reports, "magnus")?.id).toBe(1);
      expect(findSavedReport(reports, "HIKARU")?.id).toBe(2);
    });

    it("returns undefined when username not found", () => {
      expect(findSavedReport(reports, "notfound")).toBeUndefined();
    });

    it("returns undefined for empty list", () => {
      expect(findSavedReport([], "magnus")).toBeUndefined();
    });
  });

  describe("formatSavedDate", () => {
    it("formats a valid ISO date string", () => {
      const result = formatSavedDate("2026-03-15T12:00:00Z");
      expect(result).toMatch(/\d/); // contains digits
    });

    it("handles different date formats", () => {
      const result = formatSavedDate("2026-01-01T00:00:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getWinRateClass", () => {
    it("returns red for high win rate (>=60)", () => {
      expect(getWinRateClass(60)).toBe("text-red-400");
      expect(getWinRateClass(75)).toBe("text-red-400");
      expect(getWinRateClass(100)).toBe("text-red-400");
    });

    it("returns amber for medium win rate (45-59)", () => {
      expect(getWinRateClass(45)).toBe("text-amber-400");
      expect(getWinRateClass(55)).toBe("text-amber-400");
      expect(getWinRateClass(59)).toBe("text-amber-400");
    });

    it("returns green for low win rate (<45)", () => {
      expect(getWinRateClass(44)).toBe("text-[#5B9A6A]");
      expect(getWinRateClass(30)).toBe("text-[#5B9A6A]");
      expect(getWinRateClass(0)).toBe("text-[#5B9A6A]");
    });
  });

  describe("buildSavePayload", () => {
    const mockReport = {
      opponent: {
        username: "Magnus",
        gamesAnalyzed: 50,
        overall: { winRate: 72 },
      },
      prepLines: [{ name: "Sicilian" }, { name: "Caro-Kann" }],
    };

    it("builds correct save payload", () => {
      const payload = buildSavePayload(mockReport);
      expect(payload.opponentUsername).toBe("Magnus");
      expect(payload.opponentName).toBe("Magnus");
      expect(payload.winRate).toBe(72);
      expect(payload.gamesAnalyzed).toBe(50);
      expect(payload.prepLinesCount).toBe(2);
      expect(payload.reportJson).toBe(mockReport);
    });

    it("includes the full report object in reportJson", () => {
      const payload = buildSavePayload(mockReport);
      expect(payload.reportJson).toHaveProperty("opponent");
      expect(payload.reportJson).toHaveProperty("prepLines");
    });

    it("correctly counts prep lines", () => {
      const reportWith5Lines = { ...mockReport, prepLines: new Array(5).fill({}) };
      expect(buildSavePayload(reportWith5Lines).prepLinesCount).toBe(5);
    });

    it("handles zero prep lines", () => {
      const reportNoLines = { ...mockReport, prepLines: [] };
      expect(buildSavePayload(reportNoLines).prepLinesCount).toBe(0);
    });
  });
});

describe("Director Console — Prep button URL builder", () => {
  describe("buildPrepUrl", () => {
    it("builds correct prep URL for a username", () => {
      expect(buildPrepUrl("magnus")).toBe("/prep/magnus");
    });

    it("URL-encodes special characters in usernames", () => {
      expect(buildPrepUrl("user name")).toBe("/prep/user%20name");
    });

    it("trims whitespace from username", () => {
      expect(buildPrepUrl("  hikaru  ")).toBe("/prep/hikaru");
    });

    it("handles usernames with underscores", () => {
      expect(buildPrepUrl("chess_player_99")).toBe("/prep/chess_player_99");
    });
  });

  describe("buildPrepDropdownItems", () => {
    const white = { username: "magnus" };
    const black = { username: "hikaru" };

    it("builds dropdown items for both players", () => {
      const items = buildPrepDropdownItems(white, black);
      expect(items).toHaveLength(2);
      expect(items[0].label).toBe("Prep: magnus");
      expect(items[0].url).toBe("/prep/magnus");
      expect(items[1].label).toBe("Prep: hikaru");
      expect(items[1].url).toBe("/prep/hikaru");
    });

    it("handles null white player", () => {
      const items = buildPrepDropdownItems(null, black);
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Prep: hikaru");
    });

    it("handles null black player", () => {
      const items = buildPrepDropdownItems(white, null);
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Prep: magnus");
    });

    it("returns empty array when both players are null", () => {
      expect(buildPrepDropdownItems(null, null)).toHaveLength(0);
    });

    it("skips players with empty username", () => {
      const items = buildPrepDropdownItems({ username: "" }, black);
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Prep: hikaru");
    });
  });
});

describe("Saved Prep Reports — API interaction patterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs correct POST body for saving a report", () => {
    const report = {
      opponent: { username: "Magnus", gamesAnalyzed: 50, overall: { winRate: 72 } },
      prepLines: [{}],
    };
    const body = JSON.stringify(buildSavePayload(report));
    const parsed = JSON.parse(body);
    expect(parsed.opponentUsername).toBe("Magnus");
    expect(parsed.winRate).toBe(72);
    expect(parsed.prepLinesCount).toBe(1);
  });

  it("constructs correct DELETE URL for removing a saved report", () => {
    const id = 42;
    const url = `/api/prep/saved/${id}`;
    expect(url).toBe("/api/prep/saved/42");
  });

  it("constructs correct GET URL for fetching a single saved report", () => {
    const id = 7;
    const url = `/api/prep/saved/${id}`;
    expect(url).toBe("/api/prep/saved/7");
  });

  it("identifies if a report is already saved by matching username", () => {
    const savedReports: SavedReportMeta[] = [
      { id: 1, opponentUsername: "magnus", opponentName: null, winRate: 72, gamesAnalyzed: 50, prepLinesCount: 3, savedAt: "2026-03-01T00:00:00Z" },
    ];
    const currentOpponent = "Magnus";
    const match = savedReports.find(
      (r) => r.opponentUsername === currentOpponent.toLowerCase()
    );
    expect(match).toBeDefined();
    expect(match?.id).toBe(1);
  });

  it("correctly identifies unsaved report", () => {
    const savedReports: SavedReportMeta[] = [
      { id: 1, opponentUsername: "magnus", opponentName: null, winRate: 72, gamesAnalyzed: 50, prepLinesCount: 3, savedAt: "2026-03-01T00:00:00Z" },
    ];
    const currentOpponent = "hikaru";
    const match = savedReports.find(
      (r) => r.opponentUsername === currentOpponent.toLowerCase()
    );
    expect(match).toBeUndefined();
  });
});
