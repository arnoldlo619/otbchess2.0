import type { ErrorRequestHandler, RequestHandler } from "express";
import { nanoid } from "nanoid";
import { logger } from "./logger.js";

export interface RequestWithId {
  requestId?: string;
}

export const requestCorrelation: RequestHandler = (req, res, next) => {
  const requestId = nanoid(10);
  (req as typeof req & RequestWithId).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
};

export const globalErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as typeof req & RequestWithId).requestId ?? nanoid(10);
  const internalMessage = error instanceof Error ? error.message : String(error);
  logger.error(`[express] Unhandled route error (${requestId}):`, internalMessage);
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      message: "We couldn’t complete that request. Please try again.",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    });
  }
};
