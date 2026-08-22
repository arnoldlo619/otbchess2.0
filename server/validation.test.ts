import { describe, it, expect, vi } from "vitest";
import {
  validate,
  addPlayerSchema,
  saveStateSchema,
  pushSubscribeSchema,
  pushNotifySchema,
  analyticsEventSchema,
  prepResolveSchema,
  prepSaveSchema,
  coachInsightSchema,
  broadcastSchema,
  timerUpdateSchema,
} from "./validation";

// ── Helper: simulate Express req/res/next ────────────────────────────────────
function mockReqResNext(body: unknown) {
  const req = { body } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

// ── validate() middleware factory ─────────────────────────────────────────────
describe("validate() middleware", () => {
  it("passes valid payloads and replaces req.body with parsed data", () => {
    const mw = validate(analyticsEventSchema);
    const { req, res, next } = mockReqResNext({
      tournamentId: "t1",
      eventType: "search",
      metadata: { foo: "bar" },
    });
    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({
      tournamentId: "t1",
      eventType: "search",
      metadata: { foo: "bar" },
    });
  });

  it("rejects invalid payloads with 400 and issues array", () => {
    const mw = validate(analyticsEventSchema);
    const { req, res, next } = mockReqResNext({ tournamentId: "" });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});

// ── addPlayerSchema ──────────────────────────────────────────────────────────
describe("addPlayerSchema", () => {
  it("accepts valid player with username", () => {
    const result = addPlayerSchema.safeParse({ player: { username: "alice" } });
    expect(result.success).toBe(true);
  });

  it("rejects missing username", () => {
    const result = addPlayerSchema.safeParse({ player: {} });
    expect(result.success).toBe(false);
  });

  it("rejects empty username", () => {
    const result = addPlayerSchema.safeParse({ player: { username: "" } });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from username", () => {
    const result = addPlayerSchema.safeParse({ player: { username: "  bob  " } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.player.username).toBe("bob");
    }
  });

  it("passes through extra player fields via passthrough", () => {
    const result = addPlayerSchema.safeParse({
      player: { username: "carol", customField: 42 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.player as any).customField).toBe(42);
    }
  });
});

// ── analyticsEventSchema ─────────────────────────────────────────────────────
describe("analyticsEventSchema", () => {
  it("accepts valid event", () => {
    const result = analyticsEventSchema.safeParse({
      tournamentId: "t1",
      eventType: "follow",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid event type", () => {
    const result = analyticsEventSchema.safeParse({
      tournamentId: "t1",
      eventType: "hack",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing tournamentId", () => {
    const result = analyticsEventSchema.safeParse({
      eventType: "search",
    });
    expect(result.success).toBe(false);
  });
});

// ── pushSubscribeSchema ──────────────────────────────────────────────────────
describe("pushSubscribeSchema", () => {
  const validSub = {
    tournamentId: "t1",
    subscription: {
      endpoint: "https://push.example.com/sub/123",
      keys: { p256dh: "abc", auth: "def" },
    },
  };

  it("accepts valid subscription", () => {
    expect(pushSubscribeSchema.safeParse(validSub).success).toBe(true);
  });

  it("rejects missing endpoint", () => {
    const bad = {
      ...validSub,
      subscription: { ...validSub.subscription, endpoint: "" },
    };
    expect(pushSubscribeSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects non-URL endpoint", () => {
    const bad = {
      ...validSub,
      subscription: { ...validSub.subscription, endpoint: "not-a-url" },
    };
    expect(pushSubscribeSchema.safeParse(bad).success).toBe(false);
  });
});

// ── pushNotifySchema ─────────────────────────────────────────────────────────
describe("pushNotifySchema", () => {
  it("accepts valid notification", () => {
    expect(pushNotifySchema.safeParse({ title: "Round 2" }).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(pushNotifySchema.safeParse({ title: "" }).success).toBe(false);
  });
});

// ── saveStateSchema ──────────────────────────────────────────────────────────
describe("saveStateSchema", () => {
  it("accepts state object with baseRevision", () => {
    const result = saveStateSchema.safeParse({ state: { round: 1 }, baseRevision: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects null state", () => {
    expect(saveStateSchema.safeParse({ state: null }).success).toBe(false);
  });

  it("rejects negative baseRevision", () => {
    expect(saveStateSchema.safeParse({ state: {}, baseRevision: -1 }).success).toBe(false);
  });
});

// ── timerUpdateSchema ────────────────────────────────────────────────────────
describe("timerUpdateSchema", () => {
  it("accepts valid timer update", () => {
    expect(timerUpdateSchema.safeParse({ running: true }).success).toBe(true);
  });

  it("rejects empty object", () => {
    expect(timerUpdateSchema.safeParse({}).success).toBe(false);
  });
});

// ── prepResolveSchema ────────────────────────────────────────────────────────
describe("prepResolveSchema", () => {
  it("accepts valid resolve request", () => {
    expect(prepResolveSchema.safeParse({ gameId: "abc123" }).success).toBe(true);
  });

  it("rejects empty gameId", () => {
    expect(prepResolveSchema.safeParse({ gameId: "" }).success).toBe(false);
  });
});

// ── broadcastSchema ──────────────────────────────────────────────────────────
describe("broadcastSchema", () => {
  it("accepts valid broadcast config", () => {
    const result = broadcastSchema.safeParse({
      enabled: true,
      youtubeUrl: "https://youtube.com/live/abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string URLs", () => {
    const result = broadcastSchema.safeParse({
      enabled: false,
      youtubeUrl: "",
      twitchUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing enabled field", () => {
    expect(broadcastSchema.safeParse({}).success).toBe(false);
  });
});

// ── coachInsightSchema ───────────────────────────────────────────────────────
describe("coachInsightSchema", () => {
  it("accepts valid insight request", () => {
    const result = coachInsightSchema.safeParse({
      opponentUsername: "magnus",
      provider: "lichess",
      context: "plays e4 aggressively",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid provider", () => {
    const result = coachInsightSchema.safeParse({
      opponentUsername: "magnus",
      provider: "yahoo",
      context: "test",
    });
    expect(result.success).toBe(false);
  });
});

// ── prepSaveSchema ───────────────────────────────────────────────────────────
describe("prepSaveSchema", () => {
  it("accepts valid save request", () => {
    const result = prepSaveSchema.safeParse({
      opponentUsername: "hikaru",
      provider: "chesscom",
      reportJson: "{}",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing provider", () => {
    const result = prepSaveSchema.safeParse({
      opponentUsername: "hikaru",
      reportJson: "{}",
    });
    expect(result.success).toBe(false);
  });
});
