import { useEffect, useState, type ElementType, type FocusEvent } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const OTB_THUMBNAIL_LOGO = "/manus-storage/otb-logo-exclamation-256_9b50f5ee.webp";

export type ClubDashboardSidebarItem = {
  id: string;
  label: string;
  icon: ElementType;
  badge?: number;
  group: "workspace" | "manage";
};

type ClubDashboardSidebarProps = {
  accent: string;
  background: string;
  borderColor: string;
  brandImageSrc?: string | null;
  brandLabel?: string;
  brandActionLabel?: string;
  items: ClubDashboardSidebarItem[];
  activeId: string;
  collapsed: boolean;
  temporarilyExpanded: boolean;
  onPointerExpandedChange: (expanded: boolean) => void;
  onFocusExpandedChange: (expanded: boolean) => void;
  onSelect: (id: string) => void;
  onBackToClubs: () => void;
  footerAction?: {
    label: string;
    onClick: () => void;
    icon: ElementType;
  };
};

function badgeLabel(value: number) {
  return value > 9 ? "9+" : String(value);
}

export function ClubDashboardSidebar({
  accent,
  background,
  borderColor,
  brandImageSrc,
  brandLabel,
  brandActionLabel = "Back to all clubs",
  items,
  activeId,
  collapsed,
  temporarilyExpanded,
  onPointerExpandedChange,
  onFocusExpandedChange,
  onSelect,
  onBackToClubs,
  footerAction,
}: ClubDashboardSidebarProps) {
  const expanded = !collapsed || temporarilyExpanded;
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [brandImageFailed, setBrandImageFailed] = useState(false);
  const workspaceItems = items.filter((item) => item.group === "workspace");
  const settingsItem = items.find((item) => item.group === "manage" && item.id === "settings");
  const primaryItems = [...workspaceItems, ...items.filter((item) => item.group === "manage" && item.id !== "settings")];
  const displayedBrandImageSrc = brandImageSrc && !brandImageFailed ? brandImageSrc : OTB_THUMBNAIL_LOGO;
  const displayedBrandLabel = brandImageSrc && !brandImageFailed ? (brandLabel ?? "Club") : "OTB!!";

  useEffect(() => {
    setBrandImageFailed(false);
  }, [brandImageSrc]);

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      onFocusExpandedChange(false);
    }
  }

  function renderItem(item: ClubDashboardSidebarItem) {
    const Icon = item.icon;
    const active = activeId === item.id;
    const badge = item.badge ?? 0;
    const button = (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHoveredItemId(item.id);
        }}
        onPointerLeave={() => setHoveredItemId(null)}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className="group relative flex cursor-pointer items-center rounded-xl text-left outline-none transition-[width,height,margin,padding,gap,background-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07140c] motion-reduce:transition-none"
        style={{
          justifyContent: expanded ? "flex-start" : "center",
          gap: expanded ? "12px" : 0,
          paddingInline: expanded ? "12px" : 0,
          width: expanded ? "calc(100% - 4px)" : "52px",
          height: "52px",
          alignSelf: "center",
          marginInlineStart: expanded ? "2px" : 0,
          color: active ? "#ffffff" : "rgba(229, 238, 232, 0.68)",
          background: active ? `color-mix(in srgb, ${accent} 14%, transparent)` : hoveredItemId === item.id ? `color-mix(in srgb, ${accent} 8%, transparent)` : "transparent",
          border: active ? `1px solid color-mix(in srgb, ${accent} 52%, transparent)` : hoveredItemId === item.id ? `1px solid color-mix(in srgb, ${accent} 27%, transparent)` : "1px solid transparent",
          boxShadow: active ? `inset 0 1px 0 color-mix(in srgb, ${accent} 32%, transparent), 0 5px 14px rgb(0 0 0 / 0.13)` : hoveredItemId === item.id ? `inset 0 1px 0 color-mix(in srgb, ${accent} 16%, transparent)` : "none",
          // @ts-expect-error CSS custom property is supported by React at runtime.
          "--tw-ring-color": accent,
        }}
      >
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center rounded-xl transition-[background-color,border-color,color,transform,opacity] duration-200 ease-out motion-reduce:transition-none"
          style={{
            width: "40px",
            height: "40px",
            color: active || hoveredItemId === item.id ? accent : "inherit",
            background: active ? `color-mix(in srgb, ${accent} 17%, transparent)` : hoveredItemId === item.id ? `color-mix(in srgb, ${accent} 8%, rgba(255,255,255,0.045))` : "transparent",
            border: active ? `1px solid color-mix(in srgb, ${accent} 24%, transparent)` : "1px solid transparent",
            opacity: active || hoveredItemId === item.id ? 1 : 0.82,
            transform: hoveredItemId === item.id ? "translateY(-1px) scale(1.04)" : "scale(1)",
          }}
        >
          <Icon size={22} strokeWidth={active ? 2 : 1.7} />
        </span>
        <span
          className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
          style={{
            flex: expanded ? "1 1 0%" : "0 0 0",
            overflow: expanded ? "visible" : "hidden",
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateX(0)" : "translateX(-5px)",
            transitionDelay: expanded ? "95ms" : "0ms",
            pointerEvents: "none",
          }}
          aria-hidden={!expanded}
        >
          {item.label}
        </span>
        {badge > 0 && (
          <span
            className={`flex shrink-0 items-center justify-center rounded-md border font-semibold tabular-nums ${expanded ? "h-5 min-w-5 px-1.5 text-[10px]" : "absolute right-1 top-1 h-4 min-w-4 px-1 text-[9px]"}`}
            style={{
              color: "#fecaca",
              background: "rgba(239,68,68,0.12)",
              borderColor: "rgba(248,113,113,0.24)",
            }}
            aria-label={`${badge} upcoming`}
          >
            {badgeLabel(badge)}
          </span>
        )}
      </button>
    );

    if (expanded) return <div key={item.id}>{button}</div>;

    return (
      <Tooltip key={item.id} delayDuration={250}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={10}
          className="border border-white/10 bg-[#101d15] px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl"
        >
          {item.label}{badge > 0 ? ` · ${badgeLabel(badge)}` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  function renderGroup(groupItems: ClubDashboardSidebarItem[]) {
    if (groupItems.length === 0) return null;
    return (
      <div className="space-y-1">{groupItems.map(renderItem)}</div>
    );
  }

  function renderFooter() {
    if (!footerAction) return settingsItem ? renderItem(settingsItem) : null;

    const FooterIcon = footerAction.icon;
    return (
      <button
        type="button"
        onClick={footerAction.onClick}
        aria-label={footerAction.label}
        className="flex h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-semibold text-[rgba(229,238,232,0.68)] outline-none transition-[background-color,color,transform] duration-200 ease-out hover:bg-white/[0.055] hover:text-white active:scale-[0.98] focus-visible:ring-2 motion-reduce:transition-none"
        style={{
          // @ts-expect-error CSS custom property is supported by React at runtime.
          "--tw-ring-color": accent,
        }}
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center"><FooterIcon size={22} strokeWidth={1.8} /></span>
        <span
          className="min-w-0 truncate transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
          style={{ opacity: expanded ? 1 : 0, transform: expanded ? "translateX(0)" : "translateX(-5px)", transitionDelay: expanded ? "95ms" : "0ms" }}
          aria-hidden={!expanded}
        >
          {footerAction.label}
        </span>
      </button>
    );
  }

  return (
    // Pointer hover temporarily reveals labels; the equivalent focus-capture path preserves keyboard access.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      aria-label="Club dashboard sidebar"
      className="absolute inset-y-0 left-0 z-50 hidden flex-col overflow-hidden border-r shadow-none transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:flex"
      onMouseEnter={() => onPointerExpandedChange(true)}
      onMouseLeave={() => onPointerExpandedChange(false)}
      onFocusCapture={() => onFocusExpandedChange(true)}
      onBlurCapture={handleBlur}
      style={{
        width: expanded ? "264px" : "72px",
        backgroundColor: background,
        backgroundImage: "repeating-conic-gradient(rgb(255 255 255 / 0.018) 0% 25%, transparent 0% 50%)",
        backgroundSize: "12px 12px",
        borderColor,
        boxShadow: expanded && collapsed ? "12px 0 36px rgba(0,0,0,0.26)" : "none",
      }}
      >
      <div className="px-1 py-3">
        <div
          className="flex h-16 items-center overflow-hidden"
          style={{ justifyContent: expanded ? "flex-start" : "center", paddingInlineStart: expanded ? "10px" : 0 }}
        >
          <button
            type="button"
            onClick={onBackToClubs}
            aria-label={brandActionLabel}
            className="group/brand relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-transparent outline-none transition-[opacity,transform] duration-200 ease-out hover:opacity-100 active:scale-[0.96] focus-visible:ring-2 motion-reduce:transition-none"
            style={{
              color: accent,
              // @ts-expect-error CSS custom property is supported by React at runtime.
              "--tw-ring-color": accent,
            }}
          >
            {/* The image-error handler swaps an unavailable Club asset for the branded fallback. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <img
              src={displayedBrandImageSrc}
              alt={displayedBrandLabel}
              className={`h-14 w-14 origin-center object-${brandImageSrc && !brandImageFailed ? "cover" : "contain"} transition-transform duration-200 ease-out motion-reduce:transition-none ${brandImageSrc && !brandImageFailed ? "rounded-2xl border border-white/10" : ""}`}
              style={{
                transform: expanded ? "scale(1.04)" : "scale(1)",
              }}
              onError={() => setBrandImageFailed(true)}
              draggable={false}
            />
          </button>
        </div>
      </div>

      <nav
        aria-label="Club dashboard navigation"
        className="flex flex-1 flex-col justify-center overflow-y-auto px-3 py-5"
      >
        {renderGroup(primaryItems)}
      </nav>

      {(footerAction || settingsItem) && (
        <footer aria-label="Club dashboard footer navigation" className="border-t border-white/[0.065] px-3 py-3">
          {renderFooter()}
        </footer>
      )}
    </aside>
  );
}
