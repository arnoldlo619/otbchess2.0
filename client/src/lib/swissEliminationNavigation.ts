export interface SwissEliminationBracketTransitionInput {
  format?: string | null;
  previousPhase?: string | null;
  currentPhase?: string | null;
  advancingPlayerCount: number;
  hasAutoSwitched: boolean;
}

/**
 * Keeps player-facing tournament navigation aligned with the authoritative
 * swiss_elim lifecycle. An undefined previous phase intentionally qualifies
 * so a newly connected player lands on an already-live bracket as well.
 */
export function shouldAutoSwitchToSwissEliminationBracket({
  format,
  previousPhase,
  currentPhase,
  advancingPlayerCount,
  hasAutoSwitched,
}: SwissEliminationBracketTransitionInput): boolean {
  if (hasAutoSwitched || format !== "swiss_elim") return false;
  if (currentPhase !== "elimination" || advancingPlayerCount <= 0) return false;

  return previousPhase === undefined
    || previousPhase === null
    || previousPhase === "swiss"
    || previousPhase === "cutoff";
}
