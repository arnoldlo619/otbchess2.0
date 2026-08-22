/**
 * AvatarCropModal
 *
 * Opens after the user selects a profile photo. Shows a circular crop
 * preview (react-easy-crop), a zoom slider, and Apply / Cancel buttons.
 * On Apply it renders the cropped region to a 256×256 JPEG canvas and
 * returns the data URL to the caller.
 */
import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

// ── Canvas helper ─────────────────────────────────────────────────────────────

/**
 * Renders the cropped region of `imageSrc` to a 256×256 JPEG canvas.
 * Returns a base64 data URL.
 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const OUTPUT_SIZE = 256;
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return canvas.toDataURL("image/jpeg", 0.88);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AvatarCropModalProps {
  /** Raw data URL of the selected image */
  imageSrc: string | null;
  /** Called with the final 256×256 JPEG data URL when the user clicks Apply */
  onApply: (croppedDataUrl: string) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

export function AvatarCropModal({ imageSrc, onApply, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleApply() {
    if (!imageSrc || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const result = await getCroppedImg(imageSrc, croppedAreaPixels);
      onApply(result);
    } catch {
      // Fallback: pass raw image if canvas fails
      onApply(imageSrc);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={!!imageSrc} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="p-0 overflow-hidden rounded-2xl border-0 bg-[#0d1f12] max-w-sm w-full shadow-2xl">
        <div className="px-5 pt-5 pb-3">
          <DialogTitle className="text-white text-base font-semibold">
            Crop Profile Photo
          </DialogTitle>
          <p className="text-xs text-white/50 mt-0.5">
            Drag to reposition · Scroll or use the slider to zoom
          </p>
        </div>

        {/* Crop area */}
        <div className="relative w-full" style={{ height: 280 }}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { background: "#0a1a0f" },
                cropAreaStyle: {
                  border: "2px solid #4ade80",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                },
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-5 py-3">
          <ZoomOut className="w-4 h-4 text-white/40 flex-shrink-0" />
          <input
            aria-label="Zoom level"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#4ade80] h-1 cursor-pointer"
          />
          <ZoomIn className="w-4 h-4 text-white/40 flex-shrink-0" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/70 bg-white/8 hover:bg-white/12 transition border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#0d1f12] bg-[#4ade80] hover:bg-[#22c55e] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {applying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Applying…
              </>
            ) : (
              "Apply"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
