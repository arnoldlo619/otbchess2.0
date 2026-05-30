/**
 * Board Broadcast — Utility Functions
 *
 * Production-hardened URL validation, provider detection, and embed URL
 * conversion for YouTube, Twitch, and custom embed sources.
 *
 * Security: blocks javascript:, data:, blob:, vbscript:, file:, ftp:
 * and any non-http(s) protocol. Never renders raw user HTML.
 */

export type BroadcastProvider = "youtube" | "twitch" | "custom" | null;
export type BroadcastStatus = "inactive" | "live" | "ended";

export interface BroadcastSettings {
  broadcastEnabled: boolean;
  broadcastUrl: string | null;
  broadcastProvider: BroadcastProvider;
  featuredBoardNumber: number;
  broadcastTitle: string | null;
  broadcastStatus: BroadcastStatus;
}

// ─── URL Validation ──────────────────────────────────────────────────────────

const BLOCKED_PROTOCOLS = [
  "javascript:", "data:", "blob:", "vbscript:", "file:", "ftp:", "ftps:",
];

/**
 * Returns true only for well-formed http: or https: URLs.
 * Blocks all dangerous/unsupported protocols.
 */
export function isValidBroadcastUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim().toLowerCase();
  for (const proto of BLOCKED_PROTOCOLS) {
    if (trimmed.startsWith(proto)) return false;
  }
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Provider Detection ──────────────────────────────────────────────────────

export function detectProvider(url: string): BroadcastProvider {
  if (!isValidBroadcastUrl(url)) return null;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    return "youtube";
  }
  if (trimmed.includes("twitch.tv") || trimmed.includes("player.twitch.tv")) {
    return "twitch";
  }
  return "custom";
}

// ─── YouTube Embed Conversion ────────────────────────────────────────────────

/**
 * Extracts YouTube video ID from all common URL formats:
 * - youtube.com/watch?v=ID (with optional extra params like &si=, &t=, &ab_channel=)
 * - youtube.com/embed/ID
 * - youtube.com/live/ID
 * - youtu.be/ID
 */
function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");

    // youtube.com/watch?v=VIDEO_ID
    if (host === "youtube.com" && parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    // youtube.com/embed/VIDEO_ID
    const embedMatch = parsed.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)/);
    if (host === "youtube.com" && embedMatch) return embedMatch[1];
    // youtube.com/live/VIDEO_ID
    const liveMatch = parsed.pathname.match(/^\/live\/([A-Za-z0-9_-]+)/);
    if (host === "youtube.com" && liveMatch) return liveMatch[1];
    // youtu.be/VIDEO_ID
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0];
      return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Twitch Embed Conversion ─────────────────────────────────────────────────

interface TwitchTarget {
  type: "channel" | "video";
  value: string;
}

/**
 * Extracts Twitch channel or VOD ID from all common URL formats:
 * - twitch.tv/CHANNEL_NAME
 * - twitch.tv/videos/VIDEO_ID
 * - player.twitch.tv/?channel=CHANNEL_NAME
 * - player.twitch.tv/?video=VIDEO_ID
 */
function extractTwitchTarget(url: string): TwitchTarget | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, "");

    // player.twitch.tv/?channel=X or ?video=X
    if (host === "player.twitch.tv") {
      const channel = parsed.searchParams.get("channel");
      if (channel) return { type: "channel", value: channel };
      const video = parsed.searchParams.get("video");
      if (video) return { type: "video", value: video };
      return null;
    }

    // twitch.tv/videos/VIDEO_ID
    if (host === "twitch.tv") {
      const vodMatch = parsed.pathname.match(/^\/videos\/(\d+)/);
      if (vodMatch) return { type: "video", value: vodMatch[1] };
      // twitch.tv/CHANNEL_NAME (first path segment, skip reserved paths)
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length >= 1) {
        const channel = segments[0];
        // Skip Twitch reserved paths
        const reserved = ["directory", "downloads", "jobs", "p", "settings", "videos"];
        if (!reserved.includes(channel.toLowerCase())) {
          return { type: "channel", value: channel };
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Main Embed URL Generator ────────────────────────────────────────────────

/**
 * Converts a user-provided broadcast URL into a safe embed URL.
 * Returns null for invalid/unsafe URLs.
 *
 * @param url - Raw URL from user input
 * @param parentDomain - Required for Twitch embeds. Falls back to window.location.hostname.
 */
export function getEmbedUrl(url: string, parentDomain?: string): string | null {
  if (!isValidBroadcastUrl(url)) return null;
  const provider = detectProvider(url);

  if (provider === "youtube") {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  }

  if (provider === "twitch") {
    const target = extractTwitchTarget(url);
    if (!target) return null;
    const parent = parentDomain || (typeof window !== "undefined" ? window.location.hostname : "localhost");
    if (target.type === "video") {
      return `https://player.twitch.tv/?video=${target.value}&parent=${parent}`;
    }
    return `https://player.twitch.tv/?channel=${target.value}&parent=${parent}`;
  }

  // Custom — pass through only valid https URLs
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return trimmed;
}
