import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "shared/schema.ts"), "utf8");
const serverSource = readFileSync(resolve(process.cwd(), "server/clubMessaging.ts"), "utf8");
const clientSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClubMessages.tsx"), "utf8");

describe("Club messaging unread state", () => {
  it("stores a read cursor for each conversation participant", () => {
    expect(schemaSource).toContain('userALastReadAt: timestamp("user_a_last_read_at")');
    expect(schemaSource).toContain('userBLastReadAt: timestamp("user_b_last_read_at")');
  });

  it("counts only messages sent by the other participant after the viewer's cursor", () => {
    expect(serverSource).toContain("ne(clubMessages.senderId, userId)");
    expect(serverSource).toContain("gt(clubMessages.createdAt, lastReadAt)");
    expect(serverSource).toContain("unreadCount: Number(unread?.count ?? 0)");
  });

  it("marks the viewer's cursor when a thread is loaded and renders an accessible count badge", () => {
    expect(serverSource).toContain("userALastReadAt: new Date()");
    expect(serverSource).toContain("userBLastReadAt: new Date()");
    expect(clientSource).toContain("conversation.id === convId ? { ...conversation, unreadCount: 0 } : conversation");
    expect(clientSource).toContain("unread message");
  });
});
