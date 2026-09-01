import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ClubFeedGalleryImage = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
};

type ClubFeedMediaGalleryProps = {
  images: ClubFeedGalleryImage[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A focus-managed Feed image viewer with touch-friendly controls and thumbnail navigation. */
export function ClubFeedMediaGallery({ images, initialIndex, open, onOpenChange }: ClubFeedMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const imageCount = images.length;
  const activeImage = images[activeIndex] ?? images[0];

  useEffect(() => {
    if (open) setActiveIndex(Math.min(Math.max(initialIndex, 0), Math.max(imageCount - 1, 0)));
  }, [imageCount, initialIndex, open]);

  if (!activeImage) return null;

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + imageCount) % imageCount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-1rem)] max-w-5xl gap-0 overflow-hidden border-white/10 bg-[#06130d] p-0 text-white shadow-[0_24px_90px_rgba(0,0,0,0.55)] sm:w-[calc(100%-2rem)]"
      >
        <DialogTitle className="sr-only">Club Feed image gallery</DialogTitle>
        <DialogDescription className="sr-only">Use previous and next controls to navigate Club Feed images.</DialogDescription>
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-3 sm:px-4">
          <p className="min-w-0 truncate text-sm font-semibold text-white/85">{activeImage.fileName}</p>
          <div className="flex shrink-0 items-center gap-1">
            <a href={activeImage.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#4CAF50]" aria-label={`Open ${activeImage.fileName} in a new tab`}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Open</span>
            </a>
            <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#4CAF50]" aria-label="Close gallery">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[min(62dvh,620px)] items-center justify-center bg-black p-2 sm:p-4">
          <img src={activeImage.url} alt={activeImage.fileName || "Club Feed image attachment"} className="max-h-[62dvh] w-auto max-w-full rounded-lg object-contain" />
          {imageCount > 1 && (
            <>
              <button type="button" onClick={() => move(-1)} className="absolute left-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white transition hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-[#4CAF50] sm:left-5" aria-label="Previous image">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(1)} className="absolute right-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white transition hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-[#4CAF50] sm:right-5" aria-label="Next image">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="absolute bottom-3 rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-xs font-semibold text-white/75" aria-live="polite">{activeIndex + 1} of {imageCount}</span>
            </>
          )}
        </div>

        {imageCount > 1 && (
          <div className="flex max-h-24 gap-2 overflow-x-auto border-t border-white/10 bg-black/20 p-2" role="tablist" aria-label="Gallery images">
            {images.map((image, index) => (
              <button key={image.id} type="button" role="tab" aria-selected={index === activeIndex} aria-label={`View ${image.fileName}`} onClick={() => setActiveIndex(index)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-[#4CAF50] ${index === activeIndex ? "border-[#4CAF50]" : "border-transparent opacity-60 hover:opacity-100"}`}>
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
