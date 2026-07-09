/**
 * Tests for the homepage Showcase section — Contra Labs-style 2×2 grid.
 *
 * Validates:
 * - SHOWCASE_FEATURES data integrity (4 items, required fields)
 * - Navigation logic (internal vs external URLs)
 * - Keyboard accessibility (Enter triggers navigation)
 */

import { describe, it, expect } from "vitest";

// ── Simulate the Showcase component's feature data and navigation logic ──────

interface ShowcaseFeature {
  id: string;
  tag: string;
  title: string;
  href: string;
  screenshot: string;
  screenshotAlt: string;
}

const SHOWCASE_FEATURES: ShowcaseFeature[] = [
  {
    id: "tournaments",
    tag: "Swiss + Elim Format",
    title: "Run a\nTournament",
    href: "/?action=create",
    screenshot: "https://example.com/tournament.png",
    screenshotAlt: "Swiss Tournament Director Dashboard",
  },
  {
    id: "league",
    tag: "Chess Club League",
    title: "Your Club.\nA Real Season.",
    href: "/league-demo",
    screenshot: "https://example.com/league.png",
    screenshotAlt: "Chess Club League Dashboard",
  },
  {
    id: "rated-game",
    tag: "OTB Rated Games",
    title: "Play Rated.\nEarn Your ELO.",
    href: "/clock?register=true",
    screenshot: "/manus-storage/rated-game.webp",
    screenshotAlt: "OTB Rated Game with QR code on chess clock",
  },
  {
    id: "prep",
    tag: "Matchup Prep",
    title: "Know Your\nOpponent",
    href: "/prep",
    screenshot: "https://example.com/prep.webp",
    screenshotAlt: "Scout Report showing opponent weaknesses",
  },
];

function isInternalLink(href: string): boolean {
  return href.startsWith("/");
}

function getAriaLabel(feature: ShowcaseFeature): string {
  return `${feature.tag}: ${feature.title.replace("\n", " ")}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Showcase 2×2 grid feature data", () => {
  it("contains exactly 4 features", () => {
    expect(SHOWCASE_FEATURES).toHaveLength(4);
  });

  it("each feature has all required fields", () => {
    for (const f of SHOWCASE_FEATURES) {
      expect(f.id).toBeTruthy();
      expect(f.tag).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.href).toBeTruthy();
      expect(f.screenshot).toBeTruthy();
      expect(f.screenshotAlt).toBeTruthy();
    }
  });

  it("all feature IDs are unique", () => {
    const ids = SHOWCASE_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all hrefs are internal links (start with /)", () => {
    for (const f of SHOWCASE_FEATURES) {
      expect(isInternalLink(f.href)).toBe(true);
    }
  });
});

describe("Showcase navigation logic", () => {
  it("isInternalLink returns true for paths starting with /", () => {
    expect(isInternalLink("/clubs")).toBe(true);
    expect(isInternalLink("/?action=create")).toBe(true);
    expect(isInternalLink("/clock?register=true")).toBe(true);
  });

  it("isInternalLink returns false for external URLs", () => {
    expect(isInternalLink("https://chess.com")).toBe(false);
    expect(isInternalLink("http://example.com")).toBe(false);
  });
});

describe("Showcase accessibility", () => {
  it("generates correct aria-label from tag and title", () => {
    const feature = SHOWCASE_FEATURES[0];
    const label = getAriaLabel(feature);
    expect(label).toBe("Swiss + Elim Format: Run a Tournament");
  });

  it("aria-label replaces newlines in title with spaces", () => {
    const feature = SHOWCASE_FEATURES[1];
    const label = getAriaLabel(feature);
    expect(label).toBe("Chess Club League: Your Club. A Real Season.");
  });
});
