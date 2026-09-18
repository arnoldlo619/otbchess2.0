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

  it("uses a static focus treatment without decorative border tracing or changing the post contract", () => {
    expect(source).toContain('announcementComposerFocused');
    expect(source).not.toContain('BorderBeam');
    expect(source).not.toContain('motion-reduce:hidden');
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
    expect(source).toContain('className="flex min-w-0 items-center gap-3"');
    expect(source).toContain('className="min-h-40 w-full resize-none border-0 bg-transparent');
    expect(source).toContain('className="flex items-center gap-3"');
  });

  it("exposes a fully functional, accessible formatting toolbar in the expanded composer", () => {
    expect(source).toContain('role="toolbar"');
    expect(source).toContain('aria-label="Club post formatting"');
    expect(source).toContain('format: "bold", label: "Bold", icon: Bold');
    expect(source).toContain('format: "italic", label: "Italicize", icon: Italic');
    expect(source).toContain('format: "underline", label: "Underline", icon: Underline');
    expect(source).toContain('format: "bulletList", label: "Bullet list", icon: ListIcon');
    expect(source).toContain('format: "numberList", label: "Numbered list", icon: ListOrdered');
    expect(source).toContain('format: "quote", label: "Quote", icon: Quote');
    expect(source).toContain('format: "code", label: "Inline code", icon: Code2');
    expect(source).toContain('format: "link", label: "Add link", icon: Link2');
    expect(source).toContain('applyAnnouncementTextFormat(format)');
    expect(source).toContain('applyAnnouncementTextFormat("clear")');
    expect(source).toContain('ref={announcementComposerTextareaRef}');
    expect(source).toContain('<ClubFeedRichText value={event.detail} accent={accent} className="text-sm" />');
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
