import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSource = readFileSync(
  resolve(process.cwd(), "client/src/components/club/ClubDashboardSidebar.tsx"),
  "utf8",
);

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"),
  "utf8",
);

const demoSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/ClubDashboardDemo.tsx"),
  "utf8",
);

const meetupSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/MeetupEventPage.tsx"),
  "utf8",
);

const checkInSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/CheckInPage.tsx"),
  "utf8",
);

describe("Club Dashboard shared sidebar", () => {
  it("uses a consistent compact 72px rail and a larger touch-safe active control", () => {
    expect(sidebarSource).toContain('width: expanded ? "264px" : "72px"');
    expect(sidebarSource).toContain('width: expanded ? "calc(100% - 4px)" : "52px"');
    expect(sidebarSource).toContain('height: "52px"');
    expect(sidebarSource).toContain('width: "40px"');
    expect(sidebarSource).toContain('height: "40px"');
    expect(sidebarSource).toContain("alignSelf: \"center\"");
    expect(sidebarSource).toContain("<Icon size={22}");
    expect(sidebarSource).toContain('flex: expanded ? "1 1 0%" : "0 0 0"');
    expect(sidebarSource).toContain('overflow: expanded ? "visible" : "hidden"');
  });

  it("gives the selected destination a strong but restrained brand frame across compact and expanded states", () => {
    expect(sidebarSource).toContain("border: active ? `1px solid color-mix(in srgb, ${accent} 52%, transparent)`");
    expect(sidebarSource).toContain("border: active ? `1px solid color-mix(in srgb, ${accent} 24%, transparent)`");
    expect(sidebarSource).toContain("aria-current={active ? \"page\" : undefined}");
    expect(sidebarSource).toContain("active:scale-[0.98]");
    expect(sidebarSource).toContain("focus-visible:ring-2");
    expect(sidebarSource).toContain("motion-reduce:transition-none");
  });

  it("keeps hover feedback subordinate to the active selection and safe for pointer, keyboard, and reduced-motion users", () => {
    expect(sidebarSource).toContain("event.pointerType !== \"touch\"");
    expect(sidebarSource).toContain("color-mix(in srgb, ${accent} 8%, transparent)");
    expect(sidebarSource).toContain("hoveredItemId === item.id ? `1px solid color-mix(in srgb, ${accent} 27%, transparent)`");
    expect(sidebarSource).toContain('transform: hoveredItemId === item.id ? "translateY(-1px) scale(1.04)" : "scale(1)"');
    expect(sidebarSource).toContain("focus-visible:ring-2");
    expect(sidebarSource).toContain("active:scale-[0.98]");
    expect(sidebarSource).toContain("motion-reduce:transition-none");
  });

  it("renders an uploaded Club identity in the header with a durable OTB fallback and no generic wordmark swap", () => {
    expect(sidebarSource).toContain('const OTB_THUMBNAIL_LOGO = "/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp"');
    expect(sidebarSource).toContain("brandImageSrc?: string | null;");
    expect(sidebarSource).toContain("brandLabel?: string;");
    expect(sidebarSource).toContain("const displayedBrandImageSrc = brandImageSrc");
    expect(sidebarSource).toContain("onError={() => setBrandImageFailed(true)}");
    expect(sidebarSource).not.toContain("otb-wordmark-brilliant.webp");
    expect(sidebarSource).toContain("aria-label={brandActionLabel}");
    expect(dashboardSource).toContain("brandImageSrc={club.avatarUrl}");
    expect(dashboardSource).toContain("brandLabel={club.name}");
  });

  it("keeps Settings in the centered primary stack and reserves the footer for returning to the Club profile", () => {
    expect(dashboardSource).toContain('{ id: "settings", label: "Settings", icon: OtbSettingsIcon, ownerOnly: true, group: "workspace" }');
    expect(dashboardSource).toContain('footerAction={{ label: "Back to Club", icon: ChevronLeft');
    expect(demoSource).toContain('{ id: "settings", label: "Settings", icon: SettingsIcon, group: "workspace" }');
  });

  it("uses the same controlled sidebar component for root, Meetup, and QR check-in Club contexts", () => {
    expect(meetupSource).toContain('import { ClubDashboardSidebar, type ClubDashboardSidebarItem }');
    expect(meetupSource).toContain("footerAction={{ label: \"Back to Club\"");
    expect(checkInSource).toContain('import { ClubDashboardSidebar, type ClubDashboardSidebarItem }');
    expect(checkInSource).toContain("footerAction={{ label: \"Back to Club\"");
    expect(meetupSource).toContain("brandImageSrc={club?.avatarUrl}");
    expect(checkInSource).toContain("brandImageSrc={club?.avatarUrl}");
  });

  it("keeps compact navigation vertically centered and labels available through tooltips", () => {
    expect(sidebarSource).toContain('className="flex flex-1 flex-col justify-center overflow-y-auto px-3 py-5"');
    expect(sidebarSource).toContain("if (expanded) return <div key={item.id}>{button}</div>;");
    expect(sidebarSource).toContain("<Tooltip key={item.id} delayDuration={250}>");
    expect(sidebarSource).toContain("aria-label={item.label}");
  });
});
