import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/broadcasts.ts"), "utf8");

describe("broadcast boundary type safety", () => {
  it("preserves payload validation while removing stale unused fields and explicit-any creator casts", () => {
    expect(source).toContain("type BroadcastCreatorRequest = ExpressRequest & { user?: { id?: string } }");
    expect(source).toContain("createdBy: (req as BroadcastCreatorRequest).user?.id ?? null");
    expect(source).not.toContain("createdBy: (req as any).user?.id");
    expect(source).not.toContain("moveNumber,\n      sideToMove");
    expect(source).not.toContain("fenBefore, fenAfter, deviceName, bridgeVersion");
  });
});
