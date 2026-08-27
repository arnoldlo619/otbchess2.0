import type { ScoutAction, ScoutFreshness, ScoutReportSnapshot, ScoutReportV3 } from "./prepTypes.js";

export interface ScoutReportProjection {
  snapshot: ScoutReportSnapshot;
  opponent: {
    username: string;
    provider: ScoutReportV3["provider"];
    avgRating: number | null;
  };
  gamesAnalyzed: number;
  formatBreakdown: Array<{ format: "rapid" | "blitz" | "bullet"; games: number }>;
  gameWindow: ScoutReportV3["dataQuality"]["window"];
  freshness: ScoutFreshness;
  actions: ScoutAction[];
}

export function projectScoutReport(report: ScoutReportV3): ScoutReportProjection {
  if (!report.reportSnapshot) throw new Error("MissingScoutReportSnapshot");
  const formats = ["rapid", "blitz", "bullet"] as const;
  return {
    snapshot: report.reportSnapshot,
    opponent: {
      username: report.opponent.username,
      provider: report.reportSnapshot.activeRequest.platform,
      avgRating: report.opponent.avgRating,
    },
    gamesAnalyzed: report.dataQuality.parsed,
    formatBreakdown: formats.map(format => ({
      format,
      games: report.opponent.timeControlSplit[format]?.games ?? 0,
    })),
    gameWindow: report.dataQuality.window,
    freshness: report.freshness ?? report.dataQuality.freshness ?? "limited",
    actions: report.scoutBrief ?? [],
  };
}
