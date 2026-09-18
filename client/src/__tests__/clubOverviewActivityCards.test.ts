import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "../pages/ClubDashboard.tsx"), "utf8");

describe("Club overview Recent Activity cards", () => {
  it("uses taller article cards with appropriately scaled image treatment", () => {
    expect(source).toContain('className="group flex min-h-[132px] gap-3 px-4 py-4');
    expect(source).toContain('sm:min-h-[148px]');
    expect(source).toContain('className="relative flex h-[96px] w-[116px]');
    expect(source).toContain('sm:h-[112px] sm:w-[136px]"');
  });

  it("uses visible semantic h2 titles instead of small paragraph titles", () => {
    expect(source).toContain('<h2 className="line-clamp-2 text-base font-bold leading-5 sm:text-lg sm:leading-6"');
    expect(source).toContain('{displayActivityTitle}</h2>');
    expect(source).not.toContain('<p className="line-clamp-2 text-sm font-bold leading-5"');
  });

  it("removes decorative activity-type SVG icons while retaining the media label", () => {
    expect(source).not.toContain('const ActivityIcon =');
    expect(source).not.toContain('<ActivityIcon className=');
    expect(source).toContain('>{activityKind}</span>');
  });
});
