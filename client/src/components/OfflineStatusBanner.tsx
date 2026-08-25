import { useEffect, useRef, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";

type ConnectivityStatus = "offline" | "restored" | null;

export function OfflineStatusBanner() {
  const [status, setStatus] = useState<ConnectivityStatus>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : null,
  );
  const restoreTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearRestoreTimer = () => {
      if (restoreTimerRef.current !== null) {
        window.clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    };
    const handleOffline = () => {
      clearRestoreTimer();
      setStatus("offline");
    };
    const handleOnline = () => {
      clearRestoreTimer();
      setStatus((current) => current === "offline" ? "restored" : null);
      restoreTimerRef.current = window.setTimeout(() => setStatus(null), 2500);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      clearRestoreTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!status) return null;

  const offline = status === "offline";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connectivity-status"
      className={`fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[10000] mx-auto flex min-h-11 max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 ${
        offline
          ? "border-amber-400/35 bg-[oklch(0.20_0.045_75/0.96)] text-amber-50"
          : "border-emerald-400/35 bg-[oklch(0.20_0.055_145/0.96)] text-emerald-50"
      }`}
    >
      {offline ? <WifiOff className="h-5 w-5 shrink-0 text-amber-300" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{offline ? "You’re offline" : "Back online"}</p>
        <p className="text-xs text-white/70">
          {offline
            ? "Your current work stays on this device when possible. Reconnect to sync server changes."
            : "Server-backed changes can sync again."}
        </p>
      </div>
    </div>
  );
}
