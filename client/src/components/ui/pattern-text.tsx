import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type PatternTextProps = Omit<ComponentProps<"span">, "children"> & {
  text: string;
};

/**
 * Keeps the headline as accessible text while rendering the duplicate pattern
 * layer as a decorative offset shadow.
 */
export function PatternText({ text, className, ...props }: PatternTextProps) {
  return (
    <span
      data-shadow={text}
      className={cn("otb-pattern-text", className)}
      {...props}
    >
      <span className="otb-pattern-text__foreground">{text}</span>
    </span>
  );
}
