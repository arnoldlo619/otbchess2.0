import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const myClubsSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/MyClubs.tsx"),
  "utf8",
);

const clubCard = myClubsSource.slice(
  myClubsSource.indexOf("function ClubCard"),
  myClubsSource.indexOf("function PrivateClubEmptyState"),
);

const guestLanding = myClubsSource.slice(
  myClubsSource.indexOf("function GuestClubLanding"),
  myClubsSource.indexOf("export default function MyClubs"),
);

const memberIndex = myClubsSource.slice(
  myClubsSource.indexOf("{!user ? <GuestClubLanding"),
  myClubsSource.indexOf("</main>"),
);

describe("My Clubs visual system", () => {
  it("keeps Club cards free of redundant private badges while retaining the meaningful owner marker", () => {
    expect(myClubsSource).not.toContain("Private club workspaces");
    expect(clubCard).not.toContain(">\n            Private\n");
    expect(clubCard).not.toContain("FolderLock");
    expect(clubCard).toContain("Owner");
  });

  it("renders the Mobbin-informed guest landing instead of a dashboard empty-state stack", () => {
    expect(myClubsSource).toContain("!user ? <GuestClubLanding");
    expect(guestLanding).toContain("A home for every game.");
    expect(guestLanding).toContain("Start a club");
    expect(guestLanding).toContain("Explore the workspace");
    expect(guestLanding).toContain('href="/clubs/demo"');
    expect(guestLanding).not.toContain("A private home for every club");
    expect(guestLanding).not.toContain("Ready to bring your club together?");
  });

  it("uses one conversion moment for visitors and retains the functional membership index for signed-in users", () => {
    expect(myClubsSource).toContain("{user && (");
    expect(memberIndex).toContain("Welcome back");
    expect(memberIndex).toContain("Your chess clubs hub.");
    expect(memberIndex).toContain("<PrivateClubEmptyState isDark={isDark} onCreate={openCreateClub} />");
    expect(memberIndex).not.toContain('href="/clubs/demo"');
  });

  it("uses the OTB icon system without emoji-derived visual language", () => {
    expect(guestLanding).toContain("CalendarDays");
    expect(guestLanding).toContain("MessageSquare");
    expect(guestLanding).toContain("ImageIcon");
    expect(guestLanding).not.toMatch(/[🏆🌍🥇🥈🥉🔥✨]/u);
  });
});
