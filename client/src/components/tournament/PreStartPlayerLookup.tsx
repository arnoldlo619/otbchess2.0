import { useCallback, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Search, UserPlus } from "lucide-react";
import type { Player } from "@/lib/tournamentData";
import { toProxiedAvatarUrl } from "@/hooks/useChessAvatar";
import {
  createChessComTournamentPlayer,
  lookupChessCom,
  type ChessComLookupResult,
} from "@/lib/playerLookup";

interface PreStartPlayerLookupProps {
  isDark: boolean;
  existingUsernames: string[];
  ratingType?: "rapid" | "blitz";
  onAdd: (player: Player) => void;
}

type LookupStatus = "idle" | "loading" | "found" | "error";

/**
 * The Director's fast, Round-0-only Chess.com path. Other intake modes stay in
 * the existing Add Player modal so manual, Lichess, and CSV registration remain available.
 */
export function PreStartPlayerLookup({
  isDark,
  existingUsernames,
  ratingType = "rapid",
  onAdd,
}: PreStartPlayerLookupProps) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [result, setResult] = useState<ChessComLookupResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const helperId = "prestart-player-lookup-helper";
  const errorId = "prestart-player-lookup-error";

  const resetLookup = useCallback(() => {
    setUsername("");
    setStatus("idle");
    setResult(null);
    setError("");
  }, []);

  const handleLookup = useCallback(async () => {
    const candidate = username.trim();
    if (!candidate) return;

    if (existingUsernames.some((existing) => existing.toLowerCase() === candidate.toLowerCase())) {
      setStatus("error");
      setResult(null);
      setError("This player is already registered.");
      return;
    }

    setStatus("loading");
    setResult(null);
    setError("");

    try {
      const player = await lookupChessCom(candidate);
      setResult(player);
      setStatus("found");
    } catch (lookupError) {
      setStatus("error");
      setError(lookupError instanceof Error ? lookupError.message : "Lookup failed. Check the username and try again.");
    }
  }, [existingUsernames, username]);

  const handleAdd = useCallback(() => {
    if (!result) return;
    onAdd(createChessComTournamentPlayer(result, ratingType));
    resetLookup();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [onAdd, ratingType, resetLookup, result]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "found") handleAdd();
    else void handleLookup();
  };

  return (
    <form
      data-director-prestart-player-lookup
      onSubmit={handleSubmit}
      className="flex-1 min-w-0 w-full sm:max-w-xl"
      aria-label="Add a player from Chess.com"
    >
      <label
        htmlFor="prestart-player-username"
        className={`mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] ${
          isDark ? "text-white/45" : "text-[#436850]"
        }`}
      >
        Add player
      </label>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              isDark ? "text-white/35" : "text-[#436850]"
            }`}
          />
          <input
            id="prestart-player-username"
            ref={inputRef}
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setStatus("idle");
              setResult(null);
              setError("");
            }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Chess.com username"
            aria-describedby={status === "error" ? `${helperId} ${errorId}` : helperId}
            aria-invalid={status === "error"}
            className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#4CAF50]/60 ${
              isDark
                ? "border-white/10 bg-white/06 text-white placeholder:text-white/30 focus:border-[#4CAF50]/55 focus:bg-white/08"
                : "border-[#ADBC9F] bg-[#FBFADA]/70 text-[#12372A] placeholder:text-[#436850]/60 focus:border-[#436850]/45 focus:bg-white"
            }`}
            style={{ minHeight: "44px", touchAction: "manipulation" }}
          />
        </div>
        <button
          type="submit"
          disabled={!username.trim() || status === "loading"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: "44px", background: "#436850", color: "#FFFFFF", touchAction: "manipulation" }}
        >
          {status === "loading" ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Looking up</>
          ) : status === "found" ? (
            <><UserPlus className="h-4 w-4" aria-hidden="true" /> Add player</>
          ) : (
            "Look up"
          )}
        </button>
      </div>
      <p id={helperId} className={`mt-1.5 text-xs ${isDark ? "text-white/35" : "text-[#436850]"}`}>
        Looks up a Chess.com profile and uses this tournament&apos;s {ratingType} pairing rating.
      </p>

      {status === "error" && (
        <p id={errorId} role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {status === "found" && result && (
        <div
          data-director-prestart-player-match
          className={`mt-2 flex min-h-11 items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
            isDark ? "border-[#4CAF50]/35 bg-[#4CAF50]/10" : "border-[#436850]/25 bg-[#436850]/08"
          }`}
          aria-live="polite"
        >
          {result.avatar ? (
            <img
              src={toProxiedAvatarUrl(result.avatar) ?? undefined}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#436850] text-sm font-bold text-white" aria-hidden="true">
              {(result.name || result.username)[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${isDark ? "text-white" : "text-[#12372A]"}`}>
              {result.title ? <span className="mr-1 text-amber-500">{result.title}</span> : null}
              {result.name || result.username}
            </p>
            <p className={`truncate text-xs ${isDark ? "text-white/50" : "text-[#436850]"}`}>@{result.username}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums">
            {result.rapid ? <span className={ratingType === "rapid" ? "text-[#6FCF7F]" : isDark ? "text-white/45" : "text-[#436850]"}>R {result.rapid}</span> : null}
            {result.blitz ? <span className={ratingType === "blitz" ? "text-[#6FCF7F]" : isDark ? "text-white/45" : "text-[#436850]"}>B {result.blitz}</span> : null}
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4CAF50]" aria-label="Player found" />
        </div>
      )}
    </form>
  );
}
