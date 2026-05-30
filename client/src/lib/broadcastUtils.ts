/**
 * Board Broadcast MVP — Utility Functions
 *
 * Handles URL validation, provider detection, and embed URL conversion
 * for YouTube, Twitch, and custom embed sources.
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

const BLOCKED_PROTOCOLS = ["javascript:", "data:", "blob:", "vbscript:", "file:"];

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
  if (
    trimmed.includes("youtube.com") ||
    trimmed.includes("youtu.be")
  ) {
    return "youtube";
  }
  if (
    trimmed.includes("twitch.tv") ||
    trimmed.includes("player.twitch.tv")
  ) {
    return "twitch";
  }
  return "custom";
}

// ─── YouTube Embed Conversion ────────────────────────────────────────────────

function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    // youtube.com/watch?v=VIDEO_ID
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    // youtube.com/embed/VIDEO_ID
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
    // youtube.com/live/VIDEO_ID
    const liveMatch = parsed.pathname.match(/\/live\/([^/?]+)/);
    if (liveMatch) return liveMatch[1];
    // youtu.be/VIDEO_ID
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Twitch Embed Conversion ─────────────────────────────────────────────────

function extractTwitchChannel(url: string): string | null {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    // player.twitch.tv/?channel=CHANNEL
    if (parsed.hostname === "player.twitch.tv") {
      return parsed.searchParams.get("channel");
    }
    // twitch.tv/CHANNEL
    if (parsed.hostname.includes("twitch.tv")) {
      const channel = parsed.pathname.split("/").filter(Boolean)[0];
      return channel || null;
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Main Embed URL Generator ────────────────────────────────────────────────

export function getEmbedUrl(url: string, parentDomain?: string): string | null {
  if (!isValidBroadcastUrl(url)) return null;
  const provider = detectProvider(url);

  if (provider === "youtube") {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  }

  if (provider === "twitch") {
    const channel = extractTwitchChannel(url);
    if (!channel) return null;
    const parent = parentDomain || (typeof window !== "undefined" ? window.location.hostname : "localhost");
    return `https://player.twitch.tv/?channel=${channel}&parent=${parent}`;
  }

  // Custom — pass through if it's a valid https URL
  return url.trim();
}
