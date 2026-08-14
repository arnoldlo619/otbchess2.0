import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/components/prep/ForecastWalkthrough.tsx"),
  "utf8",
);

describe("Opening Forecast hover preview", () => {
  it("previews the hovered branch on the board and clears it when the pointer leaves", () => {
    expect(source).toContain("onMouseEnter={() => onHoverNode?.(node)}");
    expect(source).toContain("onMouseLeave={() => onHoverNode?.(null)}");
    expect(source).toContain("const [hoveredNode, setHoveredNode] = useState<FNode | null>(null)");
    expect(source).toContain("const displayFen = hoveredNode && !isOffBook && boardSelectedSq === null");
    expect(source).toContain("onHoverNode={setHoveredNode}");
  });

  it("eases hover FEN updates while respecting reduced-motion preferences", () => {
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).toContain("animationDurationInMs: prefersReducedMotion ? 0 : (hoveredNode ? 260 : 200)");
  });

  it("uses canonical preview paths so both opponent-color tabs produce legal board positions", () => {
    expect(source).toContain("previewPath: string[]");
    expect(source).toContain("const previewPath = b.previewPath ?? path");
    expect(source).toContain("const prevPath = hoveredNode.previewPath.slice(0, -1)");
  });
});
