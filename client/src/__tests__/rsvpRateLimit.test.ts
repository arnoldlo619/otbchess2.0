/**
 * Tests for the RSVP upload rate-limit resilience:
 * 1. Server-side chessProxyLimiter restricts provider lookups to 60 req/min
 * 2. Client-side fetchWithRetry retries on 429/503 with backoff
 * 3. Batch size reduced to 2 with 800ms inter-batch delay
 * 4. Error messages distinguish "not found" from "rate limited"
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const serverSrc = fs.readFileSync(
  path.resolve(__dirname, "../../../server/chessProxy.ts"),
  "utf-8"
);
const uploadRSVPSrc = fs.readFileSync(
  path.resolve(__dirname, "../components/UploadRSVPModal.tsx"),
  "utf-8"
);
const addPlayerSrc = fs.readFileSync(
  path.resolve(__dirname, "../components/AddPlayerModal.tsx"),
  "utf-8"
);

describe("Server: chessProxyLimiter", () => {
  it("limits provider lookups to 60 requests per minute", () => {
    // Find the chessProxyLimiter block
    const limiterMatch = serverSrc.match(
      /const chessProxyLimiter[\s\S]*?max:\s*(\d+)/
    );
    expect(limiterMatch).not.toBeNull();
    const maxVal = parseInt(limiterMatch![1], 10);
    expect(maxVal).toBe(60);
  });

  it("uses 60-second window", () => {
    const windowMatch = serverSrc.match(
      /const chessProxyLimiter[\s\S]*?windowMs:\s*(\d+(?:_\d+)*)/
    );
    expect(windowMatch).not.toBeNull();
    const windowMs = parseInt(windowMatch![1].replace(/_/g, ""), 10);
    expect(windowMs).toBe(60_000);
  });
});

describe("UploadRSVPModal: fetchWithRetry", () => {
  it("defines fetchWithRetry function", () => {
    expect(uploadRSVPSrc).toContain("async function fetchWithRetry");
  });

  it("retries on 429 status", () => {
    expect(uploadRSVPSrc).toContain("res.status === 429");
  });

  it("retries on 503 status", () => {
    expect(uploadRSVPSrc).toContain("res.status === 503");
  });

  it("uses exponential backoff", () => {
    expect(uploadRSVPSrc).toContain("Math.pow(2, attempt)");
  });

  it("caps backoff at 8 seconds", () => {
    expect(uploadRSVPSrc).toContain("8000");
  });

  it("defaults to 3 retry attempts", () => {
    expect(uploadRSVPSrc).toMatch(/maxRetries\s*=\s*3/);
  });
});

describe("UploadRSVPModal: batch processing", () => {
  it("uses batch size of 2", () => {
    expect(uploadRSVPSrc).toMatch(/const BATCH\s*=\s*2/);
  });

  it("has 800ms inter-batch delay", () => {
    expect(uploadRSVPSrc).toContain("setTimeout(r, 800)");
  });
});

describe("UploadRSVPModal: lookupChessCom uses fetchWithRetry", () => {
  it("calls fetchWithRetry instead of raw fetch", () => {
    // Extract the lookupChessCom function body
    const fnMatch = uploadRSVPSrc.match(
      /async function lookupChessCom[\s\S]*?^}/m
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("fetchWithRetry");
    // Should NOT contain a raw fetch call
    expect(fnBody).not.toMatch(/\bawait\s+fetch\(/);
  });

  it("distinguishes 404 from 429 errors", () => {
    expect(uploadRSVPSrc).toContain('res.status === 404) throw new Error("Not found on chess.com")');
    expect(uploadRSVPSrc).toContain('res.status === 429) throw new Error("Rate limited');
  });
});

describe("UploadRSVPModal: lookupLichess uses fetchWithRetry", () => {
  it("calls fetchWithRetry instead of raw fetch", () => {
    const fnMatch = uploadRSVPSrc.match(
      /async function lookupLichess[\s\S]*?^}/m
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("fetchWithRetry");
  });

  it("distinguishes 404 from 429 errors for Lichess", () => {
    expect(uploadRSVPSrc).toContain('res.status === 404) throw new Error("Not found on Lichess")');
  });
});

describe("AddPlayerModal: fetchWithRetry", () => {
  it("defines fetchWithRetry function", () => {
    expect(addPlayerSrc).toContain("async function fetchWithRetry");
  });

  it("lookupChessCom uses fetchWithRetry", () => {
    const fnMatch = addPlayerSrc.match(
      /async function lookupChessCom[\s\S]*?^}/m
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).toContain("fetchWithRetry");
  });

  it("lookupLichess uses fetchWithRetry", () => {
    const fnMatch = addPlayerSrc.match(
      /async function lookupLichess[\s\S]*?^}/m
    );
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).toContain("fetchWithRetry");
  });

  it("distinguishes 404 from 429 errors in chess.com lookup", () => {
    expect(addPlayerSrc).toContain('throw new Error("Player not found on chess.com")');
    expect(addPlayerSrc).toContain('throw new Error("Rate limited');
  });
});
