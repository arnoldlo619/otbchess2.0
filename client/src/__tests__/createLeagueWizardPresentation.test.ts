import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(resolve(__dirname, "../components/CreateLeagueWizard.tsx"), "utf-8");

describe("CreateLeagueWizard presentation", () => {
  it("uses a readable hierarchy throughout the League creation funnel", () => {
    expect(source).toContain('data-testid="create-league-wizard"');
    expect(source).toContain('max-w-3xl');
    expect(source).toContain('text-[18px] font-semibold leading-none text-white');
    expect(source).toContain('text-3xl font-bold tracking-tight text-white sm:text-[32px]');
    expect(source).toContain('text-base leading-relaxed text-white/55');
    expect(source).toContain('text-base font-medium leading-relaxed text-white/90');
  });

  it("removes decorative AI-style glyphs while retaining accessible utility controls", () => {
    expect(source).not.toMatch(/\b(Sparkles|Trophy|RotateCcw|ShieldCheck|Crown)\b/);
    expect(source).not.toMatch(/[🏆✨🛡⚔📅👑]/u);
    expect(source).toContain('<CheckCircle2');
    expect(source).toContain('<ChevronLeft');
    expect(source).toContain('<ChevronRight');
    expect(source).toContain('<X');
  });

  it("keeps step navigation and the final primary action clear at enlarged sizes", () => {
    expect(source).toContain('aria-label={`Step ${current + 1} of 4`}');
    expect(source).toContain('min-h-11 items-center gap-2 rounded-xl');
    expect(source).toContain('text-base font-bold text-[oklch(0.12_0.04_145)]');
    expect(source).toContain('Create league');
  });
});
