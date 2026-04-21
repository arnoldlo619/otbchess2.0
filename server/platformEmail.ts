/**
 * Platform-level email helper.
 *
 * Sends system notification emails (e.g. Pro renewal alerts) using the
 * platform SMTP credentials stored in environment variables:
 *   PLATFORM_SMTP_HOST, PLATFORM_SMTP_PORT, PLATFORM_SMTP_USER,
 *   PLATFORM_SMTP_PASS, PLATFORM_SMTP_FROM_NAME
 *
 * This is separate from the per-user SMTP config used for tournament results.
 */
import nodemailer from "nodemailer";
import { logger } from "./logger.js";

function getPlatformTransporter() {
  const host = process.env.PLATFORM_SMTP_HOST;
  const port = Number(process.env.PLATFORM_SMTP_PORT ?? "587");
  const user = process.env.PLATFORM_SMTP_USER;
  const pass = process.env.PLATFORM_SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Platform SMTP credentials not configured (PLATFORM_SMTP_HOST / USER / PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { ciphers: "SSLv3" },
  });
}

export async function sendPlatformEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const fromName = process.env.PLATFORM_SMTP_FROM_NAME ?? "ChessOTB.club";
  const fromEmail = process.env.PLATFORM_SMTP_USER ?? "noreply@chessotb.club";

  const transporter = getPlatformTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  logger.info(`[platform-email] Sent "${opts.subject}" to ${opts.to}`);
}

/** Verify the platform SMTP connection — used for health checks and tests. */
export async function verifyPlatformSmtp(): Promise<void> {
  const transporter = getPlatformTransporter();
  await transporter.verify();
}
