import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/index.js";

describe("Club Feed attachment parser boundary", () => {
  let server: Server;
  let baseUrl: string;
  const largeJson = JSON.stringify({ detail: "x".repeat(600 * 1024) });

  beforeAll(async () => {
    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("accepts a valid-sized Feed JSON body through the route-scoped parser before auth rejects it", async () => {
    const response = await fetch(`${baseUrl}/api/clubs/club-1/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: largeJson,
    });

    expect(response.status).toBe(401);
  });

  it("retains the 512 KB parser cap for unrelated API routes", async () => {
    const response = await fetch(`${baseUrl}/api/unknown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: largeJson,
    });

    expect(response.status).toBe(413);
  });
});
