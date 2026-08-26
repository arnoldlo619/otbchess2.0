import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/index.ts"), "utf8");

describe("server entrypoint legacy cleanup", () => {
  it("does not retain unused legacy proxy or duplicate limiter declarations", () => {
    expect(source).not.toContain("async function proxyLichess(");
    expect(source).not.toContain("const chessProxyLimiter = rateLimit(");
    expect(source).not.toContain("const prepLimiter = rateLimit(");
    expect(source).not.toContain("const pushSubscribeLimiter = rateLimit(");
    expect(source).not.toContain("gameSessions } from \"../shared/schema.js\"");
  });
});
