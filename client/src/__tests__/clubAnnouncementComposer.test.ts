import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../components/club/ClubFeedComposer.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(import.meta.dirname, "../pages/ClubDashboard.tsx"), "utf8");

describe("club announcement composer", () => {
  it("keeps the announcement form semantic and accessible", () => {
    expect(source).toContain('<form onSubmit={submit}');
    expect(source).toContain('htmlFor="club-announcement-composer"');
    expect(source).toContain('id="club-announcement-composer"');
    expect(source).toContain('aria-describedby="club-announcement-count"');
    expect(source).toContain('type="submit"');
  });

  it("uses a static focus treatment without decorative border tracing or changing the post contract", () => {
    expect(source).toContain('const [focused, setFocused] = useState(false);');
    expect(source).not.toContain('BorderBeam');
    expect(source).not.toContain('motion-reduce:hidden');
    expect(source).toContain('apiCreateClubFeedPost(clubId, {');
    expect(source).toContain('attachments: attachments.map(({ dataUrl, fileName, mimeType }) => ({ dataUrl, fileName, mimeType }))');
  });

  it("opens the full composer from both the compact field and the Feed workspace action", () => {
    expect(dashboardSource).toContain('label: "Post update"');
    expect(dashboardSource).toContain('setFeedComposerOpenRequest((current) => current + 1)');
    expect(source).toContain('function focusComposer()');
    expect(source).toContain('textareaRef.current?.focus({ preventScroll: true })');
    expect(source).toContain('onFocus={() => { setFocused(true); focusComposer(); }}');
    expect(source).toContain('{expanded ? (');
    expect(source).toContain('placeholder="Share an update with your club…"');
    expect(source).toContain('placeholder="What would you like to share with your club?"');
  });

  it("resets the expanded composer consistently on discard and Escape", () => {
    expect(source).toContain('function resetComposer() {');
    expect(source).toContain('setText("");');
    expect(source).toContain('setAttachments([]);');
    expect(source).toContain('setAttachmentError(null);');
    expect(source).toContain('setExpanded(false);');
    expect(source).toContain('setFocused(false);');
    expect(source).toContain('attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl)');
    expect(source).toContain('onClick={resetComposer}');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.preventDefault(); resetComposer();');
  });

  it("publishes through the authenticated Feed API, refreshes the timeline, and keeps failures visible", () => {
    expect(source).toContain('await apiCreateClubFeedPost(clubId, {');
    expect(source).toContain('detail: text.trim(),');
    expect(source).toContain('await onPublished();');
    expect(dashboardSource).toContain('const merged = await syncFeedFromServer(club.id);');
    expect(dashboardSource).toContain('setFeedEvents(merged.slice(0, 50));');
    expect(source).toContain('toast.success("Post published to the club feed.");');
    expect(source).toContain('setAttachmentError(error instanceof Error ? error.message : "Unable to publish your post.");');
    expect(source).toContain('disabled={!text.trim() || posting}');
    expect(source).toContain('{posting ? "Posting…" : "Post"}');
  });

  it("uses the club theme for a spacious expanded sharing surface in light and dark appearances", () => {
    expect(source).toContain('const tokens = {');
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
    expect(source).toContain('applyTextFormat(format)');
    expect(source).toContain('applyTextFormat("clear")');
    expect(source).toContain('ref={textareaRef}');
    expect(dashboardSource).toContain('<ClubFeedRichText value={event.detail} accent={accent} className="text-sm" />');
  });

  it("keeps the real attachment workflow, limits, and keyboard discard path in the premium layout", () => {
    expect(source).toContain('id="club-feed-attachments"');
    expect(source).toContain('const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain"');
    expect(source).toContain('accept={ATTACHMENT_ACCEPT}');
    expect(source).toContain('prepareAttachments(event.currentTarget.files)');
    expect(source).toContain('removeAttachment(index)');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('Up to four JPEG, PNG, WebP, GIF, PDF, or text files. Each file can be up to 6 MB.');
    expect(source).toContain('onClick={resetComposer}');
  });

  it("protects attachment add, remove, failed-read, and keyboard-accessible trigger contracts", () => {
    expect(source).toContain('if (selected.length + attachments.length > 4)');
    expect(source).toContain('setAttachmentError("Add up to 4 attachments per post.")');
    expect(source).toContain('setAttachmentError("Each attachment must be 6 MB or smaller.")');
    expect(source).toContain('setAttachmentError("Attachments must total 16 MB or less.")');
    expect(source).toContain('reader.onerror = () => reject(new Error("Unable to read attachment"))');
    expect(source).toContain('setAttachmentError("Unable to prepare that attachment. Please try again.")');
    expect(source).toContain('if (attachmentInputRef.current) attachmentInputRef.current.value = ""');
    expect(source).toContain('function handleAttachmentTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>)');
    expect(source).toContain('if (event.key !== "Enter" && event.key !== " ") return;');
    expect(source).toContain('onClick={openAttachmentPicker} onKeyDown={handleAttachmentTriggerKeyDown}');
    expect(source).toContain('>Photo / GIF</button>');
    expect(source).toContain('>Attach</button>');
    expect(source).toContain('aria-describedby="club-feed-attachment-help"');
    expect(source).toContain('aria-label={`Remove ${attachment.fileName}`}');
  });
});
