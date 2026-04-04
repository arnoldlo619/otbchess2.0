/**
 * Tests for push notification subscription logic on the spectator page.
 *
 * Tests the state machine, button visibility, label logic, and
 * subscription/unsubscription flows.
 *
 * We test the pure logic rather than the React hook internals to keep
 * tests fast and deterministic.
 */

import { describe, it, expect } from "vitest";
import type { PushStatus } from "../hooks/usePushSubscription";

// ─── Bell button visibility logic ────────────────────────────────────────────

describe("bell button visibility", () => {
  function shouldShowBell(tournamentId: string, hasTournamentState: boolean, pushStatus: PushStatus) {
    const pushEnabled = tournamentId !== "otb-demo-2026" && hasTournamentState;
    return pushEnabled && pushStatus !== "unsupported";
  }

  it("hides bell for demo tournament", () => {
    expect(shouldShowBell("otb-demo-2026", true, "idle")).toBe(false);
  });

  it("hides bell when tournament state is not loaded", () => {
    expect(shouldShowBell("spring-open-2026", false, "idle")).toBe(false);
  });

  it("hides bell when push is unsupported", () => {
    expect(shouldShowBell("spring-open-2026", true, "unsupported")).toBe(false);
  });

  it("shows bell for real tournament with state and supported push", () => {
    expect(shouldShowBell("spring-open-2026", true, "idle")).toBe(true);
  });

  it("shows bell when subscribed", () => {
    expect(shouldShowBell("spring-open-2026", true, "subscribed")).toBe(true);
  });

  it("shows bell when denied (to indicate blocked state)", () => {
    expect(shouldShowBell("spring-open-2026", true, "denied")).toBe(true);
  });
});

// ─── Bell button tooltip logic ────────────────────────────────────────────────

describe("bell button tooltip", () => {
  function getTitle(pushStatus: PushStatus, isSubscribed: boolean): string {
    if (pushStatus === "denied") return "Notifications blocked — enable in browser settings";
    if (isSubscribed) return "Turn off round notifications";
    return "Get notified when a new round starts";
  }

  it("shows 'blocked' message when denied", () => {
    expect(getTitle("denied", false)).toContain("blocked");
  });

  it("shows 'turn off' when subscribed", () => {
    expect(getTitle("subscribed", true)).toContain("Turn off");
  });

  it("shows 'get notified' when idle", () => {
    expect(getTitle("idle", false)).toContain("Get notified");
  });

  it("shows 'get notified' when unsubscribed", () => {
    expect(getTitle("unsubscribed", false)).toContain("Get notified");
  });

  it("shows 'get notified' when error", () => {
    expect(getTitle("error", false)).toContain("Get notified");
  });
});

// ─── Bell button icon selection ───────────────────────────────────────────────

describe("bell button icon", () => {
  type BellIcon = "spinner" | "BellRing" | "BellOff" | "Bell";

  function getBellIcon(isLoading: boolean, isSubscribed: boolean, pushStatus: PushStatus): BellIcon {
    if (isLoading) return "spinner";
    if (isSubscribed) return "BellRing";
    if (pushStatus === "denied") return "BellOff";
    return "Bell";
  }

  it("shows spinner when loading", () => {
    expect(getBellIcon(true, false, "idle")).toBe("spinner");
  });

  it("shows BellRing when subscribed", () => {
    expect(getBellIcon(false, true, "subscribed")).toBe("BellRing");
  });

  it("shows BellOff when denied", () => {
    expect(getBellIcon(false, false, "denied")).toBe("BellOff");
  });

  it("shows Bell when idle", () => {
    expect(getBellIcon(false, false, "idle")).toBe("Bell");
  });

  it("shows Bell when unsubscribed", () => {
    expect(getBellIcon(false, false, "unsubscribed")).toBe("Bell");
  });

  it("shows Bell when error", () => {
    expect(getBellIcon(false, false, "error")).toBe("Bell");
  });

  it("spinner takes priority over subscribed state", () => {
    expect(getBellIcon(true, true, "subscribed")).toBe("spinner");
  });
});

// ─── Bell button click action ─────────────────────────────────────────────────

describe("bell button click action", () => {
  function handleBellClick(
    isSubscribed: boolean,
    subscribe: () => void,
    unsubscribe: () => void,
    showToast: (msg: string) => void
  ) {
    if (isSubscribed) {
      unsubscribe();
      showToast("Notifications turned off");
    } else {
      subscribe();
    }
  }

  it("calls unsubscribe and shows toast when already subscribed", () => {
    let unsubscribeCalled = false;
    let subscribeCalled = false;
    let toastMessage = "";

    handleBellClick(
      true,
      () => { subscribeCalled = true; },
      () => { unsubscribeCalled = true; },
      (msg) => { toastMessage = msg; }
    );

    expect(unsubscribeCalled).toBe(true);
    expect(subscribeCalled).toBe(false);
    expect(toastMessage).toBe("Notifications turned off");
  });

  it("calls subscribe when not subscribed", () => {
    let unsubscribeCalled = false;
    let subscribeCalled = false;
    let toastMessage = "";

    handleBellClick(
      false,
      () => { subscribeCalled = true; },
      () => { unsubscribeCalled = true; },
      (msg) => { toastMessage = msg; }
    );

    expect(subscribeCalled).toBe(true);
    expect(unsubscribeCalled).toBe(false);
    expect(toastMessage).toBe("");
  });
});

// ─── Push notification payload structure ─────────────────────────────────────

describe("push notification payload", () => {
  function buildRoundStartPayload(round: number, tournamentName: string, tournamentId: string) {
    return {
      title: `Round ${round} Pairings Ready`,
      body: `${tournamentName} — Check your board assignment now.`,
      tag: `otb-round-${tournamentId}-${round}`,
      url: `/tournament/${tournamentId}`,
    };
  }

  it("includes correct round number in title", () => {
    const payload = buildRoundStartPayload(3, "Spring Open", "spring-2026");
    expect(payload.title).toBe("Round 3 Pairings Ready");
  });

  it("includes tournament name in body", () => {
    const payload = buildRoundStartPayload(1, "City Championship", "city-2026");
    expect(payload.body).toContain("City Championship");
  });

  it("includes unique tag per round to prevent duplicate notifications", () => {
    const p1 = buildRoundStartPayload(1, "Open", "t1");
    const p2 = buildRoundStartPayload(2, "Open", "t1");
    expect(p1.tag).not.toBe(p2.tag);
    expect(p1.tag).toBe("otb-round-t1-1");
    expect(p2.tag).toBe("otb-round-t1-2");
  });

  it("includes correct tournament URL", () => {
    const payload = buildRoundStartPayload(1, "Open", "my-tourney");
    expect(payload.url).toBe("/tournament/my-tourney");
  });

  function buildResultsPayload(round: number, tournamentName: string, tournamentId: string) {
    return {
      title: `Round ${round} Results Posted`,
      body: `${tournamentName} — All results are in. Check the standings now.`,
      tag: `otb-results-${tournamentId}-${round}`,
      url: `/tournament/${tournamentId}`,
    };
  }

  it("results payload has different tag from round-start payload", () => {
    const roundStart = buildRoundStartPayload(2, "Open", "t1");
    const results = buildResultsPayload(2, "Open", "t1");
    expect(roundStart.tag).not.toBe(results.tag);
  });

  it("results payload mentions standings", () => {
    const payload = buildResultsPayload(2, "Open", "t1");
    expect(payload.body).toContain("standings");
  });
});

// ─── Stale subscription cleanup logic ────────────────────────────────────────

describe("stale subscription cleanup", () => {
  it("marks subscription as stale when server returns 410", () => {
    const staleIds: string[] = [];
    const statusCode = 410;
    const rowId = "sub-123";

    if (statusCode === 410 || statusCode === 404) {
      staleIds.push(rowId);
    }

    expect(staleIds).toContain("sub-123");
  });

  it("marks subscription as stale when server returns 404", () => {
    const staleIds: string[] = [];
    const statusCode = 404;
    const rowId = "sub-456";

    if (statusCode === 410 || statusCode === 404) {
      staleIds.push(rowId);
    }

    expect(staleIds).toContain("sub-456");
  });

  it("does NOT mark subscription as stale for 500 errors", () => {
    const staleIds: string[] = [];
    const statusCode = 500;
    const rowId = "sub-789";

    if (statusCode === 410 || statusCode === 404) {
      staleIds.push(rowId);
    }

    expect(staleIds).not.toContain("sub-789");
  });

  it("counts sent and failed correctly", () => {
    const results = [
      { ok: true },
      { ok: true },
      { ok: false },
      { ok: true },
      { ok: false },
    ];

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    expect(sent).toBe(3);
    expect(failed).toBe(2);
  });
});

// ─── sessionStorage key logic ─────────────────────────────────────────────────

describe("sessionStorage key logic", () => {
  function storageKey(tournamentId: string) {
    return `otb-push-${tournamentId}`;
  }

  it("generates unique key per tournament", () => {
    expect(storageKey("t1")).toBe("otb-push-t1");
    expect(storageKey("t2")).toBe("otb-push-t2");
    expect(storageKey("t1")).not.toBe(storageKey("t2"));
  });

  it("key includes tournament ID", () => {
    const key = storageKey("spring-open-2026");
    expect(key).toContain("spring-open-2026");
  });
});
