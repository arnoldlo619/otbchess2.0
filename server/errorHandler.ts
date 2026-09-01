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

  const addPublicServerTiming = () => {
    if (req.method !== "GET" && req.method !== "HEAD") return;
    if (res.headersSent) return;
    const durationMs = Date.now() - (request.requestStartedAt ?? Date.now());
    const roundedDurationMs = Math.round(durationMs * 10) / 10;
    res.setHeader("Server-Timing", `app;dur=${roundedDurationMs}`);
  };

  const originalWriteHead = res.writeHead;
  if (typeof originalWriteHead === "function") {
    res.writeHead = ((...args: Parameters<typeof originalWriteHead>) => {
      addPublicServerTiming();
      return originalWriteHead.apply(res, args);
    }) as typeof res.writeHead;
  }

  const originalWrite = res.write;
  if (typeof originalWrite === "function") {
    res.write = ((...args: Parameters<typeof originalWrite>) => {
      addPublicServerTiming();
      return originalWrite.apply(res, args);
    }) as typeof res.write;
  }

  const originalEnd = res.end;
  if (typeof originalEnd === "function") {
    res.end = ((...args: Parameters<typeof originalEnd>) => {
      addPublicServerTiming();
      return originalEnd.apply(res, args);
    }) as typeof res.end;
  }

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
  const isPayloadTooLarge = error?.type === "entity.too.large" || error?.status === 413;
  logger.error("express_unhandled_route_error", {
    requestId,
    method: req.method,
    path: req.path,
    error,
  });
  if (!res.headersSent) {
    res.status(isPayloadTooLarge ? 413 : 500).json({
      error: isPayloadTooLarge ? "Request payload too large" : "Internal server error",
      message: isPayloadTooLarge ? "This upload is too large. Please choose smaller files and try again." : "We couldn’t complete that request. Please try again.",
      code: isPayloadTooLarge ? "PAYLOAD_TOO_LARGE" : "INTERNAL_SERVER_ERROR",
      requestId,
    });
  }
};
