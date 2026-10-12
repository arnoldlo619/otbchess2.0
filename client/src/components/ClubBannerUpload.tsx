import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { ImageCropDialog, readImageFile } from "@/components/ImageCropDialog";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const BANNER_WIDTH = 1280;
const BANNER_HEIGHT = 400;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BANNER_DATA_URL_LENGTH = 45 * 1024 * (4 / 3);

export function validateBannerFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Please upload a JPEG, PNG, or WebP image.";
  if (file.size > MAX_FILE_SIZE) return "Banner must be 8 MB or smaller.";
  return null;
}

/** Retained for programmatic callers; interactive uploads use ImageCropDialog. */
export function cropBannerImage(file: File, outW = BANNER_WIDTH, outH = BANNER_HEIGHT): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Canvas not supported"));
        const targetRatio = outW / outH;
        const sourceRatio = image.width / image.height;
        const sourceWidth = sourceRatio > targetRatio ? image.height * targetRatio : image.width;
        const sourceHeight = sourceRatio > targetRatio ? image.height : image.width / targetRatio;
        context.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, outW, outH);
        let dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        if (dataUrl.length > MAX_BANNER_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        resolve(dataUrl);
      };
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface ClubBannerUploadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  accentColor?: string;
  isDark: boolean;
}

/** Club hero picker with intentional drag, reposition, and scale controls. */
export function ClubBannerUpload({ value, onChange, accentColor = "#436850", isDark }: ClubBannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const openCropper = useCallback(async (file: File) => {
    const validationError = validateBannerFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      setCropSrc(await readImageFile(file));
    } catch {
      setError("Could not read image. Please try another file.");
    }
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void openCropper(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void openCropper(file);
  };

  const ringColor = dragging ? (isDark ? "ring-[#4CAF50]" : "ring-[#436850]") : (isDark ? "ring-white/10" : "ring-gray-200");

  return (
    <div className="space-y-2">
      <div className="relative group">
        <div className={`relative w-full overflow-hidden rounded-2xl ring-2 ${ringColor}`} style={{ paddingBottom: "31.25%" }}>
          <div className="absolute inset-0">
            {value ? (
              <img src={value} alt="Club banner" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}22)` }}>
                <ImagePlus className="h-7 w-7 text-white/60" />
                <span className="text-xs font-semibold text-white/60">{dragging ? "Drop to crop" : "Upload banner"}</span>
              </div>
            )}
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50 transition-opacity duration-200 ${dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <Camera className="h-6 w-6 text-white" />
              <span className="text-xs font-semibold text-white">{dragging ? "Drop here" : value ? "Adjust crop" : "Upload and crop"}</span>
              <span className="text-[10px] text-white/55">16:5 · JPEG, PNG, WebP · max 8 MB</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4CAF50]/60"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          aria-label="Upload and crop club banner"
        ><span className="sr-only">Upload and crop club banner</span></button>

        {value && (
          <button type="button" onClick={() => { onChange(null); setError(null); }} className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition-opacity hover:bg-red-500/80 group-hover:opacity-100" aria-label="Remove club banner"><X className="h-3 w-3" /> Remove</button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className={`text-xs font-semibold transition-colors ${isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#436850] hover:text-[#3a5230]"}`}>{value ? "Adjust banner crop" : "Upload banner image"}</button>
        <span className={`text-right text-[10px] ${isDark ? "text-white/30" : "text-[#436850]"}`}>Drag, scale, and crop · 1280 × 400</span>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      <input aria-label="Upload club banner" ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleFileChange} />
      <ImageCropDialog
        imageSrc={cropSrc}
        title="Crop club banner"
        description="Move and scale your image so the club identity stays visible across the hero banner."
        aspect={BANNER_WIDTH / BANNER_HEIGHT}
        output={{ width: BANNER_WIDTH, height: BANNER_HEIGHT, quality: 0.88, maxDataUrlLength: MAX_BANNER_DATA_URL_LENGTH }}
        onApply={(dataUrl) => { onChange(dataUrl); setCropSrc(null); }}
        onCancel={() => setCropSrc(null)}
      />
    </div>
  );
}
