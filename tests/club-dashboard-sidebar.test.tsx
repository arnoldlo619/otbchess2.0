// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChevronLeft } from "lucide-react";
import { ClubDashboardSidebar, type ClubDashboardSidebarItem } from "../client/src/components/club/ClubDashboardSidebar";

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", TestResizeObserver);

const TestIcon = ({ size }: { size?: number }) => <span data-icon-size={size}>Icon</span>;

const items: ClubDashboardSidebarItem[] = [
  { id: "overview", label: "Overview", icon: TestIcon, group: "workspace" },
  { id: "feed", label: "Feed", icon: TestIcon, group: "workspace" },
  { id: "events", label: "Events", icon: TestIcon, badge: 12, group: "workspace" },
  { id: "settings", label: "Settings", icon: TestIcon, group: "manage" },
];

function renderSidebar(overrides: Partial<React.ComponentProps<typeof ClubDashboardSidebar>> = {}) {
  const props: React.ComponentProps<typeof ClubDashboardSidebar> = {
    accent: "#4CAF50",
    background: "#07140c",
    borderColor: "#183420",
    items,
    activeId: "feed",
    collapsed: true,
    temporarilyExpanded: false,
    onPointerExpandedChange: vi.fn(),
    onFocusExpandedChange: vi.fn(),
    onSelect: vi.fn(),
    onBackToClubs: vi.fn(),
    ...overrides,
  };
  return { ...render(<ClubDashboardSidebar {...props} />), props };
}

describe("ClubDashboardSidebar", () => {
  afterEach(() => cleanup());

  it("renders a centered 72px compact rail with semantic state, safe badges, and the OTB fallback mark", () => {
    renderSidebar();

    const sidebar = screen.getByRole("complementary", { name: "Club dashboard sidebar" });
    expect(sidebar.style.width).toBe("72px");
    expect(screen.getByRole("button", { name: "Feed" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Feed" }).style.width).toBe("52px");
    expect(screen.getByLabelText("12 upcoming").textContent).toBe("9+");
    expect(screen.getByRole("img", { name: "OTB!!" }).getAttribute("src")).toBe("/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp");
    expect(screen.getByRole("button", { name: "Back to all clubs" })).toBeTruthy();
  });

  it("uses a Club-provided identity image in place of the generic mark and restores the fallback after an image error", () => {
    renderSidebar({
      brandImageSrc: "/club-avatar.png",
      brandLabel: "1904 Chess Club",
      brandActionLabel: "Open 1904 Chess Club dashboard",
    });

    const customBrand = screen.getByRole("img", { name: "1904 Chess Club" });
    expect(customBrand.getAttribute("src")).toBe("/club-avatar.png");
    expect(customBrand.className).toContain("object-cover");
    expect(screen.getByRole("button", { name: "Open 1904 Chess Club dashboard" })).toBeTruthy();

    fireEvent.error(customBrand);
    expect(screen.getByRole("img", { name: "OTB!!" }).getAttribute("src")).toBe("/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp");
  });

  it("keeps Settings in the footer for the root dashboard while child workspaces can supply a Back to Club footer action", () => {
    const { rerender, props } = renderSidebar({ temporarilyExpanded: true });

    const footer = screen.getByRole("contentinfo", { name: "Club dashboard footer navigation" });
    expect(footer.contains(screen.getByRole("button", { name: "Settings" }))).toBe(true);

    rerender(
      <ClubDashboardSidebar
        {...props}
        temporarilyExpanded
        footerAction={{ label: "Back to Club", icon: ChevronLeft, onClick: vi.fn() }}
      />,
    );

    expect(screen.getByRole("button", { name: "Back to Club" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("requests temporary expansion for both pointer and keyboard users", () => {
    const onPointerExpandedChange = vi.fn();
    const onFocusExpandedChange = vi.fn();
    renderSidebar({ onPointerExpandedChange, onFocusExpandedChange });

    const sidebar = screen.getByRole("complementary", { name: "Club dashboard sidebar" });
    fireEvent.mouseEnter(sidebar);
    fireEvent.mouseLeave(sidebar);
    fireEvent.focus(screen.getByRole("button", { name: "Feed" }));

    expect(onPointerExpandedChange).toHaveBeenNthCalledWith(1, true);
    expect(onPointerExpandedChange).toHaveBeenNthCalledWith(2, false);
    expect(onFocusExpandedChange).toHaveBeenCalledWith(true);
  });

  it("keeps active and hover feedback visible with focus and reduced-motion safeguards", () => {
    renderSidebar();

    const overview = screen.getByRole("button", { name: "Overview" });
    fireEvent.pointerEnter(overview, { pointerType: "mouse" });

    expect(overview.style.background).toContain("color-mix");
    expect(overview.querySelector("span[aria-hidden='true']")?.getAttribute("style")).toContain("scale(1.04)");

    fireEvent.pointerLeave(overview, { pointerType: "mouse" });
    expect(overview.style.background).toBe("transparent");
    expect(overview.className).toContain("focus-visible:ring-2");
    expect(overview.className).toContain("motion-reduce:transition-none");
  });

  it("preserves tab and branded navigation actions without redundant manual disclosure controls", () => {
    const onSelect = vi.fn();
    const onBackToClubs = vi.fn();
    renderSidebar({ temporarilyExpanded: true, onSelect, onBackToClubs });

    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to all clubs" }));

    expect(onSelect).toHaveBeenCalledWith("events");
    expect(onBackToClubs).toHaveBeenCalledTimes(1);
  });

  it("keeps compact mode defaulted in the primary Club Dashboard without a persistent pin control", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");

    expect(dashboard).toContain("collapsed");
    expect(dashboard).not.toContain("toggleSidebar");
    expect(dashboard).not.toContain("club-sidebar-collapsed");
    expect(dashboard).toContain("brandImageSrc={club.avatarUrl}");
  });
});
