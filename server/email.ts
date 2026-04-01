/**
 * Server-side email routes for tournament results delivery.
 *
 * Endpoints:
 *   PUT  /api/email/smtp-config        — save/update SMTP config for the authed user
 *   GET  /api/email/smtp-config        — fetch current config (password masked)
 *   POST /api/email/test-smtp          — test connection and send a test email
 *   POST /api/tournament/:id/send-results-email — send personalized results emails
 */

import { Router } from "express";
import nodemailer from "nodemailer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getDb } from "./db.js";
import { directorSmtpConfig } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import { requireFullAuth } from "./auth.js";

export const emailRouter = Router();

// ─── Encryption helpers ───────────────────────────────────────────────────────
// AES-256-CBC using the JWT_SECRET as the key material (first 32 bytes of SHA-256 hash)

function getEncKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "fallback-secret-change-me";
  return createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getEncKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getEncKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ─── PUT /api/email/smtp-config ───────────────────────────────────────────────
emailRouter.put("/smtp-config", requireFullAuth, async (req: any, res: any) => {
  try {
    const { host, port, secure, smtpUser, smtpPass, fromName, fromEmail } = req.body;
    if (!host || !smtpUser || !smtpPass || !fromEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = await getDb();
    const encrypted = encrypt(smtpPass);

    await db
      .insert(directorSmtpConfig)
      .values({
        userId: req.userId,
        host,
        port: Number(port) || 587,
        secure: Boolean(secure),
        smtpUser,
        smtpPassEncrypted: encrypted,
        fromName: fromName || "ChessOTB Director",
        fromEmail,
      })
      .onDuplicateKeyUpdate({
        set: {
          host,
          port: Number(port) || 587,
          secure: Boolean(secure),
          smtpUser,
          smtpPassEncrypted: encrypted,
          fromName: fromName || "ChessOTB Director",
          fromEmail,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("[email] PUT smtp-config error:", err);
    res.status(500).json({ error: "Failed to save SMTP config" });
  }
});

// ─── GET /api/email/smtp-config ───────────────────────────────────────────────
emailRouter.get("/smtp-config", requireFullAuth, async (req: any, res: any) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(directorSmtpConfig)
      .where(eq(directorSmtpConfig.userId, req.userId))
      .limit(1);

    if (!rows.length) return res.json({ configured: false });

    const cfg = rows[0];
    res.json({
      configured: true,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      smtpUser: cfg.smtpUser,
      smtpPassMasked: "••••••••",
      fromName: cfg.fromName,
      fromEmail: cfg.fromEmail,
    });
  } catch (err) {
    console.error("[email] GET smtp-config error:", err);
    res.status(500).json({ error: "Failed to fetch SMTP config" });
  }
});

// ─── POST /api/email/test-smtp ────────────────────────────────────────────────
emailRouter.post("/test-smtp", requireFullAuth, async (req: any, res: any) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(directorSmtpConfig)
      .where(eq(directorSmtpConfig.userId, req.userId))
      .limit(1);

    if (!rows.length) return res.status(400).json({ error: "No SMTP config saved" });

    const cfg = rows[0];
    const pass = decrypt(cfg.smtpPassEncrypted);

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.smtpUser, pass },
    });

    await transporter.verify();

    // Send a test email to the director themselves
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: cfg.fromEmail,
      subject: "✓ ChessOTB SMTP Test — Connection Successful",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#2d6a4f">✓ SMTP Connection Successful</h2>
          <p>Your SMTP configuration is working correctly. Tournament results emails will be sent from:</p>
          <p><strong>${cfg.fromName}</strong> &lt;${cfg.fromEmail}&gt;</p>
          <p style="color:#888;font-size:12px">Sent via ChessOTB · chessotb.club</p>
        </div>
      `,
    });

    res.json({ ok: true, message: `Test email sent to ${cfg.fromEmail}` });
  } catch (err: any) {
    console.error("[email] test-smtp error:", err);
    res.status(400).json({ error: err.message ?? "SMTP connection failed" });
  }
});

// ─── POST /api/tournament/:id/send-results-email ─────────────────────────────
// Body: { players: Array<{ name, email, rank, points, wdl, reportUrl, cardUrl }> }
emailRouter.post("/tournament/:id/send-results-email", requireFullAuth, async (req: any, res: any) => {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(directorSmtpConfig)
      .where(eq(directorSmtpConfig.userId, req.userId))
      .limit(1);

    if (!rows.length) return res.status(400).json({ error: "No SMTP config saved" });

    const cfg = rows[0];
    const pass = decrypt(cfg.smtpPassEncrypted);

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.smtpUser, pass },
    });

    const { players, tournamentName, pdfBase64 } = req.body as {
      players: Array<{
        name: string;
        email: string;
        rank: number;
        points: number | string;
        wdl: string;
        reportUrl: string;
        cardUrl?: string;
      }>;
      tournamentName: string;
      /** Optional base64-encoded PDF to attach to every email */
      pdfBase64?: string;
    };

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "No players provided" });
    }

    const results: Array<{ email: string; status: "sent" | "failed"; error?: string }> = [];

    for (const p of players) {
      if (!p.email) {
        results.push({ email: "", status: "failed", error: "No email address" });
        continue;
      }

      const rankLabel =
        p.rank === 1 ? "🥇 1st Place" : p.rank === 2 ? "🥈 2nd Place" : p.rank === 3 ? "🥉 3rd Place" : `#${p.rank}`;

      const html = `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff">
          <div style="background:#1a3d2b;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <p style="color:#6fcf7f;font-size:13px;margin:0 0 4px">♟ ChessOTB</p>
            <h1 style="color:#fff;font-size:22px;margin:0">${tournamentName}</h1>
            <p style="color:#a8d5b5;font-size:14px;margin:8px 0 0">Tournament Results</p>
          </div>

          <p style="font-size:16px;color:#1a1a1a">Hi <strong>${p.name}</strong>,</p>
          <p style="color:#444">The tournament has concluded. Here's how you finished:</p>

          <div style="background:#f4f9f6;border-radius:10px;padding:16px 20px;margin:20px 0;border-left:4px solid #2d6a4f">
            <p style="margin:0;font-size:20px;font-weight:700;color:#1a3d2b">${rankLabel}</p>
            <p style="margin:4px 0 0;color:#555;font-size:14px">${p.points} pts &nbsp;·&nbsp; ${p.wdl}</p>
          </div>

          <div style="margin:24px 0;display:flex;gap:12px;flex-direction:column">
            <a href="${p.reportUrl}" style="display:block;background:#2d6a4f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:10px;text-align:center;font-weight:600;font-size:15px">
              📊 View Full Results
            </a>
            ${
              p.cardUrl
                ? `<a href="${p.cardUrl}" style="display:block;background:#f4f9f6;color:#2d6a4f;text-decoration:none;padding:14px 20px;border-radius:10px;text-align:center;font-weight:600;font-size:15px;border:1px solid #c8e6d4">
              🃏 Download Your Player Card
            </a>`
                : ""
            }
          </div>

          <p style="color:#888;font-size:12px;text-align:center;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
            Sent via <a href="https://chessotb.club" style="color:#2d6a4f">ChessOTB</a> · The OTB Chess Tournament Platform
          </p>
        </div>
      `;

      // Build PDF attachment if provided
      const attachments = pdfBase64
        ? [{
            filename: `${tournamentName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-results.pdf`,
            content: Buffer.from(pdfBase64, "base64"),
            contentType: "application/pdf",
          }]
        : [];

      try {
        await transporter.sendMail({
          from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
          to: p.email,
          subject: `Your results from ${tournamentName} — ${rankLabel}`,
          html,
          attachments,
        });
        results.push({ email: p.email, status: "sent" });
      } catch (err: any) {
        results.push({ email: p.email, status: "failed", error: err.message });
      }
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    res.json({ ok: true, sent, failed, results });
  } catch (err: any) {
    console.error("[email] send-results-email error:", err);
    res.status(500).json({ error: err.message ?? "Failed to send emails" });
  }
});
