import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Home.tsx"), "utf8");

describe("Home dead-code integrity", () => {
  it("does not retain unreachable lightbox, ecosystem, or showcase helpers", () => {
    expect(homeSource).not.toContain("function PhoneLightbox");
    expect(homeSource).not.toContain("function EcosystemPathways");
    expect(homeSource).not.toContain("function Showcase");
    expect(homeSource).not.toContain("SHOWCASE_FEATURES");
    expect(homeSource).not.toContain("lightboxOpen");
  });

  it("removes the redundant How It Works Step pill badge while retaining the step content", () => {
    expect(homeSource).not.toContain("function StepBadge");
    expect(homeSource).not.toContain("otb-step-badge");
    expect(homeSource).toContain("Share your QR Code");
    expect(homeSource).toContain("Seamless Tournament Flow for All");
  });

  it("keeps the revised tournament flow copy and Chess.com lookup destination", () => {
    expect(homeSource).toContain("Players scan once arriving for seamless check-in process for everyone.");
    expect(homeSource).toContain("Players sign up with their Chess.com username");
    expect(homeSource).toContain("Try our Chess.com User Lookup");
    expect(homeSource).toContain('ctaHref: "#chesscom-integration"');
    expect(homeSource).toContain('id="chesscom-integration"');
    expect(homeSource).toContain("Seamless Tournament Flow for All");
  });

  it("keeps the active landing composition intact", () => {
    expect(homeSource).toContain("<Hero onCreateTournament={openTournamentWizard} />");
    expect(homeSource).toContain("<Features />");
    expect(homeSource).toContain("<PlayerDemo />");
    expect(homeSource).toContain("<CTASection onCreateTournament={openTournamentWizard} />");
  });

  it("keeps the ChessOTB tools message and Matchup Prep study-glasses visual", () => {
    expect(homeSource).toContain("Manage your Club and Tournaments with our Suite of ChessOTB Tools");
    expect(homeSource).toContain('icon={<Glasses aria-hidden="true"');
    expect(homeSource).not.toContain('icon={<Brain className="w-4 h-4" />}');
  });
});
