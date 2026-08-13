export type PrepProvider = "chesscom" | "lichess";
export type PrepErrorCode = "not_found" | "upstream_unavailable" | "no_recent_games" | "all_filtered" | "unknown";

export function derivePrepErrorCode(message: string | null | undefined): PrepErrorCode {
  const value = message?.toLowerCase() ?? "";
  if (value.includes("not found")) return "not_found";
  if (value.includes("temporarily unavailable") || value.includes("error 503") || value.includes("rate-limiting")) return "upstream_unavailable";
  if (value.includes("no rated") || value.includes("no recent games")) return "no_recent_games";
  if (value.includes("filtered out")) return "all_filtered";
  return "unknown";
}

export function describePrepError({ code, username, provider }: { code: PrepErrorCode; username: string; provider: PrepProvider }) {
  const providerName = provider === "lichess" ? "Lichess" : "Chess.com";
  const quotedUsername = username.trim() || "this username";

  if (code === "not_found") {
    return {
      title: `We couldn’t find ${quotedUsername} on ${providerName}.`,
      detail: `ChessOTB verified that this exact ${providerName} username is unavailable. Check its spelling, or switch source if the account is on the other provider.`,
      reasons: ["Usernames are provider-specific and may differ from a display name.", "The account may have been renamed, closed, or belong to the other chess provider."],
      supportsRetry: false,
      supportsFilterControls: false,
    };
  }

  if (code === "upstream_unavailable") {
    return {
      title: `${providerName} is temporarily unavailable.`,
      detail: `Your search was not lost. Please retry in a moment; ChessOTB will request the same provider again.`,
      reasons: ["The provider may be rate-limiting or temporarily unavailable.", "A fresh report will resume automatically when the provider responds."],
      supportsRetry: true,
      supportsFilterControls: false,
    };
  }

  if (code === "no_recent_games" || code === "all_filtered") {
    return {
      title: `We found ${quotedUsername}, but not enough eligible recent games.`,
      detail: "Try all formats or a deeper sample. Only rated, recent games with usable move data are included in a prep report.",
      reasons: ["The player may not have enough recent rated games in this format.", "Some games may be excluded because their move data is incomplete."],
      supportsRetry: true,
      supportsFilterControls: true,
    };
  }

  return {
    title: "We couldn’t generate a prep report yet.",
    detail: "Please retry. If this continues, switch provider or verify the exact username.",
    reasons: ["The provider may be temporarily unavailable.", "The account may not have enough eligible recent games."],
    supportsRetry: true,
    supportsFilterControls: true,
  };
}
