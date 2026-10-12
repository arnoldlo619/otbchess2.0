import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Camera, Upload, X } from "lucide-react";
import { ImageCropDialog, readImageFile } from "@/components/ImageCropDialog";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Please upload a JPEG, PNG, WebP, or GIF image.";
  if (file.size > MAX_FILE_SIZE) return "Image must be 5 MB or smaller.";
  return null;
}

/** Retained for programmatic callers; interactive uploads use ImageCropDialog. */
export function cropAndResizeImage(file: File, size = OUTPUT_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Canvas not supported"));
        const side = Math.min(image.width, image.height);
        context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface ClubAvatarUploadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  accentColor?: string;
  clubName?: string;
  isDark: boolean;
  size?: number;
}

/** Club identity picker with intentional drag, reposition, and scale controls. */
export function ClubAvatarUpload({
  value,
  onChange,
  accentColor = "#436850",
  clubName = "",
  isDark,
  size = 96,
}: ClubAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const initials = clubName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");

  const openCropper = useCallback(async (file: File) => {
    const validationError = validateImageFile(file);
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
    <div className="flex flex-col items-center gap-3">
      <div className="relative group" style={{ width: size, height: size }}>
        <div className={`relative h-full w-full overflow-hidden rounded-2xl ring-2 ${ringColor}`}>
          {value ? (
            <img src={value} alt="Club logo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` }}>
              {initials ? <span className="select-none font-bold text-white" style={{ fontSize: size * 0.3 }}>{initials}</span> : <Upload className="text-white/60" style={{ width: size * 0.3, height: size * 0.3 }} />}
            </div>
          )}
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 transition-opacity duration-200 ${dragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <Camera className="h-5 w-5 text-white" />
            <span className="text-[10px] font-semibold text-white">{dragging ? "Drop here" : "Adjust"}</span>
          </div>
        </div>

        <button
          type="button"
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4CAF50]/60"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          aria-label="Upload and crop club logo"
        ><span className="sr-only">Upload and crop club logo</span></button>

        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setError(null); }}
            className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:bg-red-500/80 group-hover:opacity-100"
            aria-label="Remove club logo"
          ><X className="h-3.5 w-3.5 text-white" /></button>
        )}
      </div>

      <div className="text-center">
        <button type="button" onClick={() => inputRef.current?.click()} className={`text-xs font-semibold transition-colors ${isDark ? "text-[#4CAF50] hover:text-[#66BB6A]" : "text-[#436850] hover:text-[#3a5230]"}`}>
          {value ? "Adjust club logo" : "Upload club logo"}
        </button>
        <p className={`mt-0.5 text-[10px] ${isDark ? "text-white/30" : "text-[#436850]"}`}>Drag, scale, and crop · max 5 MB</p>
      </div>

      {error && <p className="max-w-[180px] text-center text-xs text-red-400">{error}</p>}
      <input aria-label="Upload club logo" ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleFileChange} />
      <ImageCropDialog
        imageSrc={cropSrc}
        title="Crop club logo"
        description="Position and scale the image for the club’s square identity mark."
        aspect={1}
        cropShape="round"
        output={{ width: OUTPUT_SIZE, height: OUTPUT_SIZE, quality: 0.88 }}
        onApply={(dataUrl) => { onChange(dataUrl); setCropSrc(null); }}
        onCancel={() => setCropSrc(null)}
      />
    </div>
  );
}
