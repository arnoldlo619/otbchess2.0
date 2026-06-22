/**
 * TrainingGallery — Gallery4-style horizontal carousel adapted to the OTB design system.
 * Used on the Training page to showcase each feature as a case study card.
 */
"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useTheme } from "@/contexts/ThemeContext";

export interface TrainingFeatureItem {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  cta: string;
  image: string;
  imageAlt: string;
  highlights: string[];
}

interface TrainingGalleryProps {
  title?: string;
  description?: string;
  items: TrainingFeatureItem[];
  onImageClick?: (src: string) => void;
}

export function TrainingGallery({
  title = "Training Tools",
  description = "Everything you need to study, prepare, and improve your OTB chess game.",
  items,
  onImageClick,
}: TrainingGalleryProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    const update = () => {
      setCanScrollPrev(carouselApi.canScrollPrev());
      setCanScrollNext(carouselApi.canScrollNext());
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    update();
    carouselApi.on("select", update);
    return () => { carouselApi.off("select", update); };
  }, [carouselApi]);

  const handleCta = (item: TrainingFeatureItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (item.external) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = item.href;
    }
  };

  return (
    <section className="w-full">
      {/* Desktop nav arrows — right-aligned */}
      <div className="mb-6 flex items-center justify-end px-4 sm:px-0">
        <div className="hidden shrink-0 gap-2 md:flex">
          <button
            onClick={() => carouselApi?.scrollPrev()}
            disabled={!canScrollPrev}
            aria-label="Previous feature"
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark
                ? "border-white/15 text-white/60 hover:border-[#5B9A6A]/60 hover:text-[#5B9A6A] hover:bg-[#5B9A6A]/10"
                : "border-[#ADBC9F] text-[#436850] hover:border-[#436850]/50 hover:text-[#436850] hover:bg-[#436850]/05"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => carouselApi?.scrollNext()}
            disabled={!canScrollNext}
            aria-label="Next feature"
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark
                ? "border-white/15 text-white/60 hover:border-[#5B9A6A]/60 hover:text-[#5B9A6A] hover:bg-[#5B9A6A]/10"
                : "border-[#ADBC9F] text-[#436850] hover:border-[#436850]/50 hover:text-[#436850] hover:bg-[#436850]/05"
            }`}
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="w-full">
        <Carousel
          setApi={setCarouselApi}
          opts={{
            align: "start",
            breakpoints: {
              "(max-width: 768px)": { dragFree: true },
            },
          }}
        >
          <CarouselContent className="ml-0 pl-4 sm:pl-0">
            {items.map((item) => (
              <CarouselItem
                key={item.id}
                className="basis-[85vw] sm:basis-[360px] lg:basis-[400px] pl-4 sm:pl-5"
              >
                <div
                  className={`group relative h-full rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 ${
                    isDark
                      ? "bg-[#0f1c11] border-[#2e4a34]/60 hover:border-[#5B9A6A]/40 hover:shadow-xl hover:shadow-[#5B9A6A]/15"
                      : "bg-[#F0F5E8] border-[#ADBC9F] hover:border-[#436850]/30 hover:shadow-xl hover:shadow-[#436850]/10"
                  }`}
                >
                  {/* Image */}
                  <button
                    onClick={() => onImageClick?.(item.image)}
                    className="relative w-full overflow-hidden block aspect-[16/9] cursor-zoom-in focus:outline-none"
                    aria-label={`View ${item.title} screenshot fullscreen`}
                  >
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    {/* Zoom hint */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="bg-black/55 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 text-white text-xs font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 8v6M8 11h6" />
                        </svg>
                        View fullscreen
                      </div>
                    </div>
                    {/* In Beta badge over image */}
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-sm">
                        <Zap className="w-2.5 h-2.5" />
                        In Beta
                      </span>
                    </div>
                    {/* External badge */}
                    {item.external && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/40 text-white/70 border border-white/15 backdrop-blur-sm">
                          <ExternalLink className="w-2.5 h-2.5" />
                          External
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Card body */}
                  <div className="p-5 flex flex-col gap-3">
                    {/* Title */}
                    <h3 className={`text-base font-bold leading-snug ${isDark ? "text-white" : "text-[#12372A]"}`}>
                      {item.title}
                    </h3>

                    {/* Description */}
                    <p className={`text-sm leading-relaxed line-clamp-3 ${isDark ? "text-white/65" : "text-[#436850]"}`}>
                      {item.description}
                    </p>

                    {/* Highlight pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {item.highlights.map((h) => (
                        <span
                          key={h}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            isDark ? "bg-white/07 text-white/55" : "bg-[#ADBC9F]/40 text-[#436850]"
                          }`}
                        >
                          {h}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={(e) => handleCta(item, e)}
                      className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-200 group/cta ${
                        isDark ? "text-[#5B9A6A] hover:text-[#7ab88a]" : "text-[#436850] hover:text-[#2f5438]"
                      }`}
                    >
                      {item.cta}
                      {item.external
                        ? <ExternalLink className="w-3.5 h-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                        : <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/cta:translate-x-1" />
                      }
                    </button>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Dot indicators */}
        <div className="mt-6 flex justify-center gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => carouselApi?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === index
                  ? isDark ? "w-6 bg-[#5B9A6A]" : "w-6 bg-[#436850]"
                  : isDark ? "w-1.5 bg-white/20" : "w-1.5 bg-[#ADBC9F]"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
