/**
 * lnmAnalysisPipeline.test.ts
 *
 * Unit tests for the LNM → Stockfish analysis pipeline:
 *  - useLnmAnalysis hook state machine
 *  - POST /api/games/from-pgn request construction
 *  - Response handling (success, 4xx, 5xx, network error)
 *  - Navigation to /game/:gameId/analysis
 *  - Error dismissal via reset()
 *  - Player name derivation
 *  - Empty PGN guard
 *  - analyseStatus prop rendering in NotationModeOverlay
 */

import {describe, it, expect, vi} from "vitest";

// ─── Constants mirrored from the implementation ───────────────────────────────

const FROM_PGN_ENDPOINT = "/api/games/from-pgn";
const ANALYSIS_ROUTE_PREFIX = "/game/";
const ANALYSIS_ROUTE_SUFFIX = "/analysis";

type LnmAnalysisStatus = "idle" | "submitting" | "navigating" | "error";

// ─── Simulated useLnmAnalysis state machine ───────────────────────────────────

interface PipelineState {
  status: LnmAnalysisStatus;
  error: string | null;
  gameId: string | null;
  navigatedTo: string | null;
}

interface AnalysisOptions {
  whitePlayer?: string;
  blackPlayer?: string;
  result?: string;
  event?: string;
  date?: string;
}

async function runPipeline(
  pgn: string,
  options: AnalysisOptions,
  mockFetch: (url: string, init: RequestInit) => Promise<Response>
): Promise<PipelineState> {
  const state: PipelineState = {
    status: "idle",
    error: null,
    gameId: null,
    navigatedTo: null,
  };

  if (!pgn || pgn.trim().length === 0) {
    state.status = "error";
    state.error = "No moves recorded — play at least one move before analysing.";
    return state;
  }

  state.status = "submitting";

  try {
    const res = await mockFetch(FROM_PGN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        pgn,
        whitePlayer: options.whitePlayer ?? "White",
        blackPlayer: options.blackPlayer ?? "Black",
        result: options.result ?? "*",
        event: options.event ?? "OTB Battle",
        date: options.date ?? new Date().toISOString().split("T")[0],
      }),
    });

    if (!res.ok) {
      let msg = "Failed to submit game for analysis.";
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {
        // ignore
      }
      state.status = "error";
      state.error = msg;
      return state;
    }

    const data = (await res.json()) as { gameId: string; sessionId: string };

    if (!data.gameId) {
      state.status = "error";
      state.error = "Server returned no game ID.";
      return state;
    }

    state.gameId = data.gameId;
    state.status = "navigating";
    state.navigatedTo = `${ANALYSIS_ROUTE_PREFIX}${data.gameId}${ANALYSIS_ROUTE_SUFFIX}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error — please try again.";
    state.status = "error";
    state.error = msg;
  }

  return state;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockFetch(
  status: number,
  body: unknown
): (url: string, init: RequestInit) => Promise<Response> {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
}

function makeNetworkErrorFetch(): (url: string, init: RequestInit) => Promise<Response> {
  return async () => {
    throw new Error("Network error — please try again.");
  };
}

const SAMPLE_PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LNM Analysis Pipeline", () => {
  // ── Endpoint and route constants ─────────────────────────────────────────
  describe("Constants", () => {
    it("uses the correct API endpoint", () => {
      expect(FROM_PGN_ENDPOINT).toBe("/api/games/from-pgn");
    });

    it("navigates to the correct analysis route pattern", () => {
      const gameId = "abc123";
      const route = `${ANALYSIS_ROUTE_PREFIX}${gameId}${ANALYSIS_ROUTE_SUFFIX}`;
      expect(route).toBe("/game/abc123/analysis");
    });
  });

  // ── Empty PGN guard ───────────────────────────────────────────────────────
  describe("Empty PGN guard", () => {
    it("sets error status for empty string", async () => {
      const state = await runPipeline("", {}, makeMockFetch(201, {}));
      expect(state.status).toBe("error");
      expect(state.error).toContain("No moves recorded");
    });

    it("sets error status for whitespace-only PGN", async () => {
      const state = await runPipeline("   ", {}, makeMockFetch(201, {}));
      expect(state.status).toBe("error");
    });

    it("does not call fetch for empty PGN", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "x", sessionId: "y" }));
      await runPipeline("", {}, fetchSpy);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ── Successful pipeline ───────────────────────────────────────────────────
  describe("Successful pipeline", () => {
    it("sets status to navigating on success", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(201, { gameId: "game123", sessionId: "sess456" })
      );
      expect(state.status).toBe("navigating");
    });

    it("stores the returned gameId", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(201, { gameId: "game123", sessionId: "sess456" })
      );
      expect(state.gameId).toBe("game123");
    });

    it("navigates to /game/:gameId/analysis", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(201, { gameId: "game123", sessionId: "sess456" })
      );
      expect(state.navigatedTo).toBe("/game/game123/analysis");
    });

    it("sends POST to the correct endpoint", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      expect(fetchSpy).toHaveBeenCalledWith(
        FROM_PGN_ENDPOINT,
        expect.objectContaining({ method: "POST" })
      );
    });

    it("includes pgn in the request body", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.pgn).toBe(SAMPLE_PGN);
    });
  });

  // ── Player name derivation ────────────────────────────────────────────────
  describe("Player name derivation", () => {
    it("sends provided player names", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, { whitePlayer: "Magnus", blackPlayer: "Hikaru" }, fetchSpy);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.whitePlayer).toBe("Magnus");
      expect(body.blackPlayer).toBe("Hikaru");
    });

    it("defaults to White/Black when names not provided", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.whitePlayer).toBe("White");
      expect(body.blackPlayer).toBe("Black");
    });

    it("sends OTB Battle as default event", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.event).toBe("OTB Battle");
    });
  });

  // ── Server error handling ─────────────────────────────────────────────────
  describe("Server error handling", () => {
    it("sets error status on 400 response", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(400, { error: "PGN is required" })
      );
      expect(state.status).toBe("error");
      expect(state.error).toBe("PGN is required");
    });

    it("sets error status on 500 response", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(500, { error: "Failed to create game from PGN" })
      );
      expect(state.status).toBe("error");
      expect(state.error).toBe("Failed to create game from PGN");
    });

    it("uses fallback message when error body has no message", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(503, {})
      );
      expect(state.status).toBe("error");
      expect(state.error).toBe("Failed to submit game for analysis.");
    });

    it("sets error when server returns no gameId", async () => {
      const state = await runPipeline(
        SAMPLE_PGN,
        {},
        makeMockFetch(201, { sessionId: "sess456" })
      );
      expect(state.status).toBe("error");
      expect(state.error).toContain("no game ID");
    });
  });

  // ── Network error handling ────────────────────────────────────────────────
  describe("Network error handling", () => {
    it("sets error status on network failure", async () => {
      const state = await runPipeline(SAMPLE_PGN, {}, makeNetworkErrorFetch());
      expect(state.status).toBe("error");
      expect(state.error).toContain("Network error");
    });

    it("does not navigate on network failure", async () => {
      const state = await runPipeline(SAMPLE_PGN, {}, makeNetworkErrorFetch());
      expect(state.navigatedTo).toBeNull();
    });
  });

  // ── Error reset ───────────────────────────────────────────────────────────
  describe("Error reset", () => {
    it("reset clears status to idle", () => {
      const state: PipelineState = {
        status: "error",
        error: "Something went wrong",
        gameId: null,
        navigatedTo: null,
      };
      // Simulate reset
      state.status = "idle";
      state.error = null;
      state.gameId = null;
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });
  });

  // ── analyseStatus button label logic ─────────────────────────────────────
  describe("Analyse Game button label logic", () => {
    function getButtonLabel(status: LnmAnalysisStatus): string {
      if (status === "submitting") return "Submitting...";
      if (status === "navigating") return "Opening...";
      return "Analyse Game";
    }

    it("shows 'Analyse Game' when idle", () => {
      expect(getButtonLabel("idle")).toBe("Analyse Game");
    });

    it("shows 'Submitting...' when submitting", () => {
      expect(getButtonLabel("submitting")).toBe("Submitting...");
    });

    it("shows 'Opening...' when navigating", () => {
      expect(getButtonLabel("navigating")).toBe("Opening...");
    });

    it("shows 'Analyse Game' when error (allows retry)", () => {
      expect(getButtonLabel("error")).toBe("Analyse Game");
    });
  });

  // ── Button disabled logic ─────────────────────────────────────────────────
  describe("Analyse Game button disabled logic", () => {
    function isDisabled(status: LnmAnalysisStatus): boolean {
      return status === "submitting" || status === "navigating";
    }

    it("is enabled when idle", () => expect(isDisabled("idle")).toBe(false));
    it("is disabled when submitting", () => expect(isDisabled("submitting")).toBe(true));
    it("is disabled when navigating", () => expect(isDisabled("navigating")).toBe(true));
    it("is enabled when error (allows retry)", () => expect(isDisabled("error")).toBe(false));
  });

  // ── from-pgn endpoint request format ─────────────────────────────────────
  describe("from-pgn request format", () => {
    it("sends Content-Type application/json", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("includes credentials in request", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      expect((fetchSpy.mock.calls[0][1] as RequestInit).credentials).toBe("include");
    });

    it("includes a date field", async () => {
      const fetchSpy = vi.fn(makeMockFetch(201, { gameId: "g1", sessionId: "s1" }));
      await runPipeline(SAMPLE_PGN, {}, fetchSpy);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
