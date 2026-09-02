import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ClubProfile.tsx"), "utf8");
const heroSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/club/ClubHero.tsx"), "utf8");

describe("Club Home profile layout", () => {
  it("adds a named, functional profile highlight row rather than decorative controls", () => {
    expect(source).toContain('aria-label="Club highlights"');
    expect(source).toContain('label: "Updates"');
    expect(source).toContain('label: "Events"');
    expect(source).toContain('label: "Members"');
    expect(source).toContain('label: "Photos"');
    expect(source).toContain('onClick={() => handleTabChange(id)}');
  });

  it("keeps Home content readable in a responsive profile grid", () => {
    expect(source).toContain('aria-labelledby="club-home-content"');
    expect(source).toContain('grid grid-cols-1 gap-4 lg:grid-cols-2');
    expect(source).toContain('id="club-home-content"');
    expect(source).toContain('lg:col-span-2');
    expect(source).toContain('overflow-x-auto');
    expect(source).toContain('focus-visible:ring-2 focus-visible:ring-[#4CAF50]');
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
