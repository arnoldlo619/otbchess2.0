import { authFetch } from "./apiFetch";

const BASE = "/api/clubs";

export interface ClubAlbumPhotoComment {
  id: string;
  photoId: string;
  authorUserId: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface ClubAlbumPhoto {
  id: string;
  albumId: string;
  url: string;
  caption: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt?: string;
  likeCount: number;
  likedByViewer: boolean;
  comments: ClubAlbumPhotoComment[];
}

export interface ClubAlbum {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  coverImageUrl: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  photos: ClubAlbumPhoto[];
}

export interface AlbumInput {
  title: string;
  description?: string;
  eventDate?: string;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return new Error(typeof body.error === "string" ? body.error : fallback);
}

export async function apiListClubAlbums(clubId: string): Promise<ClubAlbum[]> {
  const response = await authFetch(`${BASE}/${clubId}/albums`);
  if (!response.ok) throw await responseError(response, "Failed to load club albums");
  const body = await response.json() as { albums?: ClubAlbum[] };
  return body.albums ?? [];
}

export async function apiCreateClubAlbum(clubId: string, input: AlbumInput & { createdByName: string }): Promise<string> {
  const response = await authFetch(`${BASE}/${clubId}/albums`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response, "Failed to create album");
  const body = await response.json() as { id: string };
  return body.id;
}

export async function apiUpdateClubAlbum(clubId: string, albumId: string, input: AlbumInput): Promise<void> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response, "Failed to update album");
}

export async function apiUploadClubAlbumPhoto(clubId: string, albumId: string, input: {
  dataUrl: string;
  caption?: string;
  altText?: string;
  width: number;
  height: number;
}): Promise<ClubAlbumPhoto> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response, "Failed to upload photo");
  const body = await response.json() as { photo: ClubAlbumPhoto };
  return body.photo;
}

export async function apiDeleteClubAlbumPhoto(clubId: string, albumId: string, photoId: string): Promise<void> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}/photos/${photoId}`, { method: "DELETE" });
  if (!response.ok) throw await responseError(response, "Failed to remove photo");
}

export async function apiToggleClubAlbumPhotoLike(clubId: string, albumId: string, photoId: string): Promise<{ liked: boolean; likeCount: number }> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}/photos/${photoId}/like`, { method: "POST" });
  if (!response.ok) throw await responseError(response, "Failed to update photo reaction");
  return response.json() as Promise<{ liked: boolean; likeCount: number }>;
}

export async function apiCreateClubAlbumPhotoComment(clubId: string, albumId: string, photoId: string, body: string): Promise<ClubAlbumPhotoComment> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}/photos/${photoId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw await responseError(response, "Failed to add comment");
  const payload = await response.json() as { comment: ClubAlbumPhotoComment };
  return payload.comment;
}

export async function apiDeleteClubAlbumPhotoComment(clubId: string, albumId: string, photoId: string, commentId: string): Promise<void> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}/photos/${photoId}/comments/${commentId}`, { method: "DELETE" });
  if (!response.ok) throw await responseError(response, "Failed to remove comment");
}

export async function apiDeleteClubAlbum(clubId: string, albumId: string): Promise<void> {
  const response = await authFetch(`${BASE}/${clubId}/albums/${albumId}`, { method: "DELETE" });
  if (!response.ok) throw await responseError(response, "Failed to delete album");
}
