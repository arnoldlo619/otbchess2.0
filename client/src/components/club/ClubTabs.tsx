/**
 * ClubTabs — Premium horizontal tab bar for the club profile page.
 * Five tabs: Home | Feed | Events | Members | Leagues
 */
import React from "react";
import {
  FeedIcon,
  EventsIcon,
  MembersIcon,
  LeaguesIcon,
  HomeIcon,
} from "@/components/OtbIcons";

export type ClubTab = "home" | "feed" | "events" | "members" | "leagues";

interface TabConfig {
  id: ClubTab;
  label: string;
  icon: (props: { size?: number; accentColor?: string }) => React.ReactElement;
  badge?: number;
}

interface ClubTabsProps {
  activeTab: ClubTab;
  onChange: (tab: ClubTab) => void;
  seenTabs: Set<ClubTab>;
  badges: Partial<Record<ClubTab, number>>;
  accent: string;
  isDark: boolean;
}

export function ClubTabs({ activeTab, onChange, seenTabs, badges, accent, isDark }: ClubTabsProps) {
  const tabs: TabConfig[] = [
    { id: "home",    label: "Home",    icon: HomeIcon },
    { id: "feed",    label: "Feed",    icon: FeedIcon },
    { id: "events",  label: "Events",  icon: EventsIcon },
    { id: "members", label: "Members", icon: MembersIcon },
    { id: "leagues", label: "Leagues", icon: LeaguesIcon },
  ];

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto scrollbar-none"
      style={{
        padding: "4px",
        borderRadius: "18px",
        background: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(67,104,80,0.08)",
        border: isDark
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(67,104,80,0.18)",
        boxShadow: isDark
          ? "none"
          : "inset 0 1px 2px rgba(67,104,80,0.06)",
      }}
      role="tablist"
      aria-label="Club sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const unseen = !seenTabs.has(tab.id);
        const badgeCount = unseen ? (badges[tab.id] ?? 0) : 0;
        const iconColor = isActive
          ? accent
          : isDark ? "rgba(255,255,255,0.35)" : "rgba(67,104,80,0.55)";

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 group"
            style={{
              background: isActive
                ? isDark
                  ? `linear-gradient(135deg, ${accent}22, ${accent}12)`
                  : `rgba(67,104,80,0.12)`
                : "transparent",
              color: isActive
                ? isDark ? accent : "rgba(18,55,42,0.95)"
                : isDark ? "rgba(255,255,255,0.42)" : "rgba(67,104,80,0.65)",
              border: isActive
                ? isDark
                  ? `1px solid ${accent}33`
                  : "1px solid rgba(67,104,80,0.22)"
                : "1px solid transparent",
              boxShadow: isActive && isDark
                ? `0 2px 12px ${accent}18`
                : "none",
              outlineColor: accent,
            }}
          >
            <span
              className="transition-all duration-200 group-hover:scale-110 group-active:scale-95"
              style={{
                color: iconColor,
                filter: isActive ? `drop-shadow(0 0 5px ${accent}88)` : "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <tab.icon
                size={15}
                accentColor={isActive ? accent : undefined}
              />
            </span>
            <span>{tab.label}</span>
            {badgeCount > 0 && (
              <span
                className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
