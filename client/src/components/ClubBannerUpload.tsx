/**
 * ClubBannerUpload — wide hero banner picker for club profile pages
 *
 * Features:
 *  - Click-to-browse or drag-and-drop
 *  - Accepts JPEG / PNG / WebP, max 8 MB
 *  - Canvas-based 16:5 centre-crop (e.g. 1280×400 px output)
 *  - Returns a base64 data URL via onChange callback
 *  - Live preview with hover overlay and remove button
 *  - Gradient placeholder matching the club's accent colour
 *  - Fully dark-mode aware, consistent with platform design system
 *
 * Usage:
 *   <ClubBannerUpload
 *     value={bannerDataUrl}
 *     onChange={(dataUrl) => setBanner(dataUrl)}
 *     accentColor="#3D6B47"
 *     isDark={isDark}
 *   />
 */

import { useRef, useState, useCallback } from "react";
import { ImagePlus, X, Camera } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const BANNER_WIDTH  = 1280;
const BANNER_HEIGHT = 400; // 16:5 ratio
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function validateBannerFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, or WebP image.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Banner must be 8 MB or smaller.";
  }
  return null;
}

/**
 * Centre-crop a File to a 16:5 canvas and return a base64 data URL.
 */
export function cropBannerImage(
  file: File,
  outW = BANNER_WIDTH,
  outH = BANNER_HEIGHT
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        // Determine the largest 16:5 rect centred in the source image
        const targetRatio = outW / outH;
        const srcRatio    = img.width / img.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (srcRatio > targetRatio) {
          // Source is wider — crop sides
          sw = Math.round(img.height * targetRatio);
          sx = Math.round((img.width - sw) / 2);
        } else {
          // Source is taller — crop top/bottom
          sh = Math.round(img.width / targetRatio);
          sy = Math.round((img.height - sh) / 2);
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ClubBannerUploadProps {
  /** Current banner data URL (or null if none) */
  value: string | null;
  /** Called with the new base64 data URL, or null when removed */
  onChange: (dataUrl: string | null) => void;
  /** Accent colour used for the gradient placeholder */
  accentColor?: string;
  isDark: boolean;
}

export function ClubBannerUpload({
  value,
  onChange,
  accentColor = "#3D6B47",
  isDark,
}: ClubBannerUploadProps) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [dragging,    setDragging]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [processing,  setProcessing]  = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      const err = validateBannerFile(file);
      if (err) { setError(err); return; }
      setError(null);
      setProcessing(true);
      try {
        const dataUrl = await cropBannerImage(file);
        onChange(dataUrl);
      } catch {
        setError("Could not process image. Please try another file.");
      } finally {
        setProcessing(false);
      }
    },
    [onChange]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const ringColor = dragging
    ? isDark ? "ring-[#4CAF50]" : "ring-[#3D6B47]"
    : isDark ? "ring-white/10" : "ring-gray-200";

  return (
    <div className="space-y-2">
      {/* Banner preview / drop zone — 16:5 aspect ratio */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl cursor-pointer group transition-all duration-200 ring-2 ${ringColor}`}
        style={{ paddingBottom: "31.25%" /* 5/16 = 31.25% */ }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        role="button"
        aria-label="Upload club banner"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {/* Inner absolutely-positioned content */}
        <div className="absolute inset-0">
          {value ? (
            <img
              src={value}
              alt="Club banner"
              className="w-full h-full object-cover"
            />
          ) : (
            /* Gradient placeholder */
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${accentColor}cc 0%, ${accentColor}44 50%, ${accentColor}22 100%)`,
              }}
            >
              {processing ? (
                <div className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-7 h-7 text-white/60" />
                  <span className="text-white/60 text-xs font-semibold">
                    {dragging ? "Drop to upload" : "Upload banner"}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Hover overlay */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200 ${
              dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } bg-black/45`}
          >
            {processing ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-white" />
                <span className="text-white text-xs font-semibold">
                  {dragging ? "Drop here" : value ? "Change banner" : "Upload banner"}
                </span>
                <span className="text-white/50 text-[10px]">16:5 · JPEG, PNG, WebP · max 8 MB</span>
              </>
            )}
          </div>

          {/* Remove button */}
          {value && !processing && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); setError(null); }}
              className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              aria-label="Remove banner"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Label row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`text-xs font-semibold transition-colors ${
            isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#3D6B47] hover:text-[#2d5236]"
          }`}
        >
          {value ? "Change banner image" : "Upload banner image"}
        </button>
        <span className={`text-[10px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
          Recommended: 1280 × 400 px
        </span>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  );
}
