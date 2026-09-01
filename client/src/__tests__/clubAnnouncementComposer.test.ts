import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../pages/ClubDashboard.tsx"), "utf8");

describe("club announcement composer", () => {
  it("keeps the announcement form semantic and accessible", () => {
    expect(source).toContain('<form onSubmit={submitAnnouncement}');
    expect(source).toContain('htmlFor="club-announcement-composer"');
    expect(source).toContain('id="club-announcement-composer"');
    expect(source).toContain('aria-describedby="club-announcement-count"');
    expect(source).toContain('type="submit"');
  });

  it("uses a restrained, reduced-motion-safe border treatment without changing the post contract", () => {
    expect(source).toContain('import { BorderBeam } from "@/components/ui/border-beam"');
    expect(source).toContain('announcementComposerFocused');
    expect(source).toContain('motion-reduce:hidden');
    expect(source).toContain('apiCreateClubFeedPost(club.id, {');
    expect(source).toContain('attachments: announcementAttachments.map(({ dataUrl, fileName, mimeType }) => ({ dataUrl, fileName, mimeType }))');
  });
});
