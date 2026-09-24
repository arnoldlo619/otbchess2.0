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
    expect(guestLanding).not.toContain("<h1");
    expect(guestLanding).not.toContain("Chess Clubs");
    expect(guestLanding).toContain('absolute inset-0 z-20 flex w-full items-center justify-center');
    expect(guestLanding).toContain('className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row"');
    expect(guestLanding).not.toContain("top-[26%]");
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

  it("sends signed-out Club creation directly to the dedicated sign-up page and resumes the wizard after auth", () => {
    expect(myClubsSource).toContain('const CLUB_CREATE_AUTH_ROUTE = "/auth?tab=signup&redirect=%2Fclubs%3Fcreate%3D1"');
    expect(myClubsSource).toContain("navigate(CLUB_CREATE_AUTH_ROUTE)");
    expect(myClubsSource).toContain('new URLSearchParams(window.location.search).get("create") !== "1"');
    expect(myClubsSource).not.toContain("CreateClubAuthGate");
    expect(myClubsSource).not.toContain("showAuthGate");
  });

  it("retains the functional membership index and minimal no-clubs state for signed-in users", () => {
    expect(myClubsSource).toContain("{user && (");
    expect(memberIndex).toContain("Welcome back");
    expect(memberIndex).toContain("Your chess clubs hub.");
    expect(memberIndex).toContain("<PrivateClubEmptyState isDark={isDark} onCreate={openCreateClub} />");
    expect(memberIndex).not.toContain('href="/clubs/demo"');
  });
});
