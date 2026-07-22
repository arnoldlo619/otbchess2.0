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
        "group relative mx-auto flex max-w-fit flex-row items-center justify-center rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#7cf5621a] backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[inset_0_-5px_10px_#7cf5623a] dark:bg-black/30",
        className,
      )}
    >
      {/* Animated gradient border */}
      <div
        className="absolute inset-0 block h-full w-full animate-gradient bg-gradient-to-r from-[#7cf562]/60 via-[#adbc9f]/60 to-[#7cf562]/60 bg-[length:var(--bg-size)_100%] p-[1px] ![mask-composite:subtract] [border-radius:inherit] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]"
      />
      {children}
    </div>
  );
}
