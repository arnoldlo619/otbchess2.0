import { expect, test } from "@playwright/test";

const owner = {
  id: "owner-payment",
  email: "owner@example.test",
  displayName: "Club Owner",
  chesscomUsername: null,
  lichessUsername: null,
  chesscomElo: null,
  chesscomRapid: null,
  chesscomBlitz: null,
  chesscomBullet: null,
  chesscomPrevRapid: null,
  chesscomPrevBlitz: null,
  chesscomPrevBullet: null,
  lichessElo: null,
  avatarUrl: null,
  fideId: null,
  isGuest: false,
  isPro: true,
  isStaff: false,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

const club = {
  id: "club-payment",
  name: "Payment Test Club",
  slug: "payment-test-club",
  tagline: "Owner workflow fixture",
  description: "A deterministic manager test club.",
  location: "San Diego, CA",
  country: "US",
  category: "community",
  avatarUrl: null,
  bannerUrl: null,
  accentColor: "#436850",
  ownerId: owner.id,
  ownerName: owner.displayName,
  memberCount: 2,
  tournamentCount: 0,
  followerCount: 0,
  foundedAt: "2026-08-01T00:00:00.000Z",
  isPublic: true,
};

const event = {
  id: "event-payment",
  clubId: club.id,
  title: "Entry Fee Meetup",
  description: "Manual payment confirmation fixture.",
  startAt: "2026-12-01T18:00:00.000Z",
  endAt: null,
  venue: "Test Venue",
  address: null,
  admissionNote: "Optional entry fee paid directly to the host.",
  coverImageUrl: null,
  accentColor: "#436850",
  creatorId: owner.id,
  creatorName: owner.displayName,
  isPublished: 1,
  eventType: "meetup",
  tournamentId: null,
  recurrence: "none",
  recurrenceSeriesId: null,
  recurrenceEndDate: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

const rsvp = {
  id: "rsvp-payment",
  eventId: event.id,
  clubId: club.id,
  userId: "attendee-payment",
  displayName: "Taylor Player",
  avatarUrl: null,
  status: "going",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

test("club owners can privately confirm RSVP payment status without transmitting payment proof", async ({ page }) => {
  let updateBody: Record<string, unknown> | null = null;

  await page.addInitScript(({ fixtureClub, fixtureEvent, fixtureOwner }) => {
    localStorage.setItem("otb-auth-token", "fixture-token");
    localStorage.setItem("otb-clubs-v1", JSON.stringify([fixtureClub]));
    localStorage.setItem("otb-club-members-v1", JSON.stringify([
      {
        clubId: fixtureClub.id,
        userId: fixtureOwner.id,
        displayName: fixtureOwner.displayName,
        chesscomUsername: null,
        lichessUsername: null,
        avatarUrl: null,
        role: "owner",
        joinedAt: "2026-08-01T00:00:00.000Z",
        tournamentsPlayed: 0,
        bestFinish: null,
      },
    ]));
    localStorage.setItem("otb-club-events-v1", JSON.stringify([fixtureEvent]));
    localStorage.setItem("otb-club-rsvps-v1", "[]");
  }, { fixtureClub: club, fixtureEvent: event, fixtureOwner: owner });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/auth/me") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: owner }) });
      return;
    }
    if (path === `/api/clubs/${club.id}`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(club) });
      return;
    }
    if (path === `/api/clubs/${club.id}/members`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
        {
          clubId: club.id,
          userId: owner.id,
          displayName: owner.displayName,
          chesscomUsername: null,
          lichessUsername: null,
          avatarUrl: null,
          role: "owner",
          joinedAt: "2026-08-01T00:00:00.000Z",
          tournamentsPlayed: 0,
          bestFinish: null,
        },
      ]) });
      return;
    }
    if (path === `/api/clubs/${club.id}/events`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([event]) });
      return;
    }
    if (path === `/api/clubs/${club.id}/events/${event.id}/rsvps`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([rsvp]) });
      return;
    }
    if (path === `/api/clubs/${club.id}/events/${event.id}/rsvps/payment-statuses`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
        { userId: rsvp.userId, paymentStatus: "pending", paymentUpdatedAt: null, paymentUpdatedBy: null },
      ]) });
      return;
    }
    if (path === `/api/clubs/${club.id}/events/${event.id}/rsvps/${rsvp.userId}/payment-status`) {
      updateBody = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        userId: rsvp.userId,
        paymentStatus: "confirmed",
        paymentUpdatedAt: "2026-08-25T12:00:00.000Z",
        paymentUpdatedBy: owner.id,
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.goto(`/clubs/${club.id}/home`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Events", exact: true }).first().click();
  await expect(page.getByText(event.title, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Manage RSVPs", exact: true }).click();
  const paymentStatus = page.getByLabel(`Payment status for ${rsvp.displayName}`);
  await expect(paymentStatus).toHaveValue("pending");
  await paymentStatus.selectOption("confirmed");
  await expect(paymentStatus).toHaveValue("confirmed");
  await expect.poll(() => updateBody).toEqual({ paymentStatus: "confirmed" });
});
