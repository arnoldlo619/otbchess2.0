import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const dashboard = read("client/src/pages/ClubDashboard.tsx");
const demo = read("client/src/pages/ClubDashboardDemo.tsx");

describe("Club Dashboard workspace headers", () => {
  it("reserves the full-cover banner treatment for the owner Overview", () => {
    expect(dashboard).toContain('{tab === "overview" && isOwnerOrDirector && (');
    expect(dashboard).toContain('data-testid="club-dashboard-social-header"');
    expect(dashboard).toContain('data-testid="club-dashboard-full-bleed-banner"');
  });

  it("uses one compact Album-style profile header for Feed, Events, and Members", () => {
    expect(dashboard).toContain("function ClubWorkspaceSocialHeader");
    expect(dashboard).toContain('data-testid="club-dashboard-workspace-header"');
    expect(dashboard).toContain('tab === "feed" || tab === "events" || tab === "members"');
    expect(dashboard).toContain('label: "Feed"');
    expect(dashboard).toContain('label: "Events"');
    expect(dashboard).toContain('label: "Members"');
    expect(dashboard).toContain('size={72}');
    expect(dashboard).toContain('tracking-[0.12em]');
  });

  it("keeps one relevant owner or member action in the compact header", () => {
    expect(dashboard).toContain('label: "Create event"');
    expect(dashboard).toContain('label: "Invite members"');
    expect(dashboard).toContain('label: "Post update"');
    expect(dashboard).toContain("setShowCreateEvent(true)");
    expect(dashboard).toContain("setShowInvitePanel(true)");
    expect(dashboard).toContain("announcementComposerTextareaRef.current?.focus");
    expect(dashboard).toContain('id="club-members-invites"');
    expect(dashboard).not.toContain('>New tournament<');
    expect(dashboard).not.toContain('>Create meetup<');
  });

  it("keeps the demo aligned with live workspace header hierarchy", () => {
    expect(demo).toContain("function DemoWorkspaceHeader");
    expect(demo).toContain('data-testid="club-demo-workspace-header"');
    expect(demo).toContain('if (activeTab === "feed" || activeTab === "events" || activeTab === "members")');
    expect(demo).toContain('if (activeTab !== "overview") return null;');
  });
});
