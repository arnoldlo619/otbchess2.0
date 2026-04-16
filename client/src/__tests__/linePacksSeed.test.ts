import { describe, it, expect } from "vitest";
import seedData from "../../../data/line-packs-seed.json";

// ── Type helpers ──────────────────────────────────────────────────────────────

interface StudyMode {
  unlockOrder: number;
  learnFirst: boolean;
  drillReady: boolean;
  trapFocused: boolean;
}

interface Line {
  openingSlug: string;
  slug: string;
  title: string;
  chapterName: string;
  eco: string;
  color: string;
  pgn: string;
  finalFen: string;
  moveSequenceSan: string;
  moveSequenceUci: string;
  plyCount: number;
  difficulty: string;
  commonness: number;
  priority: number;
  isMustKnow: boolean;
  starterFriendly: boolean;
  isTrap: boolean;
  lineType: string;
  lineSummary: string;
  strategicGoal: string;
  commonOpponentMistake: string;
  punishmentIdea: string;
  hintText: string;
  branchLabel: string;
  pawnStructure: string | null;
  themes: string[];
  sortOrder: number;
  studyMode: StudyMode;
}

interface LinePack {
  openingSlug: string;
  openingName: string;
  lineCount: number;
  lines: Line[];
}

interface SeedData {
  _meta: {
    version: string;
    description: string;
    generatedAt: string;
    openingCount: number;
    totalLines: number;
  };
  linePacks: Record<string, LinePack>;
}

const data = seedData as unknown as SeedData;

// ── Meta tests ────────────────────────────────────────────────────────────────

describe("Line Packs Seed — Meta", () => {
  it("has correct version and counts", () => {
    expect(data._meta.version).toBe("1.0.0");
    expect(data._meta.openingCount).toBe(6);
    expect(data._meta.totalLines).toBe(56);
  });

  it("has all 6 expected opening packs", () => {
    const expected = [
      "jobava-london",
      "vienna-gambit",
      "scotch-game",
      "caro-kann-defense",
      "kings-indian-defense",
      "anti-london-system",
    ];
    expect(Object.keys(data.linePacks).sort()).toEqual(expected.sort());
  });

  it("total lines matches sum of pack line counts", () => {
    const sum = Object.values(data.linePacks).reduce(
      (acc, p) => acc + p.lineCount,
      0
    );
    expect(sum).toBe(data._meta.totalLines);
  });
});

// ── Pack-level tests ──────────────────────────────────────────────────────────

describe("Line Packs Seed — Pack Structure", () => {
  for (const [slug, pack] of Object.entries(data.linePacks)) {
    describe(pack.openingName, () => {
      it(`has 8-15 lines (has ${pack.lineCount})`, () => {
        expect(pack.lineCount).toBeGreaterThanOrEqual(8);
        expect(pack.lineCount).toBeLessThanOrEqual(15);
        expect(pack.lines.length).toBe(pack.lineCount);
      });

      it("all lines reference the correct opening slug", () => {
        for (const line of pack.lines) {
          expect(line.openingSlug).toBe(slug);
        }
      });

      it("has at least one must-know line", () => {
        const mustKnow = pack.lines.filter((l) => l.isMustKnow);
        expect(mustKnow.length).toBeGreaterThanOrEqual(1);
      });

      it("has at least one trap line", () => {
        const traps = pack.lines.filter((l) => l.isTrap);
        expect(traps.length).toBeGreaterThanOrEqual(1);
      });

      it("has at least one learnFirst line", () => {
        const learn = pack.lines.filter((l) => l.studyMode.learnFirst);
        expect(learn.length).toBeGreaterThanOrEqual(1);
      });

      it("has unique slugs", () => {
        const slugs = pack.lines.map((l) => l.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
      });

      it("has unique sort orders", () => {
        const orders = pack.lines.map((l) => l.sortOrder);
        expect(new Set(orders).size).toBe(orders.length);
      });
    });
  }
});

// ── Line-level tests ──────────────────────────────────────────────────────────

describe("Line Packs Seed — Line Data Quality", () => {
  const allLines = Object.values(data.linePacks).flatMap((p) => p.lines);

  it("all 56 lines have non-empty required fields", () => {
    for (const line of allLines) {
      expect(line.slug).toBeTruthy();
      expect(line.title).toBeTruthy();
      expect(line.chapterName).toBeTruthy();
      expect(line.eco).toBeTruthy();
      expect(line.pgn).toBeTruthy();
      expect(line.finalFen).toBeTruthy();
      expect(line.moveSequenceSan).toBeTruthy();
      expect(line.moveSequenceUci).toBeTruthy();
      expect(line.lineSummary).toBeTruthy();
      expect(line.strategicGoal).toBeTruthy();
      expect(line.hintText).toBeTruthy();
      expect(line.branchLabel).toBeTruthy();
    }
  });

  it("all FENs have valid format (6 space-separated fields)", () => {
    for (const line of allLines) {
      const parts = line.finalFen.split(" ");
      expect(parts.length).toBe(6);
      // Board position should have 8 ranks
      expect(parts[0].split("/").length).toBe(8);
      // Active color should be 'w' or 'b'
      expect(["w", "b"]).toContain(parts[1]);
    }
  });

  it("all PGNs start with '1.'", () => {
    for (const line of allLines) {
      expect(line.pgn.startsWith("1.")).toBe(true);
    }
  });

  it("ply count matches move sequence length", () => {
    for (const line of allLines) {
      const sanMoves = line.moveSequenceSan.split(" ").filter(Boolean);
      const uciMoves = line.moveSequenceUci.split(" ").filter(Boolean);
      expect(line.plyCount).toBe(sanMoves.length);
      expect(line.plyCount).toBe(uciMoves.length);
    }
  });

  it("all UCI moves have valid format (4-5 chars)", () => {
    for (const line of allLines) {
      const uciMoves = line.moveSequenceUci.split(" ").filter(Boolean);
      for (const uci of uciMoves) {
        expect(uci.length).toBeGreaterThanOrEqual(4);
        expect(uci.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it("difficulty is one of the allowed values", () => {
    const allowed = ["beginner", "intermediate", "advanced", "expert"];
    for (const line of allLines) {
      expect(allowed).toContain(line.difficulty);
    }
  });

  it("color is 'white' or 'black'", () => {
    for (const line of allLines) {
      expect(["white", "black"]).toContain(line.color);
    }
  });

  it("lineType is one of the allowed values", () => {
    const allowed = ["main", "sideline", "gambit", "surprise", "trap"];
    for (const line of allLines) {
      expect(allowed).toContain(line.lineType);
    }
  });

  it("commonness scores are 0-100", () => {
    for (const line of allLines) {
      expect(line.commonness).toBeGreaterThanOrEqual(0);
      expect(line.commonness).toBeLessThanOrEqual(100);
    }
  });

  it("priority scores are 0-100", () => {
    for (const line of allLines) {
      expect(line.priority).toBeGreaterThanOrEqual(0);
      expect(line.priority).toBeLessThanOrEqual(100);
    }
  });

  it("ECO codes match standard format (letter + 2 digits)", () => {
    for (const line of allLines) {
      expect(line.eco).toMatch(/^[A-E]\d{2}$/);
    }
  });

  it("themes is always an array", () => {
    for (const line of allLines) {
      expect(Array.isArray(line.themes)).toBe(true);
      expect(line.themes.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Study mode tests ──────────────────────────────────────────────────────────

describe("Line Packs Seed — Study Mode Metadata", () => {
  const allLines = Object.values(data.linePacks).flatMap((p) => p.lines);

  it("all lines have studyMode object", () => {
    for (const line of allLines) {
      expect(line.studyMode).toBeDefined();
      expect(typeof line.studyMode.unlockOrder).toBe("number");
      expect(typeof line.studyMode.learnFirst).toBe("boolean");
      expect(typeof line.studyMode.drillReady).toBe("boolean");
      expect(typeof line.studyMode.trapFocused).toBe("boolean");
    }
  });

  it("unlock orders are between 1 and 10", () => {
    for (const line of allLines) {
      expect(line.studyMode.unlockOrder).toBeGreaterThanOrEqual(1);
      expect(line.studyMode.unlockOrder).toBeLessThanOrEqual(10);
    }
  });

  it("trap lines have trapFocused: true in studyMode", () => {
    const traps = allLines.filter((l) => l.isTrap);
    for (const trap of traps) {
      expect(trap.studyMode.trapFocused).toBe(true);
    }
  });

  it("learnFirst lines have unlockOrder <= 3", () => {
    const learn = allLines.filter((l) => l.studyMode.learnFirst);
    for (const line of learn) {
      expect(line.studyMode.unlockOrder).toBeLessThanOrEqual(4);
    }
  });

  it("each opening has unlockOrder 1 line", () => {
    for (const pack of Object.values(data.linePacks)) {
      const order1 = pack.lines.filter(
        (l) => l.studyMode.unlockOrder === 1
      );
      expect(order1.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Color consistency tests ───────────────────────────────────────────────────

describe("Line Packs Seed — Color Consistency", () => {
  it("White openings have all white lines", () => {
    const whiteOpenings = ["jobava-london", "vienna-gambit", "scotch-game"];
    for (const slug of whiteOpenings) {
      const pack = data.linePacks[slug];
      for (const line of pack.lines) {
        expect(line.color).toBe("white");
      }
    }
  });

  it("Black openings have all black lines", () => {
    const blackOpenings = [
      "caro-kann-defense",
      "kings-indian-defense",
      "anti-london-system",
    ];
    for (const slug of blackOpenings) {
      const pack = data.linePacks[slug];
      for (const line of pack.lines) {
        expect(line.color).toBe("black");
      }
    }
  });
});

// ── Content quality tests ─────────────────────────────────────────────────────

describe("Line Packs Seed — Content Quality", () => {
  const allLines = Object.values(data.linePacks).flatMap((p) => p.lines);

  it("line summaries are 50-500 characters", () => {
    for (const line of allLines) {
      expect(line.lineSummary.length).toBeGreaterThanOrEqual(50);
      expect(line.lineSummary.length).toBeLessThanOrEqual(500);
    }
  });

  it("strategic goals are 30-300 characters", () => {
    for (const line of allLines) {
      expect(line.strategicGoal.length).toBeGreaterThanOrEqual(30);
      expect(line.strategicGoal.length).toBeLessThanOrEqual(300);
    }
  });

  it("hint texts are 30-200 characters", () => {
    for (const line of allLines) {
      expect(line.hintText.length).toBeGreaterThanOrEqual(30);
      expect(line.hintText.length).toBeLessThanOrEqual(200);
    }
  });

  it("no duplicate slugs across all packs", () => {
    const allSlugs = allLines.map((l) => l.slug);
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
  });

  it("no duplicate titles across all packs", () => {
    const allTitles = allLines.map((l) => l.title);
    expect(new Set(allTitles).size).toBe(allTitles.length);
  });
});
