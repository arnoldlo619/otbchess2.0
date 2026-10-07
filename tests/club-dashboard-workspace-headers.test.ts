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

  it("uses one compact Album-style profile header for Feed, Events, League, and Members", () => {
    expect(dashboard).toContain("function ClubWorkspaceSocialHeader");
    expect(dashboard).toContain('data-testid="club-dashboard-workspace-header"');
    expect(dashboard).toContain('tab === "feed" || tab === "events" || tab === "members" || tab === "leagues"');
    expect(dashboard).toContain('label: "Feed"');
    expect(dashboard).toContain('label: "Events"');
    expect(dashboard).toContain('label: "Members"');
    expect(dashboard).toContain('leagues: {');
    expect(dashboard).toContain('size={72}');
    expect(dashboard).toContain('tracking-[0.12em]');
    expect(dashboard).toContain("relative mb-6 pb-6 after:absolute after:inset-x-0 after:bottom-0 after:h-px");
    expect(dashboard).not.toContain("mb-5 border-b px-1 pb-5");
  });

  it("keeps one relevant owner or member action in each compact header", () => {
    expect(dashboard).toContain('label: "Create event"');
    expect(dashboard).toContain('label: "New League"');
    expect(dashboard).toContain('label: "Invite members"');
    expect(dashboard).toContain('label: "Post update"');
    expect(dashboard).toContain("setShowCreateEvent(true)");
    expect(dashboard).toContain("setLeagueWizardOpen(true)");
    expect(dashboard).toContain("function openInviteDialog()");
    expect(dashboard).toContain("onClick: openInviteDialog");
    expect(dashboard).toContain("setFeedComposerOpenRequest((current) => current + 1)");
    expect(dashboard).toContain("<ClubFeedComposer");
    expect(dashboard).toContain("openRequest={feedComposerOpenRequest}");
    expect(dashboard).toContain('data-testid="club-members-invite-dialog"');
    expect(dashboard).not.toContain('>New tournament<');
    expect(dashboard).not.toContain('>Create meetup<');
  });

  it("removes the inaccurate Events label from the League header", () => {
    expect(dashboard).toContain('label: undefined,');
    expect(dashboard).toContain('{content.label && <span');
    expect(dashboard).toContain('aria-label={`${club.name}${content.label ? ` ${content.label.toLowerCase()}` : ""} header`}');
  });

  it("moves member invitations into an accessible dialog rather than an inline drawer", () => {
    expect(dashboard).toContain('const [showInviteDialog, setShowInviteDialog] = useState(false);');
    expect(dashboard).toContain('useAccessibleOverlay({ open: showInviteDialog');
    expect(dashboard).toContain('role="dialog"');
    expect(dashboard).toContain('aria-labelledby="club-member-invite-title"');
    expect(dashboard).toContain('htmlFor="club-member-invite-email"');
    expect(dashboard).toContain('id="club-member-invite-email"');
    expect(dashboard).toContain('inputMode="email"');
    expect(dashboard).toContain('onSubmit={sendInvite}');
    expect(dashboard).toContain('rounded-t-3xl border shadow-2xl sm:max-h');
    expect(dashboard).toContain('Pending invites');
    expect(dashboard).not.toContain('showInvitePanel');
    expect(dashboard).not.toContain('club-members-invites');
  });

  it("keeps the demo aligned with live workspace header hierarchy", () => {
    expect(demo).toContain("function DemoWorkspaceHeader");
    expect(demo).toContain('data-testid="club-demo-workspace-header"');
    expect(demo).toContain('activeTab === "feed" || activeTab === "events" || activeTab === "leagues" || activeTab === "members"');
    expect(demo).toContain('if (activeTab !== "overview") return null;');
    expect(demo).toContain("relative mb-6 pb-6 text-white after:absolute after:inset-x-0");
    expect(demo).toContain('label: undefined, primary: "1 league"');
    expect(demo).toContain('{ id: "leagues", label: "League", icon: LeaguesIcon, group: "workspace" }');
  });
});
