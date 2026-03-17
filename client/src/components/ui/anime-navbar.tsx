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
 *   - Hamburger drawer for ultra-small (< 320 px) screens with swipe-to-close
 *   - Animated hamburger → X icon transition
 *
 * Design tokens:
 *   OTB green: oklch(0.55 0.18 145) ≈ #3D6B47 / #4CAF50
 */

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── OTB design tokens ────────────────────────────────────────────────────────
const OTB_GREEN       = "#4CAF50"          // bright accent
const OTB_GREEN_DARK  = "#3D6B47"          // deep forest green
const OTB_GREEN_GLOW  = "rgba(61,107,71,"  // prefix for rgba glow layers

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  onClick?: (e: React.MouseEvent) => void
  /** Optional section ID to watch with IntersectionObserver for scroll-aware active state */
  sectionId?: string
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
// Floating face that springs to the active tab via layoutId.
// Idle animations: periodic eye-blink (every 4-7s) and head-tilt (every 6-10s)
// both pause during hover interactions.

type IdleState = "none" | "blink" | "tilt"

function MascotFace({ isHovered }: { isHovered: boolean }) {
  const [idleAnim, setIdleAnim] = useState<IdleState>("none")
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Schedule the next idle animation at a random interval
  const scheduleNextIdle = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    // Randomly pick blink (60%) or tilt (40%)
    const delay = 4000 + Math.random() * 4000 // 4–8s
    idleTimerRef.current = setTimeout(() => {
      const pick = Math.random() < 0.6 ? "blink" : "tilt"
      setIdleAnim(pick)
      // Reset after the animation completes, then schedule next
      const duration = pick === "blink" ? 300 : 700
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

  // Suppress idle animations while hovered
  const isBlinking = !isHovered && idleAnim === "blink"
  const isTilting  = !isHovered && idleAnim === "tilt"

  return (
    <div className="relative w-10 h-10">
      {/* White circle face */}
      <motion.div
        className="absolute inset-0 bg-white rounded-full shadow-lg"
        animate={
          isHovered
            ? { scale: [1, 1.12, 1], rotate: [0, -6, 6, 0], transition: { duration: 0.5 } }
            : isTilting
            ? { rotate: [0, -8, 8, -4, 0], transition: { duration: 0.65, ease: "easeInOut" } }
            : { y: [0, -3, 0], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } }
        }
      >
        {/* Left eye */}
        <motion.div
          className="absolute w-1.5 h-1.5 bg-gray-900 rounded-full"
          animate={
            isHovered
              ? { scaleY: [1, 0.1, 1], transition: { duration: 0.18 } }
              : isBlinking
              ? { scaleY: [1, 0.08, 1], transition: { duration: 0.25, ease: "easeInOut" } }
              : {}
          }
          style={{ left: "26%", top: "36%" }}
        />
        {/* Right eye */}
        <motion.div
          className="absolute w-1.5 h-1.5 bg-gray-900 rounded-full"
          animate={
            isHovered
              ? { scaleY: [1, 0.1, 1], transition: { duration: 0.18 } }
              : isBlinking
              ? { scaleY: [1, 0.08, 1], transition: { duration: 0.25, ease: "easeInOut" } }
              : {}
          }
          style={{ right: "26%", top: "36%" }}
        />
        {/* Left cheek — OTB green tint */}
        <motion.div
          className="absolute w-2 h-1.5 rounded-full"
          style={{ background: `${OTB_GREEN_GLOW}0.55)`, left: "10%", top: "57%" }}
          animate={{ opacity: isHovered ? 0.9 : 0.55 }}
        />
        {/* Right cheek */}
        <motion.div
          className="absolute w-2 h-1.5 rounded-full"
          style={{ background: `${OTB_GREEN_GLOW}0.55)`, right: "10%", top: "57%" }}
          animate={{ opacity: isHovered ? 0.9 : 0.55 }}
        />
        {/* Smile */}
        <motion.div
          className="absolute border-b-2 border-gray-900 rounded-full"
          animate={isHovered ? { scaleY: 1.6, y: -1 } : { scaleY: 1, y: 0 }}
          style={{ left: "30%", right: "30%", top: "58%", height: "6px" }}
        />
        {/* Sparkles on hover */}
        <AnimatePresence>
          {isHovered && (
            <>
              <motion.span
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: 6, y: -6 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute -top-1 -right-1 text-[10px] pointer-events-none"
              >✨</motion.span>
              <motion.span
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: -6, y: -8 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ delay: 0.08 }}
                className="absolute -top-2 left-0 text-[10px] pointer-events-none"
              >✨</motion.span>
            </>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Downward-pointing triangle tail */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: "-7px" }}
        animate={
          isHovered
            ? { y: [0, -4, 0], transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" } }
            : { y: [0, 2, 0], transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 } }
        }
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: "8px solid white",
          }}
        />
      </motion.div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnimeNavBar({
  items,
  className,
  defaultActive,
  logo,
  rightSlot,
  onActiveChange,
}: AnimeNavBarProps) {
  const [mounted, setMounted]           = useState(false)
  const [hoveredTab, setHoveredTab]     = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState<string>(defaultActive ?? (items[0]?.name ?? ""))
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isDesktop, setIsDesktop]       = useState(false)
  const [isUltraSmall, setIsUltraSmall] = useState(false)
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [drawerSwipeY, setDrawerSwipeY] = useState(0)

  const manualOverrideRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartYRef     = useRef<number>(0)
  const touchStartTimeRef  = useRef<number>(0)

  useEffect(() => {
    setMounted(true)
    setIsDesktop(window.innerWidth >= 768)
    setIsUltraSmall(window.innerWidth < 320)

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
      setIsUltraSmall(window.innerWidth < 320)
      if (window.innerWidth >= 320) setHamburgerOpen(false)
    }
    const handleScroll = () => {
      setScrollProgress(Math.min(1, window.scrollY / 100))
    }

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
    setHamburgerOpen(false)
    onActiveChange?.(item.name)
  }

  // ── Swipe-to-close gesture handlers ──────────────────────────────────────
  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current    = e.touches[0].clientY
    touchStartTimeRef.current = Date.now()
    setDrawerSwipeY(0)
  }
  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (!hamburgerOpen) return
    const deltaY = e.touches[0].clientY - touchStartYRef.current
    if (deltaY < 0) setDrawerSwipeY(deltaY)
  }
  const handleDrawerTouchEnd = () => {
    const deltaTime = Date.now() - touchStartTimeRef.current
    const velocity  = Math.abs(drawerSwipeY) / deltaTime
    if (Math.abs(drawerSwipeY) > 60 || velocity > 0.5) setHamburgerOpen(false)
    setDrawerSwipeY(0)
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
        className="w-full px-3 md:px-6 pt-28 pb-3 overflow-visible"
        style={{
          background: `linear-gradient(to bottom, rgba(10,31,10,${bgAlpha1}) 0%, rgba(10,31,10,${bgAlpha2}) 100%)`,
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">

          {/* ── Logo ── */}
          {logo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
              {logo}
            </motion.div>
          )}

          {/* ── Nav items (or hamburger on ultra-small) ── */}
          {isUltraSmall ? (
            /* Hamburger toggle button */
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={() => setHamburgerOpen(!hamburgerOpen)}
                className="relative cursor-pointer text-white/80 hover:text-white p-2"
                aria-label="Toggle menu"
              >
                <motion.div
                  animate={{ rotate: hamburgerOpen ? 90 : 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="w-6 h-6"
                >
                  <AnimatePresence mode="wait">
                    {hamburgerOpen ? (
                      <motion.div key="close"
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}
                      >
                        <X className="w-6 h-6" />
                      </motion.div>
                    ) : (
                      <motion.div key="menu"
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}
                      >
                        <Menu className="w-6 h-6" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>
            </div>
          ) : (
            /* Full nav pill — centred, floating */
            <div className="flex-1 flex justify-center">
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
                {/* Mascot — springs between active tabs via layoutId */}
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
                          className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none"
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
                          {/* Inner glow layers */}
                          <div className="absolute inset-0 rounded-full blur-md"
                            style={{ background: `${OTB_GREEN_GLOW}0.28)` }} />
                          <div className="absolute rounded-full blur-xl"
                            style={{ inset: "-4px", background: `${OTB_GREEN_GLOW}0.18)` }} />
                          <div className="absolute rounded-full blur-2xl"
                            style={{ inset: "-8px", background: `${OTB_GREEN_GLOW}0.12)` }} />
                          <div className="absolute rounded-full blur-3xl"
                            style={{ inset: "-12px", background: `${OTB_GREEN_GLOW}0.06)` }} />
                          {/* Shine sweep */}
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

                      {/* ── Label: text on desktop, icon on mobile ── */}
                      <motion.span
                        className="hidden md:inline relative z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.name}
                      </motion.span>
                      <motion.span
                        className="md:hidden relative z-10"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <item.icon size={16} strokeWidth={2.5} />
                      </motion.span>
                    </a>
                  )
                })}
              </motion.div>
            </div>
          )}

          {/* ── Right slot ── */}
          {rightSlot && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
              {rightSlot}
            </motion.div>
          )}
        </div>

        {/* ── Hamburger drawer (ultra-small screens only) ── */}
        <AnimatePresence>
          {isUltraSmall && hamburgerOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", y: drawerSwipeY }}
              exit={{ opacity: 0, height: 0, y: -100 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
              className="overflow-hidden border-t border-white/10 cursor-grab active:cursor-grabbing"
            >
              <div className="flex flex-col gap-1 px-3 py-3">
                {items.map((item) => {
                  const isActive = activeTab === item.name
                  return (
                    <a
                      key={item.name}
                      href={item.url}
                      onClick={handleNavClick(item)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium",
                        isActive
                          ? "text-white border border-[#4CAF50]/30"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                      style={isActive ? { background: `${OTB_GREEN_GLOW}0.35)` } : {}}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </a>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
