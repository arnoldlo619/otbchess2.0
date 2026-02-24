/**
 * Tests for Share Results message generation helpers.
 *
 * We test the pure functions that build WhatsApp messages, email bodies,
 * and deep-link URLs — without any DOM or network dependencies.
 */

import { describe, it, expect } from "vitest";
import type { PlayerPerformance } from "@/lib/performanceStats";
import type { Player } from "@/lib/tournamentData";

// ─── Replicate helpers from ShareResultsModal (pure functions) ────────────────

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function platformProfileUrl(perf: PlayerPerformance): string {
  const { platform, username } = perf.player;
  if (platform === "lichess") return `https://lichess.org/@/${username}`;
  return `https://www.chess.com/member/${username}`;
}

function buildWhatsAppMessage(
  perf: PlayerPerformance,
  tournamentName: string,
  reportUrl: string
): string {
  const rank = ordinal(perf.rank);
  const record = `${perf.wins}W / ${perf.draws}D / ${perf.losses}L`;
  const profileUrl = platformProfileUrl(perf);

  const lines = [
    `♟️ *${tournamentName}* — Final Results`,
    ``,
    `Hi ${perf.player.name}! Here are your results:`,
    ``,
    `🏅 Rank: *${rank}* place`,
    `📊 Score: *${perf.points} pts* (${record})`,
    `📈 Performance Rating: *${perf.performanceRating}*`,
    ``,
    `🔗 Your profile: ${profileUrl}`,
    reportUrl ? `📋 Full report: ${reportUrl}` : "",
    ``,
    `Great game! See you at the next tournament. 🏆`,
  ].filter((l) => l !== null);

  return lines.join("\n");
}

function buildEmailSubject(perf: PlayerPerformance, tournamentName: string): string {
  return `Your results from ${tournamentName} — ${ordinal(perf.rank)} place`;
}

function whatsAppLink(phone: string | undefined, message: string): string {
  const encoded = encodeURIComponent(message);
  if (phone) {
    const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

function mailtoLink(email: string | undefined, subject: string, body: string): string {
  const to = email ?? "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Magnus Eriksson",
    username: "magnuserik",
    elo: 2241,
    title: "FM",
    country: "SE",
    points: 3.5,
    wins: 3,
    draws: 1,
    losses: 0,
    buchholz: 8.0,
    colorHistory: ["W", "B", "W"],
    platform: "chesscom",
    ...overrides,
  };
}

function makePerf(playerOverrides: Partial<Player> = {}): PlayerPerformance {
  const player = makePlayer(playerOverrides);
  return {
    player,
    rank: 1,
    points: player.points,
    wins: player.wins,
    draws: player.draws,
    losses: player.losses,
    buchholz: player.buchholz,
    performanceRating: 2350,
    badges: [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ordinal", () => {
  it("returns 1st for 1", () => expect(ordinal(1)).toBe("1st"));
  it("returns 2nd for 2", () => expect(ordinal(2)).toBe("2nd"));
  it("returns 3rd for 3", () => expect(ordinal(3)).toBe("3rd"));
  it("returns 4th for 4", () => expect(ordinal(4)).toBe("4th"));
  it("returns 10th for 10", () => expect(ordinal(10)).toBe("10th"));
  it("returns 11th for 11", () => expect(ordinal(11)).toBe("11th"));
});

describe("platformProfileUrl", () => {
  it("returns chess.com URL for chesscom platform", () => {
    const perf = makePerf({ platform: "chesscom", username: "magnuserik" });
    expect(platformProfileUrl(perf)).toBe("https://www.chess.com/member/magnuserik");
  });

  it("returns Lichess URL for lichess platform", () => {
    const perf = makePerf({ platform: "lichess", username: "magnuserik" });
    expect(platformProfileUrl(perf)).toBe("https://lichess.org/@/magnuserik");
  });

  it("defaults to chess.com when platform is undefined", () => {
    const perf = makePerf({ platform: undefined, username: "testuser" });
    expect(platformProfileUrl(perf)).toBe("https://www.chess.com/member/testuser");
  });
});

describe("buildWhatsAppMessage", () => {
  it("includes tournament name", () => {
    const perf = makePerf();
    const msg = buildWhatsAppMessage(perf, "Spring Open 2026", "");
    expect(msg).toContain("Spring Open 2026");
  });

  it("includes player name", () => {
    const perf = makePerf({ name: "Magnus Eriksson" });
    const msg = buildWhatsAppMessage(perf, "Test", "");
    expect(msg).toContain("Magnus Eriksson");
  });

  it("includes rank as ordinal", () => {
    const perf = makePerf();
    perf.rank = 1;
    const msg = buildWhatsAppMessage(perf, "Test", "");
    expect(msg).toContain("1st");
  });

  it("includes W/D/L record", () => {
    const perf = makePerf({ wins: 3, draws: 1, losses: 0 });
    const msg = buildWhatsAppMessage(perf, "Test", "");
    expect(msg).toContain("3W / 1D / 0L");
  });

  it("includes performance rating", () => {
    const perf = makePerf();
    perf.performanceRating = 2350;
    const msg = buildWhatsAppMessage(perf, "Test", "");
    expect(msg).toContain("2350");
  });

  it("includes report URL when provided", () => {
    const perf = makePerf();
    const msg = buildWhatsAppMessage(perf, "Test", "https://example.com/report");
    expect(msg).toContain("https://example.com/report");
  });

  it("omits report URL line when empty string", () => {
    const perf = makePerf();
    const msg = buildWhatsAppMessage(perf, "Test", "");
    expect(msg).not.toContain("Full report:");
  });

  it("includes chess.com profile link", () => {
    const perf = makePerf({ platform: "chesscom", username: "magnuserik" });
    const msg = buildWhatsAppMessage(perf, "Test", "");
    expect(msg).toContain("chess.com/member/magnuserik");
  });
});

describe("buildEmailSubject", () => {
  it("includes tournament name and ordinal rank", () => {
    const perf = makePerf();
    perf.rank = 2;
    const subject = buildEmailSubject(perf, "Club Championship");
    expect(subject).toBe("Your results from Club Championship — 2nd place");
  });

  it("uses 1st for rank 1", () => {
    const perf = makePerf();
    perf.rank = 1;
    const subject = buildEmailSubject(perf, "Open");
    expect(subject).toContain("1st place");
  });
});

describe("whatsAppLink", () => {
  it("generates wa.me link with phone number when provided", () => {
    const link = whatsAppLink("+1-555-123-4567", "Hello");
    expect(link).toContain("wa.me/15551234567");
  });

  it("strips leading zeros from phone number", () => {
    const link = whatsAppLink("0044123456789", "Hello");
    expect(link).toContain("wa.me/44123456789");
  });

  it("generates wa.me link without phone when undefined", () => {
    const link = whatsAppLink(undefined, "Hello");
    expect(link).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("URL-encodes the message text", () => {
    const link = whatsAppLink(undefined, "Hello World!");
    expect(link).toContain(encodeURIComponent("Hello World!"));
  });
});

describe("mailtoLink", () => {
  it("includes email address in mailto", () => {
    const link = mailtoLink("test@example.com", "Subject", "Body");
    expect(link).toContain("mailto:test@example.com");
  });

  it("uses empty to when email is undefined", () => {
    const link = mailtoLink(undefined, "Subject", "Body");
    expect(link).toMatch(/^mailto:\?/);
  });

  it("URL-encodes subject and body", () => {
    const link = mailtoLink("a@b.com", "My Subject", "My Body");
    expect(link).toContain(encodeURIComponent("My Subject"));
    expect(link).toContain(encodeURIComponent("My Body"));
  });
});
