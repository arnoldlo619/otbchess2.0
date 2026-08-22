import { useRef, useState } from "react";
import { X, Loader2, Globe, Instagram } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

interface EditClubDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  currentDescription: string;
  currentLocation: string;
  currentWebsite?: string;
  currentInstagram?: string;
  onSave: (description: string, location: string, website: string, instagram: string) => Promise<void>;
}

export function EditClubDetailsModal({
  isOpen,
  onClose,
  clubId: _clubId,
  currentDescription,
  currentLocation,
  currentWebsite = "",
  currentInstagram = "",
  onSave,
}: EditClubDetailsModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [description, setDescription] = useState(currentDescription);
  const [location, setLocation] = useState(currentLocation);
  const [website, setWebsite] = useState(currentWebsite);
  const [instagram, setInstagram] = useState(currentInstagram);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useAccessibleOverlay({
    open: isOpen,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: descriptionRef,
  });

  const handleSave = async () => {
    setError(null);
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!location.trim()) {
      setError("Location is required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(description.trim(), location.trim(), website.trim(), instagram.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const bgColor = isDark ? "bg-[#0f1419]" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-[#ADBC9F]";
  const textColor = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/60" : "text-[#436850]";
  const inputBg = isDark ? "bg-white/5" : "bg-[#FBFADA]/70";
  const inputBorder = isDark ? "border-white/10" : "border-[#ADBC9F]";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-club-details-title"
          tabIndex={-1}
          className={`${bgColor} border ${borderColor} rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${borderColor}`}>
            <h2 id="edit-club-details-title" className={`text-lg font-semibold ${textColor}`}>Edit Club Details</h2>
            <button
              onClick={onClose}
              aria-label="Close edit club details"
              className={`p-1 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-[#ADBC9F]/50"}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Description Field */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${textColor}`}>
                Description
              </label>
              <textarea
                ref={descriptionRef}
                aria-label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter club description"
                className={`w-full px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none`}
                rows={4}
                maxLength={500}
              />
              <p className={`text-xs mt-1 ${textMuted}`}>
                {description.length}/500 characters
              </p>
            </div>

            {/* Location Field */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${textColor}`}>
                Location
              </label>
              <input
                aria-label="Location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className={`w-full px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
            </div>

            {/* Website Field */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${textColor} flex items-center gap-2`}>
                <Globe className="w-4 h-4 opacity-60" />
                Website
              </label>
              <input
                aria-label="Website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourclub.com"
                className={`w-full px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
            </div>

            {/* Instagram Field */}
            <div>
              <label className={`block text-sm font-semibold mb-2 ${textColor} flex items-center gap-2`}>
                <Instagram className="w-4 h-4 opacity-60" />
                Instagram
              </label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold ${textMuted}`}>@</span>
                <input
                  aria-label="Instagram"
                  type="text"
                  value={instagram.replace(/^@/, "")}
                  onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                  placeholder="yourclub"
                  className={`w-full pl-8 pr-4 py-3 rounded-xl border ${inputBorder} ${inputBg} ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500`}
                />
              </div>
              <p className={`text-xs mt-1 ${textMuted}`}>Enter your Instagram handle without the @ symbol</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`flex gap-3 p-6 border-t ${borderColor}`}>
            <button
              onClick={onClose}
              disabled={isSaving}
              className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all ${
                isDark
                  ? "bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
                  : "bg-[#ADBC9F]/40 text-[#12372A] hover:bg-[#ADBC9F] disabled:opacity-50"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: isSaving ? "rgba(76, 175, 80, 0.6)" : "#4CAF50",
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
