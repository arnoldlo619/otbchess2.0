"use client";

/**
 * AnnouncementBanner
 *
 * A premium pill-shaped announcement badge for the hero section.
 * Uses AnimatedGradientText with an OTB green gradient border animation.
 *
 * Usage:
 *   <AnnouncementBanner
 *     label="NEW"
 *     text="Chicago Chess Club Highlight!"
 *     href="/blog"
 *     isDark={isDark}
 *   />
 */

import React from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

interface AnnouncementBannerProps {
  /** Short badge label on the left pill, e.g. "NEW" */
  label?: string;
  /** Main announcement text */
  text: string;
  /** Where to navigate on click. Uses wouter Link if internal, <a> if external. */
  href?: string;
  /** Whether the current theme is dark */
  isDark?: boolean;
  className?: string;
}

export function AnnouncementBanner({
  label = "NEW",
  text,
  href,
  isDark = false,
  className,
}: AnnouncementBannerProps) {
  const inner = (
    <AnimatedGradientText
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]",
        isDark
          ? "bg-white/5 hover:bg-white/10"
          : "bg-[#EEF5EE]/80 hover:bg-[#ADBC9F]/20",
        className
      )}
    >
      {/* Left badge pill */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider leading-none mr-1",
          isDark
            ? "bg-[oklch(0.44_0.14_145)] text-white"
            : "bg-[#12372A] text-white"
        )}
      >
        {/* Premium chess king crown icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" aria-hidden="true">
          <path d="M3 18h18v2H3v-2z" fill="currentColor" opacity="0.7"/>
          <path d="M5 16l2-8 5 4 5-4 2 8H5z" fill="currentColor"/>
          <circle cx="3" cy="8" r="2" fill="currentColor"/>
          <circle cx="12" cy="5" r="2" fill="currentColor"/>
          <circle cx="21" cy="8" r="2" fill="currentColor"/>
        </svg>
        {label}
      </span>

      {/* Vertical divider */}
      <hr className={cn("mx-1.5 h-4 w-px shrink-0", isDark ? "bg-white/20" : "bg-[#436850]/25")} />

      {/* Animated gradient announcement text */}
      <span
        className={cn(
          "inline animate-gradient bg-gradient-to-r bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent text-[13px] font-semibold tracking-wide",
          isDark
            ? "from-[#7cf562] via-[#adbc9f] to-[#7cf562]"
            : "from-[#12372A] via-[#436850] to-[#12372A]"
        )}
      >
        {text}
      </span>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          "ml-1 w-3.5 h-3.5 flex-shrink-0 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5",
          isDark ? "text-white/50" : "text-[#436850]/70"
        )}
      />
    </AnimatedGradientText>
  );

  if (!href) return <span className="inline-flex">{inner}</span>;

  // Internal wouter link
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="group inline-flex">
        {inner}
      </Link>
    );
  }

  // External link
  return (
    <a href={href} className="group inline-flex" target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  );
}
