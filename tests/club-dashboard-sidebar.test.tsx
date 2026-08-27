// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    clubName: "1904 Chess Club",
    clubAvatarUrl: null,
    accent: "#4CAF50",
    background: "#07140c",
    borderColor: "#183420",
    items,
    activeId: "feed",
    collapsed: true,
    temporarilyExpanded: false,
    onPointerExpandedChange: vi.fn(),
    onFocusExpandedChange: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onSelect: vi.fn(),
    onBackToClubs: vi.fn(),
    ...overrides,
  };
  return { ...render(<ClubDashboardSidebar {...props} />), props };
}

describe("ClubDashboardSidebar", () => {
  afterEach(() => cleanup());

  it("renders a 72px compact rail with semantic active state and text-valued badges", () => {
    renderSidebar();

    const sidebar = screen.getByRole("complementary", { name: "Club dashboard sidebar" });
    expect(sidebar.style.width).toBe("72px");
    expect(screen.getByRole("button", { name: "Feed" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText("12 upcoming").textContent).toBe("9+");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "All clubs" })).toBeNull();
    expect(screen.getByRole("button", { name: "Feed" }).style.width).toBe("42px");
  });

  it("renders workspace and manage groups in the expanded 264px panel", () => {
    renderSidebar({ temporarilyExpanded: true });

    const sidebar = screen.getByRole("complementary", { name: "Club dashboard sidebar" });
    expect(sidebar.style.width).toBe("264px");
    expect(screen.getByText("Workspace")).toBeTruthy();
    expect(screen.getByText("Manage")).toBeTruthy();
    expect(screen.getByText("Club workspace")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep sidebar expanded" })).toBeTruthy();
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

  it("preserves navigation, back, and pin actions", () => {
    const onSelect = vi.fn();
    const onBackToClubs = vi.fn();
    const onToggleCollapsed = vi.fn();
    renderSidebar({ temporarilyExpanded: true, onSelect, onBackToClubs, onToggleCollapsed });

    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to all clubs" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep sidebar expanded" }));

    expect(onSelect).toHaveBeenCalledWith("events");
    expect(onBackToClubs).toHaveBeenCalledTimes(1);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("keeps compact mode as the default while restoring an explicit persisted pin preference", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");

    expect(dashboard).toContain('localStorage.getItem("club-sidebar-collapsed") !== "0"');
    expect(dashboard).toContain('localStorage.setItem(`club-sidebar-collapsed`, next ? "1" : "0")');
    expect(dashboard).toContain("return true;");
  });

  it("uses the established vector icon system without emoji glyphs", () => {
    const sidebar = readFileSync(resolve(process.cwd(), "client/src/components/club/ClubDashboardSidebar.tsx"), "utf8");

    expect(sidebar).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(sidebar).not.toContain("All clubs");
    expect(sidebar).toContain("flex flex-1 flex-col justify-center gap-5");
    expect(sidebar).toContain("active && expanded");
    expect(sidebar).toContain('width: expanded ? "calc(100% - 4px)" : "42px"');
  });
});
