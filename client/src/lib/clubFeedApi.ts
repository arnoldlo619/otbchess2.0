import { authFetch } from "./apiFetch";

const BASE = "/api/clubs";

export type ClubFeedAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  url: string;
};

export type ClubFeedPost = {
  id: string;
  clubId: string;
  type: string;
  actorName: string;
  actorAvatarUrl?: string | null;
  detail?: string | null;
  isPinned: boolean;
  createdBy?: string | null;
  createdAt: string;
  attachments: ClubFeedAttachment[];
};

export type ClubFeedAttachmentInput = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
};

/** Mirrors the server policy for client affordances; server authorization remains authoritative. */
export function canCurrentUserDeleteClubFeedPost(currentUserId: string | null | undefined, clubOwnerId: string | null | undefined, createdBy: string | null | undefined) {
  return Boolean(currentUserId && (currentUserId === clubOwnerId || currentUserId === createdBy));
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return new Error(typeof body.error === "string" ? body.error : fallback);
}

export async function apiCreateClubFeedPost(
  clubId: string,
  input: {
    type: "announcement";
    actorName: string;
    actorAvatarUrl?: string | null;
    detail: string;
    attachments?: ClubFeedAttachmentInput[];
  }
): Promise<ClubFeedPost> {
  const response = await authFetch(`${BASE}/${clubId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response, "Failed to publish post");
  return response.json() as Promise<ClubFeedPost>;
}

export async function apiDeleteClubFeedPost(clubId: string, feedId: string): Promise<void> {
  const response = await authFetch(`${BASE}/${clubId}/feed/${feedId}`, { method: "DELETE" });
  if (!response.ok) throw await responseError(response, "Failed to delete post");
}
