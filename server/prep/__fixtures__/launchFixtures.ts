import type { Color, Provider, RawGame } from "../../../shared/prepTypes.js";

const DAY_SECONDS = 86_400;

export const LEGAL_LAUNCH_LINES = {
  ruyLopez: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"],
  queensGambit: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "h6"],
  kingsIndian: ["Nf3", "Nf6", "g3", "g6", "Bg2", "Bg7", "O-O", "O-O", "d3", "d6", "e4", "e5"],
  sicilian: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e6"],
} as const;

type FixtureOptions = {
  count: number;
  provider?: Provider;
  username?: string;
  playerColor?: Color;
  newestDaysAgo?: number;
  spacingDays?: number;
  timeClasses?: Array<"rapid" | "blitz" | "bullet">;
  result?: RawGame["result"];
};

export function makeLaunchGames({
  count,
  provider = "chesscom",
  username = "sameplayer",
  playerColor = "white",
  newestDaysAgo = 10,
  spacingDays = 3,
  timeClasses = ["rapid", "blitz", "bullet"],
  result = "1-0",
}: FixtureOptions): RawGame[] {
  const now = Math.floor(Date.now() / 1000);
  const lines = Object.values(LEGAL_LAUNCH_LINES);

  return Array.from({ length: count }, (_, index) => {
    const line = lines[index % lines.length];
    const scoutedIsWhite = playerColor === "white";
    const gameResult = scoutedIsWhite ? result : result === "1-0" ? "0-1" : result === "0-1" ? "1-0" : result;
    const suffix = `${provider}-${index}`;
    return {
      provider,
      url: provider === "lichess"
        ? `https://lichess.org/${String(index).padStart(8, "a")}`
        : `https://www.chess.com/game/live/${10_000 + index}`,
      rated: true,
      rules: "chess",
      timeClass: timeClasses[index % timeClasses.length],
      endTime: now - (newestDaysAgo + index * spacingDays) * DAY_SECONDS,
      white: {
        name: scoutedIsWhite ? username : `opponent-${suffix}`,
        rating: provider === "lichess" ? 3168 : 1842,
        result: gameResult === "1-0" ? "win" : gameResult === "1/2-1/2" ? "agreed" : "resigned",
      },
      black: {
        name: scoutedIsWhite ? `opponent-${suffix}` : username,
        rating: provider === "lichess" ? 3075 : 1764,
        result: gameResult === "0-1" ? "win" : gameResult === "1/2-1/2" ? "agreed" : "resigned",
      },
      result: gameResult,
      sans: [...line],
    } satisfies RawGame;
  });
}

export const EVIDENCE_FIXTURES = {
  three: makeLaunchGames({ count: 3 }),
  six: makeLaunchGames({ count: 6 }),
  eight: makeLaunchGames({ count: 8 }),
  twentyRecent: makeLaunchGames({ count: 20 }),
  twentyStale: makeLaunchGames({ count: 20, newestDaysAgo: 550, spacingDays: 7 }),
  sameNameChesscom: makeLaunchGames({ count: 8, provider: "chesscom", username: "SamePlayer" }),
  sameNameLichess: makeLaunchGames({ count: 8, provider: "lichess", username: "sameplayer" }),
};
