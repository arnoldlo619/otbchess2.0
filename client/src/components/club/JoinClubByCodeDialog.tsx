import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Search, Users, X } from "lucide-react";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";
import {
  apiJoinClubByCode,
  apiPreviewClubCode,
  type ClubCodePreview,
} from "@/lib/clubsApi";
import type { Club } from "@/lib/clubRegistry";

const CLUB_CODE_PATTERN = /^OTB-[A-HJ-NP-Z2-9]{4}$/;

function normalizeClubCode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[\s_-]+/g, "");
  return compact.startsWith("OTB") && compact.length === 7
    ? `OTB-${compact.slice(3)}`
    : value.trim().toUpperCase();
}

function clubInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "C";
}

type JoinClubByCodeDialogProps = {
  open: boolean;
  onClose: () => void;
  onJoined: (club: Club, alreadyMember: boolean) => void;
  member: {
    displayName: string;
    chesscomUsername?: string | null;
    lichessUsername?: string | null;
    avatarUrl?: string | null;
  };
  isDark: boolean;
};

export function JoinClubByCodeDialog({
  open,
  onClose,
  onJoined,
  member,
  isDark,
}: JoinClubByCodeDialogProps) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<ClubCodePreview | null>(null);
  const [error, setError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeAndReset = () => {
    if (isLookingUp || isJoining) return;
    setCode("");
    setPreview(null);
    setError("");
    onClose();
  };

  useAccessibleOverlay({
    open,
    onClose: closeAndReset,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
  });

  if (!open) return null;

  const surface = isDark ? "border-white/10 bg-[#112017]" : "border-[#d7e3d5] bg-white";
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/62" : "text-[#526657]";
  const inputSurface = isDark ? "border-white/12 bg-black/15 text-white placeholder:text-white/35" : "border-[#cbdac8] bg-[#f8fbf7] text-[#15291c] placeholder:text-[#718173]";

  async function handleLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeClubCode(code);
    setCode(normalized);
    if (!CLUB_CODE_PATTERN.test(normalized)) {
      setError("Enter the Club Code exactly as it was shared with you, for example OTB-7K9M.");
      inputRef.current?.focus();
      return;
    }

    setError("");
    setIsLookingUp(true);
    const found = await apiPreviewClubCode(normalized);
    setIsLookingUp(false);
    if (!found) {
      setError("We couldn’t find that Club Code. Check with the organizer and try again.");
      inputRef.current?.focus();
      return;
    }
    setPreview(found);
  }

  async function handleJoin() {
    if (!preview) return;
    setError("");
    setIsJoining(true);
    const result = await apiJoinClubByCode(code, member);
    setIsJoining(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onJoined(result.club, result.alreadyMember);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close Join Club dialog"
        className="absolute inset-0 cursor-default bg-[#061008]/65 backdrop-blur-sm"
        onClick={closeAndReset}
        disabled={isLookingUp || isJoining}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-club-code-title"
        tabIndex={-1}
        className={`relative w-full max-w-md overflow-hidden rounded-t-[28px] border shadow-[0_24px_80px_rgba(3,16,8,0.38)] sm:rounded-[28px] ${surface}`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <div className="min-w-0">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#4CAF50]/14 text-[#65b968]">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 id="join-club-code-title" className={`text-xl font-bold tracking-tight ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {preview ? "Confirm your club" : "Join a club"}
            </h2>
            <p className={`mt-1 text-sm leading-6 ${textMuted}`}>
              {preview ? "Make sure this is the club your organizer invited you to." : "Enter the Club Code shared by your organizer."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeAndReset}
            disabled={isLookingUp || isJoining}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] disabled:cursor-not-allowed disabled:opacity-45 ${isDark ? "text-white/65 hover:bg-white/8 hover:text-white" : "text-[#526657] hover:bg-[#eff5ed] hover:text-[#15291c]"}`}
            aria-label="Close Join Club dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="border-t border-current/10 px-5 py-5 sm:px-6 sm:py-6">
          {!preview ? (
            <form onSubmit={handleLookup} noValidate>
              <label htmlFor="club-code" className={`block text-sm font-semibold ${textMain}`}>Club Code</label>
              <input
                ref={inputRef}
                id="club-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  if (error) setError("");
                }}
                onBlur={() => setCode((value) => normalizeClubCode(value))}
                placeholder="OTB-7K9M"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                aria-describedby="club-code-help club-code-error"
                aria-invalid={Boolean(error)}
                className={`mt-2 min-h-12 w-full rounded-xl border px-4 font-mono text-base font-semibold tracking-[0.12em] outline-none transition focus:border-[#58a85b] focus:ring-2 focus:ring-[#4CAF50]/25 ${inputSurface}`}
              />
              <p id="club-code-help" className={`mt-2 text-xs leading-5 ${textMuted}`}>Club Codes are used for private member invitations.</p>
              <p id="club-code-error" role="alert" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-[#c65d48]">{error}</p>
              <button
                type="submit"
                disabled={isLookingUp || code.trim().length === 0}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#426f45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#345c38] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLookingUp ? <><Search className="h-4 w-4 animate-pulse" aria-hidden="true" />Finding club…</> : <><Search className="h-4 w-4" aria-hidden="true" />Find club</>}
              </button>
            </form>
          ) : (
            <div>
              <div className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/[0.04]" : "border-[#dce8d9] bg-[#f7fbf6]"}`}>
                <div className="flex items-center gap-3">
                  {preview.avatarUrl ? (
                    <img src={preview.avatarUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ background: preview.accentColor }}>{clubInitial(preview.name)}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-base font-bold ${textMain}`}>{preview.name}</p>
                    <p className={`mt-1 inline-flex items-center gap-1.5 text-sm ${textMuted}`}><Users className="h-3.5 w-3.5" aria-hidden="true" />{preview.memberCount} member{preview.memberCount === 1 ? "" : "s"}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#4CAF50]" aria-label="Club Code verified" />
                </div>
              </div>
              <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-sm font-medium text-[#c65d48]">{error}</p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => { setPreview(null); setError(""); inputRef.current?.focus(); }}
                  disabled={isJoining}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? "border-white/12 text-white/75 hover:bg-white/8" : "border-[#cad9c7] text-[#29422c] hover:bg-[#f1f7ef]"}`}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />Use another code
                </button>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#426f45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#345c38] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isJoining ? "Joining…" : <>Join club<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
