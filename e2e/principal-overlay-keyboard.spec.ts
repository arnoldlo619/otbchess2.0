import { expect, test, type Locator } from "@playwright/test";

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

async function expectFocusContainment(dialog: Locator) {
  const controls = dialog.locator(focusableSelector).filter({ visible: true });
  const count = await controls.count();
  expect(count).toBeGreaterThan(1);

  const first = controls.first();
  const last = controls.last();
  await last.focus();
  await last.press("Tab");
  await expect(first).toBeFocused();

  await first.press("Shift+Tab");
  await expect(last).toBeFocused();
}

test("authentication modal contains focus, closes with Escape, and restores its opener", async ({ page }) => {
  await page.goto("/league-demo", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/^ChessOTB Club League$/i).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();

  const opener = page.getByRole("button", { name: "Create a League" });
  await expect(opener).toBeVisible();
  await opener.focus();
  await opener.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Authentication" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Signin Email" })).toBeFocused();
  await expectFocusContainment(dialog);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("Join QR scanner contains focus, closes with Escape, and restores its opener", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }],
        }),
      },
    });
  });
  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Join Tournament/i).filter({ visible: true }).first()).toBeVisible();

  const opener = page.getByRole("button", { name: "Scan QR code" });
  await opener.click();

  const dialog = page.getByRole("dialog", { name: "Scan tournament QR code" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close scanner" })).toBeFocused();
  await expectFocusContainment(dialog);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("Quads result panel contains focus, closes with Escape, and restores its board opener", async ({ page }) => {
  await page.goto("/tournament/otb-demo-2026/manage?mockQuads=mid", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tablist", { name: "Round tabs" })).toBeVisible();

  const opener = page.getByRole("button", { name: /Open result entry for Board/i }).first();
  await opener.focus();
  await opener.press("Enter");

  const dialog = page.getByRole("dialog", { name: /Enter result for Board/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Close result panel" })).toBeFocused();
  await expectFocusContainment(dialog);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
