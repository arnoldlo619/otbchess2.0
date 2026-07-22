import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnimatedGradientText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Base: frosted glass pill with subtle inner glow
        // Hover: stronger outer + inner glow, gradient border speeds up via [animation-duration]
        "group relative mx-auto flex max-w-fit flex-row items-center justify-center rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium backdrop-blur-sm [--bg-size:300%] dark:bg-black/30",
        // Shadow transitions
        "shadow-[inset_0_-8px_10px_#7cf5621a,0_0_0_0_#7cf56200]",
        "transition-[box-shadow,transform] duration-300 ease-out",
        "hover:shadow-[inset_0_-6px_14px_#7cf56240,0_0_18px_4px_#7cf56228]",
        className,
      )}
    >
      {/* Animated gradient border — speeds up on hover via group-hover animation-duration */}
      <div
        className={cn(
          "absolute inset-0 block h-full w-full bg-gradient-to-r from-[#7cf562]/60 via-[#adbc9f]/60 to-[#7cf562]/60 bg-[length:var(--bg-size)_100%] p-[1px]",
          "![mask-composite:subtract] [border-radius:inherit] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]",
          // Default speed 8s, hover speed 2.5s — controlled via inline style on the child
          "animate-gradient [animation-duration:8s] group-hover:[animation-duration:2.5s]",
        )}
      />
      {children}
    </div>
  );
}
