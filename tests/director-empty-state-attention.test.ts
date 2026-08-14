import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const director = readFileSync(resolve(process.cwd(), "client/src/pages/Director.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("Director empty-state onboarding attention", () => {
  it("pulses the join QR and quick join actions only while the roster is empty", () => {
    expect(director).toContain('state.players.length === 0 ? "director-empty-join-pulse" : ""');
    expect(director).toContain('label === "Show QR Code" || label === "Copy Join Link"');
  });

  it("provides a reduced-motion-safe pulse treatment", () => {
    expect(styles).toContain("@keyframes director-empty-join-attention");
    expect(styles).toContain(".director-empty-join-pulse");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.director-empty-join-pulse[\s\S]*?animation: none/);
  });
});
