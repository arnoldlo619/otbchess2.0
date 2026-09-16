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

  it("uses the club theme for a spacious expanded sharing surface in light and dark appearances", () => {
    expect(source).toContain('const composerTokens = {');
    expect(source).toContain('surface: isDark ?');
    expect(source).toContain('primaryText: isDark ?');
    expect(source).toContain('Share with your club');
    expect(source).toContain('Your update will appear in the Club Feed.');
    expect(source).toContain('placeholder:text-[color:var(--composer-placeholder)]');
  });

  it("keeps the real attachment workflow, limits, and keyboard discard path in the premium layout", () => {
    expect(source).toContain('id="club-feed-attachments"');
    expect(source).toContain('accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"');
    expect(source).toContain('handleAnnouncementAttachmentSelection(event.currentTarget.files)');
    expect(source).toContain('removeAnnouncementAttachment(index)');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('Up to four JPEG, PNG, WebP, GIF, PDF, or text files. Each file can be up to 6 MB.');
    expect(source).toContain('onClick={resetAnnouncementComposer}');
  });
});
