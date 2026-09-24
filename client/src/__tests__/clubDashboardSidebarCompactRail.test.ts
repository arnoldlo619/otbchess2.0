import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSource = readFileSync(
  resolve(process.cwd(), "client/src/components/club/ClubDashboardSidebar.tsx"),
  "utf8",
);

describe("Club Dashboard compact sidebar rail", () => {
  it("keeps icon controls at a consistent scale between compact and expanded sidebar states", () => {
    expect(sidebarSource).toContain('width: expanded ? "264px" : "72px"');
    expect(sidebarSource).toContain('width: expanded ? "calc(100% - 4px)" : "46px"');
    expect(sidebarSource).toContain('height: "46px"');
    expect(sidebarSource).toContain('width: "36px"');
    expect(sidebarSource).toContain('height: "36px"');
    expect(sidebarSource).toContain("alignSelf: \"center\"");
    expect(sidebarSource).toContain("<Icon size={21}");
    expect(sidebarSource).toContain('flex: expanded ? "1 1 0%" : "0 0 0"');
    expect(sidebarSource).toContain('overflow: expanded ? "visible" : "hidden"');
    expect(sidebarSource).toContain('text-base font-semibold');
  });

  it("gives the selected compact item a static brand border frame without replacing accessible navigation states", () => {
    expect(sidebarSource).toContain("const compact = !expanded;");
    expect(sidebarSource).toContain("border: active && compact ? `1px solid color-mix(in srgb, ${accent} 52%, transparent)`");
    expect(sidebarSource).toContain("border: active && compact ? `1px solid color-mix(in srgb, ${accent} 24%, transparent)`");
    expect(sidebarSource).toContain("aria-current={active ? \"page\" : undefined}");
    expect(sidebarSource).toContain("active:scale-[0.98]");
    expect(sidebarSource).toContain("focus-visible:ring-2");
    expect(sidebarSource).toContain("motion-reduce:transition-none");
  });

  it("keeps hover feedback visible but subordinate to active, focus, touch, and reduced-motion states", () => {
    expect(sidebarSource).toContain("event.pointerType !== \"touch\"");
    expect(sidebarSource).toContain("color-mix(in srgb, ${accent} 8%, transparent)");
    expect(sidebarSource).toContain("hoveredItemId === item.id && compact ? `1px solid color-mix(in srgb, ${accent} 27%, transparent)`");
    expect(sidebarSource).toContain('transform: hoveredItemId === item.id ? "translateY(-1px) scale(1.04)" : "scale(1)"');
    expect(sidebarSource).toContain("focus-visible:ring-2");
    expect(sidebarSource).toContain("active:scale-[0.98]");
    expect(sidebarSource).toContain("motion-reduce:transition-none");
  });

  it("crossfades the compact mark into a smaller, left-aligned supplied wordmark without changing its accessible back-to-clubs action", () => {
    expect(sidebarSource).toContain('style={{ justifyContent: expanded ? "flex-start" : "center" }}');
    expect(sidebarSource).toContain('className="group/brand relative flex h-16 shrink-0 items-center justify-center');
    expect(sidebarSource).toContain('width: expanded ? "136px" : "64px"');
    expect(sidebarSource).toContain('src="/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp"');
    expect(sidebarSource).toContain('src="/club-assets/otb-wordmark-brilliant.webp"');
    expect(sidebarSource).toContain('className="absolute h-14 w-[136px] object-contain mix-blend-screen');
    expect(sidebarSource).toContain('opacity: expanded ? 1 : 0');
    expect(sidebarSource).toContain('opacity: expanded ? 0 : 1');
    expect(sidebarSource).toContain('transitionDelay: expanded ? "75ms" : "0ms"');
    expect(sidebarSource).toContain("motion-reduce:transition-none");
    expect(sidebarSource).toContain('aria-label="Back to all clubs"');
  });

  it("keeps compact navigation centered within the usable rail and labels available through tooltips", () => {
    expect(sidebarSource).toContain('className="flex flex-1 flex-col justify-center overflow-y-auto px-3 py-5"');
    expect(sidebarSource).toContain("if (expanded) return <div key={item.id}>{button}</div>;");
    expect(sidebarSource).toContain("<Tooltip key={item.id} delayDuration={250}>");
    expect(sidebarSource).toContain("aria-label={item.label}");
  });
});
