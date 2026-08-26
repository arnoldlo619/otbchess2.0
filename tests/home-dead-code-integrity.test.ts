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

  it("keeps the active landing composition intact", () => {
    expect(homeSource).toContain("<Hero onCreateTournament={openTournamentWizard} />");
    expect(homeSource).toContain("<Features />");
    expect(homeSource).toContain("<PlayerDemo />");
    expect(homeSource).toContain("<CTASection onCreateTournament={openTournamentWizard} />");
  });
});
