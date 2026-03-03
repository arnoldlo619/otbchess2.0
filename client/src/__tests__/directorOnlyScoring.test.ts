/**
 * Tests for the director-only score entry model.
 * Verifies that player self-reporting is gone and the director-only flow is correct.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const playerViewSrc = readFileSync(
  path.resolve(__dirname, "../pages/PlayerView.tsx"),
  "utf-8"
);
const directorSrc = readFileSync(
  path.resolve(__dirname, "../pages/Director.tsx"),
  "utf-8"
);
const serverSrc = readFileSync(
  path.resolve(__dirname, "../../../server/index.ts"),
  "utf-8"
);

describe("Director-only score entry model", () => {
  // ── PlayerView: no self-reporting ──────────────────────────────────────────
  it("PlayerView does not contain a submitResult function", () => {
    expect(playerViewSrc).not.toContain("submitResult");
  });

  it("PlayerView does not POST to /api/tournament/:id/result", () => {
    // Check for the specific API result-submission endpoint, not the /results navigation route
    // PlayerView may legitimately fetch /players, /timer, /live-state — just not /result
    expect(playerViewSrc).not.toContain('/api/tournament/:id/result');
    expect(playerViewSrc).not.toContain('/result\'');
    expect(playerViewSrc).not.toContain('/result`');
  });

  it("PlayerView does not contain result option buttons (1-0 / ½-½ / 0-1 grid)", () => {
    expect(playerViewSrc).not.toContain("grid-cols-3");
  });

  it("PlayerView does not import or use Loader2 for submission spinner", () => {
    expect(playerViewSrc).not.toContain("Loader2");
  });

  it("PlayerView does not have a ResultOption type", () => {
    expect(playerViewSrc).not.toContain("ResultOption");
  });

  it("PlayerView shows director-report instruction on My Board screen", () => {
    expect(playerViewSrc).toContain("registration table");
  });

  it("WaitingRoundScreen shows director-report instruction", () => {
    expect(playerViewSrc).toContain("report the score to the director");
  });

  // ── Director: no pending-reports state ────────────────────────────────────
  it("Director does not have a PendingReport type", () => {
    expect(directorSrc).not.toContain("type PendingReport");
  });

  it("Director does not have a pendingReports state", () => {
    expect(directorSrc).not.toContain("pendingReports");
  });

  it("Director does not listen for result_submitted SSE events", () => {
    expect(directorSrc).not.toContain("result_submitted");
  });

  it("Director does not have a clearPendingReport helper", () => {
    expect(directorSrc).not.toContain("clearPendingReport");
  });

  it("Director BoardCard does not accept pendingReport prop", () => {
    expect(directorSrc).not.toContain("pendingReport");
  });

  it("Director BoardCard does not accept onConfirmReport prop", () => {
    expect(directorSrc).not.toContain("onConfirmReport");
  });

  it("Director BoardCard does not accept onDismissReport prop", () => {
    expect(directorSrc).not.toContain("onDismissReport");
  });

  it("Director does not import CheckCheck icon", () => {
    expect(directorSrc).not.toContain("CheckCheck");
  });

  // ── Server: no player-report endpoints ────────────────────────────────────
  it("Server does not have a POST /result endpoint", () => {
    expect(serverSrc).not.toContain('app.post("/api/tournament/:id/result"');
  });

  it("Server does not have a GET /pending-results endpoint", () => {
    expect(serverSrc).not.toContain("pending-results");
  });

  it("Server does not have a PendingReport type", () => {
    expect(serverSrc).not.toContain("type PendingReport");
  });

  it("Server does not have a pendingReports in-memory store", () => {
    expect(serverSrc).not.toContain("pendingReports");
  });

  it("Server does not broadcast result_submitted SSE events", () => {
    expect(serverSrc).not.toContain("result_submitted");
  });
});
