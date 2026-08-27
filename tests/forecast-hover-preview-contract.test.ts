import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/prep/ForecastWalkthrough.tsx"),
  "utf8",
);

describe("Opening Forecast hover preview", () => {
  it("previews the hovered branch on the board and clears it when the pointer leaves", () => {
    expect(source).toContain("onMouseEnter={() => onPreview(branch)}");
    expect(source).toContain("onMouseLeave={() => onPreview(null)}");
    expect(source).toContain("const [previewBranch, setPreviewBranch] = useState<ForecastBranch | null>(null)");
    expect(source).toContain("const displayedPath = previewBranch?.previewPath ?? selectedPath");
    expect(source).toContain("onPreview={setPreviewBranch}");
  });

  it("eases hover FEN updates while respecting reduced-motion preferences", () => {
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).toContain("animationDurationInMs: prefersReducedMotion ? 0 : 180");
  });

  it("uses canonical preview paths so both opponent-color tabs produce legal board positions", () => {
    expect(source).toContain("previewBranch?.previewPath ?? selectedPath");
    expect(source).toContain("function replayPath(path: string[])");
    expect(source).toContain("Every branch is replayed from a legal position.");
  });
});
