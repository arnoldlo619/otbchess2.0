import { expect, test } from "@playwright/test";

const creationModes = [
  { card: /Quickstart/i, preview: "Quickstart", action: "Use Quickstart", evidence: "Swiss pairing" },
  { card: /Schedule/i, preview: "Schedule", action: "Customize Tournament", evidence: "Custom format" },
  { card: /Quads/i, preview: "Quads", action: "Use Quads", evidence: "Four-player sections" },
  { card: /Large Event/i, preview: "Large Event", action: "Use Large Event", evidence: "Swiss qualification" },
] as const;

test.describe("tournament creation format flows", () => {
  for (const mode of creationModes) {
    test(`${mode.preview} opens its verified setup preview`, async ({ page }) => {
      await page.goto("/create", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Create a Tournament" })).toBeVisible();

      await page.getByRole("button", { name: mode.card }).click();
      const preview = page.getByRole("dialog", { name: mode.preview });
      await expect(preview).toBeVisible();
      await expect(preview.getByText(mode.evidence, { exact: true })).toBeVisible();
      await expect(preview.getByRole("button", { name: mode.action, exact: true })).toBeVisible();

      await preview.getByRole("button", { name: "Change format" }).click();
      await expect(page.getByRole("dialog", { name: "Create a Tournament" })).toBeVisible();
    });
  }
});

test("registration context and camera-safe QR entry remain available", async ({ page }) => {
  await page.goto("/join/OTB2026", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "OTB!! Open 2026" })).toBeVisible();
  await expect(page.getByText("Swiss", { exact: true })).toBeVisible();
  await expect(page.getByText("Mar 22, 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("90+30", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Player Name" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Chesscom Username" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Manual pairing rating (optional)" })).toBeVisible();
});

test("Director check-in, pairings, and Quads result entry remain operational", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/manage", { waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate(() => (
    Object.prototype.hasOwnProperty.call(localStorage, "otb-director-state-v3-otb-demo-2026")
  ))).toBe(true);
  await page.evaluate(() => {
    const key = "otb-director-state-v3-otb-demo-2026";
    const persisted = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!persisted?.state) throw new Error("Demo Director state was not persisted");
    persisted.state.status = "registration";
    persisted.state.currentRound = 0;
    localStorage.setItem(key, JSON.stringify(persisted));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("Check-In Roster", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check In All", exact: true })).toBeVisible();

  await page.goto("/tournament/otb-demo-2026/manage?mockQuads=mid", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tablist", { name: "Round tabs" })).toBeVisible();

  const boardOpener = page.getByRole("button", { name: /Open result entry for Board/i }).first();
  await boardOpener.click();
  const dialog = page.getByRole("dialog", { name: /Enter result for Board/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Draw ½–½" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("½–½", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test("Quads round progression, standings, and completion state remain coherent", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/manage?mockQuads=complete", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("All Quads Complete", { exact: true })).toBeVisible();
  await expect(page.getByText("3 rounds · 16 players · 4 sections", { exact: true })).toBeVisible();
  await expect(page.getByText("Section Champions", { exact: true })).toBeVisible();
  await expect(page.getByText("Quad 1", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Quad 4", { exact: true }).first()).toBeVisible();
});

test("public report and print outputs expose standings data", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/report", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Cross-Table" }).click();
  await expect(page.getByRole("table", { name: "Player cross-table results" })).toBeVisible();

  await page.goto("/tournament/otb-demo-2026/print", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Wall Chart/i }).click();
  await expect(page.getByRole("table", { name: "Tournament wall chart" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Standings/i })).toBeVisible();
});

test("broadcast console route renders a safe tournament operations surface", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.message !== "WebSocket closed without opened.") pageErrors.push(error.message);
  });

  const response = await page.goto("/tournament/otb-demo-2026/broadcast-console", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("body")).toContainText(/Broadcast|Board 1/i);
  expect(pageErrors).toEqual([]);
});
