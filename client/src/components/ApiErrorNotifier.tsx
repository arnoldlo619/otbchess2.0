import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { API_ERROR_EVENT, type ApiErrorEventDetail } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";

const DUPLICATE_WINDOW_MS = 10_000;

export function ApiErrorNotifier() {
  const lastShown = useRef(new Map<string, number>());

  useEffect(() => {
    function handleApiError(event: Event) {
      const { error, url } = (event as CustomEvent<ApiErrorEventDetail>).detail;
      const key = `${url}:${error.code}`;
      const now = Date.now();
      if (now - (lastShown.current.get(key) ?? 0) < DUPLICATE_WINDOW_MS) return;
      lastShown.current.set(key, now);

      reportClientError({
        eventType: "api_error",
        error,
        path: url,
        requestId: error.requestId,
        status: error.status,
        code: error.code,
      });

      toast.error(error.code === "NETWORK_ERROR" ? "Connection interrupted" : "Request unavailable", {
        description: error.requestId
          ? `${error.message} Reference: ${error.requestId}`
          : error.message,
        duration: 8_000,
        id: `api-error-${key}`,
      });
    }

    window.addEventListener(API_ERROR_EVENT, handleApiError);
    return () => window.removeEventListener(API_ERROR_EVENT, handleApiError);
  }, []);

  return null;
}
