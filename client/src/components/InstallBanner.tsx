/**
 * InstallBanner
 *
 * A bottom-anchored mobile strip that prompts users to install the OTB Chess PWA.
 * - Android/Chrome: one-tap native install via beforeinstallprompt
 * - iOS Safari: manual instruction sheet (Share → Add to Home Screen)
 *
 * Only rendered on mobile (hidden on md+). Slides up from the bottom with a
 * spring animation. Respects the platform's design system (green brand, cream
 * accents, safe-area insets for iOS home indicator).
 */

import { useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useTheme } from "@/contexts/ThemeContext";

export function InstallBanner() {
  const { showBanner, platform, promptInstall, dismissBanner } = usePwaInstall();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [iosSheetOpen, setIosSheetOpen] = useState(false);

  if (!showBanner) return null;

  const handleInstallClick = () => {
    if (platform === "ios") {
      setIosSheetOpen(true);
    } else {
      promptInstall();
    }
  };

  return (
    <>
      {/* ── Main banner strip ─────────────────────────────────────────────── */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50
          md:hidden
          safe-bottom
          animate-slide-up-banner
          ${isDark
            ? "bg-[oklch(0.23_0.065_145)] border-t border-white/10"
            : "bg-white border-t border-[#3D6B47]/12"
          }
          shadow-[0_-4px_24px_oklch(0_0_0/0.12)]
        `}
        role="banner"
        aria-label="Install OTB Chess"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* App icon */}
          <div className={`w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden border ${isDark ? "border-white/10" : "border-[#3D6B47]/15"}`}>
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
              alt="OTB Chess"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Copy */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-tight truncate ${isDark ? "text-white" : "text-[#1A1A1A]"}`}>
              OTB Chess
            </p>
            <p className={`text-xs leading-tight mt-0.5 ${isDark ? "text-white/55" : "text-[#6B7280]"}`}>
              Add to Home Screen for quick access
            </p>
          </div>

          {/* Install CTA */}
          <button
            onClick={handleInstallClick}
            className={`
              flex-shrink-0 flex items-center gap-1.5
              text-xs font-semibold px-3 py-2 rounded-lg
              transition-all duration-150 active:scale-95
              ${isDark
                ? "bg-[oklch(0.55_0.13_145)] text-white"
                : "bg-[#3D6B47] text-white"
              }
            `}
            aria-label={platform === "ios" ? "Show install instructions" : "Install app"}
          >
            {platform === "ios"
              ? <><Share className="w-3.5 h-3.5" /> Add</>
              : <><Download className="w-3.5 h-3.5" /> Install</>
            }
          </button>

          {/* Dismiss */}
          <button
            onClick={dismissBanner}
            className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${isDark ? "text-white/40 hover:text-white/70" : "text-[#9CA3AF] hover:text-[#4B5563]"}`}
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── iOS instruction sheet ──────────────────────────────────────────── */}
      {iosSheetOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end"
          onClick={() => setIosSheetOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className={`
              relative rounded-t-2xl px-5 pt-5 pb-8 safe-bottom
              animate-slide-up-banner
              ${isDark ? "bg-[oklch(0.23_0.065_145)]" : "bg-white"}
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className={`w-10 h-1 rounded-full mx-auto mb-5 ${isDark ? "bg-white/20" : "bg-[#D1D5DB]"}`} />

            <h2 className={`text-base font-semibold mb-1 ${isDark ? "text-white" : "text-[#1A1A1A]"}`}>
              Add OTB Chess to Home Screen
            </h2>
            <p className={`text-sm mb-5 ${isDark ? "text-white/55" : "text-[#6B7280]"}`}>
              Follow these steps in Safari to install the app:
            </p>

            {/* Steps */}
            <ol className="space-y-4">
              {[
                {
                  icon: <Share className="w-5 h-5" />,
                  step: "1",
                  text: <>Tap the <strong>Share</strong> button at the bottom of Safari</>,
                },
                {
                  icon: <Plus className="w-5 h-5" />,
                  step: "2",
                  text: <>Scroll down and tap <strong>"Add to Home Screen"</strong></>,
                },
                {
                  icon: (
                    <img
                      src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
                      alt=""
                      className="w-5 h-5 object-contain"
                    />
                  ),
                  step: "3",
                  text: <>Tap <strong>"Add"</strong> — OTB Chess will appear on your home screen</>,
                },
              ].map(({ icon, step, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${isDark ? "bg-[oklch(0.55_0.13_145)]/20 text-[oklch(0.65_0.14_145)]" : "bg-[#3D6B47]/08 text-[#3D6B47]"}`}>
                    {icon}
                  </div>
                  <p className={`text-sm leading-relaxed pt-1.5 ${isDark ? "text-white/80" : "text-[#374151]"}`}>
                    {text}
                  </p>
                </li>
              ))}
            </ol>

            <button
              onClick={() => { setIosSheetOpen(false); dismissBanner(); }}
              className={`
                mt-6 w-full py-3 rounded-xl text-sm font-semibold
                transition-all duration-150 active:scale-98
                ${isDark
                  ? "bg-white/08 text-white/70"
                  : "bg-[#F3F4F6] text-[#4B5563]"
                }
              `}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
