"use client"

/**
 * AnimeNavBar — OTB Chess
 *
 * Merges the upstream "anime-navbar" component (animated mascot, multi-layer OTB-green
 * glow on active tab, shine sweep, spring mascot transition) with the platform's
 * existing feature set:
 *   - Logo slot (left)
 *   - Right slot (theme toggle + user avatar)
 *   - Glassmorphic scroll background (intensifies on scroll)
 *   - IntersectionObserver scroll-aware active tab
 *   - Desktop: full animated pill nav centred on viewport
 *   - Mobile: nav links are consolidated into the avatar dropdown (rightSlot)
 *             — no standalone hamburger button
 *
 * Design tokens:
 *   OTB green: oklch(0.55 0.18 145) ≈ #3D6B47 / #4CAF50
 */

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── OTB design tokens ────────────────────────────────────────────────────────
const OTB_GREEN       = "#4CAF50"
const OTB_GREEN_DARK  = "#3D6B47"
const OTB_GREEN_GLOW  = "rgba(61,107,71,"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  onClick?: (e: React.MouseEvent) => void
  /** Optional section ID to watch with IntersectionObserver for scroll-aware active state */
  sectionId?: string
  /** Optional tooltip text shown below the tab on hover (ignored when dropdown is set) */
  tooltip?: string
  /** Optional dropdown panel rendered below the tab on hover */
  dropdown?: React.ReactNode
}

interface AnimeNavBarProps {
  items: NavItem[]
  className?: string
  defaultActive?: string
  logo?: React.ReactNode
  rightSlot?: React.ReactNode
  /** Called whenever the active tab changes (via click or IntersectionObserver) */
  onActiveChange?: (name: string) => void
}

// ─── Mascot ───────────────────────────────────────────────────────────────────
const MASCOT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-mascot-logo_9d33293f.png"

type IdleState = "none" | "pulse" | "wobble"

function MascotLogo({ isHovered }: { isHovered: boolean }) {
  const [idleAnim, setIdleAnim] = useState<IdleState>("none")
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleNextIdle = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    const delay = 3500 + Math.random() * 4000
    idleTimerRef.current = setTimeout(() => {
      const pick: IdleState = Math.random() < 0.6 ? "pulse" : "wobble"
      setIdleAnim(pick)
      const duration = pick === "pulse" ? 600 : 500
      setTimeout(() => {
        setIdleAnim("none")
        scheduleNextIdle()
      }, duration)
    }, delay)
  }

  useEffect(() => {
    scheduleNextIdle()
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current) }
  }, [])

  const isPulsing  = !isHovered && idleAnim === "pulse"
  const isWobbling = !isHovered && idleAnim === "wobble"

  const floatAnim  = { y: [0, -3, 0], transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" as const } }
  const pulseAnim  = { scale: [1, 1.14, 0.96, 1.06, 1], transition: { duration: 0.55, ease: "easeInOut" as const } }
  const wobbleAnim = { rotate: [0, -10, 10, -6, 6, 0], transition: { duration: 0.48, ease: "easeInOut" as const } }
  const hoverAnim  = { scale: [1, 1.18, 1.08], rotate: [0, -5, 5, 0], transition: { duration: 0.45 } }

  const logoAnimate = isHovered ? hoverAnim : isPulsing ? pulseAnim : isWobbling ? wobbleAnim : floatAnim

  const glowNormal = "drop-shadow(0 0 6px rgba(76,175,80,0.55)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))"
  const glowHover  = "drop-shadow(0 0 12px rgba(76,175,80,0.90)) drop-shadow(0 0 24px rgba(76,175,80,0.45)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))"

  return (
    <div className="relative" style={{ width: 40, height: 44 }}>
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ top: 2, left: 2, right: 2, bottom: 10 }}
        animate={{
          boxShadow: isHovered
            ? "0 0 0 3px rgba(76,175,80,0.35), 0 0 18px rgba(76,175,80,0.25)"
            : "0 0 0 0px rgba(76,175,80,0)",
        }}
        transition={{ duration: 0.3 }}
      />
      <motion.img
        src={MASCOT_URL}
        alt="OTB!!"
        draggable={false}
        className="absolute select-none"
        style={{
          width: 40, height: 40, top: 0, left: 0,
          objectFit: "contain",
          filter: isHovered ? glowHover : glowNormal,
          transition: "filter 0.3s ease",
        }}
        animate={logoAnimate}
      />
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: "-6px" }}
        animate={
          isHovered
            ? { y: [0, -4, 0], transition: { duration: 0.28, repeat: Infinity, repeatType: "reverse" } }
            : { y: [0, 2, 0], transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 } }
        }
      >
        <div style={{
          width: 0, height: 0,
          borderLeft: "7px solid transparent",
          borderRight: "7px solid transparent",
          borderTop: "8px solid rgba(255,255,255,0.85)",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
        }} />
      </motion.div>
      <AnimatePresence>
        {isHovered && (
          <>
            <motion.span key="spark1"
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: 1, scale: 1.1, x: 8, y: -8 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.22 }}
              className="absolute -top-1 -right-1 text-[11px] pointer-events-none select-none"
            >✨</motion.span>
            <motion.span key="spark2"
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: 1, scale: 1, x: -8, y: -10 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.22, delay: 0.07 }}
              className="absolute -top-2 left-0 text-[11px] pointer-events-none select-none"
            >⚡</motion.span>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

const MascotFace = MascotLogo

// ─── Main component ───────────────────────────────────────────────────────────

export function AnimeNavBar({
  items,
  className,
  defaultActive,
  logo,
  rightSlot,
  onActiveChange,
}: AnimeNavBarProps) {
  const [mounted, setMounted]               = useState(false)
  const [hoveredTab, setHoveredTab]         = useState<string | null>(null)
  const [activeTab, setActiveTab]           = useState<string>(defaultActive ?? (items[0]?.name ?? ""))
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isDesktop, setIsDesktop]           = useState(false)

  const manualOverrideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
    setIsDesktop(window.innerWidth >= 768)

    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    const handleScroll = () => setScrollProgress(Math.min(1, window.scrollY / 100))

    window.addEventListener("resize", handleResize, { passive: true })
    window.addEventListener("scroll", handleScroll, { passive: true })

    // IntersectionObserver: scroll-aware active tab
    const sectionItems = items.filter((i) => i.sectionId)
    const observers: IntersectionObserver[] = []
    sectionItems.forEach((item) => {
      const el = document.getElementById(item.sectionId!)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !manualOverrideRef.current) {
            setActiveTab(item.name)
            onActiveChange?.(item.name)
          }
        },
        { threshold: 0.35 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleScroll)
      observers.forEach((o) => o.disconnect())
    }
  }, [items])

  if (!mounted) return null

  const handleNavClick = (item: NavItem) => (e: React.MouseEvent) => {
    if (item.onClick) { e.preventDefault(); item.onClick(e) }
    setActiveTab(item.name)
    if (manualOverrideRef.current) clearTimeout(manualOverrideRef.current)
    manualOverrideRef.current = setTimeout(() => { manualOverrideRef.current = null }, 1500)
    onActiveChange?.(item.name)
  }

  // ── Glassmorphic background values ───────────────────────────────────────
  const bgAlpha1 = (0.40 + 0.45 * scrollProgress).toFixed(2)
  const bgAlpha2 = (0.15 + 0.25 * scrollProgress).toFixed(2)
  const blurPx   = (4 + scrollProgress * 12).toFixed(1)

  return (
    <div className={cn("fixed top-0 left-0 right-0 z-[9999] overflow-visible", className)}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="w-full px-3 md:px-6 pt-3 md:pt-10 pb-2 overflow-visible"
        style={{
          background: `linear-gradient(to bottom, rgba(10,31,10,${bgAlpha1}) 0%, rgba(10,31,10,${bgAlpha2}) 100%)`,
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 relative">

          {/* ── Logo ── */}
          {logo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
              {logo}
            </motion.div>
          )}

          {/* ── Nav items — desktop only (full animated pill centred on viewport) ── */}
          {isDesktop && (
            <div className="absolute left-1/2 -translate-x-1/2">
              <motion.div
                className="flex items-center gap-1 md:gap-1.5 rounded-full px-1.5 py-1.5 relative"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(61,107,71,0.30)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "0 0 18px rgba(61,107,71,0.22), 0 0 6px rgba(76,175,80,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {items.map((item) => {
                  const isActive  = activeTab === item.name
                  const isHovered = hoveredTab === item.name

                  return (
                    <a
                      key={item.name}
                      href={item.url}
                      onClick={handleNavClick(item)}
                      onMouseEnter={() => setHoveredTab(item.name)}
                      onMouseLeave={() => setHoveredTab(null)}
                      className={cn(
                        "relative cursor-pointer text-xs md:text-sm font-semibold px-4 md:px-5 py-2 rounded-full transition-colors duration-200 select-none overflow-visible",
                        isActive ? "text-white" : "text-white/60 hover:text-white"
                      )}
                    >
                      {/* ── Floating mascot above active tab ── */}
                      {isActive && (
                        <motion.div
                          layoutId="anime-mascot"
                          className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none"
                          initial={false}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                          <MascotFace isHovered={!!hoveredTab} />
                        </motion.div>
                      )}

                      {/* ── Multi-layer OTB-green glow on active tab ── */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-full -z-10 overflow-hidden"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.03, 1] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <div className="absolute inset-0 rounded-full blur-md"
                            style={{ background: `${OTB_GREEN_GLOW}0.28)` }} />
                          <div className="absolute rounded-full blur-xl"
                            style={{ inset: "-4px", background: `${OTB_GREEN_GLOW}0.18)` }} />
                          <div className="absolute rounded-full blur-2xl"
                            style={{ inset: "-8px", background: `${OTB_GREEN_GLOW}0.12)` }} />
                          <div className="absolute rounded-full blur-3xl"
                            style={{ inset: "-12px", background: `${OTB_GREEN_GLOW}0.06)` }} />
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${OTB_GREEN_GLOW}0) 0%, ${OTB_GREEN_GLOW}0.22) 50%, ${OTB_GREEN_GLOW}0) 100%)`,
                              animation: "otb-shine 3s ease-in-out infinite",
                            }}
                          />
                        </motion.div>
                      )}

                      {/* ── Active tab solid pill background ── */}
                      {isActive && (
                        <motion.div
                          layoutId="expanded-pill"
                          className="absolute inset-0 rounded-full -z-10"
                          style={{
                            background: `linear-gradient(135deg, ${OTB_GREEN_GLOW}0.22) 0%, ${OTB_GREEN_GLOW}0.12) 100%)`,
                            border: `1px solid ${OTB_GREEN_GLOW}0.35)`,
                          }}
                          transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        />
                      )}

                      {/* ── Hover background (non-active) ── */}
                      <AnimatePresence>
                        {isHovered && !isActive && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            className="absolute inset-0 bg-white/[0.07] rounded-full -z-10"
                          />
                        )}
                      </AnimatePresence>

                      {/* ── Label ── */}
                      <motion.span
                        className="relative z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.name}
                      </motion.span>

                      {/* ── Dropdown panel ── */}
                      <AnimatePresence>
                        {isHovered && item.dropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.96 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-[10000]"
                            style={{ pointerEvents: "auto" }}
                          >
                            <div className="flex justify-center mb-0.5">
                              <div
                                className="w-2.5 h-2.5 rotate-45 border-t border-l border-white/12"
                                style={{ background: "rgba(10,31,10,0.95)" }}
                              />
                            </div>
                            {item.dropdown}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* ── Tooltip ── */}
                      <AnimatePresence>
                        {isHovered && item.tooltip && !item.dropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.92 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-3 z-[10000]"
                          >
                            <div
                              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white/90 border border-white/12 shadow-xl"
                              style={{
                                background: "rgba(10,31,10,0.92)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                              }}
                            >
                              {item.tooltip}
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 overflow-hidden">
                                <div
                                  className="w-2 h-2 rotate-45 border border-white/12 mx-auto"
                                  style={{ background: "rgba(10,31,10,0.92)", marginTop: "2px" }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </a>
                  )
                })}
              </motion.div>
            </div>
          )}

          {/* ── Right slot (theme toggle + avatar dropdown) ── */}
          {rightSlot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="flex-none min-w-0 ml-auto"
            >
              {rightSlot}
            </motion.div>
          )}
        </div>

        {/* Mobile nav row removed — nav links live in the avatar dropdown on mobile */}
      </motion.div>
    </div>
  )
}
