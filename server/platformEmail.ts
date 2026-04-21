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

/**
 * Sends a welcome email to a newly registered user.
 * Includes links to the tournaments page and the ChessOTB community.
 * Fire-and-forget — caller should .catch() any errors.
 */
export async function sendWelcomeEmail(opts: {
  to: string;
  displayName: string;
}): Promise<void> {
  const { to, displayName } = opts;
  const firstName = displayName.split(" ")[0];

  await sendPlatformEmail({
    to,
    subject: `Welcome to ChessOTB.club, ${firstName}! ♟`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0d1f12;color:#e8f5e9;border-radius:12px;overflow:hidden">
        <!-- Header -->
        <div style="background:#0a1a0e;padding:32px 32px 24px;text-align:center;border-bottom:1px solid #1a3a24">
          <h1 style="margin:0;font-size:28px;color:#4ade80;letter-spacing:-0.5px">ChessOTB.club</h1>
          <p style="margin:6px 0 0;color:#86efac;font-size:13px;text-transform:uppercase;letter-spacing:1px">Chess Tournaments, Over The Board</p>
        </div>

        <!-- Body -->
        <div style="padding:32px">
          <h2 style="margin:0 0 12px;color:#f0fdf4;font-size:22px">Welcome, ${firstName}! &#x1F451;</h2>
          <p style="margin:0 0 20px;color:#a7f3d0;line-height:1.6">
            Your ChessOTB.club account is ready. You can now join or host over-the-board chess tournaments with automatic Swiss pairings, live standings, and elimination brackets.
          </p>

          <!-- CTA buttons -->
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr>
              <td style="padding:0 8px 0 0;width:50%">
                <a href="https://chessotb.club/tournaments"
                   style="display:block;background:#16a34a;color:#fff;text-decoration:none;text-align:center;padding:14px 20px;border-radius:8px;font-weight:600;font-size:15px">
                  &#x1F3C6; Browse Tournaments
                </a>
              </td>
              <td style="padding:0 0 0 8px;width:50%">
                <a href="https://chessotb.club/tournaments/new"
                   style="display:block;background:#0a1a0e;color:#4ade80;text-decoration:none;text-align:center;padding:14px 20px;border-radius:8px;font-weight:600;font-size:15px;border:1px solid #16a34a">
                  &#x2795; Host a Tournament
                </a>
              </td>
            </tr>
          </table>

          <!-- Community section -->
          <div style="background:#0a1a0e;border:1px solid #1a3a24;border-radius:8px;padding:20px;margin-top:8px">
            <h3 style="margin:0 0 8px;color:#4ade80;font-size:15px">&#x1F465; Join the Community</h3>
            <p style="margin:0 0 12px;color:#86efac;font-size:14px;line-height:1.5">
              Connect with chess players, share tournament results, and get help from the ChessOTB community.
            </p>
            <a href="https://chessotb.club"
               style="color:#4ade80;font-size:14px;text-decoration:none;font-weight:600">
              Visit ChessOTB.club &#x2192;
            </a>
          </div>

          <!-- Tips -->
          <div style="margin-top:24px">
            <p style="margin:0 0 8px;color:#86efac;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Quick tips to get started</p>
            <ul style="margin:0;padding:0 0 0 20px;color:#a7f3d0;font-size:14px;line-height:1.8">
              <li>Add your <strong>chess.com username</strong> in your profile for automatic ELO display</li>
              <li>Use the <strong>Swiss + Elimination</strong> format for events with 16+ players</li>
              <li>Share your tournament link with players — they can join with just a username</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#0a1a0e;padding:20px 32px;border-top:1px solid #1a3a24;text-align:center">
          <p style="margin:0;font-size:12px;color:#4a7c59">
            You're receiving this because you created an account at
            <a href="https://chessotb.club" style="color:#4ade80;text-decoration:none">chessotb.club</a>.
          </p>
        </div>
      </div>
    `,
    text: `Welcome to ChessOTB.club, ${firstName}!\n\nYour account is ready. Browse tournaments at https://chessotb.club/tournaments or host your own at https://chessotb.club/tournaments/new.\n\nQuick tips:\n- Add your chess.com username in your profile for automatic ELO display\n- Use the Swiss + Elimination format for events with 16+ players\n- Share your tournament link with players — they can join with just a username\n\nVisit https://chessotb.club to get started.\n\n— The ChessOTB.club team`,
  });
}
