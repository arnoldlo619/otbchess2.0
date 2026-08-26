import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("RSVP collapse accessibility", () => {
  it("uses a native form-builder toggle with expanded state and a controlled region", () => {
    const source = read("client/src/components/club/RsvpFormBuilder.tsx");

    expect(source).toContain('aria-controls="rsvp-form-builder-content"');
    expect(source).toContain("aria-expanded={!collapsed}");
    expect(source).toContain('id="rsvp-form-builder-content"');
    expect(source).toContain('type="button"');
  });

  it("keeps analytics collapse and refresh as separate keyboard-operable buttons", () => {
    const source = read("client/src/components/club/RsvpFormAnalytics.tsx");

    expect(source).toContain('aria-controls="rsvp-form-analytics-content"');
    expect(source).toContain("aria-expanded={expanded}");
    expect(source).toContain('id="rsvp-form-analytics-content"');
    expect(source).toContain('aria-label="Refresh RSVP analytics"');
    expect(source).not.toContain("onClick={(e) => { e.stopPropagation(); void load(true); }}");
  });
});
