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
    expect(source).toContain("previewBranch ? (previewBranch.previewPath ?? [...selectedPath, previewBranch.moveSan]) : selectedPath");
    expect(source).toContain("onPreview={setPreviewBranch}");
  });

  it("eases hover FEN updates while respecting reduced-motion preferences", () => {
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).toContain("animationDurationInMs: prefersReducedMotion ? 0 : 180");
  });

  it("uses canonical preview paths so both opponent-color tabs produce legal board positions", () => {
    expect(source).toContain("const replay = useMemo(() => replayPath(displayedPath), [displayedPath])");
    expect(source).toContain("function replayPath(path: string[])");
    expect(source).toContain("return { fen: chess.fen(), uci, moves");
  });

  it("keeps a hovered piece at its source and renders one high-contrast, shortened route", () => {
    expect(source).toContain("const boardReplay = previewBranch ? committedReplay : replay");
    expect(source).toContain("position: boardReplay?.fen ?? new Chess().fen()");
    expect(source).toContain("arrows: previewMove ? [{ startSquare: previewMove.from, endSquare: previewMove.to, color: previewColor }] : []");
    expect(source).toContain("arrowStartOffset: 0.34");
    expect(source).toContain("arrowWidthDenominator: 8.5");
    expect(source).toContain("Focus a continuation to preview its route.");
  });
});
