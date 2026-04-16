/**
 * InstallBanner
 *
 * A bottom-anchored mobile strip that prompts users to install the OTB Chess PWA.
 *
 * Variants:
 * - Android/Chrome: one-tap native install via beforeinstallprompt
 * - iOS Safari: "Add" button opens a step-by-step instruction sheet
 *
 * Behavior:
 * - Hidden on md+ screens (desktop)
 * - Slides up from the bottom with a spring animation
 * - Dismissed banner re-appears after 7 days
 * - Never re-appears after the app is installed
 * - Respects prefers-reduced-motion
 * - Fully ARIA-labelled for screen readers
 */

import { useState } from "react";
import { X, Share, Plus, Download, Smartphone } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useTheme } from "@/contexts/ThemeContext";

export function InstallBanner() {
  const { showBanner, platform, promptInstall, dismissBanner } = usePwaInstall();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!showBanner) return null;

  const handleInstallClick = async () => {
    if (platform === "ios") {
      setIosSheetOpen(true);
    } else {
      setInstalling(true);
      await promptInstall();
      setInstalling(false);
    }
  };

  return (
    <>
      {/* ── Main banner strip ─────────────────────────────────────────────── */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-[80]
          md:hidden
          safe-bottom
          animate-slide-up-banner
          ${isDark
            ? "bg-[oklch(0.20_0.055_145)] border-t border-white/10"
            : "bg-white border-t border-[#3D6B47]/15"
          }
          shadow-[0_-4px_32px_oklch(0_0_0/0.15)]
        `}
        role="complementary"
        aria-label="Install OTB Chess app"
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* App icon */}
          <div
            className={`
              w-11 h-11 rounded-[14px] flex-shrink-0 overflow-hidden
              ring-1 ${isDark ? "ring-white/10" : "ring-[#3D6B47]/15"}
              shadow-sm
            `}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/icon-192x192_1d5ec0c4.png"
              alt="OTB Chess app icon"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>

          {/* Copy */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              OTB Chess
            </p>
            <p className={`text-xs leading-snug mt-0.5 ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {platform === "ios"
                ? "Add to Home Screen for quick access"
                : "Install for offline access & faster load"}
            </p>
          </div>

          {/* Install CTA */}
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className={`
              flex-shrink-0 flex items-center gap-1.5
              text-xs font-semibold px-3.5 py-2 rounded-lg
              transition-all duration-150 active:scale-95
              disabled:opacity-60
              ${isDark
                ? "bg-[oklch(0.52_0.14_145)] hover:bg-[oklch(0.58_0.15_145)] text-white"
                : "bg-[#3D6B47] hover:bg-[#2d5538] text-white"
              }
            `}
            aria-label={platform === "ios" ? "Show install instructions for iOS" : "Install OTB Chess app"}
          >
            {installing ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : platform === "ios" ? (
              <><Share className="w-3.5 h-3.5" /><span>Add</span></>
            ) : (
              <><Download className="w-3.5 h-3.5" /><span>Install</span></>
            )}
          </button>

          {/* Dismiss */}
          <button
            onClick={dismissBanner}
            className={`
              flex-shrink-0 p-1.5 rounded-lg transition-colors
              ${isDark
                ? "text-white/35 hover:text-white/65 hover:bg-white/06"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }
            `}
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress indicator — subtle green line at top of banner */}
        <div
          className={`absolute top-0 left-0 right-0 h-px ${
            isDark ? "bg-[oklch(0.52_0.14_145)]/40" : "bg-[#3D6B47]/20"
          }`}
          aria-hidden="true"
        />
      </div>

      {/* ── iOS instruction sheet ──────────────────────────────────────────── */}
      {iosSheetOpen && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          className="fixed inset-0 z-[90] md:hidden flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="How to add OTB Chess to your Home Screen"
          onClick={() => setIosSheetOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setIosSheetOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

          {/* Sheet */}
          <div
            className={`
              relative rounded-t-3xl px-5 pt-4 pb-8 safe-bottom
              animate-slide-up-banner
              ${isDark
                ? "bg-[oklch(0.20_0.055_145)] border-t border-white/10"
                : "bg-white border-t border-gray-100"
              }
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div
              className={`w-10 h-1 rounded-full mx-auto mb-5 ${isDark ? "bg-white/20" : "bg-gray-200"}`}
              aria-hidden="true"
            />

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? "bg-[oklch(0.52_0.14_145)]/20" : "bg-[#3D6B47]/08"}`}>
                <Smartphone className={`w-5 h-5 ${isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#3D6B47]"}`} />
              </div>
              <div>
                <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Add to Home Screen
                </h2>
                <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                  3 quick steps in Safari
                </p>
              </div>
            </div>

            {/* Steps */}
            <ol className="space-y-3 mb-6" aria-label="Installation steps">
              {[
                {
                  icon: <Share className="w-4.5 h-4.5" />,
                  step: "1",
                  title: "Tap Share",
                  text: "Tap the Share button at the bottom of your Safari browser",
                },
                {
                  icon: <Plus className="w-4.5 h-4.5" />,
                  step: "2",
                  title: "Add to Home Screen",
                  text: 'Scroll down in the share sheet and tap "Add to Home Screen"',
                },
                {
                  icon: (
                    <img
                      src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/icon-192x192_1d5ec0c4.png"
                      alt=""
                      className="w-4.5 h-4.5 object-contain rounded-md"
                    />
                  ),
                  step: "3",
                  title: 'Tap "Add"',
                  text: "OTB Chess will appear on your home screen like a native app",
                },
              ].map(({ icon, step, title, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <div
                    className={`
                      w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center
                      ${isDark
                        ? "bg-[oklch(0.52_0.14_145)]/15 text-[oklch(0.65_0.14_145)]"
                        : "bg-[#3D6B47]/08 text-[#3D6B47]"
                      }
                    `}
                    aria-hidden="true"
                  >
                    {icon}
                  </div>
                  <div className="pt-1">
                    <p className={`text-sm font-semibold leading-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                      {title}
                    </p>
                    <p className={`text-xs leading-relaxed mt-0.5 ${isDark ? "text-white/55" : "text-gray-500"}`}>
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {/* CTA */}
            <button
              onClick={() => { setIosSheetOpen(false); dismissBanner(); }}
              className={`
                w-full py-3.5 rounded-2xl text-sm font-semibold
                transition-all duration-150 active:scale-98
                ${isDark
                  ? "bg-white/08 text-white/70 hover:bg-white/12"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
