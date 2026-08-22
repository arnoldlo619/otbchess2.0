import { ApiError, toApiError } from "@/lib/apiFetch";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

interface ApiErrorNoticeProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
  isDark?: boolean;
}

export function ApiErrorNotice({
  error,
  title,
  onRetry,
  className = "",
  isDark = true,
}: ApiErrorNoticeProps) {
  if (!error) return null;

  const apiError = toApiError(error);
  const isNetworkError = apiError.code === "NETWORK_ERROR" || apiError.code === "REQUEST_TIMEOUT";
  const Icon = isNetworkError ? WifiOff : AlertTriangle;
  const heading = title ?? (isNetworkError ? "Connection interrupted" : "We couldn’t complete that request");

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 ${isDark ? "border-red-400/25 bg-red-400/8" : "border-red-700/20 bg-red-50"} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? "bg-red-400/10 text-red-300" : "bg-red-100 text-red-700"}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${isDark ? "text-red-100" : "text-red-950"}`}>{heading}</p>
          <p className={`mt-0.5 text-xs leading-relaxed ${isDark ? "text-red-200/70" : "text-red-800"}`}>
            {apiError.message}
          </p>
          {apiError.requestId && (
            <p className={`mt-1.5 text-[11px] ${isDark ? "text-white/35" : "text-slate-500"}`}>
              Reference: {apiError.requestId}
            </p>
          )}
        </div>
        {onRetry && apiError.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition active:scale-[0.97] ${isDark ? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10" : "border-red-200 bg-white text-red-800 hover:bg-red-50"}`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function isRetryableApiError(error: unknown): boolean {
  return error instanceof ApiError ? error.retryable : toApiError(error).retryable;
}
