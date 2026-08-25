import { useEffect } from "react";
import { installEventSourceTelemetry, startWebVitalsReporting } from "@/lib/operationalTelemetry";

installEventSourceTelemetry();

export function OperationalTelemetry() {
  useEffect(() => {
    startWebVitalsReporting();
  }, []);

  return null;
}
