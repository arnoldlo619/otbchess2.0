import type { ErrorRequestHandler, RequestHandler } from "express";
import { nanoid } from "nanoid";
import { logger } from "./logger.js";

export interface RequestWithId {
  requestId?: string;
  requestStartedAt?: number;
}

export function getRequestId(req: Express.Request): string | undefined {
  return (req as typeof req & RequestWithId).requestId;
}

export const requestCorrelation: RequestHandler = (req, res, next) => {
  const requestId = nanoid(10);
  const request = req as typeof req & RequestWithId;
  request.requestId = requestId;
  request.requestStartedAt = Date.now();
  res.setHeader("X-Request-ID", requestId);
  res.once("finish", () => {
    const durationMs = Date.now() - (request.requestStartedAt ?? Date.now());
    const context = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    };
    if (res.statusCode >= 500) logger.error("http_request_failed", context);
    else if (res.statusCode >= 400 || durationMs >= 2_000) logger.warn("http_request_warning", context);
    else logger.debug("http_request_completed", context);
  });
  next();
};

export const globalErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as typeof req & RequestWithId).requestId ?? nanoid(10);
  logger.error("express_unhandled_route_error", {
    requestId,
    method: req.method,
    path: req.path,
    error,
  });
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      message: "We couldn’t complete that request. Please try again.",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    });
  }
};
