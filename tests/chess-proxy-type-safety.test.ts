import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/chessProxy.ts"), "utf8");

describe("Chess provider proxy type safety", () => {
  it("uses Express request and response contracts at CORS and IP-rate-limit boundaries", () => {
    expect(source).toContain('import { Router, type Request, type Response } from "express";');
    expect(source).toContain("function setProxyCors(req: Request, res: Response)");
    expect(source).toContain("keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? \"\")");
    expect(source).not.toContain("req: any");
  });
});
