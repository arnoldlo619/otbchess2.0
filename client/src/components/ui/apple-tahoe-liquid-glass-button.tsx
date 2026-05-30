import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "relative isolate inline-flex items-center justify-center gap-2 rounded-full cursor-pointer transition-transform duration-300 ease-out tracking-tight disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50",
  {
    variants: {
      size: {
        default: "px-6 py-3.5 text-base font-medium",
        sm: "px-4 py-2 text-sm font-medium",
        lg: "px-8 py-4 text-lg font-medium",
        icon: "h-10 w-10 p-0 gap-0",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
  glassColor?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, glassColor, style, ...props }, ref) => {
    return (
      <button
        className={cn(glassButtonVariants({ size }), "btn-liquid", className)}
        ref={ref}
        style={style}
        {...props}
      >
        {/* ISOLATED BACKGROUND LENS */}
        <span
          className="btn-liquid-lens absolute inset-0 -z-10 rounded-[inherit] pointer-events-none"
          style={glassColor ? { backgroundColor: glassColor } : undefined}
        />
        {/* TEXT CONTENT */}
        <span className={cn("btn-liquid-text relative z-10 w-full flex items-center justify-center gap-[inherit] select-none", contentClassName)}>
          {children}
        </span>
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };
