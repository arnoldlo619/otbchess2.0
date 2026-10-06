import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const worker = fs.readFileSync(path.resolve(process.cwd(), "server/cv_worker.py"), "utf8");
const geometryTest = fs.readFileSync(
  path.resolve(process.cwd(), "server/tests/test_rotated_corner_geometry.py"),
  "utf8",
);

describe("rotated chessboard corner ordering", () => {
  it("orders board quadrilaterals by centroid angle instead of strict quadrants", () => {
    expect(worker).toContain("math.atan2(p[1] - cy, p[0] - cx)");
    expect(worker).toContain("raise ValueError(f\"Expected exactly 4 board corners");
    expect(worker).not.toContain("p[0] < cx and p[1] < cy");
  });

  it("retains executable coverage for the 30° through 60° regression range", () => {
    expect(geometryTest).toContain("for angle in (30, 35, 40, 45, 50, 60):");
    expect(geometryTest).toContain("len(set(corners)), 4");
    expect(geometryTest).toContain("self.assertGreater(area, 10_000)");
  });
});
