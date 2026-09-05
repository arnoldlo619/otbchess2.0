export type PrepProvider = "chesscom" | "lichess";
export type PrepErrorCode = "INVALID_USERNAME" | "PLAYER_NOT_FOUND" | "UPSTREAM_RATE_LIMITED" | "UPSTREAM_TIMEOUT" | "UPSTREAM_UNAVAILABLE" | "NO_ELIGIBLE_GAMES" | "ALL_GAMES_FILTERED" | "REQUEST_CANCELLED" | "UNKNOWN";

export function derivePrepErrorCode(message: string | null | undefined): PrepErrorCode {
  const value = message?.toLowerCase() ?? "";
  if (value.includes("not found")) return "PLAYER_NOT_FOUND";
  if (value.includes("rate-limit")) return "UPSTREAM_RATE_LIMITED";
  if (value.includes("took too long") || value.includes("timeout")) return "UPSTREAM_TIMEOUT";
  if (value.includes("no eligible") || value.includes("no recent games")) return "NO_ELIGIBLE_GAMES";
  if (value.includes("filtered out")) return "ALL_GAMES_FILTERED";
  if (value.includes("cancelled")) return "REQUEST_CANCELLED";
  if (value.includes("temporarily unavailable") || value.includes("could not reach")) return "UPSTREAM_UNAVAILABLE";
  return "UNKNOWN";
}

export function describePrepError({ code, username, provider }: { code: PrepErrorCode; username: string; provider: PrepProvider }) {
  const providerName = provider === "lichess" ? "Lichess" : "Chess.com";
  const quotedUsername = username.trim() || "this username";

  if (code === "PLAYER_NOT_FOUND") {
    return {
      title: `We couldn’t find ${quotedUsername} on ${providerName}.`,
      detail: `ChessOTB verified that this exact ${providerName} username is unavailable. Check its spelling, or switch source if the account is on the other provider.`,
      reasons: ["Usernames are provider-specific and may differ from a display name.", "The account may have been renamed, closed, or belong to the other chess provider."],
      supportsRetry: false,
      supportsFilterControls: false,
    };
  }

  if (code === "UPSTREAM_RATE_LIMITED" || code === "UPSTREAM_TIMEOUT" || code === "UPSTREAM_UNAVAILABLE") {
    return {
      title: code === "UPSTREAM_RATE_LIMITED" ? `${providerName} is rate-limiting requests.` : `${providerName} is temporarily unavailable.`,
      detail: code === "UPSTREAM_TIMEOUT" ? `The provider did not respond in time. Retry when the service is responsive.` : `Your search was not lost. Retry to request the same provider again.`,
      reasons: ["This is a provider availability issue, not a finding about the player’s game history."],
      supportsRetry: true,
      supportsFilterControls: false,
    };
  }

  if (code === "NO_ELIGIBLE_GAMES" || code === "ALL_GAMES_FILTERED") {
    return {
      title: `We found ${quotedUsername}, but not enough eligible recent games.`,
      detail: "Only rated, recent games with usable move data are included in a Standard prep report.",
      reasons: ["The player may not have enough recent rated games in this format.", "Some games may be excluded because their move data is incomplete."],
      supportsRetry: true,
      supportsFilterControls: true,
    };
  }

  if (code === "REQUEST_CANCELLED") {
    return { title: "Scout request cancelled.", detail: "Start another scout whenever you are ready.", reasons: [], supportsRetry: false, supportsFilterControls: false };
  }

  return {
    title: "We couldn’t generate a prep report yet.",
    detail: "Please retry. If this continues, switch provider or verify the exact username.",
    reasons: ["The provider may be temporarily unavailable.", "The account may not have enough eligible recent games."],
    supportsRetry: true,
    supportsFilterControls: true,
  };
}
