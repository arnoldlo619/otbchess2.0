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

  it("renders a 72px compact rail with semantic active state and text-valued badges", () => {
    renderSidebar();

    const sidebar = screen.getByRole("complementary", { name: "Club dashboard sidebar" });
    expect(sidebar.style.width).toBe("72px");
    expect(screen.getByRole("button", { name: "Feed" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText("12 upcoming").textContent).toBe("9+");
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "All clubs" })).toBeNull();
    expect(screen.getByRole("button", { name: "Feed" }).style.width).toBe("42px");
  });

  it("renders workspace and manage groups in the expanded 264px panel", () => {
    renderSidebar({ temporarilyExpanded: true });

    const sidebar = screen.getByRole("complementary", { name: "Club dashboard sidebar" });
    expect(sidebar.style.width).toBe("264px");
    expect(screen.queryByText("Workspace")).toBeNull();
    expect(screen.queryByText("Manage")).toBeNull();
    expect(screen.queryByText("Club workspace")).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keep sidebar expanded" })).toBeNull();
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

  it("preserves navigation and the logo back action without redundant manual toggle controls", () => {
    const onSelect = vi.fn();
    const onBackToClubs = vi.fn();
    renderSidebar({ temporarilyExpanded: true, onSelect, onBackToClubs });

    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to all clubs" }));

    expect(onSelect).toHaveBeenCalledWith("events");
    expect(onBackToClubs).toHaveBeenCalledTimes(1);
  });

  it("uses the shared OTB!! landing-page wordmark instead of club-specific artwork", () => {
    renderSidebar();

    const logo = screen.getByRole("img", { name: "OTB!!" });
    expect(logo.getAttribute("src")).toBe("/manus-storage/chessotb-wordmark-320_e1731168.webp");
    expect(screen.queryByLabelText("1904 Chess Club avatar")).toBeNull();
  });

  it.each([375, 1024])("keeps the responsive sidebar brand control stable at a %ipx viewport", (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    renderSidebar();

    expect(screen.getByRole("img", { name: "OTB!!" }).getAttribute("src")).toBe("/manus-storage/chessotb-wordmark-320_e1731168.webp");
    expect(screen.getByRole("complementary", { name: "Club dashboard sidebar" }).className).toContain("hidden");
    expect(screen.getByRole("complementary", { name: "Club dashboard sidebar" }).className).toContain("lg:flex");
  });

  it("keeps compact mode as the default without rendering a persistent pin control", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");

    expect(dashboard).toContain("collapsed");
    expect(dashboard).not.toContain("toggleSidebar");
    expect(dashboard).not.toContain("club-sidebar-collapsed");
  });

  it("uses the established vector icon system without emoji glyphs", () => {
    const sidebar = readFileSync(resolve(process.cwd(), "client/src/components/club/ClubDashboardSidebar.tsx"), "utf8");

    expect(sidebar).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(sidebar).toContain('aria-label="Back to all clubs"');
    expect(sidebar).not.toContain('renderGroup("Workspace"');
    expect(sidebar).not.toContain('renderGroup("Manage"');
    expect(sidebar).toContain("flex flex-1 flex-col justify-center overflow-y-auto");
    expect(sidebar).toContain("active && expanded");
    expect(sidebar).toContain('width: expanded ? "calc(100% - 4px)" : "42px"');
    expect(sidebar).toContain("transition-[width,box-shadow]");
    expect(sidebar).toContain("motion-reduce:transition-none");
  });
});
