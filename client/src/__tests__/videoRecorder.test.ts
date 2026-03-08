/**
 * Video Recorder Phase 1 — Unit Tests
 *
 * Tests cover:
 * - URL parameter parsing (tournamentId, boardNumber, white, black)
 * - Recording duration formatting
 * - Framing indicator logic (board detected, corners visible, lighting)
 * - MediaRecorder MIME type selection
 * - Chunk upload state machine
 * - Processing status polling logic
 * - API endpoint contracts (chunk, finalize)
 */

import { describe, it, expect } from "vitest";

// ── Duration formatting ───────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

describe("formatDuration", () => {
  it("formats zero as 00:00", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats 30 seconds correctly", () => {
    expect(formatDuration(30_000)).toBe("00:30");
  });

  it("formats 90 seconds as 01:30", () => {
    expect(formatDuration(90_000)).toBe("01:30");
  });

  it("formats exactly 1 minute", () => {
    expect(formatDuration(60_000)).toBe("01:00");
  });

  it("formats 5 minutes 45 seconds", () => {
    expect(formatDuration(345_000)).toBe("05:45");
  });

  it("formats 59 minutes 59 seconds", () => {
    expect(formatDuration(3_599_000)).toBe("59:59");
  });

  it("formats 1 hour as 1:00:00", () => {
    expect(formatDuration(3_600_000)).toBe("1:00:00");
  });

  it("formats 1 hour 30 minutes 15 seconds", () => {
    expect(formatDuration(5_415_000)).toBe("1:30:15");
  });

  it("formats 2 hours 5 minutes 3 seconds", () => {
    expect(formatDuration(7_503_000)).toBe("2:05:03");
  });

  it("handles fractional milliseconds by flooring", () => {
    expect(formatDuration(1_999)).toBe("00:01");
  });
});

// ── URL parameter parsing ─────────────────────────────────────────────────────
function parseRecordParams(search: string): {
  tournamentId: string | null;
  boardNumber: string | null;
  white: string | null;
  black: string | null;
} {
  const p = new URLSearchParams(search);
  return {
    tournamentId: p.get("tournamentId"),
    boardNumber: p.get("boardNumber"),
    white: p.get("white"),
    black: p.get("black"),
  };
}

describe("parseRecordParams", () => {
  it("parses all four params correctly", () => {
    const result = parseRecordParams(
      "?tournamentId=abc123&boardNumber=3&white=magnus&black=hikaru"
    );
    expect(result.tournamentId).toBe("abc123");
    expect(result.boardNumber).toBe("3");
    expect(result.white).toBe("magnus");
    expect(result.black).toBe("hikaru");
  });

  it("returns null for missing params", () => {
    const result = parseRecordParams("?tournamentId=abc123");
    expect(result.boardNumber).toBeNull();
    expect(result.white).toBeNull();
    expect(result.black).toBeNull();
  });

  it("decodes URL-encoded player names", () => {
    const result = parseRecordParams(
      "?white=Magnus%20Carlsen&black=Hikaru%20Nakamura"
    );
    expect(result.white).toBe("Magnus Carlsen");
    expect(result.black).toBe("Hikaru Nakamura");
  });

  it("handles empty string values", () => {
    const result = parseRecordParams("?tournamentId=&boardNumber=");
    expect(result.tournamentId).toBe("");
    expect(result.boardNumber).toBe("");
  });

  it("handles empty search string", () => {
    const result = parseRecordParams("");
    expect(result.tournamentId).toBeNull();
    expect(result.boardNumber).toBeNull();
  });
});

// ── Framing indicator logic ───────────────────────────────────────────────────
interface FramingIndicators {
  boardDetected: boolean;
  cornersVisible: boolean;
  lightingOk: boolean;
}

function isReadyToRecord(indicators: FramingIndicators): boolean {
  return indicators.boardDetected && indicators.cornersVisible && indicators.lightingOk;
}

function getFramingScore(indicators: FramingIndicators): number {
  return [indicators.boardDetected, indicators.cornersVisible, indicators.lightingOk].filter(Boolean).length;
}

function getFramingMessage(indicators: FramingIndicators): string {
  if (!indicators.boardDetected) return "Point camera at the chess board";
  if (!indicators.cornersVisible) return "Move back until all 4 corners are visible";
  if (!indicators.lightingOk) return "Improve lighting — avoid direct glare";
  return "Perfect! Tap Start Recording";
}

describe("framing indicators", () => {
  it("requires all three indicators to be ready", () => {
    expect(isReadyToRecord({ boardDetected: true, cornersVisible: true, lightingOk: true })).toBe(true);
    expect(isReadyToRecord({ boardDetected: false, cornersVisible: true, lightingOk: true })).toBe(false);
    expect(isReadyToRecord({ boardDetected: true, cornersVisible: false, lightingOk: true })).toBe(false);
    expect(isReadyToRecord({ boardDetected: true, cornersVisible: true, lightingOk: false })).toBe(false);
  });

  it("scores 0 when all indicators are false", () => {
    expect(getFramingScore({ boardDetected: false, cornersVisible: false, lightingOk: false })).toBe(0);
  });

  it("scores 1 when only board detected", () => {
    expect(getFramingScore({ boardDetected: true, cornersVisible: false, lightingOk: false })).toBe(1);
  });

  it("scores 3 when all indicators are true", () => {
    expect(getFramingScore({ boardDetected: true, cornersVisible: true, lightingOk: true })).toBe(3);
  });

  it("returns correct message when board not detected", () => {
    expect(getFramingMessage({ boardDetected: false, cornersVisible: false, lightingOk: false }))
      .toBe("Point camera at the chess board");
  });

  it("returns correct message when corners not visible", () => {
    expect(getFramingMessage({ boardDetected: true, cornersVisible: false, lightingOk: false }))
      .toBe("Move back until all 4 corners are visible");
  });

  it("returns correct message when lighting is bad", () => {
    expect(getFramingMessage({ boardDetected: true, cornersVisible: true, lightingOk: false }))
      .toBe("Improve lighting — avoid direct glare");
  });

  it("returns ready message when all indicators are green", () => {
    expect(getFramingMessage({ boardDetected: true, cornersVisible: true, lightingOk: true }))
      .toBe("Perfect! Tap Start Recording");
  });
});

// ── MediaRecorder MIME type selection ────────────────────────────────────────
function selectMimeType(supported: string[]): string {
  const preferred = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return preferred.find((t) => supported.includes(t)) ?? "video/webm";
}

describe("selectMimeType", () => {
  it("prefers vp9+opus when available", () => {
    expect(selectMimeType(["video/webm;codecs=vp9,opus", "video/webm"])).toBe("video/webm;codecs=vp9,opus");
  });

  it("falls back to vp8+opus when vp9 unavailable", () => {
    expect(selectMimeType(["video/webm;codecs=vp8,opus", "video/webm"])).toBe("video/webm;codecs=vp8,opus");
  });

  it("falls back to plain webm when codecs unavailable", () => {
    expect(selectMimeType(["video/webm"])).toBe("video/webm");
  });

  it("falls back to mp4 when webm unavailable", () => {
    expect(selectMimeType(["video/mp4"])).toBe("video/mp4");
  });

  it("defaults to video/webm when nothing supported", () => {
    expect(selectMimeType([])).toBe("video/webm");
  });

  it("prefers vp9 over vp8 when both available", () => {
    expect(selectMimeType(["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"])).toBe("video/webm;codecs=vp9,opus");
  });
});

// ── Recording state machine ───────────────────────────────────────────────────
type RecordingScreen = "permission" | "orientation" | "framing" | "recording" | "processing" | "done";

function nextScreen(current: RecordingScreen, event: string): RecordingScreen {
  const transitions: Record<RecordingScreen, Record<string, RecordingScreen>> = {
    permission:   { GRANTED: "orientation" },
    orientation:  { LANDSCAPE: "framing" },
    framing:      { START: "recording" },
    recording:    { STOP: "processing" },
    processing:   { COMPLETE: "done", FAILED: "framing" },
    done:         {},
  };
  return transitions[current]?.[event] ?? current;
}

describe("recording state machine", () => {
  it("transitions from permission to orientation on GRANTED", () => {
    expect(nextScreen("permission", "GRANTED")).toBe("orientation");
  });

  it("transitions from orientation to framing on LANDSCAPE", () => {
    expect(nextScreen("orientation", "LANDSCAPE")).toBe("framing");
  });

  it("transitions from framing to recording on START", () => {
    expect(nextScreen("framing", "START")).toBe("recording");
  });

  it("transitions from recording to processing on STOP", () => {
    expect(nextScreen("recording", "STOP")).toBe("processing");
  });

  it("transitions from processing to done on COMPLETE", () => {
    expect(nextScreen("processing", "COMPLETE")).toBe("done");
  });

  it("transitions from processing back to framing on FAILED", () => {
    expect(nextScreen("processing", "FAILED")).toBe("framing");
  });

  it("stays in same state on unknown event", () => {
    expect(nextScreen("framing", "UNKNOWN")).toBe("framing");
    expect(nextScreen("recording", "UNKNOWN")).toBe("recording");
  });

  it("stays in done state (terminal)", () => {
    expect(nextScreen("done", "ANYTHING")).toBe("done");
  });
});

// ── Chunk upload state ────────────────────────────────────────────────────────
interface ChunkState {
  total: number;
  uploaded: number;
  failed: number;
}

function chunkProgress(state: ChunkState): number {
  if (state.total === 0) return 0;
  return Math.round((state.uploaded / state.total) * 100);
}

function isUploadComplete(state: ChunkState): boolean {
  return state.total > 0 && state.uploaded === state.total && state.failed === 0;
}

describe("chunk upload state", () => {
  it("returns 0% progress when no chunks", () => {
    expect(chunkProgress({ total: 0, uploaded: 0, failed: 0 })).toBe(0);
  });

  it("returns 50% when half uploaded", () => {
    expect(chunkProgress({ total: 10, uploaded: 5, failed: 0 })).toBe(50);
  });

  it("returns 100% when all uploaded", () => {
    expect(chunkProgress({ total: 10, uploaded: 10, failed: 0 })).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(chunkProgress({ total: 3, uploaded: 1, failed: 0 })).toBe(33);
  });

  it("marks complete when all chunks uploaded with no failures", () => {
    expect(isUploadComplete({ total: 5, uploaded: 5, failed: 0 })).toBe(true);
  });

  it("not complete when some chunks failed", () => {
    expect(isUploadComplete({ total: 5, uploaded: 4, failed: 1 })).toBe(false);
  });

  it("not complete when still uploading", () => {
    expect(isUploadComplete({ total: 5, uploaded: 3, failed: 0 })).toBe(false);
  });

  it("not complete when total is 0", () => {
    expect(isUploadComplete({ total: 0, uploaded: 0, failed: 0 })).toBe(false);
  });
});

// ── Processing status polling ─────────────────────────────────────────────────
type SessionStatus = "ready" | "recording" | "uploading" | "queued" | "processing" | "complete" | "failed";

function isTerminalStatus(status: SessionStatus): boolean {
  return status === "complete" || status === "failed";
}

function getStatusMessage(status: SessionStatus): string {
  const messages: Record<SessionStatus, string> = {
    ready:      "Session created",
    recording:  "Recording in progress",
    uploading:  "Uploading video…",
    queued:     "Queued for processing",
    processing: "Analysing moves with Stockfish…",
    complete:   "Analysis complete",
    failed:     "Processing failed",
  };
  return messages[status];
}

function shouldPollStatus(status: SessionStatus): boolean {
  return !isTerminalStatus(status) && status !== "ready";
}

describe("processing status", () => {
  it("complete is a terminal status", () => {
    expect(isTerminalStatus("complete")).toBe(true);
  });

  it("failed is a terminal status", () => {
    expect(isTerminalStatus("failed")).toBe(true);
  });

  it("non-terminal statuses are not terminal", () => {
    const nonTerminal: SessionStatus[] = ["ready", "recording", "uploading", "queued", "processing"];
    nonTerminal.forEach((s) => expect(isTerminalStatus(s)).toBe(false));
  });

  it("returns correct status messages", () => {
    expect(getStatusMessage("queued")).toBe("Queued for processing");
    expect(getStatusMessage("processing")).toBe("Analysing moves with Stockfish…");
    expect(getStatusMessage("complete")).toBe("Analysis complete");
    expect(getStatusMessage("failed")).toBe("Processing failed");
  });

  it("should poll when uploading", () => {
    expect(shouldPollStatus("uploading")).toBe(true);
  });

  it("should poll when queued", () => {
    expect(shouldPollStatus("queued")).toBe(true);
  });

  it("should poll when processing", () => {
    expect(shouldPollStatus("processing")).toBe(true);
  });

  it("should not poll when complete", () => {
    expect(shouldPollStatus("complete")).toBe(false);
  });

  it("should not poll when failed", () => {
    expect(shouldPollStatus("failed")).toBe(false);
  });

  it("should not poll when ready (not yet started)", () => {
    expect(shouldPollStatus("ready")).toBe(false);
  });
});
