import { useMemo, useRef, useState, type ElementType } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { useAccessibleOverlay } from "@/hooks/useAccessibleOverlay";

export interface LeagueMobileTabItem<TId extends string = string> {
  id: TId;
  label: string;
  icon: ElementType;
  badge?: number;
}

interface LeagueMobileTabBarProps<TId extends string> {
  items: Array<LeagueMobileTabItem<TId>>;
  activeId: TId;
  onSelect: (id: TId) => void;
  isDark: boolean;
  accent: string;
  textMain: string;
  textMuted: string;
  ariaLabel: string;
}

const PRIMARY_TAB_PRIORITY = ["overview", "commissioner", "matchup", "matchups", "standings", "schedule"];
const PRIMARY_TAB_LIMIT = 4;
const MOBILE_LABELS: Record<string, string> = {
  overview: "Home",
  commissioner: "Manage",
  matchup: "Match",
  matchups: "Matches",
  standings: "Ranks",
  schedule: "Plan",
};

/**
 * Keeps League phone navigation touch-safe even when commissioner-only routes
 * add more destinations than a compact bottom dock can display clearly.
 */
export function LeagueMobileTabBar<TId extends string>({
  items,
  activeId,
  onSelect,
  isDark,
  accent,
  textMain,
  textMuted,
  ariaLabel,
}: LeagueMobileTabBarProps<TId>) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const { primaryItems, overflowItems } = useMemo(() => {
    const priorityIndex = new Map(PRIMARY_TAB_PRIORITY.map((id, index) => [id, index]));
    const ordered = items.slice().sort((left, right) => (
      (priorityIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (priorityIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    ));
    const primary = ordered.slice(0, PRIMARY_TAB_LIMIT);
    return {
      primaryItems: primary,
      overflowItems: items.filter((item) => !primary.some((primaryItem) => primaryItem.id === item.id)),
    };
  }, [items]);

  const hasOverflow = overflowItems.length > 0;
  const isMoreActive = overflowItems.some((item) => item.id === activeId);

  const closeMore = () => setIsMoreOpen(false);
  const selectTab = (id: TId) => {
    onSelect(id);
    closeMore();
  };

  useAccessibleOverlay({
    open: isMoreOpen,
    onClose: closeMore,
    containerRef: sheetRef,
    initialFocusRef: closeButtonRef,
  });

  const inactiveColor = isDark ? "oklch(0.68 0.05 145)" : textMuted;
  const surface = isDark ? "oklch(0.14 0.04 145 / 0.98)" : "rgba(255,255,255,0.98)";
  const border = isDark ? "oklch(0.24 0.06 145)" : "oklch(0.88 0.03 145)";
  const sheetSurface = isDark ? "oklch(0.17 0.05 145)" : "oklch(0.98 0.015 145)";

  const TabButton = ({ item }: { item: LeagueMobileTabItem<TId> }) => {
    const Icon = item.icon;
    const isActive = activeId === item.id;
    const badge = item.badge ?? 0;
    const visualLabel = MOBILE_LABELS[item.id] ?? item.label;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => selectTab(item.id)}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        className="relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 transition-[background-color,color,transform] duration-200 ease-out active:scale-95 motion-reduce:transition-none"
        style={{
          color: isActive ? accent : inactiveColor,
          background: isActive ? `${accent}14` : "transparent",
          touchAction: "manipulation",
        }}
      >
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute inset-x-3 top-0 h-0.5 rounded-full"
            style={{ background: accent }}
          />
        )}
        <span className={`otb-nav-tap otb-icon${isActive ? " otb-icon--active" : ""}`} aria-hidden="true">
          <Icon size={19} />
        </span>
        <span className="max-w-full truncate text-[10px] font-semibold leading-none">{visualLabel}</span>
        {badge > 0 && (
          <span
            aria-label={`${badge} pending`}
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white shadow-sm"
            style={{ background: "#ef4444" }}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <nav
        data-testid="league-mobile-tab-bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t px-1.5 pt-1.5 lg:hidden"
        aria-label={ariaLabel}
        style={{
          background: surface,
          borderColor: border,
          backdropFilter: "blur(18px) saturate(1.35)",
          WebkitBackdropFilter: "blur(18px) saturate(1.35)",
          paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-0.5">
          {primaryItems.map((item) => <TabButton key={item.id} item={item} />)}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              aria-label="More League destinations"
              aria-haspopup="dialog"
              aria-expanded={isMoreOpen}
              aria-current={isMoreActive ? "page" : undefined}
              className="relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 transition-[background-color,color,transform] duration-200 ease-out active:scale-95 motion-reduce:transition-none"
              style={{
                color: isMoreActive ? accent : inactiveColor,
                background: isMoreActive ? `${accent}14` : "transparent",
                touchAction: "manipulation",
              }}
            >
              {isMoreActive && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full" style={{ background: accent }} />}
              <span className={`otb-nav-tap otb-icon${isMoreActive ? " otb-icon--active" : ""}`} aria-hidden="true"><MoreHorizontal size={20} /></span>
              <span className="text-[10px] font-semibold leading-none">More</span>
            </button>
          )}
        </div>
      </nav>

      {isMoreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Dismiss League navigation"
            onClick={closeMore}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[3px]"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="league-mobile-more-title"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border px-4 pt-3 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200"
            style={{
              background: sheetSurface,
              borderColor: border,
              borderBottom: "none",
              paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="mb-4 flex justify-center"><span aria-hidden="true" className="h-1 w-10 rounded-full" style={{ background: isDark ? "oklch(0.34 0.06 145)" : "oklch(0.78 0.04 145)" }} /></div>
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p id="league-mobile-more-title" className="text-base font-black tracking-tight" style={{ color: textMain }}>League navigation</p>
                <p className="mt-0.5 text-xs" style={{ color: textMuted }}>More places in this league</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMore}
                aria-label="Close League navigation"
                className="flex h-11 w-11 items-center justify-center rounded-full border transition-transform active:scale-95"
                style={{ background: isDark ? "oklch(0.23 0.06 145)" : "oklch(0.93 0.025 145)", borderColor: border, color: textMain }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeId === item.id;
                const badge = item.badge ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] motion-reduce:transition-none"
                    style={{
                      background: isActive ? `${accent}14` : (isDark ? "oklch(0.20 0.05 145)" : "oklch(1 0 0)"),
                      borderColor: isActive ? `${accent}60` : border,
                      color: isActive ? accent : textMain,
                      touchAction: "manipulation",
                    }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: isActive ? `${accent}20` : (isDark ? "oklch(0.24 0.055 145)" : "oklch(0.94 0.025 145)") }}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold">{item.label}</span>
                    {badge > 0 && <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-black text-white" style={{ background: "#ef4444" }}>{badge} pending</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
