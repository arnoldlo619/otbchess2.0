import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeChessComPlayerPayload } from "../chessComPlayerPayload.js";

const flatChessComPayload = {
  username: "hikaru",
  name: "Hikaru Nakamura",
  avatar: "https://images.chess.com/avatar/hikaru.jpg",
  country: "https://api.chess.com/pub/country/US",
  stats: {
    chess_rapid: { last: { rating: 2811 } },
    chess_blitz: { last: { rating: 3168 } },
  },
};

describe("Chess.com player proxy payload normalization", () => {
  it("supports the current flattened proxy payload for tournament participant lookup and RSVP imports", () => {
    const normalized = normalizeChessComPlayerPayload(flatChessComPayload, "hikaru");

    expect(normalized.profile.name).toBe("Hikaru Nakamura");
    expect(normalized.profile.username).toBe("hikaru");
    expect(normalized.profile.avatar).toBe("https://images.chess.com/avatar/hikaru.jpg");
    expect((normalized.stats.chess_rapid as { last: { rating: number } }).last.rating).toBe(2811);
  });

  it("retains backward compatibility with the former nested payload during rolling deployments", () => {
    const normalized = normalizeChessComPlayerPayload({
      profile: { username: "hikaru", name: "Hikaru Nakamura" },
      stats: flatChessComPayload.stats,
    });

    expect(normalized.profile.name).toBe("Hikaru Nakamura");
    expect(normalized.profile.username).toBe("hikaru");
  });

  it("fails with a clear validation error rather than an undefined-name exception when a provider payload has no usable username", () => {
    expect(() => normalizeChessComPlayerPayload({ stats: {} })).toThrow("incomplete player profile");
  });

  it("routes both director participant lookup and RSVP upload through the shared safe normalizer", () => {
    const addPlayerSource = readFileSync(resolve(process.cwd(), "client/src/components/AddPlayerModal.tsx"), "utf8");
    const rsvpSource = readFileSync(resolve(process.cwd(), "client/src/components/UploadRSVPModal.tsx"), "utf8");

    expect(addPlayerSource).toContain("normalizeChessComPlayerPayload(await res.json(), username)");
    expect(rsvpSource).toContain("normalizeChessComPlayerPayload(await res.json(), username)");
    expect(addPlayerSource).not.toContain("const { profile, stats } = data;");
    expect(rsvpSource).not.toContain("const profile = data.profile ?? {}");
  });
});
