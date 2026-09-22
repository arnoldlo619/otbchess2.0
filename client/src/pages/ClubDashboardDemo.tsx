/**
 * ClubDashboardDemo — /clubs/demo
 *
 * Read-only, fixture-only representation of the real Club Dashboard. It uses the
 * production workspace shell and navigation components while deliberately making
 * no Club API requests or exposing any real Club data.
 */
import { useState, type ElementType } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ShaderBackground } from "@/components/ui/shader-r";
import { ClubDashboardSidebar } from "@/components/club/ClubDashboardSidebar";
import { TabTransition } from "@/components/TabTransition";
import {
  AlbumIcon,
  DashboardIcon,
  EventsIcon,
  FeedIcon,
  MembersIcon,
  SettingsIcon,
} from "@/components/OtbIcons";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderLock,
  Image as ImageIcon,
  MapPin,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings2,
  Trophy,
  Users,
  X,
} from "lucide-react";

type DemoTab = "overview" | "feed" | "album" | "events" | "members" | "settings";

type DemoNavItem = {
  id: DemoTab;
  label: string;
  icon: ElementType;
  badge?: number;
  group: "workspace" | "manage";
};

const DEMO_ACCENT = "#4CAF50";
const NAV_BG = "oklch(0.15 0.04 145 / 0.78)";
const NAV_BORDER = "oklch(0.22 0.06 145)";
const SURFACE = "oklch(0.155 0.045 145)";
const SURFACE_BORDER = "rgba(255,255,255,0.08)";

const DEMO_NAV: DemoNavItem[] = [
  { id: "overview", label: "Overview", icon: DashboardIcon, group: "workspace" },
  { id: "feed", label: "Feed", icon: FeedIcon, badge: 2, group: "workspace" },
  { id: "album", label: "Album", icon: AlbumIcon, group: "workspace" },
  { id: "events", label: "Events", icon: EventsIcon, badge: 2, group: "workspace" },
  { id: "members", label: "Members", icon: MembersIcon, group: "workspace" },
  { id: "settings", label: "Settings", icon: SettingsIcon, group: "manage" },
];

const DEMO_ACTIVITY = [
  {
    type: "Tournament results",
    title: "Harbor Fall Blitz finished",
    byline: "By Maya Chen",
    date: "Today",
    accent: "#d99a28",
    icon: Trophy,
  },
  {
    type: "Club update",
    title: "New boards are ready for Thursday",
    byline: "By Maya Chen",
    date: "Yesterday",
    accent: DEMO_ACCENT,
    icon: MessageSquare,
  },
  {
    type: "Member update",
    title: "Welcome four new club members",
    byline: "By Harbor Chess Club",
    date: "Sep 28",
    accent: "#78a6e5",
    icon: Users,
  },
];

const DEMO_MEMBERS = [
  { name: "Maya Chen", role: "Director", rating: "1840", initials: "MC", tone: "#a77925", active: true },
  { name: "Elias Romero", role: "Member", rating: "1725", initials: "ER", tone: "#3b8b4e", active: true },
  { name: "Jordan Patel", role: "Member", rating: "1610", initials: "JP", tone: "#477cbd", active: false },
  { name: "Nora Wilson", role: "Member", rating: "1582", initials: "NW", tone: "#7f639b", active: false },
];

const DEMO_EVENTS = [
  {
    title: "Thursday Night Rapid",
    detail: "Three relaxed rapid games with an optional analysis table after the final round.",
    date: "Thu, Oct 8",
    venue: "Harbor Room · Boardwalk",
    kind: "Meetup",
    attendees: "26 going",
    day: "08",
    month: "Oct",
  },
  {
    title: "Fall Swiss Open",
    detail: "Five rounds of rated OTB chess for the full club community.",
    date: "Sat, Oct 17",
    venue: "Riverside Community Hall",
    kind: "Tournament",
    attendees: "48 registered",
    day: "17",
    month: "Oct",
  },
];

function DemoAvatar({ initials, tone, size = "md" }: { initials: string; tone: string; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-9 w-9 text-[11px]" : "h-11 w-11 text-xs";
  return (
    <span
      className={`${dimensions} inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 font-bold text-white`}
      style={{ background: `linear-gradient(135deg, ${tone}, ${tone}a8)` }}
    >
      {initials}
    </span>
  );
}

function DemoMobileDrawer({
  activeTab,
  onSelect,
  onClose,
}: {
  activeTab: DemoTab;
  onSelect: (tab: DemoTab) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close club navigation"
        className="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-club-mobile-nav-title"
        className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden border-l shadow-2xl lg:hidden"
        style={{
          background: "oklch(0.14 0.045 145 / 0.98)",
          borderColor: "oklch(0.30 0.08 145)",
          boxShadow: "-16px 0 48px rgba(2, 12, 6, 0.30)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: SURFACE_BORDER }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "oklch(0.64 0.12 145)" }}>Club workspace</p>
            <h2 id="demo-club-mobile-nav-title" className="mt-1 truncate text-lg font-bold leading-tight text-white">Harbor Chess Club</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close club navigation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/8 text-white/80 transition-transform active:scale-95">
            <X size={20} strokeWidth={2.25} />
          </button>
        </header>
        <nav aria-label="Demo club dashboard navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Club</p>
          <div className="space-y-1">
            {DEMO_NAV.filter((item) => item.group === "workspace").map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item.id); onClose(); }}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-transform active:scale-[0.985]"
                  style={{
                    background: active ? `${DEMO_ACCENT}1f` : "transparent",
                    border: `1px solid ${active ? `${DEMO_ACCENT}55` : "transparent"}`,
                    color: active ? "#ffffff" : "rgba(255,255,255,0.72)",
                    touchAction: "manipulation",
                  }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: active ? DEMO_ACCENT : "inherit", background: active ? `${DEMO_ACCENT}18` : "transparent" }}>
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {(item.badge ?? 0) > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: DEMO_ACCENT }}>{item.badge}</span>}
                  {active && <ChevronRight size={16} aria-hidden="true" style={{ color: DEMO_ACCENT }} />}
                </button>
              );
            })}
          </div>
          <div className="my-4 h-px bg-white/9" />
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Manage</p>
          {DEMO_NAV.filter((item) => item.group === "manage").map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item.id); onClose(); }}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-transform active:scale-[0.985]"
                style={{ background: active ? `${DEMO_ACCENT}1f` : "transparent", border: `1px solid ${active ? `${DEMO_ACCENT}55` : "transparent"}`, color: active ? "#ffffff" : "rgba(255,255,255,0.72)" }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: active ? DEMO_ACCENT : "inherit", background: active ? `${DEMO_ACCENT}18` : "transparent" }}><Icon size={19} /></span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t px-3 py-3" style={{ borderColor: SURFACE_BORDER }}>
          <Link href="/clubs" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5">
            <ChevronLeft size={19} />
            <span>All Clubs</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

function DemoBanner({ activeTab }: { activeTab: DemoTab }) {
  if (activeTab === "album") return null;
  return (
    <div className="relative mb-5 min-h-[160px] overflow-hidden rounded-3xl chess-board-bg sm:min-h-[220px]">
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${DEMO_ACCENT}33 0%, oklch(0.12 0.06 145 / 0.92) 60%, oklch(0.10 0.04 145 / 0.97) 100%)` }} />
      <div className="relative z-10 flex min-h-[160px] items-end gap-4 p-4 pt-10 sm:min-h-[220px] sm:p-6 sm:pt-12">
        <div className="min-w-0 flex-1 pb-0.5">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-black leading-tight tracking-tight text-white sm:text-2xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>Harbor Chess Club</h1>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ background: "oklch(0.25 0.04 145)", color: "oklch(0.55 0.08 145)", borderColor: "oklch(0.30 0.05 145)" }}>Private</span>
          </div>
          <p className="mb-1.5 max-w-2xl text-[12px] leading-relaxed text-white/82">A fixture-only preview of the Harbor Chess Club workspace.</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/62">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" style={{ color: DEMO_ACCENT }} /><span className="font-bold text-white">84</span><span>members</span></span>
            <span className="h-3 w-px bg-white/20" />
            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" style={{ color: DEMO_ACCENT }} /><span className="font-bold text-white">12</span><span>events</span></span>
            <span className="hidden h-3 w-px bg-white/20 sm:block" />
            <span className="hidden items-center gap-1 sm:flex"><MapPin className="h-3 w-3" />Portland, Maine</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoQuickActions({ onSelect }: { onSelect: (tab: DemoTab) => void }) {
  const actions = [
    { label: "New Meetup", icon: Plus, tab: "events" as const },
    { label: "Tournament", icon: Trophy, tab: "events" as const },
    { label: "Post", icon: MessageSquare, tab: "feed" as const },
  ];
  return (
    <section aria-labelledby="demo-quick-actions">
      <h2 id="demo-quick-actions" className="mb-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/38">Quick Actions</h2>
      <div className="mx-auto grid max-w-[560px] grid-cols-3 gap-2 sm:gap-3">
        {actions.map(({ label, icon: Icon, tab }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(tab)}
            className="group flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-white/9 bg-[oklch(0.14_0.04_145)] px-2 py-2 text-center text-white/92 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:border-white/15 hover:bg-[oklch(0.17_0.05_145)] focus:outline-none focus:ring-2 focus:ring-[#4CAF50] active:translate-y-0 active:scale-[0.98] sm:min-h-16 sm:flex-row sm:gap-2 sm:px-3 sm:py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.075] sm:h-10 sm:w-10"><Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" /></span>
            <span className="whitespace-nowrap text-xs font-semibold sm:text-[15px]">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DemoOverview({ onSelect }: { onSelect: (tab: DemoTab) => void }) {
  return (
    <div className="space-y-5">
      <section className="cursor-pointer rounded-2xl border border-white/8 bg-[oklch(0.16_0.05_145)] p-4 transition-colors hover:border-white/15 hover:bg-[oklch(0.18_0.06_145)]" onClick={() => onSelect("events")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Next Event</h2>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect("events"); }} className="text-xs font-semibold" style={{ color: DEMO_ACCENT }}>+1 more</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: `${DEMO_ACCENT}18` }}><Calendar className="h-5 w-5" style={{ color: DEMO_ACCENT }} aria-hidden="true" /></div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">Thursday Night Rapid</p><p className="text-xs text-white/50">Thu, Oct 8 · 7:00 PM</p></div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onSelect("events"); }} className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: `${DEMO_ACCENT}22`, color: DEMO_ACCENT, border: `1px solid ${DEMO_ACCENT}44` }}><Users className="h-3 w-3" aria-hidden="true" />RSVPs</button>
        </div>
      </section>

      <DemoQuickActions onSelect={onSelect} />

      <section className="overflow-hidden rounded-2xl border" style={{ background: SURFACE, borderColor: SURFACE_BORDER }} aria-labelledby="demo-recent-activity">
        <header className="flex items-center justify-between border-b px-4 py-3.5" style={{ borderColor: "rgba(255,255,255,0.065)" }}>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/34">Club timeline</p><h2 id="demo-recent-activity" className="mt-0.5 text-sm font-bold text-white/92">Recent Activity</h2></div>
          <button type="button" onClick={() => onSelect("feed")} className="min-h-11 rounded-xl px-3 text-xs font-semibold transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]" style={{ color: DEMO_ACCENT }}>View all</button>
        </header>
        <div className="divide-y divide-white/[0.065]">
          {DEMO_ACTIVITY.slice(0, 2).map(({ type, title, byline, date, accent, icon: Icon }) => (
            <article key={title} className="group flex min-h-[132px] gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025] sm:min-h-[148px] sm:gap-4 sm:px-5 sm:py-[18px]">
              <div className="relative flex h-[96px] w-[116px] shrink-0 items-end overflow-hidden rounded-xl border sm:h-[112px] sm:w-[136px]" style={{ background: `${accent}18`, borderColor: "rgba(255,255,255,0.10)" }}>
                <div className="absolute inset-0 chess-board-bg opacity-[0.14]" />
                <Icon className="absolute right-3 top-3 h-5 w-5" style={{ color: accent }} aria-hidden="true" />
                <span className="relative z-10 px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.07em] text-white sm:text-[11px]">{type}</span>
              </div>
              <div className="min-w-0 flex-1 py-0.5 sm:py-1"><h3 className="line-clamp-2 text-base font-bold leading-5 text-white/92 sm:text-lg sm:leading-6">{title}</h3><p className="mt-2 text-sm text-white/46">{byline}</p><p className="mt-1 text-xs text-white/34 sm:text-sm">{date}</p></div>
              <button type="button" onClick={() => onSelect("feed")} className="mt-auto inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-white/74 transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]">View <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DemoFeed() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border p-4" style={{ background: SURFACE, borderColor: SURFACE_BORDER }}>
        <div className="flex items-center gap-3">
          <DemoAvatar initials="MC" tone="#a77925" size="sm" />
          <button type="button" className="min-h-11 flex-1 rounded-xl border border-white/9 bg-white/[0.035] px-3 text-left text-sm text-white/38 transition-colors hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#4CAF50]">Share with your club</button>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.065] pt-3"><span className="text-xs text-white/34">Read-only example composer</span><FolderLock className="h-4 w-4" style={{ color: DEMO_ACCENT }} aria-hidden="true" /></div>
      </section>
      <section className="overflow-hidden rounded-2xl border" style={{ background: SURFACE, borderColor: SURFACE_BORDER }}>
        <header className="border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "rgba(255,255,255,0.065)" }}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/34">Club timeline</p><h2 className="mt-0.5 text-sm font-bold text-white/92">Club Feed</h2></header>
        <div className="divide-y divide-white/[0.065]">
          {DEMO_ACTIVITY.map(({ title, byline, date, accent, icon: Icon }) => (
            <article key={title} className="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}18`, color: accent }}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-bold text-white/92">{byline.replace("By ", "")}</span><span className="text-xs text-white/38">{date}</span></div><h3 className="mt-1.5 text-base font-bold text-white/92">{title}</h3><p className="mt-1.5 text-sm leading-6 text-white/50">This sample post demonstrates the same card hierarchy and member-only context as a live Club Feed.</p><div className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color: DEMO_ACCENT }}><FolderLock className="h-3.5 w-3.5" aria-hidden="true" />Visible to club members</div></div>
              <MoreHorizontal className="h-5 w-5 shrink-0 text-white/35" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DemoEvents() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="flex w-full flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-[#0a1a0f] transition-transform hover:brightness-110 active:scale-[0.98]" style={{ background: DEMO_ACCENT }}><Trophy className="h-4 w-4" aria-hidden="true" />New Tournament<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-3.5 text-sm font-bold text-white/60 transition-colors hover:border-white/30 hover:text-white/80"><Plus className="h-4 w-4" aria-hidden="true" />Club Meetup</button>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Demo event filters">
        {["All", "Meetups", "Tournaments", "Leagues"].map((filter, index) => <button key={filter} type="button" className="h-9 shrink-0 rounded-full px-4 text-xs font-bold transition-colors" style={{ background: index === 0 ? DEMO_ACCENT : "rgba(255,255,255,0.08)", color: index === 0 ? "#0a1a0f" : "rgba(255,255,255,0.45)" }}>{filter}</button>)}
      </div>
      <section><div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4" style={{ color: DEMO_ACCENT }} aria-hidden="true" /><h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Club Meetups · 2</h2></div><div className="space-y-4">{DEMO_EVENTS.map((event) => <article key={event.title} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.16_0.05_145)] transition-all hover:scale-[1.005] hover:border-white/25"><div className="h-1 bg-[#4CAF50] transition-all group-hover:h-[3px]" /><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-xs font-bold text-emerald-300">Upcoming</span><span className="text-xs text-white/30">{event.date}</span></div><h3 className="truncate text-base font-bold text-white">{event.title}</h3><p className="mt-1 line-clamp-2 text-sm text-white/40">{event.detail}</p><div className="mt-2 flex items-center gap-1.5 text-xs text-white/30"><MapPin className="h-3 w-3" aria-hidden="true" />{event.venue}</div></div><div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><span className="text-[10px] font-bold uppercase text-white/40">{event.month}</span><span className="text-sm font-black text-white">{event.day}</span></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold" style={{ background: `${DEMO_ACCENT}33`, color: DEMO_ACCENT, border: `1px solid ${DEMO_ACCENT}66` }}><Calendar className="h-3.5 w-3.5" aria-hidden="true" />View {event.kind}</span><span className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-white/56" style={{ borderColor: `${DEMO_ACCENT}66`, background: `${DEMO_ACCENT}18` }}><CheckCircle2 className="h-3.5 w-3.5" style={{ color: DEMO_ACCENT }} aria-hidden="true" />{event.attendees}</span></div></div></article>)}</div></section>
    </div>
  );
}

function DemoMembers() {
  return (
    <section className="overflow-hidden rounded-2xl border" style={{ background: SURFACE, borderColor: SURFACE_BORDER }}>
      <header className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "rgba(255,255,255,0.065)" }}><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/34">Club roster</p><h2 className="mt-0.5 text-sm font-bold text-white/92">Members</h2></div><span className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: `${DEMO_ACCENT}18`, color: DEMO_ACCENT }}>84 total</span></header>
      <div className="divide-y divide-white/[0.065]">{DEMO_MEMBERS.map((member) => <article key={member.name} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><DemoAvatar initials={member.initials} tone={member.tone} /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-white/92">{member.name}</h3><p className="mt-0.5 text-xs text-white/42">{member.role} · {member.rating} rapid</p></div><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-white/38 sm:block">{member.rating}</span>{member.active && <span className="h-2 w-2 rounded-full" style={{ background: DEMO_ACCENT, boxShadow: `0 0 0 3px ${DEMO_ACCENT}16` }} aria-label="Active" />}<span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: member.role === "Director" ? "rgba(217,154,40,0.16)" : "rgba(255,255,255,0.07)", color: member.role === "Director" ? "#f2be5b" : "rgba(255,255,255,0.55)" }}>{member.role}</span></div></article>)}</div>
    </section>
  );
}

function DemoAlbum() {
  const albums = ["Club Photos", "Chess Tournaments", "Chess Leagues", "Club Meetups", "Puzzle Nights", "Open Play"];
  return (
    <section className="overflow-hidden rounded-2xl border" style={{ background: SURFACE, borderColor: SURFACE_BORDER }}>
      <header className="border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "rgba(255,255,255,0.065)" }}><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/34">Club album</p><h2 className="mt-0.5 text-sm font-bold text-white/92">Shared Media</h2></header>
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4">{albums.map((label, index) => <button key={label} type="button" className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 text-left transition-transform hover:scale-[1.015] focus:outline-none focus:ring-2 focus:ring-[#4CAF50]"><div className="absolute inset-0 chess-board-bg opacity-[0.14]" /><div className="absolute inset-0" style={{ background: index % 3 === 0 ? "linear-gradient(135deg,rgba(76,175,80,0.35),rgba(8,34,17,0.82))" : index % 3 === 1 ? "linear-gradient(135deg,rgba(217,154,40,0.25),rgba(11,33,18,0.88))" : "linear-gradient(135deg,rgba(81,132,200,0.23),rgba(8,30,17,0.88))" }} /><div className="absolute inset-x-3 bottom-3"><div className="flex items-center gap-1.5 text-white"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /><span className="truncate text-xs font-bold">{label}</span></div><span className="mt-1 block text-[11px] text-white/62">{8 + index * 5} photos</span></div></button>)}</div>
    </section>
  );
}

function DemoSettings() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-[oklch(0.16_0.05_145)] p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${DEMO_ACCENT}18`, color: DEMO_ACCENT }}><Settings2 className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/34">Read-only demo</p><h2 className="mt-0.5 text-base font-bold text-white/92">Club settings preview</h2></div></div><p className="mt-4 text-sm leading-6 text-white/50">Owners can customize their Club identity, invite paths, appearance, and member roles here. This preview intentionally does not expose settings controls.</p></section>
      {["Club identity", "Member access", "Appearance"].map((label) => <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5"><span className="text-sm font-semibold text-white/78">{label}</span><ChevronRight className="h-4 w-4 text-white/30" aria-hidden="true" /></div>)}
    </div>
  );
}

export default function ClubDashboardDemo() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tab, setTab] = useState<DemoTab>("overview");
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarKeyboardExpanded, setSidebarKeyboardExpanded] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarTemporarilyExpanded = sidebarHovered || sidebarKeyboardExpanded;

  const topBarBackground = isDark ? NAV_BG : "oklch(0.20 0.06 145 / 0.92)";

  function selectTab(nextTab: DemoTab) {
    setTab(nextTab);
    setMobileNavOpen(false);
  }

  return (
    <div className="min-h-[100dvh] overflow-hidden" style={{ background: "transparent" }}>
      <div className="pointer-events-none fixed inset-0 z-0"><ShaderBackground className="h-full w-full" /><div className="absolute inset-0 bg-[oklch(0.10_0.05_145/0.50)]" /></div>
      <div className="relative z-10 flex h-[100dvh] w-full max-w-full overflow-hidden overscroll-x-none">
        <div className="hidden w-[72px] min-w-[72px] flex-shrink-0 lg:block" />
        <ClubDashboardSidebar
          accent={DEMO_ACCENT}
          background="oklch(0.115 0.025 145)"
          borderColor={NAV_BORDER}
          items={DEMO_NAV}
          activeId={tab}
          collapsed
          temporarilyExpanded={sidebarTemporarilyExpanded}
          onPointerExpandedChange={setSidebarHovered}
          onFocusExpandedChange={setSidebarKeyboardExpanded}
          onSelect={(nextTab) => selectTab(nextTab as DemoTab)}
          onBackToClubs={() => navigate("/clubs")}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="otb-header-safe relative flex min-h-[52px] flex-shrink-0 items-center gap-2 px-2 py-1 lg:px-5 lg:py-2.5" style={{ background: topBarBackground, backdropFilter: "blur(16px)", borderBottom: `1px solid ${NAV_BORDER}` }}>
            <Link href="/clubs" aria-label="Back to clubs" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[oklch(0.65_0.12_145)] transition-transform active:scale-95 lg:hidden"><ChevronLeft size={20} strokeWidth={2.5} /></Link>
            <div className="min-w-0 flex-1 lg:hidden"><p className="truncate text-[15px] font-bold leading-tight text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>Harbor Chess Club</p><p className="text-[10px] font-medium text-[oklch(0.55_0.08_145)]">84 members</p></div>
            <div className="ml-auto flex items-center gap-2"><span className="hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:inline-flex" style={{ background: `${DEMO_ACCENT}14`, borderColor: `${DEMO_ACCENT}38`, color: "#a8ee9d" }}><Eye className="h-3.5 w-3.5" aria-hidden="true" />Read-only demo</span><button type="button" onClick={() => setMobileNavOpen((open) => !open)} aria-label={mobileNavOpen ? "Close club navigation" : "Open club navigation"} aria-expanded={mobileNavOpen} aria-haspopup="dialog" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95 lg:hidden" style={{ color: "rgba(255,255,255,0.88)", background: `${DEMO_ACCENT}22`, border: `1px solid ${DEMO_ACCENT}55`, boxShadow: mobileNavOpen ? `0 0 0 3px ${DEMO_ACCENT}20` : "none" }}>{mobileNavOpen ? <X size={20} strokeWidth={2.25} /> : <Menu size={21} strokeWidth={2.25} />}</button></div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] lg:pb-6" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="px-4 py-4 lg:px-6"><div className="mx-auto max-w-4xl"><DemoBanner activeTab={tab} /><TabTransition tabKey={tab}>{tab === "overview" && <DemoOverview onSelect={selectTab} />}{tab === "feed" && <DemoFeed />}{tab === "events" && <DemoEvents />}{tab === "members" && <DemoMembers />}{tab === "album" && <DemoAlbum />}{tab === "settings" && <DemoSettings />}</TabTransition><section className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[oklch(0.15_0.045_145)] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-bold text-white/92">Ready to build your Club workspace?</p><p className="mt-1 text-sm text-white/46">Create a private home for your members, events, feed, and media.</p></div><button type="button" onClick={() => navigate("/clubs?create=1")} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors hover:brightness-110 active:scale-[0.98]" style={{ background: "#426f45" }}><Plus className="h-4 w-4" aria-hidden="true" />Create a club</button></section></div></div>
          </main>
        </div>
      </div>
      {mobileNavOpen && <DemoMobileDrawer activeTab={tab} onSelect={selectTab} onClose={() => setMobileNavOpen(false)} />}
    </div>
  );
}
