import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLUB_EVENT_TYPES, canonicalizeClubEventType, parseClubEventType } from "../shared/clubEventTypes";

const root = process.cwd();
const migration = fs.readFileSync(path.resolve(root, "drizzle/0024_retire_unused_event_modes.sql"), "utf8");
const dashboard = fs.readFileSync(path.resolve(root, "client/src/pages/ClubDashboard.tsx"), "utf8");
const eventRegistry = fs.readFileSync(path.resolve(root, "client/src/lib/clubEventRegistry.ts"), "utf8");
const routes = fs.readFileSync(path.resolve(root, "server/clubs.ts"), "utf8");

const removedRuntimeTerms = [
  "clubSpeedDating",
  "clubTrivia",
  "startSpeedDating",
  "startTrivia",
  "speedDatingRounds",
  "speedDatingMinutes",
  "triviaQuestionCount",
  "triviaCategories",
] as const;

describe("Club Event mode retirement", () => {
  it("does not expose the retired modes in the canonical event taxonomy", () => {
    expect(CLUB_EVENT_TYPES).not.toContain("speed_dating");
    expect(CLUB_EVENT_TYPES).not.toContain("trivia");
    expect(parseClubEventType("speed_dating")).toBeNull();
    expect(parseClubEventType("trivia")).toBeNull();
    expect(canonicalizeClubEventType("speed_dating")).toBe("casual");
    expect(canonicalizeClubEventType("trivia")).toBe("casual");
  });

  it("removes mode-specific controls, client contracts, and server APIs", () => {
    for (const term of removedRuntimeTerms) {
      expect(dashboard).not.toContain(term);
      expect(eventRegistry).not.toContain(term);
      expect(routes).not.toContain(term);
    }
  });

  it("normalizes legacy records before dropping retired data structures", () => {
    expect(migration).toContain("SET `event_type` = 'casual'");
    expect(migration).toContain("DROP TABLE `club_speed_dating_sessions`");
    expect(migration).toContain("DROP TABLE `club_trivia_sessions`");
    expect(migration).toContain("DROP COLUMN `speed_dating_rounds`");
    expect(migration).toContain("DROP COLUMN `trivia_question_count`");
  });
});
