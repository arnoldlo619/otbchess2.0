// src/types.ts — ChessOTB Scouting Report MVP: shared contracts
export type Provider = "chesscom" | "lichess";
export type Color = "white" | "black";

/** Normalized game: both providers converge to this before parsing. */
export interface RawGame {
  provider: Provider;
  url: string;
  rated: boolean;
  rules: string;              // "chess" | "chess960" | ... (lichess variant maps here)
  timeClass: string;          // rapid | blitz | bullet | classical | daily
  endTime: number;            // epoch seconds
  white: { name: string; rating: number | null; result: string };
  black: { name: string; rating: number | null; result: string };
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  sans: string[];             // SAN tokens, headers/comments/NAGs already stripped
}

export interface ParsedGame extends RawGame {
  plies: { san: string; epd: string; by: Color }[];
  fullMoves: number;
  opening: { eco: string; name: string; bookExitPly: number };
  scoutedColor: Color;
  scoutedScore: 0 | 0.5 | 1;
}

export interface Insight {
  id: string;
  kind: "opening_tendency" | "response_pattern" | "weakness" | "strength"
      | "deviation_point" | "behavior" | "game_plan";
  color: Color;                       // scouted player's color for this insight
  role: "plays" | "faces";
  claim: string;
  evidence: {
    stat: string;
    games: { url: string; date: string; result: "W" | "D" | "L" }[]; // 1–5
    window: { from: string; to: string; timeClasses: string[]; ratedOnly: boolean };
  };
  interpretation: string;
  recommendation: { action: string; line?: { san: string; eco?: string; validated: true } };
  confidence: "low" | "medium" | "medium_high" | "high";
  sampleSize: number;
  baseline?: { metric: string; value: number; delta: number };
  ply?: number;                       // deviation points only (0-indexed)
}

export interface ScoutReportV3 {
  version: 3;
  engineVersion: string;
  provider: Provider;
  opponent: {
    username: string;
    record: Record<Color, { w: number; d: number; l: number }>;
    avgRating: number | null;
    timeControlSplit: Record<string, { games: number; score: number }>;
  };
  dataQuality: {
    requested: number; fetched: number; parsed: number; quarantined: number;
    excluded: Record<string, number>;
    ratedShare: number;
    window: { from: string; to: string };
    grade: "A" | "B" | "C" | "D";
    notes: string[];
  };
  openingForecast: Record<Color, ForecastBranch[]>;
  insights: Insight[];
  sections: {
    matchupSummary: string[]; strengths: string[]; weaknesses: string[]; weakSignals: string[];
    ifYouHaveWhite: string[]; ifYouHaveBlack: string[];
    deviationPoints: string[]; behavior: string[];
    prepChecklist: { text: string; insightId: string }[];
  };
  guardLog: { droppedInsights: number; reasons: Record<string, number> };
  generatedAt: string;
}

export interface ForecastBranch {
  moveSan: string; count: number; pct: number; score: number;
  label?: string; children: ForecastBranch[];
}
