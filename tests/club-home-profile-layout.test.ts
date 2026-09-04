import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ClubProfile.tsx"), "utf8");
const heroSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/club/ClubHero.tsx"), "utf8");

describe("Club Home profile layout", () => {
  it("removes the duplicate in-content tab navigation in favor of the primary club navigation", () => {
    expect(source).not.toContain('aria-label="Club highlights"');
    expect(source).not.toContain('label: "Updates", Icon: OtbFeed');
    expect(source).toContain('isOwner={isOwner}');
    expect(source).toContain('joined={joined}');
  });

  it("keeps Home content readable in a responsive profile grid", () => {
    expect(source).toContain('aria-labelledby="club-home-content"');
    expect(source).toContain('grid grid-cols-1 gap-4 lg:grid-cols-2');
    expect(source).toContain('id="club-home-content"');
    expect(source).toContain('lg:col-span-2');
    expect(source).toContain('overflow-x-auto');
  });

  it("uses a readable typography scale throughout the Club Home content section", () => {
    expect(source).toContain('text-base font-bold sm:text-lg ${textMain}');
    expect(source).toContain('text-base leading-7 sm:text-[1.0625rem]');
    expect(source).toContain('text-base font-semibold uppercase tracking-wider sm:text-[1.0625rem]');
    expect(source).toContain('className={`text-sm ${textMuted}`}');
    expect(source).toContain('max-w-[64px] truncate text-xs font-medium');
  });

  it("preserves real owner and visitor profile actions around the redesigned Home content", () => {
    expect(source).toContain('isOwner={isOwner}');
    expect(source).toContain('joined={joined}');
    expect(source).toContain('joined\n              ? (["home", "feed", "events", "members", "album", "leagues"] as const)');
    expect(heroSource).toContain('(!isOwner && !isDirector)');
    expect(heroSource).toContain('aria-label={isPublic ? "Join club" : "Request to join club"}');
    expect(heroSource).toContain('{(isOwner || isDirector) && (');
  });

  it("uses a recognizably profile-first identity header with balanced club statistics", () => {
    expect(heroSource).toContain('rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden p-1');
    expect(heroSource).toContain('linear-gradient(135deg, ${accent}, rgba(255,255,255,0.62), ${accent})');
    expect(heroSource).toContain('<span>followers</span>');
    expect(heroSource).toContain('className="flex items-center gap-4 sm:gap-5 flex-wrap"');
  });
});
