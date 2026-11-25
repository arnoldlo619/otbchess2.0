import { expect, test, type Page } from "@playwright/test";

type Role = "owner" | "director" | "member";
const club = {
  id: "qa-permissions-club", slug: "qa-permissions-club", name: "Permission QA Club",
  ownerId: "owner-qa", ownerName: "Owner", accentColor: "#4CAF50",
  memberCount: 3, tournamentCount: 0, isPublic: false, foundedAt: "2026-01-01T00:00:00Z",
  joinPolicy: "invite", description: "Isolated role permission regression fixture.",
};
const dashboardUrl = `/clubs/${club.id}/home`;

async function fixture(page: Page, initialRole: Role) {
  let role = initialRole;
  let userId = initialRole === "owner" ? "owner-qa" : "viewer-qa";
  let rosterAvailable = true;
  let rosterDelay = 0;
  const privateRequests: string[] = [];
  await page.addInitScript(() => {
    // Control only SSE in this test; no production records or sessions are used.
    const streams: EventTarget[] = [];
    class FixtureEventSource extends EventTarget {
      constructor() { super(); streams.push(this); }
      close() { const index = streams.indexOf(this); if (index >= 0) streams.splice(index, 1); }
    }
    Object.assign(window, { EventSource: FixtureEventSource, permissionTestStreams: streams });
    localStorage.setItem("otb-pwa-install-dismissed", "1");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const user = {
      id: userId, displayName: "QA Viewer", email: "viewer@example.test",
      isGuest: false, isPro: false, isStaff: false, chesscomUsername: null,
      avatarUrl: null, createdAt: "2026-01-01T00:00:00Z",
    };
    let status = 200;
    let body: unknown = [];
    if (path === "/api/auth/me" || path === "/api/auth/refresh") body = { user };
    else if (path === `/api/clubs/${club.id}`) body = club;
    else if (path === `/api/clubs/${club.id}/members`) {
      const requestedRole = role;
      const requestedUserId = userId;
      if (rosterDelay) await new Promise((resolve) => setTimeout(resolve, rosterDelay));
      status = rosterAvailable ? 200 : 503;
      body = rosterAvailable ? [
        { clubId: club.id, userId: "owner-qa", role: "owner", displayName: "Owner", joinedAt: club.foundedAt, tournamentsPlayed: 0 },
        { clubId: club.id, userId: requestedUserId, role: requestedRole, displayName: "QA Viewer", joinedAt: club.foundedAt, tournamentsPlayed: 0 },
      ] : { error: "Roster unavailable" };
    } else if (path.endsWith("/join-code")) {
      privateRequests.push(path); body = { code: "OTB-TEST" };
    } else if (path.endsWith("/invites")) {
      privateRequests.push(path); body = [];
    } else if (path.endsWith("/rsvp-form")) {
      status = 403; body = { error: "Only owners and directors can manage RSVP forms" };
    } else if (path === "/api/clubs/mine") body = [club];
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return {
    privateRequests,
    changeRole(next: Role) { role = next; },
    switchToMember() { role = "member"; userId = "viewer-qa"; rosterDelay = 600; },
    failRoster() { rosterAvailable = false; },
  };
}

async function nav(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 1440) < 1024;
  if (mobile) {
    await page.getByRole("button", { name: "Open club navigation" }).click();
    return page.getByRole("navigation", { name: "Club dashboard navigation" });
  }
  return page.getByRole("complementary", { name: "Club dashboard sidebar" });
}

for (const role of ["member", "director", "owner"] as const) {
  test(`${role} sees only the permitted Club management controls`, async ({ page }) => {
    const data = await fixture(page, role);
    await page.goto(`${dashboardUrl}?tab=settings`);
    await expect(page.getByRole("heading", { name: club.name }).first()).toBeVisible();
    const navigation = await nav(page);
    if (role === "member") {
      await expect(navigation.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
      await expect(navigation.getByRole("button", { name: "Overview", exact: true })).toHaveCount(0);
      await expect(navigation.getByRole("button", { name: "Home", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Join Club QR", exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Club Settings", exact: true })).toHaveCount(0);
      await navigation.getByRole("button", { name: "Members", exact: true }).click();
      await expect(page.getByRole("button", { name: "Invite Members", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "attendance", exact: true })).toHaveCount(0);
      expect(data.privateRequests).toEqual([]);
    } else {
      await expect(navigation.getByRole("button", { name: "Overview", exact: true })).toBeVisible();
      await navigation.getByRole("button", { name: "Settings", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Club Settings", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Club Profile", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Join", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Danger", exact: true })).toHaveCount(role === "owner" ? 1 : 0);
      await page.getByRole("button", { name: "Join", exact: true }).click();
      await expect(page.getByText("OTB-TEST", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Rotate.*code/i })).toHaveCount(role === "owner" ? 1 : 0);
    }
  });
}

test("demoting a director closes Settings and an open Join QR dialog", async ({ page }) => {
  const data = await fixture(page, "director");
  await page.goto(dashboardUrl);
  await (await nav(page)).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Club Settings", exact: true })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) < 1024) await nav(page);
  await page.getByRole("button", { name: "Join Club QR", exact: true }).click();
  const qrDialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Close QR screen" }) });
  await expect(qrDialog).toBeVisible();
  data.changeRole("member");
  await page.evaluate(() => {
    const streams = (window as unknown as { permissionTestStreams: EventTarget[] }).permissionTestStreams;
    streams.forEach((stream) => stream.dispatchEvent(new Event("member_role_changed")));
  });
  await expect(page.getByRole("heading", { name: "Club Settings", exact: true })).toHaveCount(0);
  await expect(qrDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
});

test("switching owner to member fails closed during and after roster reload", async ({ page }) => {
  const data = await fixture(page, "owner");
  await page.goto(dashboardUrl);
  await (await nav(page)).getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Club Settings", exact: true })).toBeVisible();
  data.switchToMember();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("heading", { name: "Club Settings", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Danger", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: club.name }).first()).toBeVisible();
  await expect((await nav(page)).getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
});

test("an unavailable director roster never grants Settings access", async ({ page }) => {
  const data = await fixture(page, "director");
  data.failRoster();
  await page.goto(dashboardUrl);
  await expect(page.getByRole("heading", { name: club.name }).first()).toBeVisible();
  await expect((await nav(page)).getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
});

test("regular members cannot enter the alternate Manage route", async ({ page }) => {
  await fixture(page, "member");
  await page.goto(`/clubs/${club.id}/manage`);
  await expect(page).toHaveURL(new RegExp(`/clubs/${club.id}/home`));
  await expect(page.getByRole("heading", { name: club.name }).first()).toBeVisible();
  await expect((await nav(page)).getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
});

test("regular members cannot recover a previous owner's private RSVP editor draft", async ({ page }) => {
  await fixture(page, "member");
  await page.addInitScript(({ clubId }) => {
    localStorage.setItem(`otb-rsvp-builder-draft-v1:${clubId}:event-qa`, JSON.stringify({
      version: 1, updatedAt: Date.now(),
      data: {
        serverUpdatedAt: "2026-01-01", clientUpdatedAt: Date.now(),
        form: { id: "private-form", clubId, eventId: "event-qa", title: "Private Owner Draft", questions: [] },
      },
    }));
  }, { clubId: club.id });
  await page.goto(`/clubs/${club.id}/meetup/event-qa/rsvp-form/builder`);
  await expect(page).toHaveURL(new RegExp(`/clubs/${club.id}/home`));
  await expect(page.getByRole("heading", { name: club.name }).first()).toBeVisible();
  await expect(page.getByText("Private Owner Draft", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(0);
});
