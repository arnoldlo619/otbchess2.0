import { useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { BadgeCheck, FlipHorizontal, LockKeyhole, MapPin, ScanLine } from "lucide-react";

interface ClubPlayerIdBadgeProps {
  className?: string;
}

/**
 * A display-only Club Player credential for the public Club gateway.
 * It deliberately uses a compact, local interaction model: pointer tilt and
 * an optional flip reveal, with no fixed overlay or page-level pointer capture.
 */
export function ClubPlayerIdBadge({ className = "" }: ClubPlayerIdBadgeProps) {
  const [flipped, setFlipped] = useState(false);
  const reduceMotion = useReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const tiltX = useSpring(rotateX, { stiffness: 230, damping: 26, mass: 0.3 });
  const tiltY = useSpring(rotateY, { stiffness: 230, damping: 26, mass: 0.3 });

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (reduceMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / bounds.width;
    const pointerY = (event.clientY - bounds.top) / bounds.height;
    rotateX.set((0.5 - pointerY) * 7);
    rotateY.set((pointerX - 0.5) * 7);
  }

  function resetTilt() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      className={`relative flex h-[22.5rem] w-[14.5rem] items-end justify-center [perspective:1200px] ${className}`}
      aria-label="Interactive ChessOTB Club Player identification badge"
    >
      <div aria-hidden="true" className="absolute left-1/2 top-0 h-14 w-2 -translate-x-1/2 rounded-b-full border-x border-white/10 bg-[linear-gradient(90deg,#14271a,#4a8a4f_48%,#14271a)] shadow-[0_6px_10px_rgba(0,0,0,0.3)]" />
      <div aria-hidden="true" className="absolute left-1/2 top-10 z-10 h-5 w-9 -translate-x-1/2 rounded-md border border-white/25 bg-[#1b2b20] shadow-[0_4px_8px_rgba(0,0,0,0.32)]" />

      <motion.button
        type="button"
        aria-pressed={flipped}
        aria-label={flipped ? "Show front of ChessOTB Club Player badge" : "Show back of ChessOTB Club Player badge"}
        onClick={() => setFlipped((value) => !value)}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
        onPointerCancel={resetTilt}
        initial={reduceMotion ? false : { opacity: 0, y: 14, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
        style={{ rotateX: reduceMotion ? 0 : tiltX, rotateY: reduceMotion ? 0 : tiltY, transformStyle: "preserve-3d" }}
        className="group relative h-[19.75rem] w-[14.5rem] cursor-pointer rounded-[1.15rem] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#b7f5a9] focus-visible:ring-offset-4 focus-visible:ring-offset-[#071309]"
      >
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
        >
          <section
            className="absolute inset-0 overflow-hidden rounded-[1.15rem] border border-white/20 bg-[linear-gradient(155deg,#e9f5df_0%,#c9e5bd_48%,#9ccf92_100%)] p-4 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.7)] [backface-visibility:hidden]"
            aria-hidden={flipped}
          >
            <div aria-hidden="true" className="absolute inset-0 chess-board-bg opacity-[0.11]" />
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0.44),transparent)]" />
            <div aria-hidden="true" className="absolute bottom-3 right-2 top-3 w-1 rounded-full bg-[linear-gradient(180deg,#efffe8,#72b76d,#efffe8)] opacity-80" />

            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-[0.08em] text-[#102615]">CHESSOTB.CLUB</p>
                  <p className="mt-0.5 text-[7px] font-bold tracking-[0.16em] text-[#3d6641]">OFFICIAL PLAYER ID</p>
                </div>
                <div className="text-right text-[7px] font-bold tracking-[0.12em] text-[#315734]">
                  <p>OTB</p>
                  <p>CLUBS</p>
                  <span className="mt-1 ml-auto block h-0.5 w-5 bg-[#183c20]" />
                </div>
              </div>

              <div className="relative mt-4 h-[6.15rem] overflow-hidden rounded-xl border border-[#183c20]/20 bg-[#102518] shadow-[inset_0_1px_7px_rgba(0,0,0,0.35)]">
                <img
                  src="/club-assets/club-space-otb-table.webp"
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover object-center opacity-90"
                  loading="lazy"
                  decoding="async"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(160deg,rgba(17,57,25,0.12),rgba(4,16,8,0.6))]" />
                <div aria-hidden="true" className="absolute inset-0 chess-board-bg opacity-[0.14]" />
                <span className="absolute bottom-2 left-2 rounded-md border border-white/20 bg-black/30 px-1.5 py-1 text-[7px] font-bold tracking-[0.12em] text-white backdrop-blur-sm">PLAYER</span>
                <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#c9e5bd] bg-[#2e7a39] shadow-lg">
                  <BadgeCheck className="h-3.5 w-3.5 text-white" strokeWidth={2.6} aria-hidden="true" />
                </span>
              </div>

              <h2 className="mt-3 text-[1.15rem] font-black leading-none tracking-[-0.04em] text-[#102615]" style={{ fontFamily: "'Clash Display', sans-serif" }}>Chess Club Player</h2>
              <p className="mt-1 text-[8px] font-bold tracking-[0.13em] text-[#426c45]">CHESSOTB COMMUNITY MEMBER</p>

              <div className="mt-3 border-t border-[#2e6633]/20 pt-2.5">
                <div className="flex items-center justify-between text-[8px] font-bold tracking-[0.08em] text-[#385e3b]">
                  <span>PLAYER ID</span>
                  <span className="text-[#16331b]">COTB-2026-001</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[8px] font-bold tracking-[0.08em] text-[#385e3b]">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  OTB COMMUNITY
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-[#2e6633]/20 pt-2.5 text-[7px] font-bold tracking-[0.12em] text-[#446b47]">
                <span>PLAY · CONNECT · IMPROVE</span>
                <FlipHorizontal className="h-3 w-3 transition-transform duration-200 group-hover:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </div>
            </div>
          </section>

          <section
            className="absolute inset-0 overflow-hidden rounded-[1.15rem] border border-white/18 bg-[linear-gradient(155deg,#c9e5bd_0%,#a0cd97_100%)] p-4 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.65)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
            aria-hidden={!flipped}
          >
            <div aria-hidden="true" className="absolute inset-0 chess-board-bg opacity-[0.1]" />
            <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-10 bg-[repeating-linear-gradient(45deg,#102615_0_7px,#17331d_7px_14px)] opacity-90" />

            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black tracking-[0.08em] text-[#102615]">CHESSOTB.CLUB</p>
                  <p className="mt-0.5 text-[7px] font-bold tracking-[0.16em] text-[#3d6641]">PLAYER CREDENTIAL</p>
                </div>
                <LockKeyhole className="h-4 w-4 text-[#285a2e]" strokeWidth={1.8} aria-hidden="true" />
              </div>

              <div className="mt-5 h-8 rounded-md border border-[#183c20]/15 bg-[repeating-linear-gradient(90deg,#122816_0_2px,transparent_2px_5px,#122816_5px_6px,transparent_6px_9px)] bg-white/85" aria-hidden="true" />
              <div className="mt-2 flex items-center justify-between text-[8px] font-bold tracking-[0.11em] text-[#183c20]">
                <span>NO. COTB-2026-001</span>
                <span>VALID 2026</span>
              </div>

              <div className="mt-7 flex items-start gap-3">
                <div aria-hidden="true" className="grid h-14 w-14 grid-cols-5 gap-0.5 rounded-md border border-[#183c20]/20 bg-white p-1 shadow-sm">
                  {Array.from({ length: 25 }, (_, index) => (
                    <span key={index} className={index % 3 === 0 || index === 6 || index === 18 ? "bg-[#143419]" : "bg-transparent"} />
                  ))}
                </div>
                <div className="pt-1 text-[8px] leading-4 text-[#365f3a]">
                  <p className="font-bold tracking-[0.1em] text-[#16331b]">CLUB ACCESS</p>
                  <p className="mt-1">Events, conversation, and shared club moments.</p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-[#2e6633]/20 pt-3 text-[8px] font-bold tracking-[0.1em] text-[#355f3a]">
                <span>SCAN TO EXPLORE</span>
                <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            </div>
          </section>
        </motion.div>
      </motion.button>
      <p className="sr-only">Hover over the badge to tilt it. Activate it to reveal the reverse.</p>
    </div>
  );
}

export default ClubPlayerIdBadge;
