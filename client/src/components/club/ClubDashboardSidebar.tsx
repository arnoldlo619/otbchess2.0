import { useState, type ElementType, type FocusEvent } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  items: ClubDashboardSidebarItem[];
  activeId: string;
  collapsed: boolean;
  temporarilyExpanded: boolean;
  onPointerExpandedChange: (expanded: boolean) => void;
  onFocusExpandedChange: (expanded: boolean) => void;
  onSelect: (id: string) => void;
  onBackToClubs: () => void;
};

function badgeLabel(value: number) {
  return value > 9 ? "9+" : String(value);
}

export function ClubDashboardSidebar({
  accent,
  background,
  borderColor,
  items,
  activeId,
  collapsed,
  temporarilyExpanded,
  onPointerExpandedChange,
  onFocusExpandedChange,
  onSelect,
  onBackToClubs,
}: ClubDashboardSidebarProps) {
  const expanded = !collapsed || temporarilyExpanded;
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const workspaceItems = items.filter((item) => item.group === "workspace");
  const settingsItem = items.find((item) => item.id === "settings");
  const primaryItems = [...workspaceItems, ...items.filter((item) => item.group === "manage" && item.id !== "settings")];

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
        className="group relative flex items-center rounded-xl border text-left outline-none transition-[width,height,margin,padding,gap,background-color,border-color,color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07140c] motion-reduce:transition-none"
        style={{
          justifyContent: expanded ? "flex-start" : "center",
          gap: expanded ? "12px" : 0,
          paddingInline: expanded ? "12px" : 0,
          width: expanded ? "calc(100% - 4px)" : "42px",
          height: "42px",
          alignSelf: "center",
          marginInlineStart: expanded ? "2px" : 0,
          color: active ? "#ffffff" : "rgba(229, 238, 232, 0.68)",
          background: active ? `color-mix(in srgb, ${accent} 9%, #07140c)` : hoveredItemId === item.id ? `color-mix(in srgb, ${accent} 7%, #07140c)` : "transparent",
          borderColor: active ? `color-mix(in srgb, ${accent} 28%, transparent)` : hoveredItemId === item.id ? `color-mix(in srgb, ${accent} 20%, transparent)` : "transparent",
          boxShadow: active ? `inset 0 1px 0 color-mix(in srgb, ${accent} 14%, white), 0 7px 18px color-mix(in srgb, ${accent} 8%, transparent)` : hoveredItemId === item.id ? `inset 2px 0 0 ${accent}, 0 5px 16px color-mix(in srgb, ${accent} 11%, transparent)` : "none",
          // @ts-expect-error CSS custom property is supported by React at runtime.
          "--tw-ring-color": accent,
        }}
      >
        {active && expanded && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-3 h-5 w-0.5 rounded-r-full"
            style={{ background: accent }}
          />
        )}
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border transition-[background-color,border-color,color,transform,filter,box-shadow] duration-200 ease-out motion-reduce:transition-none"
          style={{
            color: active ? accent : "inherit",
            background: active ? `color-mix(in srgb, ${accent} 15%, transparent)` : hoveredItemId === item.id ? "rgba(255,255,255,0.055)" : "transparent",
            borderColor: active ? `color-mix(in srgb, ${accent} 35%, transparent)` : hoveredItemId === item.id ? "rgba(255,255,255,0.09)" : "transparent",
            transform: hoveredItemId === item.id ? "translateY(-1px) scale(1.04)" : "scale(1)",
            filter: hoveredItemId === item.id ? "drop-shadow(0 0 5px rgba(111,255,156,0.28))" : "none",
            boxShadow: active ? `inset 0 1px 0 color-mix(in srgb, ${accent} 18%, white)` : "none",
          }}
        >
          <Icon size={19} strokeWidth={active ? 2 : 1.7} />
        </span>
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
          style={{
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
        background,
        borderColor,
        boxShadow: expanded && collapsed ? "12px 0 36px rgba(0,0,0,0.26)" : "none",
      }}
    >
      <div className="border-b border-white/[0.065] px-2 py-4">
        <div className="flex h-14 items-center">
          <button
            type="button"
            onClick={onBackToClubs}
            aria-label="Back to all clubs"
            className="group/brand flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-transparent outline-none transition-[background-color,transform] duration-200 ease-out hover:bg-white/[0.045] active:scale-[0.96] focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: accent, "--tw-ring-color": accent } as React.CSSProperties}
          >
            <img src="/manus-storage/chessotb-wordmark-320_e1731168.webp" alt="OTB!!" className="h-auto w-11 object-contain transition-[opacity,transform] duration-200 ease-out group-hover/brand:scale-[1.04] group-hover/brand:opacity-95 motion-reduce:transition-none" />
          </button>
        </div>
      </div>

      <nav
        aria-label="Club dashboard navigation"
        className="flex flex-1 flex-col justify-center overflow-y-auto px-3 py-5"
      >
        {renderGroup(primaryItems)}
      </nav>

      <div className="border-t border-white/[0.065] px-3 py-3">
        {settingsItem && renderItem(settingsItem)}
      </div>
    </aside>
  );
}
