import "./lib/sentry"; // Must be first — initializes Sentry before any other module
import { createRoot } from "react-dom/client";
import App from "./App";
import { logger } from "@/lib/logger";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ─── PWA Service Worker Registration ─────────────────────────────────────────
// Only register in production — in dev the SW caches /src/* Vite module URLs
// which causes "Failed to fetch dynamically imported module" after any HMR rebuild.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      // Keep the registration URL versioned. Static CDNs can otherwise serve an
      // older worker long after the application bundle has updated its policy.
      .register("/sw.js?v=otb-chess-v5", { scope: "/" })
      .then((registration) => {
        // Check for updates every time the page loads
        registration.update();
      })
      .catch((err) => {
        // SW registration failure is non-fatal — app still works online
        logger.warn("[OTB Chess] Service worker registration failed:", err);
      });
  });
} else if ("serviceWorker" in navigator && import.meta.env.DEV) {
  // In dev: unregister any previously installed SW to clear stale module caches
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}
