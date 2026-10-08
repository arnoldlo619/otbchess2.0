import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ClubDashboard.tsx"), "utf8");

describe("Club Owner Overview UI contract", () => {
  it("places owner quick actions in a responsive rail beside Club Timeline without card chrome", () => {
    expect(source).toContain('id="overview-quick-actions"');
    expect(source).toContain('data-club-overview-action-rail');
    expect(source).toContain('xl:grid-cols-[minmax(0,1fr)_216px]');
    expect(source).toContain('xl:sticky xl:top-6');
    expect(source).toContain('grid grid-cols-2 gap-x-2 gap-y-1 border-y py-2 xl:grid-cols-1');
    expect(source).toContain('label: "New Meetup"');
    expect(source).toContain('label: "Tournament"');
    expect(source).toContain('label: "Leagues"');
    expect(source).toContain('label: "Post"');
    expect(source).toContain('min-h-12');
    expect(source).not.toContain('mx-auto grid max-w-[720px] grid-cols-2 gap-3 sm:grid-cols-4');
  });

  it("renders Recent Activity as a theme-aware event-led list with a named view action", () => {
    expect(source).toContain('aria-labelledby="recent-club-activity"');
    expect(source).toContain('Club timeline');
    expect(source).toContain('const imageAttachment = ev.attachments?.find');
    expect(source).toContain('loading="lazy"');
    expect(source).toContain('aria-label={`View ${displayActivityTitle} in the feed`}');
    expect(source).toContain('background: isDark ? "oklch(0.155 0.045 145)" : "rgba(255,255,255,0.76)"');
  });

  it("keeps Recent Activity available with a readable empty state for new clubs", () => {
    expect(source).not.toContain('{feedEvents.length > 0 && (\n              <section className="overflow-hidden rounded-2xl border" aria-labelledby="recent-club-activity"');
    expect(source).toContain('{feedEvents.length === 0 ? (');
    expect(source).toContain('No activity yet');
    expect(source).toContain('Posts, event updates, and club conversations will appear here.');
    expect(source).toContain('aria-label="Open the club feed"');
    expect(source).toContain('min-h-[132px]');
    expect(source).toContain('sm:min-h-[148px]');
  });

  it("keeps tournament category labels visible and renders a single trophy treatment", () => {
    expect(source).toContain('const activityKind = ev.type === "rsvp_form" ? "Event" : isTournamentActivity ? "Tournaments"');
    expect(source).toContain('h-[96px] w-[116px]');
    expect(source).toContain('sm:h-[112px] sm:w-[136px]');
    expect(source).toContain('activityTitle?.replace(/^(?:🏆\\s*)+/, "").trim()');
    expect(source).toContain('>{activityKind}</span>');
    expect(source).not.toContain('<ActivityIcon className=');
  });
});
