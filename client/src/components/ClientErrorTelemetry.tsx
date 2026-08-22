import { useEffect } from "react";
import { reportClientError } from "@/lib/clientErrorReporter";

export function ClientErrorTelemetry() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportClientError({
        eventType: "unhandled_error",
        error: event.error ?? event.message,
      });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      reportClientError({
        eventType: "unhandled_rejection",
        error: event.reason,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
