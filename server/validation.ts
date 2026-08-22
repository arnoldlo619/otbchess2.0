/**
 * Server-side input validation schemas (zod).
 * Applied to public-facing POST/PUT routes to reject malformed payloads
 * before they reach business logic.
 */
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ── Reusable middleware factory ───────────────────────────────────────────────
export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return res.status(400).json({ error: "Validation failed", issues });
    }
    // Replace req.body with the parsed (and potentially coerced/stripped) value
    req.body = result.data;
    next();
  };
}

// ── Tournament player registration ───────────────────────────────────────────
export const addPlayerSchema = z.object({
  player: z.object({
    username: z.string().min(1).max(100).trim(),
    name: z.string().max(200).optional(),
    rating: z.number().int().min(0).max(4000).optional(),
    title: z.string().max(10).optional(),
    country: z.string().max(5).optional(),
  }).passthrough(),
});

// ── Tournament state save ────────────────────────────────────────────────────
export const saveStateSchema = z.object({
  state: z.unknown().refine((v) => v !== null && v !== undefined, "state is required"),
  baseRevision: z.number().int().nonnegative().optional(),
});

// ── Push subscription ────────────────────────────────────────────────────────
export const pushSubscribeSchema = z.object({
  tournamentId: z.string().min(1).max(100),
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  chessUsername: z.string().max(100).optional(),
});

// ── Push notification dispatch ───────────────────────────────────────────────
export const pushNotifySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  tag: z.string().max(100).optional(),
});

// ── Analytics event ──────────────────────────────────────────────────────────
const VALID_EVENT_TYPES = [
  "search", "follow", "unfollow", "email_capture", "card_claim", "cta_click",
] as const;
export const analyticsEventSchema = z.object({
  tournamentId: z.string().min(1).max(100),
  eventType: z.enum(VALID_EVENT_TYPES),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Client error telemetry ───────────────────────────────────────────────────
export const clientErrorSchema = z.object({
  eventType: z.enum(["render_error", "unhandled_error", "unhandled_rejection", "api_error"]),
  message: z.string().min(1).max(500),
  name: z.string().max(100).optional(),
  stack: z.string().max(3_000).optional(),
  componentStack: z.string().max(3_000).optional(),
  path: z.string().min(1).max(500),
  referenceId: z.string().max(100).optional(),
  requestId: z.string().max(100).optional(),
  status: z.number().int().min(0).max(599).optional(),
  code: z.string().max(100).optional(),
});

// ── Prep analysis resolve ────────────────────────────────────────────────────
export const prepResolveSchema = z.object({
  gameId: z.string().min(1).max(200),
  provider: z.enum(["chesscom", "lichess"]).optional(),
});

// ── Prep saved report ────────────────────────────────────────────────────────
export const prepSaveSchema = z.object({
  opponentUsername: z.string().min(1).max(100),
  provider: z.enum(["chesscom", "lichess"]),
  reportJson: z.string().max(5_000_000),
  label: z.string().max(200).optional(),
});

// ── Coach insight ────────────────────────────────────────────────────────────
export const coachInsightSchema = z.object({
  opponentUsername: z.string().min(1).max(100),
  provider: z.enum(["chesscom", "lichess"]),
  context: z.string().max(10_000),
});

// ── Tournament broadcast ─────────────────────────────────────────────────────
export const broadcastSchema = z.object({
  enabled: z.boolean(),
  youtubeUrl: z.string().url().max(500).optional().or(z.literal("")),
  twitchUrl: z.string().url().max(500).optional().or(z.literal("")),
  customUrl: z.string().url().max(500).optional().or(z.literal("")),
});

// ── Battle creation ──────────────────────────────────────────────────────────
export const createBattleSchema = z.object({
  opponentId: z.string().min(1).max(100).optional(),
  timeControl: z.string().max(50).optional(),
  rated: z.boolean().optional(),
});

// ── Timer update ─────────────────────────────────────────────────────────────
export const timerUpdateSchema = z.object({
  running: z.boolean().optional(),
  remaining: z.number().nonnegative().optional(),
  duration: z.number().positive().optional(),
}).refine((v) => Object.keys(v).length > 0, "At least one timer field is required");
