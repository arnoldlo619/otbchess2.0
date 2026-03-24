import { useState, useEffect, useCallback } from "react";

export interface AnalysedGame {
  id: string;
  sessionId: string;
  pgn: string;
  openingName: string | null;
  openingEco: string | null;
  totalMoves: number;
  whitePlayer: string | null;
  blackPlayer: string | null;
  result: string | null;
  event: string | null;
  date: string | null;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  isPublic: number;
  shareToken: string | null;
  createdAt: string;
  sessionStatus: string;
}

export type MyAnalysedGamesStatus = "idle" | "loading" | "success" | "error";

export interface UseMyAnalysedGamesReturn {
  games: AnalysedGame[];
  status: MyAnalysedGamesStatus;
  error: string | null;
  totalCount: number;
  refresh: () => void;
}

export function useMyAnalysedGames(): UseMyAnalysedGamesReturn {
  const [games, setGames] = useState<AnalysedGame[]>([]);
  const [allGames, setAllGames] = useState<AnalysedGame[]>([]);
  const [status, setStatus] = useState<MyAnalysedGamesStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/games", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setGames([]);
          setAllGames([]);
          setStatus("success");
          return;
        }
        throw new Error(`Failed to load games (${res.status})`);
      }
      const data: AnalysedGame[] = await res.json();
      setAllGames(data);
      setGames(data.filter((g) => g.sessionStatus === "processed"));
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  return { games, status, error, totalCount: allGames.length, refresh: fetchGames };
}
