/**
 * NotifyBell
 *
 * A compact subscribe/unsubscribe toggle shown on the Join page success step.
 * Displays a bell icon with a status label and handles all permission states.
 */

import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

interface NotifyBellProps {
  tournamentId: string;
  tournamentName: string;
  className?: string;
}

export function NotifyBell({ tournamentId, tournamentName, className = "" }: NotifyBellProps) {
  const { status, subscribe, unsubscribe, isLoading } = usePushSubscription({ tournamentId });

  // Don't render if push is unsupported
  if (status === "unsupported") return null;

  const handleClick = () => {
    if (isLoading) return;
    if (status === "subscribed") {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  const config: Record<string, { icon: React.ReactNode; label: string; subLabel: string; style: string }> = {
    idle: {
      icon: <Bell className="w-5 h-5" />,
      label: "Get Round Alerts",
      subLabel: "Tap to enable notifications",
      style: "bg-white/10 hover:bg-white/20 text-white border border-white/20",
    },
    loading: {
      icon: <Loader2 className="w-5 h-5 animate-spin" />,
      label: "Setting up…",
      subLabel: "Please wait",
      style: "bg-white/10 text-white/60 border border-white/10 cursor-wait",
    },
    subscribed: {
      icon: <BellRing className="w-5 h-5 text-[#39FF14]" />,
      label: "Notifications On",
      subLabel: "Tap to turn off",
      style: "bg-[#39FF14]/15 hover:bg-[#39FF14]/20 text-white border border-[#39FF14]/40",
    },
    unsubscribed: {
      icon: <BellOff className="w-5 h-5" />,
      label: "Notifications Off",
      subLabel: "Tap to re-enable",
      style: "bg-white/10 hover:bg-white/20 text-white/70 border border-white/15",
    },
    denied: {
      icon: <BellOff className="w-5 h-5 text-red-400" />,
      label: "Notifications Blocked",
      subLabel: "Enable in browser settings",
      style: "bg-red-500/10 text-white/60 border border-red-500/20 cursor-not-allowed",
    },
    error: {
      icon: <Bell className="w-5 h-5 text-yellow-400" />,
      label: "Try Again",
      subLabel: "Something went wrong",
      style: "bg-yellow-500/10 hover:bg-yellow-500/15 text-white/70 border border-yellow-500/20",
    },
  };

  const current = config[status] ?? config.idle;

  return (
    <button
      onClick={handleClick}
      disabled={status === "denied" || isLoading}
      aria-label={`${current.label} for ${tournamentName}`}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 text-left ${current.style} ${className}`}
    >
      <span className="flex-shrink-0">{current.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-tight">{current.label}</span>
        <span className="block text-xs opacity-70 mt-0.5">{current.subLabel}</span>
      </span>
    </button>
  );
}
