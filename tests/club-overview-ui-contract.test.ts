import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ClubDashboard.tsx"), "utf8");

describe("Club Owner Overview UI contract", () => {
  it("places larger owner quick actions in a sticky rail with clear desktop separation", () => {
    expect(source).toContain('id="overview-quick-actions"');
    expect(source).toContain('data-club-overview-action-rail');
    expect(source).toContain('min-[1440px]:absolute min-[1440px]:inset-y-0 min-[1440px]:left-full');
    expect(source).toContain('min-[1440px]:ml-14 min-[1440px]:w-[224px]');
    expect(source).toContain('min-[1440px]:sticky min-[1440px]:top-6');
    expect(source).toContain('min-[1440px]:relative min-[1440px]:block');
    expect(source).toContain('min-[1440px]:pl-8');
    expect(source).toContain('min-[1440px]:-ml-[42px]');
    expect(source).toContain('min-[1440px]:min-h-12');
    expect(source).toContain('min-[1440px]:text-base');
    expect(source).toContain('label: "New Meetup"');
    expect(source).toContain('label: "Tournament"');
    expect(source).toContain('label: "Leagues"');
    expect(source).toContain('label: "Post"');
    expect(source).toContain('min-[1440px]:hover:bg-transparent');
    expect(source).not.toContain('mx-auto grid max-w-[720px] grid-cols-2 gap-3 sm:grid-cols-4');
  });

  it("renders Next Event with the same editorial media-row system as Recent Activity", () => {
    expect(source).toContain('data-club-overview-next-event');
    expect(source).toContain('aria-labelledby="next-club-event"');
    expect(source).toContain('Club schedule');
    expect(source).toContain('const nextEventImage = next.coverImageUrl ?? club.bannerUrl;');
    expect(source).toContain('className="group flex min-h-[132px] gap-3 px-4 py-4');
    expect(source).toContain('sm:min-h-[148px]');
    expect(source).toContain('h-[96px] w-[116px]');
    expect(source).toContain('sm:h-[112px] sm:w-[136px]');
    expect(source).toContain('aria-label={`Open RSVPs for ${next.title}`}');
    expect(source).toContain('View all');
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
