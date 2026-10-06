import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bold, Camera, Code2, Eraser, FileText, Italic, Link2, List as ListIcon, ListOrdered, Megaphone, Paperclip, Quote, Underline, X } from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { applyClubFeedTextFormat, sanitizeClubFeedUrl, type ClubFeedTextFormat } from "@/components/club/ClubFeedRichText";
import { apiCreateClubFeedPost, type ClubFeedAttachmentInput } from "@/lib/clubFeedApi";

type PreparedAttachment = ClubFeedAttachmentInput & {
  byteSize: number;
  previewUrl?: string;
};

export type ClubFeedComposerProps = {
  clubId: string;
  actorName: string;
  actorAvatarUrl?: string | null;
  accent: string;
  isDark: boolean;
  /** Increment this value to open and focus the composer from an adjacent workspace action. */
  openRequest?: number;
  /** Refreshes the parent Feed after the persisted post is created. */
  onPublished: () => Promise<void> | void;
};

const ACCEPTED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain";

export function ClubFeedComposer({
  clubId,
  actorName,
  actorAvatarUrl,
  accent,
  isDark,
  openRequest = 0,
  onPublished,
}: ClubFeedComposerProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [attachments, setAttachments] = useState<PreparedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const lastOpenRequestRef = useRef(0);

  const tokens = {
    surface: isDark ? "oklch(0.155 0.045 145)" : "rgba(255,255,255,0.78)",
    panel: isDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.86)",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(21,41,28,0.11)",
    innerBorder: isDark ? "rgba(255,255,255,0.10)" : "rgba(21,41,28,0.12)",
    primaryText: isDark ? "rgba(255,255,255,0.94)" : "#15291c",
    secondaryText: isDark ? "rgba(255,255,255,0.72)" : "#31513c",
    mutedText: isDark ? "rgba(255,255,255,0.50)" : "#63806d",
    attachmentSurface: isDark ? "rgba(255,255,255,0.055)" : "rgba(21,41,28,0.045)",
    controlHover: isDark ? "rgba(255,255,255,0.08)" : "rgba(21,41,28,0.07)",
    shadow: `0 0 0 3px ${accent}1c`,
  };

  function focusComposer() {
    setExpanded(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    if (openRequest === lastOpenRequestRef.current) return;
    lastOpenRequestRef.current = openRequest;
    focusComposer();
  }, [openRequest]);

  function resetComposer() {
    attachments.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
    setText("");
    setAttachments([]);
    setAttachmentError(null);
    setExpanded(false);
    setFocused(false);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  function applyTextFormat(format: ClubFeedTextFormat) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let linkUrl: string | null | undefined;
    if (format === "link") {
      const requestedUrl = window.prompt("Paste the link destination", "https://");
      if (requestedUrl === null) return;
      linkUrl = sanitizeClubFeedUrl(requestedUrl);
      if (!linkUrl) {
        setAttachmentError("Add a valid http or https link.");
        return;
      }
    }

    const formatted = applyClubFeedTextFormat(text, textarea.selectionStart, textarea.selectionEnd, format, linkUrl);
    if (formatted.value.length > 500) {
      setAttachmentError("Formatting would exceed the 500-character post limit.");
      return;
    }
    setText(formatted.value);
    setAttachmentError(null);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(formatted.selectionStart, formatted.selectionEnd);
    });
  }

  async function prepareAttachments(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.length + attachments.length > 4) {
      setAttachmentError("Add up to 4 attachments per post.");
      return;
    }
    if (selected.some((file) => !ACCEPTED_ATTACHMENT_TYPES.has(file.type))) {
      setAttachmentError("Choose a JPEG, PNG, WebP, GIF, PDF, or text file.");
      return;
    }
    if (selected.some((file) => file.size === 0 || file.size > 6 * 1024 * 1024)) {
      setAttachmentError("Each attachment must be 6 MB or smaller.");
      return;
    }
    if (attachments.reduce((total, attachment) => total + attachment.byteSize, 0) + selected.reduce((total, file) => total + file.size, 0) > 16 * 1024 * 1024) {
      setAttachmentError("Attachments must total 16 MB or less.");
      return;
    }

    try {
      const prepared = await Promise.all(selected.map(async (file): Promise<PreparedAttachment> => ({
        dataUrl: await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read attachment"));
          reader.onerror = () => reject(new Error("Unable to read attachment"));
          reader.readAsDataURL(file);
        }),
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })));
      setAttachments((current) => [...current, ...prepared]);
      setAttachmentError(null);
    } catch {
      setAttachmentError("Unable to prepare that attachment. Please try again.");
    } finally {
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  }

  function removeAttachment(index: number) {
    setAttachments((current) => {
      const removed = current[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function openAttachmentPicker() {
    attachmentInputRef.current?.click();
  }

  function handleAttachmentTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openAttachmentPicker();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      await apiCreateClubFeedPost(clubId, {
        type: "announcement",
        actorName,
        actorAvatarUrl: actorAvatarUrl ?? null,
        detail: text.trim(),
        attachments: attachments.map(({ dataUrl, fileName, mimeType }) => ({ dataUrl, fileName, mimeType })),
      });
      resetComposer();
      await onPublished();
      toast.success("Post published to the club feed.");
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to publish your post.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border transition-[border-color,box-shadow,background] duration-200"
      style={{
        background: tokens.surface,
        borderColor: focused ? `${accent}66` : tokens.border,
        boxShadow: focused ? tokens.shadow : "none",
      }}
    >
      <form onSubmit={submit} className="p-3.5 sm:p-4">
        <label className="sr-only" htmlFor="club-announcement-composer">Post an announcement</label>
        {expanded ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex min-w-0 items-center justify-between gap-3 px-0.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
                  <PlayerAvatar username={actorName} name={actorName} avatarUrl={actorAvatarUrl ?? undefined} size={40} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: tokens.primaryText }}>Share with your club</p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: tokens.mutedText }}>Your update will appear in the Club Feed.</p>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex" style={{ borderColor: `${accent}40`, background: `${accent}12`, color: accent }}>
                Members
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ease-out" style={{ background: tokens.panel, borderColor: focused ? `${accent}88` : tokens.innerBorder, boxShadow: focused ? `0 0 0 3px ${accent}1c, inset 0 1px 0 ${isDark ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.9)"}` : `inset 0 1px 0 ${isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.88)"}` }}>
              <div role="toolbar" aria-label="Club post formatting" className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderColor: tokens.innerBorder }}>
                {([
                  { format: "bold", label: "Bold", icon: Bold },
                  { format: "italic", label: "Italicize", icon: Italic },
                  { format: "underline", label: "Underline", icon: Underline },
                  { format: "bulletList", label: "Bullet list", icon: ListIcon },
                  { format: "numberList", label: "Numbered list", icon: ListOrdered },
                  { format: "quote", label: "Quote", icon: Quote },
                  { format: "code", label: "Inline code", icon: Code2 },
                  { format: "link", label: "Add link", icon: Link2 },
                ] as const).map(({ format, label, icon: Icon }) => (
                  <button key={format} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextFormat(format)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.97]" style={{ color: tokens.secondaryText, background: "transparent", "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#102214" : "#f7fbf7" } as React.CSSProperties} aria-label={label} title={label}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
                <span className="mx-0.5 h-5 w-px shrink-0" style={{ background: tokens.innerBorder }} aria-hidden="true" />
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextFormat("clear")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-red-500/10 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.97]" style={{ color: tokens.mutedText, "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#102214" : "#f7fbf7" } as React.CSSProperties} aria-label="Clear formatting" title="Clear formatting">
                  <Eraser className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <textarea ref={textareaRef} id="club-announcement-composer" aria-describedby="club-announcement-count" value={text} onChange={(event) => setText(event.target.value)} onFocus={() => setFocused(true)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); resetComposer(); } }} placeholder="What would you like to share with your club?" maxLength={500} autoFocus className="min-h-40 w-full resize-none border-0 bg-transparent px-4 py-3.5 text-base leading-relaxed outline-none placeholder:text-[color:var(--composer-placeholder)] sm:min-h-44" style={{ color: tokens.primaryText, caretColor: accent, "--composer-placeholder": tokens.mutedText } as React.CSSProperties} />
            </div>

            <input ref={attachmentInputRef} id="club-feed-attachments" className="sr-only" type="file" multiple accept={ATTACHMENT_ACCEPT} aria-label="Add Feed attachments" aria-describedby="club-feed-attachment-help" onChange={(event) => void prepareAttachments(event.currentTarget.files)} />
            <p id="club-feed-attachment-help" className="px-0.5 text-xs leading-5" style={{ color: tokens.mutedText }}>Up to four JPEG, PNG, WebP, GIF, PDF, or text files. Each file can be up to 6 MB.</p>
            {attachmentError && <p role="alert" className="px-0.5 text-xs font-medium text-red-600 dark:text-red-300">{attachmentError}</p>}
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.fileName}-${index}`} className="group relative overflow-hidden rounded-xl border" style={{ borderColor: tokens.innerBorder, background: tokens.attachmentSurface }}>
                    {attachment.previewUrl ? <img src={attachment.previewUrl} alt={`Selected ${attachment.fileName}`} className="aspect-square w-full object-cover" /> : <div className="flex aspect-square flex-col items-center justify-center gap-1.5 px-2 text-center"><FileText className="h-5 w-5" style={{ color: tokens.secondaryText }} /><span className="line-clamp-2 text-[11px] font-semibold" style={{ color: tokens.secondaryText }}>{attachment.fileName}</span></div>}
                    <button type="button" onClick={() => removeAttachment(index)} className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full border bg-black/75 text-white shadow-sm transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ borderColor: "rgba(255,255,255,0.18)", "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#0b180d" : "#ffffff" } as React.CSSProperties} aria-label={`Remove ${attachment.fileName}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: tokens.innerBorder }}>
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <button type="button" onClick={openAttachmentPicker} onKeyDown={handleAttachmentTriggerKeyDown} aria-controls="club-feed-attachments" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ color: tokens.secondaryText, background: tokens.attachmentSurface, "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#102214" : "#f7fbf7" } as React.CSSProperties}><Camera className="h-4 w-4" aria-hidden="true" />Photo / GIF</button>
                <button type="button" onClick={openAttachmentPicker} onKeyDown={handleAttachmentTriggerKeyDown} aria-controls="club-feed-attachments" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ color: tokens.secondaryText, background: tokens.attachmentSurface, "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#102214" : "#f7fbf7" } as React.CSSProperties}><Paperclip className="h-4 w-4" aria-hidden="true" />Attach</button>
                <span id="club-announcement-count" className="whitespace-nowrap text-xs tabular-nums" style={{ color: tokens.mutedText }} aria-live="polite">{text.length}/500</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={resetComposer} className="h-10 rounded-xl px-3 text-xs font-semibold transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ color: tokens.secondaryText, background: tokens.controlHover, "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#102214" : "#f7fbf7" } as React.CSSProperties}>Discard</button>
                <button type="submit" disabled={!text.trim() || posting} className="flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ background: accent, touchAction: "manipulation", "--tw-ring-color": accent, "--tw-ring-offset-color": isDark ? "#102214" : "#f7fbf7" } as React.CSSProperties}>
                  <Megaphone className="h-4 w-4" />
                  {posting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
              <PlayerAvatar username={actorName} name={actorName} avatarUrl={actorAvatarUrl ?? undefined} size={40} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ease-out" style={{ background: tokens.panel, borderColor: tokens.innerBorder, boxShadow: `inset 0 1px 0 ${isDark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.88)"}` }}>
              <input id="club-announcement-composer" aria-describedby="club-announcement-count" value={text} onChange={(event) => setText(event.target.value)} onFocus={() => { setFocused(true); focusComposer(); }} placeholder="Share an update with your club…" maxLength={500} className="h-12 w-full border-0 bg-transparent px-4 text-base leading-relaxed outline-none placeholder:text-[color:var(--composer-placeholder)]" style={{ color: tokens.primaryText, caretColor: accent, "--composer-placeholder": tokens.mutedText } as React.CSSProperties} />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
