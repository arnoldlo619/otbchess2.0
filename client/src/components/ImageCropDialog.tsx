import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Loader2, Move, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type ImageCropShape = "rect" | "round";

export interface ImageCropOutput {
  width: number;
  height: number;
  quality?: number;
  /** Keeps data URLs within storage limits when a destination has one. */
  maxDataUrlLength?: number;
}

interface ImageCropDialogProps {
  imageSrc: string | null;
  title: string;
  description: string;
  aspect: number;
  output: ImageCropOutput;
  cropShape?: ImageCropShape;
  onApply: (croppedDataUrl: string) => void | Promise<void>;
  onCancel: () => void;
}

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export async function renderCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  output: ImageCropOutput,
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    output.width,
    output.height,
  );

  let quality = output.quality ?? 0.88;
  let result = canvas.toDataURL("image/jpeg", quality);
  while (output.maxDataUrlLength && result.length > output.maxDataUrlLength && quality > 0.55) {
    quality = Math.max(0.55, quality - 0.1);
    result = canvas.toDataURL("image/jpeg", quality);
  }
  return result;
}

/**
 * A deliberate-crop editor for every fixed-frame image surface.
 * Users drag to reposition and use the slider to scale before an image is persisted.
 */
export function ImageCropDialog({
  imageSrc,
  title,
  description,
  aspect,
  output,
  cropShape = "rect",
  onApply,
  onCancel,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setApplying(false);
  }, [imageSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleApply() {
    if (!imageSrc || !croppedAreaPixels || applying) return;
    setApplying(true);
    try {
      const croppedImage = await renderCroppedImage(imageSrc, croppedAreaPixels, output);
      await onApply(croppedImage);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={Boolean(imageSrc)} onOpenChange={(open) => { if (!open && !applying) onCancel(); }}>
      <DialogContent overlayClassName="z-[290]" showCloseButton={false} className="z-[300] overflow-hidden border-0 bg-[#0b1d10] p-0 text-white shadow-2xl sm:max-w-xl">
        <div className="border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle className="text-lg font-semibold text-white">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-white/58">
            {description}
          </DialogDescription>
        </div>

        <div className="relative h-[min(56vh,360px)] bg-[#07120a]">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { background: "#07120a" },
                cropAreaStyle: {
                  border: "2px solid #66bb6a",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
                },
              }}
            />
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-4 sm:px-6">
          <div className="mb-4 flex items-center gap-3 text-sm text-white/58">
            <Move className="h-4 w-4 shrink-0 text-[#83d58a]" aria-hidden="true" />
            <span className="hidden sm:inline">Drag to position your image</span>
            <span className="sm:hidden">Drag to position</span>
            <span className="ml-auto text-xs font-medium text-white/42">Scale</span>
            <ZoomOut className="h-4 w-4 shrink-0 text-white/42" aria-hidden="true" />
            <input
              aria-label="Image scale"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-1.5 min-w-24 flex-1 cursor-pointer accent-[#66bb6a]"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-white/42" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={applying}
              className="min-h-11 rounded-xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold text-white/78 transition-colors hover:bg-white/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#83d58a] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!croppedAreaPixels || applying}
              className="min-h-11 rounded-xl bg-[#83d58a] px-4 text-sm font-bold text-[#0a2410] transition-colors hover:bg-[#a0e8a6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d5ffd8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1d10] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {applying ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Applying</span> : "Apply crop"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
