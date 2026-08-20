import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/RepertoireBuilder.tsx"), "utf8");

describe("Repertoire Builder typography", () => {
  it("elevates the repertoire title and board-context reading level", () => {
    expect(source).toContain('className="text-xl sm:text-2xl font-bold tracking-tight hover:underline text-white"');
    expect(source).toContain('text-base font-semibold ${isDark ? "text-white/80"');
    expect(source).toContain('text-sm flex flex-wrap items-center gap-x-2 gap-y-1');
  });

  it("uses more legible Explorer candidate and table typography", () => {
    expect(source).toContain('font-bold font-mono text-lg');
    expect(source).toContain('font-mono text-xs font-bold');
    expect(source).toContain('text-sm font-medium text-right shrink-0 w-20');
    expect(source).toContain('px-4 py-2.5 flex items-center gap-3 text-sm font-semibold');
  });

  it("keeps annotation notes readable at a comfortable body size", () => {
    expect(source).toContain('px-3 py-2.5 text-[15px] leading-relaxed resize-none');
  });
});
