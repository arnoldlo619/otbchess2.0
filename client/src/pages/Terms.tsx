import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { AppNavBar } from "@/components/AppNavBar";
import { useTheme } from "@/contexts/ThemeContext";

const sections = [
  {
    title: "Using ChessOTB",
    body: "ChessOTB provides tools for organizing and participating in over-the-board chess activities. You are responsible for the accuracy of tournament, club, event, player, and result information you submit.",
  },
  {
    title: "Accounts and access",
    body: "Keep your account and director access details secure. Do not use another person’s identity or chess account without permission. We may restrict access that threatens platform security, tournament integrity, or other members.",
  },
  {
    title: "Tournament and club administration",
    body: "Hosts and club administrators control their events, pairings, fees, eligibility rules, moderation, and final results. ChessOTB helps administer these activities but is not the tournament director, arbiter, venue, or payment recipient.",
  },
  {
    title: "Payments and external services",
    body: "Hosts may share personal Venmo, Cash App, PayPal, or other external payment links. Payments occur outside ChessOTB and remain between the payer, host, and payment provider. Review the recipient and event terms before sending money.",
  },
  {
    title: "Content and conduct",
    body: "Only upload or publish content you are allowed to use. Do not post unlawful, deceptive, abusive, infringing, or privacy-invasive material. Club owners may moderate content and membership within their communities.",
  },
  {
    title: "Third-party chess data",
    body: "Profiles, ratings, avatars, games, and opening data may come from third-party services such as Chess.com or Lichess. Availability and accuracy depend on those providers and their terms.",
  },
  {
    title: "Service availability",
    body: "Features may change, pause, or become unavailable. Keep independent copies of information you need for time-sensitive events. ChessOTB is provided without a guarantee that every integration or connection will always be available.",
  },
  {
    title: "Questions and removal requests",
    body: "For account, content, or player-data questions, use the support contact provided in the platform. We review legitimate correction and removal requests and may need information to verify the request.",
  },
];

export default function Terms() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const surface = isDark ? "oklch(0.17 0.045 145)" : "#ffffff";
  const page = isDark ? "oklch(0.12 0.035 145)" : "#F8F8FF";
  const text = isDark ? "rgba(255,255,255,0.92)" : "#12372A";
  const muted = isDark ? "rgba(255,255,255,0.58)" : "#436850";
  const border = isDark ? "rgba(255,255,255,0.09)" : "rgba(67,104,80,0.18)";

  return (
    <div className="min-h-screen" style={{ background: page, color: text }}>
      <AppNavBar />
      <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-[#436850]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D6940]"
          style={{ color: muted }}
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Back to home
        </Link>

        <header className="mb-10">
          <div
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border"
            style={{ background: surface, borderColor: border, color: "#4D6940" }}
          >
            <FileText size={22} aria-hidden="true" />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#4D6940" }}>
            Platform terms
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Terms of Use
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: muted }}>
            These terms describe the basic rules for using ChessOTB.club and its tournament, club, event, training, and community tools.
          </p>
          <p className="mt-3 text-sm" style={{ color: muted }}>Last updated August 22, 2026</p>
        </header>

        <div className="space-y-4">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className="rounded-2xl border p-5 sm:p-6"
              style={{ background: surface, borderColor: border }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black"
                  style={{ background: isDark ? "rgba(77,105,64,0.24)" : "rgba(77,105,64,0.10)", color: isDark ? "#8BCB8F" : "#436850" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-lg font-bold" style={{ fontFamily: "'Clash Display', sans-serif" }}>{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 sm:text-[15px]" style={{ color: muted }}>{section.body}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
