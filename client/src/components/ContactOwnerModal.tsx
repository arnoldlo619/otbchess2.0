/**
 * ContactOwnerModal
 *
 * Opens when a user clicks "Contact Club Owner" on a club profile.
 * Calls POST /api/clubs/:clubId/contact-owner to get-or-create a DM
 * conversation with the owner and send the initial message in one shot.
 *
 * Props:
 *   isOpen       — controls visibility
 *   onClose      — called when the modal is dismissed
 *   clubId       — the club's ID
 *   ownerName    — display name of the club owner (for the heading)
 *   isDark       — theme flag
 */
import { useState, useRef, useEffect } from "react";
import { X, Send, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  ownerName: string;
  isDark: boolean;
}

const MAX_CHARS = 2000;

export function ContactOwnerModal({ isOpen, onClose, clubId, ownerName, isDark }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the modal opens
  useEffect(() => {
    if (isOpen && !sent) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [isOpen, sent]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setMessage("");
        setSent(false);
        setSending(false);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const card = isDark ? "bg-[#111c13]" : "bg-white";
  const cardBorder = isDark ? "border-white/10" : "border-gray-200";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";
  const inputBg = isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/25" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-400";
  const remaining = MAX_CHARS - message.length;
  const isOverLimit = remaining < 0;

  async function handleSend() {
    if (!message.trim() || isOverLimit || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/clubs/${clubId}/conversations/contact-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-3xl border ${cardBorder} ${card} shadow-2xl animate-in slide-in-from-bottom-4 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? "bg-[#4CAF50]/15" : "bg-[#3D6B47]/10"}`}>
              <MessageSquare className={`w-4.5 h-4.5 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
            </div>
            <div>
              <h2 className={`text-sm font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Contact Club Owner
              </h2>
              <p className={`text-xs ${textMuted}`}>Message to {ownerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {sent ? (
            /* Success state */
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isDark ? "bg-[#4CAF50]/15" : "bg-[#3D6B47]/10"}`}>
                <CheckCircle2 className={`w-7 h-7 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
              </div>
              <h3 className={`text-base font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Message Sent!
              </h3>
              <p className={`text-sm ${textMuted} max-w-xs`}>
                {ownerName} will see your message in their club inbox. They typically respond within 24 hours.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Compose state */
            <>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${textMuted}`}>
                Your message
              </label>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Hi ${ownerName}, I'd like to ask about…`}
                rows={5}
                maxLength={MAX_CHARS + 50}
                className={`w-full rounded-2xl border px-4 py-3 text-sm resize-none outline-none transition-colors ${inputBg}`}
              />
              <div className="flex items-center justify-between mt-2 mb-5">
                <p className={`text-xs ${textMuted}`}>
                  <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? "bg-white/8 text-white/40" : "bg-gray-100 text-gray-400"}`}>
                    ⌘ Enter
                  </kbd>
                  {" "}to send
                </p>
                <span className={`text-xs font-mono ${isOverLimit ? "text-red-400" : remaining < 100 ? "text-amber-400" : textMuted}`}>
                  {remaining}
                </span>
              </div>
              <button
                onClick={handleSend}
                disabled={!message.trim() || isOverLimit || sending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "oklch(0.55 0.13 145)", color: "#fff" }}
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? "Sending…" : "Send Message"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
