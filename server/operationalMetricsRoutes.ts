import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { logger } from "./logger.js";
import { operationalMetricSchema, validate } from "./validation.js";

const operationalMetricsLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
});

export function createOperationalMetricsRouter() {
  const router = Router();

  router.post("/", operationalMetricsLimiter, validate(operationalMetricSchema), (req, res) => {
    logger.telemetry("client_operational_metric", {
      source: "browser",
      ...req.body,
    });
    res.status(202).json({ ok: true });
  });

  return router;
}
