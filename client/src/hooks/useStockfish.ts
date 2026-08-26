/**
 * useStockfish — Browser-side Stockfish WASM engine hook.
 *
 * Loads stockfish-18-lite (multi-threaded) via a Web Worker and provides:
 *  - `evaluate(fen)` — returns the best move + centipawn eval (single PV)
 *  - `evaluateMultiPV(fen, pvCount)` — returns top N moves with scores for arrow overlays
 *
 * Multi-threaded build requires Cross-Origin Isolation (COOP/COEP headers) for
 * SharedArrayBuffer support. Falls back to the single-threaded build automatically
 * when SharedArrayBuffer is not available.
 */
import { useRef, useCallback, useEffect, useState } from "react";

export interface StockfishEval {
  bestMove: string;
  /** Centipawns from White's perspective. +100 = White is up ~1 pawn. */
  cp: number;
  /** Mate in N (positive = White mates, negative = Black mates). null if no forced mate. */
  mate: number | null;
  depth: number;
  /** Number of threads used for this evaluation */
  threads?: number;
}

export interface PVLine {
  /** Move in UCI notation e.g. "e2e4" */
  move: string;
  /** Centipawns from White's perspective */
  cp: number;
  /** Mate in N, null if no forced mate */
  mate: number | null;
  /** Search depth reached */
  depth: number;
  /** Rank: 1 = best, 2 = second best, etc. */
  rank: number;
}

/** Detect if SharedArrayBuffer is available (required for multi-threaded WASM) */
function isSharedArrayBufferAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;
  } catch {
    return false;
  }
}

const SF_MULTI_URL = "/stockfish/stockfish-18-lite.js";
// The Stockfish browser worker reads its WASM location from the worker URL hash.
// Without this explicit value it derives a missing sibling `.wasm` file and receives
// the development server's HTML fallback instead of WebAssembly bytes.
const SF_SINGLE_URL = "/stockfish/stockfish-18-lite-single.js#/manus-storage/stockfish-18-lite-single_0c19ffd3.wasm,worker";

/** Number of threads to use — cap at 4 to avoid overwhelming mobile devices */
function getThreadCount(): number {
  const cores = navigator.hardwareConcurrency ?? 2;
  return Math.min(Math.max(cores - 1, 1), 4);
}

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [isMultiThreaded, setIsMultiThreaded] = useState(false);
  const [threadCount, setThreadCount] = useState(1);

  // Single-PV pending callback
  const pendingRef = useRef<{
    resolve: (val: StockfishEval) => void;
    reject: (err: Error) => void;
  } | null>(null);

  // Multi-PV pending callback
  const multiPVPendingRef = useRef<{
    resolve: (val: PVLine[]) => void;
    reject: (err: Error) => void;
    pvCount: number;
    lines: Map<number, PVLine>;
  } | null>(null);

  const evalCacheRef = useRef<Map<string, StockfishEval>>(new Map());
  const multiPVCacheRef = useRef<Map<string, PVLine[]>>(new Map());

  // Initialize worker
  useEffect(() => {
    let cancelled = false;
    const multiThread = isSharedArrayBufferAvailable();
    const sfUrl = multiThread ? SF_MULTI_URL : SF_SINGLE_URL;
    const threads = multiThread ? getThreadCount() : 1;

    const worker = new Worker(sfUrl);
    workerRef.current = worker;

    let bestMove = "";
    let cp = 0;
    let mate: number | null = null;
    let depth = 0;
    let initialized = false;

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";

      if (line === "uciok") {
        // Configure threads and hash size after UCI handshake
        if (multiThread && threads > 1) {
          worker.postMessage(`setoption name Threads value ${threads}`);
        }
        // Set hash table size: 64 MB for multi-thread, 16 MB for single
        worker.postMessage(`setoption name Hash value ${multiThread ? 64 : 16}`);
        worker.postMessage("isready");
      }

      if (line.includes("readyok") && !initialized) {
        initialized = true;
        if (!cancelled) {
          setReady(true);
          setIsMultiThreaded(multiThread);
          setThreadCount(threads);
        }
      }

      // ── Multi-PV parsing ────────────────────────────────────────────────────
      if (multiPVPendingRef.current && line.startsWith("info") && line.includes("multipv")) {
        const pvMatch = line.match(/multipv (\d+)/);
        const depthMatch = line.match(/depth (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch2 = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);

        if (pvMatch && pvMatch2) {
          const rank = parseInt(pvMatch[1], 10);
          const pvDepth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
          const pvCp = cpMatch ? parseInt(cpMatch[1], 10) : 0;
          const pvMate = mateMatch ? parseInt(mateMatch[1], 10) : null;
          const pvMove = pvMatch2[1];

          multiPVPendingRef.current.lines.set(rank, {
            move: pvMove,
            cp: pvMate !== null ? (pvMate > 0 ? 10000 : -10000) : pvCp,
            mate: pvMate,
            depth: pvDepth,
            rank,
          });
        }
      }

      // ── Single-PV parsing ───────────────────────────────────────────────────
      if (!multiPVPendingRef.current && line.startsWith("info") && line.includes("score")) {
        const depthMatch = line.match(/depth (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (depthMatch) depth = parseInt(depthMatch[1], 10);
        if (cpMatch) { cp = parseInt(cpMatch[1], 10); mate = null; }
        if (mateMatch) { mate = parseInt(mateMatch[1], 10); cp = mate > 0 ? 10000 : -10000; }
      }

      // ── bestmove signal ─────────────────────────────────────────────────────
      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        bestMove = parts[1] || "";

        // Resolve Multi-PV
        if (multiPVPendingRef.current) {
          const { resolve, lines, pvCount } = multiPVPendingRef.current;
          multiPVPendingRef.current = null;
          const result: PVLine[] = [];
          for (let i = 1; i <= pvCount; i++) {
            const pvLine = lines.get(i);
            if (pvLine) result.push(pvLine);
          }
          resolve(result);
          return;
        }

        // Resolve Single-PV
        if (pendingRef.current) {
          const result: StockfishEval = { bestMove, cp, mate, depth, threads };
          pendingRef.current.resolve(result);
          pendingRef.current = null;
        }
      }
    };

    worker.onerror = (err) => {
      console.warn("Stockfish worker error:", err);
      if (pendingRef.current) {
        pendingRef.current.reject(new Error("Stockfish worker error"));
        pendingRef.current = null;
      }
      if (multiPVPendingRef.current) {
        multiPVPendingRef.current.reject(new Error("Stockfish worker error"));
        multiPVPendingRef.current = null;
      }
    };

    // Initialize UCI
    worker.postMessage("uci");

    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  /** Evaluate a position and return the single best move + score */
  const evaluate = useCallback(
    (fen: string, depthLimit = 18): Promise<StockfishEval> => {
      const cached = evalCacheRef.current.get(fen);
      if (cached && cached.depth >= depthLimit) return Promise.resolve(cached);

      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) { reject(new Error("Stockfish not initialized")); return; }

        // Cancel any pending eval
        if (pendingRef.current) {
          worker.postMessage("stop");
          pendingRef.current.reject(new Error("Cancelled"));
          pendingRef.current = null;
        }
        if (multiPVPendingRef.current) {
          worker.postMessage("stop");
          multiPVPendingRef.current.reject(new Error("Cancelled"));
          multiPVPendingRef.current = null;
          // Reset MultiPV to 1 for single-PV mode
          worker.postMessage("setoption name MultiPV value 1");
        }

        pendingRef.current = {
          resolve: (val) => { evalCacheRef.current.set(fen, val); resolve(val); },
          reject,
        };

        worker.postMessage("setoption name MultiPV value 1");
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depthLimit}`);
      });
    },
    []
  );

  /**
   * Evaluate a position and return the top N moves with scores.
   * Used to generate arrow overlays on the board.
   */
  const evaluateMultiPV = useCallback(
    (fen: string, pvCount = 3, depthLimit = 16): Promise<PVLine[]> => {
      const cacheKey = `${fen}:${pvCount}`;
      const cached = multiPVCacheRef.current.get(cacheKey);
      if (cached && cached[0]?.depth >= depthLimit) return Promise.resolve(cached);

      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) { reject(new Error("Stockfish not initialized")); return; }

        // Cancel any pending eval
        if (pendingRef.current) {
          worker.postMessage("stop");
          pendingRef.current.reject(new Error("Cancelled"));
          pendingRef.current = null;
        }
        if (multiPVPendingRef.current) {
          worker.postMessage("stop");
          multiPVPendingRef.current.reject(new Error("Cancelled"));
          multiPVPendingRef.current = null;
        }

        multiPVPendingRef.current = {
          resolve: (val) => { multiPVCacheRef.current.set(cacheKey, val); resolve(val); },
          reject,
          pvCount,
          lines: new Map(),
        };

        worker.postMessage(`setoption name MultiPV value ${pvCount}`);
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depthLimit}`);
      });
    },
    []
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
  }, []);

  return { ready, evaluate, evaluateMultiPV, stop, isMultiThreaded, threadCount };
}
