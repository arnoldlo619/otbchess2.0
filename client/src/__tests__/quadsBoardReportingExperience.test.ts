import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const panel = readFileSync(
  resolve(clientRoot, "components/tournament/QuadsDirectorPanel.tsx"),
  "utf8",
);

describe("Quads board reporting experience", () => {
  it("uses the reusable Chess.com-aware avatar component in board matchup rows", () => {
    expect(panel).toContain("function PlayerProfileAvatar(");
    expect(panel).toContain("function BoardPlayerAvatar(");
    expect(panel).toContain("<PlayerAvatar");
    expect(panel).toContain('platform={(player.platform as "chesscom" | "lichess") ?? "chesscom"}');
    expect(panel).toContain('<BoardPlayerAvatar player={whitePlayer} fallbackName={whiteFullName} side="white" />');
    expect(panel).toContain('<BoardPlayerAvatar player={blackPlayer} fallbackName={blackFullName} side="black" />');
  });

  it("preserves color-side context alongside profile photos and protects BYE rows", () => {
    expect(panel).toContain('side: "white" | "black";');
    expect(panel).toContain('aria-label={`Playing as ${side}`}');
    expect(panel).toContain('fallbackName === "BYE" ? "—"');
    expect(panel).toContain('const isBye = game.blackId === "BYE";');
  });

  it("returns directors to the first Quad only after a new round is generated", () => {
    expect(panel).toContain("const prevRoundRef = useRef(currentRound);");
    expect(panel).toContain("if (prevRoundRef.current !== currentRound)");
    expect(panel).toContain("const firstSectionId = [...sections].sort((a, b) => a.orderIndex - b.orderIndex)[0]?.id ?? null;");
    expect(panel).toContain("_setInternalSelectedSectionId(firstSectionId);");
    expect(panel).toContain("if (firstSectionId) onSectionChange?.(firstSectionId);");
    expect(panel).toContain("setSelectedGameId(null);");
    expect(panel).toContain("setExceptionTrayOpen(false);");
    expect(panel).toContain('workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });');
  });
});
