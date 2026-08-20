import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type PatternTextProps = Omit<ComponentProps<"span">, "children"> & {
  text: string;
};

/** A subtle moving hatch texture for display type; visual-only and theme-safe. */
export function PatternText({ text, className, ...props }: PatternTextProps) {
  return (
    <span data-pattern-text={text} className={cn("otb-pattern-text", className)} {...props}>
      {text}
    </span>
  );
}
