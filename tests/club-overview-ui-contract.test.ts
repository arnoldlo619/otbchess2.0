import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ClubDashboard.tsx"), "utf8");

describe("Club Owner Overview UI contract", () => {
  it("keeps the three owner quick actions centered in a responsive, touch-safe grid", () => {
    expect(source).toContain('id="overview-quick-actions"');
    expect(source).toContain('mx-auto grid max-w-[560px] grid-cols-3');
    expect(source).toContain('label: "New Meetup"');
    expect(source).toContain('label: "Tournament"');
    expect(source).toContain('label: "Post"');
    expect(source).toContain('min-h-12');
  });

  it("renders Recent Activity as a theme-aware event-led list with a named view action", () => {
    expect(source).toContain('aria-labelledby="recent-club-activity"');
    expect(source).toContain('Club timeline');
    expect(source).toContain('const imageAttachment = ev.attachments?.find');
    expect(source).toContain('loading="lazy"');
    expect(source).toContain('aria-label={`View ${activityTitle || "club activity"} in the feed`}');
    expect(source).toContain('background: isDark ? "oklch(0.155 0.045 145)" : "rgba(255,255,255,0.76)"');
  });
});
