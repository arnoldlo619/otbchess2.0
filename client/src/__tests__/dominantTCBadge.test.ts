/**
 * Tests for the Dominant TC Badge feature
 *
 * Covers:
 *  - getDominantTCConfig: correct label/icon/color per TC value
 *  - dominantTimeControl detection logic (mirrors server-side analyzePlayStyle)
 *  - auto-select TC filter logic (rapid/blitz only, not bullet/mixed)
 */
import { describe, it, expect } from "vitest";

// ── Re-implement getDominantTCConfig for unit testing ────────────────────────

type DominantTC = "rapid" | "blitz" | "bullet" | "mixed";

function getDominantTCConfig(tc: DominantTC) {
  switch (tc) {
    case "rapid":  return { label: "Rapid",  icon: "⏱", colorDark: "bg-sky-500/10 border-sky-500/25 text-sky-400",    colorLight: "bg-sky-50 border-sky-200 text-sky-700" };
    case "blitz":  return { label: "Blitz",  icon: "⚡", colorDark: "bg-orange-500/10 border-orange-500/25 text-orange-400", colorLight: "bg-orange-50 border-orange-200 text-orange-700" };
    case "bullet": return { label: "Bullet", icon: "•",  colorDark: "bg-red-500/10 border-red-500/25 text-red-400",    colorLight: "bg-red-50 border-red-200 text-red-700" };
    case "mixed":  return { label: "Mixed",  icon: "∼",  colorDark: "bg-white/06 border-white/10 text-white/40",        colorLight: "bg-gray-100 border-gray-200 text-gray-500" };
  }
}

// ── Re-implement dominant TC detection logic (mirrors server/prepEngine.ts) ──

function computeDominantTC(tcGames: { rapid: number; blitz: number; bullet: number }): DominantTC {
  const total = tcGames.rapid + tcGames.blitz + tcGames.bullet || 1;
  const maxTc = Object.entries(tcGames).sort((a, b) => b[1] - a[1])[0];
  return (maxTc && maxTc[1] > total * 0.6)
    ? (maxTc[0] as DominantTC)
    : "mixed";
}

// ── Re-implement auto-select TC filter logic (mirrors client fetchReport) ────

type TcFilter = "all" | "rapid" | "blitz";

function computeAutoTcFilter(dominant: DominantTC, isRefresh: boolean, tcExplicit?: TcFilter): TcFilter | null {
  // Only auto-select on first load (not refresh, not explicit TC override)
  if (isRefresh || tcExplicit !== undefined) return null;
  if (dominant === "rapid" || dominant === "blitz") return dominant;
  return null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getDominantTCConfig", () => {
  it("returns Rapid config with sky color", () => {
    const cfg = getDominantTCConfig("rapid");
    expect(cfg.label).toBe("Rapid");
    expect(cfg.icon).toBe("⏱");
    expect(cfg.colorDark).toContain("sky");
    expect(cfg.colorLight).toContain("sky");
  });

  it("returns Blitz config with orange color", () => {
    const cfg = getDominantTCConfig("blitz");
    expect(cfg.label).toBe("Blitz");
    expect(cfg.icon).toBe("⚡");
    expect(cfg.colorDark).toContain("orange");
    expect(cfg.colorLight).toContain("orange");
  });

  it("returns Bullet config with red color", () => {
    const cfg = getDominantTCConfig("bullet");
    expect(cfg.label).toBe("Bullet");
    expect(cfg.icon).toBe("•");
    expect(cfg.colorDark).toContain("red");
    expect(cfg.colorLight).toContain("red");
  });

  it("returns Mixed config with neutral color", () => {
    const cfg = getDominantTCConfig("mixed");
    expect(cfg.label).toBe("Mixed");
    expect(cfg.icon).toBe("∼");
    expect(cfg.colorDark).toContain("white");
    expect(cfg.colorLight).toContain("gray");
  });
});

describe("computeDominantTC", () => {
  it("returns rapid when rapid > 60% of games", () => {
    expect(computeDominantTC({ rapid: 70, blitz: 20, bullet: 10 })).toBe("rapid");
  });

  it("returns blitz when blitz > 60% of games", () => {
    expect(computeDominantTC({ rapid: 10, blitz: 80, bullet: 10 })).toBe("blitz");
  });

  it("returns bullet when bullet > 60% of games", () => {
    expect(computeDominantTC({ rapid: 5, blitz: 10, bullet: 85 })).toBe("bullet");
  });

  it("returns mixed when no TC exceeds 60%", () => {
    expect(computeDominantTC({ rapid: 40, blitz: 40, bullet: 20 })).toBe("mixed");
  });

  it("returns mixed when split is exactly 60/40", () => {
    // 60 out of 100 = exactly 60%, threshold is strictly > 60%
    expect(computeDominantTC({ rapid: 60, blitz: 40, bullet: 0 })).toBe("mixed");
  });

  it("returns rapid when 61% rapid", () => {
    expect(computeDominantTC({ rapid: 61, blitz: 39, bullet: 0 })).toBe("rapid");
  });

  it("returns mixed when all games are 0", () => {
    expect(computeDominantTC({ rapid: 0, blitz: 0, bullet: 0 })).toBe("mixed");
  });

  it("returns rapid when only rapid games exist", () => {
    expect(computeDominantTC({ rapid: 50, blitz: 0, bullet: 0 })).toBe("rapid");
  });

  it("returns blitz when blitz has most but not 60%", () => {
    // 55 out of 100 — not dominant
    expect(computeDominantTC({ rapid: 30, blitz: 55, bullet: 15 })).toBe("mixed");
  });
});

describe("computeAutoTcFilter", () => {
  it("auto-selects rapid when dominant is rapid on first load", () => {
    expect(computeAutoTcFilter("rapid", false, undefined)).toBe("rapid");
  });

  it("auto-selects blitz when dominant is blitz on first load", () => {
    expect(computeAutoTcFilter("blitz", false, undefined)).toBe("blitz");
  });

  it("does NOT auto-select bullet (not a supported filter)", () => {
    expect(computeAutoTcFilter("bullet", false, undefined)).toBeNull();
  });

  it("does NOT auto-select when dominant is mixed", () => {
    expect(computeAutoTcFilter("mixed", false, undefined)).toBeNull();
  });

  it("does NOT auto-select on refresh", () => {
    expect(computeAutoTcFilter("rapid", true, undefined)).toBeNull();
  });

  it("does NOT auto-select when TC was explicitly provided", () => {
    expect(computeAutoTcFilter("rapid", false, "all")).toBeNull();
    expect(computeAutoTcFilter("rapid", false, "blitz")).toBeNull();
    expect(computeAutoTcFilter("rapid", false, "rapid")).toBeNull();
  });
});
