import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const matchupPrepPath = path.resolve(__dirname, "../pages/MatchupPrep.tsx");
const matchupPrepSrc = fs.readFileSync(matchupPrepPath, "utf-8");

const chessLineViewerPath = path.resolve(__dirname, "../components/ChessLineViewer.tsx");
const chessLineViewerSrc = fs.readFileSync(chessLineViewerPath, "utf-8");

const userRepertoirePath = path.resolve(__dirname, "../lib/userRepertoire.ts");
const userRepertoireSrc = fs.readFileSync(userRepertoirePath, "utf-8");

describe("MatchupPrep Redesign — 3-Tab Interface", () => {
  // ── Tab Structure ──
  describe("Tab structure", () => {
    it("defines exactly 3 tabs: scout, lines, practice", () => {
      expect(matchupPrepSrc).toContain('"scout" | "lines" | "practice"');
    });

    it("renders Scout Report tab label", () => {
      expect(matchupPrepSrc).toContain("Scout Report");
    });

    it("renders Study Lines tab label", () => {
      expect(matchupPrepSrc).toContain("Study Lines");
    });

    it("renders Practice tab label", () => {
      expect(matchupPrepSrc).toContain("Practice");
    });

    it("defaults to scout tab", () => {
      expect(matchupPrepSrc).toMatch(/useState.*Tab.*\(\s*"scout"\s*\)/);
    });
  });

  // ── Scout Report Tab ──
  describe("Scout Report tab", () => {
    it("renders Exploitable Weaknesses section", () => {
      expect(matchupPrepSrc).toContain("Exploitable Weaknesses");
    });

    it("renders Your Game Plan section", () => {
      expect(matchupPrepSrc).toContain("Your Game Plan");
    });

    it("renders Opening Tendencies section", () => {
      expect(matchupPrepSrc).toContain("Opening Tendencies");
    });

    it("renders How Games End section", () => {
      expect(matchupPrepSrc).toContain("How Games End");
    });

    it("shows win rate percentages (multiplied by 100)", () => {
      // Win rates from backend are 0-1, must be multiplied by 100
      expect(matchupPrepSrc).toMatch(/Math\.round\(.*\*\s*100\)/);
    });

    it("has a View Study Lines CTA button", () => {
      expect(matchupPrepSrc).toContain("onViewLines");
    });
  });

  // ── Study Lines Tab ──
  describe("Study Lines tab", () => {
    it("renders ChessLineViewer component", () => {
      expect(matchupPrepSrc).toContain("ChessLineViewer");
    });

    it("has Practice this line button for each line", () => {
      expect(matchupPrepSrc).toContain("Practice this line");
    });

    it("has Start Practice CTA at the bottom", () => {
      expect(matchupPrepSrc).toContain("Start Practice");
    });

    it("shows WHY THIS LINE rationale in ChessLineViewer", () => {
      expect(chessLineViewerSrc).toMatch(/[Ww]hy this line/);
    });

    it("shows line match percentage", () => {
      expect(matchupPrepSrc).toMatch(/match/i);
    });
  });

  // ── Practice Board Tab ──
  describe("Practice Board tab", () => {
    it("renders ChessPracticeBoard component", () => {
      expect(matchupPrepSrc).toContain("ChessPracticeBoard");
    });

    it("imports ChessPracticeBoard", () => {
      expect(matchupPrepSrc).toContain('import ChessPracticeBoard from');
    });

    it("passes enrichedLines to PracticeBoardTab", () => {
      expect(matchupPrepSrc).toContain("enrichedLines={enrichedLines}");
    });

    it("supports practiceLineIndex for direct line selection", () => {
      expect(matchupPrepSrc).toContain("practiceLineIndex");
    });
  });

  // ── ChessLineViewer Layout Fix ──
  describe("ChessLineViewer layout", () => {
    it("uses flex-col stacking (not side-by-side)", () => {
      expect(chessLineViewerSrc).toContain('flex flex-col gap-0');
    });

    it("constrains board width to max-w-[280px]", () => {
      expect(chessLineViewerSrc).toContain("max-w-[280px]");
    });

    it("centers the board with mx-auto", () => {
      expect(chessLineViewerSrc).toContain("mx-auto");
    });
  });

  // ── Removed Fluff ──
  describe("Removed old fluff", () => {
    it("does NOT have 4-filter segmented control tabs", () => {
      // The old UI had a 4-button segmented control: All | Main Lines | Surprises | Must Know
      // These were clickable filter tabs. The new UI has no such filter — lines are priority-ordered.
      // "Must Know" and "Surprises" may still appear as data labels from the backend, which is fine.
      expect(matchupPrepSrc).not.toMatch(/setFilter.*Must Know/);
      expect(matchupPrepSrc).not.toMatch(/setFilter.*Surprises/);
    });

    it("does NOT have the old flashcard PracticeMode", () => {
      // The old PracticeMode was a flashcard (show name, reveal rationale, click Got It)
      expect(matchupPrepSrc).not.toMatch(/function\s+PracticeMode\b/);
    });
  });

  // ── userRepertoire fix ──
  describe("generateMatchupSummary fix", () => {
    it("does NOT double-prefix moves with 1.", () => {
      // The old code had `1.${topW.move}` where topW.move was already "1.b3"
      expect(userRepertoireSrc).not.toMatch(/`1\.\$\{topW\.move\}`/);
    });

    it("multiplies win rates by 100 for display", () => {
      expect(userRepertoireSrc).toMatch(/\*\s*100/);
    });
  });
});
