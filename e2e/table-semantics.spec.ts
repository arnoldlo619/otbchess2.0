import { expect, test } from "@playwright/test";

test("public report cross-table exposes named column and player row headers", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/report", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Cross-Table" }).click();

  const table = page.getByRole("table", { name: "Player cross-table results" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Player" })).toBeVisible();
  expect(await table.getByRole("rowheader").count()).toBeGreaterThan(0);
});

test("print wall chart exposes a named table with round columns and player rows", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/print", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Wall Chart/i }).click();

  const table = page.getByRole("table", { name: "Tournament wall chart" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "R1" })).toBeVisible();
  expect(await table.getByRole("rowheader").count()).toBeGreaterThan(0);
});
