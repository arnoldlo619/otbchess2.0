/**
 * useStockfish — Browser-side Stockfish WASM engine hook.
 *
 * Loads stockfish-18-lite (multi-threaded) via a Web Worker and provides a
 * simple `evaluate(fen)` function that returns the best move and centipawn eval.
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

/** Detect if SharedArrayBuffer is available (required for multi-threaded WASM) */
function isSharedArrayBufferAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

const SF_MULTI_URL = "/stockfish/stockfish-18-lite.js";
const SF_SINGLE_URL = "/stockfish/stockfish-18-lite-single.js";

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
  const pendingRef = useRef<{
    resolve: (val: StockfishEval) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const evalCacheRef = useRef<Map<string, StockfishEval>>(new Map());

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

      // Parse "info depth N ... score cp X" or "info depth N ... score mate X"
      if (line.startsWith("info") && line.includes("score")) {
        const depthMatch = line.match(/depth (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        if (depthMatch) depth = parseInt(depthMatch[1], 10);
        if (cpMatch) {
          cp = parseInt(cpMatch[1], 10);
          mate = null;
        }
        if (mateMatch) {
          mate = parseInt(mateMatch[1], 10);
          cp = mate > 0 ? 10000 : -10000;
        }
      }

      // Parse "bestmove e2e4 ..."
      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        bestMove = parts[1] || "";
        const result: StockfishEval = { bestMove, cp, mate, depth, threads };
        if (pendingRef.current) {
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
    };

    // Initialize UCI
    worker.postMessage("uci");

    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const evaluate = useCallback(
    (fen: string, depthLimit = 18): Promise<StockfishEval> => {
      // Check cache
      const cached = evalCacheRef.current.get(fen);
      if (cached && cached.depth >= depthLimit) return Promise.resolve(cached);

      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Stockfish not initialized"));
          return;
        }

        // Cancel any pending eval
        if (pendingRef.current) {
          worker.postMessage("stop");
          pendingRef.current.reject(new Error("Cancelled"));
          pendingRef.current = null;
        }

        pendingRef.current = {
          resolve: (val) => {
            evalCacheRef.current.set(fen, val);
            resolve(val);
          },
          reject,
        };

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

  return { ready, evaluate, stop, isMultiThreaded, threadCount };
}
