import { expect, test } from "@playwright/test";

test("offline and reconnect transitions provide clear global status", async ({ context, page }) => {
  await page.goto("/join/OTB2026", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "OTB!! Open 2026" })).toBeVisible();

  await context.setOffline(true);
  const status = page.getByTestId("connectivity-status");
  await expect(status).toContainText("You’re offline");
  await expect(status).toContainText("Reconnect to sync server changes");

  await context.setOffline(false);
  await expect(status).toContainText("Back online");
  await expect(status).toBeHidden({ timeout: 4_000 });
});

test("Join preserves safe registration fields across refresh", async ({ page }) => {
  await page.goto("/join/OTB2026", { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Player Name" }).fill("Refresh Player");
  await page.getByRole("textbox", { name: "Chesscom Username" }).fill("refresh_player");
  await page.getByRole("spinbutton", { name: "Manual pairing rating (optional)" }).fill("1710");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("textbox", { name: "Player Name" })).toHaveValue("Refresh Player");
  await expect(page.getByRole("textbox", { name: "Chesscom Username" })).toHaveValue("refresh_player");
  await expect(page.getByRole("spinbutton", { name: "Manual pairing rating (optional)" })).toHaveValue("1710");
});

test("Tournament Wizard restores an active quickstart draft after refresh", async ({ page }) => {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Quickstart/i }).click();
  const preview = page.getByRole("dialog", { name: "Quickstart" });
  await preview.getByRole("button", { name: "Use Quickstart", exact: true }).click();

  const name = page.getByRole("textbox", { name: "e.g. Friday Night Blitz" });
  await name.fill("Refresh Safe Rapid");
  await page.getByRole("textbox", { name: "e.g. Marshall Chess Club" }).fill("Central Library");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: "Create tournament configuration" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "e.g. Friday Night Blitz" })).toHaveValue("Refresh Safe Rapid");
  await expect(page.getByRole("textbox", { name: "e.g. Marshall Chess Club" })).toHaveValue("Central Library");
});

test("Create Club Wizard restores an active identity draft after refresh", async ({ page }) => {
  await page.goto("/clubs", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create Club", exact: true }).click();
  await page.getByRole("dialog", { name: "Create a Club" }).getByRole("button", { name: "Preview wizard without signing in" }).click();

  await page.getByRole("textbox", { name: "Club Name" }).fill("Refresh Knights Club");
  await page.getByRole("textbox", { name: "Tagline" }).fill("Weekly over-the-board chess");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog", { name: "Create Club" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Club Name" })).toHaveValue("Refresh Knights Club");
  await expect(page.getByRole("textbox", { name: "Tagline" })).toHaveValue("Weekly over-the-board chess");
});

test("RSVP Form Builder recovers failed saves locally and clears them after sync", async ({ page }) => {
  const draftKey = "otb-rsvp-builder-draft-v1:club-resilience:event-resilience";
  const remoteForm = {
    id: "form-resilience",
    eventId: "event-resilience",
    clubId: "club-resilience",
    title: "Original RSVP",
    description: "Original description",
    questions: [{ id: "question-1", type: "text", label: "Player name", required: true }],
    slug: "resilience-rsvp",
    isPublished: 0,
    closesAt: null,
    confirmationMessage: "Thanks for your RSVP.",
    collectEmail: 1,
    maxResponses: null,
    allowMultipleSubmissions: 0,
    theme_color: "#4CAF50",
    header_image: "data:image/png;base64,do-not-persist",
    createdAt: "2026-08-25T12:00:00.000Z",
    updatedAt: "2026-08-25T12:00:00.000Z",
  };
  let saveSucceeds = false;

  await page.route("**/api/clubs/club-resilience/events/event-resilience/rsvp-form", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ form: remoteForm, responses: [] }) });
      return;
    }
    if (route.request().method() === "PUT") {
      if (!saveSucceeds) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "offline" }) });
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ form: { ...remoteForm, ...body, updatedAt: "2026-08-25T12:05:00.000Z" } }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/clubs/club-resilience/meetup/event-resilience/rsvp-form/builder", { waitUntil: "domcontentloaded" });
  const title = page.locator("header").getByRole("textbox", { name: "Form title" });
  await expect(title).toHaveValue("Original RSVP");
  await title.fill("Recovered RSVP");
  await expect(page.getByText("Saved locally · sync failed")).toBeVisible({ timeout: 4_000 });
  await expect.poll(async () => page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw).data.form.header_image : "missing";
  }, draftKey)).toBeNull();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(title).toHaveValue("Recovered RSVP");
  await expect(page.getByText("Recovered locally")).toBeVisible();

  saveSucceeds = true;
  await title.fill("Synced RSVP");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 4_000 });
  await expect.poll(async () => page.evaluate((key) => window.localStorage.getItem(key), draftKey)).toBeNull();
});

test("Director result entry survives refresh through existing local persistence", async ({ page }) => {
  const stateKey = "otb-director-state-v3-otb-demo-2026";
  await page.goto("/tournament/otb-demo-2026/manage?mockQuads=mid", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tablist", { name: "Round tabs" })).toBeVisible();
  await page.evaluate(() => window.history.replaceState(null, "", "/tournament/otb-demo-2026/manage"));
  const initialDrawCount = await page.evaluate((key) => {
    const persisted = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
      state?: { rounds?: Array<{ games?: Array<{ result?: string }> }> };
    } | null;
    return persisted?.state?.rounds?.reduce(
      (total, round) => total + (round.games?.filter((game) => game.result === "½-½").length ?? 0),
      0,
    ) ?? 0;
  }, stateKey);

  await page.getByRole("button", { name: /Open result entry for Board/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /Enter result for Board/i });
  await dialog.getByRole("button", { name: "Draw ½–½" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => page.evaluate((key) => {
    const persisted = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
      state?: { rounds?: Array<{ games?: Array<{ result?: string }> }> };
    } | null;
    return persisted?.state?.rounds?.reduce(
      (total, round) => total + (round.games?.filter((game) => game.result === "½-½").length ?? 0),
      0,
    ) ?? 0;
  }, stateKey), { timeout: 2_000 }).toBe(initialDrawCount + 1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate((key) => {
    const persisted = JSON.parse(window.localStorage.getItem(key) ?? "null") as {
      state?: { rounds?: Array<{ games?: Array<{ result?: string }> }> };
    } | null;
    return persisted?.state?.rounds?.reduce(
      (total, round) => total + (round.games?.filter((game) => game.result === "½-½").length ?? 0),
      0,
    ) ?? 0;
  }, stateKey)).toBe(initialDrawCount + 1);
  await expect(page.getByText("Results Entered", { exact: true })).toBeVisible();
});
