import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/otbRating.ts"), "utf8");

describe("OTB rating submission typing", () => {
  it("relies on the schema-inferred submission type for canonical host selection", () => {
    expect(source).toContain("submissions.find((submission) => submission.submittedByUserId === session.hostUserId)");
    expect(source).not.toContain("submissions.find((s: any)");
  });
});
