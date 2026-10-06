import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schema = fs.readFileSync(path.resolve(process.cwd(), "shared/schema.ts"), "utf8");
const routes = fs.readFileSync(path.resolve(process.cwd(), "server/clubs.ts"), "utf8");
const dashboard = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");
const registry = fs.readFileSync(path.resolve(process.cwd(), "client/src/lib/clubEventRegistry.ts"), "utf8");
const eventPage = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/MeetupEventPage.tsx"), "utf8");

describe("Club Speed Dating event contracts", () => {
  it("stores session state, roster snapshots, and unique round pairings", () => {
    expect(schema).toContain('"club_speed_dating_sessions"');
    expect(schema).toContain('"club_speed_dating_participants"');
    expect(schema).toContain('"club_speed_dating_pairings"');
    expect(schema).toContain('uniqueIndex("csds_event_unique").on(table.eventId)');
    expect(schema).toContain('uniqueIndex("csdp_session_user_unique").on(table.sessionId, table.userId)');
    expect(schema).toContain('uniqueIndex("csdpr_session_round_board_unique").on(table.sessionId, table.roundNumber, table.boardNumber)');
  });

  it("validates Speed Dating event settings and limits session control to club organizers", () => {
    expect(routes).toContain('parseSpeedDatingNumber(body.speedDatingRounds, 4, 1, 12)');
    expect(routes).toContain('parseSpeedDatingNumber(body.speedDatingMinutes, 5, 1, 30)');
    expect(routes).toContain('requireFullAuth, async (req: Request, res: Response) =>');
    expect(routes).toContain('Only club owners and directors can start Speed Dating');
    expect(routes).toContain('At least two members marked Going are needed to start Speed Dating');
    expect(routes).toContain('createSpeedDatingRound(roster.map((rsvp) => rsvp.userId), 1)');
    expect(routes).toContain('createSpeedDatingRound(participants.map((participant) => participant.userId), nextRound)');
  });

  it("wires creation, persisted client calls, and the live event surface", () => {
    expect(dashboard).toContain('setSelectedEventType("speed_dating")');
    expect(dashboard).toContain('aria-label="Speed Dating rounds"');
    expect(dashboard).toContain('speedDatingMinutes: selectedEventType === "speed_dating" ? speedDatingMinutes : undefined');
    expect(registry).toContain('startSpeedDatingSession');
    expect(registry).toContain('advanceSpeedDatingSession');
    expect(eventPage).toContain('<ClubSpeedDatingSession');
  });
});
