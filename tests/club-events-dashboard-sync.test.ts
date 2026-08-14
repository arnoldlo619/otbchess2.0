import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const registry = readFileSync(resolve(process.cwd(), "client/src/lib/clubEventRegistry.ts"), "utf8");
const profile = readFileSync(resolve(process.cwd(), "client/src/pages/ClubProfile.tsx"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ClubDashboard.tsx"), "utf8");
const syncFunction = registry.slice(
  registry.indexOf("export async function syncEventsFromServer"),
  registry.indexOf("/** Update an existing event.")
);

describe("Club Events dashboard synchronization", () => {
  it("lets canonical server events override stale local copies", () => {
    expect(syncFunction).toContain("const eventById = new Map(loadEvents().map((event) => [event.id, event]))");
    expect(syncFunction).toContain("eventById.set(row.id");
    expect(syncFunction).not.toContain("if (localIds.has(row.id)) continue;");
  });

  it("syncs member Events from the server when the tab opens", () => {
    expect(profile).toContain("syncEventsFromServer(found.id)");
    expect(profile).toContain('if (activeTab !== "events" || !clubId) return;');
    expect(profile).toContain("const published = events.filter((event) => event.isPublished)");
  });

  it("refreshes owner Events from the canonical server set on opening the tab", () => {
    expect(dashboard).toContain('if (tab !== "events" || !clubId) return;');
    expect(dashboard).toContain("syncEventsFromServer(clubId).then(setEvents)");
  });

  it("does not duplicate a linked tournament already represented by its event", () => {
    expect(profile).toContain("const eventTournamentIds = new Set(clubEvents.flatMap");
    expect(profile).toContain(".filter((t) => !eventTournamentIds.has(t.id))");
  });
});
