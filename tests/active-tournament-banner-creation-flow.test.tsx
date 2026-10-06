// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeTournament: {
    id: "banner-qa-open",
    name: "Banner QA Open",
    href: "/tournament/banner-qa-open/manage",
    role: "director" as const,
    status: "registration" as const,
  },
}));

vi.mock("../client/src/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

vi.mock("../client/src/hooks/useActiveTournament", () => ({
  useActiveTournament: () => mocks.activeTournament,
}));

vi.mock("wouter", () => ({
  Link: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
  useLocation: () => ["/"],
}));

import { ActiveTournamentBanner } from "../client/src/components/ActiveTournamentBanner";
import { setTournamentWizardActive } from "../client/src/lib/tournamentWizardActivity";

const bannerSource = readFileSync("client/src/components/ActiveTournamentBanner.tsx", "utf8");
const wizardSource = readFileSync("client/src/components/TournamentWizard.tsx", "utf8");
const activitySource = readFileSync("client/src/lib/tournamentWizardActivity.ts", "utf8");

describe("ActiveTournamentBanner creation-flow suppression", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("renders an active tournament banner outside creation flows", () => {
    render(<ActiveTournamentBanner />);

    expect(screen.getByText("Banner QA Open")).toBeTruthy();
  });

  it("does not render over an active tournament creation flow", () => {
    setTournamentWizardActive(true);
    render(<ActiveTournamentBanner />);

    expect(screen.queryByText("Banner QA Open")).toBeNull();
  });

  it("retains the explicit route and activity guards", () => {
    expect(bannerSource).toContain("isOnTournamentPage || tournamentWizardActive || !activeTournament");
    expect(bannerSource).toContain("TOURNAMENT_WIZARD_ACTIVITY_EVENT");
  });

  it("tracks every mounted tournament wizard, including Club Dashboard entry points", () => {
    expect(wizardSource).toContain("setTournamentWizardActive(true)");
    expect(wizardSource).toContain("return () => setTournamentWizardActive(false)");
  });

  it("uses a storage-safe shared activity signal", () => {
    expect(activitySource).toContain('TOURNAMENT_WIZARD_ACTIVE_KEY = "otb-tournament-wizard-active-v1"');
    expect(activitySource).toContain("window.dispatchEvent");
    expect(activitySource).toContain("sessionStorage");
  });
});
