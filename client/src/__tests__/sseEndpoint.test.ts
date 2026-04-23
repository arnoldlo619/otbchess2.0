/**
 * SSE endpoint test — verifies that /api/tournament/:id/stream exists
 * and is separate from /api/tournament/:id/players/stream.
 *
 * This is a unit test that checks the server route registration.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("SSE endpoint registration", () => {
  const serverCode = fs.readFileSync(
    path.resolve(__dirname, "../../../server/index.ts"),
    "utf-8"
  );

  it("has /api/tournament/:id/stream endpoint for spectators", () => {
    // The general-purpose SSE stream for tournament spectators/players
    expect(serverCode).toContain('app.get("/api/tournament/:id/stream"');
  });

  it("has /api/tournament/:id/players/stream endpoint for director", () => {
    // The director-specific SSE stream for player_joined events
    expect(serverCode).toContain('app.get("/api/tournament/:id/players/stream"');
  });

  it("registers /stream BEFORE /players/stream to avoid route shadowing", () => {
    const streamIdx = serverCode.indexOf('app.get("/api/tournament/:id/stream"');
    const playersStreamIdx = serverCode.indexOf('app.get("/api/tournament/:id/players/stream"');

    expect(streamIdx).toBeGreaterThan(-1);
    expect(playersStreamIdx).toBeGreaterThan(-1);
    // /stream must come before /players/stream in the file
    expect(streamIdx).toBeLessThan(playersStreamIdx);
  });

  it("both endpoints use the same sseSubscribers Map", () => {
    // Both endpoints should register in sseSubscribers so broadcasts reach all clients
    const streamSection = serverCode.slice(
      serverCode.indexOf('app.get("/api/tournament/:id/stream"'),
      serverCode.indexOf('app.get("/api/tournament/:id/players/stream"')
    );
    expect(streamSection).toContain("sseSubscribers");
  });
});
