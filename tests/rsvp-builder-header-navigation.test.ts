import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/RsvpFormBuilderPage.tsx"),
  "utf8"
);

describe("RSVP builder header navigation", () => {
  it("uses one icon-backed navigation model for desktop and mobile", () => {
    expect(source).toContain("const FORM_BUILDER_TABS = [");
    expect(source).toContain('label: "Questions", icon: ClipboardList');
    expect(source).toContain('label: "Responses", icon: BarChart2');
    expect(source).toContain('label: "Settings", icon: SlidersHorizontal');
    expect(source).toContain('label: "Theme", icon: Palette');
    expect((source.match(/FORM_BUILDER_TABS\.map/g) ?? []).length).toBe(2);
  });

  it("keeps a compact, accessible header action hierarchy", () => {
    expect(source).toContain('aria-label="Back to event"');
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain('aria-current={tab === id ? "page" : undefined}');
    expect(source).toContain('focus-visible:ring-2 focus-visible:ring-green-400/70');
    expect(source).toContain('className="fixed top-16 left-0 right-0 z-40 grid grid-cols-4 border-b lg:hidden"');
  });

  it("uses the platform appearance toggle and a single text-only form identity", () => {
    expect(source).toContain('import { ThemeToggle } from "@/components/ThemeToggle"');
    expect(source).toContain('<ThemeToggle className="flex-shrink-0" />');
    expect(source).toContain('data-rsvp-theme={theme}');
    expect(source).not.toContain('Recovered locally');
    expect(source).not.toContain('<ClipboardList className="h-4 w-4" style={{ color: ACCENT }} />');
    expect(source).not.toContain('text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">RSVP form');
    expect(source).toContain('{Boolean(form.isPublished) && (');
  });

  it("places an accessible Share action beside Publish with a native-share and copy-link fallback", () => {
    expect(source).toContain("Share2,");
    expect(source).toContain("async function shareForm()");
    expect(source).toContain("await navigator.share(shareData)");
    expect(source).toContain("await navigator.clipboard.writeText(shareUrl)");
    expect(source).toContain('aria-label={form.isPublished ? "Share published RSVP form" : "Publish the RSVP form before sharing"}');
    expect(source).toContain("disabled={!form.isPublished || saving}");
    expect(source.indexOf('aria-label={form.isPublished ? "Share published RSVP form"')).toBeLessThan(source.indexOf("onClick={togglePublish}"));
  });

  it("keeps the active desktop tab legible in both appearance modes", () => {
    expect(source).toContain('color: "var(--rsvp-nav-active-text)"');
  });

  it("reserves responsive content space below the desktop or mobile header", () => {
    expect(source).toContain('className="flex-1 overflow-y-auto pb-16 pt-28 lg:pt-16"');
    expect(source).toContain('className="fixed top-0 left-0 right-0 z-50 h-16 border-b px-3 sm:px-5"');
  });
});
