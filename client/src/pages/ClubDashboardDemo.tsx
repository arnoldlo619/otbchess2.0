/**
 * ClubDashboardDemo — /clubs/demo
 *
 * Public, read-only product preview. It deliberately uses fixture data only and
 * never calls Club APIs, so real Club names, members, media, and activity cannot
 * be disclosed through the demo surface.
 */
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { NavLogo } from "@/components/NavLogo";
import {
  Album,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Crown,
  Eye,
  FolderLock,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

type DemoTab = "overview" | "feed" | "events" | "members" | "album";

const DEMO_EVENTS = [
  { title: "Thursday Night Rapid", date: "Thu, Oct 8", time: "7:00 PM", location: "Harbor Room · Boardwalk", attendees: 26, accent: "#4CAF50" },
  { title: "Fall Swiss Open", date: "Sat, Oct 17", time: "10:00 AM", location: "Riverside Community Hall", attendees: 48, accent: "#d99a28" },
];

const DEMO_ACTIVITY = [
  { type: "Tournament result", title: "Fall Blitz Cup wrapped", detail: "Maya earned first place after five close rounds.", time: "2h ago", accent: "#d99a28", icon: Trophy },
  { type: "Club update", title: "New boards are ready for Thursday", detail: "The playing room opens at 6:30 PM for casual games.", time: "Yesterday", accent: "#4CAF50", icon: MessageSquare },
  { type: "Member moment", title: "Welcome, 4 new players", detail: "New members joined through the club’s private invite link.", time: "Sep 28", accent: "#4f8cd6", icon: Users },
];

const DEMO_MEMBERS = [
  { name: "Maya Chen", role: "Director", initials: "MC", tone: "#d99a28" },
  { name: "Elias Romero", role: "Member", initials: "ER", tone: "#4CAF50" },
  { name: "Jordan Patel", role: "Member", initials: "JP", tone: "#4f8cd6" },
  { name: "Nora Wilson", role: "Member", initials: "NW", tone: "#ab68ba" },
];

function DemoAvatar({ initials, tone, size = "md" }: { initials: string; tone: string; size?: "sm" | "md" }) {
  return <span className={`${size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs"} inline-flex shrink-0 items-center justify-center rounded-xl font-bold text-white`} style={{ background: `linear-gradient(135deg, ${tone}, ${tone}a8)` }}>{initials}</span>;
}

export default function ClubDashboardDemo() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tab, setTab] = useState<DemoTab>("overview");

  const tabs = useMemo(() => [
    { id: "overview" as const, label: "Overview", icon: CircleDot },
    { id: "feed" as const, label: "Feed", icon: MessageSquare },
    { id: "events" as const, label: "Events", icon: CalendarDays },
    { id: "members" as const, label: "Members", icon: Users },
    { id: "album" as const, label: "Album", icon: Album },
  ], []);

  const pageBg = isDark ? "bg-[#09130c]" : "bg-[#f5f7f2]";
  const surface = isDark ? "border-white/10 bg-[#102015]/94" : "border-[#dbe6d9] bg-white";
  const innerSurface = isDark ? "border-white/8 bg-white/[0.035]" : "border-[#e1eadf] bg-[#fbfdf9]";
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/57" : "text-[#536856]";

  return (
    <div className={`min-h-[100dvh] ${pageBg}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${isDark ? "border-white/8 bg-[#09130c]/90" : "border-[#dce7da] bg-[#f5f7f2]/90"}`}>
        <div className="mx-auto flex h-15 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/clubs" className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 ${isDark ? "text-white/75 hover:bg-white/8" : "text-[#315638] hover:bg-[#e7f1e5]"}`} aria-label="Back to My Clubs">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <NavLogo className="h-7" />
          <div className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isDark ? "border-[#8ddf82]/25 bg-[#8ddf82]/10 text-[#a9efa0]" : "border-[#afcbaa] bg-[#e8f5e6] text-[#356d3c]"}`}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Read-only demo
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 sm:pt-10">
        <section className={`relative overflow-hidden rounded-3xl border ${surface}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(76,175,80,0.24),transparent_32%),linear-gradient(135deg,rgba(16,71,32,0.9),rgba(6,23,12,0.98))]" />
          <div className="absolute inset-0 chess-board-bg opacity-[0.08]" />
          <div className="relative px-5 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black text-white shadow-lg">HC</div>
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-black/15 px-2.5 py-1 text-[11px] font-semibold text-white/82 backdrop-blur-sm">
                    <FolderLock className="h-3.5 w-3.5" aria-hidden="true" />
                    Sample workspace
                  </div>
                  <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>Harbor Chess Club</h1>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/62"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />Portland, Maine · Est. 2021</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/14 bg-black/15 px-3 py-2 text-xs font-semibold text-white/80"><Users className="h-3.5 w-3.5" aria-hidden="true" />84 members</span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/14 bg-black/15 px-3 py-2 text-xs font-semibold text-white/80"><CircleDot className="h-3.5 w-3.5 text-[#92e785]" aria-hidden="true" />6 online</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav className={`flex gap-1 overflow-x-auto rounded-2xl border p-2 lg:flex-col lg:self-start ${surface}`} aria-label="Demo club navigation">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] ${active ? (isDark ? "bg-[#4CAF50]/18 text-[#a8ee9d]" : "bg-[#e8f5e6] text-[#2f6738]") : (isDark ? "text-white/58 hover:bg-white/7 hover:text-white" : "text-[#536856] hover:bg-[#f1f7ef] hover:text-[#193b20]")}`}>
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  {label}
                  {id === "events" && <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-[#4CAF50]/20" : (isDark ? "bg-white/8" : "bg-[#e7eee4]")}`}>2</span>}
                </button>
              );
            })}
            <div className={`hidden border-t px-3.5 pt-4 text-xs leading-5 lg:block ${isDark ? "border-white/8 text-white/42" : "border-[#e1eadf] text-[#5d7560]"}`}>
              This is sample content. No real club activity is shown here.
            </div>
          </nav>

          <section className="min-w-0">
            {tab === "overview" && (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                <div className="space-y-5">
                  <section className={`rounded-2xl border p-5 sm:p-6 ${surface}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-[0.12em] ${textMuted}`}>Next on the board</p>
                        <h2 className={`mt-2 text-xl font-bold ${textMain}`}>Thursday Night Rapid</h2>
                        <p className={`mt-2 text-sm leading-6 ${textMuted}`}>Three relaxed rapid games, a casual analysis table, and board sets ready for every level.</p>
                      </div>
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isDark ? "bg-[#4CAF50]/14 text-[#9de991]" : "bg-[#e8f5e6] text-[#376e3d]"}`}><CalendarDays className="h-5 w-5" aria-hidden="true" /></div>
                    </div>
                    <div className={`mt-5 grid grid-cols-3 divide-x border-y py-3 text-center ${isDark ? "divide-white/8 border-white/8" : "divide-[#e2ebdf] border-[#e2ebdf]"}`}>
                      <div><p className={`text-lg font-bold ${textMain}`}>Oct 8</p><p className={`mt-0.5 text-[11px] ${textMuted}`}>Thursday</p></div>
                      <div><p className={`text-lg font-bold ${textMain}`}>7 PM</p><p className={`mt-0.5 text-[11px] ${textMuted}`}>Doors 6:30</p></div>
                      <div><p className={`text-lg font-bold ${textMain}`}>26</p><p className={`mt-0.5 text-[11px] ${textMuted}`}>Going</p></div>
                    </div>
                    <button type="button" onClick={() => setTab("events")} className={`mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] ${isDark ? "bg-white/8 text-white hover:bg-white/12" : "bg-[#edf5eb] text-[#315d36] hover:bg-[#e1efdd]"}`}>View demo events <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                  </section>

                  <section className={`overflow-hidden rounded-2xl border ${surface}`}>
                    <div className={`flex items-center justify-between border-b px-5 py-4 sm:px-6 ${isDark ? "border-white/8" : "border-[#e1eadf]"}`}>
                      <div><h2 className={`font-bold ${textMain}`}>Recent activity</h2><p className={`mt-1 text-sm ${textMuted}`}>A private feed for club members</p></div>
                      <button type="button" onClick={() => setTab("feed")} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isDark ? "text-white/55 hover:bg-white/8" : "text-[#526856] hover:bg-[#eef5ec]"}`} aria-label="Open demo feed"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                    <div className={`divide-y ${isDark ? "divide-white/7" : "divide-[#edf1ea]"}`}>
                      {DEMO_ACTIVITY.slice(0, 2).map(({ type, title, detail, time, accent, icon: Icon }) => (
                        <article key={title} className="flex gap-3 px-5 py-4 sm:px-6">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}22`, color: accent }}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></div>
                          <div className="min-w-0 flex-1"><p className={`text-[11px] font-bold uppercase tracking-[0.1em] ${textMuted}`}>{type} · {time}</p><h3 className={`mt-1 text-sm font-bold ${textMain}`}>{title}</h3><p className={`mt-1 text-sm leading-5 ${textMuted}`}>{detail}</p></div>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className={`rounded-2xl border p-5 ${surface}`}>
                    <div className="flex items-center justify-between"><div><h2 className={`font-bold ${textMain}`}>Members</h2><p className={`mt-1 text-sm ${textMuted}`}>Your community, in one place</p></div><button type="button" onClick={() => setTab("members")} className={`text-sm font-semibold ${isDark ? "text-[#a8ee9d]" : "text-[#356d3c]"}`}>View all</button></div>
                    <div className="mt-5 space-y-3">
                      {DEMO_MEMBERS.slice(0, 3).map((member) => <div key={member.name} className="flex items-center gap-3"><DemoAvatar initials={member.initials} tone={member.tone} size="sm" /><div className="min-w-0 flex-1"><p className={`truncate text-sm font-semibold ${textMain}`}>{member.name}</p><p className={`text-xs ${textMuted}`}>{member.role}</p></div><span className={`h-2 w-2 rounded-full ${member.name === "Maya Chen" ? "bg-[#77d46a]" : "bg-transparent"}`} aria-label={member.name === "Maya Chen" ? "Online" : undefined} /></div>)}
                    </div>
                  </section>
                  <section className={`rounded-2xl border p-5 ${innerSurface}`}>
                    <div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-[#d99a28]/15 text-[#f2be5b]" : "bg-[#fff2d5] text-[#9d6516]"}`}><Sparkles className="h-5 w-5" aria-hidden="true" /></div><div><h2 className={`text-sm font-bold ${textMain}`}>A workspace, not a public profile</h2><p className={`mt-1 text-sm leading-5 ${textMuted}`}>Members can coordinate events, share updates, and keep media in the club.</p></div></div>
                  </section>
                </div>
              </div>
            )}

            {tab === "feed" && <section className={`overflow-hidden rounded-2xl border ${surface}`}><div className={`border-b px-5 py-5 sm:px-6 ${isDark ? "border-white/8" : "border-[#e1eadf]"}`}><p className={`text-xs font-bold uppercase tracking-[0.12em] ${textMuted}`}>Demo activity feed</p><h2 className={`mt-2 text-xl font-bold ${textMain}`}>Club updates, without the noise</h2></div><div className={`divide-y ${isDark ? "divide-white/7" : "divide-[#edf1ea]"}`}>{DEMO_ACTIVITY.map(({ type, title, detail, time, accent, icon: Icon }) => <article key={title} className="flex gap-4 px-5 py-5 sm:px-6"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}22`, color: accent }}><Icon className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`text-xs font-bold ${textMain}`}>Harbor Chess Club</span><span className={`text-xs ${textMuted}`}>{time}</span></div><h3 className={`mt-2 text-base font-bold ${textMain}`}>{title}</h3><p className={`mt-1.5 max-w-2xl text-sm leading-6 ${textMuted}`}>{detail}</p><span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${isDark ? "text-[#a8ee9d]" : "text-[#356d3c]"}`}><FolderLock className="h-3.5 w-3.5" aria-hidden="true" />Visible to club members</span></div><MoreHorizontal className={`h-5 w-5 shrink-0 ${isDark ? "text-white/35" : "text-[#697d6b]"}`} aria-hidden="true" /></article>)}</div></section>}

            {tab === "events" && <section className={`overflow-hidden rounded-2xl border ${surface}`}><div className={`flex flex-col justify-between gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:px-6 ${isDark ? "border-white/8" : "border-[#e1eadf]"}`}><div><p className={`text-xs font-bold uppercase tracking-[0.12em] ${textMuted}`}>Demo calendar</p><h2 className={`mt-2 text-xl font-bold ${textMain}`}>A clear next move for every member</h2></div><span className={`inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${isDark ? "bg-[#4CAF50]/14 text-[#a8ee9d]" : "bg-[#e8f5e6] text-[#356d3c]"}`}><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />2 upcoming</span></div><div className="divide-y divide-[#e1eadf] dark:divide-white/7">{DEMO_EVENTS.map((event) => <article key={event.title} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white" style={{ background: event.accent }}><span className="text-[10px] font-bold uppercase">Oct</span><span className="text-xl font-black leading-none">{event.title.includes("Thursday") ? "8" : "17"}</span></div><div className="min-w-0 flex-1"><h3 className={`text-base font-bold ${textMain}`}>{event.title}</h3><p className={`mt-1 text-sm ${textMuted}`}>{event.date} · {event.time} · {event.location}</p><p className={`mt-2 text-xs font-semibold ${isDark ? "text-[#a8ee9d]" : "text-[#356d3c]"}`}>{event.attendees} members going</p></div><button type="button" className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3.5 text-sm font-semibold ${isDark ? "border-white/12 text-white/70" : "border-[#b8d0b5] text-[#315d36]"}`}>Sample event</button></article>)}</div></section>}

            {tab === "members" && <section className={`overflow-hidden rounded-2xl border ${surface}`}><div className={`flex items-center justify-between border-b px-5 py-5 sm:px-6 ${isDark ? "border-white/8" : "border-[#e1eadf]"}`}><div><p className={`text-xs font-bold uppercase tracking-[0.12em] ${textMuted}`}>Sample roster</p><h2 className={`mt-2 text-xl font-bold ${textMain}`}>84 members, one shared board</h2></div><Crown className={`h-5 w-5 ${isDark ? "text-[#f2be5b]" : "text-[#a46a16]"}`} aria-hidden="true" /></div><div className={`divide-y ${isDark ? "divide-white/7" : "divide-[#edf1ea]"}`}>{DEMO_MEMBERS.map((member, index) => <article key={member.name} className="flex items-center gap-3 px-5 py-4 sm:px-6"><DemoAvatar initials={member.initials} tone={member.tone} /><div className="min-w-0 flex-1"><h3 className={`text-sm font-bold ${textMain}`}>{member.name}</h3><p className={`mt-0.5 text-xs ${textMuted}`}>{member.role} · {index === 0 ? "Organizer" : "Active this week"}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${member.role === "Director" ? (isDark ? "bg-[#d99a28]/16 text-[#f2be5b]" : "bg-[#fff2d5] text-[#9d6516]") : (isDark ? "bg-white/7 text-white/55" : "bg-[#eef4ec] text-[#49614d]")}`}>{member.role}</span></article>)}</div></section>}

            {tab === "album" && <section className={`overflow-hidden rounded-2xl border ${surface}`}><div className={`border-b px-5 py-5 sm:px-6 ${isDark ? "border-white/8" : "border-[#e1eadf]"}`}><p className={`text-xs font-bold uppercase tracking-[0.12em] ${textMuted}`}>Sample media library</p><h2 className={`mt-2 text-xl font-bold ${textMain}`}>Memories from the board</h2><p className={`mt-2 text-sm ${textMuted}`}>Albums stay with the club and its members.</p></div><div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">{["Tournament nights", "Club meetups", "League table", "First moves", "Puzzle relay", "Open play"].map((label, index) => <div key={label} className={`group relative aspect-square overflow-hidden rounded-2xl border ${innerSurface}`}><div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(76,175,80,0.25),transparent_58%),radial-gradient(circle_at_80%_15%,rgba(217,154,40,0.38),transparent_30%)]" /><div className="absolute inset-0 chess-board-bg opacity-[0.08]" /><div className="absolute inset-x-3 bottom-3"><div className="flex items-center gap-1.5 text-white"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /><span className="truncate text-xs font-bold">{label}</span></div><span className="mt-1 block text-[11px] text-white/62">{3 + index * 2} photos</span></div></div>)}</div></section>}
          </section>
        </div>

        <section className={`mt-7 flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${surface}`}>
          <div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isDark ? "bg-[#4CAF50]/15 text-[#a8ee9d]" : "bg-[#e8f5e6] text-[#356d3c]"}`}><FolderLock className="h-5 w-5" aria-hidden="true" /></div><div><h2 className={`font-bold ${textMain}`}>Build this for your real club</h2><p className={`mt-1 text-sm leading-6 ${textMuted}`}>Create an invite-only home for events, communication, members, and photos.</p></div></div>
          <button type="button" onClick={() => navigate("/clubs?create=1")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#426f45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#345c38] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"><Plus className="h-4 w-4" aria-hidden="true" />Create a club</button>
        </section>
      </main>
    </div>
  );
}
