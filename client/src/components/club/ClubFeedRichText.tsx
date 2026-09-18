import React, { type ReactNode } from "react";

export type ClubFeedTextFormat =
  | "bold"
  | "italic"
  | "underline"
  | "bulletList"
  | "numberList"
  | "quote"
  | "code"
  | "link"
  | "clear";

export type ClubFeedTextFormatResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const EMPTY_SELECTION_COPY: Record<Exclude<ClubFeedTextFormat, "clear">, string> = {
  bold: "bold text",
  italic: "italic text",
  underline: "underlined text",
  bulletList: "List item",
  numberList: "List item",
  quote: "Quoted text",
  code: "code",
  link: "link text",
};

function normalizeSelection(value: string, selectionStart: number, selectionEnd: number) {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  return { start, end };
}

function selectionOrPlaceholder(value: string, start: number, end: number, format: Exclude<ClubFeedTextFormat, "clear">) {
  return value.slice(start, end) || EMPTY_SELECTION_COPY[format];
}

function replaceSelection(value: string, start: number, end: number, replacement: string, selectedStart: number, selectedEnd: number): ClubFeedTextFormatResult {
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart: start + selectedStart,
    selectionEnd: start + selectedEnd,
  };
}

/**
 * Applies the compact Club Feed formatting syntax to a text selection. The syntax is
 * intentionally small and rendered through React nodes, never injected as HTML.
 */
export function applyClubFeedTextFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: ClubFeedTextFormat,
  linkUrl?: string | null,
): ClubFeedTextFormatResult {
  const { start, end } = normalizeSelection(value, selectionStart, selectionEnd);
  const selected = value.slice(start, end);

  if (format === "clear") {
    const stripped = selected
      .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
      .replace(/__([\s\S]*?)__/g, "$1")
      .replace(/\*([\s\S]*?)\*/g, "$1")
      .replace(/`([\s\S]*?)`/g, "$1")
      .replace(/\[([\s\S]*?)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "");
    return replaceSelection(value, start, end, stripped, 0, stripped.length);
  }

  const text = selectionOrPlaceholder(value, start, end, format);
  switch (format) {
    case "bold":
      return replaceSelection(value, start, end, `**${text}**`, 2, text.length + 2);
    case "italic":
      return replaceSelection(value, start, end, `*${text}*`, 1, text.length + 1);
    case "underline":
      return replaceSelection(value, start, end, `__${text}__`, 2, text.length + 2);
    case "code":
      return replaceSelection(value, start, end, `\`${text}\``, 1, text.length + 1);
    case "quote": {
      const quoted = text.split("\n").map((line) => `> ${line}`).join("\n");
      return replaceSelection(value, start, end, quoted, 2, quoted.length);
    }
    case "bulletList": {
      const listed = text.split("\n").map((line) => `- ${line}`).join("\n");
      return replaceSelection(value, start, end, listed, 2, listed.length);
    }
    case "numberList": {
      const listed = text.split("\n").map((line, index) => `${index + 1}. ${line}`).join("\n");
      return replaceSelection(value, start, end, listed, 3, listed.length);
    }
    case "link": {
      const url = sanitizeClubFeedUrl(linkUrl);
      if (!url) return { value, selectionStart: start, selectionEnd: end };
      const linked = `[${text}](${url})`;
      return replaceSelection(value, start, end, linked, 1, text.length + 1);
    }
  }
}

/** Allows only external HTTP(S) destinations in rendered Club Feed text links. */
export function sanitizeClubFeedUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

type InlinePart = { type: "text"; value: string } | { type: "bold" | "italic" | "underline" | "code"; value: string } | { type: "link"; label: string; href: string };

function parseInline(value: string): InlinePart[] {
  const expression = /(\*\*(.+?)\*\*|__(.+?)__|`(.+?)`|\[(.+?)\]\((https?:\/\/[^\s)]+)\)|\*(?!\*)([^*\n]+?)\*)/g;
  const parts: InlinePart[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(value)) !== null) {
    const index = match.index;
    if (index > cursor) parts.push({ type: "text", value: value.slice(cursor, index) });
    if (match[2] !== undefined) parts.push({ type: "bold", value: match[2] });
    else if (match[3] !== undefined) parts.push({ type: "underline", value: match[3] });
    else if (match[4] !== undefined) parts.push({ type: "code", value: match[4] });
    else if (match[5] !== undefined) {
      const href = sanitizeClubFeedUrl(match[6]);
      parts.push(href ? { type: "link", label: match[5], href } : { type: "text", value: match[5] });
    } else if (match[7] !== undefined) parts.push({ type: "italic", value: match[7] });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
  return parts.length ? parts : [{ type: "text", value }];
}

function renderInline(value: string, keyPrefix: string, accent: string): ReactNode[] {
  return parseInline(value).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.type === "bold") return <strong key={key} className="font-bold">{part.value}</strong>;
    if (part.type === "italic") return <em key={key}>{part.value}</em>;
    if (part.type === "underline") return <span key={key} className="underline decoration-current/60 underline-offset-2">{part.value}</span>;
    if (part.type === "code") return <code key={key} className="rounded bg-black/[0.08] px-1.5 py-0.5 font-mono text-[0.86em] dark:bg-white/[0.09]">{part.value}</code>;
    if (part.type === "link") return <a key={key} href={part.href} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ color: accent, "--tw-ring-color": accent } as React.CSSProperties}>{part.label}</a>;
    return <React.Fragment key={key}>{part.value}</React.Fragment>;
  });
}

export function ClubFeedRichText({ value, accent, className = "" }: { value: string; accent: string; className?: string }) {
  const lines = value.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push(<ul key={`list-${index}`} className="my-2 list-disc space-y-1 pl-5 marker:text-current">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `bullet-${index}-${itemIndex}`, accent)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(<ol key={`ordered-${index}`} className="my-2 list-decimal space-y-1 pl-5 marker:font-semibold marker:text-current">{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `ordered-${index}-${itemIndex}`, accent)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoted.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`} className="my-2 border-l-2 pl-3 italic" style={{ borderColor: accent }}>{quoted.map((quote, quoteIndex) => <React.Fragment key={quoteIndex}>{quoteIndex > 0 && <br />}{renderInline(quote, `quote-${index}-${quoteIndex}`, accent)}</React.Fragment>)}</blockquote>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index]?.trim() && !/^(?:-\s+|\d+\.\s+|>\s?)/.test(lines[index] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`} className="whitespace-pre-wrap">{paragraph.map((paragraphLine, paragraphIndex) => <React.Fragment key={paragraphIndex}>{paragraphIndex > 0 && <br />}{renderInline(paragraphLine, `paragraph-${index}-${paragraphIndex}`, accent)}</React.Fragment>)}</p>);
  }

  return <div className={`text-sm leading-relaxed ${className}`.trim()}>{blocks}</div>;
}
