/**
 * Tests for Step 3: Surface CV Failure in Processing Screen
 *
 * Covers:
 *  - cvJobError state derivation logic
 *  - Failure detection from API response
 *  - Retry vs exhausted state transitions
 *  - UI state mapping (icon, title, subtitle, actions)
 *  - Error detail card visibility
 *  - Manual PGN entry CTA navigation
 */
import { describe, it, expect } from "vitest";

// ── Helper types matching the component's internal types ──────────────────────

interface CvJobResponse {
  status: string;
  errorMessage: string | null;
  attempts: number | null;
}

interface CvJobError {
  failed: boolean;
  errorMessage: string | null;
  attempts: number;
  retriesExhausted: boolean;
}

// ── Pure logic extracted from the component for testing ───────────────────────

/** Derives cvJobError state from the API response's cvJob field */
function deriveCvJobError(cvJob: CvJobResponse | null | undefined): CvJobError | null {
  if (!cvJob) return null;
  if (cvJob.status !== "failed") return null;
  const attempts = cvJob.attempts ?? 1;
  return {
    failed: true,
    errorMessage: cvJob.errorMessage,
    attempts,
    retriesExhausted: attempts >= 3,
  };
}

/** Determines the processing screen visual state */
function getProcessingScreenState(
  processingStep: number,
  gameId: string | null,
  cvJobError: CvJobError | null
): "ready" | "failed" | "processing" {
  const isReady = processingStep >= 4 && !!gameId;
  const isFailed = cvJobError?.failed && cvJobError.retriesExhausted;
  if (isReady) return "ready";
  if (isFailed) return "failed";
  return "processing";
}

/** Determines what icon to show */
function getIconType(state: "ready" | "failed" | "processing"): string {
  if (state === "ready") return "CheckCircle2";
  if (state === "failed") return "XCircle";
  return "Loader2";
}

/** Determines the icon background class */
function getIconBg(state: "ready" | "failed" | "processing"): string {
  if (state === "ready") return "bg-[#4CAF50]/20 border border-[#4CAF50]/40";
  if (state === "failed") return "bg-red-500/15 border border-red-500/30";
  return "bg-white/06 border border-white/10";
}

/** Determines the title text */
function getTitle(state: "ready" | "failed" | "processing"): string {
  if (state === "ready") return "Analysis Ready!";
  if (state === "failed") return "Analysis Failed";
  return "Processing Game\u2026";
}

/** Determines whether progress steps should be visible */
function showProgressSteps(state: "ready" | "failed" | "processing"): boolean {
  return state !== "failed";
}

/** Determines whether the CV progress bar should be visible */
function showCvProgressBar(
  state: "ready" | "failed" | "processing",
  cvProgressFound: boolean
): boolean {
  return cvProgressFound && state === "processing";
}

/** Determines whether the error detail card should be visible */
function showErrorDetailCard(cvJobError: CvJobError | null): boolean {
  return !!(cvJobError?.failed && cvJobError.retriesExhausted && cvJobError.errorMessage);
}

/** Determines whether the amber retry indicator should be visible */
function showRetryIndicator(cvJobError: CvJobError | null): boolean {
  return !!(cvJobError?.failed && !cvJobError.retriesExhausted);
}

/** Builds the manual PGN entry URL with sessionId */
function buildManualPgnUrl(sessionId: string | null): string {
  return sessionId ? `/record?sessionId=${sessionId}` : "/record";
}

/** Determines which action buttons to show */
function getActionButtons(state: "ready" | "failed" | "processing"): string[] {
  if (state === "ready") return ["View Analysis"];
  if (state === "failed") return ["Enter PGN Manually", "Go home"];
  return ["Go home — I'll come back later", "Enter PGN manually instead"];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deriveCvJobError", () => {
  it("returns null when cvJob is null", () => {
    expect(deriveCvJobError(null)).toBeNull();
  });

  it("returns null when cvJob is undefined", () => {
    expect(deriveCvJobError(undefined)).toBeNull();
  });

  it("returns null when cvJob status is 'running'", () => {
    expect(deriveCvJobError({ status: "running", errorMessage: null, attempts: 1 })).toBeNull();
  });

  it("returns null when cvJob status is 'pending'", () => {
    expect(deriveCvJobError({ status: "pending", errorMessage: null, attempts: 0 })).toBeNull();
  });

  it("returns null when cvJob status is 'complete'", () => {
    expect(deriveCvJobError({ status: "complete", errorMessage: null, attempts: 1 })).toBeNull();
  });

  it("returns error state when cvJob status is 'failed' with 1 attempt", () => {
    const result = deriveCvJobError({
      status: "failed",
      errorMessage: "Board not detected in any frame",
      attempts: 1,
    });
    expect(result).toEqual({
      failed: true,
      errorMessage: "Board not detected in any frame",
      attempts: 1,
      retriesExhausted: false,
    });
  });

  it("returns error state when cvJob status is 'failed' with 2 attempts", () => {
    const result = deriveCvJobError({
      status: "failed",
      errorMessage: "Timeout exceeded",
      attempts: 2,
    });
    expect(result).toEqual({
      failed: true,
      errorMessage: "Timeout exceeded",
      attempts: 2,
      retriesExhausted: false,
    });
  });

  it("marks retriesExhausted when attempts >= 3", () => {
    const result = deriveCvJobError({
      status: "failed",
      errorMessage: "No legal moves found",
      attempts: 3,
    });
    expect(result).toEqual({
      failed: true,
      errorMessage: "No legal moves found",
      attempts: 3,
      retriesExhausted: true,
    });
  });

  it("marks retriesExhausted when attempts > 3", () => {
    const result = deriveCvJobError({
      status: "failed",
      errorMessage: null,
      attempts: 5,
    });
    expect(result?.retriesExhausted).toBe(true);
  });

  it("defaults attempts to 1 when null", () => {
    const result = deriveCvJobError({
      status: "failed",
      errorMessage: "Unknown error",
      attempts: null,
    });
    expect(result?.attempts).toBe(1);
    expect(result?.retriesExhausted).toBe(false);
  });

  it("handles null errorMessage", () => {
    const result = deriveCvJobError({
      status: "failed",
      errorMessage: null,
      attempts: 3,
    });
    expect(result?.errorMessage).toBeNull();
    expect(result?.retriesExhausted).toBe(true);
  });
});

describe("getProcessingScreenState", () => {
  it("returns 'ready' when step >= 4 and gameId exists", () => {
    expect(getProcessingScreenState(4, "game-123", null)).toBe("ready");
  });

  it("returns 'ready' when step is 5 and gameId exists", () => {
    expect(getProcessingScreenState(5, "game-456", null)).toBe("ready");
  });

  it("returns 'processing' when step < 4", () => {
    expect(getProcessingScreenState(2, null, null)).toBe("processing");
  });

  it("returns 'processing' when step >= 4 but no gameId", () => {
    expect(getProcessingScreenState(4, null, null)).toBe("processing");
  });

  it("returns 'failed' when cvJobError has retriesExhausted", () => {
    expect(getProcessingScreenState(2, null, {
      failed: true,
      errorMessage: "Error",
      attempts: 3,
      retriesExhausted: true,
    })).toBe("failed");
  });

  it("returns 'processing' when cvJobError exists but retries not exhausted", () => {
    expect(getProcessingScreenState(2, null, {
      failed: true,
      errorMessage: "Error",
      attempts: 1,
      retriesExhausted: false,
    })).toBe("processing");
  });

  it("'ready' takes priority over 'failed'", () => {
    // If somehow both conditions are true, ready wins
    expect(getProcessingScreenState(4, "game-123", {
      failed: true,
      errorMessage: "Error",
      attempts: 3,
      retriesExhausted: true,
    })).toBe("ready");
  });
});

describe("getIconType", () => {
  it("returns CheckCircle2 for ready state", () => {
    expect(getIconType("ready")).toBe("CheckCircle2");
  });

  it("returns XCircle for failed state", () => {
    expect(getIconType("failed")).toBe("XCircle");
  });

  it("returns Loader2 for processing state", () => {
    expect(getIconType("processing")).toBe("Loader2");
  });
});

describe("getIconBg", () => {
  it("returns green bg for ready state", () => {
    expect(getIconBg("ready")).toContain("#4CAF50");
  });

  it("returns red bg for failed state", () => {
    expect(getIconBg("failed")).toContain("red-500");
  });

  it("returns neutral bg for processing state", () => {
    expect(getIconBg("processing")).toContain("white/06");
  });
});

describe("getTitle", () => {
  it("returns 'Analysis Ready!' for ready state", () => {
    expect(getTitle("ready")).toBe("Analysis Ready!");
  });

  it("returns 'Analysis Failed' for failed state", () => {
    expect(getTitle("failed")).toBe("Analysis Failed");
  });

  it("returns 'Processing Game…' for processing state", () => {
    expect(getTitle("processing")).toContain("Processing Game");
  });
});

describe("showProgressSteps", () => {
  it("shows steps during processing", () => {
    expect(showProgressSteps("processing")).toBe(true);
  });

  it("shows steps when ready", () => {
    expect(showProgressSteps("ready")).toBe(true);
  });

  it("hides steps when failed", () => {
    expect(showProgressSteps("failed")).toBe(false);
  });
});

describe("showCvProgressBar", () => {
  it("shows when processing and cv progress found", () => {
    expect(showCvProgressBar("processing", true)).toBe(true);
  });

  it("hides when ready even if cv progress found", () => {
    expect(showCvProgressBar("ready", true)).toBe(false);
  });

  it("hides when failed even if cv progress found", () => {
    expect(showCvProgressBar("failed", true)).toBe(false);
  });

  it("hides when processing but no cv progress", () => {
    expect(showCvProgressBar("processing", false)).toBe(false);
  });
});

describe("showErrorDetailCard", () => {
  it("shows when failed, retries exhausted, and errorMessage exists", () => {
    expect(showErrorDetailCard({
      failed: true,
      errorMessage: "Board not detected",
      attempts: 3,
      retriesExhausted: true,
    })).toBe(true);
  });

  it("hides when errorMessage is null", () => {
    expect(showErrorDetailCard({
      failed: true,
      errorMessage: null,
      attempts: 3,
      retriesExhausted: true,
    })).toBe(false);
  });

  it("hides when retries not exhausted", () => {
    expect(showErrorDetailCard({
      failed: true,
      errorMessage: "Error",
      attempts: 1,
      retriesExhausted: false,
    })).toBe(false);
  });

  it("hides when cvJobError is null", () => {
    expect(showErrorDetailCard(null)).toBe(false);
  });
});

describe("showRetryIndicator", () => {
  it("shows when failed but retries not exhausted", () => {
    expect(showRetryIndicator({
      failed: true,
      errorMessage: "Error",
      attempts: 1,
      retriesExhausted: false,
    })).toBe(true);
  });

  it("hides when retries exhausted", () => {
    expect(showRetryIndicator({
      failed: true,
      errorMessage: "Error",
      attempts: 3,
      retriesExhausted: true,
    })).toBe(false);
  });

  it("hides when cvJobError is null", () => {
    expect(showRetryIndicator(null)).toBe(false);
  });
});

describe("buildManualPgnUrl", () => {
  it("includes sessionId when provided", () => {
    expect(buildManualPgnUrl("sess-abc")).toBe("/record?sessionId=sess-abc");
  });

  it("returns plain /record when sessionId is null", () => {
    expect(buildManualPgnUrl(null)).toBe("/record");
  });
});

describe("getActionButtons", () => {
  it("shows 'View Analysis' for ready state", () => {
    const buttons = getActionButtons("ready");
    expect(buttons).toEqual(["View Analysis"]);
  });

  it("shows 'Enter PGN Manually' and 'Go home' for failed state", () => {
    const buttons = getActionButtons("failed");
    expect(buttons).toContain("Enter PGN Manually");
    expect(buttons).toContain("Go home");
    expect(buttons).toHaveLength(2);
  });

  it("shows two fallback buttons for processing state", () => {
    const buttons = getActionButtons("processing");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain("come back later");
    expect(buttons[1]).toContain("PGN manually");
  });
});

describe("Full state transition scenarios", () => {
  it("scenario: CV job starts, fails once, retries, then fails permanently", () => {
    // Step 1: No CV job yet
    let error = deriveCvJobError(null);
    let state = getProcessingScreenState(2, null, error);
    expect(state).toBe("processing");
    expect(showRetryIndicator(error)).toBe(false);

    // Step 2: First attempt fails
    error = deriveCvJobError({ status: "failed", errorMessage: "Board not detected", attempts: 1 });
    state = getProcessingScreenState(2, null, error);
    expect(state).toBe("processing"); // Still processing — retries remain
    expect(showRetryIndicator(error)).toBe(true);
    expect(showErrorDetailCard(error)).toBe(false);

    // Step 3: Second attempt fails
    error = deriveCvJobError({ status: "failed", errorMessage: "Board not detected", attempts: 2 });
    state = getProcessingScreenState(2, null, error);
    expect(state).toBe("processing");
    expect(showRetryIndicator(error)).toBe(true);

    // Step 4: Third attempt fails — retries exhausted
    error = deriveCvJobError({ status: "failed", errorMessage: "Board not detected", attempts: 3 });
    state = getProcessingScreenState(2, null, error);
    expect(state).toBe("failed");
    expect(showRetryIndicator(error)).toBe(false);
    expect(showErrorDetailCard(error)).toBe(true);
    expect(getTitle(state)).toBe("Analysis Failed");
    expect(getActionButtons(state)).toContain("Enter PGN Manually");
  });

  it("scenario: CV job fails once then succeeds on retry", () => {
    // First attempt fails
    let error = deriveCvJobError({ status: "failed", errorMessage: "Timeout", attempts: 1 });
    expect(showRetryIndicator(error)).toBe(true);

    // Retry is running
    error = deriveCvJobError({ status: "running", errorMessage: null, attempts: 1 });
    expect(error).toBeNull(); // No error while running

    // Retry succeeds — game is ready
    error = deriveCvJobError({ status: "complete", errorMessage: null, attempts: 2 });
    expect(error).toBeNull();
    const state = getProcessingScreenState(4, "game-123", error);
    expect(state).toBe("ready");
  });

  it("scenario: successful analysis with no failures", () => {
    const error = deriveCvJobError({ status: "complete", errorMessage: null, attempts: 1 });
    expect(error).toBeNull();
    const state = getProcessingScreenState(4, "game-abc", null);
    expect(state).toBe("ready");
    expect(getTitle(state)).toBe("Analysis Ready!");
    expect(getActionButtons(state)).toEqual(["View Analysis"]);
  });
});
