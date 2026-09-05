// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  clubProfileNavigationTabs,
} from "../client/src/lib/clubProfileNavigation.js";
import { ClubProfileNavigationItems } from "../client/src/components/club/ClubProfileNavigationItems.js";

function renderProfileTabs(joined: boolean) {
  return render(createElement(
    "nav",
    { "aria-label": "Test club navigation" },
    createElement(ClubProfileNavigationItems, {
      joined,
      children: (tab) => createElement("button", { key: tab, type: "button" }, tab),
    }),
  ));
}

describe("Club Profile membership-aware navigation", () => {
  it("keeps Album and Leagues as direct destinations only for active members", () => {
    const visitorTabs = clubProfileNavigationTabs(false);
    const memberTabs = clubProfileNavigationTabs(true);

    expect(visitorTabs).not.toContain("album");
    expect(visitorTabs).not.toContain("leagues");
    expect(memberTabs).toContain("album");
    expect(memberTabs).toContain("leagues");
  });

  it("renders direct Album and League controls only for the active member navigation policy", () => {
    const { unmount } = renderProfileTabs(false);

    expect(screen.queryByRole("button", { name: "album" })).toBeNull();
    expect(screen.queryByRole("button", { name: "leagues" })).toBeNull();
    unmount();

    renderProfileTabs(true);
    expect(screen.getByRole("button", { name: "album" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "leagues" })).toBeTruthy();
    cleanup();
  });
});
