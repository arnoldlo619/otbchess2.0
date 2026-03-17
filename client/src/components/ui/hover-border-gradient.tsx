'use client'
/**
 * HoverBorderGradient — animated rotating border gradient pill.
 * Adapted for OTB Chess: uses the platform's green accent colour instead of blue.
 */
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs))
}

type Direction = 'TOP' | 'LEFT' | 'BOTTOM' | 'RIGHT'

const movingMap: Record<Direction, string> = {
  TOP: 'radial-gradient(20.7% 50% at 50% 0%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
  LEFT: 'radial-gradient(16.6% 43.1% at 0% 50%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
  BOTTOM: 'radial-gradient(20.7% 50% at 50% 100%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
  RIGHT: 'radial-gradient(16.2% 41.2% at 100% 50%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
}

// OTB Chess green highlight
const highlight =
  'radial-gradient(75% 181% at 50% 50%, oklch(0.65 0.18 145) 0%, rgba(255,255,255,0) 100%)'

export interface HoverBorderGradientProps
  extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  containerClassName?: string
  className?: string
  duration?: number
  clockwise?: boolean
}

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Element = 'div',
  duration = 1.4,
  clockwise = true,
  ...props
}: React.PropsWithChildren<HoverBorderGradientProps>) {
  const [hovered, setHovered] = useState(false)
  const [direction, setDirection] = useState<Direction>('BOTTOM')

  const rotateDirection = (current: Direction): Direction => {
    const dirs: Direction[] = ['TOP', 'LEFT', 'BOTTOM', 'RIGHT']
    const idx = dirs.indexOf(current)
    const next = clockwise
      ? (idx - 1 + dirs.length) % dirs.length
      : (idx + 1) % dirs.length
    return dirs[next]
  }

  useEffect(() => {
    if (hovered) return
    const interval = setInterval(() => {
      setDirection((prev) => rotateDirection(prev))
    }, duration * 1000)
    return () => clearInterval(interval)
  }, [hovered, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Element
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative flex h-min w-fit flex-col flex-nowrap content-center items-center justify-center overflow-visible rounded-full p-px transition duration-500',
        containerClassName
      )}
      {...props}
    >
      {/* Inner content */}
      <div
        className={cn(
          'relative z-10 w-auto rounded-[inherit] px-3 py-1.5',
          className
        )}
      >
        {children}
      </div>

      {/* Animated gradient border */}
      <motion.div
        className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
        style={{ filter: 'blur(2px)', width: '100%', height: '100%' }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered
            ? [movingMap[direction], highlight]
            : movingMap[direction],
        }}
        transition={{ ease: 'linear', duration: duration ?? 1.4 }}
      />

      {/* Background fill (sits between border gradient and content) */}
      <div className="absolute inset-0.5 z-[1] rounded-[100px] bg-inherit" />
    </Element>
  )
}

export default HoverBorderGradient
