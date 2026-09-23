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

const emptyState = myClubsSource.slice(
  myClubsSource.indexOf("function PrivateClubEmptyState"),
  myClubsSource.indexOf("export default function MyClubs"),
);

const membershipSection = myClubsSource.slice(
  myClubsSource.indexOf('<section className="mt-10">'),
  myClubsSource.indexOf("{loading ? ("),
);

describe("My Clubs visual cleanup", () => {
  it("removes redundant private-workspace badges while retaining the meaningful owner marker", () => {
    expect(myClubsSource).not.toContain("Private club workspaces");
    expect(clubCard).not.toContain(">\n            Private\n");
    expect(clubCard).not.toContain("FolderLock");
    expect(clubCard).toContain("Owner");
  });

  it("uses the concise personal hub message", () => {
    expect(myClubsSource).toContain('user ? "Your chess clubs hub."');
    expect(myClubsSource).not.toContain("Only clubs you own or belong to appear here.");
  });

  it("promotes the My Clubs heading without adding a second h1 landmark", () => {
    expect(membershipSection).toContain('<h2 className={`text-3xl font-bold tracking-tight sm:text-4xl ${textMain}`}');
    expect(membershipSection).toContain(">My clubs</h2>");
    expect(membershipSection).not.toContain("<h1");
  });

  it("keeps the demo affordance for an empty state but removes it from existing memberships", () => {
    expect(emptyState).toContain('href="/clubs/demo"');
    expect(emptyState).toContain("View demo dashboard");
    expect(membershipSection).not.toContain('href="/clubs/demo"');
    expect(myClubsSource).not.toContain("Preview demo");
  });
});
