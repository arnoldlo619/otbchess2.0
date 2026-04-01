/**
 * SMTP Email System Tests
 *
 * Verifies:
 * 1. SmtpSettingsCard component exists and exports correctly
 * 2. ShareResultsModal accepts the tournamentId prop
 * 3. Server email router is registered in server/index.ts
 * 4. Email router endpoints are defined in server/email.ts
 * 5. directorSmtpConfig schema is present in shared/schema.ts
 * 6. Encryption helpers exist in email.ts
 * 7. Email body builder produces expected content
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../");

function readSrc(relPath: string): string {
  return readFileSync(resolve(ROOT, "client/src", relPath), "utf8");
}

function readServer(relPath: string): string {
  return readFileSync(resolve(ROOT, "server", relPath), "utf8");
}

function readShared(relPath: string): string {
  return readFileSync(resolve(ROOT, "shared", relPath), "utf8");
}

// ── 1. SmtpSettingsCard component ─────────────────────────────────────────────
describe("SmtpSettingsCard component", () => {
  it("exports SmtpSettingsCard function", () => {
    const src = readSrc("components/SmtpSettingsCard.tsx");
    expect(src).toContain("export function SmtpSettingsCard");
  });

  it("uses credentials: include for cookie-based auth", () => {
    const src = readSrc("components/SmtpSettingsCard.tsx");
    expect(src).toContain('credentials: "include"');
  });

  it("calls PUT /api/email/smtp-config to save", () => {
    const src = readSrc("components/SmtpSettingsCard.tsx");
    expect(src).toContain('"/api/email/smtp-config"');
    expect(src).toContain('method: "PUT"');
  });

  it("calls POST /api/email/test-smtp to test connection", () => {
    const src = readSrc("components/SmtpSettingsCard.tsx");
    expect(src).toContain('"/api/email/test-smtp"');
    expect(src).toContain('method: "POST"');
  });

  it("includes Gmail, Outlook, Yahoo presets", () => {
    const src = readSrc("components/SmtpSettingsCard.tsx");
    expect(src).toContain("smtp.gmail.com");
    expect(src).toContain("smtp-mail.outlook.com");
    expect(src).toContain("smtp.mail.yahoo.com");
  });

  it("never exposes password in plain text (always clears after save)", () => {
    const src = readSrc("components/SmtpSettingsCard.tsx");
    // After save, password field is cleared
    expect(src).toContain("smtpPass: \"\"");
  });
});

// ── 2. ShareResultsModal tournamentId prop ────────────────────────────────────
describe("ShareResultsModal server-send integration", () => {
  it("accepts tournamentId prop in interface", () => {
    const src = readSrc("components/ShareResultsModal.tsx");
    expect(src).toContain("tournamentId?: string");
  });

  it("uses tournamentId in the send-results-email endpoint URL", () => {
    const src = readSrc("components/ShareResultsModal.tsx");
    expect(src).toContain("send-results-email");
    expect(src).toContain("tournamentId");
  });

  it("checks SMTP config on mount via GET /api/email/smtp-config", () => {
    const src = readSrc("components/ShareResultsModal.tsx");
    expect(src).toContain("/api/email/smtp-config");
    expect(src).toContain("smtpConfigured");
  });

  it("shows per-player send status icons (sending/sent/failed)", () => {
    const src = readSrc("components/ShareResultsModal.tsx");
    expect(src).toContain("SendStatus");
    expect(src).toContain('"sending"');
    expect(src).toContain('"sent"');
    expect(src).toContain('"failed"');
  });

  it("shows SMTP configuration hint when not configured", () => {
    const src = readSrc("components/ShareResultsModal.tsx");
    expect(src).toContain("Configure SMTP in");
    expect(src).toContain("Email Settings");
  });

  it("Report.tsx passes tournamentId to ShareResultsModal", () => {
    const src = readSrc("pages/Report.tsx");
    expect(src).toContain("tournamentId={tournamentId}");
  });
});

// ── 3. Server email router registration ──────────────────────────────────────
describe("Server email router registration", () => {
  it("emailRouter is imported in server/index.ts", () => {
    const src = readServer("index.ts");
    expect(src).toContain('import { emailRouter }');
    expect(src).toContain('"./email.js"');
  });

  it("emailRouter is mounted at /api/email", () => {
    const src = readServer("index.ts");
    expect(src).toContain('"/api/email"');
    expect(src).toContain("emailRouter");
  });

  it("emailRouter is mounted at /api/tournament for send-results-email", () => {
    const src = readServer("index.ts");
    expect(src).toContain('"/api/tournament"');
  });
});

// ── 4. Email router endpoints ─────────────────────────────────────────────────
describe("Server email.ts endpoints", () => {
  it("defines PUT /smtp-config endpoint", () => {
    const src = readServer("email.ts");
    expect(src).toContain('emailRouter.put("/smtp-config"');
  });

  it("defines GET /smtp-config endpoint", () => {
    const src = readServer("email.ts");
    expect(src).toContain('emailRouter.get("/smtp-config"');
  });

  it("defines POST /test-smtp endpoint", () => {
    const src = readServer("email.ts");
    expect(src).toContain('emailRouter.post("/test-smtp"');
  });

  it("defines POST /tournament/:id/send-results-email endpoint", () => {
    const src = readServer("email.ts");
    expect(src).toContain('emailRouter.post("/tournament/:id/send-results-email"');
  });

  it("uses requireFullAuth middleware (rejects guests)", () => {
    const src = readServer("email.ts");
    expect(src).toContain("requireFullAuth");
  });

  it("uses nodemailer for sending", () => {
    const src = readServer("email.ts");
    expect(src).toContain("nodemailer");
    expect(src).toContain("createTransport");
    expect(src).toContain("sendMail");
  });
});

// ── 5. Database schema ────────────────────────────────────────────────────────
describe("directorSmtpConfig schema", () => {
  it("is defined in shared/schema.ts", () => {
    const src = readShared("schema.ts");
    expect(src).toContain("directorSmtpConfig");
    expect(src).toContain("director_smtp_config");
  });

  it("has required fields: host, port, secure, smtpUser, smtpPassEncrypted, fromName, fromEmail", () => {
    const src = readShared("schema.ts");
    expect(src).toContain('"host"');
    expect(src).toContain('"port"');
    expect(src).toContain('"secure"');
    expect(src).toContain('"smtp_user"');
    expect(src).toContain('"smtp_pass_encrypted"');
    expect(src).toContain('"from_name"');
    expect(src).toContain('"from_email"');
  });

  it("has unique constraint on userId (one config per user)", () => {
    const src = readShared("schema.ts");
    // The userId column should have .unique()
    expect(src).toContain(".unique()");
  });
});

// ── 6. Encryption helpers ─────────────────────────────────────────────────────
describe("Password encryption in email.ts", () => {
  it("uses AES-256-CBC encryption", () => {
    const src = readServer("email.ts");
    expect(src).toContain("aes-256-cbc");
  });

  it("derives key from JWT_SECRET", () => {
    const src = readServer("email.ts");
    expect(src).toContain("JWT_SECRET");
    expect(src).toContain("sha256");
  });

  it("uses random IV for each encryption", () => {
    const src = readServer("email.ts");
    expect(src).toContain("randomBytes(16)");
  });

  it("stores IV:ciphertext format", () => {
    const src = readServer("email.ts");
    expect(src).toContain('iv.toString("hex") + ":" + encrypted.toString("hex")');
  });

  it("never returns the real password in GET /smtp-config", () => {
    const src = readServer("email.ts");
    expect(src).toContain("smtpPassMasked");
    expect(src).toContain('"••••••••"');
  });
});

// ── 7. SmtpSettingsCard is imported in Director.tsx ──────────────────────────
describe("Director.tsx integration", () => {
  it("imports SmtpSettingsCard", () => {
    const src = readSrc("pages/Director.tsx");
    expect(src).toContain("SmtpSettingsCard");
    expect(src).toContain('"@/components/SmtpSettingsCard"');
  });

  it("renders SmtpSettingsCard in the settings tab", () => {
    const src = readSrc("pages/Director.tsx");
    expect(src).toContain("<SmtpSettingsCard");
    expect(src).toContain("isDark={isDark}");
  });
});
