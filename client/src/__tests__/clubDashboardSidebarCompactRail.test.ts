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
    expect(sidebarSource).toContain("color-mix(in srgb, ${accent} 11%, transparent)");
    expect(sidebarSource).toContain("hoveredItemId === item.id ? `1px solid color-mix(in srgb, ${accent} 34%, transparent)`");
    expect(sidebarSource).toContain('transform: hoveredItemId === item.id ? "translateY(-1px) scale(1.04)" : "scale(1)"');
    expect(sidebarSource).toContain("focus-visible:ring-2");
    expect(sidebarSource).toContain("active:scale-[0.98]");
    expect(sidebarSource).toContain("motion-reduce:transition-none");
  });

  it("keeps the expanded desktop navigation above translucent Club header chrome", () => {
    expect(sidebarSource).toContain("expandedBackground?: string;");
    expect(sidebarSource).toContain('data-club-sidebar-expanded={expanded ? "true" : "false"}');
    expect(sidebarSource).toContain("z-[60] isolate");
    expect(sidebarSource).toContain("backgroundColor: expanded ? (expandedBackground ?? background) : background,");
    expect(dashboardSource).toContain('expandedBackground={navTint ?? "oklch(0.115 0.025 145)"}');
    expect(demoSource).toContain('expandedBackground="oklch(0.115 0.025 145)"');
  });

  it("renders the OTB thumbnail as the permanent Club dashboard header identity", () => {
    expect(sidebarSource).toContain('const OTB_THUMBNAIL_LOGO = "/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp"');
    expect(sidebarSource).toContain('src={OTB_THUMBNAIL_LOGO}');
    expect(sidebarSource).toContain('alt="OTB!!"');
    expect(sidebarSource).not.toContain("brandImageSrc");
    expect(sidebarSource).not.toContain("brandLabel");
    expect(sidebarSource).not.toContain("otb-wordmark-brilliant.webp");
    expect(sidebarSource).toContain("aria-label={brandActionLabel}");
    expect(dashboardSource).not.toContain("brandImageSrc={club.avatarUrl}");
  });

  it("keeps Settings in the sidebar footer and removes the redundant Back to Club footer action", () => {
    expect(dashboardSource).toContain('{ id: "settings", label: "Settings", icon: OtbSettingsIcon, ownerOnly: true, group: "manage" }');
    expect(dashboardSource).not.toContain('footerAction={{ label: "Back to Club"');
    expect(demoSource).toContain('{ id: "settings", label: "Settings", icon: SettingsIcon, group: "manage" }');
  });

  it("uses the same controlled sidebar component for root, Meetup, and QR check-in Club contexts", () => {
    expect(meetupSource).toContain('import { ClubDashboardSidebar, type ClubDashboardSidebarItem }');
    expect(checkInSource).toContain('import { ClubDashboardSidebar, type ClubDashboardSidebarItem }');
    expect(meetupSource).not.toContain("footerAction={{ label: \"Back to Club\"");
    expect(checkInSource).not.toContain("footerAction={{ label: \"Back to Club\"");
    expect(meetupSource).not.toContain("brandImageSrc={club?.avatarUrl}");
    expect(checkInSource).not.toContain("brandImageSrc={club?.avatarUrl}");
  });

  it("uses communication and community icons only for Feed and Members while preserving the existing chess-native icons elsewhere", () => {
    expect(sidebarSource).toContain('import { MessagesSquare, UsersRound } from "lucide-react"');
    expect(sidebarSource).toContain("feed: MessagesSquare");
    expect(sidebarSource).toContain("members: UsersRound");
    expect(sidebarSource).toContain("const Icon = CLUB_SIDEBAR_ICON_OVERRIDES[item.id] ?? item.icon");
  });

  it("keeps navigation vertically centered and makes icon actions discoverable through descriptive tooltips", () => {
    expect(sidebarSource).toContain('className="flex flex-1 flex-col justify-center overflow-y-auto px-3 py-5"');
    expect(sidebarSource).toContain("const CLUB_SIDEBAR_ITEM_DESCRIPTIONS");
    expect(sidebarSource).toContain("const description = item.description ?? CLUB_SIDEBAR_ITEM_DESCRIPTIONS[item.id];");
    expect(sidebarSource).toContain("<Tooltip key={item.id} delayDuration={expanded ? 600 : 350}>");
    expect(sidebarSource).toContain("function renderTooltipContent(");
    expect(sidebarSource).toContain("aria-label={item.label}");
  });

  it("supports branded footer actions and context-specific navigation labels for sibling dashboards", () => {
    expect(sidebarSource).toContain("footerAction?: ClubDashboardSidebarFooterAction;");
    expect(sidebarSource).toContain("ariaLabel?: string;");
    expect(sidebarSource).toContain("footerAriaLabel?: string;");
    expect(sidebarSource).toContain("function renderFooterAction()");
    expect(sidebarSource).toContain("function renderBrandAction()");
    expect(sidebarSource).toContain("description?: string;");
    expect(sidebarSource).toContain("{(settingsItem || footerAction) && (");
  });
});
