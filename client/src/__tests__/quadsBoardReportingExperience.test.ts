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
    expect(panel).toContain('<BoardPlayerAvatar player={whitePlayer} fallbackName={whiteFullName} side="white" tournamentStanding={playerStandings.get(game.whiteId)} isDark={isDark} />');
    expect(panel).toContain('<BoardPlayerAvatar player={blackPlayer} fallbackName={blackFullName} side="black" tournamentStanding={playerStandings.get(game.blackId)} isDark={isDark} />');
  });

  it("exposes live, section-local standings and rating in accessible avatar tooltips", () => {
    expect(panel).toContain('import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";');
    expect(panel).toContain("interface PlayerTournamentStanding");
    expect(panel).toContain("const playerStandings = useMemo(() => {");
    expect(panel).toContain("rank: standing.finalRank,");
    expect(panel).toContain("rating: getPlayerRating(players, standing.playerId),");
    expect(panel).toContain("<Tooltip delayDuration={250}>");
    expect(panel).toContain("Current standing");
    expect(panel).toContain("ELO rating");
    expect(panel).toContain('aria-label={`${player.name}, playing as ${side}. Current tournament standing: rank ${tournamentStanding.rank} in ${tournamentStanding.sectionName}; ELO rating ${tournamentStanding.rating}.`}');
    expect(panel).toContain("min-h-11 min-w-11");
  });

  it("preserves color-side context alongside profile photos and protects BYE rows", () => {
    expect(panel).toContain('side: "white" | "black";');
    expect(panel).toContain("aria-hidden=\"true\"");
    expect(panel).toContain('fallbackName === "BYE" ? "—"');
    expect(panel).toContain('const isBye = game.blackId === "BYE";');
  });

  it("moves to the next unfinished Quad only after the current Quad's final board reports", () => {
    expect(panel).toContain("function findNextQuadWithPendingBoards(");
    expect(panel).toContain("const orderedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);");
    expect(panel).toContain("...orderedSections.slice(completedSectionIndex + 1), ...orderedSections.slice(0, completedSectionIndex)");
    expect(panel).toContain("const nextInCurrentQuad = [");
    expect(panel).toContain("if (nextInCurrentQuad) {");
    expect(panel).toContain("const nextSectionId = findNextQuadWithPendingBoards(sections, games, currentGame.round, currentGame.sectionId);");
    expect(panel).toContain("setSelectedSectionId(nextSectionId);");
    expect(panel).toContain('setSectionView((previous) => ({ ...previous, [nextSectionId]: "pairings" }));');
    expect(panel).toContain("setSelectedGameId(null);");
    expect(panel).toContain('workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })');
  });

  it("returns directors to the first Quad only after a new round is generated", () => {
    expect(panel).toContain("const prevRoundRef = useRef(currentRound);");
    expect(panel).toContain("if (prevRoundRef.current !== currentRound)");
    expect(panel).toContain("const firstSectionId = [...sections].sort((a, b) => a.orderIndex - b.orderIndex)[0]?.id ?? null;");
    expect(panel).toContain("_setInternalSelectedSectionId(firstSectionId);");
    expect(panel).toContain("if (firstSectionId) onSectionChange?.(firstSectionId);");
    expect(panel).toContain("setExceptionTrayOpen(false);");
  });
});
