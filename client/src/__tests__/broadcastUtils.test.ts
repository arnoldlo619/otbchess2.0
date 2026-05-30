import { describe, it, expect } from "vitest";
import { isValidBroadcastUrl, detectProvider, getEmbedUrl } from "@/lib/broadcastUtils";

describe("broadcastUtils", () => {
  describe("isValidBroadcastUrl", () => {
    it("accepts valid https URLs", () => {
      expect(isValidBroadcastUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
      expect(isValidBroadcastUrl("https://twitch.tv/chess")).toBe(true);
    });
    it("accepts http URLs", () => {
      expect(isValidBroadcastUrl("http://example.com/stream")).toBe(true);
    });
    it("rejects empty/null/whitespace", () => {
      expect(isValidBroadcastUrl("")).toBe(false);
      expect(isValidBroadcastUrl("   ")).toBe(false);
    });
    it("rejects javascript: protocol", () => {
      expect(isValidBroadcastUrl("javascript:alert(1)")).toBe(false);
    });
    it("rejects data: protocol", () => {
      expect(isValidBroadcastUrl("data:text/html,<h1>hi</h1>")).toBe(false);
    });
    it("rejects blob: protocol", () => {
      expect(isValidBroadcastUrl("blob:http://example.com/abc")).toBe(false);
    });
    it("rejects ftp: protocol", () => {
      expect(isValidBroadcastUrl("ftp://example.com/file")).toBe(false);
    });
    it("rejects file: protocol", () => {
      expect(isValidBroadcastUrl("file:///etc/passwd")).toBe(false);
    });
    it("rejects vbscript: protocol", () => {
      expect(isValidBroadcastUrl("vbscript:msgbox")).toBe(false);
    });
    it("rejects random text", () => {
      expect(isValidBroadcastUrl("not a url")).toBe(false);
      expect(isValidBroadcastUrl("hello world")).toBe(false);
    });
  });

  describe("detectProvider", () => {
    it("detects YouTube", () => {
      expect(detectProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
      expect(detectProvider("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
      expect(detectProvider("https://www.youtube.com/live/abc123")).toBe("youtube");
      expect(detectProvider("https://youtube.com/embed/abc123")).toBe("youtube");
    });
    it("detects Twitch", () => {
      expect(detectProvider("https://www.twitch.tv/chess")).toBe("twitch");
      expect(detectProvider("https://twitch.tv/videos/123456")).toBe("twitch");
      expect(detectProvider("https://player.twitch.tv/?channel=chess")).toBe("twitch");
      expect(detectProvider("https://player.twitch.tv/?video=123456")).toBe("twitch");
    });
    it("returns custom for other valid URLs", () => {
      expect(detectProvider("https://example.com/stream")).toBe("custom");
    });
    it("returns null for invalid URLs", () => {
      expect(detectProvider("javascript:alert(1)")).toBe(null);
      expect(detectProvider("")).toBe(null);
      expect(detectProvider("ftp://example.com")).toBe(null);
    });
  });

  describe("getEmbedUrl — YouTube", () => {
    it("converts watch URL to embed", () => {
      expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });
    it("converts watch URL without www", () => {
      expect(getEmbedUrl("https://youtube.com/watch?v=abc123")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
    it("converts youtu.be short URL", () => {
      expect(getEmbedUrl("https://youtu.be/abc123")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
    it("converts live URL", () => {
      expect(getEmbedUrl("https://www.youtube.com/live/xyz789")).toBe(
        "https://www.youtube.com/embed/xyz789"
      );
    });
    it("converts live URL without www", () => {
      expect(getEmbedUrl("https://youtube.com/live/xyz789")).toBe(
        "https://www.youtube.com/embed/xyz789"
      );
    });
    it("passes through already-embedded URL", () => {
      expect(getEmbedUrl("https://www.youtube.com/embed/abc123")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
    it("strips extra query params (si, ab_channel, t)", () => {
      expect(getEmbedUrl("https://www.youtube.com/watch?v=abc123&si=xyz&ab_channel=test&t=30")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
    it("handles youtu.be with query params", () => {
      expect(getEmbedUrl("https://youtu.be/abc123?si=xyz&t=10")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
  });

  describe("getEmbedUrl — Twitch", () => {
    it("converts channel URL", () => {
      expect(getEmbedUrl("https://www.twitch.tv/chess", "chessotb.club")).toBe(
        "https://player.twitch.tv/?channel=chess&parent=chessotb.club"
      );
    });
    it("converts channel URL without www", () => {
      expect(getEmbedUrl("https://twitch.tv/hikaru", "chessotb.club")).toBe(
        "https://player.twitch.tv/?channel=hikaru&parent=chessotb.club"
      );
    });
    it("converts VOD URL", () => {
      expect(getEmbedUrl("https://www.twitch.tv/videos/123456", "chessotb.club")).toBe(
        "https://player.twitch.tv/?video=123456&parent=chessotb.club"
      );
    });
    it("converts player channel URL (updates parent)", () => {
      expect(getEmbedUrl("https://player.twitch.tv/?channel=hikaru&parent=old.com", "chessotb.club")).toBe(
        "https://player.twitch.tv/?channel=hikaru&parent=chessotb.club"
      );
    });
    it("converts player video URL", () => {
      expect(getEmbedUrl("https://player.twitch.tv/?video=789", "chessotb.club")).toBe(
        "https://player.twitch.tv/?video=789&parent=chessotb.club"
      );
    });
    it("falls back to localhost when no parent provided (SSR-safe)", () => {
      // In test env, window.location.hostname is available
      const result = getEmbedUrl("https://twitch.tv/chess");
      expect(result).toContain("https://player.twitch.tv/?channel=chess&parent=");
    });
  });

  describe("getEmbedUrl — Custom", () => {
    it("passes through valid https URLs", () => {
      expect(getEmbedUrl("https://example.com/embed/stream")).toBe("https://example.com/embed/stream");
    });
    it("rejects http custom URLs (only https allowed for custom)", () => {
      expect(getEmbedUrl("http://example.com/embed/stream")).toBe(null);
    });
  });

  describe("getEmbedUrl — Invalid", () => {
    it("returns null for javascript: protocol", () => {
      expect(getEmbedUrl("javascript:alert(1)")).toBe(null);
    });
    it("returns null for data: protocol", () => {
      expect(getEmbedUrl("data:text/html,<h1>hi</h1>")).toBe(null);
    });
    it("returns null for empty string", () => {
      expect(getEmbedUrl("")).toBe(null);
    });
    it("returns null for random text", () => {
      expect(getEmbedUrl("not a url")).toBe(null);
    });
    it("returns null for ftp: protocol", () => {
      expect(getEmbedUrl("ftp://example.com")).toBe(null);
    });
  });
});
