/**
 * useGameHistory
 *
 * Manages state for the /games page: page, search, result filter, sort.
 * State is synced to URL query params so links are shareable and
 * browser back/forward navigation works correctly.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import type { AnalysedGame } from "./useMyAnalysedGames";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResultFilter = "" | "1-0" | "0-1" | "1/2-1/2";
export type SortField    = "createdAt" | "totalMoves" | "whiteAccuracy" | "blackAccuracy" | "date";
export type SortDir      = "asc" | "desc";

export interface GameHistoryParams {
  page:    number;
  limit:   number;
  search:  string;
  result:  ResultFilter;
  sortBy:  SortField;
  sortDir: SortDir;
}

export interface GameHistoryResponse {
  games: AnalysedGame[];
  total: number;
  page:  number;
  limit: number;
}

export type GameHistoryStatus = "idle" | "loading" | "success" | "error";

export interface UseGameHistoryReturn {
  // Data
  games:      AnalysedGame[];
  total:      number;
  totalPages: number;
  status:     GameHistoryStatus;
  error:      string | null;
  // Params
  params:     GameHistoryParams;
  // Setters
  setPage:    (page: number) => void;
  setSearch:  (search: string) => void;
  setResult:  (result: ResultFilter) => void;
  setSortBy:  (field: SortField) => void;
  toggleSort: (field: SortField) => void;
  refresh:    () => void;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function parseParams(search: string): GameHistoryParams {
  const p = new URLSearchParams(search);
  return {
    page:    Math.max(1, parseInt(p.get("page")  ?? "1",  10) || 1),
    limit:   Math.min(50, Math.max(1, parseInt(p.get("limit") ?? "20", 10) || 20)),
    search:  p.get("search")  ?? "",
    result:  (p.get("result") ?? "") as ResultFilter,
    sortBy:  (p.get("sortBy") ?? "createdAt") as SortField,
    sortDir: (p.get("sortDir") ?? "desc") as SortDir,
  };
}

function buildQueryString(params: GameHistoryParams): string {
  const p = new URLSearchParams();
  if (params.page    > 1)           p.set("page",    String(params.page));
  if (params.limit   !== 20)        p.set("limit",   String(params.limit));
  if (params.search)                p.set("search",  params.search);
  if (params.result)                p.set("result",  params.result);
  if (params.sortBy  !== "createdAt") p.set("sortBy",  params.sortBy);
  if (params.sortDir !== "desc")    p.set("sortDir", params.sortDir);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameHistory(): UseGameHistoryReturn {
  const [location, setLocation] = useLocation();

  // Parse initial params from URL
  const [params, setParams] = useState<GameHistoryParams>(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    return parseParams(search);
  });

  const [games,  setGames]  = useState<AnalysedGame[]>([]);
  const [total,  setTotal]  = useState(0);
  const [status, setStatus] = useState<GameHistoryStatus>("idle");
  const [error,  setError]  = useState<string | null>(null);

  // Debounce search to avoid firing on every keystroke
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchGames = useCallback(async (p: GameHistoryParams) => {
    setStatus("loading");
    setError(null);
    try {
      const qs = new URLSearchParams({
        page:    String(p.page),
        limit:   String(p.limit),
        search:  p.search,
        result:  p.result,
        sortBy:  p.sortBy,
        sortDir: p.sortDir,
      }).toString();
      const res = await fetch(`/api/games?${qs}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setGames([]);
          setTotal(0);
          setStatus("success");
          return;
        }
        throw new Error(`Failed to load games (${res.status})`);
      }
      const data: GameHistoryResponse = await res.json();
      // Handle both legacy array and new paginated shape
      if (Array.isArray(data)) {
        setGames(data as unknown as AnalysedGame[]);
        setTotal((data as unknown as AnalysedGame[]).length);
      } else {
        setGames(data.games);
        setTotal(data.total);
      }
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games");
      setStatus("error");
    }
  }, []);

  // Fetch whenever params change
  useEffect(() => {
    fetchGames(params);
  }, [params, fetchGames]);

  // ── Param setters ──────────────────────────────────────────────────────────

  const updateParams = useCallback((updates: Partial<GameHistoryParams>, resetPage = true) => {
    setParams((prev) => {
      const next: GameHistoryParams = {
        ...prev,
        ...updates,
        page: resetPage && !("page" in updates) ? 1 : (updates.page ?? prev.page),
      };
      // Sync to URL
      const qs = buildQueryString(next);
      setLocation(`/games${qs}`, { replace: true });
      return next;
    });
  }, [setLocation]);

  const setPage = useCallback((page: number) => {
    updateParams({ page }, false);
  }, [updateParams]);

  const setSearch = useCallback((search: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      updateParams({ search });
    }, 350);
  }, [updateParams]);

  const setResult = useCallback((result: ResultFilter) => {
    updateParams({ result });
  }, [updateParams]);

  const setSortBy = useCallback((sortBy: SortField) => {
    updateParams({ sortBy });
  }, [updateParams]);

  const toggleSort = useCallback((field: SortField) => {
    setParams((prev) => {
      const sortDir: SortDir = prev.sortBy === field && prev.sortDir === "desc" ? "asc" : "desc";
      const next = { ...prev, sortBy: field, sortDir, page: 1 };
      const qs = buildQueryString(next);
      setLocation(`/games${qs}`, { replace: true });
      return next;
    });
  }, [setLocation]);

  const refresh = useCallback(() => {
    fetchGames(params);
  }, [fetchGames, params]);

  const totalPages = Math.max(1, Math.ceil(total / params.limit));

  return {
    games, total, totalPages, status, error,
    params,
    setPage, setSearch, setResult, setSortBy, toggleSort, refresh,
  };
}
