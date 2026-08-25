import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("manual event payment confirmation", () => {
  const schema = read("shared/schema.ts");
  const routes = read("server/clubs.ts");
  const dashboard = read("client/src/pages/ClubDashboard.tsx");

  it("stores only manual status and confirmation audit fields", () => {
    expect(schema).toContain('paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("untracked")');
    expect(schema).toContain('paymentUpdatedAt: timestamp("payment_updated_at")');
    expect(schema).toContain('paymentUpdatedBy: varchar("payment_updated_by", { length: 64 })');
    expect(schema).not.toMatch(/payment_(?:receipt|transaction|amount|provider)/i);
  });

  it("keeps private payment reads and mutations behind authenticated owner/director checks", () => {
    expect(routes).toContain('clubsRouter.get("/:id/events/:eventId/rsvps/payment-statuses", authMiddleware');
    expect(routes).toContain('clubsRouter.patch("/:id/events/:eventId/rsvps/:rsvpUserId/payment-status", authMiddleware');
    expect(routes).toContain('const isManager = club.ownerId === userId || membership?.role === "owner" || membership?.role === "director"');
    expect(routes).toContain('Owner or director access required');
  });

  it("does not expose payment state from the public RSVP list endpoint", () => {
    const publicBlock = routes.slice(
      routes.indexOf('clubsRouter.get("/:id/events/:eventId/rsvps"'),
      routes.indexOf('clubsRouter.get("/:id/events/:eventId/rsvps/payment-statuses"'),
    );
    expect(publicBlock).not.toContain("paymentStatus");
    expect(publicBlock).not.toContain("paymentUpdatedBy");
    expect(publicBlock).not.toContain("paymentUpdatedAt");
  });

  it("places confirmation inside the Club Dashboard RSVP management workflow and avoids payment-proof collection", () => {
    expect(dashboard).toContain('fetchRsvpPaymentStatuses(club.id, eventId).catch(() => [])');
    expect(dashboard).toContain('aria-label={`Payment status for ${rsvp.displayName ?? rsvp.userId}`}');
    expect(dashboard).toContain('value="confirmed">Confirmed');
    expect(dashboard).not.toMatch(/payment receipt|transaction id|payment amount/i);
  });
});
