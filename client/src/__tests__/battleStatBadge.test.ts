/**
 * BattleStatBadge — unit tests for the W/D/L aggregation logic
 * used by the Battles stat badge in the Profile page.
 *
 * The component derives wins/draws/losses from the battle history
 * array returned by GET /api/battles/history. These tests verify
 * that the derivation is correct for all edge cases.
 */

import { describe, it, expect } from "vitest";

// ── Types (mirrored from Profile.tsx) ─────────────────────────────────────────

type BattleOutcome = "win" | "loss" | "draw";

interface BattleEntry {
  id: string;
  code: string;
  outcome: BattleOutcome;
  result: string | null;
  isHost: boolean;
  opponent: { id: string | null; displayName: string } | null;
  completedAt: string | null;
  createdAt: string;
}

// ── Aggregation helper (mirrors Profile.tsx inline logic) ─────────────────────

function aggregateBattleStats(history: BattleEntry[]) {
  const wins   = history.filter((b) => b.outcome === "win").length;
  const losses = history.filter((b) => b.outcome === "loss").length;
  const draws  = history.filter((b) => b.outcome === "draw").length;
  return { wins, losses, draws };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(outcome: BattleOutcome, id = "1"): BattleEntry {
  return {
    id,
    code: "ABC123",
    outcome,
    result: outcome === "win" ? "host_win" : outcome === "loss" ? "guest_win" : "draw",
    isHost: true,
    opponent: { id: "opp1", displayName: "Opponent" },
    completedAt: "2026-03-01T12:00:00Z",
    createdAt: "2026-03-01T11:55:00Z",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("aggregateBattleStats", () => {
  it("returns all zeros for an empty history", () => {
    expect(aggregateBattleStats([])).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it("counts a single win correctly", () => {
    const { wins, losses, draws } = aggregateBattleStats([makeEntry("win")]);
    expect(wins).toBe(1);
    expect(losses).toBe(0);
    expect(draws).toBe(0);
  });

  it("counts a single loss correctly", () => {
    const { wins, losses, draws } = aggregateBattleStats([makeEntry("loss")]);
    expect(wins).toBe(0);
    expect(losses).toBe(1);
    expect(draws).toBe(0);
  });

  it("counts a single draw correctly", () => {
    const { wins, losses, draws } = aggregateBattleStats([makeEntry("draw")]);
    expect(wins).toBe(0);
    expect(losses).toBe(0);
    expect(draws).toBe(1);
  });

  it("counts mixed outcomes correctly", () => {
    const history: BattleEntry[] = [
      makeEntry("win",  "1"),
      makeEntry("win",  "2"),
      makeEntry("loss", "3"),
      makeEntry("draw", "4"),
      makeEntry("win",  "5"),
    ];
    const { wins, losses, draws } = aggregateBattleStats(history);
    expect(wins).toBe(3);
    expect(losses).toBe(1);
    expect(draws).toBe(1);
  });

  it("total equals history length", () => {
    const history: BattleEntry[] = [
      makeEntry("win",  "1"),
      makeEntry("loss", "2"),
      makeEntry("draw", "3"),
    ];
    const { wins, losses, draws } = aggregateBattleStats(history);
    expect(wins + losses + draws).toBe(history.length);
  });

  it("handles all-wins history", () => {
    const history = Array.from({ length: 10 }, (_, i) => makeEntry("win", String(i)));
    const { wins, losses, draws } = aggregateBattleStats(history);
    expect(wins).toBe(10);
    expect(losses).toBe(0);
    expect(draws).toBe(0);
  });

  it("handles all-losses history", () => {
    const history = Array.from({ length: 5 }, (_, i) => makeEntry("loss", String(i)));
    const { wins, losses, draws } = aggregateBattleStats(history);
    expect(wins).toBe(0);
    expect(losses).toBe(5);
    expect(draws).toBe(0);
  });

  it("handles all-draws history", () => {
    const history = Array.from({ length: 3 }, (_, i) => makeEntry("draw", String(i)));
    const { wins, losses, draws } = aggregateBattleStats(history);
    expect(wins).toBe(0);
    expect(losses).toBe(0);
    expect(draws).toBe(3);
  });

  it("does not double-count any entry", () => {
    const history: BattleEntry[] = [
      makeEntry("win",  "a"),
      makeEntry("win",  "b"),
      makeEntry("draw", "c"),
    ];
    const { wins, losses, draws } = aggregateBattleStats(history);
    expect(wins).toBe(2);
    expect(losses).toBe(0);
    expect(draws).toBe(1);
    expect(wins + losses + draws).toBe(3);
  });
});
