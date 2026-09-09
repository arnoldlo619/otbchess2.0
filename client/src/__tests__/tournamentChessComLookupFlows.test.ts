import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiFetch", () => ({
  authFetch: authFetchMock,
}));

import { lookupChessCom } from "../components/AddPlayerModal.js";
import { lookupChessComRsvp } from "../components/UploadRSVPModal.js";
import { fetchFromChessCom } from "../hooks/useChessComProfile.js";

const flatChessComPayload = {
  username: "hikaru",
  name: "Hikaru Nakamura",
  avatar: "https://images.chess.com/avatar/hikaru.jpg",
  country: "https://api.chess.com/pub/country/US",
  title: "GM",
  stats: {
    chess_rapid: { last: { rating: 2811 } },
    chess_blitz: { last: { rating: 3168 } },
  },
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Tournament Chess.com lookup flows", () => {
  beforeEach(() => {
    authFetchMock.mockResolvedValue(response(flatChessComPayload));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(flatChessComPayload)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lets tournament directors add a player from a flattened Chess.com profile payload", async () => {
    const player = await lookupChessCom("Hikaru");

    expect(authFetchMock).toHaveBeenCalledWith("/api/chess/player/hikaru?v=player-v2");
    expect(player).toMatchObject({
      name: "Hikaru Nakamura",
      username: "hikaru",
      rapid: 2811,
      blitz: 3168,
      elo: 2811,
      country: "US",
      title: "GM",
    });
  });

  it("lets RSVP spreadsheet imports resolve a player from the same flattened Chess.com payload", async () => {
    const player = await lookupChessComRsvp("Hikaru");

    expect(fetch).toHaveBeenCalledWith("/api/chess/player/hikaru?v=player-v2");
    expect(player).toMatchObject({
      name: "Hikaru Nakamura",
      username: "hikaru",
      rapidElo: 2811,
      blitzElo: 3168,
      elo: 2811,
      platform: "chesscom",
      country: "US",
    });
  });

  it("uses the same versioned live profile contract for QR join username lookup", async () => {
    const profile = await fetchFromChessCom("Hikaru-qr-incident-check");

    expect(authFetchMock).toHaveBeenCalledWith(
      "/api/chess/player/hikaru-qr-incident-check?v=player-v2",
    );
    expect(profile).toMatchObject({
      username: "hikaru",
      name: "Hikaru Nakamura",
      rapid: 2811,
      blitz: 3168,
    });
  });
});
