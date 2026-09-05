// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {} as { username?: string },
  authFetch: vi.fn(),
}));

vi.mock("wouter", () => ({
  useParams: () => testState.params,
  useLocation: () => ["/prep", testState.navigate],
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({ user: null }),
}));

vi.mock("@/lib/apiFetch", () => ({ authFetch: testState.authFetch }));
vi.mock("@/components/NavLogo", () => ({ NavLogo: () => <span>OTB</span> }));
vi.mock("@/components/AvatarNavDropdown", () => ({ AvatarNavDropdown: () => <button type="button">Account</button> }));
vi.mock("@/components/prep/V3ScoutReportTab", () => ({ V3ScoutReportTab: () => <div>Scout report</div> }));
vi.mock("../client/src/components/prep/PrepExportCard", () => ({ PrepExportCard: () => <div>Export source</div> }));
vi.mock("../client/src/hooks/useOpponentProfile", () => ({ useOpponentProfile: () => ({ profile: null }), countryCodeToFlag: () => "" }));

import MatchupPrep from "../client/src/pages/MatchupPrep";

describe("Matchup Prep scout controls", () => {
  afterEach(() => {
    cleanup();
    testState.navigate.mockReset();
    testState.authFetch.mockReset();
    testState.params = {};
    window.history.replaceState({}, "", "/prep");
  });

  it("places the username form below the sticky header and keeps filters out of the persistent layout", () => {
    render(<MatchupPrep />);

    const input = screen.getByRole("textbox", { name: "Chess.com opponent username" });
    const topbar = screen.getByTestId("matchup-prep-topbar");
    const section = screen.getByTestId("scout-opponent-section");

    expect(screen.getByRole("heading", { name: "Scout opponent" })).toBeTruthy();
    expect(section.contains(input)).toBe(true);
    expect(topbar.contains(input)).toBe(false);
    expect(screen.queryByText("Source")).toBeNull();
    expect(screen.queryByText("Format")).toBeNull();
    expect(screen.queryByText("I’m playing")).toBeNull();
    expect(screen.queryByText("Study")).toBeNull();
    expect(screen.queryByText("Practice")).toBeNull();
  });

  it("keeps filter choices keyboard-operable and submits the selected immutable scout route", () => {
    render(<MatchupPrep />);

    const input = screen.getByRole("textbox", { name: "Chess.com opponent username" });
    const trigger = screen.getByRole("button", { name: "Scout opponent filters" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByText("Source")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Run scout" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "PracticeOpponent" } });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Lichess" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "blitz" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Black" }));

    expect(input.getAttribute("aria-label")).toBe("Lichess opponent username");
    expect(screen.getByRole("menuitemradio", { name: "Lichess" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("menuitemradio", { name: "blitz" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("menuitemradio", { name: "Black" }).getAttribute("data-state")).toBe("checked");

    fireEvent.click(screen.getByRole("button", { name: "Run scout" }));
    expect(testState.navigate).toHaveBeenCalledWith("/prep/PracticeOpponent?provider=lichess&myColor=black&tc=blitz");
  });

  it("dismisses the Scout Opponent menu with Escape and restores focus to its trigger", async () => {
    render(<MatchupPrep />);

    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Scout opponent filters" });
    await user.click(trigger);
    expect(screen.getByText("Source")).toBeTruthy();
    await user.keyboard("{Escape}");

    expect(screen.queryByText("Source")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the report export action available through a keyboard-operable menu", async () => {
    testState.params = { username: "scouted-player" };
    testState.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        opponent: { username: "scouted-player" },
        reportSnapshot: {
          activeRequest: {
            platform: "chesscom", normalizedUsername: "scouted-player", displayUsername: "scouted-player",
            myColor: "white", formats: ["rapid", "blitz", "bullet"], mode: "standard", maxGames: 30,
            schemaVersion: "launch-2", requestedAt: "2026-09-05T00:00:00.000Z",
          },
        },
      }),
    });

    render(<MatchupPrep />);
    const exportTrigger = await waitFor(() => screen.getByRole("button", { name: "Export report" }));
    fireEvent.keyDown(exportTrigger, { key: "Enter" });

    expect(screen.getByRole("menuitem", { name: "Save as image" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Print / Save PDF" })).toBeTruthy();
  });
});
