import { expect, test } from "@playwright/test";

test("reports privacy-safe Web Vitals from a real page load", async ({ page }) => {
  const payloads: Array<Record<string, unknown>> = [];
  await page.route("**/api/operational-metrics", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      payloads.push(request.postDataJSON() as Record<string, unknown>);
    }
    await route.fulfill({ status: 202, contentType: "application/json", body: '{"ok":true}' });
  });

  await page.goto("/?private=should-not-be-reported#secret-fragment");
  await expect(page.getByRole("heading", { name: /Chess Clubs/i })).toBeVisible();
  await expect.poll(
    () => payloads.some((payload) => payload.eventType === "web_vital"),
    { timeout: 10_000 },
  ).toBe(true);

  const webVitals = payloads.filter((payload) => payload.eventType === "web_vital");
  expect(webVitals.length).toBeLessThanOrEqual(5);
  for (const payload of webVitals) {
    expect(payload.path).toBe("/");
    expect(["CLS", "FCP", "INP", "LCP", "TTFB"]).toContain(payload.metricName);
    expect(JSON.stringify(payload)).not.toContain("should-not-be-reported");
    expect(JSON.stringify(payload)).not.toContain("secret-fragment");
  }
});
