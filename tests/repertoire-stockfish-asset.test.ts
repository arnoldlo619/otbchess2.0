import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("Repertoire Builder Stockfish asset configuration", () => {
  const hook = read("client/src/hooks/useStockfish.ts");
  const singleWorker = read("client/public/stockfish/stockfish-18-lite-single.js");

  it("requires cross-origin isolation before opting into the multi-thread worker", () => {
    expect(hook).toContain('globalThis.crossOriginIsolated === true');
    expect(hook).toContain('const sfUrl = multiThread ? SF_MULTI_URL : SF_SINGLE_URL');
  });

  it("points the single-thread worker at the managed valid WebAssembly asset", () => {
    expect(singleWorker).toContain('/manus-storage/stockfish-18-lite-single_0c19ffd3.wasm');
    expect(singleWorker).not.toContain('stockfish-18-lite-single_e330fec3.wasm');
    expect(hook).toContain('stockfish-18-lite-single.js#/manus-storage/stockfish-18-lite-single_0c19ffd3.wasm,worker');
  });
});
