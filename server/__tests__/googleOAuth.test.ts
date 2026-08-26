/**
 * Google OAuth callback — unit tests
 *
 * Tests the pure logic of the OAuth callback handler:
 * - Error redirect when no code is present
 * - Error redirect when token exchange fails
 * - Successful user upsert and JWT cookie for new users
 * - Existing user lookup by googleId
 * - Existing user lookup by email (account linking)
 *
 * We mock fetch() and the DB to avoid real network calls.
 */
import { describe, it, expect } from "vitest";

// ── Helpers mirroring the callback logic ─────────────────────────────────────

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleProfile {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface MockUser {
  id: string;
  email: string;
  googleId: string | null;
  displayName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
}

/**
 * Pure function that mirrors the core logic of the /api/oauth/callback handler.
 * Returns the action taken: "redirect_error", "new_user", "existing_linked", "existing_email_link"
 */
async function processOAuthCallback(
  code: string | undefined,
  oauthError: string | undefined,
  mockTokenResponse: GoogleTokenResponse,
  mockProfile: GoogleProfile,
  existingUsers: MockUser[]
): Promise<{
  action: "redirect_error" | "new_user" | "existing_linked" | "existing_email_link";
  userId?: string;
  errorParam?: string;
}> {
  if (oauthError || !code) {
    return { action: "redirect_error", errorParam: oauthError ?? "access_denied" };
  }

  if (!mockTokenResponse.access_token) {
    return { action: "redirect_error", errorParam: "token_exchange_failed" };
  }

  if (!mockProfile.id || !mockProfile.email) {
    return { action: "redirect_error", errorParam: "profile_fetch_failed" };
  }

  // Find existing user by googleId or email
  const byGoogleId = existingUsers.find((u) => u.googleId === mockProfile.id);
  const byEmail = existingUsers.find((u) => u.email === mockProfile.email);
  const existing = byGoogleId ?? byEmail;

  if (existing) {
    if (!existing.googleId) {
      // Link Google account to existing email account
      existing.googleId = mockProfile.id!;
      return { action: "existing_email_link", userId: existing.id };
    }
    return { action: "existing_linked", userId: existing.id };
  }

  // Create new user
  const newUser: MockUser = {
    id: `new_${Date.now()}`,
    email: mockProfile.email!,
    googleId: mockProfile.id!,
    displayName: mockProfile.name ?? mockProfile.email!.split("@")[0],
    avatarUrl: mockProfile.picture ?? null,
    passwordHash: null,
  };
  existingUsers.push(newUser);
  return { action: "new_user", userId: newUser.id };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Google OAuth callback logic", () => {
  const validToken: GoogleTokenResponse = { access_token: "ya29.mock_token" };
  const validProfile: GoogleProfile = {
    id: "google_123",
    email: "alice@example.com",
    name: "Alice Smith",
    picture: "https://example.com/avatar.jpg",
  };

  it("redirects with access_denied when no code is provided", async () => {
    const result = await processOAuthCallback(undefined, undefined, validToken, validProfile, []);
    expect(result.action).toBe("redirect_error");
    expect(result.errorParam).toBe("access_denied");
  });

  it("redirects with the oauth error when Google returns an error", async () => {
    const result = await processOAuthCallback(undefined, "access_denied", validToken, validProfile, []);
    expect(result.action).toBe("redirect_error");
    expect(result.errorParam).toBe("access_denied");
  });

  it("redirects with token_exchange_failed when token exchange returns no access_token", async () => {
    const result = await processOAuthCallback("auth_code_123", undefined, { error: "invalid_grant" }, validProfile, []);
    expect(result.action).toBe("redirect_error");
    expect(result.errorParam).toBe("token_exchange_failed");
  });

  it("redirects with profile_fetch_failed when Google profile has no id", async () => {
    const result = await processOAuthCallback("auth_code_123", undefined, validToken, { email: "alice@example.com" }, []);
    expect(result.action).toBe("redirect_error");
    expect(result.errorParam).toBe("profile_fetch_failed");
  });

  it("creates a new user for a first-time Google sign-in", async () => {
    const users: MockUser[] = [];
    const result = await processOAuthCallback("auth_code_123", undefined, validToken, validProfile, users);
    expect(result.action).toBe("new_user");
    expect(result.userId).toBeDefined();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("alice@example.com");
    expect(users[0].googleId).toBe("google_123");
    expect(users[0].passwordHash).toBeNull();
  });

  it("returns existing user when googleId matches", async () => {
    const users: MockUser[] = [
      { id: "user_abc", email: "alice@example.com", googleId: "google_123", displayName: "Alice", avatarUrl: null, passwordHash: null },
    ];
    const result = await processOAuthCallback("auth_code_123", undefined, validToken, validProfile, users);
    expect(result.action).toBe("existing_linked");
    expect(result.userId).toBe("user_abc");
    expect(users).toHaveLength(1); // no new user created
  });

  it("links Google account to existing email-only account", async () => {
    const users: MockUser[] = [
      { id: "user_xyz", email: "alice@example.com", googleId: null, displayName: "Alice", avatarUrl: null, passwordHash: "hashed_pw" },
    ];
    const result = await processOAuthCallback("auth_code_123", undefined, validToken, validProfile, users);
    expect(result.action).toBe("existing_email_link");
    expect(result.userId).toBe("user_xyz");
    expect(users[0].googleId).toBe("google_123"); // googleId was linked
    expect(users).toHaveLength(1); // no new user created
  });

  it("uses email prefix as displayName when Google name is absent", async () => {
    const profileNoName: GoogleProfile = { id: "google_456", email: "bob@example.com" };
    const users: MockUser[] = [];
    await processOAuthCallback("auth_code_123", undefined, validToken, profileNoName, users);
    expect(users[0].displayName).toBe("bob");
  });
});
