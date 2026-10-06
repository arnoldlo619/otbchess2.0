import { ApiError, authFetch } from "@/lib/apiFetch";

export type PuzzleRelayDifficulty = "beginner" | "intermediate" | "advanced";

export interface PuzzleRelayPuzzle {
  id: string;
  difficulty: PuzzleRelayDifficulty;
  title: string;
  prompt: string;
  fen: string;
}

export interface PuzzleRelayTeamMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  orderIndex: number;
}

export interface PuzzleRelayTeam {
  id: string;
  teamNumber: number;
  name: string;
  score: number;
  currentPuzzleIndex: number;
  currentMemberIndex: number;
  completed: boolean;
  currentPuzzle: PuzzleRelayPuzzle | null;
  members: PuzzleRelayTeamMember[];
}

export interface PuzzleRelaySession {
  id: string;
  clubId: string;
  eventId: string;
  status: "active" | "completed";
  difficulty: PuzzleRelayDifficulty;
  puzzlesPerTeam: number;
  startedBy: string;
  startedAt: string;
  completedAt: string | null;
  teams: PuzzleRelayTeam[];
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Puzzle Relay request failed" })) as { error?: string };
    throw new ApiError({ message: body.error ?? "Puzzle Relay request failed", status: response.status });
  }
  return response.json() as Promise<T>;
}

export async function getPuzzleRelaySession(clubId: string, eventId: string): Promise<PuzzleRelaySession | null> {
  const response = await authFetch(`/api/clubs/${encodeURIComponent(clubId)}/events/${encodeURIComponent(eventId)}/puzzle-relay`);
  const body = await parseJson<{ session: PuzzleRelaySession | null }>(response);
  return body.session;
}

export async function startPuzzleRelaySession(clubId: string, eventId: string): Promise<PuzzleRelaySession> {
  const response = await authFetch(`/api/clubs/${encodeURIComponent(clubId)}/events/${encodeURIComponent(eventId)}/puzzle-relay/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await parseJson<{ session: PuzzleRelaySession }>(response);
  return body.session;
}

export async function submitPuzzleRelayAttempt(input: {
  clubId: string;
  eventId: string;
  teamId: string;
  from: string;
  to: string;
  promotion?: string;
}): Promise<{ correct: boolean; completed?: boolean; session: PuzzleRelaySession }> {
  const response = await authFetch(`/api/clubs/${encodeURIComponent(input.clubId)}/events/${encodeURIComponent(input.eventId)}/puzzle-relay/attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId: input.teamId, from: input.from, to: input.to, promotion: input.promotion }),
  });
  return parseJson<{ correct: boolean; completed?: boolean; session: PuzzleRelaySession }>(response);
}
