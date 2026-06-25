"use client";

/**
 * AnnouncementBanner
 *
 * A pill-shaped announcement badge for the hero section.
 * Adapts to OTB light/dark design tokens.
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
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-1 py-1 pr-3 text-sm font-medium transition-all duration-200",
        "hover:scale-[1.03] active:scale-[0.98]",
        isDark
          ? "border-white/15 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10"
          : "border-[#436850]/25 bg-[#EEF5EE] text-[#12372A] hover:border-[#436850]/50 hover:bg-[#ADBC9F]/30",
        className
      )}
    >
      {/* Left badge pill */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider leading-none",
          isDark
            ? "bg-[oklch(0.44_0.14_145)] text-white"
            : "bg-[#12372A] text-white"
        )}
      >
        {/* Premium chess king crown icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" aria-hidden="true">
          <path d="M3 18h18v2H3v-2z" fill="currentColor" opacity="0.7"/>
          <path d="M5 16l2-8 5 4 5-4 2 8H5z" fill="currentColor"/>
          <circle cx="3" cy="8" r="2" fill="currentColor"/>
          <circle cx="12" cy="5" r="2" fill="currentColor"/>
          <circle cx="21" cy="8" r="2" fill="currentColor"/>
        </svg>
        {label}
      </span>

      {/* Announcement text */}
      <span className="text-[13px] font-semibold tracking-wide">{text}</span>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
          isDark ? "text-white/40" : "text-[#436850]/60"
        )}
      />
    </span>
  );

  if (!href) return <span className="cursor-default">{inner}</span>;

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
