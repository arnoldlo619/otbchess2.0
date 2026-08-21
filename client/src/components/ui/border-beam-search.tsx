import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BorderBeamSearchProps = {
  children: ReactNode;
  className?: string;
  active?: boolean;
  isDark?: boolean;
};

/**
 * A lightweight local search treatment that avoids a third-party animation
 * dependency while keeping the moving perimeter on the compositor.
 */
export function BorderBeamSearch({ children, className, active = false, isDark = true }: BorderBeamSearchProps) {
  return (
    <div
      className={cn(
        "prep-border-beam",
        active && "prep-border-beam--active",
        isDark ? "prep-border-beam--dark" : "prep-border-beam--light",
        className,
      )}
    >
      <span className="prep-border-beam__track" aria-hidden="true" />
      <span className="prep-border-beam__surface" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default BorderBeamSearch;
