import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type VideoTextProps = {
  text: string;
  src: string;
  className?: string;
};

/**
 * Keeps headline text selectable and accessible while a local looping video is
 * composited inside its glyphs. The typed fallback remains visible until the
 * first decoded frame is available or when motion is reduced.
 */
export function VideoText({ text, src, className }: VideoTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number>(0);
  const visibleRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const drawFrame = useCallback(() => {
    const root = rootRef.current;
    const words = textRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext("2d");

    if (!root || !words || !canvas || !video || !context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return false;
    }

    const box = root.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(box.width * pixelRatio);
    const height = Math.round(box.height * pixelRatio);
    if (!width || !height) return false;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const style = getComputedStyle(root);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.textBaseline = "alphabetic";

    const range = document.createRange();
    const textNode = words.firstChild;
    if (!textNode) return false;

    for (const match of Array.from(text.matchAll(/\S+/g))) {
      const start = match.index ?? 0;
      range.setStart(textNode, start);
      range.setEnd(textNode, start + match[0].length);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      const metrics = context.measureText(match[0]);
      const baseline = rect.top - box.top + (rect.height + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      context.fillText(match[0], rect.left - box.left, baseline);
    }

    context.globalCompositeOperation = "source-in";
    const ratio = Math.max(box.width / video.videoWidth, box.height / video.videoHeight);
    const drawWidth = video.videoWidth * ratio;
    const drawHeight = video.videoHeight * ratio;
    context.drawImage(video, (box.width - drawWidth) / 2, (box.height - drawHeight) / 2, drawWidth, drawHeight);
    root.dataset.videoTextReady = "true";

    return !reducedMotionRef.current && !video.paused;
  }, [text]);

  const cancelFrame = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
  }, []);

  const scheduleFrame = useCallback(() => {
    cancelFrame();
    const tick = () => {
      const shouldContinue = drawFrame();
      frameRef.current = shouldContinue ? requestAnimationFrame(tick) : 0;
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [cancelFrame, drawFrame]);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return;

    root.removeAttribute("data-video-text-ready");
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reducedMotionRef.current = mediaQuery.matches;
      if (mediaQuery.matches) {
        video.pause();
        video.currentTime = 0;
        cancelFrame();
        drawFrame();
      } else if (visibleRef.current) {
        void video.play().then(scheduleFrame).catch(drawFrame);
      }
    };

    const start = () => {
      if (!visibleRef.current) return;
      if (reducedMotionRef.current) {
        video.pause();
        video.currentTime = 0;
        drawFrame();
        return;
      }
      void video.play().then(scheduleFrame).catch(drawFrame);
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = Boolean(entry?.isIntersecting);
      if (visibleRef.current) start();
      else {
        video.pause();
        cancelFrame();
      }
    }, { threshold: 0.1 });
    visibilityObserver.observe(root);

    const resizeObserver = new ResizeObserver(() => drawFrame());
    resizeObserver.observe(root);
    const handleLoaded = () => start();
    const handleSeeked = () => drawFrame();

    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("seeked", handleSeeked);
    mediaQuery.addEventListener("change", updateMotionPreference);
    reducedMotionRef.current = mediaQuery.matches;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) start();

    return () => {
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      video.pause();
      cancelFrame();
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("seeked", handleSeeked);
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, [cancelFrame, drawFrame, scheduleFrame, src]);

  return (
    <span ref={rootRef} className={cn("otb-video-text", className)}>
      <span ref={textRef} className="otb-video-text__fallback">{text}</span>
      <canvas ref={canvasRef} className="otb-video-text__canvas" aria-hidden="true" />
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        className="otb-video-text__video"
      />
    </span>
  );
}
