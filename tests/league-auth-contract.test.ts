import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/leagues.ts"), "utf8");

describe("league authentication contract", () => {
  it("reads the shared middleware userId with a narrow request compatibility type", () => {
    expect(source).toContain("function getUser(req: Request, res: Response): string | null");
    expect(source).toContain("(req as Request & { userId?: string }).userId");
    expect(source).not.toContain("(req as any).userId");
  });
});
