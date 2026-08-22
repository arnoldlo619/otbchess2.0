import { describe, expect, it } from "vitest";
import type { Router } from "express";
import { createAuthenticationRouter } from "./authRoutes";
import { createProfileRouter } from "./profileRoutes";
import { createUserTournamentRouter } from "./userTournamentRoutes";

type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
};

function routeContracts(router: Router): string[] {
  const layers = (router as unknown as { stack: RouterLayer[] }).stack;
  return layers.flatMap((layer) => {
    if (!layer.route) return [];
    const methods = Object.entries(layer.route.methods)
      .filter(([, enabled]) => enabled)
      .map(([method]) => method.toUpperCase());
    return methods.map((method) => `${method} ${layer.route?.path}`);
  });
}

describe("authentication route module", () => {
  it("preserves account and session endpoints", () => {
    expect(routeContracts(createAuthenticationRouter())).toEqual(expect.arrayContaining([
      "POST /register",
      "POST /login",
      "POST /logout",
      "POST /guest",
      "GET /me",
      "POST /refresh",
      "GET /google",
    ]));
  });
});

describe("profile route module", () => {
  it("owns profile editing, rating history, password, and Pro renewal", () => {
    expect(routeContracts(createProfileRouter())).toEqual(expect.arrayContaining([
      "PATCH /me",
      "GET /rating-history",
      "GET /auth/rating-history",
      "POST /renew-pro-request",
      "POST /change-password",
    ]));
  });
});

describe("user tournament route module", () => {
  it("preserves user tournament and join-link contracts", () => {
    expect(routeContracts(createUserTournamentRouter())).toEqual(expect.arrayContaining([
      "GET /user/tournaments",
      "POST /user/tournaments",
      "DELETE /user/tournaments/:tournamentId",
      "PATCH /user/tournaments/:tournamentId/custom-slug",
      "GET /join/resolve/:codeOrSlug",
      "GET /tournament/:tournamentId/meta",
      "GET /join/check-slug/:slug",
    ]));
  });
});
