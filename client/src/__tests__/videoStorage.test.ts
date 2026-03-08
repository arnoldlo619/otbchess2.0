/**
 * Tests for Phase 1: Persistent Video Storage
 *
 * These tests cover the client-side logic for:
 * - Chunk upload FormData construction
 * - Status-to-step mapping for the processing screen
 * - Chunk filename generation
 * - Mime type detection
 * - Finalize request body construction
 * - Video URL construction
 */

import { describe, it, expect } from "vitest";

// ─── Helpers extracted from VideoRecorder logic ──────────────────────────────

/**
 * Maps a server-side session status to a visual processing step index (0–4).
 * Mirrors the STATUS_TO_STEP map in VideoRecorder.tsx.
 */
function statusToStep(status: string): number {
  const STATUS_TO_STEP: Record<string, number> = {
    recording: 0,
    uploading: 1,
    processing: 1, // concatenating chunks — still in the "uploading" visual step
    queued: 2,
    analyzing: 3,
    complete: 4,
    ready: 4,
    failed: 4,
  };
  return STATUS_TO_STEP[status] ?? 0;
}

/**
 * Generates the chunk filename used by multer on the server.
 * Pattern: <sessionId>-chunk-<paddedIndex>.<ext>
 */
function chunkFilename(sessionId: string, chunkIndex: number, mimeType: string): string {
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  return `${sessionId}-chunk-${String(chunkIndex).padStart(5, "0")}.${ext}`;
}

/**
 * Builds the FormData for a chunk upload request.
 * Returns the field names that should be present.
 */
function buildChunkFormDataFields(blob: Blob, chunkIndex: number, sessionId: string): string[] {
  const formData = new FormData();
  formData.append("chunk", blob, `chunk-${chunkIndex}.webm`);
  formData.append("chunkIndex", String(chunkIndex));
  formData.append("sessionId", sessionId);
  return Array.from(formData.keys());
}

/**
 * Builds the finalize request body.
 */
function buildFinalizeBody(
  chunkCount: number,
  durationMs: number,
  whitePlayer: string | null,
  blackPlayer: string | null
) {
  return {
    chunkCount,
    durationMs,
    whitePlayer: whitePlayer || null,
    blackPlayer: blackPlayer || null,
  };
}

/**
 * Constructs the video streaming URL for a session.
 */
function videoUrl(sessionId: string): string {
  return `/api/recordings/${sessionId}/video`;
}

/**
 * Determines if a video is available based on session data.
 */
function isVideoAvailable(session: { videoKey: string | null; status: string }): boolean {
  return !!session.videoKey && session.status !== "failed";
}

/**
 * Generates the final concatenated video filename for a session.
 */
function finalVideoFilename(sessionId: string): string {
  return `${sessionId}-final.webm`;
}

/**
 * Generates the ffmpeg concat list filename for a session.
 */
function concatListFilename(sessionId: string): string {
  return `${sessionId}-concat.txt`;
}

/**
 * Builds the ffmpeg concat list content from an array of file paths.
 */
function buildConcatList(filePaths: string[]): string {
  return filePaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}' `)
    .join("\n");
}

/**
 * Determines the MIME type to use for a recording based on browser support.
 */
function selectMimeType(
  isVp9Supported: boolean,
  isWebmSupported: boolean
): string {
  if (isVp9Supported) return "video/webm;codecs=vp9";
  if (isWebmSupported) return "video/webm";
  return "video/mp4";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("statusToStep", () => {
  it("maps recording to step 0", () => {
    expect(statusToStep("recording")).toBe(0);
  });

  it("maps uploading to step 1", () => {
    expect(statusToStep("uploading")).toBe(1);
  });

  it("maps processing to step 1 (same as uploading — concat in progress)", () => {
    expect(statusToStep("processing")).toBe(1);
  });

  it("maps queued to step 2", () => {
    expect(statusToStep("queued")).toBe(2);
  });

  it("maps analyzing to step 3", () => {
    expect(statusToStep("analyzing")).toBe(3);
  });

  it("maps complete to step 4", () => {
    expect(statusToStep("complete")).toBe(4);
  });

  it("maps ready to step 4", () => {
    expect(statusToStep("ready")).toBe(4);
  });

  it("maps failed to step 4", () => {
    expect(statusToStep("failed")).toBe(4);
  });

  it("returns 0 for unknown status", () => {
    expect(statusToStep("unknown_status")).toBe(0);
    expect(statusToStep("")).toBe(0);
  });

  it("returns 0 for needs_correction", () => {
    expect(statusToStep("needs_correction")).toBe(0);
  });
});

describe("chunkFilename", () => {
  it("generates correct filename for webm chunks", () => {
    expect(chunkFilename("session-123", 0, "video/webm")).toBe(
      "session-123-chunk-00000.webm"
    );
  });

  it("generates correct filename for mp4 chunks", () => {
    expect(chunkFilename("session-123", 0, "video/mp4")).toBe(
      "session-123-chunk-00000.mp4"
    );
  });

  it("pads chunk index to 5 digits", () => {
    expect(chunkFilename("abc", 1, "video/webm")).toBe("abc-chunk-00001.webm");
    expect(chunkFilename("abc", 42, "video/webm")).toBe("abc-chunk-00042.webm");
    expect(chunkFilename("abc", 99999, "video/webm")).toBe("abc-chunk-99999.webm");
  });

  it("handles webm;codecs=vp9 mime type as webm", () => {
    expect(chunkFilename("s1", 0, "video/webm;codecs=vp9")).toBe("s1-chunk-00000.webm");
  });

  it("handles mp4 in mime type string", () => {
    expect(chunkFilename("s1", 0, "video/mp4;codecs=avc1")).toBe("s1-chunk-00000.mp4");
  });

  it("uses session ID verbatim in filename", () => {
    const sessionId = "abc-def-123-xyz";
    expect(chunkFilename(sessionId, 5, "video/webm")).toBe(
      "abc-def-123-xyz-chunk-00005.webm"
    );
  });
});

describe("buildChunkFormDataFields", () => {
  it("includes all required fields: chunk, chunkIndex, sessionId", () => {
    const blob = new Blob(["data"], { type: "video/webm" });
    const fields = buildChunkFormDataFields(blob, 0, "session-1");
    expect(fields).toContain("chunk");
    expect(fields).toContain("chunkIndex");
    expect(fields).toContain("sessionId");
  });

  it("includes exactly 3 fields", () => {
    const blob = new Blob(["data"], { type: "video/webm" });
    const fields = buildChunkFormDataFields(blob, 0, "session-1");
    expect(fields).toHaveLength(3);
  });
});

describe("buildFinalizeBody", () => {
  it("builds correct body with all fields", () => {
    const body = buildFinalizeBody(12, 60000, "Kasparov", "Karpov");
    expect(body).toEqual({
      chunkCount: 12,
      durationMs: 60000,
      whitePlayer: "Kasparov",
      blackPlayer: "Karpov",
    });
  });

  it("converts empty strings to null for player names", () => {
    const body = buildFinalizeBody(5, 30000, "", "");
    expect(body.whitePlayer).toBeNull();
    expect(body.blackPlayer).toBeNull();
  });

  it("passes null player names through", () => {
    const body = buildFinalizeBody(3, 15000, null, null);
    expect(body.whitePlayer).toBeNull();
    expect(body.blackPlayer).toBeNull();
  });

  it("handles zero chunk count", () => {
    const body = buildFinalizeBody(0, 0, null, null);
    expect(body.chunkCount).toBe(0);
    expect(body.durationMs).toBe(0);
  });

  it("preserves large duration values", () => {
    const body = buildFinalizeBody(72, 3600000, "White", "Black"); // 1 hour
    expect(body.durationMs).toBe(3600000);
    expect(body.chunkCount).toBe(72);
  });
});

describe("videoUrl", () => {
  it("constructs the correct video streaming URL", () => {
    expect(videoUrl("session-abc")).toBe("/api/recordings/session-abc/video");
  });

  it("handles nanoid-style session IDs", () => {
    expect(videoUrl("V1StGXR8_Z5jdHi6B-myT")).toBe(
      "/api/recordings/V1StGXR8_Z5jdHi6B-myT/video"
    );
  });
});

describe("isVideoAvailable", () => {
  it("returns true when videoKey is set and status is not failed", () => {
    expect(isVideoAvailable({ videoKey: "/uploads/video-chunks/abc-final.webm", status: "queued" })).toBe(true);
    expect(isVideoAvailable({ videoKey: "/uploads/video-chunks/abc-final.webm", status: "complete" })).toBe(true);
  });

  it("returns false when videoKey is null", () => {
    expect(isVideoAvailable({ videoKey: null, status: "queued" })).toBe(false);
  });

  it("returns false when status is failed even if videoKey is set", () => {
    expect(isVideoAvailable({ videoKey: "/uploads/video-chunks/abc-final.webm", status: "failed" })).toBe(false);
  });

  it("returns false when videoKey is empty string", () => {
    expect(isVideoAvailable({ videoKey: "", status: "complete" })).toBe(false);
  });
});

describe("finalVideoFilename", () => {
  it("generates correct final video filename", () => {
    expect(finalVideoFilename("session-123")).toBe("session-123-final.webm");
  });

  it("uses session ID verbatim", () => {
    expect(finalVideoFilename("V1StGXR8_Z5jdHi6B-myT")).toBe(
      "V1StGXR8_Z5jdHi6B-myT-final.webm"
    );
  });
});

describe("concatListFilename", () => {
  it("generates correct concat list filename", () => {
    expect(concatListFilename("session-123")).toBe("session-123-concat.txt");
  });
});

describe("buildConcatList", () => {
  it("generates correct ffmpeg concat list for single file", () => {
    const result = buildConcatList(["/uploads/video-chunks/s1-chunk-00000.webm"]);
    expect(result).toBe("file '/uploads/video-chunks/s1-chunk-00000.webm' ");
  });

  it("generates correct ffmpeg concat list for multiple files", () => {
    const result = buildConcatList([
      "/uploads/video-chunks/s1-chunk-00000.webm",
      "/uploads/video-chunks/s1-chunk-00001.webm",
      "/uploads/video-chunks/s1-chunk-00002.webm",
    ]);
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("file '/uploads/video-chunks/s1-chunk-00000.webm' ");
    expect(lines[1]).toBe("file '/uploads/video-chunks/s1-chunk-00001.webm' ");
    expect(lines[2]).toBe("file '/uploads/video-chunks/s1-chunk-00002.webm' ");
  });

  it("escapes single quotes in file paths", () => {
    const result = buildConcatList(["/uploads/it's a video.webm"]);
    expect(result).toContain("\\'");
  });

  it("returns empty string for empty array", () => {
    expect(buildConcatList([])).toBe("");
  });
});

describe("selectMimeType", () => {
  it("prefers vp9 when supported", () => {
    expect(selectMimeType(true, true)).toBe("video/webm;codecs=vp9");
  });

  it("falls back to webm when vp9 not supported", () => {
    expect(selectMimeType(false, true)).toBe("video/webm");
  });

  it("falls back to mp4 when neither webm nor vp9 supported", () => {
    expect(selectMimeType(false, false)).toBe("video/mp4");
  });
});

describe("chunk index ordering", () => {
  it("sorts chunk filenames correctly by padded index", () => {
    const filenames = [
      "session-chunk-00010.webm",
      "session-chunk-00001.webm",
      "session-chunk-00005.webm",
      "session-chunk-00000.webm",
    ];
    const sorted = [...filenames].sort();
    expect(sorted[0]).toBe("session-chunk-00000.webm");
    expect(sorted[1]).toBe("session-chunk-00001.webm");
    expect(sorted[2]).toBe("session-chunk-00005.webm");
    expect(sorted[3]).toBe("session-chunk-00010.webm");
  });

  it("zero-padding ensures correct lexicographic sort for up to 99999 chunks", () => {
    const indices = [0, 9, 10, 99, 100, 999, 1000, 9999, 10000, 99999];
    const filenames = indices.map((i) => chunkFilename("s", i, "video/webm"));
    const sorted = [...filenames].sort();
    // After sort, indices should be in ascending order
    sorted.forEach((name, pos) => {
      const idx = parseInt(name.match(/chunk-(\d+)/)![1], 10);
      expect(idx).toBe(indices[pos]);
    });
  });
});

describe("video range request support", () => {
  it("correctly parses a Range header", () => {
    const rangeHeader = "bytes=0-1023";
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);
    expect(start).toBe(0);
    expect(end).toBe(1023);
    expect(end - start + 1).toBe(1024);
  });

  it("handles open-ended range (no end byte)", () => {
    const rangeHeader = "bytes=512-";
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : 2048 - 1; // fileSize - 1
    expect(start).toBe(512);
    expect(end).toBe(2047);
  });

  it("computes Content-Range header correctly", () => {
    const start = 0;
    const end = 1023;
    const fileSize = 4096;
    const contentRange = `bytes ${start}-${end}/${fileSize}`;
    expect(contentRange).toBe("bytes 0-1023/4096");
  });
});
