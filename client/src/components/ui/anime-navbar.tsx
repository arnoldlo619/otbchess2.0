"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon, Menu, X } from "lucide-react"
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
  const [scrollProgress, setScrollProgress] = useState(0) // 0 = top, 1 = fully scrolled (for glassmorphic intensity)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isUltraSmall, setIsUltraSmall] = useState(false) // < 320px: show hamburger
  const [hamburgerOpen, setHamburgerOpen] = useState(false)
  const [drawerSwipeY, setDrawerSwipeY] = useState(0) // Track swipe Y position for visual feedback
  // Track whether the user has manually clicked a tab (suppress IntersectionObserver briefly)
  const manualOverrideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track touch start position for swipe gesture
  const touchStartYRef = useRef<number>(0)
  const touchStartTimeRef = useRef<number>(0)

  useEffect(() => {
    setMounted(true)
    setIsDesktop(window.innerWidth >= 768)
    setIsUltraSmall(window.innerWidth < 320)
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
      setIsUltraSmall(window.innerWidth < 320)
      // Close hamburger on resize to larger screen
      if (window.innerWidth >= 320) {
        setHamburgerOpen(false)
      }
    }
    window.addEventListener("resize", handleResize, { passive: true })
    const handleScroll = () => {
      const y = window.scrollY
      // scrollProgress: 0 at top, 1 at 100px (for glassmorphic intensity)
      setScrollProgress(Math.min(1, y / 100))
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

  if (!mounted) return null

  const handleNavClick = (item: NavItem) => (e: React.MouseEvent) => {
    if (item.onClick) { e.preventDefault(); item.onClick(e) }
    setActiveTab(item.name)
    if (manualOverrideRef.current) clearTimeout(manualOverrideRef.current)
    manualOverrideRef.current = setTimeout(() => { manualOverrideRef.current = null }, 1500)
    // Close hamburger after clicking
    setHamburgerOpen(false)
    onActiveChange?.(item.name)
  }

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY
    touchStartTimeRef.current = Date.now()
    setDrawerSwipeY(0)
  }

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (!hamburgerOpen) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartYRef.current
    if (deltaY < 0) {
      setDrawerSwipeY(deltaY)
    }
  }

  const handleDrawerTouchEnd = () => {
    const deltaY = drawerSwipeY
    const deltaTime = Date.now() - touchStartTimeRef.current
    const velocity = Math.abs(deltaY) / deltaTime
    if (Math.abs(deltaY) > 60 || velocity > 0.5) {
      setHamburgerOpen(false)
    }
    setDrawerSwipeY(0)
  }

  return (
    // The outer wrapper is fixed at top with glassmorphic background
    <div className={cn("fixed top-0 left-0 right-0 z-[9999] overflow-visible", className)}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="w-full px-3 md:px-6 pt-3 md:pt-4 pb-2 overflow-visible"
        style={{
          // Glassmorphic background: increases opacity and blur as user scrolls
          background: `linear-gradient(to bottom, rgba(10,31,10,${0.4 + 0.45 * scrollProgress}) 0%, rgba(10,31,10,${0.15 + 0.25 * scrollProgress}) 100%)`,
          backdropFilter: `blur(${4 + scrollProgress * 12}px)`,
          WebkitBackdropFilter: `blur(${4 + scrollProgress * 12}px)`,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo */}
          {logo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
              {logo}
            </motion.div>
          )}

          {/* Nav links — hamburger on ultra-small screens, full-width otherwise */}
          {isUltraSmall ? (
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
                      <motion.div
                        key="close"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <X className="w-6 h-6" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="menu"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Menu className="w-6 h-6" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0 md:gap-0.5">
              {items.map((item) => {
                const isActive = activeTab === item.name
                const isHovered = hoveredTab === item.name
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    onClick={handleNavClick(item)}
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
          )}

          {/* Right slot */}
          {rightSlot && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
              {rightSlot}
            </motion.div>
          )}
        </div>

        {/* Hamburger menu drawer — appears below expanded nav on ultra-small screens */}
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
                          ? "bg-[#3D6B47]/40 text-white border border-[#4CAF50]/30"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
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
