export interface PlatformStats {
  tournaments: number;
  players: number;
  clubs: number;
}

function normalizeCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function normalizePlatformStats(data: Partial<PlatformStats> | null | undefined): PlatformStats {
  return {
    tournaments: normalizeCount(data?.tournaments),
    players: normalizeCount(data?.players),
    clubs: normalizeCount(data?.clubs),
  };
}
