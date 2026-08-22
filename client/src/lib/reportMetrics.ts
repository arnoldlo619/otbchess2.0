import type { Round } from "./tournamentData";

/** Percentage of completed, played games that ended in a draw. Pending games
 * and BYEs are excluded from both numerator and denominator. */
export function calculateCompletedGameDrawRate(
  rounds: Array<Pick<Round, "games">>,
): number {
  const completedGames = rounds
    .flatMap((round) => round.games)
    .filter((game) => game.result !== "*" && game.blackId !== "BYE");

  if (completedGames.length === 0) return 0;
  const drawnGames = completedGames.filter((game) => game.result === "½-½").length;
  return Math.round((drawnGames / completedGames.length) * 100);
}
