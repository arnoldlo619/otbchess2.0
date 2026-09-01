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
  clubName: string;
  clubAvatarUrl?: string | null;
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
  clubName,
  clubAvatarUrl,
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
          background: active ? `color-mix(in srgb, ${accent} 12%, #07140c)` : hoveredItemId === item.id ? `color-mix(in srgb, ${accent} 10%, #07140c)` : "transparent",
          borderColor: active ? `color-mix(in srgb, ${accent} 32%, transparent)` : hoveredItemId === item.id ? `color-mix(in srgb, ${accent} 24%, transparent)` : "transparent",
          boxShadow: active ? `inset 0 1px 0 color-mix(in srgb, ${accent} 16%, white)` : hoveredItemId === item.id ? `inset 2px 0 0 ${accent}, 0 5px 16px color-mix(in srgb, ${accent} 13%, transparent)` : "none",
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
          className="flex h-7 w-7 shrink-0 items-center justify-center transition-[color,transform,filter] duration-200 ease-out motion-reduce:transition-none"
          style={{
            color: active ? accent : "inherit",
            transform: hoveredItemId === item.id ? "scale(1.07)" : "scale(1)",
            filter: hoveredItemId === item.id ? "drop-shadow(0 0 5px rgba(111,255,156,0.34))" : "none",
          }}
        >
          <Icon size={21} strokeWidth={active ? 2 : 1.65} />
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

  const utilityButtonClass = "relative flex h-11 w-full items-center rounded-xl border border-transparent text-left text-white/55 outline-none transition-colors duration-150 hover:border-white/[0.06] hover:bg-white/[0.045] hover:text-white/85 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07140c] motion-reduce:transition-none";

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
      <div className="border-b border-white/[0.065] px-3 py-4">
        <div className="flex h-14 items-center">
          <button
            type="button"
            onClick={onBackToClubs}
            aria-label="Back to all clubs"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.035] outline-none transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.07] focus-visible:ring-2 motion-reduce:transition-none"
            style={{ color: accent, boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 8%, transparent)` }}
          >
            {clubAvatarUrl ? (
              <img src={clubAvatarUrl} alt="" className="h-full w-full rounded-[15px] object-cover" />
            ) : (
              <span className="text-sm font-bold">{clubName.charAt(0).toUpperCase()}</span>
            )}
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
