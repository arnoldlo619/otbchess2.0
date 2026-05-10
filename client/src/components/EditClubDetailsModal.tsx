import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface EditClubDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  currentDescription: string;
  currentLocation: string;
  onSave: (description: string, location: string) => Promise<void>;
}

export function EditClubDetailsModal({
  isOpen,
  onClose,
  clubId,
  currentDescription,
  currentLocation,
  onSave,
}: EditClubDetailsModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [description, setDescription] = useState(currentDescription);
  const [location, setLocation] = useState(currentLocation);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSave(description.trim(), location.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const bgColor = isDark ? "bg-[#0f1419]" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-gray-200";
  const textColor = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/60" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";
  const accent = "#4CAF50";

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
          className={`${bgColor} border ${borderColor} rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${borderColor}`}>
            <h2 className={`text-lg font-semibold ${textColor}`}>Edit Club Details</h2>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
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
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className={`w-full px-4 py-3 rounded-xl border ${inputBorder} ${inputBg} ${textColor} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500`}
              />
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
                  : "bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50"
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
