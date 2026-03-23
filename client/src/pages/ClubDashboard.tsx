/**
 * ClubDashboard — /clubs/:id/home
 *
 * Member-only internal club home page, inspired by Partiful's event-first UI.
 * Layout:
 *   • Immersive full-bleed hero with club identity + gradient
 *   • Sticky tab nav: Events | Members | Feed
 *   • Events tab  — upcoming & past event cards with RSVP
 *   • Members tab — roster with avatars, ELO, roles
 *   • Feed tab    — chronological activity stream
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getClub,
  getClubBySlug,
  getClubMembers,
  isMember,
  seedClubsIfEmpty,
  seedDemoMembersToClub,
  type Club,
  type ClubMember,
} from "@/lib/clubRegistry";
import {
  listClubEvents,
  getEventRSVPs,
  getUserRSVP,
  countRSVPs,
  upsertRSVP,
  getEventComments,
  postComment,
  deleteComment,
  createClubEvent,
  updateClubEvent,
  deleteClubEvent,
  seedClubEventsIfEmpty,
  type ClubEvent,
  type ClubEventRSVP,
  type ClubEventComment,
  type RSVPStatus,
} from "@/lib/clubEventRegistry";
import {
  listBattles,
  createBattle,
  startBattle,
  recordBattleResult,
  deleteBattle,
  getBattleLeaderboard,
  getHeadToHeadRecords,
  loadPotmArchive,
  snapshotPotmWinner,
  seedDemoBattlesToClub,
  type ClubBattle,
  type BattleResult,
  type BattleLeaderboardEntry,
  type HeadToHeadRecord,
  type PotmArchiveEntry,
} from "@/lib/clubBattleRegistry";
import {
  apiBattleList,
  apiBattleCreate,
  apiBattleStart,
  apiBattleRecordResult,
  apiBattleDelete,
  apiBattleLeaderboard,
  apiBattleBulkImport,
  migrateLocalBattlesToServer,
} from "@/lib/clubBattleApi";
import {
  listFeedEvents,
  seedFeedIfEmpty,
  postAnnouncement,
  postPoll,
  postRsvpForm,
  castPollVote,
  upsertFeedRSVP,
  deleteFeedEvent,
  pinFeedEvent,
  unpinFeedEvent,
  checkAndCloseExpiredPolls,
  schedulePoll,
  publishScheduledPolls,
  listScheduledPolls,
  cancelScheduledPoll,
  postBattleResult,
  postLeaderboardSnapshot,
  type FeedEvent,
  type PollOption,
  type FeedRSVPEntry,
  type ScheduledPoll,
} from "@/lib/clubFeedRegistry";
import {
  Users,
  Trophy,
  Calendar,
  MapPin,
  ChevronLeft,
  Crown,
  Shield,
  CheckCircle2,
  Clock,
  Zap,
  Star,
  MessageSquare,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  Share2,
  ChevronDown,
  ChevronUp,
  Globe,
  X,
  Megaphone,
  PartyPopper,
  UserCheck,
  ArrowRight,
  Lock,
  MoreVertical,
  Pencil,
  AlertTriangle,
  BarChart2,
  ClipboardList,
  Award,
  CalendarClock,
  TrendingUp,
  DollarSign,
  CreditCard,
  PieChart,
  Activity,
  UserPlus,
  ThumbsUp,
  Wallet,
  CheckSquare,
  Swords,
  Medal,
  Flame,
  Mail,
  Link2,
  Copy,
  RefreshCw,
  Pin,
  PinOff,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatEventTime(startIso: string, endIso?: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return endIso ? `${fmt(startIso)} – ${fmt(endIso)}` : fmt(startIso);
}

function isUpcoming(event: ClubEvent): boolean {
  return new Date(event.startAt) > new Date();
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Pill RSVP button with animated state */
function RSVPButton({
  eventId,
  clubId,
  userId,
  displayName,
  avatarUrl,
  onChanged,
}: {
  eventId: string;
  clubId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  onChanged?: () => void;
}) {
  const [status, setStatus] = useState<RSVPStatus | null>(
    () => getUserRSVP(eventId, userId)?.status ?? null
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function choose(s: RSVPStatus) {
    upsertRSVP(eventId, clubId, userId, displayName, s, avatarUrl);
    setStatus(s);
    setOpen(false);
    onChanged?.();
    toast.success(
      s === "going" ? "You're going! 🎉" : s === "maybe" ? "Marked as maybe" : "Marked as not going"
    );
  }

  const label = status === "going" ? "Going" : status === "maybe" ? "Maybe" : status === "not_going" ? "Not Going" : "RSVP";
  const bgClass =
    status === "going"
      ? "bg-[#4CAF50] text-white"
      : status === "maybe"
      ? "bg-amber-500/90 text-white"
      : status === "not_going"
      ? "bg-white/10 text-white/60"
      : "bg-white/15 text-white hover:bg-white/25";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${bgClass}`}
      >
        {status === "going" && <CheckCircle2 className="w-3.5 h-3.5" />}
        {status === "maybe" && <Clock className="w-3.5 h-3.5" />}
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 min-w-[160px]"
          style={{ background: "oklch(0.16 0.04 240)" }}
        >
          {(["going", "maybe", "not_going"] as RSVPStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => choose(s)}
              className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors text-left ${
                status === s ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/08 hover:text-white"
              }`}
            >
              {s === "going" && <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" />}
              {s === "maybe" && <Clock className="w-4 h-4 text-amber-400" />}
              {s === "not_going" && <X className="w-4 h-4 text-white/40" />}
              {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Not Going"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stacked avatar row showing RSVP attendees */
function AttendeeAvatars({ rsvps, max = 7 }: { rsvps: ClubEventRSVP[]; max?: number }) {
  const going = rsvps.filter((r) => r.status === "going");
  const shown = going.slice(0, max);
  const extra = going.length - shown.length;
  if (!going.length) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((r) => (
          <div
            key={r.userId}
            className="w-7 h-7 rounded-full border-2 border-[oklch(0.13_0.06_240)] overflow-hidden flex-shrink-0"
            title={r.displayName}
          >
            <PlayerAvatar
              username={r.displayName}
              name={r.displayName}
              avatarUrl={r.avatarUrl ?? undefined}
              size={28}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {extra > 0 && (
          <div
            className="w-7 h-7 rounded-full border-2 border-[oklch(0.13_0.06_240)] flex items-center justify-center text-[10px] font-bold text-white/70 flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            +{extra}
          </div>
        )}
      </div>
      <span className="text-white/50 text-xs font-medium">{going.length} going</span>
    </div>
  );
}

/** Full event card — Partiful-style with cover art, date, RSVP */
function EventCard({
  event,
  userId,
  displayName,
  avatarUrl,
  isOwner,
  onDeleted,
  onEdited,
}: {
  event: ClubEvent;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  isOwner: boolean;
  onDeleted: () => void;
  onEdited: (updated: ClubEvent) => void;
}) {
  const [rsvps, setRsvps] = useState<ClubEventRSVP[]>(() => getEventRSVPs(event.id));
  const [comments, setComments] = useState<ClubEventComment[]>(() => getEventComments(event.id));
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const upcoming = isUpcoming(event);
  const counts = countRSVPs(event.id);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function refreshRSVPs() {
    setRsvps(getEventRSVPs(event.id));
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    postComment(event.id, event.clubId, userId, displayName, commentInput, avatarUrl);
    setComments(getEventComments(event.id));
    setCommentInput("");
  }

  function handleDeleteComment(commentId: string) {
    deleteComment(commentId);
    setComments(getEventComments(event.id));
  }

  const accent = event.accentColor ?? "#4CAF50";

  return (<>
    <div
      className="rounded-3xl overflow-hidden border border-white/08 transition-all hover:border-white/15"
      style={{ background: "oklch(0.15 0.05 240)" }}
    >
      {/* Cover image / gradient header */}
      <div
        className="relative h-48 sm:h-56 flex flex-col justify-end p-5"
        style={{
          background: event.coverImageUrl
            ? `url(${event.coverImageUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${accent}33 0%, ${accent}11 50%, oklch(0.10 0.06 240) 100%)`,
        }}
      >
        {/* Gradient overlay for readability */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, oklch(0.15 0.05 240) 0%, transparent 60%)" }}
        />

        {/* Past badge */}
        {!upcoming && (
          <div
            className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.55)" }}
          >
            Past Event
          </div>
        )}

        {/* Three-dot menu (owner only) */}
        {isOwner && (
          <div className="absolute top-4 right-4" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 hover:bg-white/20"
              style={{ background: "rgba(0,0,0,0.45)" }}
              aria-label="Event options"
            >
              <MoreVertical className="w-4 h-4 text-white/80" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 min-w-[160px]"
                style={{ background: "oklch(0.16 0.04 240)" }}
              >
                <button
                  onClick={() => { setMenuOpen(false); setShowEditModal(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/08 hover:text-white transition-colors text-left"
                >
                  <Pencil className="w-4 h-4 text-[#4CAF50]" />
                  Edit Event
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Event
                </button>
              </div>
            )}
          </div>
        )}

        {/* Date pill */}
        <div className="relative z-10 flex items-center gap-2 mb-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: accent + "33", color: accent, border: `1px solid ${accent}44` }}
          >
            <Calendar className="w-3 h-3" />
            {formatEventDate(event.startAt)}
          </div>
        </div>

        {/* Title */}
        <h3
          className="relative z-10 text-white font-black text-2xl sm:text-3xl leading-tight"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          {event.title}
        </h3>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Time + venue */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Clock className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
            <span>{formatEventTime(event.startAt, event.endAt)}</span>
          </div>
          {event.venue && (
            <div className="flex items-start gap-2 text-white/60 text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
              <div>
                <span className="text-white/80 font-medium">{event.venue}</span>
                {event.address && <p className="text-white/40 text-xs mt-0.5">{event.address}</p>}
              </div>
            </div>
          )}
          {event.parkingNote && (
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <span className="text-base">🚗</span>
              {event.parkingNote}
            </div>
          )}
          {event.admissionNote && (
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <span className="text-base">🎟️</span>
              {event.admissionNote}
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-white/55 text-sm leading-relaxed whitespace-pre-line line-clamp-3">
            {event.description}
          </p>
        )}

        {/* Attendee row + RSVP */}
        <div className="flex items-center justify-between pt-1">
          <AttendeeAvatars rsvps={rsvps} />
          {upcoming && (
            <RSVPButton
              eventId={event.id}
              clubId={event.clubId}
              userId={userId}
              displayName={displayName}
              avatarUrl={avatarUrl}
              onChanged={refreshRSVPs}
            />
          )}
          {!upcoming && (
            <div className="flex items-center gap-3 text-white/30 text-xs">
              <span>{counts.going} went</span>
            </div>
          )}
        </div>

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-2 text-white/40 text-xs font-medium hover:text-white/60 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? "s" : ""}` : "Add a comment"}
          {comments.length > 0 && (
            showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {/* Comments section */}
        {showComments && (
          <div className="space-y-3 pt-1">
            {/* Comment list */}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
                  <PlayerAvatar
                    username={c.displayName}
                    name={c.displayName}
                    avatarUrl={c.avatarUrl ?? undefined}
                    size={28}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white/80 text-xs font-bold">{c.displayName}</span>
                    <span className="text-white/30 text-[10px]">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-white/60 text-sm mt-0.5 break-words">{c.body}</p>
                </div>
                {c.userId === userId && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="flex-shrink-0 text-white/20 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Comment input */}
            <form onSubmit={submitComment} className="flex gap-2 items-center">
              <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
                <PlayerAvatar username={displayName} name={displayName} avatarUrl={avatarUrl ?? undefined} size={28} className="w-full h-full object-cover" />
              </div>
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment…"
                maxLength={500}
                className="flex-1 bg-white/07 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25 transition-colors"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                style={{ background: accent }}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>

    {/* Delete confirmation dialog */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
        <div
          className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4"
          style={{ background: "oklch(0.16 0.05 240)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-red-500/15">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Delete Event</h3>
              <p className="text-white/40 text-xs mt-0.5">This cannot be undone</p>
            </div>
          </div>
          <p className="text-white/60 text-sm">
            Are you sure you want to delete <span className="text-white font-semibold">"{event.title}"</span>? All RSVPs and comments will be permanently removed.
          </p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteClubEvent(event.id);
                setShowDeleteConfirm(false);
                toast.success("Event deleted");
                onDeleted();
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-95"
            >
              Delete Event
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Event modal */}
    {showEditModal && (
      <EditEventModal
        event={event}
        clubAccent={accent}
        onSaved={(updated) => {
          setShowEditModal(false);
          onEdited(updated);
          toast.success("Event updated!");
        }}
        onClose={() => setShowEditModal(false)}
      />
    )}
  </>);
}

/** Create Event modal */
const ACCENT_PRESETS = [
  "#4CAF50", "#2196F3", "#9C27B0", "#FF5722", "#FF9800", "#E91E63", "#00BCD4", "#795548",
];

function CreateEventModal({
  clubId,
  userId,
  displayName,
  clubAccent,
  onCreated,
  onClose,
}: {
  clubId: string;
  userId: string;
  displayName: string;
  clubAccent?: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("22:00");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [admissionNote, setAdmissionNote] = useState("Free for members");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [accentColor, setAccentColor] = useState(clubAccent ?? "#4CAF50");
  const [submitting, setSubmitting] = useState(false);
  // Casual event type
  type EvType = "standard" | "speed_dating" | "trivia_night" | "puzzle_relay";
  const [eventType, setEventType] = useState<EvType>("standard");
  const [sdRounds, setSdRounds] = useState(8);
  const [sdMinutes, setSdMinutes] = useState(10);
  const [triviaCategories, setTriviaCategories] = useState("Chess History, Openings, Endgames");
  const [triviaCount, setTriviaCount] = useState(20);
  const [relayTeams, setRelayTeams] = useState(4);
  const [relayDifficulty, setRelayDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");

  // Live preview of cover image
  const previewValid = coverImageUrl.startsWith("http");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSubmitting(true);
    const startAt = new Date(`${date}T${startTime}`).toISOString();
    const endAt = endTime ? new Date(`${date}T${endTime}`).toISOString() : undefined;
    createClubEvent({
      clubId,
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
      venue: venue.trim() || undefined,
      address: address.trim() || undefined,
      admissionNote: admissionNote.trim() || undefined,
      coverImageUrl: previewValid ? coverImageUrl.trim() : undefined,
      accentColor,
      creatorId: userId,
      creatorName: displayName,
      isPublished: true,
      eventType: eventType === "standard" ? undefined : eventType,
      ...(eventType === "speed_dating" ? { speedDatingRounds: sdRounds, speedDatingMinutes: sdMinutes } : {}),
      ...(eventType === "trivia_night" ? { triviaCategories: triviaCategories.split(",").map(s => s.trim()).filter(Boolean), triviaQuestionCount: triviaCount } : {}),
      ...(eventType === "puzzle_relay" ? { puzzleRelayTeams: relayTeams, puzzleRelayDifficulty: relayDifficulty } : {}),
    });
    setSubmitting(false);
    toast.success("Event created!");
    onCreated();
    onClose();
  }

  const inputCls = "w-full bg-white/07 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-[#4CAF50]/60 transition-colors";
  const labelCls = "block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "oklch(0.14 0.05 240)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/08"
          style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, transparent 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accentColor }}>
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Create Event</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/08 hover:bg-white/15 transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Cover image preview */}
          {previewValid && (
            <div className="relative w-full h-32 rounded-2xl overflow-hidden">
              <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-2 left-3 text-white/70 text-xs font-semibold">Cover Preview</span>
            </div>
          )}

          {/* Event Type Selector */}
          <div>
            <label className={labelCls}>Event Format</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "standard", label: "Standard Night", emoji: "♟️", desc: "Tournament / casual play" },
                { value: "speed_dating", label: "Speed Dating", emoji: "💘", desc: "Timed round-robin meetups" },
                { value: "trivia_night", label: "Trivia Night", emoji: "🧠", desc: "Chess knowledge quiz" },
                { value: "puzzle_relay", label: "Puzzle Relay", emoji: "🏁", desc: "Team puzzle race" },
              ] as const).map(({ value, label, emoji, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEventType(value)}
                  className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${
                    eventType === value
                      ? "border-[#4CAF50]/60 bg-[#4CAF50]/10 text-white"
                      : "border-white/10 bg-white/05 text-white/50 hover:border-white/20"
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5">{emoji}</span>
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Speed Dating options */}
          {eventType === "speed_dating" && (
            <div className="rounded-xl border border-white/10 bg-white/05 p-4 space-y-3">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Speed Dating Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Rounds</label>
                  <input type="number" min={2} max={20} value={sdRounds} onChange={e => setSdRounds(+e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Min / Round</label>
                  <input type="number" min={3} max={30} value={sdMinutes} onChange={e => setSdMinutes(+e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Trivia Night options */}
          {eventType === "trivia_night" && (
            <div className="rounded-xl border border-white/10 bg-white/05 p-4 space-y-3">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Trivia Settings</p>
              <div>
                <label className={labelCls}>Categories (comma-separated)</label>
                <input value={triviaCategories} onChange={e => setTriviaCategories(e.target.value)} placeholder="Chess History, Openings, Endgames" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Number of Questions</label>
                <input type="number" min={5} max={50} value={triviaCount} onChange={e => setTriviaCount(+e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Puzzle Relay options */}
          {eventType === "puzzle_relay" && (
            <div className="rounded-xl border border-white/10 bg-white/05 p-4 space-y-3">
              <p className="text-xs font-bold text-white/60 uppercase tracking-wider">Puzzle Relay Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Teams</label>
                  <input type="number" min={2} max={10} value={relayTeams} onChange={e => setRelayTeams(+e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Difficulty</label>
                  <select value={relayDifficulty} onChange={e => setRelayDifficulty(e.target.value as "beginner" | "intermediate" | "advanced")} className={inputCls}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className={labelCls}>Event Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thursday Night Blitz" required className={inputCls} />
          </div>

          {/* Date + Start + End */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={labelCls}>Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Venue + Address */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Venue</label>
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="The Chess Lounge" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Admission</label>
              <input value={admissionNote} onChange={(e) => setAdmissionNote(e.target.value)} placeholder="Free · $5 at door" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full street address" className={inputCls} />
          </div>

          {/* Cover image URL */}
          <div>
            <label className={labelCls}>Cover Image URL</label>
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://… (paste an image link)"
              className={inputCls}
            />
          </div>

          {/* Accent color */}
          <div>
            <label className={labelCls}>Event Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c,
                    outline: accentColor === c ? `3px solid ${c}` : "none",
                    outlineOffset: "2px",
                    transform: accentColor === c ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
                title="Custom color"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell members what to expect…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim() || !date}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-98 disabled:opacity-50"
            style={{ background: accentColor }}
          >
            {submitting ? "Creating…" : "Publish Event"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Edit Event modal — pre-fills all fields from existing event */
function EditEventModal({
  event,
  clubAccent,
  onSaved,
  onClose,
}: {
  event: ClubEvent;
  clubAccent?: string;
  onSaved: (updated: ClubEvent) => void;
  onClose: () => void;
}) {
  const initDate = event.startAt ? new Date(event.startAt).toISOString().slice(0, 10) : "";
  const initStart = event.startAt ? new Date(event.startAt).toTimeString().slice(0, 5) : "19:00";
  const initEnd = event.endAt ? new Date(event.endAt).toTimeString().slice(0, 5) : "";

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [date, setDate] = useState(initDate);
  const [startTime, setStartTime] = useState(initStart);
  const [endTime, setEndTime] = useState(initEnd);
  const [venue, setVenue] = useState(event.venue ?? "");
  const [address, setAddress] = useState(event.address ?? "");
  const [admissionNote, setAdmissionNote] = useState(event.admissionNote ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(event.coverImageUrl ?? "");
  const [accentColor, setAccentColor] = useState(event.accentColor ?? clubAccent ?? "#4CAF50");
  const [submitting, setSubmitting] = useState(false);

  const previewValid = coverImageUrl.startsWith("http");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSubmitting(true);
    const startAt = new Date(`${date}T${startTime}`).toISOString();
    const endAt = endTime ? new Date(`${date}T${endTime}`).toISOString() : undefined;
    const updated = updateClubEvent(event.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
      venue: venue.trim() || undefined,
      address: address.trim() || undefined,
      admissionNote: admissionNote.trim() || undefined,
      coverImageUrl: previewValid ? coverImageUrl.trim() : undefined,
      accentColor,
    });
    setSubmitting(false);
    if (updated) onSaved(updated);
    onClose();
  }

  const inputCls = "w-full bg-white/07 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-[#4CAF50]/60 transition-colors";
  const labelCls = "block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "oklch(0.14 0.05 240)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/08"
          style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, transparent 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accentColor }}>
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-white font-bold text-lg">Edit Event</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/08 hover:bg-white/15 transition-colors">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {previewValid && (
            <div className="relative w-full h-32 rounded-2xl overflow-hidden">
              <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-2 left-3 text-white/70 text-xs font-semibold">Cover Preview</span>
            </div>
          )}

          <div>
            <label className={labelCls}>Event Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thursday Night Blitz" required className={inputCls} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={labelCls}>Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Venue</label>
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="The Chess Lounge" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Admission</label>
              <input value={admissionNote} onChange={(e) => setAdmissionNote(e.target.value)} placeholder="Free · $5 at door" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full street address" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Cover Image URL</label>
            <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://…" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Event Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c,
                    outline: accentColor === c ? `3px solid ${c}` : "none",
                    outlineOffset: "2px",
                    transform: accentColor === c ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent" title="Custom color" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell members what to expect…" rows={3} className={`${inputCls} resize-none`} />
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim() || !date}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-98 disabled:opacity-50"
            style={{ background: accentColor }}
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Feed event icon ───────────────────────────────────────────────────────────

// ── FeedCard (rich interactive card for poll / rsvp_form / announcement) ──────

function FeedCard({
  event,
  accent,
  userId,
  displayName,
  avatarUrl,
  clubId,
  canDelete,
  canPin,
  onDelete,
  onPin,
  onUnpin,
  onVoted,
  onRsvped,
}: {
  event: FeedEvent;
  accent: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  clubId: string;
  canDelete: boolean;
  canPin: boolean;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onVoted: () => void;
  onRsvped: () => void;
}) {
  const isPoll = event.type === "poll";
  const isRsvp = event.type === "rsvp_form";
  const isPollResult = event.type === "poll_result";
  const pollExpired = isPoll && event.pollExpiresAt ? new Date(event.pollExpiresAt) < new Date() : false;
  const totalPollVotes = (event.pollOptions ?? []).reduce((s, o) => s + Object.keys(o.votes).length, 0);
  const userVotedOptions = (event.pollOptions ?? []).filter((o) => o.votes[userId]).map((o) => o.id);
  const userRsvp = (event.rsvpEntries ?? []).find((r) => r.userId === userId);

  function handleVote(optionId: string) {
    if (pollExpired || !userId) return;
    castPollVote(clubId, event.id, optionId, userId, event.pollMultiple ?? false);
    onVoted();
  }

  function handleRsvp(status: FeedRSVPEntry["status"]) {
    if (!userId) return;
    upsertFeedRSVP(clubId, event.id, userId, displayName, status, avatarUrl ?? null);
    onRsvped();
  }

  return (
    <div
      className={`rounded-2xl border overflow-hidden group transition-all ${
        event.isPinned
          ? "border-amber-500/30 shadow-[0_0_0_1px_oklch(0.78_0.15_80_/_0.15)]"
          : "border-white/08"
      }`}
      style={{ background: event.isPinned ? "oklch(0.17 0.06 80 / 0.4)" : "oklch(0.16 0.05 145)" }}
    >
      {/* Pinned banner strip */}
      {event.isPinned && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-amber-500/20" style={{ background: "oklch(0.22 0.08 80 / 0.5)" }}>
          <Pin className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">Pinned Post</span>
        </div>
      )}
      <div className="flex items-start gap-3 p-4 pb-3">
        <FeedIcon type={event.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-white/80 text-sm font-semibold">{event.actorName}</span>
            <span className="text-white/40 text-xs">{timeAgo(event.createdAt)}</span>
          </div>
          <p className="text-white/50 text-xs mt-0.5">{event.description}</p>
        </div>
        {/* Director action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canPin && (
            <button
              onClick={() => event.isPinned ? onUnpin(event.id) : onPin(event.id)}
              title={event.isPinned ? "Unpin post" : "Pin to top"}
              className={`p-1.5 rounded-lg transition-colors ${
                event.isPinned
                  ? "text-amber-400 hover:bg-amber-500/10"
                  : "text-white/20 hover:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              {event.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
              title="Delete post"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {!isPoll && !isRsvp && event.detail && (
        <div className="px-4 pb-4">
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{event.detail}</p>
          {event.linkHref && (
            <a href={event.linkHref} className="inline-flex items-center gap-1 text-xs font-semibold mt-2 transition-colors hover:opacity-80" style={{ color: accent }}>
              {event.linkLabel ?? "View"} <ArrowRight className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      {isPoll && event.pollOptions && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-white font-semibold text-sm">{event.pollQuestion}</p>
          <div className="space-y-2">
            {event.pollOptions.map((opt) => {
              const voteCount = Object.keys(opt.votes).length;
              const pct = totalPollVotes > 0 ? Math.round((voteCount / totalPollVotes) * 100) : 0;
              const voted = userVotedOptions.includes(opt.id);
              const showResults = pollExpired || userVotedOptions.length > 0;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleVote(opt.id)}
                  disabled={pollExpired}
                  className={`w-full text-left rounded-xl overflow-hidden border transition-all relative ${voted ? "border-[#4CAF50]/50" : "border-white/10 hover:border-white/25"} ${pollExpired ? "cursor-default" : "cursor-pointer"}`}
                >
                  {showResults && (
                    <div className="absolute inset-0 rounded-xl transition-all duration-500" style={{ width: `${pct}%`, background: voted ? "oklch(0.44 0.12 145 / 0.25)" : "rgba(255,255,255,0.05)" }} />
                  )}
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${voted ? "border-[#4CAF50] bg-[#4CAF50]" : "border-white/30"}`}>
                        {voted && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${voted ? "text-white" : "text-white/70"}`}>{opt.text}</span>
                    </div>
                    {showResults && <span className="text-xs text-white/40 font-semibold">{pct}%</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-white/30">
            <span>{totalPollVotes} vote{totalPollVotes !== 1 ? "s" : ""}</span>
            {event.pollExpiresAt && (
              <span className={pollExpired ? "text-red-400/60" : ""}>{pollExpired ? "Closed" : `Closes ${timeAgo(event.pollExpiresAt)}`}</span>
            )}
          </div>
        </div>
      )}
      {isPollResult && event.pollResultBreakdown && (
        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-xl p-3 border border-amber-500/20" style={{ background: "oklch(0.18 0.06 80 / 0.25)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-sm font-bold text-amber-300">
                {event.pollResultTotalVotes === 0 ? "No votes cast" : `Winner: ${event.pollResultWinner}`}
              </span>
            </div>
            <p className="text-xs text-white/50 font-medium mb-2 truncate">{event.description.replace("Poll closed: ", "").replace(/^"|"$/g, "")}</p>
            <div className="space-y-1.5">
              {event.pollResultBreakdown.map((opt, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden">
                  <div
                    className="absolute inset-0 rounded-lg transition-all"
                    style={{
                      width: `${opt.pct}%`,
                      background: i === 0 && opt.votes > 0 ? "oklch(0.55 0.15 80 / 0.30)" : "rgba(255,255,255,0.05)",
                    }}
                  />
                  <div className="relative flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {i === 0 && opt.votes > 0 && <Award className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      <span className={`text-xs font-medium ${i === 0 && opt.votes > 0 ? "text-amber-200" : "text-white/50"}`}>{opt.text}</span>
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${i === 0 && opt.votes > 0 ? "text-amber-300" : "text-white/30"}`}>
                      {opt.votes} vote{opt.votes !== 1 ? "s" : ""} &middot; {opt.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">{event.pollResultTotalVotes} total vote{event.pollResultTotalVotes !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}
      {isRsvp && (
        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-xl p-3 border border-white/08" style={{ background: "oklch(0.20 0.06 145)" }}>
            <p className="text-white font-semibold text-sm">{event.rsvpTitle}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {event.rsvpDate && (
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <Calendar className="w-3 h-3" />
                  {new Date(event.rsvpDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
              )}
              {event.rsvpVenue && (
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <MapPin className="w-3 h-3" />
                  {event.rsvpVenue}
                </span>
              )}
            </div>
          </div>
          {userId && (
            <div className="flex gap-2">
              {(["going", "maybe", "not_going"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleRsvp(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${userRsvp?.status === s ? s === "going" ? "bg-[#4CAF50] text-white" : s === "maybe" ? "bg-amber-500 text-white" : "bg-white/15 text-white/60" : "bg-white/07 text-white/50 hover:bg-white/12 hover:text-white"}`}
                >
                  {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go"}
                </button>
              ))}
            </div>
          )}
          {(event.rsvpEntries ?? []).length > 0 && (
            <div className="space-y-1">
              {["going", "maybe", "not_going"].map((s) => {
                const group = (event.rsvpEntries ?? []).filter((r) => r.status === s);
                if (!group.length) return null;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold w-16 ${s === "going" ? "text-[#4CAF50]" : s === "maybe" ? "text-amber-400" : "text-white/30"}`}>
                      {s === "going" ? "Going" : s === "maybe" ? "Maybe" : "Can't Go"} ({group.length})
                    </span>
                    <div className="flex -space-x-1.5">
                      {group.slice(0, 5).map((r) => (
                        <div key={r.userId} className="w-6 h-6 rounded-full border border-white/10 overflow-hidden" title={r.displayName}>
                          <PlayerAvatar username={r.displayName} name={r.displayName} avatarUrl={r.avatarUrl ?? undefined} size={24} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {group.length > 5 && (
                        <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center text-[9px] font-bold text-white/50" style={{ background: "rgba(255,255,255,0.08)" }}>
                          +{group.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {event.type === "leaderboard_snapshot" && event.leaderboardEntries && event.leaderboardEntries.length > 0 && (
        <div className="px-4 pb-4">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "oklch(0.14 0.05 80)", border: "1px solid oklch(0.30 0.08 80 / 0.5)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b"
              style={{ background: "oklch(0.20 0.06 80 / 0.5)", borderColor: "oklch(0.30 0.08 80 / 0.4)" }}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold tracking-widest uppercase text-amber-400">Leaderboard</span>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "oklch(0.28 0.07 80 / 0.4)", color: "#d4a96a" }}
              >
                After {event.leaderboardBattleCount} battles
              </span>
            </div>
            {/* Podium rows */}
            <div className="divide-y" style={{ borderColor: "oklch(0.22 0.05 80 / 0.3)" }}>
              {event.leaderboardEntries.map((entry) => {
                const medalColour =
                  entry.rank === 1 ? { bg: "oklch(0.35 0.10 80 / 0.25)", border: "#d4a96a", text: "#d4a96a", medal: "🥇" }
                  : entry.rank === 2 ? { bg: "oklch(0.28 0.05 220 / 0.20)", border: "#94a3b8", text: "#94a3b8", medal: "🥈" }
                  : { bg: "oklch(0.25 0.06 40 / 0.20)", border: "#b87333", text: "#b87333", medal: "🥉" };
                return (
                  <div
                    key={entry.playerId}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ background: medalColour.bg }}
                  >
                    {/* Rank badge */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ border: `2px solid ${medalColour.border}`, color: medalColour.text, background: "oklch(0.18 0.04 80 / 0.4)" }}
                    >
                      {entry.rank}
                    </div>
                    {/* Player name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white/90 truncate">{entry.playerName}</span>
                        {entry.rank === 1 && <span className="text-xs">{medalColour.medal}</span>}
                      </div>
                      <div className="text-[10px] text-white/35 font-mono">
                        {entry.wins}W · {entry.draws}D · {entry.losses}L
                      </div>
                    </div>
                    {/* Win rate */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: medalColour.text }}>{entry.winRate}%</span>
                      <span className="text-[10px] text-white/30">win rate</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {event.type === "battle_result" && event.battlePlayerA && event.battlePlayerB && (
        <div className="px-4 pb-4">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "oklch(0.14 0.04 145)", border: "1px solid oklch(0.28 0.06 145 / 0.5)" }}
          >
            {/* Result badge header */}
            <div
              className="flex items-center justify-center gap-2 py-2 border-b"
              style={{
                background: event.battleOutcome === "draw"
                  ? "oklch(0.22 0.04 80 / 0.4)"
                  : "oklch(0.22 0.08 145 / 0.4)",
                borderColor: "oklch(0.28 0.06 145 / 0.4)",
              }}
            >
              <Swords className="w-3.5 h-3.5 text-orange-400" />
              <span
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: event.battleOutcome === "draw" ? "#d4a96a" : "#4CAF50" }}
              >
                {event.battleOutcome === "draw" ? "Draw" : "Victory"}
              </span>
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: event.battleOutcome === "draw" ? "oklch(0.30 0.06 80 / 0.4)" : "oklch(0.30 0.10 145 / 0.4)",
                  color: event.battleOutcome === "draw" ? "#d4a96a" : "#81C784",
                }}
              >
                {event.detail}
              </span>
            </div>
            {/* Players row */}
            <div className="flex items-center px-4 py-3 gap-3">
              {/* Player A */}
              <div className={`flex-1 flex flex-col items-center gap-1 ${
                event.battleOutcome === "player_a" ? "opacity-100" : event.battleOutcome === "draw" ? "opacity-80" : "opacity-40"
              }`}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: event.battleOutcome === "player_a" ? "oklch(0.40 0.12 145 / 0.4)" : "oklch(0.22 0.04 145 / 0.4)",
                    border: event.battleOutcome === "player_a" ? "2px solid #4CAF50" : "2px solid oklch(0.30 0.05 145 / 0.5)",
                    color: event.battleOutcome === "player_a" ? "#81C784" : "#ffffff80",
                  }}
                >
                  {event.battlePlayerA.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-white/80 text-center truncate max-w-[80px]">{event.battlePlayerA}</span>
                {event.battlePlayerAElo && (
                  <span className="text-[10px] text-white/35 font-mono">{event.battlePlayerAElo}</span>
                )}
                {event.battleOutcome === "player_a" && (
                  <span className="text-[10px] font-bold text-[#4CAF50] flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" /> Winner</span>
                )}
              </div>
              {/* VS divider */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <span className="text-white/20 text-xs font-bold">VS</span>
              </div>
              {/* Player B */}
              <div className={`flex-1 flex flex-col items-center gap-1 ${
                event.battleOutcome === "player_b" ? "opacity-100" : event.battleOutcome === "draw" ? "opacity-80" : "opacity-40"
              }`}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: event.battleOutcome === "player_b" ? "oklch(0.40 0.12 145 / 0.4)" : "oklch(0.22 0.04 145 / 0.4)",
                    border: event.battleOutcome === "player_b" ? "2px solid #4CAF50" : "2px solid oklch(0.30 0.05 145 / 0.5)",
                    color: event.battleOutcome === "player_b" ? "#81C784" : "#ffffff80",
                  }}
                >
                  {event.battlePlayerB.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-white/80 text-center truncate max-w-[80px]">{event.battlePlayerB}</span>
                {event.battlePlayerBElo && (
                  <span className="text-[10px] text-white/35 font-mono">{event.battlePlayerBElo}</span>
                )}
                {event.battleOutcome === "player_b" && (
                  <span className="text-[10px] font-bold text-[#4CAF50] flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" /> Winner</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedIcon({ type }: { type: FeedEvent["type"] }) {
  const map: Record<FeedEvent["type"], React.ReactNode> = {
    member_join:           <UserCheck className="w-4 h-4 text-[#4CAF50]" />,
    member_leave:          <X className="w-4 h-4 text-red-400" />,
    tournament_created:    <Trophy className="w-4 h-4 text-amber-400" />,
    tournament_completed:  <Star className="w-4 h-4 text-amber-400" />,
    announcement:          <Megaphone className="w-4 h-4 text-blue-400" />,
    club_founded:          <PartyPopper className="w-4 h-4 text-purple-400" />,
    poll:                  <BarChart2 className="w-4 h-4 text-[#4CAF50]" />,
    rsvp_form:             <ClipboardList className="w-4 h-4 text-blue-400" />,
    poll_result:           <Award className="w-4 h-4 text-amber-400" />,
    battle_result:         <Swords className="w-4 h-4 text-orange-400" />,
    leaderboard_snapshot:  <Trophy className="w-4 h-4 text-amber-400" />,
  };
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.07)" }}
    >
      {map[type]}
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: ClubMember["role"] }) {
  if (role === "owner")
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">
        <Crown className="w-2.5 h-2.5" /> Owner
      </span>
    );
  if (role === "director")
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
        <Shield className="w-2.5 h-2.5" /> Director
      </span>
    );
  return null;
}

// ── Player of the Month ─────────────────────────────────────────────────────

interface PotmEntry {
  memberId: string;
  memberName: string;
  avatarUrl?: string | null;
  battleWins: number;
  winRate: number;
  eventsAttended: number;
  score: number;
}

function computePlayerOfMonth(
  members: ClubMember[],
  battles: ClubBattle[],
  events: ClubEvent[]
): PotmEntry[] {
  const now = Date.now();
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const cutoff = now - windowMs;

  // Battles completed in the last 30 days
  const recentBattles = battles.filter(
    (b) => b.status === "completed" && b.completedAt && new Date(b.completedAt).getTime() >= cutoff
  );

  // Past events in the last 30 days
  const recentEvents = events.filter(
    (e) => e.startAt && new Date(e.startAt).getTime() >= cutoff && new Date(e.startAt).getTime() <= now
  );

  return members
    .map((m) => {
      const myBattles = recentBattles.filter(
        (b) => b.playerAId === m.userId || b.playerBId === m.userId
      );
      const wins = myBattles.filter(
        (b) =>
          (b.result === "player_a" && b.playerAId === m.userId) ||
          (b.result === "player_b" && b.playerBId === m.userId)
      ).length;
      const winRate = myBattles.length > 0 ? Math.round((wins / myBattles.length) * 100) : 0;

      // Count events where this member RSVPed "going" (we approximate via localStorage)
      const eventsAttended = recentEvents.filter((ev) => {
        try {
          const raw = localStorage.getItem("otb-club-rsvps-v1");
          if (!raw) return false;
          const rsvps = JSON.parse(raw) as Array<{ eventId: string; userId: string; status: string }>;
          return rsvps.some((r) => r.eventId === ev.id && r.userId === m.userId && r.status === "going");
        } catch { return false; }
      }).length;

      // Scoring: battle wins × 3 + win rate × 0.5 + events attended × 2
      const score = wins * 3 + winRate * 0.5 + eventsAttended * 2;

      return {
        memberId: m.userId,
        memberName: m.displayName,
        avatarUrl: m.avatarUrl,
        battleWins: wins,
        winRate,
        eventsAttended,
        score,
      } satisfies PotmEntry;
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
}

function PlayerOfMonthWidget({
  clubId,
  members,
  battles,
  events,
  isDark,
}: {
  clubId: string;
  members: ClubMember[];
  battles: ClubBattle[];
  events: ClubEvent[];
  isDark: boolean;
}) {
  const ranked = computePlayerOfMonth(members, battles, events);
  const [archive, setArchive] = useState<PotmArchiveEntry[]>(() => loadPotmArchive(clubId));
  const [showAllArchive, setShowAllArchive] = useState(false);

  // Auto-snapshot: when we have a winner, store them for the PREVIOUS completed month
  // (we snapshot at the start of a new month for the month just passed).
  useEffect(() => {
    if (!clubId || ranked.length === 0) return;
    const now = new Date();
    // Snapshot the previous calendar month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    // Only snapshot if we're past the 1st of the current month (i.e., a new month has started)
    if (now.getDate() >= 1) {
      const top = ranked[0];
      const updated = snapshotPotmWinner(clubId, prevKey, {
        memberId: top.memberId,
        memberName: top.memberName,
        avatarUrl: top.avatarUrl ?? undefined,
        battleWins: top.battleWins,
        winRate: top.winRate,
        eventsAttended: top.eventsAttended,
        score: top.score,
      });
      if (updated.length !== archive.length) setArchive(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, ranked.length]);

  if (ranked.length === 0 && archive.length === 0) return null;

  const [top, second, third] = ranked;
  const podium = [second, third].filter(Boolean) as PotmEntry[];

  const card = isDark ? "bg-white/4 border-white/10" : "bg-white border-gray-200";
  const textMuted = isDark ? "text-white/40" : "text-gray-400";

  // Initials fallback
  function initials(name: string) {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }

  // Month label formatter
  function monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  return (
    <div className={`rounded-3xl border ${card} overflow-hidden`}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
        <Crown className="w-4 h-4 text-amber-400" />
        <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/50" : "text-gray-500"}`}>
          Player of the Month
        </span>
        <span className={`ml-auto text-[10px] ${textMuted}`}>Rolling 30 days</span>
      </div>

      {/* Spotlight — #1 */}
      <div
        className="relative px-5 py-6 flex items-center gap-4"
        style={{
          background: isDark
            ? "linear-gradient(135deg, oklch(0.22 0.08 145 / 0.9) 0%, oklch(0.18 0.06 145 / 0.6) 100%)"
            : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
        }}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-amber-400/60 flex items-center justify-center bg-amber-500/20">
            {top.avatarUrl ? (
              <img src={top.avatarUrl} alt={top.memberName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-black text-amber-400">{initials(top.memberName)}</span>
            )}
          </div>
          {/* Crown badge */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-lg">
            <Crown className="w-3.5 h-3.5 text-amber-900" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-lg font-black truncate ${isDark ? "text-white" : "text-gray-900"}`}>{top.memberName}</p>
          <p className="text-xs text-amber-400 font-bold mb-2">#1 This Month</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <Swords className="w-3 h-3" />
              {top.battleWins}W · {top.winRate}% win rate
            </span>
            {top.eventsAttended > 0 && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold ${textMuted}`}>
                <Calendar className="w-3 h-3" />
                {top.eventsAttended} event{top.eventsAttended !== 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
              <Star className="w-3 h-3" />
              {top.score.toFixed(0)} pts
            </span>
          </div>
        </div>
      </div>

      {/* Podium — #2 and #3 */}
      {podium.length > 0 && (
        <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
          {podium.map((entry, i) => (
            <div key={entry.memberId} className="flex items-center gap-3 px-5 py-3">
              <span className={`text-xs font-black w-4 text-center ${i === 0 ? "text-slate-400" : "text-orange-400/70"}`}>
                #{i + 2}
              </span>
              <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-white/8 flex-shrink-0">
                {entry.avatarUrl ? (
                  <img src={entry.avatarUrl} alt={entry.memberName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black text-white/50">{initials(entry.memberName)}</span>
                )}
              </div>
              <span className={`flex-1 text-sm font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                {entry.memberName}
              </span>
              <span className="text-[11px] text-emerald-400 font-bold">{entry.battleWins}W</span>
              <span className={`text-[11px] ${textMuted} ml-2`}>{entry.score.toFixed(0)} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Past Winners Hall of Fame */}
      {archive.length > 0 && (
        <div className={`border-t ${isDark ? "border-white/8" : "border-gray-100"}`}>
          {/* Section header */}
          <div className="px-5 py-3 flex items-center gap-2">
            <Medal className="w-3.5 h-3.5 text-amber-400/70" />
            <span className={`text-[11px] font-bold uppercase tracking-widest ${textMuted}`}>Past Winners</span>
          </div>
          {/* Archive rows */}
          <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
            {(showAllArchive ? archive : archive.slice(0, 3)).map((entry) => (
              <div key={entry.monthKey} className="flex items-center gap-3 px-5 py-2.5">
                {/* Month label */}
                <span className={`text-[10px] font-bold w-20 shrink-0 ${textMuted}`}>
                  {monthLabel(entry.monthKey)}
                </span>
                {/* Avatar */}
                <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center bg-amber-500/15 flex-shrink-0">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.memberName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-black text-amber-400">{initials(entry.memberName)}</span>
                  )}
                </div>
                {/* Name */}
                <span className={`flex-1 text-xs font-semibold truncate ${isDark ? "text-white/80" : "text-gray-800"}`}>
                  {entry.memberName}
                </span>
                {/* Score */}
                <span className={`text-[10px] font-bold ${textMuted}`}>
                  {entry.score.toFixed(0)} pts
                </span>
                {/* Crown */}
                <Crown className="w-3 h-3 text-amber-400/60 flex-shrink-0" />
              </div>
            ))}
          </div>
          {/* Show all / collapse toggle */}
          {archive.length > 3 && (
            <button
              onClick={() => setShowAllArchive((v) => !v)}
              className={`w-full py-2.5 text-[11px] font-semibold ${textMuted} hover:text-white/70 transition-colors flex items-center justify-center gap-1`}
            >
              {showAllArchive ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Show all {archive.length} winners</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className ?? ""}`}
      style={{ background: "oklch(0.26 0.05 145 / 0.7)" }}
    />
  );
}

function ClubDashboardSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "oklch(0.20 0.06 145)" }}>
      {/* Nav bar */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/08"
        style={{ background: "oklch(0.20 0.06 145 / 0.92)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-16 h-4" />
          <div className="w-px h-4 bg-white/10" />
          <SkeletonBlock className="w-10 h-5" />
        </div>
        <SkeletonBlock className="w-24 h-5" />
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: "280px" }}>
        <div className="absolute inset-0" style={{ background: "oklch(0.20 0.06 145)" }} />
        <div className="absolute inset-0 chess-board-bg opacity-20 pointer-events-none" />
        <div className="relative z-10 px-5 sm:px-8 pt-10 pb-8 max-w-4xl mx-auto">
          {/* Avatar + identity */}
          <div className="flex items-end gap-5 mb-6">
            <SkeletonBlock className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex-shrink-0" />
            <div className="flex-1 min-w-0 pb-1 space-y-2">
              <SkeletonBlock className="w-20 h-4" />
              <SkeletonBlock className="w-56 h-8" />
              <SkeletonBlock className="w-40 h-4" />
            </div>
          </div>
          {/* Stats row */}
          <div className="flex items-center gap-5 flex-wrap">
            <SkeletonBlock className="w-24 h-4" />
            <SkeletonBlock className="w-28 h-4" />
            <SkeletonBlock className="w-20 h-4" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="sticky top-[57px] z-30 border-b border-white/08"
        style={{ background: "oklch(0.20 0.06 145 / 0.95)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-0">
          {["w-16", "w-20", "w-12"].map((w, i) => (
            <div key={i} className="px-5 py-4">
              <SkeletonBlock className={`${w} h-4`} />
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20" style={{ background: "oklch(0.20 0.06 145)" }}>
        {/* Section label */}
        <SkeletonBlock className="w-32 h-3 mb-5" />

        {/* Event card skeletons */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 mb-4 border border-white/06"
            style={{ background: "oklch(0.24 0.05 145 / 0.6)" }}
          >
            <div className="flex gap-4">
              {/* Date block */}
              <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center" style={{ background: "oklch(0.28 0.06 145)" }}>
                <SkeletonBlock className="w-8 h-3 mb-1" />
                <SkeletonBlock className="w-6 h-5" />
              </div>
              {/* Text */}
              <div className="flex-1 space-y-2 py-1">
                <SkeletonBlock className="w-3/4 h-5" />
                <SkeletonBlock className="w-1/2 h-3" />
                <SkeletonBlock className="w-2/3 h-3" />
              </div>
              {/* Action button */}
              <SkeletonBlock className="w-20 h-8 rounded-xl flex-shrink-0 self-center" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "events" | "members" | "feed" | "analytics" | "payments" | "battles";

export default function ClubDashboard() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [tab, setTab] = useState<Tab>("events");
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  // Post-type composer
  const [composerMode, setComposerMode] = useState<"announcement" | "poll" | "rsvp">("announcement");
  // Poll composer state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Yes", "No"]);
  const [pollHours, setPollHours] = useState(48);
  const [pollMultiple, setPollMultiple] = useState(false);
  // Schedule toggle
  const [pollScheduled, setPollScheduled] = useState(false);
  const [pollScheduledAt, setPollScheduledAt] = useState("");
  // Scheduled polls queue
  const [scheduledPolls, setScheduledPolls] = useState<ScheduledPoll[]>([]);
  // RSVP form composer state
  const [rsvpTitle, setRsvpTitle] = useState("");
  const [rsvpDate, setRsvpDate] = useState("");
  const [rsvpVenue, setRsvpVenue] = useState("");
  // Battle state
  const [battleView, setBattleView] = useState<"leaderboard" | "battles">("leaderboard");
  const [battles, setBattles] = useState<ClubBattle[]>([]);
  const [battleLeaderboard, setBattleLeaderboard] = useState<BattleLeaderboardEntry[]>([]);
  const [battlePlayerA, setBattlePlayerA] = useState("");
  const [battlePlayerB, setBattlePlayerB] = useState("");
  const [battleNotes, setBattleNotes] = useState("");
  const [battleResultId, setBattleResultId] = useState<string | null>(null);
  const [expandedLeaderboardId, setExpandedLeaderboardId] = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string; token: string; expiresAt: string; status: string }>>([]);
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);
  const [showInvitePanel, setShowInvitePanel] = useState(false);

  // Seed and load
  useEffect(() => {
    seedClubsIfEmpty();
    seedClubEventsIfEmpty();

    const found = id ? (getClub(id) ?? getClubBySlug(id)) : null;
    if (!found) { navigate("/clubs"); return; }

    // Guard: must be a member or owner
    if (user && !isMember(found.id, user.id) && found.ownerId !== user.id) {
      navigate(`/clubs/${id}`);
      return;
    }

    setClub(found);
    setMembers(getClubMembers(found.id));
    setEvents(listClubEvents(found.id, true));
    setFeedEvents(listFeedEvents(found.id, 50));
    setLoading(false);
    // Load battles from server (async) + migrate any localStorage battles
    const cid = found.id;
    migrateLocalBattlesToServer(cid).catch(() => {});
    apiBattleList(cid).then(setBattles).catch(() => setBattles(listBattles(cid)));
    apiBattleLeaderboard(cid).then(setBattleLeaderboard).catch(() => setBattleLeaderboard(getBattleLeaderboard(cid)));
  }, [id, user]);

  // Poll-close + scheduled-publish interval: every 30 seconds
  // MUST be declared before any early return to comply with Rules of Hooks
  const clubId = club?.id ?? null;
  useEffect(() => {
    if (!clubId) return;
    // Run once immediately on mount
    const didPublish = publishScheduledPolls(clubId);
    const didClose = checkAndCloseExpiredPolls(clubId);
    if (didPublish || didClose) {
      setFeedEvents(listFeedEvents(clubId, 50));
    }
    setScheduledPolls(listScheduledPolls(clubId));
    const timer = setInterval(() => {
      const p = publishScheduledPolls(clubId);
      const c = checkAndCloseExpiredPolls(clubId);
      if (p || c) setFeedEvents(listFeedEvents(clubId, 50));
      setScheduledPolls(listScheduledPolls(clubId));
    }, 30_000);
    return () => clearInterval(timer);
  }, [clubId]);

  function refreshEvents() {
    if (!club) return;
    setEvents(listClubEvents(club.id, true));
  }

  async function refreshBattles() {
    if (!club) return;
    try {
      const [battles, leaderboard] = await Promise.all([
        apiBattleList(club.id),
        apiBattleLeaderboard(club.id),
      ]);
      setBattles(battles);
      setBattleLeaderboard(leaderboard);
    } catch {
      // Fallback to localStorage if server is unreachable
      setBattles(listBattles(club.id));
      setBattleLeaderboard(getBattleLeaderboard(club.id));
    }
  }

  function refreshFeed() {
    if (!club) return;
    // Publish any due scheduled polls, then close expired ones, then refresh
    publishScheduledPolls(club.id);
    checkAndCloseExpiredPolls(club.id);
    setFeedEvents(listFeedEvents(club.id, 50));
    setScheduledPolls(listScheduledPolls(club.id));
  }

  async function fetchPendingInvites() {
    if (!club) return;
    try {
      const res = await fetch(`/api/clubs/${club.id}/invites`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as Array<{ id: string; email: string; token: string; expiresAt: string; status: string }>;
        setPendingInvites(data.filter((i) => i.status === "pending"));
      }
    } catch {
      // ignore
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteLink(null);
    try {
      const res = await fetch(`/api/clubs/${club.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json() as { inviteUrl?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create invite");
      } else {
        setInviteLink({ email: inviteEmail.trim(), url: data.inviteUrl ?? "" });
        setInviteEmail("");
        toast.success("Invite link created!");
        fetchPendingInvites();
      }
    } catch {
      toast.error("Network error — could not send invite");
    } finally {
      setInviteSending(false);
    }
  }

  async function revokeInvite(token: string) {
    if (!club) return;
    try {
      await fetch(`/api/clubs/${club.id}/invites/${token}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchPendingInvites();
      toast.success("Invite revoked");
    } catch {
      toast.error("Could not revoke invite");
    }
  }

  function submitAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementText.trim() || !club || !user) return;
    setPostingAnnouncement(true);
    postAnnouncement(club.id, user.displayName, announcementText.trim(), user.avatarUrl ?? undefined);
    setAnnouncementText("");
    setPostingAnnouncement(false);
    refreshFeed();
    toast.success("Announcement posted!");
  }

  function submitPoll(e: React.FormEvent) {
    e.preventDefault();
    if (!pollQuestion.trim() || !club || !user) return;
    const opts = pollOptions.filter((o) => o.trim());
    if (opts.length < 2) { toast.error("Add at least 2 options"); return; }

    if (pollScheduled) {
      if (!pollScheduledAt) { toast.error("Choose a publish date and time"); return; }
      const scheduledDate = new Date(pollScheduledAt);
      if (scheduledDate <= new Date()) { toast.error("Scheduled time must be in the future"); return; }
      schedulePoll(
        club.id,
        user.displayName,
        pollQuestion.trim(),
        opts,
        pollHours,
        pollMultiple,
        scheduledDate.toISOString(),
        user.avatarUrl ?? null
      );
      toast.success("Poll scheduled!");
    } else {
      postPoll(club.id, user.displayName, pollQuestion.trim(), opts, pollHours, pollMultiple, user.avatarUrl ?? null);
      toast.success("Poll posted!");
    }

    setPollQuestion("");
    setPollOptions(["Yes", "No"]);
    setPollScheduled(false);
    setPollScheduledAt("");
    refreshFeed();
  }

  function handleCancelScheduledPoll(draftId: string) {
    if (!club) return;
    cancelScheduledPoll(club.id, draftId);
    setScheduledPolls(listScheduledPolls(club.id));
    toast("Scheduled poll cancelled");
  }

  function submitRsvpForm(e: React.FormEvent) {
    e.preventDefault();
    if (!rsvpTitle.trim() || !rsvpDate || !club || !user) return;
    postRsvpForm(club.id, user.displayName, rsvpTitle.trim(), rsvpDate, rsvpVenue.trim(), user.avatarUrl ?? null);
    setRsvpTitle(""); setRsvpDate(""); setRsvpVenue("");
    refreshFeed();
    toast.success("RSVP form posted!");
  }

  function handleDeleteFeedEvent(eventId: string) {
    if (!club) return;
    deleteFeedEvent(club.id, eventId);
    refreshFeed();
  }

  function handlePinFeedEvent(eventId: string) {
    if (!club) return;
    pinFeedEvent(club.id, eventId);
    refreshFeed();
    toast.success("Post pinned to top of feed");
  }

  function handleUnpinFeedEvent(eventId: string) {
    if (!club) return;
    unpinFeedEvent(club.id, eventId);
    refreshFeed();
    toast.success("Post unpinned");
  }

  const isOwnerOrDirector =
    user && club && (club.ownerId === user.id || members.find((m) => m.userId === user.id && m.role === "director"));

  // Load pending invites when Members tab is opened (owner/director only)
  useEffect(() => {
    if (tab === "members" && isOwnerOrDirector) {
      fetchPendingInvites();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isOwnerOrDirector]);

  const upcomingEvents = events.filter(isUpcoming);
  const pastEvents = events.filter((e) => !isUpcoming(e));

  const filteredMembers = members.filter(
    (m) =>
      !memberSearch ||
      m.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.chesscomUsername ?? "").toLowerCase().includes(memberSearch.toLowerCase())
  );

  if (loading) {
    return <ClubDashboardSkeleton />;
  }

  if (!club) return null;

  const accent = club.accentColor ?? "#4CAF50";

  return (
    <div className="min-h-screen bg-[oklch(0.20_0.06_145)] dark:bg-[oklch(0.20_0.06_145)]">
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/08"
        style={{ background: "oklch(0.20 0.06 145 / 0.92)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/clubs">
            <button className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:block">My Clubs</span>
            </button>
          </Link>
          <div className="w-px h-4 bg-white/15" />
          <NavLogo />
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Link href={`/clubs/${id}/messages`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition border border-white/10">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Messages</span>
              </button>
            </Link>
          )}
          <AvatarNavDropdown currentPage="Clubs" />
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ minHeight: "280px" }}
      >
        {/* Chess board texture background — same as landing page hero */}
        <div className="absolute inset-0 bg-[oklch(0.20_0.06_145)]" />
        <div className="absolute inset-0 chess-board-bg opacity-40 pointer-events-none" />

        {/* Subtle green radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, oklch(0.44 0.12 145 / 0.18) 0%, transparent 70%)" }}
        />

        {/* Banner image overlay (if set) */}
        {club.bannerUrl && (
          <div
            className="absolute inset-0"
            style={{ background: `url(${club.bannerUrl}) center/cover no-repeat`, opacity: 0.25 }}
          />
        )}

        {/* Gradient fade to body */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 40%, oklch(0.20 0.06 145) 100%)" }}
        />

        <div className="relative z-10 px-5 sm:px-8 pt-10 pb-8 max-w-4xl mx-auto">
          {/* Club avatar + identity */}
          <div className="flex items-end gap-5 mb-6">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 flex-shrink-0"
              style={{ borderColor: accent + "66" }}
            >
              <PlayerAvatar
                username={club.name}
                name={club.name}
                avatarUrl={club.avatarUrl ?? undefined}
                size={96}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: accent + "22", color: accent, border: `1px solid ${accent}33` }}
                >
                  {club.category}
                </span>
                {club.isPublic && (
                  <span className="flex items-center gap-1 text-white/30 text-[10px]">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                )}
              </div>
              <h1
                className="text-white font-black text-3xl sm:text-4xl leading-tight truncate"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {club.name}
              </h1>
              {club.tagline && (
                <p className="text-white/50 text-sm mt-1 truncate">{club.tagline}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <Users className="w-4 h-4" style={{ color: accent }} />
              <span className="font-semibold text-white/80">{club.memberCount}</span>
              <span>members</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <Trophy className="w-4 h-4" style={{ color: accent }} />
              <span className="font-semibold text-white/80">{club.tournamentCount}</span>
              <span>tournaments</span>
            </div>
            {club.location && (
              <div className="flex items-center gap-1.5 text-white/60 text-sm">
                <MapPin className="w-4 h-4" />
                {club.location}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <Calendar className="w-4 h-4" />
              <span>Since {new Date(club.foundedAt).getFullYear()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky tab nav ─────────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-[57px] z-30 border-b border-white/08"
        style={{ background: "oklch(0.20 0.06 145 / 0.95)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-0">
          {(["events", "members", "feed", "battles", "analytics", "payments"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-5 py-4 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "events" && upcomingEvents.length > 0 && (
                <span
                  className="absolute top-3 right-2 w-1.5 h-1.5 rounded-full"
                  style={{ background: accent }}
                />
              )}
              {t}
              {tab === t && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: accent }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20" style={{ background: "oklch(0.20 0.06 145)" }}>   {/* ── EVENTS TAB ────────────────────────────────────────────────────── */}
        {tab === "events" && (
          <div className="space-y-8">
            {/* Player of the Month */}
            <PlayerOfMonthWidget
              clubId={club.id}
              members={members}
              battles={battles}
              events={events}
              isDark={isDark}
            />

            {/* Create event CTA */}
            {isOwnerOrDirector && (
              <button
                onClick={() => setShowCreateEvent(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white/60 border border-dashed border-white/15 hover:border-white/30 hover:text-white/80 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create New Event
              </button>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
              <div>
                <h2 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">
                  Upcoming · {upcomingEvents.length}
                </h2>
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      userId={user?.id ?? "guest"}
                      displayName={user?.displayName ?? "Guest"}
                      avatarUrl={user?.avatarUrl}
                      isOwner={!!isOwnerOrDirector}
                      onDeleted={refreshEvents}
                      onEdited={refreshEvents}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {pastEvents.length > 0 && (
              <div>
                <h2 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">
                  Past Events · {pastEvents.length}
                </h2>
                <div className="space-y-4 opacity-70">
                  {pastEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      userId={user?.id ?? "guest"}
                      displayName={user?.displayName ?? "Guest"}
                      avatarUrl={user?.avatarUrl}
                      isOwner={!!isOwnerOrDirector}
                      onDeleted={refreshEvents}
                      onEdited={refreshEvents}
                    />
                  ))}
                </div>
              </div>
            )}

            {upcomingEvents.length === 0 && pastEvents.length === 0 && (
              <div className="text-center py-16 text-white/30">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold">No events yet</p>
                {isOwnerOrDirector && (
                  <p className="text-sm mt-1">Create the first event for your club!</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MEMBERS TAB ───────────────────────────────────────────────────── */}
        {tab === "members" && (
          <div className="space-y-5">

            {/* ── Invite Members panel (owner/director only) ─────────────────── */}
            {isOwnerOrDirector && (
              <div
                className="rounded-2xl border border-white/08 overflow-hidden"
                style={{ background: "oklch(0.16 0.05 145)" }}
              >
                {/* Panel header */}
                <button
                  onClick={() => { setShowInvitePanel((v) => !v); if (!showInvitePanel) fetchPendingInvites(); }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/04 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" style={{ color: accent }} />
                    <span className="text-white font-semibold text-sm">Invite Members</span>
                    {pendingInvites.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${accent}33`, color: accent }}>
                        {pendingInvites.length} pending
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showInvitePanel ? "rotate-180" : ""}`} />
                </button>

                {showInvitePanel && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/08">

                    {/* Email input form */}
                    <form onSubmit={sendInvite} className="flex gap-2 pt-4">
                      <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="member@email.com"
                          required
                          className="w-full bg-white/07 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-white/25 transition-colors"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={inviteSending || !inviteEmail.trim()}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: accent, color: "white" }}
                      >
                        {inviteSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {inviteSending ? "Sending…" : "Send Invite"}
                      </button>
                    </form>

                    {/* Generated invite link */}
                    {inviteLink && (
                      <div className="rounded-xl border border-white/10 p-3 space-y-2" style={{ background: "oklch(0.14 0.04 145 / 0.6)" }}>
                        <p className="text-white/50 text-xs">Invite link for <span className="text-white/80 font-semibold">{inviteLink.email}</span> — share this link:</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2 bg-white/05 border border-white/10 rounded-lg px-3 py-2 min-w-0">
                            <Link2 className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                            <span className="text-white/60 text-xs truncate font-mono">{inviteLink.url}</span>
                          </div>
                          <button
                            onClick={() => { navigator.clipboard.writeText(inviteLink.url); toast.success("Link copied!"); }}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                            style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                        </div>
                        <p className="text-white/30 text-[10px]">Expires in 7 days. The invitee will be auto-joined to this club when they sign up or log in via this link.</p>
                      </div>
                    )}

                    {/* Pending invites list */}
                    {pendingInvites.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Pending Invites · {pendingInvites.length}</h4>
                          <button onClick={fetchPendingInvites} className="text-white/30 hover:text-white/60 transition-colors">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                        {pendingInvites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/06"
                            style={{ background: "oklch(0.14 0.04 240)" }}
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}22` }}>
                              <Mail className="w-3.5 h-3.5" style={{ color: accent }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{inv.email}</p>
                              <p className="text-white/30 text-[10px]">
                                Expires {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.token}`); toast.success("Link copied!"); }}
                                title="Copy invite link"
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                              >
                                <Copy className="w-3.5 h-3.5 text-white/40" />
                              </button>
                              <button
                                onClick={() => revokeInvite(inv.token)}
                                title="Revoke invite"
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/20"
                              >
                                <X className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pendingInvites.length === 0 && !inviteLink && (
                      <p className="text-white/25 text-xs text-center py-2">No pending invites. Enter an email above to invite someone.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={`Search ${members.length} members…`}
                className="w-full bg-white/07 border border-white/10 rounded-xl pl-4 pr-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-white/25 transition-colors"
              />
            </div>

            {/* ── Seed demo members (owner only) ──────────────────────────── */}
            {isOwnerOrDirector && (
              <button
                onClick={() => {
                  if (!club) return;
                  const added = seedDemoMembersToClub(club.id);
                  setMembers(getClubMembers(club.id));
                  if (added > 0) {
                    toast.success(`Added ${added} demo members to ${club.name}`);
                  } else {
                    toast.info("Demo members already added");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-dashed border-[#4CAF50]/40 text-[#4CAF50]/70 hover:text-[#4CAF50] hover:border-[#4CAF50]/70 hover:bg-[#4CAF50]/05 transition-all"
              >
                <Users className="w-4 h-4" />
                Add Demo Members (Magnus Carlsen, Hikaru, Firouzja + 15 more)
              </button>
            )}

            {/* Owner / directors first */}
            {["owner", "director", "member"].map((role) => {
              const group = filteredMembers.filter((m) => m.role === role);
              if (!group.length) return null;
              return (
                <div key={role}>
                  <h3 className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">
                    {role === "owner" ? "Owner" : role === "director" ? `Directors · ${group.length}` : `Members · ${group.length}`}
                  </h3>
                  <div className="space-y-2">
                    {group.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-white/06 hover:border-white/12 transition-colors"
                        style={{ background: "oklch(0.14 0.04 240)" }}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          <PlayerAvatar
                            username={m.displayName}
                            name={m.displayName}
                            avatarUrl={m.avatarUrl ?? undefined}
                            size={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold text-sm truncate">{m.displayName}</span>
                            <RoleBadge role={m.role} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {m.chesscomUsername && (
                              <span className="text-white/40 text-xs">♟ {m.chesscomUsername}</span>
                            )}
                            {m.tournamentsPlayed > 0 && (
                              <span className="text-white/40 text-xs">{m.tournamentsPlayed} tournaments</span>
                            )}
                            {m.bestFinish && (
                              <span className="text-amber-400/70 text-xs flex items-center gap-1">
                                <Star className="w-2.5 h-2.5" /> #{m.bestFinish} best
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-white/20 text-xs">
                            {new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </span>
                          {isOwnerOrDirector && m.userId !== user?.id && (
                            <button
                              title={`Challenge ${m.displayName}`}
                              onClick={() => {
                                setBattlePlayerA(user?.id ?? "");
                                setBattlePlayerB(m.userId);
                                setTab("battles");
                                setTimeout(() => {
                                  document.getElementById("create-battle-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 80);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                              style={{ background: "oklch(0.35 0.12 145 / 0.25)", color: "oklch(0.75 0.18 145)", border: "1px solid oklch(0.55 0.15 145 / 0.3)" }}
                            >
                              <Swords className="w-3 h-3" />
                              Challenge
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredMembers.length === 0 && (
              <div className="text-center py-16 text-white/30">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold">No members found</p>
              </div>
            )}


          </div>
        )}

        {/* ── FEED TAB ──────────────────────────────────────────────────────── */}
        {tab === "feed" && (
          <div className="space-y-5">

            {/* ── Composer (owner/director only) ────────────────────────────── */}
            {isOwnerOrDirector && (
              <div
                className="rounded-2xl border border-white/08 overflow-hidden"
                style={{ background: "oklch(0.16 0.05 145)" }}
              >
                {/* Mode selector */}
                <div className="flex border-b border-white/08">
                  {(["announcement", "poll", "rsvp"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setComposerMode(mode)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                        composerMode === mode
                          ? "text-[#4CAF50] border-b-2 border-[#4CAF50]"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {mode === "announcement" && <Megaphone className="w-3.5 h-3.5" />}
                      {mode === "poll" && <BarChart2 className="w-3.5 h-3.5" />}
                      {mode === "rsvp" && <ClipboardList className="w-3.5 h-3.5" />}
                      {mode === "announcement" ? "Announce" : mode === "poll" ? "Poll" : "RSVP Form"}
                    </button>
                  ))}
                </div>

                {/* Announcement composer */}
                {composerMode === "announcement" && (
                  <form onSubmit={submitAnnouncement} className="p-4 flex gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                      <PlayerAvatar username={user?.displayName ?? ""} name={user?.displayName ?? ""} avatarUrl={user?.avatarUrl ?? undefined} size={36} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex gap-2">
                      <input
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder="Post an announcement to the club…"
                        maxLength={500}
                        className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!announcementText.trim() || postingAnnouncement}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-30"
                        style={{ background: accent }}
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        Post
                      </button>
                    </div>
                  </form>
                )}

                {/* Poll composer */}
                {composerMode === "poll" && (
                  <form onSubmit={submitPoll} className="p-4 space-y-3">
                    <input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Ask the club a question…"
                      maxLength={200}
                      className="w-full bg-white/07 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-[#4CAF50]/50 transition-colors"
                    />
                    <div className="space-y-2">
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            value={opt}
                            onChange={(e) => {
                              const next = [...pollOptions];
                              next[idx] = e.target.value;
                              setPollOptions(next);
                            }}
                            placeholder={`Option ${idx + 1}`}
                            maxLength={100}
                            className="flex-1 bg-white/07 border border-white/12 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-[#4CAF50]/50 transition-colors"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 6 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions([...pollOptions, ""])}
                          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#4CAF50] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add option
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pollMultiple}
                          onChange={(e) => setPollMultiple(e.target.checked)}
                          className="accent-[#4CAF50]"
                        />
                        Allow multiple choices
                      </label>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Clock className="w-3.5 h-3.5" />
                        <select
                          value={pollHours}
                          onChange={(e) => setPollHours(Number(e.target.value))}
                          className="bg-white/07 border border-white/12 rounded-lg px-2 py-1 text-white text-xs outline-none"
                        >
                          <option value={24}>24 hours</option>
                          <option value={48}>48 hours</option>
                          <option value={72}>3 days</option>
                          <option value={168}>1 week</option>
                        </select>
                      </div>
                    </div>

                    {/* Schedule toggle */}
                    <div className="rounded-xl border border-white/08 overflow-hidden" style={{ background: "oklch(0.18 0.05 145)" }}>
                      <button
                        type="button"
                        onClick={() => setPollScheduled(!pollScheduled)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors hover:bg-white/04"
                      >
                        <span className="flex items-center gap-2 text-white/60">
                          <CalendarClock className="w-3.5 h-3.5 text-[#4CAF50]" />
                          Schedule for later
                        </span>
                        <div className={`w-8 h-4 rounded-full transition-colors relative ${ pollScheduled ? "bg-[#4CAF50]" : "bg-white/15" }`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${ pollScheduled ? "left-4.5" : "left-0.5" }`} />
                        </div>
                      </button>
                      {pollScheduled && (
                        <div className="px-3 pb-3">
                          <label className="block text-white/40 text-xs mb-1.5">Publish at</label>
                          <input
                            type="datetime-local"
                            value={pollScheduledAt}
                            onChange={(e) => setPollScheduledAt(e.target.value)}
                            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                            required={pollScheduled}
                            className="w-full bg-white/07 border border-white/12 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-[#4CAF50]/50 transition-colors [color-scheme:dark]"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2 || (pollScheduled && !pollScheduledAt)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-black transition-all active:scale-98 disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: accent }}
                    >
                      {pollScheduled ? (
                        <><CalendarClock className="w-4 h-4" /> Schedule Poll</>
                      ) : (
                        "Post Poll"
                      )}
                    </button>
                  </form>
                )}

                {/* RSVP Form composer */}
                {composerMode === "rsvp" && (
                  <form onSubmit={submitRsvpForm} className="p-4 space-y-3">
                    <input
                      value={rsvpTitle}
                      onChange={(e) => setRsvpTitle(e.target.value)}
                      placeholder="Event title (e.g. Thursday Night Blitz)"
                      maxLength={120}
                      className="w-full bg-white/07 border border-white/12 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-[#4CAF50]/50 transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-white/40 text-xs mb-1">Date</label>
                        <input
                          type="date"
                          value={rsvpDate}
                          onChange={(e) => setRsvpDate(e.target.value)}
                          required
                          className="w-full bg-white/07 border border-white/12 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#4CAF50]/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-white/40 text-xs mb-1">Venue</label>
                        <input
                          value={rsvpVenue}
                          onChange={(e) => setRsvpVenue(e.target.value)}
                          placeholder="Location"
                          className="w-full bg-white/07 border border-white/12 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-[#4CAF50]/50 transition-colors"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={!rsvpTitle.trim() || !rsvpDate}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-black transition-all active:scale-98 disabled:opacity-40"
                      style={{ background: accent }}
                    >
                      Post RSVP Form
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Scheduled polls queue (director-only) */}
            {isOwnerOrDirector && scheduledPolls.length > 0 && (
              <div className="rounded-2xl border border-[#4CAF50]/20 overflow-hidden mb-1" style={{ background: "oklch(0.15 0.05 145)" }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/06">
                  <CalendarClock className="w-4 h-4 text-[#4CAF50]" />
                  <span className="text-sm font-semibold text-white/80">Scheduled Polls</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "oklch(0.44 0.12 145 / 0.3)", color: "#4CAF50" }}>
                    {scheduledPolls.length}
                  </span>
                </div>
                <div className="divide-y divide-white/05">
                  {scheduledPolls.map((draft) => (
                    <div key={draft.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">{draft.question}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-[#4CAF50]/80">
                            <CalendarClock className="w-3 h-3" />
                            {new Date(draft.scheduledAt).toLocaleString("en-US", {
                              month: "short", day: "numeric",
                              hour: "numeric", minute: "2-digit",
                            })}
                          </span>
                          <span className="text-xs text-white/30">{draft.options.length} options &middot; {draft.expiresInHours}h poll</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelScheduledPoll(draft.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Cancel scheduled poll"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feed list — pinned post always first, then newest */}
            {feedEvents.length > 0 ? (
              <div className="space-y-3">
                {[...feedEvents]
                  .sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map((ev) => (
                    <FeedCard
                      key={ev.id}
                      event={ev}
                      accent={accent}
                      userId={user?.id ?? ""}
                      displayName={user?.displayName ?? ""}
                      avatarUrl={user?.avatarUrl}
                      clubId={club.id}
                      canDelete={!!isOwnerOrDirector}
                      canPin={!!isOwnerOrDirector}
                      onDelete={handleDeleteFeedEvent}
                      onPin={handlePinFeedEvent}
                      onUnpin={handleUnpinFeedEvent}
                      onVoted={refreshFeed}
                      onRsvped={refreshFeed}
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center py-16 text-white/30">
                <Zap className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold">No activity yet</p>
                <p className="text-sm mt-1">Activity will appear here as members join and events are created.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
        {tab === "analytics" && (() => {
          // ── Derived analytics data ────────────────────────────────────────
          const completedBattles = battles.filter(b => b.status === "completed");
          const activePlayers = new Set([
            ...completedBattles.map(b => b.playerAId),
            ...completedBattles.map(b => b.playerBId),
          ]).size;
          const pollVotes = feedEvents.filter(e => e.type === "poll").reduce(
            (sum, e) => sum + (e.pollOptions ?? []).reduce((s: number, o) => s + Object.keys(o.votes).length, 0), 0
          );
          // Per-member battle stats (top 8 by total battles played)
          const memberBattleStats = members.map(m => {
            const myBattles = completedBattles.filter(b => b.playerAId === m.userId || b.playerBId === m.userId);
            const wins = myBattles.filter(b =>
              (b.result === "player_a" && b.playerAId === m.userId) ||
              (b.result === "player_b" && b.playerBId === m.userId)
            ).length;
            const draws = myBattles.filter(b => b.result === "draw").length;
            const losses = myBattles.length - wins - draws;
            const winRate = myBattles.length > 0 ? Math.round((wins / myBattles.length) * 100) : 0;
            return { memberId: m.userId, name: m.displayName, avatarUrl: m.avatarUrl, total: myBattles.length, wins, draws, losses, winRate };
          }).filter(s => s.total > 0).sort((a, b) => b.total - a.total).slice(0, 8);
          // Player of the Month — computed from actual battle wins in last 30 days
          const potmRanked = computePlayerOfMonth(members, battles, events);
          const potmTop = potmRanked[0] ?? null;
          const potmMember = potmTop ? members.find(m => m.userId === potmTop.memberId) : null;

          return (
          <div className="space-y-6">
            {/* Header with Refresh button */}
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: accent }} />
              <h2 className="text-white font-bold text-lg">Club Engagement Analytics</h2>
              <button
                onClick={async () => {
                  if (!club) return;
                  setMembers(getClubMembers(club.id));
                  setFeedEvents(listFeedEvents(club.id, 50));
                  await refreshBattles();
                  toast.success("Analytics refreshed");
                }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {/* Key metrics — now includes battle stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Members", value: club.memberCount, icon: Users, delta: "All time" },
                { label: "Battles Played", value: completedBattles.length, icon: Swords, delta: `${battles.length} total` },
                { label: "Active Battlers", value: activePlayers, icon: Flame, delta: "Unique players" },
                { label: "Poll Votes", value: pollVotes, icon: ThumbsUp, delta: "Total votes cast" },
              ].map(({ label, value, icon: Icon, delta }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4 text-white/40" />
                    <span className="text-[10px] text-white/30">{delta}</span>
                  </div>
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="text-xs text-white/40 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Battle Activity chart — stacked W/D/L bars per member */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="w-4 h-4" style={{ color: accent }} />
                <h3 className="text-white font-semibold text-sm">Battle Activity — Top Players</h3>
                <span className="ml-auto text-[10px] text-white/30">Completed battles</span>
              </div>
              {memberBattleStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Swords className="w-8 h-8 text-white/15" />
                  <p className="text-white/30 text-sm text-center">No completed battles yet.</p>
                  <p className="text-white/20 text-xs text-center">Seed demo battles from the Battles tab to populate this chart.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberBattleStats.map((s) => {
                    const maxTotal = memberBattleStats[0].total;
                    const winPct  = s.total > 0 ? Math.round((s.wins  / s.total) * 100) : 0;
                    const drawPct = s.total > 0 ? Math.round((s.draws / s.total) * 100) : 0;
                    const lossPct = 100 - winPct - drawPct;
                    return (
                      <div key={s.memberId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {s.avatarUrl ? (
                              <img src={s.avatarUrl} alt={s.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-white/70 font-medium truncate max-w-[120px]">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-green-400 font-bold">{s.wins}W</span>
                            <span className="text-amber-400">{s.draws}D</span>
                            <span className="text-red-400/70">{s.losses}L</span>
                            <span className="text-white/30 ml-1">{s.total}</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden flex" style={{ width: `${Math.round((s.total / maxTotal) * 100)}%` }}>
                          <div className="h-full" style={{ width: `${winPct}%`,  background: "#4ade80" }} />
                          <div className="h-full" style={{ width: `${drawPct}%`, background: "#fbbf24" }} />
                          <div className="h-full" style={{ width: `${lossPct}%`, background: "rgba(248,113,113,0.4)" }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 pt-1">
                    {[{ color: "#4ade80", label: "Win" }, { color: "#fbbf24", label: "Draw" }, { color: "rgba(248,113,113,0.6)", label: "Loss" }].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                        <span className="text-[10px] text-white/40">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Member Roster with win-rate column */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4" style={{ color: accent }} />
                <h3 className="text-white font-semibold text-sm">Member Roster</h3>
                <span className="ml-auto text-[10px] text-white/30">{members.length} members</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {members.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">No members yet.</p>
                ) : (
                  members.map((m) => {
                    const mStats = memberBattleStats.find(s => s.memberId === m.userId);
                    return (
                      <div key={m.userId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2.5">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {m.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{m.displayName}</p>
                            <p className="text-[10px] text-white/30 capitalize">{m.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {mStats && (
                            <span className="text-[10px] font-semibold" style={{ color: mStats.winRate >= 60 ? "#4ade80" : mStats.winRate >= 40 ? "#fbbf24" : "rgba(248,113,113,0.8)" }}>
                              {mStats.winRate}% WR
                            </span>
                          )}
                          <span className="text-[10px] text-white/30">{new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Feed engagement breakdown */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4" style={{ color: accent }} />
                <h3 className="text-white font-semibold text-sm">Feed Post Breakdown</h3>
              </div>
              {feedEvents.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No feed posts yet.</p>
              ) : (
                <div className="space-y-3">
                  {(["announcement", "poll", "rsvp_form", "poll_result"] as const).map((type) => {
                    const count = feedEvents.filter(e => e.type === type).length;
                    const pct = feedEvents.length > 0 ? Math.round((count / feedEvents.length) * 100) : 0;
                    const labels: Record<string, string> = { announcement: "Announcements", poll: "Polls", rsvp_form: "RSVP Forms", poll_result: "Poll Results" };
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/60">{labels[type]}</span>
                          <span className="text-xs font-bold text-white/80">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Player of the Month — computed from battle data, not hardcoded */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Player of the Month</h3>
                <span className="ml-auto text-[10px] text-white/30">Last 30 days · battle wins</span>
              </div>
              {potmTop === null ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Crown className="w-8 h-8 text-white/15" />
                  <p className="text-white/30 text-sm text-center">No battle activity in the last 30 days.</p>
                  <p className="text-white/20 text-xs text-center">Complete battles to determine the top player.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      {potmMember?.avatarUrl ? (
                        <img src={potmMember.avatarUrl} alt={potmTop.memberName} className="w-16 h-16 rounded-2xl object-cover" />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-[#2d6a4f] flex items-center justify-center text-white text-2xl font-black">
                          {potmTop.memberName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                        <Crown className="w-3.5 h-3.5 text-amber-900" />
                      </div>
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">{potmTop.memberName}</p>
                      <p className="text-white/40 text-xs">
                        {potmTop.battleWins} wins · {potmTop.winRate}% win rate · {potmTop.eventsAttended} events
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-400">Top Player This Month</span>
                      </div>
                    </div>
                  </div>
                  {potmRanked.length > 1 && (
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      {potmRanked.slice(1, 4).map((entry, i) => (
                        <div key={entry.memberId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/25 w-4">#{i + 2}</span>
                            <div className="w-5 h-5 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white text-[9px] font-bold">
                              {entry.memberName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-white/60">{entry.memberName}</span>
                          </div>
                          <span className="text-[10px] text-white/40">{entry.battleWins}W · {entry.winRate}% WR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* ── PAYMENTS TAB ─────────────────────────────────────────────────── */}
        {tab === "payments" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5" style={{ color: accent }} />
              <h3 className="text-white font-bold text-lg">Tournament Buy-In Payments</h3>
            </div>

            {/* Stripe-ready notice */}
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-semibold text-sm">Stripe Payments — Coming Soon</p>
                <p className="text-white/50 text-xs mt-1">The payment infrastructure is built and ready. Connect your Stripe account to start collecting tournament buy-ins and automatically distribute prize pools to winners.</p>
                <button className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-400 text-xs font-semibold border border-amber-400/20 transition">
                  <CreditCard className="w-3.5 h-3.5" /> Connect Stripe Account
                </button>
              </div>
            </div>

            {/* Buy-in configuration per event */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4" style={{ color: accent }} />
                <h3 className="text-white font-semibold text-sm">Configure Buy-Ins for Upcoming Events</h3>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No upcoming events. Create an event first.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-white">{ev.title}</p>
                        <p className="text-xs text-white/40">{new Date(ev.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                          <DollarSign className="w-3 h-3 text-white/40" />
                          <input
                            type="number"
                            placeholder="0.00"
                            min="0"
                            step="0.50"
                            className="w-16 bg-transparent text-sm text-white outline-none"
                            disabled
                          />
                        </div>
                        <span className="text-[10px] text-white/25">Stripe required</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prize pool distribution preview */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Prize Pool Distribution</h3>
                <span className="ml-auto text-[10px] text-white/30">Auto-allocated on tournament completion</span>
              </div>
              <div className="space-y-3">
                {[
                  { place: "1st Place", pct: 50, color: "text-amber-400" },
                  { place: "2nd Place", pct: 30, color: "text-gray-300" },
                  { place: "3rd Place", pct: 20, color: "text-amber-700" },
                ].map(({ place, pct, color }) => (
                  <div key={place} className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-20 ${color}`}>{place}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                    </div>
                    <span className="text-sm font-semibold text-white/60 w-10 text-right">{pct}%</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/30 mt-4">Distribution percentages are configurable per tournament once Stripe is connected.</p>
            </div>

            {/* Transaction history placeholder */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-4 h-4" style={{ color: accent }} />
                <h3 className="text-white font-semibold text-sm">Transaction History</h3>
              </div>
              <div className="text-center py-8">
                <Wallet className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No transactions yet.</p>
                <p className="text-white/20 text-xs mt-1">Transactions will appear here once Stripe is connected and buy-ins are collected.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── BATTLES TAB ─────────────────────────────────────────────────── */}
        {tab === "battles" && (
          <div className="space-y-6">
            {/* ── Sub-nav: Leaderboard | Battles ─────────────────────────────── */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
              {(["leaderboard", "battles"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setBattleView(v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    battleView === v
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {v === "leaderboard" ? <Trophy className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                  {v === "leaderboard" ? "Leaderboard" : "Battles"}
                </button>
              ))}
            </div>

            {/* ── Seed demo battles (owner only) ──────────────────────────── */}
            {isOwnerOrDirector && (
              <button
                onClick={async () => {
                  if (!club) return;
                  // Generate demo battles into localStorage first (deterministic)
                  const added = seedDemoBattlesToClub(club.id);
                  if (added > 0) {
                    // Push them to the server via bulk import
                    try {
                      const localBattles = listBattles(club.id);
                      const { inserted } = await apiBattleBulkImport(club.id, localBattles);
                      await refreshBattles();
                      toast.success(`Seeded ${inserted} demo battle results!`);
                    } catch {
                      setBattles(listBattles(club.id));
                      toast.success(`Seeded ${added} demo battle results (local only)!`);
                    }
                  } else {
                    toast.info("Demo battles already seeded");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-dashed border-[#4CAF50]/40 text-[#4CAF50]/70 hover:text-[#4CAF50] hover:border-[#4CAF50]/70 hover:bg-[#4CAF50]/05 transition-all"
              >
                <Swords className="w-4 h-4" />
                Seed Demo Battles (Magnus vs Hikaru, Firouzja vs Caruana + 150 more)
              </button>
            )}

            {/* ── LEADERBOARD VIEW ────────────────────────────────────────────── */}
            {battleView === "leaderboard" && (
              <div className="space-y-4">
                {battleLeaderboard.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-white/30">
                    <Trophy className="w-12 h-12 opacity-20" />
                    <p className="text-sm text-center">No battles recorded yet.<br />Complete some battles to see the leaderboard.</p>
                  </div>
                ) : (
                  <>
                    {/* Podium — top 3 */}
                    {battleLeaderboard.length >= 1 && (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                        <div className="flex items-end justify-center gap-3 mb-4">
                          {/* 2nd place */}
                          {battleLeaderboard[1] && (
                            <div className="flex flex-col items-center gap-2 flex-1">
                              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black text-white/70 border-2 border-white/20"
                                style={{ background: "oklch(0.22 0.05 240)" }}>
                                {battleLeaderboard[1].playerName.charAt(0).toUpperCase()}
                              </div>
                              <p className="text-white/70 text-xs font-semibold text-center truncate w-full">{battleLeaderboard[1].playerName}</p>
                              <div className="w-full rounded-t-xl flex flex-col items-center py-3" style={{ background: "oklch(0.28 0.06 240)", minHeight: 56 }}>
                                <span className="text-white/40 text-[10px] font-bold">2nd</span>
                                <span className="text-white font-black text-sm">{battleLeaderboard[1].wins}W</span>
                                <span className="text-white/40 text-[10px]">{battleLeaderboard[1].winRate}%</span>
                              </div>
                            </div>
                          )}
                          {/* 1st place */}
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <Crown className="w-5 h-5 text-amber-400" />
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black text-white border-2 border-amber-400/60"
                              style={{ background: "oklch(0.26 0.08 80)" }}>
                              {battleLeaderboard[0].playerName.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-white text-xs font-bold text-center truncate w-full">{battleLeaderboard[0].playerName}</p>
                            <div className="w-full rounded-t-xl flex flex-col items-center py-4" style={{ background: "oklch(0.32 0.1 80)", minHeight: 72 }}>
                              <span className="text-amber-400 text-[10px] font-bold">1st</span>
                              <span className="text-white font-black text-base">{battleLeaderboard[0].wins}W</span>
                              <span className="text-amber-400/70 text-[10px]">{battleLeaderboard[0].winRate}%</span>
                            </div>
                          </div>
                          {/* 3rd place */}
                          {battleLeaderboard[2] && (
                            <div className="flex flex-col items-center gap-2 flex-1">
                              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-black text-white/60 border-2 border-white/10"
                                style={{ background: "oklch(0.2 0.04 240)" }}>
                                {battleLeaderboard[2].playerName.charAt(0).toUpperCase()}
                              </div>
                              <p className="text-white/60 text-xs font-semibold text-center truncate w-full">{battleLeaderboard[2].playerName}</p>
                              <div className="w-full rounded-t-xl flex flex-col items-center py-2.5" style={{ background: "oklch(0.24 0.05 240)", minHeight: 48 }}>
                                <span className="text-white/30 text-[10px] font-bold">3rd</span>
                                <span className="text-white/70 font-black text-sm">{battleLeaderboard[2].wins}W</span>
                                <span className="text-white/30 text-[10px]">{battleLeaderboard[2].winRate}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Full ranked list */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      {battleLeaderboard.map((entry, idx) => {
                        const isExpanded = expandedLeaderboardId === entry.playerId;
                        const h2h = getHeadToHeadRecords(club!.id, entry.playerId);
                        const medalColor = idx === 0 ? "text-amber-400" : idx === 1 ? "text-white/60" : idx === 2 ? "text-orange-400" : "text-white/20";
                        return (
                          <div key={entry.playerId} className={`border-b border-white/5 last:border-0 ${
                            idx < 3 ? "bg-white/[0.02]" : ""
                          }`}>
                            <button
                              onClick={() => setExpandedLeaderboardId(isExpanded ? null : entry.playerId)}
                              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition text-left"
                            >
                              {/* Rank */}
                              <span className={`w-5 text-center text-xs font-black flex-shrink-0 ${medalColor}`}>
                                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                              </span>
                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white/60"
                                style={{ background: "oklch(0.25 0.07 145)" }}>
                                {entry.playerName.charAt(0).toUpperCase()}
                              </div>
                              {/* Name + stats */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{entry.playerName}</p>
                                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden w-full">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                      width: `${entry.winRate}%`,
                                      background: entry.winRate >= 60
                                        ? "oklch(0.65 0.2 145)"
                                        : entry.winRate >= 40
                                        ? "oklch(0.7 0.15 80)"
                                        : "oklch(0.55 0.18 25)"
                                    }}
                                  />
                                </div>
                              </div>
                              {/* W/D/L */}
                              <div className="flex items-center gap-1.5 text-xs font-bold flex-shrink-0">
                                <span className="text-emerald-400">{entry.wins}W</span>
                                <span className="text-white/20">·</span>
                                <span className="text-white/40">{entry.draws}D</span>
                                <span className="text-white/20">·</span>
                                <span className="text-red-400">{entry.losses}L</span>
                              </div>
                              {/* Streak */}
                              {entry.streak !== 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                  entry.streak > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                  {entry.streak > 0 ? `🔥${entry.streak}W` : `${Math.abs(entry.streak)}L`}
                                </span>
                              )}
                              <ChevronDown className={`w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`} />
                            </button>
                            {/* H2H drill-down */}
                            {isExpanded && (
                              <div className="bg-white/[0.02] border-t border-white/5 px-4 py-3 space-y-2">
                                <p className="text-white/40 text-[11px] uppercase tracking-wider font-semibold mb-2">Head-to-Head</p>
                                {h2h.length === 0 ? (
                                  <p className="text-white/20 text-xs">No completed battles yet.</p>
                                ) : (
                                  h2h.map((rec) => {
                                    const total = rec.wins + rec.draws + rec.losses;
                                    const winPct = total > 0 ? Math.round((rec.wins / total) * 100) : 0;
                                    return (
                                      <div key={rec.opponentId} className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white/60"
                                          style={{ background: "oklch(0.3 0.08 145)" }}>
                                          {rec.opponentAvatarUrl ? (
                                            <img src={rec.opponentAvatarUrl} alt={rec.opponentName} className="w-full h-full object-cover rounded-full"
                                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                          ) : rec.opponentName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-white/80 text-xs font-semibold truncate">{rec.opponentName}</p>
                                          <div className="mt-0.5 h-1 rounded-full bg-white/10 overflow-hidden w-full">
                                            <div className="h-full rounded-full transition-all duration-500"
                                              style={{ width: `${winPct}%`, background: winPct >= 60 ? "oklch(0.65 0.2 145)" : winPct >= 40 ? "oklch(0.7 0.15 80)" : "oklch(0.55 0.18 25)" }} />
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold flex-shrink-0">
                                          <span className="text-emerald-400">{rec.wins}W</span>
                                          <span className="text-white/20">/</span>
                                          <span className="text-white/40">{rec.draws}D</span>
                                          <span className="text-white/20">/</span>
                                          <span className="text-red-400">{rec.losses}L</span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── BATTLES VIEW ────────────────────────────────────────────────── */}
            {battleView === "battles" && (
              <div className="space-y-6">
            {/* Challenge creator (director only) */}
            {isOwnerOrDirector && (
              <div id="create-battle-form" className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="w-4 h-4" style={{ color: accent }} />
                  <h3 className="text-white font-semibold text-sm">Create Battle</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Player A</label>
                    <select
                      value={battlePlayerA}
                      onChange={(e) => setBattlePlayerA(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                    >
                      <option value="">Select member…</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>{m.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Player B</label>
                    <select
                      value={battlePlayerB}
                      onChange={(e) => setBattlePlayerB(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                    >
                      <option value="">Select member…</option>
                      {members.filter((m) => m.userId !== battlePlayerA).map((m) => (
                        <option key={m.userId} value={m.userId}>{m.displayName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={battleNotes}
                  onChange={(e) => setBattleNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 mb-3"
                />
                <button
                  disabled={!battlePlayerA || !battlePlayerB}
                  onClick={async () => {
                    if (!club || !battlePlayerA || !battlePlayerB) return;
                    const nameA = members.find((m) => m.userId === battlePlayerA)?.displayName ?? battlePlayerA;
                    const nameB = members.find((m) => m.userId === battlePlayerB)?.displayName ?? battlePlayerB;
                    try {
                      await apiBattleCreate(club.id, { playerAId: battlePlayerA, playerAName: nameA, playerBId: battlePlayerB, playerBName: nameB, notes: battleNotes || undefined });
                    } catch {
                      createBattle(club.id, { playerAId: battlePlayerA, playerAName: nameA, playerBId: battlePlayerB, playerBName: nameB, notes: battleNotes || undefined });
                    }
                    setBattlePlayerA(""); setBattlePlayerB(""); setBattleNotes("");
                    await refreshBattles();
                    toast.success("Battle created!");
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-30"
                  style={{ background: accent, color: "#0a1a0f" }}
                >
                  Create Battle
                </button>
              </div>
            )}

            {/* Active & pending battles */}
            {battles.filter((b) => b.status !== "completed").length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <h3 className="text-white font-semibold text-sm">Active Battles</h3>
                </div>
                <div className="space-y-3">
                  {battles.filter((b) => b.status !== "completed").map((battle) => (
                    <div key={battle.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-semibold text-sm">{battle.playerAName}</span>
                          <span className="text-white/30 text-xs font-bold">VS</span>
                          <span className="text-white font-semibold text-sm">{battle.playerBName}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          battle.status === "active" ? "bg-orange-500/20 text-orange-400" : "bg-white/10 text-white/40"
                        }`}>
                          {battle.status.toUpperCase()}
                        </span>
                      </div>
                      {battle.notes && <p className="text-white/30 text-xs mb-3">{battle.notes}</p>}
                      {isOwnerOrDirector && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {battle.status === "pending" && (
                            <button
                              onClick={async () => {
                                try { await apiBattleStart(club.id, battle.id); } catch { startBattle(club.id, battle.id); }
                                await refreshBattles();
                              }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition"
                            >
                              Start
                            </button>
                          )}
                          {battle.status === "active" && (
                            <>
                              <button
                                onClick={async () => {
                                  try { await apiBattleRecordResult(club.id, battle.id, "player_a"); } catch { recordBattleResult(club.id, battle.id, "player_a"); }
                                  postBattleResult({ clubId: club.id, battleId: battle.id, playerAName: battle.playerAName, playerBName: battle.playerBName, outcome: "player_a", directorName: user?.displayName });
                                  await refreshBattles();
                                  postLeaderboardSnapshot(club.id, battles.filter(b => b.status === "completed").length + 1);
                                  toast.success(`${battle.playerAName} wins!`);
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                                style={{ background: accent + "33", color: accent }}
                              >
                                {battle.playerAName} Wins
                              </button>
                              <button
                                onClick={async () => {
                                  try { await apiBattleRecordResult(club.id, battle.id, "draw"); } catch { recordBattleResult(club.id, battle.id, "draw"); }
                                  postBattleResult({ clubId: club.id, battleId: battle.id, playerAName: battle.playerAName, playerBName: battle.playerBName, outcome: "draw", directorName: user?.displayName });
                                  await refreshBattles();
                                  toast.success("Draw recorded!");
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/50 hover:bg-white/20 transition"
                              >
                                Draw
                              </button>
                              <button
                                onClick={async () => {
                                  try { await apiBattleRecordResult(club.id, battle.id, "player_b"); } catch { recordBattleResult(club.id, battle.id, "player_b"); }
                                  postBattleResult({ clubId: club.id, battleId: battle.id, playerAName: battle.playerAName, playerBName: battle.playerBName, outcome: "player_b", directorName: user?.displayName });
                                  await refreshBattles();
                                  postLeaderboardSnapshot(club.id, battles.filter(b => b.status === "completed").length + 1);
                                  toast.success(`${battle.playerBName} wins!`);
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                                style={{ background: accent + "33", color: accent }}
                              >
                                {battle.playerBName} Wins
                              </button>
                            </>
                          )}
                          <button
                            onClick={async () => {
                              try { await apiBattleDelete(club.id, battle.id); } catch { deleteBattle(club.id, battle.id); }
                              await refreshBattles();
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition ml-auto"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {battleLeaderboard.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Medal className="w-4 h-4" style={{ color: accent }} />
                  <h3 className="text-white font-semibold text-sm">Battle Leaderboard</h3>
                </div>
                <div className="space-y-1.5">
                  {battleLeaderboard.map((entry, idx) => {
                    const isExpanded = expandedLeaderboardId === entry.playerId;
                    const h2h: HeadToHeadRecord[] = club ? getHeadToHeadRecords(club.id, entry.playerId, members) : [];
                    return (
                      <div key={entry.playerId} className="rounded-xl overflow-hidden">
                        {/* Leaderboard row — clickable */}
                        <button
                          onClick={() => setExpandedLeaderboardId(isExpanded ? null : entry.playerId)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
                        >
                          <span className={`text-sm font-bold w-5 text-center flex-shrink-0 ${
                            idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-white/30"
                          }`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{entry.playerName}</p>
                            <p className="text-white/30 text-xs">{entry.total} battles · {entry.winRate}% win rate</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-bold flex-shrink-0">
                            <span className="text-emerald-400">{entry.wins}W</span>
                            <span className="text-white/30">{entry.draws}D</span>
                            <span className="text-red-400">{entry.losses}L</span>
                          </div>
                          {entry.streak !== 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                              entry.streak > 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                            }`}>
                              {entry.streak > 0 ? `🔥 ${entry.streak}W` : `${Math.abs(entry.streak)}L`}
                            </span>
                          )}
                          <ChevronDown className={`w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`} />
                        </button>

                        {/* Head-to-head detail panel */}
                        {isExpanded && (
                          <div className="bg-white/[0.03] border-t border-white/5 px-4 py-3 space-y-2">
                            <p className="text-white/40 text-[11px] uppercase tracking-wider font-semibold mb-2">Head-to-Head Breakdown</p>
                            {h2h.length === 0 ? (
                              <p className="text-white/20 text-xs">No completed battles yet.</p>
                            ) : (
                              h2h.map((rec) => {
                                const total = rec.wins + rec.draws + rec.losses;
                                const winPct = total > 0 ? Math.round((rec.wins / total) * 100) : 0;
                                return (
                                  <div key={rec.opponentId} className="flex items-center gap-3">
                                    {/* Avatar — real image or initials fallback */}
                                    <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white/60"
                                      style={{ background: "oklch(0.3 0.08 145)" }}>
                                      {rec.opponentAvatarUrl ? (
                                        <img
                                          src={rec.opponentAvatarUrl}
                                          alt={rec.opponentName}
                                          className="w-full h-full object-cover"
                                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                        />
                                      ) : (
                                        rec.opponentName.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white/80 text-xs font-semibold truncate">{rec.opponentName}</p>
                                      {/* Win-rate bar */}
                                      <div className="mt-0.5 h-1 rounded-full bg-white/10 overflow-hidden w-full">
                                        <div
                                          className="h-full rounded-full transition-all duration-500"
                                          style={{
                                            width: `${winPct}%`,
                                            background: winPct >= 60 ? "oklch(0.65 0.2 145)" : winPct >= 40 ? "oklch(0.7 0.15 80)" : "oklch(0.55 0.18 25)"
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold flex-shrink-0">
                                      <span className="text-emerald-400">{rec.wins}W</span>
                                      <span className="text-white/20">/</span>
                                      <span className="text-white/40">{rec.draws}D</span>
                                      <span className="text-white/20">/</span>
                                      <span className="text-red-400">{rec.losses}L</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed battle history */}
            {battles.filter((b) => b.status === "completed").length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4" style={{ color: accent }} />
                  <h3 className="text-white font-semibold text-sm">Battle History</h3>
                </div>
                <div className="space-y-2">
                  {battles.filter((b) => b.status === "completed").slice(0, 20).map((battle) => {
                    const winnerName = battle.result === "player_a" ? battle.playerAName : battle.result === "player_b" ? battle.playerBName : null;
                    return (
                      <div key={battle.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">
                            <span className={battle.result === "player_a" ? "font-bold" : "text-white/60"}>{battle.playerAName}</span>
                            <span className="text-white/30 mx-2">vs</span>
                            <span className={battle.result === "player_b" ? "font-bold" : "text-white/60"}>{battle.playerBName}</span>
                          </p>
                          {battle.notes && <p className="text-white/30 text-xs truncate">{battle.notes}</p>}
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          battle.result === "draw" ? "bg-white/10 text-white/40" : "bg-emerald-500/20 text-emerald-400"
                        }`}>
                          {battle.result === "draw" ? "DRAW" : `${winnerName} wins`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {battles.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-white/30">
                <Swords className="w-12 h-12 opacity-20" />
                <p className="text-sm text-center">No battles yet.<br />Create a battle between two members to start tracking records.</p>
              </div>
            )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create Event Modal ───────────────────────────────────────────────── */}
      {showCreateEvent && user && (
        <CreateEventModal
          clubId={club.id}
          userId={user.id}
          displayName={user.displayName}
          clubAccent={club.accentColor}
          onCreated={refreshEvents}
          onClose={() => setShowCreateEvent(false)}
        />
      )}
    </div>
  );
}
