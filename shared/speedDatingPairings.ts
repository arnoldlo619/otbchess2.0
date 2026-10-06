export interface SpeedDatingPairingPlan {
  boardNumber: number;
  whiteUserId: string;
  blackUserId: string;
}

const BYE = "__speed_dating_bye__";

/**
 * Builds one deterministic social round using the circle method. Every player
 * receives a new opponent until the roster has exhausted its unique pairings;
 * additional configured rounds repeat in the same stable order. An odd roster
 * rotates a bye without creating a fake table.
 */
export function createSpeedDatingRound(
  participantIds: readonly string[],
  roundNumber: number
): SpeedDatingPairingPlan[] {
  const roster = Array.from(new Set(participantIds.filter(Boolean))).sort();
  if (roster.length < 2 || !Number.isInteger(roundNumber) || roundNumber < 1) {
    return [];
  }

  const wheel = roster.length % 2 === 0 ? [...roster] : [...roster, BYE];
  const rotations = (roundNumber - 1) % (wheel.length - 1);

  for (let step = 0; step < rotations; step += 1) {
    const last = wheel.pop();
    if (last) wheel.splice(1, 0, last);
  }

  const pairings: SpeedDatingPairingPlan[] = [];
  for (let index = 0; index < wheel.length / 2; index += 1) {
    const first = wheel[index];
    const second = wheel[wheel.length - 1 - index];
    if (first === BYE || second === BYE) continue;

    const invertColors = (roundNumber + index) % 2 === 0;
    pairings.push({
      boardNumber: pairings.length + 1,
      whiteUserId: invertColors ? second : first,
      blackUserId: invertColors ? first : second,
    });
  }

  return pairings;
}

export function getSpeedDatingRoundCapacity(participantCount: number): number {
  if (participantCount < 2) return 0;
  // An odd roster includes a rotating bye in the circle method, which adds one
  // round while still letting every player meet every other player once.
  return participantCount % 2 === 0 ? participantCount - 1 : participantCount;
}
