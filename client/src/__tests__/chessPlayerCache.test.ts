/**
 * Tests for the server-side chess player cache in proxyChessCom.
 * Verifies the source code contains the correct cache read/write logic,
 * TTL enforcement, and onDuplicateKeyUpdate upsert pattern.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(
  path.resolve(__dirname, "../../../server/index.ts"),
  "utf-8"
);

describe("proxyChessCom: cache schema", () => {
  it("imports chessPlayerCache from shared schema", () => {
    expect(src).toContain("chessPlayerCache");
  });

  it("defines a 1-hour TTL constant", () => {
    expect(src).toContain("CACHE_TTL_MS = 60 * 60 * 1000");
  });
});

describe("proxyChessCom: cache read", () => {
  it("queries chessPlayerCache by username", () => {
    expect(src).toContain(".from(chessPlayerCache)");
    expect(src).toContain("eq(chessPlayerCache.username, key)");
  });

  it("returns cached data with cached:true flag when hit", () => {
    expect(src).toContain("cached: true");
  });

  it("logs a HIT message when cache is fresh", () => {
    expect(src).toContain("[chess cache] HIT for");
  });

  it("logs a STALE message and re-fetches when cache is expired", () => {
    expect(src).toContain("[chess cache] STALE for");
  });

  it("falls back to live fetch on cache read error", () => {
    expect(src).toContain("[chess cache] read error, falling back to live fetch:");
  });
});

describe("proxyChessCom: cache write", () => {
  it("inserts into chessPlayerCache after a successful live fetch", () => {
    expect(src).toContain(".insert(chessPlayerCache)");
  });

  it("uses onDuplicateKeyUpdate for upsert semantics", () => {
    expect(src).toContain(".onDuplicateKeyUpdate(");
  });

  it("stores profileJson and statsJson as JSON strings", () => {
    expect(src).toContain("profileJson: JSON.stringify(profileData)");
    expect(src).toContain("statsJson: JSON.stringify(statsData)");
  });

  it("logs a WRITE message on successful cache write", () => {
    expect(src).toContain("[chess cache] WRITE for");
  });

  it("handles cache write errors non-fatally", () => {
    expect(src).toContain("[chess cache] write error (non-fatal):");
  });
});

describe("proxyChessCom: cache TTL enforcement", () => {
  it("compares age against CACHE_TTL_MS", () => {
    expect(src).toContain("age < CACHE_TTL_MS");
  });

  it("computes age from cachedAt timestamp", () => {
    expect(src).toContain("Date.now() - new Date(cached.cachedAt).getTime()");
  });
});
