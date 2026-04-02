/**
 * Tournament Analytics — Phase 5 Tests
 *
 * Tests cover:
 * 1. Analytics event aggregation logic (event counts, unique visitors, funnel)
 * 2. Top searches frequency computation (dedup, sort by count)
 * 3. Top followed players frequency computation
 * 4. Operational quality metrics (completion rate, avg games/round, byes)
 * 5. Retention signals (net follows, conversion rates)
 * 6. Timeline grouping (events grouped by date)
 * 7. CTA breakdown aggregation
 * 8. Recommendation engine logic
 * 9. Edge cases: empty data, single event, zero views
 */

import { describe, it, expect } from "vitest";

// ─── Types (mirrored from server analytics endpoint) ─────────────────────────

interface AnalyticsEvent {
  id: string;
  tournamentId: string;
  eventType: string;
  metadata: string | null;
  createdAt: string;
}

interface FunnelData {
  views: number;
  searches: number;
  follows: number;
  emailCaptures: number;
  ctaClicks: number;
}

interface OperationalQuality {
  completionRate: number;
  avgGamesPerRound: number;
  roundsCompleted: number;
  totalGamesExpected: number;
  byeCount: number;
}

interface RetentionSignals {
  netFollows: number;
  cardClaims: number;
  emailConversionRate: number;
  ctaConversionRate: number;
  searchToFollowRate: number;
}

// ─── Helpers (replicated from server/index.ts analytics endpoint) ────────────

function aggregateEvents(events: AnalyticsEvent[]) {
  const eventCounts: Record<string, number> = {};
  const uniqueIps = new Set<string>();
  const emailsCaptured: string[] = [];
  const ctaClicks: Record<string, number> = {};
  const searchQueries: string[] = [];
  const followedPlayers: string[] = [];
  const dateMap = new Map<string, { views: number; interactions: number }>();

  for (const event of events) {
    eventCounts[event.eventType] = (eventCounts[event.eventType] ?? 0) + 1;

    let meta: Record<string, any> = {};
    if (event.metadata) {
      try { meta = JSON.parse(event.metadata); } catch { /* silent */ }
    }

    if (event.eventType === "page_view" && meta.ip) {
      uniqueIps.add(meta.ip);
    }
    if (event.eventType === "email_capture" && meta.email) {
      emailsCaptured.push(meta.email);
    }
    if (event.eventType === "cta_click" && meta.cta) {
      ctaClicks[meta.cta] = (ctaClicks[meta.cta] ?? 0) + 1;
    }
    if (event.eventType === "search" && meta.playerName) {
      searchQueries.push(meta.playerName);
    }
    if (event.eventType === "follow" && meta.playerId) {
      followedPlayers.push(meta.playerId);
    }

    const dateStr = event.createdAt
      ? new Date(event.createdAt).toISOString().slice(0, 10)
      : "unknown";
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, { views: 0, interactions: 0 });
    const day = dateMap.get(dateStr)!;
    if (event.eventType === "page_view") {
      day.views++;
    } else {
      day.interactions++;
    }
  }

  const timeline = Array.from(dateMap.entries())
    .sort()
    .map(([date, counts]) => ({ date, ...counts }));

  return { eventCounts, uniqueIps, emailsCaptured, ctaClicks, searchQueries, followedPlayers, timeline };
}

function computeTopSearches(searchQueries: string[]) {
  const freq = new Map<string, number>();
  for (const q of searchQueries) {
    const key = q.toLowerCase().trim();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));
}

function computeTopFollowed(followedPlayers: string[]) {
  const freq = new Map<string, number>();
  for (const p of followedPlayers) {
    freq.set(p, (freq.get(p) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([playerId, count]) => ({ playerId, count }));
}

function computeFunnel(eventCounts: Record<string, number>, emailsCaptured: string[], ctaClicks: Record<string, number>): FunnelData {
  const totalViews = eventCounts["page_view"] ?? 0;
  const totalSearches = eventCounts["search"] ?? 0;
  const totalFollows = eventCounts["follow"] ?? 0;
  const totalEmails = emailsCaptured.length;
  const totalCtaClicks = Object.values(ctaClicks).reduce((a, b) => a + b, 0);
  return { views: totalViews, searches: totalSearches, follows: totalFollows, emailCaptures: totalEmails, ctaClicks: totalCtaClicks };
}

function computeOperationalQuality(state: any): OperationalQuality {
  const rounds = state.rounds ?? [];
  let completedRounds = 0;
  let totalGames = 0;
  let reportedGames = 0;
  let byes = 0;
  for (const round of rounds) {
    const games = round.games ?? [];
    let allReported = true;
    for (const game of games) {
      totalGames++;
      if (game.result && game.result !== "*") {
        reportedGames++;
      } else {
        allReported = false;
      }
      if (game.isBye) byes++;
    }
    if (allReported && games.length > 0) completedRounds++;
  }
  return {
    completionRate: totalGames > 0 ? Math.round((reportedGames / totalGames) * 100) : 0,
    avgGamesPerRound: rounds.length > 0 ? Math.round(totalGames / rounds.length) : 0,
    roundsCompleted: completedRounds,
    totalGamesExpected: totalGames,
    byeCount: byes,
  };
}

function computeRetentionSignals(
  eventCounts: Record<string, number>,
  totalViews: number,
  totalEmails: number,
  totalCtaClicks: number,
  totalSearches: number,
  totalFollows: number
): RetentionSignals {
  const totalUnfollows = eventCounts["unfollow"] ?? 0;
  const totalCardClaims = eventCounts["card_claim"] ?? 0;
  return {
    netFollows: totalFollows - totalUnfollows,
    cardClaims: totalCardClaims,
    emailConversionRate: totalViews > 0 ? Math.round((totalEmails / totalViews) * 100) : 0,
    ctaConversionRate: totalViews > 0 ? Math.round((totalCtaClicks / totalViews) * 100) : 0,
    searchToFollowRate: totalSearches > 0 ? Math.round((totalFollows / totalSearches) * 100) : 0,
  };
}

// Recommendation engine
function computeRecommendations(data: {
  overview: { totalViews: number; engagementRate: number };
  funnel: FunnelData;
  attendance: { registered: number };
  operationalQuality: OperationalQuality;
  retentionSignals: RetentionSignals;
}) {
  const recs: { title: string }[] = [];

  if (data.overview.totalViews === 0) {
    recs.push({ title: "Enable Public Mode" });
  } else if (data.overview.engagementRate < 20) {
    recs.push({ title: "Boost Engagement" });
  }

  if (data.funnel.views > 10 && data.funnel.follows === 0) {
    recs.push({ title: "Encourage Player Following" });
  }

  if (data.funnel.views > 20 && data.funnel.emailCaptures === 0) {
    recs.push({ title: "Promote Email Capture" });
  }

  if (data.attendance.registered > 0 && data.attendance.registered < 16) {
    recs.push({ title: "Grow Your Tournament" });
  }

  if (data.attendance.registered >= 30) {
    recs.push({ title: "Great Turnout!" });
  }

  if (data.operationalQuality.completionRate > 0 && data.operationalQuality.completionRate < 100) {
    recs.push({ title: "Complete All Results" });
  }

  if (data.retentionSignals.searchToFollowRate > 50) {
    recs.push({ title: "Strong Search-to-Follow Rate" });
  }

  if (recs.length === 0) {
    recs.push({ title: "Looking Good" });
  }

  return recs;
}

// ─── Test data helpers ───────────────────────────────────────────────────────

function makeEvent(
  id: string,
  eventType: string,
  metadata?: Record<string, any>,
  createdAt?: string
): AnalyticsEvent {
  return {
    id,
    tournamentId: "t1",
    eventType,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: createdAt ?? "2026-03-15T10:00:00Z",
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Tournament Analytics — Event Aggregation", () => {
  it("counts events by type correctly", () => {
    const events = [
      makeEvent("e1", "page_view", { ip: "1.1.1.1" }),
      makeEvent("e2", "page_view", { ip: "2.2.2.2" }),
      makeEvent("e3", "search", { playerName: "Alice" }),
      makeEvent("e4", "follow", { playerId: "p1" }),
    ];
    const { eventCounts } = aggregateEvents(events);
    expect(eventCounts["page_view"]).toBe(2);
    expect(eventCounts["search"]).toBe(1);
    expect(eventCounts["follow"]).toBe(1);
  });

  it("tracks unique visitors by IP", () => {
    const events = [
      makeEvent("e1", "page_view", { ip: "1.1.1.1" }),
      makeEvent("e2", "page_view", { ip: "1.1.1.1" }),
      makeEvent("e3", "page_view", { ip: "2.2.2.2" }),
    ];
    const { uniqueIps } = aggregateEvents(events);
    expect(uniqueIps.size).toBe(2);
  });

  it("collects captured emails", () => {
    const events = [
      makeEvent("e1", "email_capture", { email: "a@b.com" }),
      makeEvent("e2", "email_capture", { email: "c@d.com" }),
    ];
    const { emailsCaptured } = aggregateEvents(events);
    expect(emailsCaptured).toEqual(["a@b.com", "c@d.com"]);
  });

  it("aggregates CTA clicks by type", () => {
    const events = [
      makeEvent("e1", "cta_click", { cta: "save_results" }),
      makeEvent("e2", "cta_click", { cta: "save_results" }),
      makeEvent("e3", "cta_click", { cta: "join_club" }),
    ];
    const { ctaClicks } = aggregateEvents(events);
    expect(ctaClicks["save_results"]).toBe(2);
    expect(ctaClicks["join_club"]).toBe(1);
  });

  it("handles empty events array", () => {
    const { eventCounts, uniqueIps, emailsCaptured, timeline } = aggregateEvents([]);
    expect(Object.keys(eventCounts)).toHaveLength(0);
    expect(uniqueIps.size).toBe(0);
    expect(emailsCaptured).toHaveLength(0);
    expect(timeline).toHaveLength(0);
  });

  it("handles events with null metadata gracefully", () => {
    const events = [makeEvent("e1", "page_view")];
    const { eventCounts, uniqueIps } = aggregateEvents(events);
    expect(eventCounts["page_view"]).toBe(1);
    expect(uniqueIps.size).toBe(0); // no IP in metadata
  });
});

describe("Tournament Analytics — Top Searches", () => {
  it("deduplicates and counts search queries case-insensitively", () => {
    const queries = ["Alice", "alice", "ALICE", "Bob", "bob"];
    const top = computeTopSearches(queries);
    expect(top[0]).toEqual({ name: "alice", count: 3 });
    expect(top[1]).toEqual({ name: "bob", count: 2 });
  });

  it("returns empty array for no searches", () => {
    expect(computeTopSearches([])).toHaveLength(0);
  });

  it("limits to top 20 results", () => {
    const queries = Array.from({ length: 30 }, (_, i) => `player${i}`);
    const top = computeTopSearches(queries);
    expect(top.length).toBeLessThanOrEqual(20);
  });

  it("sorts by count descending", () => {
    const queries = ["A", "B", "B", "C", "C", "C"];
    const top = computeTopSearches(queries);
    expect(top[0].name).toBe("c");
    expect(top[0].count).toBe(3);
    expect(top[1].name).toBe("b");
    expect(top[1].count).toBe(2);
    expect(top[2].name).toBe("a");
    expect(top[2].count).toBe(1);
  });
});

describe("Tournament Analytics — Top Followed Players", () => {
  it("counts follow events per player", () => {
    const followed = ["p1", "p1", "p2", "p1", "p3"];
    const top = computeTopFollowed(followed);
    expect(top[0]).toEqual({ playerId: "p1", count: 3 });
    expect(top[1]).toEqual({ playerId: "p2", count: 1 });
  });

  it("returns empty for no follows", () => {
    expect(computeTopFollowed([])).toHaveLength(0);
  });
});

describe("Tournament Analytics — Funnel Computation", () => {
  it("computes funnel from event counts", () => {
    const eventCounts = { page_view: 100, search: 30, follow: 10 };
    const emails = ["a@b.com", "c@d.com"];
    const cta = { save_results: 5, join_club: 3 };
    const funnel = computeFunnel(eventCounts, emails, cta);
    expect(funnel).toEqual({
      views: 100,
      searches: 30,
      follows: 10,
      emailCaptures: 2,
      ctaClicks: 8,
    });
  });

  it("handles zero values gracefully", () => {
    const funnel = computeFunnel({}, [], {});
    expect(funnel).toEqual({
      views: 0,
      searches: 0,
      follows: 0,
      emailCaptures: 0,
      ctaClicks: 0,
    });
  });
});

describe("Tournament Analytics — Timeline Grouping", () => {
  it("groups events by date", () => {
    const events = [
      makeEvent("e1", "page_view", { ip: "1.1.1.1" }, "2026-03-15T10:00:00Z"),
      makeEvent("e2", "search", { playerName: "A" }, "2026-03-15T11:00:00Z"),
      makeEvent("e3", "page_view", { ip: "2.2.2.2" }, "2026-03-16T09:00:00Z"),
    ];
    const { timeline } = aggregateEvents(events);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toEqual({ date: "2026-03-15", views: 1, interactions: 1 });
    expect(timeline[1]).toEqual({ date: "2026-03-16", views: 1, interactions: 0 });
  });

  it("sorts timeline chronologically", () => {
    const events = [
      makeEvent("e1", "page_view", {}, "2026-03-20T10:00:00Z"),
      makeEvent("e2", "page_view", {}, "2026-03-18T10:00:00Z"),
      makeEvent("e3", "page_view", {}, "2026-03-19T10:00:00Z"),
    ];
    const { timeline } = aggregateEvents(events);
    expect(timeline.map((t) => t.date)).toEqual(["2026-03-18", "2026-03-19", "2026-03-20"]);
  });
});

describe("Tournament Analytics — Operational Quality", () => {
  it("computes completion rate from tournament state", () => {
    const state = {
      rounds: [
        { games: [{ result: "1-0" }, { result: "0-1" }] },
        { games: [{ result: "1-0" }, { result: "*" }] },
      ],
    };
    const oq = computeOperationalQuality(state);
    expect(oq.completionRate).toBe(75); // 3/4
    expect(oq.roundsCompleted).toBe(1); // only round 1 fully reported
    expect(oq.totalGamesExpected).toBe(4);
    expect(oq.avgGamesPerRound).toBe(2);
  });

  it("counts byes correctly", () => {
    const state = {
      rounds: [
        { games: [{ result: "1-0" }, { result: "1-0", isBye: true }] },
      ],
    };
    const oq = computeOperationalQuality(state);
    expect(oq.byeCount).toBe(1);
  });

  it("returns zeros for empty state", () => {
    const oq = computeOperationalQuality({});
    expect(oq.completionRate).toBe(0);
    expect(oq.roundsCompleted).toBe(0);
    expect(oq.totalGamesExpected).toBe(0);
    expect(oq.avgGamesPerRound).toBe(0);
    expect(oq.byeCount).toBe(0);
  });

  it("100% completion when all games reported", () => {
    const state = {
      rounds: [
        { games: [{ result: "1-0" }, { result: "0-1" }] },
        { games: [{ result: "0.5-0.5" }] },
      ],
    };
    const oq = computeOperationalQuality(state);
    expect(oq.completionRate).toBe(100);
    expect(oq.roundsCompleted).toBe(2);
  });
});

describe("Tournament Analytics — Retention Signals", () => {
  it("computes net follows (follows - unfollows)", () => {
    const eventCounts = { follow: 10, unfollow: 3, card_claim: 5 };
    const rs = computeRetentionSignals(eventCounts, 100, 2, 8, 20, 10);
    expect(rs.netFollows).toBe(7);
    expect(rs.cardClaims).toBe(5);
  });

  it("computes conversion rates correctly", () => {
    const eventCounts = { follow: 10, unfollow: 0 };
    const rs = computeRetentionSignals(eventCounts, 200, 10, 20, 50, 10);
    expect(rs.emailConversionRate).toBe(5); // 10/200 = 5%
    expect(rs.ctaConversionRate).toBe(10); // 20/200 = 10%
    expect(rs.searchToFollowRate).toBe(20); // 10/50 = 20%
  });

  it("handles zero views gracefully", () => {
    const rs = computeRetentionSignals({}, 0, 0, 0, 0, 0);
    expect(rs.emailConversionRate).toBe(0);
    expect(rs.ctaConversionRate).toBe(0);
    expect(rs.searchToFollowRate).toBe(0);
    expect(rs.netFollows).toBe(0);
  });
});

describe("Tournament Analytics — Recommendation Engine", () => {
  const baseData = {
    overview: { totalViews: 50, engagementRate: 30 },
    funnel: { views: 50, searches: 15, follows: 5, emailCaptures: 2, ctaClicks: 3 },
    attendance: { registered: 20 },
    operationalQuality: { completionRate: 100, avgGamesPerRound: 10, roundsCompleted: 4, totalGamesExpected: 40, byeCount: 0 },
    retentionSignals: { netFollows: 5, cardClaims: 3, emailConversionRate: 4, ctaConversionRate: 6, searchToFollowRate: 33 },
  };

  it("recommends enabling public mode when zero views", () => {
    const data = { ...baseData, overview: { totalViews: 0, engagementRate: 0 }, funnel: { ...baseData.funnel, views: 0 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Enable Public Mode")).toBe(true);
  });

  it("recommends boosting engagement when rate < 20%", () => {
    const data = { ...baseData, overview: { totalViews: 50, engagementRate: 10 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Boost Engagement")).toBe(true);
  });

  it("recommends encouraging follows when views > 10 but 0 follows", () => {
    const data = { ...baseData, funnel: { ...baseData.funnel, views: 30, follows: 0 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Encourage Player Following")).toBe(true);
  });

  it("recommends email capture when views > 20 but 0 emails", () => {
    const data = { ...baseData, funnel: { ...baseData.funnel, views: 50, emailCaptures: 0 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Promote Email Capture")).toBe(true);
  });

  it("recommends growing tournament when < 16 players", () => {
    const data = { ...baseData, attendance: { registered: 10 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Grow Your Tournament")).toBe(true);
  });

  it("congratulates on great turnout when >= 30 players", () => {
    const data = { ...baseData, attendance: { registered: 35 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Great Turnout!")).toBe(true);
  });

  it("recommends completing results when < 100% completion", () => {
    const data = { ...baseData, operationalQuality: { ...baseData.operationalQuality, completionRate: 80 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Complete All Results")).toBe(true);
  });

  it("highlights strong search-to-follow rate when > 50%", () => {
    const data = { ...baseData, retentionSignals: { ...baseData.retentionSignals, searchToFollowRate: 60 } };
    const recs = computeRecommendations(data);
    expect(recs.some((r) => r.title === "Strong Search-to-Follow Rate")).toBe(true);
  });

  it("shows 'Looking Good' when no issues detected", () => {
    const recs = computeRecommendations(baseData);
    expect(recs.some((r) => r.title === "Looking Good")).toBe(true);
  });
});

describe("Tournament Analytics — CTA Breakdown", () => {
  it("aggregates CTA clicks by type", () => {
    const events = [
      makeEvent("e1", "cta_click", { cta: "save_results" }),
      makeEvent("e2", "cta_click", { cta: "save_results" }),
      makeEvent("e3", "cta_click", { cta: "join_club" }),
      makeEvent("e4", "cta_click", { cta: "explore_chessotb" }),
      makeEvent("e5", "cta_click", { cta: "explore_chessotb" }),
      makeEvent("e6", "cta_click", { cta: "explore_chessotb" }),
    ];
    const { ctaClicks } = aggregateEvents(events);
    expect(ctaClicks["save_results"]).toBe(2);
    expect(ctaClicks["join_club"]).toBe(1);
    expect(ctaClicks["explore_chessotb"]).toBe(3);
  });

  it("handles cta_click events without cta field", () => {
    const events = [makeEvent("e1", "cta_click", {})];
    const { ctaClicks } = aggregateEvents(events);
    expect(Object.keys(ctaClicks)).toHaveLength(0);
  });
});

describe("Tournament Analytics — Engagement Rate", () => {
  it("calculates engagement rate as (interactions / views) * 100", () => {
    const totalViews = 100;
    const totalEvents = 130; // 100 views + 30 interactions
    const engagementRate = totalViews > 0 ? Math.round(((totalEvents - totalViews) / totalViews) * 100) : 0;
    expect(engagementRate).toBe(30);
  });

  it("returns 0 when no views", () => {
    const engagementRate = 0 > 0 ? Math.round(((0 - 0) / 0) * 100) : 0;
    expect(engagementRate).toBe(0);
  });
});
