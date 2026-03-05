/**
 * Unit tests for ClubAvatarUpload helpers:
 *   - validateImageFile
 *   - cropAndResizeImage (canvas mock)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateImageFile, cropAndResizeImage } from "../components/ClubAvatarUpload";

// ── validateImageFile ─────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes).fill(0);
  return new File([content], name, { type });
}

describe("validateImageFile", () => {
  it("accepts a valid JPEG", () => {
    expect(validateImageFile(makeFile("photo.jpg", "image/jpeg", 1024))).toBeNull();
  });

  it("accepts a valid PNG", () => {
    expect(validateImageFile(makeFile("logo.png", "image/png", 2048))).toBeNull();
  });

  it("accepts a valid WebP", () => {
    expect(validateImageFile(makeFile("avatar.webp", "image/webp", 512))).toBeNull();
  });

  it("accepts a valid GIF", () => {
    expect(validateImageFile(makeFile("anim.gif", "image/gif", 100))).toBeNull();
  });

  it("rejects a PDF", () => {
    const err = validateImageFile(makeFile("doc.pdf", "application/pdf", 1024));
    expect(err).toMatch(/JPEG|PNG|WebP|GIF/i);
  });

  it("rejects an SVG", () => {
    const err = validateImageFile(makeFile("icon.svg", "image/svg+xml", 512));
    expect(err).toMatch(/JPEG|PNG|WebP|GIF/i);
  });

  it("rejects a file over 5 MB", () => {
    const fiveMbPlus = 5 * 1024 * 1024 + 1;
    const err = validateImageFile(makeFile("big.jpg", "image/jpeg", fiveMbPlus));
    expect(err).toMatch(/5 MB/i);
  });

  it("accepts a file exactly at 5 MB", () => {
    const fiveMb = 5 * 1024 * 1024;
    expect(validateImageFile(makeFile("exact.jpg", "image/jpeg", fiveMb))).toBeNull();
  });

  it("accepts a very small file (1 byte)", () => {
    expect(validateImageFile(makeFile("tiny.png", "image/png", 1))).toBeNull();
  });
});

// ── cropAndResizeImage ────────────────────────────────────────────────────────

describe("cropAndResizeImage", () => {
  beforeEach(() => {
    const mockDataUrl = "data:image/jpeg;base64,FAKEDATA";

    vi.stubGlobal("Image", class {
      width = 400;
      height = 300;
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
    const file = makeFile("test.jpg", "image/jpeg", 1024);
    const result = await cropAndResizeImage(file, 256);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^data:/);
  });

  it("resolves for different output sizes", async () => {
    const file = makeFile("test.png", "image/png", 512);
    const result = await cropAndResizeImage(file, 128);
    expect(result).toMatch(/^data:/);
  });
});
