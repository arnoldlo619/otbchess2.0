/**
 * Authentication facade.
 *
 * Keeps the established `createAuthRouter`, `requireAuth`, and
 * `requireFullAuth` exports stable while implementation details live in
 * focused route modules.
 */
import { Router } from "express";
import { createAuthenticationRouter } from "./authRoutes.js";
import { createProfileRouter } from "./profileRoutes.js";
import { createUserTournamentRouter } from "./userTournamentRoutes.js";

export { requireAuth, requireFullAuth } from "./authCore.js";

export function createAuthRouter(): Router {
  const router = Router();
  router.use(createAuthenticationRouter());
  router.use(createProfileRouter());
  router.use(createUserTournamentRouter());
  return router;
}
