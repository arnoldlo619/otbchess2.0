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
    it("rejects empty/null", () => {
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
    it("rejects invalid URLs", () => {
      expect(isValidBroadcastUrl("not a url")).toBe(false);
    });
  });

  describe("detectProvider", () => {
    it("detects YouTube", () => {
      expect(detectProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("youtube");
      expect(detectProvider("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
      expect(detectProvider("https://www.youtube.com/live/abc123")).toBe("youtube");
    });
    it("detects Twitch", () => {
      expect(detectProvider("https://www.twitch.tv/chess")).toBe("twitch");
      expect(detectProvider("https://player.twitch.tv/?channel=chess&parent=example.com")).toBe("twitch");
    });
    it("returns custom for other valid URLs", () => {
      expect(detectProvider("https://example.com/stream")).toBe("custom");
    });
    it("returns null for invalid URLs", () => {
      expect(detectProvider("javascript:alert(1)")).toBe(null);
      expect(detectProvider("")).toBe(null);
    });
  });

  describe("getEmbedUrl", () => {
    it("converts YouTube watch URL to embed", () => {
      expect(getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
        "https://www.youtube.com/embed/dQw4w9WgXcQ"
      );
    });
    it("converts youtu.be short URL to embed", () => {
      expect(getEmbedUrl("https://youtu.be/abc123")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
    it("converts YouTube live URL to embed", () => {
      expect(getEmbedUrl("https://www.youtube.com/live/xyz789")).toBe(
        "https://www.youtube.com/embed/xyz789"
      );
    });
    it("passes through already-embedded YouTube URL", () => {
      expect(getEmbedUrl("https://www.youtube.com/embed/abc123")).toBe(
        "https://www.youtube.com/embed/abc123"
      );
    });
    it("converts Twitch channel URL to embed", () => {
      const result = getEmbedUrl("https://www.twitch.tv/chess", "chessotb.club");
      expect(result).toBe("https://player.twitch.tv/?channel=chess&parent=chessotb.club");
    });
    it("converts Twitch player URL to embed", () => {
      const result = getEmbedUrl("https://player.twitch.tv/?channel=hikaru&parent=old.com", "chessotb.club");
      expect(result).toBe("https://player.twitch.tv/?channel=hikaru&parent=chessotb.club");
    });
    it("passes through custom https URLs", () => {
      expect(getEmbedUrl("https://example.com/embed/stream")).toBe("https://example.com/embed/stream");
    });
    it("returns null for invalid URLs", () => {
      expect(getEmbedUrl("javascript:alert(1)")).toBe(null);
      expect(getEmbedUrl("")).toBe(null);
      expect(getEmbedUrl("not a url")).toBe(null);
    });
  });
});
