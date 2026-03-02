/**
 * Unit tests for the delete tournament feature.
 *
 * Tests cover:
 *  - Optimistic removal from the apiTournaments list after a successful DELETE
 *  - Ownership check logic (only the owner can delete)
 *  - Confirmation state transitions (idle → confirming → deleting → done)
 */

import { describe, it, expect } from "vitest";

// ─── Helper: simulate the optimistic filter applied in handleDeleteTournament ─
function optimisticRemove(
  list: Array<{ tournamentId: string; name: string }>,
  targetId: string
): Array<{ tournamentId: string; name: string }> {
  return list.filter((t) => t.tournamentId !== targetId);
}

// ─── Helper: simulate the confirmation state machine ─────────────────────────
type DeleteState = "idle" | "confirming" | "deleting" | "done";

function deleteStateMachine(current: DeleteState, action: string): DeleteState {
  switch (action) {
    case "CLICK_TRASH":
      return current === "idle" ? "confirming" : current;
    case "CANCEL":
      return current === "confirming" ? "idle" : current;
    case "CONFIRM":
      return current === "confirming" ? "deleting" : current;
    case "SUCCESS":
    case "ERROR":
      return current === "deleting" ? "done" : current;
    default:
      return current;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("optimisticRemove", () => {
  const tournaments = [
    { tournamentId: "abc123", name: "Spring Open" },
    { tournamentId: "def456", name: "Club Championship" },
    { tournamentId: "ghi789", name: "Blitz Night" },
  ];

  it("removes the target tournament from the list", () => {
    const result = optimisticRemove(tournaments, "def456");
    expect(result).toHaveLength(2);
    expect(result.find((t) => t.tournamentId === "def456")).toBeUndefined();
  });

  it("leaves other tournaments untouched", () => {
    const result = optimisticRemove(tournaments, "def456");
    expect(result[0].tournamentId).toBe("abc123");
    expect(result[1].tournamentId).toBe("ghi789");
  });

  it("returns an empty list when the only tournament is deleted", () => {
    const single = [{ tournamentId: "abc123", name: "Spring Open" }];
    expect(optimisticRemove(single, "abc123")).toHaveLength(0);
  });

  it("returns the original list unchanged when the id is not found", () => {
    const result = optimisticRemove(tournaments, "nonexistent");
    expect(result).toHaveLength(3);
  });

  it("handles an empty list gracefully", () => {
    expect(optimisticRemove([], "abc123")).toHaveLength(0);
  });
});

describe("deleteStateMachine", () => {
  it("transitions from idle to confirming on CLICK_TRASH", () => {
    expect(deleteStateMachine("idle", "CLICK_TRASH")).toBe("confirming");
  });

  it("transitions from confirming back to idle on CANCEL", () => {
    expect(deleteStateMachine("confirming", "CANCEL")).toBe("idle");
  });

  it("transitions from confirming to deleting on CONFIRM", () => {
    expect(deleteStateMachine("confirming", "CONFIRM")).toBe("deleting");
  });

  it("transitions from deleting to done on SUCCESS", () => {
    expect(deleteStateMachine("deleting", "SUCCESS")).toBe("done");
  });

  it("transitions from deleting to done on ERROR", () => {
    expect(deleteStateMachine("deleting", "ERROR")).toBe("done");
  });

  it("does not allow CLICK_TRASH from confirming state", () => {
    expect(deleteStateMachine("confirming", "CLICK_TRASH")).toBe("confirming");
  });

  it("does not allow CANCEL from idle state", () => {
    expect(deleteStateMachine("idle", "CANCEL")).toBe("idle");
  });

  it("does not allow CONFIRM from idle state", () => {
    expect(deleteStateMachine("idle", "CONFIRM")).toBe("idle");
  });
});

describe("DELETE endpoint ownership logic", () => {
  // Simulate the server-side ownership check
  function canDelete(ownerId: string, requesterId: string): boolean {
    return ownerId === requesterId;
  }

  it("allows the owner to delete their tournament", () => {
    expect(canDelete("user_alice", "user_alice")).toBe(true);
  });

  it("prevents a different user from deleting the tournament", () => {
    expect(canDelete("user_alice", "user_bob")).toBe(false);
  });

  it("prevents deletion with an empty requester id", () => {
    expect(canDelete("user_alice", "")).toBe(false);
  });
});
