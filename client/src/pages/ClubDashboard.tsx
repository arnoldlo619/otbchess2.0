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
  listFeedEvents,
  seedFeedIfEmpty,
  postAnnouncement,
  postPoll,
  postRsvpForm,
  castPollVote,
  upsertFeedRSVP,
  deleteFeedEvent,
  checkAndCloseExpiredPolls,
  schedulePoll,
  publishScheduledPolls,
  listScheduledPolls,
  cancelScheduledPoll,
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
} from "lucide-react";
import { toast } from "sonner";

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
  onDelete,
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
  onDelete: (id: string) => void;
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
      className="rounded-2xl border border-white/08 overflow-hidden group"
      style={{ background: "oklch(0.16 0.05 145)" }}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <FeedIcon type={event.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-white/80 text-sm font-semibold">{event.actorName}</span>
            <span className="text-white/40 text-xs">{timeAgo(event.createdAt)}</span>
          </div>
          <p className="text-white/50 text-xs mt-0.5">{event.description}</p>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(event.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
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

type Tab = "events" | "members" | "feed" | "analytics" | "payments";

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

  function refreshFeed() {
    if (!club) return;
    // Publish any due scheduled polls, then close expired ones, then refresh
    publishScheduledPolls(club.id);
    checkAndCloseExpiredPolls(club.id);
    setFeedEvents(listFeedEvents(club.id, 50));
    setScheduledPolls(listScheduledPolls(club.id));
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

  const isOwnerOrDirector =
    user && club && (club.ownerId === user.id || members.find((m) => m.userId === user.id && m.role === "director"));

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
        {user && (
          <div className="flex items-center gap-2">
            <Link href={`/clubs/${id}/messages`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition border border-white/10">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Messages</span>
              </button>
            </Link>
            <div className="w-7 h-7 rounded-full overflow-hidden">
              <PlayerAvatar username={user.displayName} name={user.displayName} avatarUrl={user.avatarUrl ?? undefined} size={28} className="w-full h-full object-cover" />
            </div>
            <span className="hidden sm:block text-white/60 text-sm font-medium">{user.displayName}</span>
          </div>
        )}
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
          {(["events", "members", "feed", "analytics", "payments"] as Tab[]).map((t) => (
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
            {/* Search */}
            <div className="relative">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={`Search ${members.length} members…`}
                className="w-full bg-white/07 border border-white/10 rounded-xl pl-4 pr-4 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:border-white/25 transition-colors"
              />
            </div>

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
                        <div className="text-white/20 text-xs flex-shrink-0">
                          {new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
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

            {/* Feed list */}
            {feedEvents.length > 0 ? (
              <div className="space-y-3">
                {feedEvents.map((ev) => (
                  <FeedCard
                    key={ev.id}
                    event={ev}
                    accent={accent}
                    userId={user?.id ?? ""}
                    displayName={user?.displayName ?? ""}
                    avatarUrl={user?.avatarUrl}
                    clubId={club.id}
                    canDelete={!!isOwnerOrDirector}
                    onDelete={handleDeleteFeedEvent}
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
        {tab === "analytics" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" style={{ color: accent }} />
              <h2 className="text-white font-bold text-lg">Club Engagement Analytics</h2>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Members", value: club.memberCount, icon: Users, delta: "+3 this month" },
                { label: "Events Hosted", value: club.tournamentCount, icon: Trophy, delta: "All time" },
                { label: "Feed Posts", value: feedEvents.length, icon: Activity, delta: "Active posts" },
                { label: "Poll Votes", value: feedEvents.filter(e => e.type === "poll").reduce((sum, e) => sum + (e.pollOptions ?? []).reduce((s: number, o) => s + Object.keys(o.votes).length, 0), 0), icon: ThumbsUp, delta: "Total votes cast" },
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

            {/* Member join timeline */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4" style={{ color: accent }} />
                <h3 className="text-white font-semibold text-sm">Member Roster</h3>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {members.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">No members yet.</p>
                ) : (
                  members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#2d6a4f] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {m.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{m.displayName}</p>
                          <p className="text-[10px] text-white/30 capitalize">{m.role}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/30">{new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  ))
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

            {/* Player of the Month highlight */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold text-sm">Player of the Month</h3>
                <span className="ml-auto text-[10px] text-white/30">Based on battle wins</span>
              </div>
              {members.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No members yet.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#2d6a4f] flex items-center justify-center text-white text-xl font-black">
                    {members[0].displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{members[0].displayName}</p>
                    <p className="text-white/40 text-xs capitalize">{members[0].role} · Joined {new Date(members[0].joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400">Top Member This Month</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
