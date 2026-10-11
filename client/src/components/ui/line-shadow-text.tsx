import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type LineShadowTextProps = Omit<ComponentProps<"span">, "children"> & {
  text: string;
};

/**
 * A semantic inline display treatment with a slow, line-textured shadow.
 * The readable foreground remains plain text; the duplicate layer is visual only.
 */
export function LineShadowText({ text, className, ...props }: LineShadowTextProps) {
  return (
    <span
      data-shadow={text}
      className={cn("otb-line-shadow-text", className)}
      {...props}
    >
      <span className="otb-line-shadow-text__foreground">{text}</span>
    </span>
  );
}
