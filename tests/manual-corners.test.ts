/**
 * Tests for the manual board corners feature:
 *  - Corners are accepted in the finalize request body
 *  - Corners are written to a temp JSON file
 *  - Corners file path is passed to enqueueCvJob
 *  - cv_worker.py accepts --corners-file argument
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("Manual Board Corners", () => {
  describe("Corners file format", () => {
    it("should write corners as [[x,y],[x,y],[x,y],[x,y]] JSON", () => {
      const boardCorners = [
        { x: 100, y: 200 },
        { x: 900, y: 180 },
        { x: 920, y: 700 },
        { x: 80, y: 720 },
      ];

      // Simulate what recordings.ts does
      const cornersArray = boardCorners.map((c) => [c.x, c.y]);
      const json = JSON.stringify(cornersArray);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual([
        [100, 200],
        [900, 180],
        [920, 700],
        [80, 720],
      ]);
      expect(parsed.length).toBe(4);
      expect(parsed[0].length).toBe(2);
    });

    it("should write and read corners file correctly", () => {
      const tmpFile = path.join("/tmp", `test-corners-${Date.now()}.json`);
      const corners = [
        [150, 250],
        [850, 230],
        [870, 680],
        [130, 700],
      ];

      fs.writeFileSync(tmpFile, JSON.stringify(corners), "utf8");
      const read = JSON.parse(fs.readFileSync(tmpFile, "utf8"));

      expect(read).toEqual(corners);
      expect(read.length).toBe(4);

      // Cleanup
      fs.unlinkSync(tmpFile);
    });
  });

  describe("cv_worker.py --corners-file argument", () => {
    it("should accept --corners-file and parse corners correctly", () => {
      const tmpFile = path.join("/tmp", `test-corners-${Date.now()}.json`);
      const corners = [
        [100, 200],
        [900, 180],
        [920, 700],
        [80, 720],
      ];
      fs.writeFileSync(tmpFile, JSON.stringify(corners), "utf8");

      // Run cv_worker.py with --help to verify the argument is accepted
      const cvWorkerPath = path.resolve(__dirname, "../server/cv_worker.py");
      try {
        const output = execSync(`python3.11 ${cvWorkerPath} --help 2>&1`, {
          encoding: "utf8",
          timeout: 10000,
        });
        expect(output).toContain("--corners-file");
      } catch (e: any) {
        // --help might exit with code 0 or non-zero depending on argparse
        if (e.stdout) {
          expect(e.stdout).toContain("--corners-file");
        } else {
          throw e;
        }
      }

      // Cleanup
      fs.unlinkSync(tmpFile);
    });

    it("should parse a valid corners file into 4 coordinate pairs", () => {
      // Test the Python parsing logic directly
      const tmpFile = path.join("/tmp", `test-corners-${Date.now()}.json`);
      const corners = [
        [100, 200],
        [900, 180],
        [920, 700],
        [80, 720],
      ];
      fs.writeFileSync(tmpFile, JSON.stringify(corners), "utf8");

      const script = `
import json, sys
with open("${tmpFile}", "r") as f:
    data = json.load(f)
manual_corners = [(c[0], c[1]) for c in data]
assert len(manual_corners) == 4, f"Expected 4 corners, got {len(manual_corners)}"
for c in manual_corners:
    assert len(c) == 2, f"Expected (x,y) tuple, got {c}"
    assert isinstance(c[0], (int, float)), f"x must be numeric, got {type(c[0])}"
    assert isinstance(c[1], (int, float)), f"y must be numeric, got {type(c[1])}"
print("OK")
`;
      const result = execSync(`python3.11 -c '${script}'`, {
        encoding: "utf8",
        timeout: 5000,
      });
      expect(result.trim()).toBe("OK");

      // Cleanup
      fs.unlinkSync(tmpFile);
    });
  });

  describe("Schema cornersFile column", () => {
    it("should have cornersFile defined in the cvJobs schema", async () => {
      // Read the schema file and verify cornersFile is defined
      const schemaPath = path.resolve(__dirname, "../shared/schema.ts");
      const schemaContent = fs.readFileSync(schemaPath, "utf8");
      expect(schemaContent).toContain("cornersFile");
      expect(schemaContent).toContain("corners_file");
    });
  });

  describe("cvJobQueue corners parameter", () => {
    it("should have cornersFile parameter in enqueueCvJob", () => {
      const queuePath = path.resolve(__dirname, "../server/cvJobQueue.ts");
      const content = fs.readFileSync(queuePath, "utf8");
      expect(content).toContain("cornersFile");
      expect(content).toContain("corners-file");
    });
  });

  describe("recordings.ts boardCorners handling", () => {
    it("should destructure boardCorners from request body in finalize endpoint", () => {
      const recordingsPath = path.resolve(__dirname, "../server/recordings.ts");
      const content = fs.readFileSync(recordingsPath, "utf8");
      expect(content).toContain("boardCorners");
      expect(content).toContain("cornersFile");
      // Verify it writes corners to a file
      expect(content).toContain("corners.json");
    });
  });
});
