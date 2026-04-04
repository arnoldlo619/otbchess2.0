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

// ─── Phase 5 Refinements: New Analytics Sections ─────────────────────────────

// ── Attendance Breakdown helpers ──────────────────────────────────────────────

interface AttendanceBreakdown {
  preRegistered: number;
  walkIns: number;
  lateAdds: number;
  finalField: number;
  noShows: number;
  walkInRate: number;
  noShowRate: number;
}

function computeAttendanceBreakdown(state: any): AttendanceBreakdown {
  const players: any[] = state.players ?? [];
  const rounds: any[] = state.rounds ?? [];

  // Determine round 1 start time from first game timestamp
  let round1StartMs: number | null = null;
  if (rounds.length > 0) {
    for (const g of rounds[0].games ?? []) {
      if (g.startedAt && (!round1StartMs || g.startedAt < round1StartMs)) {
        round1StartMs = g.startedAt;
      }
    }
  }

  let preReg = 0;
  let walkIn = 0;
  for (const p of players) {
    if (round1StartMs && p.joinedAt && p.joinedAt > round1StartMs) walkIn++;
    else preReg++;
  }

  // No-shows: players who never appeared in any completed game
  let noShows = 0;
  if (rounds.length > 0) {
    const playedIds = new Set<string>();
    for (const r of rounds) {
      for (const g of r.games ?? []) {
        if (g.result && g.result !== "*") {
          if (g.whiteId) playedIds.add(g.whiteId);
          if (g.blackId) playedIds.add(g.blackId);
        }
      }
    }
    for (const p of players) {
      if (!playedIds.has(p.id) && p.id !== "BYE") noShows++;
    }
  }

  const finalField = players.length;
  return {
    preRegistered: preReg,
    walkIns: walkIn,
    lateAdds: walkIn,
    finalField,
    noShows,
    walkInRate: finalField > 0 ? Math.round((walkIn / finalField) * 100) : 0,
    noShowRate: finalField > 0 ? Math.round((noShows / finalField) * 100) : 0,
  };
}

// ── Post-Event Conversion helpers ─────────────────────────────────────────────

interface PostEventConversion {
  emailsOptedIn: number;
  cardsClaimed: number;
  joinClubClicks: number;
  createAccountClicks: number;
  anonToLeadRate: number;
  emailCaptureRate: number;
  cardClaimRate: number;
}

function computePostEventConversion(
  totalViews: number,
  totalEmails: number,
  totalCardClaims: number,
  ctaClicks: Record<string, number>
): PostEventConversion {
  return {
    emailsOptedIn: totalEmails,
    cardsClaimed: totalCardClaims,
    joinClubClicks: ctaClicks["join_club"] ?? 0,
    createAccountClicks: ctaClicks["create_account"] ?? 0,
    anonToLeadRate:
      totalViews > 0
        ? Math.round(((totalEmails + totalCardClaims) / totalViews) * 100)
        : 0,
    emailCaptureRate:
      totalViews > 0 ? Math.round((totalEmails / totalViews) * 100) : 0,
    cardClaimRate:
      totalViews > 0 ? Math.round((totalCardClaims / totalViews) * 100) : 0,
  };
}

// ── Club Growth helpers ───────────────────────────────────────────────────────

interface ClubGrowth {
  totalLeadsGenerated: number;
  emailLeads: number;
  cardClaimLeads: number;
  clubJoinClicks: number;
  createAccountClicks: number;
  totalCtaConversions: number;
  leadConversionRate: number;
}

function computeClubGrowth(
  totalViews: number,
  totalEmails: number,
  totalCardClaims: number,
  ctaClicks: Record<string, number>
): ClubGrowth {
  const totalCtaConversions = Object.values(ctaClicks).reduce(
    (a: number, b: number) => a + b,
    0
  );
  return {
    totalLeadsGenerated: totalEmails + totalCardClaims,
    emailLeads: totalEmails,
    cardClaimLeads: totalCardClaims,
    clubJoinClicks: ctaClicks["join_club"] ?? 0,
    createAccountClicks: ctaClicks["create_account"] ?? 0,
    totalCtaConversions,
    leadConversionRate:
      totalViews > 0
        ? Math.round(((totalEmails + totalCardClaims) / totalViews) * 100)
        : 0,
  };
}

// ── Repeat-Event Growth helpers ───────────────────────────────────────────────

interface RepeatEventGrowth {
  newPlayers: number;
  returningPlayers: number;
  repeatRate: number;
  multiEventPlayers: number;
}

function computeRepeatEventGrowth(
  currentUsernames: string[],
  pastUsernames: string[]
): RepeatEventGrowth {
  const current = new Set(currentUsernames.map((u) => u.toLowerCase()).filter(Boolean));
  const past = new Set(pastUsernames.map((u) => u.toLowerCase()).filter(Boolean));
  const returning = [...current].filter((u) => past.has(u)).length;
  const total = current.size;
  return {
    newPlayers: total - returning,
    returningPlayers: returning,
    repeatRate: total > 0 ? Math.round((returning / total) * 100) : 0,
    multiEventPlayers: returning,
  };
}

// ── Tournament Comparison helpers ─────────────────────────────────────────────

interface PastEvent {
  id: string;
  name: string;
  playerCount: number;
}

function computeTournamentComparison(
  pastEvents: PastEvent[],
  thisEventPlayerCount: number
): { avgAttendance: number; thisEventRank: number } {
  const sorted = pastEvents.slice(-5).reverse();
  const avgAttendance =
    sorted.length > 0
      ? Math.round(
          sorted.reduce((s, e) => s + e.playerCount, 0) / sorted.length
        )
      : 0;
  const allCounts = [
    ...sorted.map((e) => e.playerCount),
    thisEventPlayerCount,
  ].sort((a, b) => b - a);
  const thisEventRank = allCounts.indexOf(thisEventPlayerCount) + 1;
  return { avgAttendance, thisEventRank };
}

// ─── Attendance Breakdown Tests ───────────────────────────────────────────────

describe("Tournament Analytics — Attendance Breakdown", () => {
  it("counts all players as pre-registered when no round start time", () => {
    const state = {
      players: [
        { id: "p1", username: "alice", joinedAt: 1000 },
        { id: "p2", username: "bob", joinedAt: 2000 },
      ],
      rounds: [],
    };
    const result = computeAttendanceBreakdown(state);
    expect(result.preRegistered).toBe(2);
    expect(result.walkIns).toBe(0);
    expect(result.finalField).toBe(2);
  });

  it("identifies walk-ins as players who joined after round 1 started", () => {
    const round1StartMs = 5000;
    const state = {
      players: [
        { id: "p1", username: "alice", joinedAt: 3000 }, // before round 1
        { id: "p2", username: "bob", joinedAt: 7000 },   // after round 1 (walk-in)
        { id: "p3", username: "carol", joinedAt: 8000 },  // after round 1 (walk-in)
      ],
      rounds: [
        { games: [{ startedAt: round1StartMs, whiteId: "p1", blackId: "p2", result: "1-0" }] },
      ],
    };
    const result = computeAttendanceBreakdown(state);
    expect(result.walkIns).toBe(2);
    expect(result.preRegistered).toBe(1);
    expect(result.walkInRate).toBe(67); // 2/3 = 67%
  });

  it("detects no-shows as players with no completed games", () => {
    const state = {
      players: [
        { id: "p1", username: "alice" },
        { id: "p2", username: "bob" },
        { id: "p3", username: "carol" }, // no-show
      ],
      rounds: [
        {
          games: [
            { whiteId: "p1", blackId: "p2", result: "1-0" },
          ],
        },
      ],
    };
    const result = computeAttendanceBreakdown(state);
    expect(result.noShows).toBe(1);
    expect(result.noShowRate).toBe(33); // 1/3 = 33%
  });

  it("returns zeros for empty state", () => {
    const result = computeAttendanceBreakdown({ players: [], rounds: [] });
    expect(result.finalField).toBe(0);
    expect(result.preRegistered).toBe(0);
    expect(result.walkIns).toBe(0);
    expect(result.noShows).toBe(0);
    expect(result.walkInRate).toBe(0);
    expect(result.noShowRate).toBe(0);
  });

  it("does not count BYE player as no-show", () => {
    const state = {
      players: [
        { id: "p1", username: "alice" },
        { id: "BYE", username: "" },
      ],
      rounds: [
        {
          games: [
            { whiteId: "p1", blackId: "BYE", result: "1-0" },
          ],
        },
      ],
    };
    const result = computeAttendanceBreakdown(state);
    expect(result.noShows).toBe(0);
  });

  it("computes walk-in rate as percentage of final field", () => {
    const round1StartMs = 5000;
    const state = {
      players: [
        { id: "p1", joinedAt: 1000 },
        { id: "p2", joinedAt: 2000 },
        { id: "p3", joinedAt: 6000 }, // walk-in
        { id: "p4", joinedAt: 7000 }, // walk-in
      ],
      rounds: [
        { games: [{ startedAt: round1StartMs, whiteId: "p1", blackId: "p2", result: "1-0" }] },
      ],
    };
    const result = computeAttendanceBreakdown(state);
    expect(result.walkInRate).toBe(50); // 2/4 = 50%
  });
});

// ─── Post-Event Conversion Tests ──────────────────────────────────────────────

describe("Tournament Analytics — Post-Event Conversion", () => {
  it("computes anon-to-lead rate from emails + card claims", () => {
    const result = computePostEventConversion(100, 5, 3, {});
    expect(result.anonToLeadRate).toBe(8); // (5+3)/100 = 8%
    expect(result.emailCaptureRate).toBe(5); // 5/100 = 5%
    expect(result.cardClaimRate).toBe(3); // 3/100 = 3%
  });

  it("returns zero rates when no views", () => {
    const result = computePostEventConversion(0, 5, 3, {});
    expect(result.anonToLeadRate).toBe(0);
    expect(result.emailCaptureRate).toBe(0);
    expect(result.cardClaimRate).toBe(0);
  });

  it("extracts join_club and create_account CTA clicks", () => {
    const cta = { join_club: 7, create_account: 3, save_results: 10 };
    const result = computePostEventConversion(100, 0, 0, cta);
    expect(result.joinClubClicks).toBe(7);
    expect(result.createAccountClicks).toBe(3);
  });

  it("returns 0 for missing CTA keys", () => {
    const result = computePostEventConversion(100, 0, 0, {});
    expect(result.joinClubClicks).toBe(0);
    expect(result.createAccountClicks).toBe(0);
  });

  it("handles 100% email capture rate", () => {
    const result = computePostEventConversion(4, 4, 0, {});
    expect(result.emailCaptureRate).toBe(100);
  });

  it("counts emails and card claims as separate lead types", () => {
    const result = computePostEventConversion(200, 10, 6, {});
    expect(result.emailsOptedIn).toBe(10);
    expect(result.cardsClaimed).toBe(6);
    expect(result.anonToLeadRate).toBe(8); // 16/200 = 8%
  });
});

// ─── Club Growth Contribution Tests ──────────────────────────────────────────

describe("Tournament Analytics — Club Growth Contribution", () => {
  it("sums emails and card claims as total leads", () => {
    const result = computeClubGrowth(100, 8, 4, {});
    expect(result.totalLeadsGenerated).toBe(12);
    expect(result.emailLeads).toBe(8);
    expect(result.cardClaimLeads).toBe(4);
  });

  it("computes lead conversion rate correctly", () => {
    const result = computeClubGrowth(200, 10, 10, {});
    expect(result.leadConversionRate).toBe(10); // 20/200 = 10%
  });

  it("returns 0 lead conversion rate when no views", () => {
    const result = computeClubGrowth(0, 5, 5, {});
    expect(result.leadConversionRate).toBe(0);
  });

  it("sums all CTA clicks as totalCtaConversions", () => {
    const cta = { join_club: 5, create_account: 3, save_results: 10 };
    const result = computeClubGrowth(100, 0, 0, cta);
    expect(result.totalCtaConversions).toBe(18);
    expect(result.clubJoinClicks).toBe(5);
    expect(result.createAccountClicks).toBe(3);
  });

  it("returns all zeros for empty data", () => {
    const result = computeClubGrowth(0, 0, 0, {});
    expect(result.totalLeadsGenerated).toBe(0);
    expect(result.emailLeads).toBe(0);
    expect(result.cardClaimLeads).toBe(0);
    expect(result.clubJoinClicks).toBe(0);
    expect(result.createAccountClicks).toBe(0);
    expect(result.totalCtaConversions).toBe(0);
    expect(result.leadConversionRate).toBe(0);
  });
});

// ─── Repeat-Event Growth Tests ────────────────────────────────────────────────

describe("Tournament Analytics — Repeat-Event Growth", () => {
  it("identifies returning players from past events", () => {
    const current = ["alice", "bob", "carol"];
    const past = ["alice", "carol", "dave"];
    const result = computeRepeatEventGrowth(current, past);
    expect(result.returningPlayers).toBe(2); // alice + carol
    expect(result.newPlayers).toBe(1); // bob
    expect(result.repeatRate).toBe(67); // 2/3 = 67%
  });

  it("returns all new players when no past events", () => {
    const result = computeRepeatEventGrowth(["alice", "bob"], []);
    expect(result.returningPlayers).toBe(0);
    expect(result.newPlayers).toBe(2);
    expect(result.repeatRate).toBe(0);
  });

  it("is case-insensitive for username matching", () => {
    const current = ["Alice", "BOB"];
    const past = ["alice", "bob"];
    const result = computeRepeatEventGrowth(current, past);
    expect(result.returningPlayers).toBe(2);
    expect(result.newPlayers).toBe(0);
  });

  it("filters out empty usernames", () => {
    const current = ["alice", "", "bob"];
    const past = ["alice", ""];
    const result = computeRepeatEventGrowth(current, past);
    // Only non-empty usernames count: alice (returning), bob (new)
    expect(result.returningPlayers).toBe(1);
    expect(result.newPlayers).toBe(1);
  });

  it("returns zeros for empty current players", () => {
    const result = computeRepeatEventGrowth([], ["alice", "bob"]);
    expect(result.returningPlayers).toBe(0);
    expect(result.newPlayers).toBe(0);
    expect(result.repeatRate).toBe(0);
  });

  it("sets multiEventPlayers equal to returningPlayers", () => {
    const result = computeRepeatEventGrowth(["alice", "bob"], ["alice"]);
    expect(result.multiEventPlayers).toBe(result.returningPlayers);
  });

  it("handles 100% repeat rate when all players returned", () => {
    const result = computeRepeatEventGrowth(["alice", "bob"], ["alice", "bob", "carol"]);
    expect(result.repeatRate).toBe(100);
    expect(result.newPlayers).toBe(0);
  });
});

// ─── Tournament Comparison Tests ──────────────────────────────────────────────

describe("Tournament Analytics — Tournament Comparison", () => {
  it("computes average attendance from past events", () => {
    const past = [
      { id: "t1", name: "Event 1", playerCount: 20 },
      { id: "t2", name: "Event 2", playerCount: 30 },
      { id: "t3", name: "Event 3", playerCount: 25 },
    ];
    const result = computeTournamentComparison(past, 28);
    expect(result.avgAttendance).toBe(25); // (20+30+25)/3
  });

  it("ranks current event correctly among past events", () => {
    const past = [
      { id: "t1", name: "Event 1", playerCount: 20 },
      { id: "t2", name: "Event 2", playerCount: 30 },
    ];
    const result = computeTournamentComparison(past, 35); // best ever
    expect(result.thisEventRank).toBe(1);
  });

  it("ranks current event last when smallest", () => {
    const past = [
      { id: "t1", name: "Event 1", playerCount: 30 },
      { id: "t2", name: "Event 2", playerCount: 25 },
    ];
    const result = computeTournamentComparison(past, 10);
    expect(result.thisEventRank).toBe(3);
  });

  it("returns avgAttendance 0 when no past events", () => {
    const result = computeTournamentComparison([], 20);
    expect(result.avgAttendance).toBe(0);
  });

  it("limits comparison to last 5 events", () => {
    const past = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      name: `Event ${i}`,
      playerCount: 20 + i,
    }));
    // Only last 5 events should be used
    const result = computeTournamentComparison(past, 30);
    // Last 5 events have playerCounts 25,26,27,28,29 → avg = 27
    expect(result.avgAttendance).toBe(27);
  });

  it("handles tie in player count by returning a valid rank", () => {
    const past = [
      { id: "t1", name: "Event 1", playerCount: 20 },
    ];
    const result = computeTournamentComparison(past, 20); // tie
    expect(result.thisEventRank).toBeGreaterThanOrEqual(1);
    expect(result.thisEventRank).toBeLessThanOrEqual(2);
  });
});

// ─── Extended Recommendation Engine Tests ────────────────────────────────────

describe("Tournament Analytics — Extended Recommendations", () => {
  function computeExtendedRecommendations(data: {
    overview: { totalViews: number; engagementRate: number };
    funnel: { views: number; follows: number; emailCaptures: number };
    attendance: { registered: number };
    operationalQuality: { completionRate: number };
    retentionSignals: { searchToFollowRate: number };
    attendanceBreakdown?: { noShowRate: number };
    repeatEventGrowth?: { repeatRate: number };
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

    if (data.attendanceBreakdown && data.attendanceBreakdown.noShowRate > 20) {
      recs.push({ title: "Reduce No-Shows" });
    }

    if (data.repeatEventGrowth && data.repeatEventGrowth.repeatRate > 30) {
      recs.push({ title: "Strong Returning Player Base" });
    }

    if (recs.length === 0) {
      recs.push({ title: "Looking Good" });
    }

    return recs;
  }

  const baseData = {
    overview: { totalViews: 50, engagementRate: 30 },
    funnel: { views: 50, follows: 5, emailCaptures: 2 },
    attendance: { registered: 20 },
    operationalQuality: { completionRate: 100 },
    retentionSignals: { searchToFollowRate: 33 },
  };

  it("recommends reducing no-shows when rate > 20%", () => {
    const data = { ...baseData, attendanceBreakdown: { noShowRate: 25 } };
    const recs = computeExtendedRecommendations(data);
    expect(recs.some((r) => r.title === "Reduce No-Shows")).toBe(true);
  });

  it("does not recommend reducing no-shows when rate <= 20%", () => {
    const data = { ...baseData, attendanceBreakdown: { noShowRate: 15 } };
    const recs = computeExtendedRecommendations(data);
    expect(recs.some((r) => r.title === "Reduce No-Shows")).toBe(false);
  });

  it("highlights strong returning player base when repeat rate > 30%", () => {
    const data = { ...baseData, repeatEventGrowth: { repeatRate: 45 } };
    const recs = computeExtendedRecommendations(data);
    expect(recs.some((r) => r.title === "Strong Returning Player Base")).toBe(true);
  });

  it("does not highlight returning players when repeat rate <= 30%", () => {
    const data = { ...baseData, repeatEventGrowth: { repeatRate: 20 } };
    const recs = computeExtendedRecommendations(data);
    expect(recs.some((r) => r.title === "Strong Returning Player Base")).toBe(false);
  });

  it("can surface both no-show and returning player recommendations together", () => {
    const data = {
      ...baseData,
      attendanceBreakdown: { noShowRate: 30 },
      repeatEventGrowth: { repeatRate: 60 },
    };
    const recs = computeExtendedRecommendations(data);
    expect(recs.some((r) => r.title === "Reduce No-Shows")).toBe(true);
    expect(recs.some((r) => r.title === "Strong Returning Player Base")).toBe(true);
  });

  it("does not show 'Looking Good' when issues are detected", () => {
    const data = { ...baseData, attendanceBreakdown: { noShowRate: 30 } };
    const recs = computeExtendedRecommendations(data);
    expect(recs.some((r) => r.title === "Looking Good")).toBe(false);
  });
});
