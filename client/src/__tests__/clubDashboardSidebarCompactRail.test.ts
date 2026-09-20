import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSource = readFileSync(
  resolve(process.cwd(), "client/src/components/club/ClubDashboardSidebar.tsx"),
  "utf8",
);

describe("Club Dashboard compact sidebar rail", () => {
  it("uses enlarged centered icon controls that fit within the 72px compact rail", () => {
    expect(sidebarSource).toContain('width: expanded ? "264px" : "72px"');
    expect(sidebarSource).toContain('width: expanded ? "calc(100% - 4px)" : "46px"');
    expect(sidebarSource).toContain('height: expanded ? "42px" : "46px"');
    expect(sidebarSource).toContain('width: compact ? "36px" : "32px"');
    expect(sidebarSource).toContain('height: compact ? "36px" : "32px"');
    expect(sidebarSource).toContain("alignSelf: \"center\"");
    expect(sidebarSource).toContain("<Icon size={compact ? 21 : 19}");
    expect(sidebarSource).toContain('flex: expanded ? "1 1 0%" : "0 0 0"');
    expect(sidebarSource).toContain('overflow: expanded ? "visible" : "hidden"');
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

  it("keeps compact navigation centered within the usable rail and labels available through tooltips", () => {
    expect(sidebarSource).toContain('className="flex flex-1 flex-col justify-center overflow-y-auto px-3 py-5"');
    expect(sidebarSource).toContain("if (expanded) return <div key={item.id}>{button}</div>;");
    expect(sidebarSource).toContain("<Tooltip key={item.id} delayDuration={250}>");
    expect(sidebarSource).toContain("aria-label={item.label}");
  });
});
