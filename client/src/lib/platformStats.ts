export interface PlatformStats {
  tournaments: number;
  players: number;
  clubs: number;
}

export const PLATFORM_STATS_FLOORS: PlatformStats = {
  tournaments: 300,
  players: 550,
  clubs: 80,
};

export function normalizePlatformStats(data: Partial<PlatformStats> | null | undefined): PlatformStats {
  return {
    tournaments: Math.max(data?.tournaments ?? 0, PLATFORM_STATS_FLOORS.tournaments),
    players: Math.max(data?.players ?? 0, PLATFORM_STATS_FLOORS.players),
    clubs: Math.max(data?.clubs ?? 0, PLATFORM_STATS_FLOORS.clubs),
  };
}
