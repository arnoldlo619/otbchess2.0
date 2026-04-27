import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const studyModePath = path.resolve(__dirname, "../pages/StudyMode.tsx");
const studyModeSrc = fs.readFileSync(studyModePath, "utf-8");

describe("StudyMode — Fix TypeError: Cannot read properties of undefined (reading 'side')", () => {
  describe("Root cause: API response merging", () => {
    it("merges data.opening into lineData (not just data.line)", () => {
      // The API returns { opening, line, nodes, progress, navigation } as separate fields.
      // The old code did setLineData(data.line) which lost opening, nodes, etc.
      expect(studyModeSrc).toContain("opening: data.opening");
    });

    it("merges data.nodes into lineData", () => {
      expect(studyModeSrc).toContain("nodes: data.nodes");
    });

    it("provides a fallback opening when data.opening is missing", () => {
      // Prevents the crash when opening is undefined
      expect(studyModeSrc).toMatch(/data\.opening\s*\?\?\s*\{/);
    });

    it("provides a fallback for nodes when data.nodes is missing", () => {
      expect(studyModeSrc).toMatch(/data\.nodes\s*\?\?\s*\[\]/);
    });
  });

  describe("Field name mapping", () => {
    it("maps strategicSummary to strategicGoal", () => {
      // API returns 'strategicSummary' but LineData expects 'strategicGoal'
      expect(studyModeSrc).toContain("data.line.strategicSummary");
    });

    it("maps strategicSummary to lineSummary as fallback", () => {
      expect(studyModeSrc).toMatch(/lineSummary:\s*data\.line\.strategicSummary/);
    });

    it("provides fallback for branchLabel from lineType", () => {
      expect(studyModeSrc).toMatch(/branchLabel:\s*data\.line\.branchLabel\s*\?\?\s*data\.line\.lineType/);
    });
  });

  describe("LineData interface", () => {
    it("defines opening with name, slug, and side fields", () => {
      expect(studyModeSrc).toContain("opening: { name: string; slug: string; side: string }");
    });

    it("includes optional navigation field", () => {
      expect(studyModeSrc).toContain("navigation?:");
    });
  });

  describe("Safe access pattern", () => {
    it("uses optional chaining for lineData?.opening.side", () => {
      expect(studyModeSrc).toContain("lineData?.opening.side");
    });

    it("uses optional chaining for lineData?.nodes", () => {
      expect(studyModeSrc).toContain("lineData?.nodes");
    });
  });
});
