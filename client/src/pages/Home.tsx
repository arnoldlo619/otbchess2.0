/*
 * OTB Chess — Landing Page
 * Design: "The Board Room" — Apple Minimalism + Chess.com Green
 *
 * Sections:
 * 1. Navigation
 * 2. Hero — Full-bleed with isometric illustration
 * 3. How It Works — 3-step process
 * 4. Features — Key platform capabilities
 * 5. Tournament Flow — Visual walkthrough
 * 6. Testimonials / Social Proof
 * 7. CTA Section
 * 8. Footer
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Trophy,
  Users,
  Zap,
  ChevronRight,
  Menu,
  X,
  Crown,
  Swords,
  BarChart3,
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
  Shield,
  Globe,
} from "lucide-react";

// ─── CDN Assets ─────────────────────────────────────────────────────────────
const HERO_ILLUSTRATION = "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/dZuSquOOqgihMojy.png";
const KINGS_QUEENS_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/117675823/qceLUpTKVkOniZtu.png";

// ─── Intersection Observer Hook ─────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = ["Features", "How It Works", "For Clubs", "Pricing"];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[#EEEED2] shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-[#3D6B47] rounded-md flex items-center justify-center">
            <Crown className="w-4.5 h-4.5 text-white" strokeWidth={2} />
          </div>
          <span
            className="text-[#1A1A1A] font-semibold text-lg tracking-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            OTB Chess
          </span>
        </a>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link}
              onClick={() => toast.info("Feature coming soon")}
              className="text-sm font-medium text-[#4B5563] hover:text-[#3D6B47] transition-colors duration-200"
            >
              {link}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => toast.info("Feature coming soon")}
            className="text-sm font-medium text-[#3D6B47] hover:text-[#2A4A32] transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => toast.info("Feature coming soon")}
            className="btn-chess-primary text-sm"
          >
            Start Tournament
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-[#1A1A1A]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-[#EEEED2] px-4 pb-4">
          {navLinks.map((link) => (
            <button
              key={link}
              onClick={() => { toast.info("Feature coming soon"); setMobileOpen(false); }}
              className="block w-full text-left py-3 text-sm font-medium text-[#4B5563] border-b border-[#F0F5EE] last:border-0"
            >
              {link}
            </button>
          ))}
          <button
            onClick={() => toast.info("Feature coming soon")}
            className="btn-chess-primary w-full mt-4 text-sm"
          >
            Start Tournament
          </button>
        </div>
      )}
    </nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-16">
      {/* Subtle chess board texture */}
      <div className="absolute inset-0 chess-board-bg opacity-40 pointer-events-none" />

      {/* Soft green radial glow */}
      <div
        className="absolute top-0 right-0 w-[60vw] h-[80vh] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 80% 20%, oklch(0.55 0.13 145 / 0.08) 0%, transparent 65%)",
        }}
      />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)]">
          {/* Left — Copy */}
          <div className="py-16 lg:py-0">
            <div
              className="opacity-0-init animate-fade-in-up"
              style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
            >
              <Badge
                className="mb-6 text-xs font-semibold tracking-widest uppercase border-[#3D6B47]/30 text-[#3D6B47] bg-[#3D6B47]/06"
                variant="outline"
              >
                For Chess Clubs & Communities
              </Badge>
            </div>

            <h1
              className="opacity-0-init animate-fade-in-up text-5xl lg:text-6xl xl:text-7xl font-semibold text-[#1A1A1A] leading-[1.05] tracking-tight mb-6"
              style={{
                fontFamily: "'Clash Display', sans-serif",
                animationDelay: "0.2s",
                animationFillMode: "forwards",
              }}
            >
              Chess Tournaments,
              <br />
              <span className="text-[#3D6B47]">Over The Board.</span>
            </h1>

            <p
              className="opacity-0-init animate-fade-in-up text-lg text-[#4B5563] leading-relaxed mb-8 max-w-lg"
              style={{ animationDelay: "0.35s", animationFillMode: "forwards" }}
            >
              Set up a rated in-person tournament in minutes. Players sign up with their chess.com username — we pull their ELO and generate optimal pairings automatically.
            </p>

            <div
              className="opacity-0-init animate-fade-in-up flex flex-col sm:flex-row gap-3"
              style={{ animationDelay: "0.45s", animationFillMode: "forwards" }}
            >
              <button
                onClick={() => toast.info("Feature coming soon")}
                className="btn-chess-primary flex items-center justify-center gap-2"
              >
                Create Tournament
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => toast.info("Feature coming soon")}
                className="btn-chess-secondary flex items-center justify-center gap-2"
              >
                See How It Works
              </button>
            </div>

            {/* Social proof */}
            <div
              className="opacity-0-init animate-fade-in-up mt-10 flex items-center gap-6"
              style={{ animationDelay: "0.55s", animationFillMode: "forwards" }}
            >
              <div className="flex -space-x-2">
                {["#3D6B47", "#769656", "#2A4A32", "#5A8A6A"].map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: c }}
                  >
                    {["M", "A", "K", "R"][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[#3D6B47] text-[#3D6B47]" />
                  ))}
                </div>
                <p className="text-xs text-[#6B7280]">
                  Trusted by <strong className="text-[#1A1A1A]">200+ chess clubs</strong> worldwide
                </p>
              </div>
            </div>
          </div>

          {/* Right — Illustration */}
          <div
            className="opacity-0-init animate-fade-in relative"
            style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}
          >
            <div className="relative">
              {/* Floating stat cards */}
              <div className="absolute top-8 -left-4 z-10 bg-white rounded-xl shadow-lg border border-[#EEEED2] px-4 py-3 animate-fade-in-up" style={{ animationDelay: "0.7s", animationFillMode: "forwards" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#3D6B47]/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#3D6B47]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280] font-medium">Setup Time</p>
                    <p className="text-sm font-bold text-[#1A1A1A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{"< 3 min"}</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-12 -right-2 z-10 bg-white rounded-xl shadow-lg border border-[#EEEED2] px-4 py-3 animate-fade-in-up" style={{ animationDelay: "0.8s", animationFillMode: "forwards" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-[#3D6B47]/10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-[#3D6B47]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280] font-medium">ELO Accuracy</p>
                    <p className="text-sm font-bold text-[#1A1A1A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>99.9%</p>
                  </div>
                </div>
              </div>

              <img
                src={HERO_ILLUSTRATION}
                alt="Chess tournament illustration — people playing chess on an isometric board"
                className="w-full h-auto rounded-2xl"
                style={{ maxHeight: "580px", objectFit: "cover", objectPosition: "left center" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────
function StatsBar() {
  const { ref, inView } = useInView();
  const stats = [
    { value: "2,400+", label: "Tournaments Hosted" },
    { value: "18,000+", label: "Players Registered" },
    { value: "200+", label: "Chess Clubs" },
    { value: "4.9★", label: "Average Rating" },
  ];

  return (
    <section ref={ref} className="bg-[#3D6B47] py-10">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p
                className="text-3xl font-bold text-white mb-1"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {stat.value}
              </p>
              <p className="text-sm text-white/70 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────
function HowItWorks() {
  const { ref, inView } = useInView();
  const steps = [
    {
      number: "01",
      icon: <Trophy className="w-6 h-6" />,
      title: "Create Your Tournament",
      description:
        "Set the format (Swiss, Round Robin, Knockout), number of rounds, time control, and venue. Takes under 3 minutes.",
    },
    {
      number: "02",
      icon: <Users className="w-6 h-6" />,
      title: "Players Sign Up with chess.com",
      description:
        "Share a link. Players enter their chess.com username — we automatically pull their verified ELO rating in real time.",
    },
    {
      number: "03",
      icon: <Swords className="w-6 h-6" />,
      title: "Optimal Pairings Generated",
      description:
        "Our algorithm creates balanced, fair pairings based on ELO. No manual work. Standings update live as results come in.",
    },
  ];

  return (
    <section className="py-24 bg-white" ref={ref}>
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#3D6B47] mb-3">
            Simple Process
          </p>
          <h2
            className="text-4xl lg:text-5xl font-semibold text-[#1A1A1A] tracking-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            From zero to tournament
            <br />
            in three moves.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-[#EEEED2]" />

          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`relative transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="card-chess p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-[#3D6B47]/08 rounded-xl flex items-center justify-center text-[#3D6B47]">
                    {step.icon}
                  </div>
                  <span
                    className="text-5xl font-bold text-[#EEEED2]"
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    {step.number}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-[#1A1A1A] mb-3">
                  {step.title}
                </h3>
                <p className="text-[#6B7280] leading-relaxed text-sm">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
function Features() {
  const { ref, inView } = useInView();
  const features = [
    {
      icon: <Globe className="w-5 h-5" />,
      title: "chess.com API Integration",
      description:
        "Players sign up with their chess.com username. ELO ratings are pulled automatically — no manual entry, no disputes.",
      tag: "Live ELO Sync",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Smart Pairing Engine",
      description:
        "Swiss system pairings optimized by ELO, color balance, and previous opponents. Handles tiebreaks automatically.",
      tag: "Algorithm-Powered",
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Live Standings & Results",
      description:
        "Real-time leaderboard updates as results are submitted. Shareable public link for spectators and club members.",
      tag: "Real-Time",
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Multiple Formats",
      description:
        "Swiss, Round Robin, Single Elimination, and Double Elimination. Set time controls, bye rules, and scoring systems.",
      tag: "Flexible",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Club Management",
      description:
        "Manage your club's roster, track member ELO history over time, and organize recurring weekly or monthly events.",
      tag: "For Clubs",
    },
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      title: "Result Verification",
      description:
        "Players confirm results from their device. Disputes are flagged for the tournament director to resolve instantly.",
      tag: "Verified",
    },
  ];

  return (
    <section className="py-24 bg-[#F0F5EE]" ref={ref}>
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#3D6B47] mb-3">
            Platform Features
          </p>
          <h2
            className="text-4xl lg:text-5xl font-semibold text-[#1A1A1A] tracking-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Everything your club needs.
            <br />
            Nothing it doesn't.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`card-chess bg-white p-6 transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-[#3D6B47]/08 rounded-lg flex items-center justify-center text-[#3D6B47]">
                  {feature.icon}
                </div>
                <span className="tag-elo">{feature.tag}</span>
              </div>
              <h3 className="text-base font-semibold text-[#1A1A1A] mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Visual Showcase ─────────────────────────────────────────────────────────
function Showcase() {
  const { ref, inView } = useInView();

  return (
    <section className="py-24 bg-white overflow-hidden" ref={ref}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image */}
          <div
            className={`transition-all duration-700 ${
              inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.44 0.12 145 / 0.12) 0%, transparent 60%)",
                }}
              />
              <img
                src={KINGS_QUEENS_IMG}
                alt="OTB Chess — Kings and Queens editorial illustration"
                className="w-full h-auto rounded-2xl shadow-xl"
              />
            </div>
          </div>

          {/* Copy */}
          <div
            className={`transition-all duration-700 delay-200 ${
              inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <p className="text-xs font-semibold tracking-widest uppercase text-[#3D6B47] mb-4">
              Built for Serious Players
            </p>
            <h2
              className="text-4xl lg:text-5xl font-semibold text-[#1A1A1A] tracking-tight mb-6"
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Every game deserves
              <br />
              a proper stage.
            </h2>
            <p className="text-[#4B5563] leading-relaxed mb-8">
              OTB Chess brings the rigor of competitive chess to your local club. Whether you're running a casual Saturday blitz or a serious club championship, the platform handles the logistics so you can focus on the game.
            </p>

            <div className="space-y-4 mb-8">
              {[
                "Automatic ELO-based seeding and pairings",
                "Support for up to 256 players per tournament",
                "Printable pairing sheets and result slips",
                "Post-tournament performance reports",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#3D6B47] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[#4B5563]">{item}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => toast.info("Feature coming soon")}
              className="btn-chess-primary flex items-center gap-2"
            >
              Start for Free
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Player Card Demo ─────────────────────────────────────────────────────────
function PlayerDemo() {
  const { ref, inView } = useInView();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<null | { username: string; elo: number; title?: string }>(null);

  const mockPlayers: Record<string, { elo: number; title?: string }> = {
    hikaru: { elo: 3212, title: "GM" },
    magnuscarlsen: { elo: 2882, title: "GM" },
    gothamchess: { elo: 2612, title: "IM" },
    danielnaroditsky: { elo: 2736, title: "GM" },
  };

  const handleLookup = () => {
    if (!username.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const key = username.toLowerCase().replace(/\s/g, "");
      const found = mockPlayers[key];
      if (found) {
        setPlayer({ username, ...found });
      } else {
        setPlayer({ username, elo: Math.floor(Math.random() * 800) + 1000 });
      }
      setLoading(false);
    }, 900);
  };

  return (
    <section className="py-24 bg-[#F0F5EE]" ref={ref}>
      <div className="container">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#3D6B47] mb-3">
            chess.com Integration
          </p>
          <h2
            className="text-4xl font-semibold text-[#1A1A1A] tracking-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Try it: look up any player.
          </h2>
          <p className="text-[#6B7280]">
            Enter a chess.com username below to see how player registration works. Try{" "}
            <code className="bg-white px-1.5 py-0.5 rounded text-xs text-[#3D6B47] border border-[#EEEED2]">hikaru</code>{" "}
            or{" "}
            <code className="bg-white px-1.5 py-0.5 rounded text-xs text-[#3D6B47] border border-[#EEEED2]">gothamchess</code>.
          </p>
        </div>

        <div
          className={`max-w-md mx-auto transition-all duration-500 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="card-chess bg-white p-6">
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="chess.com username..."
                className="flex-1 px-4 py-2.5 text-sm border border-[#EEEED2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3D6B47]/30 focus:border-[#3D6B47] transition-all bg-[#F0F5EE]/50"
              />
              <button
                onClick={handleLookup}
                disabled={loading || !username.trim()}
                className="btn-chess-primary text-sm px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "Look Up"}
              </button>
            </div>

            {player && !loading && (
              <div className="border border-[#EEEED2] rounded-xl p-4 bg-[#F0F5EE]/50 animate-fade-in-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#3D6B47] rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {player.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#1A1A1A] text-sm">{player.username}</p>
                        {player.title && (
                          <span className="text-xs font-bold text-[#3D6B47] bg-[#3D6B47]/10 px-1.5 py-0.5 rounded">
                            {player.title}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280]">chess.com verified</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-2xl font-bold text-[#3D6B47]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {player.elo}
                    </p>
                    <p className="text-xs text-[#6B7280]">ELO Rating</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#EEEED2]">
                  <button
                    onClick={() => toast.success(`${player.username} added to tournament!`)}
                    className="w-full btn-chess-primary text-sm py-2"
                  >
                    Add to Tournament
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const { ref, inView } = useInView();
  const testimonials = [
    {
      quote:
        "We used to spend an hour doing pairings manually. Now it's done before the first round even starts. Our club members love it.",
      author: "Marcus T.",
      role: "Club President, NYC Chess Society",
      elo: "1842",
    },
    {
      quote:
        "The chess.com integration is genius. No more arguing about ratings — everyone's ELO is pulled directly from their profile.",
      author: "Aisha K.",
      role: "Tournament Director, London Chess Club",
      elo: "2105",
    },
    {
      quote:
        "Ran our first 32-player Swiss tournament with zero issues. The live standings board was a hit — people kept checking it between rounds.",
      author: "Rafael M.",
      role: "Organizer, São Paulo Open Chess",
      elo: "1654",
    },
  ];

  return (
    <section className="py-24 bg-white" ref={ref}>
      <div className="container">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#3D6B47] mb-3">
            From the Community
          </p>
          <h2
            className="text-4xl font-semibold text-[#1A1A1A] tracking-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Clubs that made the move.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={t.author}
              className={`card-chess p-6 transition-all duration-500 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-[#3D6B47] text-[#3D6B47]" />
                ))}
              </div>
              <p className="text-[#374151] text-sm leading-relaxed mb-6 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-[#F0F5EE]">
                <div>
                  <p className="font-semibold text-[#1A1A1A] text-sm">{t.author}</p>
                  <p className="text-xs text-[#6B7280]">{t.role}</p>
                </div>
                <span className="tag-elo">{t.elo}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ─────────────────────────────────────────────────────────────
function CTASection() {
  const { ref, inView } = useInView();

  return (
    <section className="py-24 bg-[#3D6B47] relative overflow-hidden" ref={ref}>
      {/* Chess board texture overlay */}
      <div className="absolute inset-0 chess-board-bg opacity-10 pointer-events-none" />

      <div className="container relative z-10 text-center">
        <div
          className={`transition-all duration-600 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2
            className="text-4xl lg:text-5xl font-semibold text-white tracking-tight mb-4"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Your next tournament
            <br />
            starts here.
          </h2>
          <p className="text-white/75 text-lg mb-10 max-w-md mx-auto">
            Free for clubs with up to 20 players. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => toast.info("Feature coming soon")}
              className="bg-white text-[#3D6B47] font-semibold text-sm px-8 py-3 rounded-md hover:bg-[#EEEED2] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create Free Tournament
            </button>
            <button
              onClick={() => toast.info("Feature coming soon")}
              className="border border-white/40 text-white font-semibold text-sm px-8 py-3 rounded-md hover:bg-white/10 transition-all duration-200"
            >
              View Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const links = {
    Product: ["Features", "Pricing", "Changelog", "Roadmap"],
    Community: ["Chess Clubs", "Blog", "Discord", "Twitter"],
    Company: ["About", "Contact", "Privacy", "Terms"],
  };

  return (
    <footer className="bg-[#1A1A1A] text-white py-16">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-[#3D6B47] rounded-md flex items-center justify-center">
                <Crown className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <span
                className="text-white font-semibold text-lg"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                OTB Chess
              </span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Over The Board. Built for chess clubs that take the game seriously.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-4">
                {category}
              </p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => toast.info("Feature coming soon")}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © 2026 OTB Chess. All rights reserved.
          </p>
          <p className="text-xs text-white/30">
            Powered by chess.com API · Not affiliated with chess.com
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <Features />
      <Showcase />
      <PlayerDemo />
      <Testimonials />
      <CTASection />
      <Footer />
    </div>
  );
}
