/**
 * ClubMeetupWizard
 * A streamlined wizard for creating club meetup events (open play sessions).
 * Supports one-off (popup) and recurring (weekly / biweekly / monthly) meetups.
 * Includes optional cover image upload with live preview.
 */
import { useState, useRef, useCallback } from "react";
import { X, Users, MapPin, Clock, Calendar, Repeat, ImagePlus, Trash2 } from "lucide-react";
import {
  createClubEvent,
  createRecurringEvents,
  type ClubEvent,
} from "../lib/clubEventRegistry";

interface Props {
  clubId: string;
  clubName: string;
  userId: string;
  displayName: string;
  clubAccent?: string;
  onCreated: (event: ClubEvent) => void;
  onClose: () => void;
}

type Frequency = "popup" | "weekly" | "biweekly" | "monthly";

const FREQ_LABELS: Record<Frequency, string> = {
  popup: "One-time",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

/** Resize an image file to max 1200px wide and return a JPEG data URL */
function resizeImage(file: File, maxWidth = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas ctx"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        // If still > 800 KB, compress more
        if (dataUrl.length > 800_000) dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ClubMeetupWizard({
  clubId,
  clubName,
  userId,
  displayName,
  clubAccent = "#4CAF50",
  onCreated,
  onClose,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputCls =
    "w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors border border-white/10 bg-white/[0.07]";
  const labelCls = "block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5";

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      const dataUrl = await resizeImage(file);
      setCoverImageUrl(dataUrl);
    } catch {
      // silently ignore
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSubmitting(true);

    const startAt = new Date(`${date}T${startTime}`).toISOString();
    const endAt = endTime ? new Date(`${date}T${endTime}`).toISOString() : undefined;

    const seed = createClubEvent({
      clubId,
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
      venue: location.trim() || undefined,
      address: address.trim() || undefined,
      creatorId: userId,
      creatorName: displayName,
      accentColor: clubAccent,
      isPublished: true,
      eventType: "meetup",
      recurrence: frequency === "popup" ? "none" : frequency,
      coverImageUrl: coverImageUrl,
    });

    // Generate recurring instances (up to 12 weeks / 6 months ahead)
    if (frequency !== "popup") {
      createRecurringEvents(seed, frequency);
    }

    setSubmitting(false);
    // Feed post will be created by ClubDashboard's onCreated callback via recordMeetupCreated()
    onCreated(seed);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.08]"
          style={{ background: "oklch(0.16 0.05 145)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: clubAccent + "22" }}
            >
              <Users className="w-4 h-4" style={{ color: clubAccent }} />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Club Meetup</h2>
              <p className="text-white/40 text-xs">Open play session for {clubName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">

          {/* Cover Image Upload */}
          <div>
            <label className={labelCls}>
              <ImagePlus className="w-3 h-3 inline mr-1" />Cover Photo
              <span className="text-white/25 normal-case font-normal ml-1">(optional)</span>
            </label>

            {coverImageUrl ? (
              /* Preview */
              <div className="relative rounded-2xl overflow-hidden group">
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="w-full h-36 object-cover"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/20 hover:bg-white/30 text-white transition"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl(undefined)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Drop zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-2xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-2 py-7"
                style={{
                  borderColor: dragging ? clubAccent : "rgba(255,255,255,0.15)",
                  background: dragging ? clubAccent + "12" : "rgba(255,255,255,0.04)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition"
                  style={{ background: dragging ? clubAccent + "30" : "rgba(255,255,255,0.08)" }}
                >
                  <ImagePlus className="w-5 h-5" style={{ color: dragging ? clubAccent : "rgba(255,255,255,0.4)" }} />
                </div>
                <p className="text-white/40 text-xs text-center leading-relaxed">
                  Drag & drop or <span className="text-white/60 font-semibold">click to upload</span><br />
                  JPG, PNG, WebP · max 5 MB
                </p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Event Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Thursday Night Open Play"
              required
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Short Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Casual open play for all skill levels. Bring a board!"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className={labelCls}>
                <Calendar className="w-3 h-3 inline mr-1" />Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                <Clock className="w-3 h-3 inline mr-1" />Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className={labelCls}>
              <Repeat className="w-3 h-3 inline mr-1" />Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["popup", "weekly", "biweekly", "monthly"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className="py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={
                    frequency === f
                      ? { background: clubAccent, color: "#0a1a0f" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)" }
                  }
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
            {frequency !== "popup" && (
              <p className="text-white/30 text-xs mt-2">
                Creates up to {frequency === "monthly" ? "6 months" : "12 weeks"} of future instances automatically.
              </p>
            )}
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                <MapPin className="w-3 h-3 inline mr-1" />Venue
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="The Chess Lounge"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
                className={inputCls}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !title.trim() || !date}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
            style={{ background: clubAccent, color: "#0a1a0f" }}
          >
            {submitting
              ? "Creating…"
              : frequency === "popup"
              ? "Create Meetup"
              : `Create ${FREQ_LABELS[frequency]} Meetup Series`}
          </button>
        </form>
      </div>
    </div>
  );
}
