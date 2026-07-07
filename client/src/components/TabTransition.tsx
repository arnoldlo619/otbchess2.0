/**
 * TabTransition — shared animated tab content wrapper
 *
 * Wraps tab panel content with a fade + subtle slide-up transition.
 * Uses framer-motion AnimatePresence in "wait" mode so the exiting
 * panel fully fades out before the entering panel animates in.
 *
 * Usage:
 *   <TabTransition tabKey={activeTab}>
 *     {content}
 *   </TabTransition>
 */

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface TabTransitionProps {
  /** Unique key for the current tab — change triggers the animation */
  tabKey: string;
  children: ReactNode;
  className?: string;
}

const variants = {
  enter: {
    opacity: 0,
    y: 10,
    scale: 0.995,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: "easeOut" as const,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.998,
    transition: {
      duration: 0.14,
      ease: "easeIn" as const,
    },
  },
};

export function TabTransition({ tabKey, children, className }: TabTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        variants={variants}
        initial="enter"
        animate="visible"
        exit="exit"
        className={className}
        // Prevent layout shift during animation
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
