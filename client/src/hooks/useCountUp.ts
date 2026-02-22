/**
 * useCountUp — Animates a number from 0 (or a start value) to a target.
 * Uses requestAnimationFrame for smooth, frame-perfect animation.
 * Supports easing, custom duration, and a trigger flag.
 */

import { useState, useEffect, useRef } from "react";

type EasingFn = (t: number) => number;

// Ease out cubic — fast start, gentle landing
const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3);

// Ease out expo — dramatic fast start, very soft landing (great for ELO reveal)
const easeOutExpo: EasingFn = (t) =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

interface UseCountUpOptions {
  target: number;
  duration?: number; // ms, default 1400
  start?: number;    // default 0
  easing?: "easeOutCubic" | "easeOutExpo";
  trigger?: boolean; // only starts when true
  decimals?: number; // decimal places, default 0
}

export function useCountUp({
  target,
  duration = 1400,
  start = 0,
  easing = "easeOutExpo",
  trigger = true,
  decimals = 0,
}: UseCountUpOptions): { value: number; displayValue: string; done: boolean } {
  const [value, setValue] = useState(start);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const easingFn = easing === "easeOutExpo" ? easeOutExpo : easeOutCubic;

  useEffect(() => {
    if (!trigger) {
      setValue(start);
      setDone(false);
      return;
    }

    // Reset on new target
    setValue(start);
    setDone(false);
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFn(progress);
      const current = start + (target - start) * easedProgress;

      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
        setDone(true);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, trigger, duration, start]);

  const displayValue =
    decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString();

  return { value, displayValue, done };
}
