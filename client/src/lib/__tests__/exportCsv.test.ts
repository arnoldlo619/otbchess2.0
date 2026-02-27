/**
 * OTB Chess — CSV Export Utility Tests
 * Tests for escapeCsvCell, standingsToCsv, buildCsvFilename, and exportStandingsCsv.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  escapeCsvCell,
  standingsToCsv,
  buildCsvFilename,
  downloadCsv,
  exportStandingsCsv,
} from "@/lib/exportCsv";
import type { StandingRow } from "@/lib/swiss";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<StandingRow> = {}): StandingRow {
  return {
    rank: 1,
    points: 3.5,
    buchholz: 8.0,
    buchholzCut1: 6.5,
    sonnebornBerger: 7.25,
    wins: 3,
    draws: 1,
    losses: 0,
    player: {
      id: "p1",
      name: "Alice Smith",
      username: "alicesmith",
      elo: 1850,
      country: "US",
      points: 3.5,
      wins: 3,
      draws: 1,
      losses: 0,
      buchholz: 8.0,
      colorHistory: ["W", "B", "W", "B"],
    },
    ...overrides,
  };
}

// ── escapeCsvCell ─────────────────────────────────────────────────────────────

describe("escapeCsvCell", () => {
  it("returns an empty string for null", () => {
    expect(escapeCsvCell(null)).toBe("");
  });

  it("returns an empty string for undefined", () => {
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("returns a plain string unchanged when no special characters", () => {
    expect(escapeCsvCell("Alice Smith")).toBe("Alice Smith");
  });

  it("wraps a value containing a comma in double-quotes", () => {
    expect(escapeCsvCell("Smith, Alice")).toBe('"Smith, Alice"');
  });

  it("wraps a value containing a newline in double-quotes", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("escapes internal double-quotes by doubling them", () => {
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it("converts numbers to strings", () => {
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("converts floats to strings", () => {
    expect(escapeCsvCell(3.5)).toBe("3.5");
  });
});

// ── standingsToCsv ────────────────────────────────────────────────────────────

describe("standingsToCsv", () => {
  it("produces a header row as the first line", () => {
    const csv = standingsToCsv([]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Rank,Name,Username,ELO,Score,Wins,Draws,Losses,Buchholz,Buchholz Cut-1,Sonneborn-Berger"
    );
  });

  it("produces exactly one data row per standing entry", () => {
    const rows = [makeRow({ rank: 1 }), makeRow({ rank: 2 })];
    const csv = standingsToCsv(rows);
    const lines = csv.split("\r\n").filter(Boolean);
    // header + 2 data rows
    expect(lines).toHaveLength(3);
  });

  it("encodes rank, name, username, ELO, score, W/D/L correctly", () => {
    const row = makeRow();
    const csv = standingsToCsv([row]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain("1");
    expect(dataLine).toContain("Alice Smith");
    expect(dataLine).toContain("alicesmith");
    expect(dataLine).toContain("1850");
    expect(dataLine).toContain("3.5");
    expect(dataLine).toContain("3");
    expect(dataLine).toContain("1");
    expect(dataLine).toContain("0");
  });

  it("formats Buchholz to one decimal place", () => {
    const row = makeRow({ buchholz: 8 });
    const csv = standingsToCsv([row]);
    expect(csv).toContain("8.0");
  });

  it("formats Sonneborn-Berger to two decimal places", () => {
    const row = makeRow({ sonnebornBerger: 7.25 });
    const csv = standingsToCsv([row]);
    expect(csv).toContain("7.25");
  });

  it("wraps player names containing commas in double-quotes", () => {
    const row = makeRow();
    row.player.name = "Smith, Alice";
    const csv = standingsToCsv([row]);
    expect(csv).toContain('"Smith, Alice"');
  });

  it("returns only the header row when given an empty array", () => {
    const csv = standingsToCsv([]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  it("uses CRLF line endings", () => {
    const csv = standingsToCsv([makeRow()]);
    expect(csv).toContain("\r\n");
  });

  it("orders columns: Rank first, Sonneborn-Berger last", () => {
    const csv = standingsToCsv([makeRow()]);
    const header = csv.split("\r\n")[0];
    const cols = header.split(",");
    expect(cols[0]).toBe("Rank");
    expect(cols[cols.length - 1]).toBe("Sonneborn-Berger");
  });
});

// ── buildCsvFilename ──────────────────────────────────────────────────────────

describe("buildCsvFilename", () => {
  it("appends _standings.csv suffix", () => {
    const name = buildCsvFilename({ tournamentName: "Spring Open" });
    expect(name).toMatch(/_standings\.csv$/);
  });

  it("replaces spaces with underscores", () => {
    const name = buildCsvFilename({ tournamentName: "Spring Open 2025" });
    expect(name).toContain("Spring_Open_2025");
  });

  it("includes the date when provided", () => {
    const name = buildCsvFilename({
      tournamentName: "Spring Open",
      date: "2025-04-12",
    });
    expect(name).toContain("2025-04-12");
  });

  it("omits the date segment when not provided", () => {
    const name = buildCsvFilename({ tournamentName: "Spring Open" });
    expect(name).toBe("Spring_Open_standings.csv");
  });

  it("strips characters that are invalid in filenames", () => {
    const name = buildCsvFilename({ tournamentName: "Open/Tournament:2025" });
    expect(name).not.toMatch(/[/\\?%*:|"<>]/);
  });
});

// ── downloadCsv (browser API mock) ───────────────────────────────────────────

describe("downloadCsv", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => "blob:mock-url");
    revokeObjectURLSpy = vi.fn();
    clickSpy = vi.fn();

    Object.defineProperty(globalThis, "URL", {
      value: {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      },
      writable: true,
    });

    const mockLink = {
      setAttribute: vi.fn(),
      style: { display: "" },
      click: clickSpy,
    };

    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(appendChildSpy);
    vi.spyOn(document.body, "removeChild").mockImplementation(removeChildSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls URL.createObjectURL with a Blob", () => {
    downloadCsv("a,b\r\n1,2", "test.csv");
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
  });

  it("clicks the anchor element to trigger the download", () => {
    downloadCsv("a,b\r\n1,2", "test.csv");
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("revokes the object URL after clicking", () => {
    downloadCsv("a,b\r\n1,2", "test.csv");
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });
});

// ── exportStandingsCsv (integration) ─────────────────────────────────────────

describe("exportStandingsCsv", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "URL", {
      value: {
        createObjectURL: vi.fn(() => "blob:mock"),
        revokeObjectURL: vi.fn(),
      },
      writable: true,
    });
    const mockLink = {
      setAttribute: vi.fn(),
      style: { display: "" },
      click: vi.fn(),
    };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(vi.fn());
    vi.spyOn(document.body, "removeChild").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw when called with a valid standings array", () => {
    expect(() =>
      exportStandingsCsv([makeRow()], { tournamentName: "Test Open", date: "2025-01-01" })
    ).not.toThrow();
  });

  it("does not throw when called with an empty standings array", () => {
    expect(() =>
      exportStandingsCsv([], { tournamentName: "Empty Tournament" })
    ).not.toThrow();
  });
});
