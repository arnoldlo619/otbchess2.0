import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { logger } from "./logger.js";
import { clientErrorSchema, validate } from "./validation.js";

const clientErrorLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
});

export function createClientErrorRouter() {
  const router = Router();

  router.post("/", clientErrorLimiter, validate(clientErrorSchema), (req, res) => {
    const {
      eventType,
      message,
      name,
      stack,
      componentStack,
      path,
      referenceId,
      requestId,
      status,
      code,
    } = req.body;

    logger.error("client_error_reported", {
      source: "browser",
      eventType,
      message,
      name,
      stack,
      componentStack,
      path,
      referenceId,
      requestId,
      status,
      code,
    });

    res.status(202).json({ ok: true });
  });

  return router;
}
