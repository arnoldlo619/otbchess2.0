/**
 * Tests for the CV job progress endpoint utilities and processing screen logic.
 *
 * These tests cover:
 * - pct calculation from framesProcessed / totalFrames
 * - edge cases: zero totalFrames, framesProcessed > totalFrames, null job
 * - STATUS_TO_STEP mapping for the processing screen
 * - cvProgress state shape validation
 * - polling interval cleanup logic
 */

import { describe, it, expect } from "vitest";

// ── Utility functions mirrored from the endpoint ──────────────────────────────

/** Compute percentage from frames processed and total frames, clamped 0-100. */
function computePct(framesProcessed: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  return Math.min(100, Math.round((framesProcessed / totalFrames) * 100));
}

/** Build the cv-job API response shape. */
function buildCvJobResponse(
  jobFound: boolean,
  status: string,
  framesProcessed: number,
  totalFrames: number
) {
  return {
    jobFound,
    status,
    framesProcessed,
    totalFrames,
    pct: computePct(framesProcessed, totalFrames),
  };
}

// ── STATUS_TO_STEP mapping from VideoRecorder ─────────────────────────────────

const STATUS_TO_STEP: Record<string, number> = {
  recording: 0,
  uploading: 1,
  processing: 1,
  queued: 2,
  analyzing: 3,
  complete: 4,
  ready: 4,
  failed: 4,
};

function getStep(status: string): number {
  return STATUS_TO_STEP[status] ?? 0;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computePct", () => {
  it("returns 0 when totalFrames is 0", () => {
    expect(computePct(0, 0)).toBe(0);
  });

  it("returns 0 when totalFrames is negative", () => {
    expect(computePct(5, -1)).toBe(0);
  });

  it("returns 0 when framesProcessed is 0", () => {
    expect(computePct(0, 100)).toBe(0);
  });

  it("returns 50 for half completion", () => {
    expect(computePct(50, 100)).toBe(50);
  });

  it("returns 100 for full completion", () => {
    expect(computePct(100, 100)).toBe(100);
  });

  it("clamps to 100 when framesProcessed exceeds totalFrames", () => {
    expect(computePct(110, 100)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(computePct(1, 3)).toBe(33);
    expect(computePct(2, 3)).toBe(67);
  });

  it("handles large frame counts", () => {
    expect(computePct(450, 900)).toBe(50);
    expect(computePct(900, 900)).toBe(100);
  });

  it("handles single frame videos", () => {
    expect(computePct(1, 1)).toBe(100);
  });

  it("returns 10 for 10/100 frames", () => {
    expect(computePct(10, 100)).toBe(10);
  });

  it("returns 99 for 99/100 frames", () => {
    expect(computePct(99, 100)).toBe(99);
  });

  it("handles fractional results correctly", () => {
    expect(computePct(1, 7)).toBe(14);
    expect(computePct(3, 7)).toBe(43);
  });
});

describe("buildCvJobResponse", () => {
  it("returns jobFound: false when no job exists", () => {
    const resp = buildCvJobResponse(false, "none", 0, 0);
    expect(resp.jobFound).toBe(false);
    expect(resp.pct).toBe(0);
    expect(resp.framesProcessed).toBe(0);
    expect(resp.totalFrames).toBe(0);
  });

  it("returns correct shape for a running job", () => {
    const resp = buildCvJobResponse(true, "running", 45, 900);
    expect(resp.jobFound).toBe(true);
    expect(resp.status).toBe("running");
    expect(resp.framesProcessed).toBe(45);
    expect(resp.totalFrames).toBe(900);
    expect(resp.pct).toBe(5);
  });

  it("returns 100% for a completed job", () => {
    const resp = buildCvJobResponse(true, "complete", 900, 900);
    expect(resp.pct).toBe(100);
    expect(resp.status).toBe("complete");
  });

  it("returns 0% for a queued job with no frames processed", () => {
    const resp = buildCvJobResponse(true, "queued", 0, 0);
    expect(resp.pct).toBe(0);
  });

  it("clamps pct to 100 even if framesProcessed > totalFrames", () => {
    const resp = buildCvJobResponse(true, "complete", 950, 900);
    expect(resp.pct).toBe(100);
  });

  it("returns failed status correctly", () => {
    const resp = buildCvJobResponse(true, "failed", 200, 900);
    expect(resp.status).toBe("failed");
    expect(resp.pct).toBe(22);
  });
});

describe("STATUS_TO_STEP mapping", () => {
  it("maps 'recording' to step 0", () => {
    expect(getStep("recording")).toBe(0);
  });

  it("maps 'uploading' to step 1", () => {
    expect(getStep("uploading")).toBe(1);
  });

  it("maps 'processing' to step 1 (chunk concatenation)", () => {
    expect(getStep("processing")).toBe(1);
  });

  it("maps 'queued' to step 2", () => {
    expect(getStep("queued")).toBe(2);
  });

  it("maps 'analyzing' to step 3", () => {
    expect(getStep("analyzing")).toBe(3);
  });

  it("maps 'complete' to step 4", () => {
    expect(getStep("complete")).toBe(4);
  });

  it("maps 'ready' to step 4", () => {
    expect(getStep("ready")).toBe(4);
  });

  it("maps 'failed' to step 4", () => {
    expect(getStep("failed")).toBe(4);
  });

  it("maps unknown status to 0", () => {
    expect(getStep("unknown_status")).toBe(0);
    expect(getStep("")).toBe(0);
  });
});

describe("cvProgress state shape", () => {
  type CvProgress = {
    pct: number;
    framesProcessed: number;
    totalFrames: number;
    jobFound: boolean;
  };

  function makeCvProgress(
    pct: number,
    framesProcessed: number,
    totalFrames: number,
    jobFound: boolean
  ): CvProgress {
    return { pct, framesProcessed, totalFrames, jobFound };
  }

  it("creates a valid CvProgress object", () => {
    const p = makeCvProgress(50, 45, 90, true);
    expect(p.pct).toBe(50);
    expect(p.framesProcessed).toBe(45);
    expect(p.totalFrames).toBe(90);
    expect(p.jobFound).toBe(true);
  });

  it("allows null cvProgress (no job yet)", () => {
    const p: CvProgress | null = null;
    expect(p).toBeNull();
  });

  it("jobFound: false means no bar should render", () => {
    const p = makeCvProgress(0, 0, 0, false);
    // The UI only renders the bar when jobFound is true
    const shouldRender = p.jobFound;
    expect(shouldRender).toBe(false);
  });

  it("jobFound: true with 0% means bar renders at 0 width", () => {
    const p = makeCvProgress(0, 0, 100, true);
    expect(p.jobFound).toBe(true);
    expect(p.pct).toBe(0);
  });
});

describe("CV poll stop condition", () => {
  /** Mirrors the condition used in the useEffect to stop cv-job polling */
  function shouldStopPolling(jobFound: boolean, status: string): boolean {
    return jobFound && (status === "complete" || status === "failed");
  }

  it("stops polling when job is complete", () => {
    expect(shouldStopPolling(true, "complete")).toBe(true);
  });

  it("stops polling when job has failed", () => {
    expect(shouldStopPolling(true, "failed")).toBe(true);
  });

  it("continues polling when job is running", () => {
    expect(shouldStopPolling(true, "running")).toBe(false);
  });

  it("continues polling when job is queued", () => {
    expect(shouldStopPolling(true, "queued")).toBe(false);
  });

  it("continues polling when job is not found yet", () => {
    expect(shouldStopPolling(false, "complete")).toBe(false);
  });

  it("continues polling when jobFound is false and status is failed", () => {
    expect(shouldStopPolling(false, "failed")).toBe(false);
  });
});

describe("Frame count display logic", () => {
  /** Mirrors the condition in the JSX: only show frame counts when totalFrames > 0 */
  function shouldShowFrameCount(totalFrames: number): boolean {
    return totalFrames > 0;
  }

  it("shows frame count when totalFrames > 0", () => {
    expect(shouldShowFrameCount(900)).toBe(true);
  });

  it("hides frame count when totalFrames is 0 (job just queued)", () => {
    expect(shouldShowFrameCount(0)).toBe(false);
  });

  it("hides frame count when totalFrames is negative", () => {
    expect(shouldShowFrameCount(-1)).toBe(false);
  });
});

describe("Progress bar width style", () => {
  /** Mirrors the inline style: width: `${cvProgress.pct}%` */
  function barWidthStyle(pct: number): string {
    return `${pct}%`;
  }

  it("renders 0% width for 0 pct", () => {
    expect(barWidthStyle(0)).toBe("0%");
  });

  it("renders 50% width for 50 pct", () => {
    expect(barWidthStyle(50)).toBe("50%");
  });

  it("renders 100% width for 100 pct", () => {
    expect(barWidthStyle(100)).toBe("100%");
  });
});
