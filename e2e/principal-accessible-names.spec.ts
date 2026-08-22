import { expect, test } from "@playwright/test";

const principalRoutes = [
  { path: "/", ready: /Chess Clubs/i },
  { path: "/auth", ready: /Welcome back/i },
  { path: "/pricing", ready: /Simple, honest pricing/i },
  { path: "/join", ready: /Join Tournament/i },
  { path: "/tournaments", ready: /^Archive$/i },
  { path: "/league-demo", ready: /^ChessOTB Club League$/i },
  { path: "/prep", ready: /Prepare for your next match/i },
  { path: "/tournament/otb-demo-2026", ready: /OTB!! Open 2026/i },
  { path: "/tournament/otb-demo-2026/manage", ready: /OTB!! Open 2026/i },
] as const;

type UnnamedControl = {
  tag: string;
  type: string | null;
  role: string | null;
  testId: string | null;
  id: string | null;
  href: string | null;
  placeholder: string | null;
  className: string;
  html: string;
};

test.describe("principal route accessible names", () => {
  for (const route of principalRoutes) {
    test(`${route.path} names every visible principal control`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(route.ready).filter({ visible: true }).first()).toBeVisible();

      const unnamed = await page
        .locator('a[href]:visible, button:visible, input:visible, select:visible, textarea:visible, [role="button"]:visible, [role="switch"]:visible')
        .evaluateAll((elements): UnnamedControl[] => {
          const normalizedText = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() ?? "";
          const referencedText = (element: Element, attribute: "aria-labelledby") =>
            normalizedText(
              element
                .getAttribute(attribute)
                ?.split(/\s+/)
                .map((id) => document.getElementById(id)?.textContent ?? "")
                .join(" "),
            );

          return elements.flatMap((element) => {
            if (element.closest('[inert], [aria-hidden="true"]')) return [];

            const htmlElement = element as HTMLElement;
            const inputElement = element as HTMLInputElement;
            const labelText = "labels" in inputElement
              ? Array.from(inputElement.labels ?? []).map((label) => label.textContent ?? "").join(" ")
              : "";
            const descendantImageText = Array.from(element.querySelectorAll("img[alt]"))
              .map((image) => image.getAttribute("alt") ?? "")
              .join(" ");
            const accessibleName = normalizedText(
              element.getAttribute("aria-label")
              || referencedText(element, "aria-labelledby")
              || labelText
              || element.textContent
              || descendantImageText
              || element.getAttribute("title")
              || (element.tagName === "INPUT" && inputElement.type === "image" ? inputElement.alt : ""),
            );

            if (accessibleName) return [];

            return [{
              tag: element.tagName.toLowerCase(),
              type: element.getAttribute("type"),
              role: element.getAttribute("role"),
              testId: element.getAttribute("data-testid"),
              id: element.getAttribute("id"),
              href: element.getAttribute("href"),
              placeholder: element.getAttribute("placeholder"),
              className: normalizedText(htmlElement.className).slice(0, 160),
              html: normalizedText(element.outerHTML).slice(0, 320),
            }];
          });
        });

      expect(unnamed, `${route.path}\n${JSON.stringify(unnamed, null, 2)}`).toEqual([]);
    });
  }
});

test("Archive search and standings disclosures expose purpose and state", async ({ page }) => {
  await page.goto("/tournaments", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/^Archive$/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search tournaments, clubs, and players" })).toBeVisible();

  const disclosure = page.locator('[data-testid^="archive-standings-disclosure-"]').first();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(disclosure).toHaveAccessibleName(/^Show standings for /);
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(disclosure).toHaveAccessibleName(/^Hide standings for /);
});

test("primary authentication and Join fields expose stable form labels", async ({ page }) => {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Welcome back/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Remember me for 30 days" })).toBeAttached();

  await page.goto("/join", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Join Tournament/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Tournament code" })).toBeVisible();
});
