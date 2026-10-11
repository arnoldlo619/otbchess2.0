// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const lookupChessComMock = vi.hoisted(() => vi.fn());
const createPlayerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/playerLookup", () => ({
  lookupChessCom: lookupChessComMock,
  createChessComTournamentPlayer: createPlayerMock,
}));

import { PreStartPlayerLookup } from "../client/src/components/tournament/PreStartPlayerLookup";

const lookupResult = {
  name: "Hikaru Nakamura",
  username: "hikaru",
  elo: 2811,
  rapid: 2811,
  blitz: 3168,
  country: "US",
  title: "GM",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PreStartPlayerLookup", () => {
  it("looks up a Chess.com user and adds the rating-aware roster record after confirmation", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const player = { id: "hikaru-player", name: "Hikaru Nakamura", username: "hikaru", elo: 3168 };
    lookupChessComMock.mockResolvedValue(lookupResult);
    createPlayerMock.mockReturnValue(player);

    render(
      <PreStartPlayerLookup
        isDark
        existingUsernames={[]}
        ratingType="blitz"
        onAdd={onAdd}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Add player" }), "hikaru");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText("Hikaru Nakamura")).toBeTruthy();
    expect(screen.getByText("R 2811")).toBeTruthy();
    expect(screen.getByText("B 3168")).toBeTruthy();
    expect(lookupChessComMock).toHaveBeenCalledWith("hikaru");

    await user.click(screen.getByRole("button", { name: "Add player" }));
    expect(createPlayerMock).toHaveBeenCalledWith(lookupResult, "blitz");
    expect(onAdd).toHaveBeenCalledWith(player);
    expect((screen.getByRole("textbox", { name: "Add player" }) as HTMLInputElement).value).toBe("");
  });

  it("stops duplicate registration before it calls the profile service", async () => {
    const user = userEvent.setup();

    render(
      <PreStartPlayerLookup
        isDark={false}
        existingUsernames={["Hikaru"]}
        onAdd={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Add player" }), "hikaru");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    expect((await screen.findByRole("alert")).textContent).toContain("This player is already registered.");
    expect(lookupChessComMock).not.toHaveBeenCalled();
  });

  it("reports failed profile lookups without leaving a stale add action", async () => {
    const user = userEvent.setup();
    lookupChessComMock.mockRejectedValue(new Error("Player not found on chess.com"));

    render(<PreStartPlayerLookup isDark existingUsernames={[]} onAdd={vi.fn()} />);

    await user.type(screen.getByRole("textbox", { name: "Add player" }), "missing-player");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Player not found on chess.com");
    expect(screen.queryByRole("button", { name: "Add player" })).toBeNull();
  });
});
