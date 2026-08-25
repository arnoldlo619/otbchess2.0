import { expect, test } from "@playwright/test";

const realClub = {
  id: "club-real-local",
  name: "Local Community Chess Club",
  slug: "local-community-chess-club",
  tagline: "Real local club",
  description: "Created by a real user.",
  location: "San Diego, CA",
  country: "US",
  category: "community",
  avatarUrl: null,
  bannerUrl: null,
  accentColor: "#436850",
  ownerId: "user-real",
  ownerName: "Real Owner",
  memberCount: 1,
  tournamentCount: 0,
  followerCount: 0,
  foundedAt: "2026-08-01T00:00:00.000Z",
  isPublic: true,
};

test("clubs page purges legacy fabricated community records and preserves real local data", async ({ page }) => {
  await page.addInitScript((club) => {
    localStorage.setItem("otb-clubs-v1", JSON.stringify([
      { ...club, id: "seed-club-1", name: "Legacy Fabricated Club", slug: "legacy-fabricated-club", ownerId: "seed" },
      club,
    ]));
    localStorage.setItem("otb-club-members-v1", JSON.stringify([
      { clubId: "seed-club-1", userId: "seed-m1" },
      { clubId: club.id, userId: "user-real" },
    ]));
    localStorage.setItem("otb-club-tournaments-v1", JSON.stringify([
      { clubId: "seed-club-1", tournamentId: "seed-tournament" },
      { clubId: club.id, tournamentId: "real-tournament" },
    ]));
    localStorage.setItem("otb-club-events-v1", JSON.stringify([
      { id: "seed-event", clubId: "seed-club-1" },
      { id: "real-event", clubId: club.id },
    ]));
    localStorage.setItem("otb-club-rsvps-v1", JSON.stringify([
      { id: "seed-rsvp", eventId: "seed-event", clubId: "seed-club-1" },
      { id: "real-rsvp", eventId: "real-event", clubId: club.id },
    ]));
  }, realClub);

  await page.route("**/api/clubs**", async (route) => {
    if (route.request().url().includes("/locations")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ clubs: [], total: 0 }) });
  });

  await page.goto("/clubs");
  await expect(page.getByText(realClub.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Legacy Fabricated Club", { exact: true })).toHaveCount(0);

  const remaining = await page.evaluate(() => ({
    clubIds: JSON.parse(localStorage.getItem("otb-clubs-v1") ?? "[]").map((row: { id: string }) => row.id),
    memberIds: JSON.parse(localStorage.getItem("otb-club-members-v1") ?? "[]").map((row: { userId: string }) => row.userId),
    tournamentIds: JSON.parse(localStorage.getItem("otb-club-tournaments-v1") ?? "[]").map((row: { tournamentId: string }) => row.tournamentId),
    eventIds: JSON.parse(localStorage.getItem("otb-club-events-v1") ?? "[]").map((row: { id: string }) => row.id),
    rsvpIds: JSON.parse(localStorage.getItem("otb-club-rsvps-v1") ?? "[]").map((row: { id: string }) => row.id),
  }));

  expect(remaining).toEqual({
    clubIds: ["club-real-local"],
    memberIds: ["user-real"],
    tournamentIds: ["real-tournament"],
    eventIds: ["real-event"],
    rsvpIds: ["real-rsvp"],
  });
});
