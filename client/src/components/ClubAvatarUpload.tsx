/**
 * ClubAvatarUpload — reusable club avatar picker
 *
 * Features:
 *  - Click-to-browse or drag-and-drop
 *  - Accepts JPEG / PNG / WebP / GIF, max 5 MB
 *  - Canvas-based square crop + resize to 256 × 256 px
 *  - Returns a base64 data URL via onChange callback
 *  - Shows a live preview with a remove button
 *  - Fully dark-mode aware, consistent with platform design system
 *
 * Usage:
 *   <ClubAvatarUpload
 *     value={avatarDataUrl}
 *     onChange={(dataUrl) => setAvatar(dataUrl)}
 *     accentColor="#3D6B47"
 *     clubName="London Chess Club"
 *     isDark={isDark}
 *   />
 */

import { useRef, useState, useCallback } from "react";
import { Upload, X, Camera } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const OUTPUT_SIZE = 256; // px — square output
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

/**
 * Resize + centre-crop a File to a square canvas, returning a base64 data URL.
 */
export function cropAndResizeImage(file: File, size = OUTPUT_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        // Centre-crop: take the largest square from the centre
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
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

interface ClubAvatarUploadProps {
  /** Current avatar data URL (or null if none) */
  value: string | null;
  /** Called with the new base64 data URL, or null when removed */
  onChange: (dataUrl: string | null) => void;
  /** Accent colour used for the placeholder background */
  accentColor?: string;
  /** Club name used for the initials fallback */
  clubName?: string;
  isDark: boolean;
  /** Size in px for the preview circle (default 96) */
  size?: number;
}

export function ClubAvatarUpload({
  value,
  onChange,
  accentColor = "#3D6B47",
  clubName = "",
  isDark,
  size = 96,
}: ClubAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const initials = clubName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const processFile = useCallback(
    async (file: File) => {
      const err = validateImageFile(file);
      if (err) { setError(err); return; }
      setError(null);
      setProcessing(true);
      try {
        const dataUrl = await cropAndResizeImage(file, OUTPUT_SIZE);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const ringColor = dragging
    ? isDark ? "ring-[#4CAF50]" : "ring-[#3D6B47]"
    : isDark ? "ring-white/10" : "ring-gray-200";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar preview / drop zone */}
      <div
        className={`relative cursor-pointer group transition-all duration-200 ring-2 ${ringColor} rounded-2xl overflow-hidden`}
        style={{ width: size, height: size }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        aria-label="Upload club avatar"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {/* Image or initials placeholder */}
        {value ? (
          <img
            src={value}
            alt="Club avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}88 100%)` }}
          >
            {processing ? (
              <div className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : initials ? (
              <span
                className="text-white font-bold select-none"
                style={{ fontSize: size * 0.3 }}
              >
                {initials}
              </span>
            ) : (
              <Upload className="text-white/60" style={{ width: size * 0.3, height: size * 0.3 }} />
            )}
          </div>
        )}

        {/* Hover overlay */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-200 ${
          dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } bg-black/50`}>
          {processing ? (
            <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <>
              <Camera className="w-5 h-5 text-white" />
              <span className="text-white text-[10px] font-semibold">
                {dragging ? "Drop here" : "Change"}
              </span>
            </>
          )}
        </div>

        {/* Remove button — only when an image is set */}
        {value && !processing && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); setError(null); }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
            aria-label="Remove avatar"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      {/* Label + hint */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`text-xs font-semibold transition-colors ${
            isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#3D6B47] hover:text-[#2d5236]"
          }`}
        >
          {value ? "Change avatar" : "Upload avatar"}
        </button>
        <p className={`text-[10px] mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
          JPEG, PNG or WebP · max 5 MB
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 text-center max-w-[180px]">{error}</p>
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
