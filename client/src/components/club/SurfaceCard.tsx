/**
 * SurfaceCard — Premium elevated card surface for the club dashboard.
 * Provides consistent border, background, shadow, and border-radius
 * across all club profile content cards.
 */
import React from "react";

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  isDark?: boolean;
  /** Optional section header content */
  header?: React.ReactNode;
  /** Reduce padding for dense content */
  compact?: boolean;
}

export function SurfaceCard({ children, className = "", isDark = true, header, compact }: SurfaceCardProps) {
  return (
    <div
      className={`rounded-[22px] overflow-hidden ${className}`}
      style={{
        background: isDark
          ? "linear-gradient(160deg, rgba(5,33,12,0.94) 0%, rgba(3,22,8,0.98) 100%)"
          : "linear-gradient(160deg, rgba(240,245,232,0.97) 0%, rgba(251,250,218,0.98) 100%)",
        border: isDark
          ? "1px solid rgba(115,255,130,0.09)"
          : "1px solid rgba(67,104,80,0.18)",
        boxShadow: isDark
          ? "0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)"
          : "0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      {header && (
        <div
          className="px-6 py-4"
          style={{
            borderBottom: isDark
              ? "1px solid rgba(115,255,130,0.07)"
              : "1px solid rgba(67,104,80,0.12)",
          }}
        >
          {header}
        </div>
      )}
      <div className={compact ? "p-4" : "p-6"}>{children}</div>
    </div>
  );
}

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  isDark?: boolean;
}

export function SectionHeader({ icon, title, subtitle, action, isDark = true }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: isDark ? "rgba(76,175,80,0.12)" : "rgba(67,104,80,0.10)",
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h3
            className="text-sm font-bold leading-tight"
            style={{
              color: isDark ? "rgba(255,255,255,0.90)" : "rgba(18,55,42,0.92)",
              fontFamily: "'Clash Display', 'Inter', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className="text-[11px] mt-0.5 leading-tight"
              style={{ color: isDark ? "rgba(255,255,255,0.38)" : "rgba(67,104,80,0.65)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
