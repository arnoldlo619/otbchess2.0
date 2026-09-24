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

  it("renders the signed-out Club gateway as a photographic hero using the supplied OTB community image", () => {
    expect(myClubsSource).toContain("!user ? <GuestClubLanding");
    expect(guestLanding).toContain('src="/club-assets/club-space-otb-table.webp"');
    expect(guestLanding).toContain('fetchPriority="high"');
    expect(guestLanding).toContain('aria-hidden="true"');
    expect(guestLanding).toContain("bg-[linear-gradient(90deg");
    expect(guestLanding).toContain("Start a club");
    expect(guestLanding).toContain("Explore the workspace");
    expect(guestLanding).toContain('href="/clubs/demo"');
    expect(myClubsSource).not.toContain("ClubPlayerIdBadge");
    expect(guestLanding).toContain("<h1");
    expect(guestLanding).toContain("Chess Clubs");
    expect(guestLanding).toContain("top-[26%]");
    expect(guestLanding).toContain('flex w-full -translate-x-1/2 flex-col items-center');
    expect(guestLanding).toContain('Chess Clubs\n        </h1>\n        <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:mt-7 sm:flex-row">');
    expect(guestLanding).not.toContain('justify-end px-5 pb-36');
    expect(guestLanding).not.toContain("By ChessOTB.Club");
  });

  it("uses the shared premium landing CTA and removes the retired dashboard feature rail", () => {
    expect(myClubsSource).toContain('import { SpinBorderButton } from "@/components/ui/spin-border-button"');
    expect(guestLanding).toContain('<SpinBorderButton variant="solid" type="button" onClick={onCreate}>');
    expect(guestLanding).not.toContain("ChessOTB Club Spaces");
    expect(guestLanding).not.toContain("A home for every game.");
    expect(guestLanding).not.toContain("previewRows");
    expect(guestLanding).not.toContain("Plan the next round");
    expect(guestLanding).not.toContain("Keep everyone in sync");
    expect(guestLanding).not.toContain("Keep the moments close");
    expect(guestLanding).not.toContain("Ready to bring your club together?");
    expect(guestLanding).not.toMatch(/[🏆🌍🥇🥈🥉🔥✨]/u);
  });

  it("retains the functional membership index and minimal no-clubs state for signed-in users", () => {
    expect(myClubsSource).toContain("{user && (");
    expect(memberIndex).toContain("Welcome back");
    expect(memberIndex).toContain("Your chess clubs hub.");
    expect(memberIndex).toContain("<PrivateClubEmptyState isDark={isDark} onCreate={openCreateClub} />");
    expect(memberIndex).not.toContain('href="/clubs/demo"');
  });
});
