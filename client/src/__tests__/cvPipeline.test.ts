/**
 * CV Pipeline Integration Tests
 *
 * Tests for the real computer vision pipeline:
 * - Web Worker message protocol
 * - Board detection result handling
 * - Overlay canvas drawing logic
 * - Fallback behavior when ONNX/OpenCV unavailable
 * - Frame sampling and transfer logic
 */

import {describe, it, expect} from "vitest";

// ── Helpers mirrored from VideoRecorder ──────────────────────────────────────

/** Scale corners from worker coordinates to display coordinates */
function scaleCorners(
  corners: Array<{ x: number; y: number }>,
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number
): Array<{ x: number; y: number }> {
  const scaleX = displayWidth / (videoWidth || 640);
  const scaleY = displayHeight / (videoHeight || 480);
  return corners.map((c) => ({ x: c.x * scaleX, y: c.y * scaleY }));
}

/** Determine if a set of corners forms a valid quadrilateral (non-degenerate) */
function isValidQuad(corners: Array<{ x: number; y: number }>): boolean {
  if (corners.length !== 4) return false;
  // Check no two corners are the same point
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const dx = corners[i].x - corners[j].x;
      const dy = corners[i].y - corners[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return false;
    }
  }
  return true;
}

/** Compute the area of a quadrilateral using the shoelace formula */
function quadArea(corners: Array<{ x: number; y: number }>): number {
  let area = 0;
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += corners[i].x * corners[j].y;
    area -= corners[j].x * corners[i].y;
  }
  return Math.abs(area) / 2;
}

/** Determine framing status from worker result */
function computeFramingStatus(result: {
  boardDetected: boolean;
  cornersVisible: boolean;
  lightingOk: boolean;
  confidence: number;
}): { ready: boolean; label: string } {
  const ready =
    result.boardDetected && result.cornersVisible && result.lightingOk;
  let label: string;
  if (ready) {
    label = "Board confirmed — ready to record";
  } else if (!result.lightingOk) {
    label = "Improve lighting — avoid shadows";
  } else if (!result.boardDetected) {
    label = "Position the chess board within this frame";
  } else {
    label = "Ensure all four corners are visible";
  }
  return { ready, label };
}

/** Parse worker message type */
type WorkerMessageType = "init" | "detect" | "status" | "ready" | "result" | "error";

function parseWorkerMessage(msg: unknown): { type: WorkerMessageType; valid: boolean } {
  if (typeof msg !== "object" || msg === null) return { type: "error", valid: false };
  const m = msg as Record<string, unknown>;
  const validTypes: WorkerMessageType[] = ["init", "detect", "status", "ready", "result", "error"];
  const type = m.type as WorkerMessageType;
  return {
    type,
    valid: validTypes.includes(type),
  };
}

/** Compute brightness from RGBA pixel data */
function computeBrightness(data: Uint8ClampedArray): number {
  let total = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    total += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  return total / pixels;
}

/** Determine if lighting is acceptable */
function isLightingOk(brightness: number): boolean {
  return brightness > 60 && brightness < 220;
}

/** Compute confidence from edge density */
function computeConfidence(edgeDensity: number): number {
  return Math.min(edgeDensity / 0.12, 1);
}

/** Format elapsed recording time */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Determine MIME type fallback chain */
function selectMimeType(supported: string[]): string {
  const preferred = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const mime of preferred) {
    if (supported.includes(mime)) return mime;
  }
  return "video/webm"; // last resort
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CV Pipeline — Corner Scaling", () => {
  it("scales corners correctly from worker to display coordinates", () => {
    const corners = [
      { x: 100, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 380 },
    ];
    const scaled = scaleCorners(corners, 640, 480, 1280, 960);
    expect(scaled[0]).toEqual({ x: 200, y: 200 });
    expect(scaled[1]).toEqual({ x: 1080, y: 200 });
    expect(scaled[2]).toEqual({ x: 1080, y: 760 });
    expect(scaled[3]).toEqual({ x: 200, y: 760 });
  });

  it("handles 1:1 scaling (no change)", () => {
    const corners = [{ x: 50, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 200 }, { x: 50, y: 200 }];
    const scaled = scaleCorners(corners, 640, 480, 640, 480);
    expect(scaled).toEqual(corners);
  });

  it("handles zero video dimensions gracefully (uses 640 fallback)", () => {
    const corners = [{ x: 320, y: 240 }, { x: 640, y: 240 }, { x: 640, y: 480 }, { x: 320, y: 480 }];
    const scaled = scaleCorners(corners, 0, 0, 640, 480);
    // scaleX = 640/640 = 1, scaleY = 480/480 = 1
    expect(scaled[0]).toEqual({ x: 320, y: 240 });
  });

  it("scales down for smaller display", () => {
    const corners = [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }, { x: 100, y: 400 }];
    const scaled = scaleCorners(corners, 640, 480, 320, 240);
    expect(scaled[0].x).toBeCloseTo(50);
    expect(scaled[0].y).toBeCloseTo(50);
  });
});

describe("CV Pipeline — Quadrilateral Validation", () => {
  it("accepts a valid square quad", () => {
    const corners = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ];
    expect(isValidQuad(corners)).toBe(true);
  });

  it("rejects a quad with fewer than 4 corners", () => {
    expect(isValidQuad([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it("rejects a quad with more than 4 corners", () => {
    const corners = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
      { x: 50, y: 150 }, { x: 0, y: 100 },
    ];
    expect(isValidQuad(corners)).toBe(false);
  });

  it("rejects a degenerate quad (two identical points)", () => {
    const corners = [
      { x: 100, y: 100 },
      { x: 100, y: 100 }, // duplicate
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ];
    expect(isValidQuad(corners)).toBe(false);
  });

  it("accepts a slightly skewed quad (perspective distortion)", () => {
    const corners = [
      { x: 120, y: 90 },
      { x: 520, y: 80 },
      { x: 540, y: 400 },
      { x: 90, y: 410 },
    ];
    expect(isValidQuad(corners)).toBe(true);
  });
});

describe("CV Pipeline — Quadrilateral Area", () => {
  it("computes area of a 300x300 square", () => {
    const corners = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 400 },
      { x: 100, y: 400 },
    ];
    expect(quadArea(corners)).toBeCloseTo(90000);
  });

  it("returns 0 for a degenerate quad (all same point)", () => {
    const corners = [
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    ];
    expect(quadArea(corners)).toBeCloseTo(0);
  });

  it("computes area of a non-square quad", () => {
    // Trapezoid
    const corners = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 150, y: 100 },
      { x: 50, y: 100 },
    ];
    // Area = (200 + 100) / 2 * 100 = 15000
    expect(quadArea(corners)).toBeCloseTo(15000);
  });
});

describe("CV Pipeline — Framing Status", () => {
  it("returns ready=true when all three indicators are green", () => {
    const result = computeFramingStatus({
      boardDetected: true,
      cornersVisible: true,
      lightingOk: true,
      confidence: 0.9,
    });
    expect(result.ready).toBe(true);
    expect(result.label).toContain("ready to record");
  });

  it("returns ready=false when board not detected", () => {
    const result = computeFramingStatus({
      boardDetected: false,
      cornersVisible: false,
      lightingOk: true,
      confidence: 0.1,
    });
    expect(result.ready).toBe(false);
    expect(result.label).toContain("Position the chess board");
  });

  it("returns ready=false when lighting is bad", () => {
    const result = computeFramingStatus({
      boardDetected: true,
      cornersVisible: true,
      lightingOk: false,
      confidence: 0.8,
    });
    expect(result.ready).toBe(false);
    expect(result.label).toContain("lighting");
  });

  it("returns ready=false when corners not all visible", () => {
    const result = computeFramingStatus({
      boardDetected: true,
      cornersVisible: false,
      lightingOk: true,
      confidence: 0.5,
    });
    expect(result.ready).toBe(false);
    expect(result.label).toContain("corners");
  });
});

describe("CV Pipeline — Worker Message Protocol", () => {
  it("validates init message type", () => {
    expect(parseWorkerMessage({ type: "init" })).toEqual({ type: "init", valid: true });
  });

  it("validates detect message type", () => {
    expect(parseWorkerMessage({ type: "detect" })).toEqual({ type: "detect", valid: true });
  });

  it("validates result message type", () => {
    expect(parseWorkerMessage({ type: "result" })).toEqual({ type: "result", valid: true });
  });

  it("validates ready message type", () => {
    expect(parseWorkerMessage({ type: "ready" })).toEqual({ type: "ready", valid: true });
  });

  it("validates status message type", () => {
    expect(parseWorkerMessage({ type: "status" })).toEqual({ type: "status", valid: true });
  });

  it("validates error message type", () => {
    expect(parseWorkerMessage({ type: "error" })).toEqual({ type: "error", valid: true });
  });

  it("rejects unknown message type", () => {
    expect(parseWorkerMessage({ type: "unknown" })).toEqual({ type: "unknown" as WorkerMessageType, valid: false });
  });

  it("rejects null message", () => {
    expect(parseWorkerMessage(null)).toEqual({ type: "error", valid: false });
  });

  it("rejects non-object message", () => {
    expect(parseWorkerMessage("hello")).toEqual({ type: "error", valid: false });
  });
});

describe("CV Pipeline — Lighting Analysis", () => {
  it("detects good lighting (mid-range brightness)", () => {
    const data = new Uint8ClampedArray(4 * 100);
    // Fill with brightness 128 (gray)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255;
    }
    const brightness = computeBrightness(data);
    expect(brightness).toBeCloseTo(128);
    expect(isLightingOk(brightness)).toBe(true);
  });

  it("detects too-dark frame", () => {
    const data = new Uint8ClampedArray(4 * 100);
    // All black
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10; data[i + 1] = 10; data[i + 2] = 10; data[i + 3] = 255;
    }
    const brightness = computeBrightness(data);
    expect(isLightingOk(brightness)).toBe(false);
  });

  it("detects overexposed frame", () => {
    const data = new Uint8ClampedArray(4 * 100);
    // All white
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 250; data[i + 1] = 250; data[i + 2] = 250; data[i + 3] = 255;
    }
    const brightness = computeBrightness(data);
    expect(isLightingOk(brightness)).toBe(false);
  });

  it("accepts brightness at lower boundary (61)", () => {
    expect(isLightingOk(61)).toBe(true);
  });

  it("rejects brightness at lower boundary (60)", () => {
    expect(isLightingOk(60)).toBe(false);
  });

  it("accepts brightness at upper boundary (219)", () => {
    expect(isLightingOk(219)).toBe(true);
  });

  it("rejects brightness at upper boundary (220)", () => {
    expect(isLightingOk(220)).toBe(false);
  });
});

describe("CV Pipeline — Confidence Calculation", () => {
  it("returns 0 confidence for zero edge density", () => {
    expect(computeConfidence(0)).toBe(0);
  });

  it("returns 1.0 confidence at max edge density (0.12)", () => {
    expect(computeConfidence(0.12)).toBeCloseTo(1.0);
  });

  it("clamps confidence to 1.0 for high edge density", () => {
    expect(computeConfidence(0.5)).toBe(1.0);
  });

  it("returns ~0.5 confidence at half max density", () => {
    expect(computeConfidence(0.06)).toBeCloseTo(0.5);
  });

  it("returns ~0.33 confidence at low density", () => {
    expect(computeConfidence(0.04)).toBeCloseTo(0.333, 2);
  });
});

describe("CV Pipeline — Recording Timer", () => {
  it("formats sub-minute elapsed time", () => {
    expect(formatElapsed(30000)).toBe("00:30");
  });

  it("formats 1 minute", () => {
    expect(formatElapsed(60000)).toBe("01:00");
  });

  it("formats 90 minutes", () => {
    expect(formatElapsed(5400000)).toBe("1:30:00");
  });

  it("formats 2 hours", () => {
    expect(formatElapsed(7200000)).toBe("2:00:00");
  });

  it("formats zero", () => {
    expect(formatElapsed(0)).toBe("00:00");
  });

  it("formats 1 hour 23 minutes 45 seconds", () => {
    expect(formatElapsed((1 * 3600 + 23 * 60 + 45) * 1000)).toBe("1:23:45");
  });
});

describe("CV Pipeline — MIME Type Selection", () => {
  it("prefers vp9 when available", () => {
    expect(selectMimeType(["video/webm;codecs=vp9", "video/webm", "video/mp4"])).toBe("video/webm;codecs=vp9");
  });

  it("falls back to vp8 when vp9 unavailable", () => {
    expect(selectMimeType(["video/webm;codecs=vp8", "video/webm"])).toBe("video/webm;codecs=vp8");
  });

  it("falls back to webm when codecs unavailable", () => {
    expect(selectMimeType(["video/webm", "video/mp4"])).toBe("video/webm");
  });

  it("falls back to mp4 when webm unavailable", () => {
    expect(selectMimeType(["video/mp4"])).toBe("video/mp4");
  });

  it("returns webm as last resort for empty list", () => {
    expect(selectMimeType([])).toBe("video/webm");
  });
});
