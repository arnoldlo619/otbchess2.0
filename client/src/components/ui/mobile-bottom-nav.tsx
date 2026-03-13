"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavItem {
  name: string
  url: string
  icon: LucideIcon
  onClick?: (e: React.MouseEvent) => void
}

interface MobileBottomNavProps {
  items: MobileNavItem[]
  activeTab: string
  onTabChange: (name: string) => void
  className?: string
}

export function MobileBottomNav({ items, activeTab, onTabChange, className }: MobileBottomNavProps) {
  return (
    // Only visible on small screens (hidden on md+)
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[9998] md:hidden",
        className
      )}
    >
      {/* Frosted glass bar */}
      <div className="bg-black/75 backdrop-blur-xl border-t border-white/10 px-2 pb-safe">
        <div className="flex items-center justify-around max-w-sm mx-auto">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.name

            return (
              <a
                key={item.name}
                href={item.url}
                onClick={(e) => {
                  if (item.onClick) { e.preventDefault(); item.onClick(e) }
                  onTabChange(item.name)
                }}
                className="relative flex flex-col items-center justify-center gap-0.5 py-3 px-4 min-w-[60px] select-none"
              >
                {/* Active indicator dot above icon */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active-dot"
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute top-1.5 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-[#4CAF50]"
                    />
                  )}
                </AnimatePresence>

                {/* Icon with active glow */}
                <div className="relative">
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 -m-2 bg-[#4CAF50]/20 rounded-full blur-md"
                    />
                  )}
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={cn(
                      "relative z-10 transition-colors duration-200",
                      isActive ? "text-[#4CAF50]" : "text-white/45"
                    )}
                  />
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-[10px] font-semibold tracking-wide transition-colors duration-200",
                    isActive ? "text-[#4CAF50]" : "text-white/40"
                  )}
                >
                  {item.name}
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
