/**
 * SSE IP Rate-Limit helper — unit tests
 *
 * We test the pure sseIpIncrement / sseIpDecrement logic by extracting it
 * into a small in-process module that mirrors the server implementation.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ─── Inline the helpers (mirrors server/index.ts) ────────────────────────────
const MAX_SSE_PER_IP = 3;
const sseIpCount = new Map<string, number>();

function sseIpIncrement(ip: string): boolean {
  const current = sseIpCount.get(ip) ?? 0;
  if (current >= MAX_SSE_PER_IP) return false;
  sseIpCount.set(ip, current + 1);
  return true;
}

function sseIpDecrement(ip: string): void {
  const current = sseIpCount.get(ip) ?? 0;
  const next = Math.max(0, current - 1);
  if (next === 0) sseIpCount.delete(ip);
  else sseIpCount.set(ip, next);
}
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => sseIpCount.clear());

describe("SSE IP rate-limit helpers", () => {
  it("allows up to MAX_SSE_PER_IP connections from the same IP", () => {
    expect(sseIpIncrement("1.2.3.4")).toBe(true);
    expect(sseIpIncrement("1.2.3.4")).toBe(true);
    expect(sseIpIncrement("1.2.3.4")).toBe(true);
  });

  it("rejects the (MAX_SSE_PER_IP + 1)th connection from the same IP", () => {
    sseIpIncrement("1.2.3.4");
    sseIpIncrement("1.2.3.4");
    sseIpIncrement("1.2.3.4");
    expect(sseIpIncrement("1.2.3.4")).toBe(false);
  });

  it("allows connections from different IPs independently", () => {
    sseIpIncrement("1.2.3.4");
    sseIpIncrement("1.2.3.4");
    sseIpIncrement("1.2.3.4");
    // Different IP should still be allowed
    expect(sseIpIncrement("5.6.7.8")).toBe(true);
  });

  it("frees a slot after decrement, allowing a new connection", () => {
    sseIpIncrement("1.2.3.4");
    sseIpIncrement("1.2.3.4");
    sseIpIncrement("1.2.3.4");
    expect(sseIpIncrement("1.2.3.4")).toBe(false); // full

    sseIpDecrement("1.2.3.4"); // simulate tab close
    expect(sseIpIncrement("1.2.3.4")).toBe(true); // slot freed
  });

  it("cleans up the map entry when count reaches zero", () => {
    sseIpIncrement("1.2.3.4");
    sseIpDecrement("1.2.3.4");
    expect(sseIpCount.has("1.2.3.4")).toBe(false);
  });

  it("decrement never goes below zero", () => {
    sseIpDecrement("1.2.3.4"); // no-op on unknown IP
    expect(sseIpCount.has("1.2.3.4")).toBe(false);
  });
});
