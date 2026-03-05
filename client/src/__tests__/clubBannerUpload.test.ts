/**
 * Unit tests for ClubBannerUpload helpers:
 *   - validateBannerFile
 *   - cropBannerImage (canvas mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateBannerFile, cropBannerImage } from "../components/ClubBannerUpload";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes).fill(0);
  return new File([content], name, { type });
}

// ── validateBannerFile ────────────────────────────────────────────────────────

describe("validateBannerFile", () => {
  it("accepts a valid JPEG", () => {
    expect(validateBannerFile(makeFile("banner.jpg", "image/jpeg", 1024))).toBeNull();
  });

  it("accepts a valid PNG", () => {
    expect(validateBannerFile(makeFile("banner.png", "image/png", 2048))).toBeNull();
  });

  it("accepts a valid WebP", () => {
    expect(validateBannerFile(makeFile("banner.webp", "image/webp", 512))).toBeNull();
  });

  it("rejects a GIF (not allowed for banners)", () => {
    const err = validateBannerFile(makeFile("anim.gif", "image/gif", 100));
    expect(err).toMatch(/JPEG|PNG|WebP/i);
  });

  it("rejects a PDF", () => {
    const err = validateBannerFile(makeFile("doc.pdf", "application/pdf", 1024));
    expect(err).toMatch(/JPEG|PNG|WebP/i);
  });

  it("rejects a file over 8 MB", () => {
    const eightMbPlus = 8 * 1024 * 1024 + 1;
    const err = validateBannerFile(makeFile("big.jpg", "image/jpeg", eightMbPlus));
    expect(err).toMatch(/8 MB/i);
  });

  it("accepts a file exactly at 8 MB", () => {
    const eightMb = 8 * 1024 * 1024;
    expect(validateBannerFile(makeFile("exact.jpg", "image/jpeg", eightMb))).toBeNull();
  });

  it("accepts a very small file (1 byte)", () => {
    expect(validateBannerFile(makeFile("tiny.png", "image/png", 1))).toBeNull();
  });
});

// ── cropBannerImage ───────────────────────────────────────────────────────────

describe("cropBannerImage", () => {
  beforeEach(() => {
    const mockDataUrl = "data:image/jpeg;base64,FAKEBANNERDATA";

    vi.stubGlobal("Image", class {
      width = 1920;
      height = 1080;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    });

    const mockCtx = { drawImage: vi.fn() };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toDataURL: vi.fn(() => mockDataUrl),
    };
    vi.stubGlobal("document", {
      createElement: vi.fn((tag: string) => {
        if (tag === "canvas") return mockCanvas;
        return {};
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    vi.stubGlobal("FileReader", class {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_file: File) {
        setTimeout(() => this.onload?.({ target: { result: mockDataUrl } }), 0);
      }
    });
  });

  it("resolves with a data URL string", async () => {
    const file = makeFile("banner.jpg", "image/jpeg", 2048);
    const result = await cropBannerImage(file, 1280, 400);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^data:/);
  });

  it("resolves for a taller-than-wide source (portrait)", async () => {
    // Override Image dimensions to portrait
    vi.stubGlobal("Image", class {
      width = 600;
      height = 900;
      onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this.onload?.(), 0); }
    });
    const file = makeFile("portrait.jpg", "image/jpeg", 1024);
    const result = await cropBannerImage(file, 1280, 400);
    expect(result).toMatch(/^data:/);
  });

  it("resolves for a square source", async () => {
    vi.stubGlobal("Image", class {
      width = 800;
      height = 800;
      onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this.onload?.(), 0); }
    });
    const file = makeFile("square.png", "image/png", 512);
    const result = await cropBannerImage(file, 1280, 400);
    expect(result).toMatch(/^data:/);
  });
});
