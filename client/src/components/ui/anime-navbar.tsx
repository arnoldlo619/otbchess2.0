"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

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

// Mascot face rendered as a standalone floating element
function MascotFace({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="relative w-10 h-10">
      {/* White circle face */}
      <motion.div
        className="absolute inset-0 bg-white rounded-full shadow-lg"
        animate={
          isHovered
            ? { scale: [1, 1.12, 1], rotate: [0, -6, 6, 0], transition: { duration: 0.5 } }
            : { y: [0, -3, 0], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } }
        }
      >
        {/* Left eye */}
        <motion.div
          className="absolute w-1.5 h-1.5 bg-gray-900 rounded-full"
          animate={isHovered ? { scaleY: [1, 0.1, 1], transition: { duration: 0.18 } } : {}}
          style={{ left: "26%", top: "36%" }}
        />
        {/* Right eye */}
        <motion.div
          className="absolute w-1.5 h-1.5 bg-gray-900 rounded-full"
          animate={isHovered ? { scaleY: [1, 0.1, 1], transition: { duration: 0.18 } } : {}}
          style={{ right: "26%", top: "36%" }}
        />
        {/* Left cheek */}
        <motion.div
          className="absolute w-2 h-1.5 bg-[#4CAF50]/50 rounded-full"
          animate={{ opacity: isHovered ? 0.9 : 0.55 }}
          style={{ left: "10%", top: "57%" }}
        />
        {/* Right cheek */}
        <motion.div
          className="absolute w-2 h-1.5 bg-[#4CAF50]/50 rounded-full"
          animate={{ opacity: isHovered ? 0.9 : 0.55 }}
          style={{ right: "10%", top: "57%" }}
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
        {/* CSS triangle via borders */}
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

export function AnimeNavBar({
  items,
  className,
  defaultActive,
  logo,
  rightSlot,
  onActiveChange,
}: AnimeNavBarProps) {
  const [mounted, setMounted] = useState(false)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(defaultActive ?? (items[0]?.name ?? ""))
  const [scrolled, setScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0) // 0 = top, 1 = fully scrolled
  const [isDesktop, setIsDesktop] = useState(false)
  // Track whether the user has manually clicked a tab (suppress IntersectionObserver briefly)
  const manualOverrideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track the pixel offset of each nav item so we can position the mascot above it
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const pillRef = useRef<HTMLDivElement | null>(null)
  const [mascotLeft, setMascotLeft] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    setIsDesktop(window.innerWidth >= 768)
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener("resize", handleResize, { passive: true })
    const handleScroll = () => {
      const y = window.scrollY
      setScrolled(y > 60)
      // scrollProgress: 0 at top, 1 at 60px (where compact kicks in)
      setScrollProgress(Math.min(1, y / 60))
    }
    window.addEventListener("scroll", handleScroll, { passive: true })

    // IntersectionObserver: auto-switch active tab as sections scroll into view
    const sectionItems = items.filter((i) => i.sectionId)
    if (sectionItems.length === 0) {
      return () => window.removeEventListener("scroll", handleScroll)
    }

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

  // Recalculate mascot position whenever active tab or scroll state changes
  const recalcMascot = () => {
    if (!scrolled) { setMascotLeft(null); return }
    const el = itemRefs.current[activeTab]
    const pill = pillRef.current
    if (!el || !pill) return
    const elRect = el.getBoundingClientRect()
    const pillRect = pill.getBoundingClientRect()
    setMascotLeft(elRect.left - pillRect.left + elRect.width / 2)
  }

  useEffect(() => {
    recalcMascot()
    // Also recalc after a short delay to handle framer-motion layout settle
    const t = setTimeout(recalcMascot, 80)
    return () => clearTimeout(t)
  }, [activeTab, scrolled, mounted])

  if (!mounted) return null

  return (
    // The outer wrapper must NOT clip overflow so the mascot can float above
    <div className={cn("fixed top-0 left-0 right-0 z-[9999] overflow-visible", className)}>
      <AnimatePresence mode="wait">
        {/* ── EXPANDED state ──────────────────────────────────────────────────── */}
        {!scrolled ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="w-full px-3 md:px-6 pt-3 md:pt-4 pb-2 overflow-visible"
            style={{
              background: `linear-gradient(to bottom, rgba(10,31,10,${0.85 * scrollProgress}) 0%, rgba(10,31,10,0) 100%)`,
              backdropFilter: scrollProgress > 0.1 ? `blur(${scrollProgress * 8}px)` : undefined,
              WebkitBackdropFilter: scrollProgress > 0.1 ? `blur(${scrollProgress * 8}px)` : undefined,
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              {/* Logo */}
              {logo && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
                  {logo}
                </motion.div>
              )}

              {/* Nav links — full-width, no pill background */}
              <div className="flex items-center gap-0 md:gap-0.5">
                {items.map((item) => {
                  const isActive = activeTab === item.name
                  const isHovered = hoveredTab === item.name
                  return (
                    <a
                      key={item.name}
                      href={item.url}
                      onClick={(e) => {
                          if (item.onClick) { e.preventDefault(); item.onClick(e) }
                          // Manual click: set active and suppress IntersectionObserver for 1.5s
                          setActiveTab(item.name)
                          if (manualOverrideRef.current) clearTimeout(manualOverrideRef.current)
                          manualOverrideRef.current = setTimeout(() => { manualOverrideRef.current = null }, 1500)
                        }}
                      onMouseEnter={() => setHoveredTab(item.name)}
                      onMouseLeave={() => setHoveredTab(null)}
                      className={cn(
                        "relative cursor-pointer text-xs md:text-sm font-semibold px-3 md:px-5 py-2 rounded-full transition-colors duration-200 select-none",
                        isActive ? "text-white" : "text-white/55 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="expanded-pill"
                          className="absolute inset-0 rounded-full bg-white/10 border border-white/20"
                          transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        />
                      )}
                      <AnimatePresence>
                        {isHovered && !isActive && (
                          <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 rounded-full bg-white/[0.06]"
                          />
                        )}
                      </AnimatePresence>
                      <span className="relative z-10">{item.name}</span>
                    </a>
                  )
                })}
              </div>

              {/* Right slot */}
              {rightSlot && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                  {rightSlot}
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          /* ── COMPACT state (scrolled) ───────────────────────────────────────── */
          <motion.div
            key="compact"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            // paddingTop = mascot height (40px) + tail (8px) + gap (12px) = 60px (desktop)
            // On mobile: use minimal padding since mascot is hidden
            className="flex justify-center px-4 overflow-visible"
            style={{ paddingTop: isDesktop ? "60px" : "12px" }}
          >
            <div className="flex items-center gap-3 overflow-visible">
              {/* Logo pill */}
              {logo && (
                <motion.div
                  className="hidden md:flex items-center px-3 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl shadow-xl"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  {logo}
                </motion.div>
              )}

              {/* Nav pill — overflow:visible so mascot isn't clipped */}
              <div className="relative overflow-visible">
                {/* Mascot floats ABOVE the pill — desktop only */}
                <AnimatePresence>
                  {mascotLeft !== null && isDesktop && (
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 8, scale: 0.85 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      className="absolute pointer-events-none z-10"
                      style={{
                        // Position: center of active tab, above the pill (pill top - mascot height - tail - gap)
                        left: mascotLeft,
                        transform: "translateX(-50%)",
                        bottom: "calc(100% + 4px)",
                      }}
                    >
                      <MascotFace isHovered={hoveredTab !== null} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* The actual pill */}
                <motion.div
                  ref={pillRef}
                  className="flex items-center gap-1 bg-black/60 border border-white/10 backdrop-blur-xl py-1.5 px-1.5 rounded-full shadow-2xl overflow-visible"
                >
                  {items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.name
                    const isHovered = hoveredTab === item.name

                    return (
                      <a
                        key={item.name}
                        ref={(el) => { itemRefs.current[item.name] = el }}
                        href={item.url}
                        onClick={(e) => {
                          if (item.onClick) { e.preventDefault(); item.onClick(e) }
                          setActiveTab(item.name)
                          if (manualOverrideRef.current) clearTimeout(manualOverrideRef.current)
                          manualOverrideRef.current = setTimeout(() => { manualOverrideRef.current = null }, 1500)
                        }}
                        onMouseEnter={() => setHoveredTab(item.name)}
                        onMouseLeave={() => setHoveredTab(null)}
                        className={cn(
                          "relative cursor-pointer text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-200 select-none",
                          isActive ? "text-white" : "text-white/55 hover:text-white"
                        )}
                      >
                        {/* Active glow layers */}
                        {isActive && (
                          <motion.div
                            className="absolute inset-0 rounded-full -z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0.4, 0.65, 0.4], scale: [1, 1.04, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <div className="absolute inset-0 bg-[#4CAF50]/30 rounded-full blur-md" />
                            <div className="absolute inset-[-6px] bg-[#4CAF50]/18 rounded-full blur-xl" />
                            <div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#4CAF50]/25 to-transparent rounded-full"
                              style={{ animation: "shine 3s ease-in-out infinite" }}
                            />
                          </motion.div>
                        )}

                        {/* Active solid pill */}
                        {isActive && (
                          <motion.div
                            layoutId="compact-pill"
                            className="absolute inset-0 rounded-full -z-10 bg-[#3D6B47]/40 border border-[#4CAF50]/30"
                            transition={{ type: "spring", stiffness: 320, damping: 30 }}
                          />
                        )}

                        {/* Hover bg */}
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

                        {/* Label (desktop) / Icon (mobile) */}
                        <span className="hidden md:inline relative z-10">{item.name}</span>
                        <span className="md:hidden relative z-10">
                          <Icon size={18} strokeWidth={2.5} />
                        </span>
                      </a>
                    )
                  })}
                </motion.div>
              </div>

              {/* Right slot */}
              {rightSlot && (
                <motion.div
                  className="hidden md:flex items-center px-3 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl shadow-xl"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  {rightSlot}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
