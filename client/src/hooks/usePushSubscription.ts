/**
 * usePushSubscription
 *
 * Manages the full lifecycle of a Web Push subscription for a given tournament:
 *  1. Fetches the VAPID public key from the server.
 *  2. Requests notification permission from the browser.
 *  3. Creates a PushSubscription via the service worker.
 *  4. POSTs the subscription to the server so the director can broadcast.
 *  5. Supports unsubscribing (DELETEs from server + unsubscribes SW).
 *
 * Persists subscription state in sessionStorage so the UI reflects the correct
 * state on page reload without requiring a new permission prompt.
 */

import { useState, useEffect, useCallback } from "react";

export type PushStatus =
  | "idle"          // Not yet attempted
  | "unsupported"   // Browser doesn't support push
  | "denied"        // User denied permission
  | "subscribed"    // Active subscription
  | "unsubscribed"  // Explicitly unsubscribed
  | "loading"       // In-flight request
  | "error";        // Unexpected failure

interface UsePushSubscriptionOptions {
  tournamentId: string;
  enabled?: boolean; // Defaults to true; set false to skip auto-init
}

interface UsePushSubscriptionResult {
  status: PushStatus;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  isSubscribed: boolean;
  isLoading: boolean;
}

function storageKey(tournamentId: string) {
  return `otb-push-${tournamentId}`;
}

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-public-key");
  if (!res.ok) throw new Error("Could not fetch VAPID public key");
  const data = await res.json() as { publicKey: string };
  return data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)));
}

export function usePushSubscription({
  tournamentId,
  enabled = true,
}: UsePushSubscriptionOptions): UsePushSubscriptionResult {
  const [status, setStatus] = useState<PushStatus>(() => {
    if (typeof window === "undefined") return "idle";
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return "unsupported";
    }
    const stored = sessionStorage.getItem(storageKey(tournamentId));
    if (stored === "subscribed") return "subscribed";
    if (stored === "denied") return "denied";
    return "idle";
  });

  // Sync with Notification.permission on mount
  useEffect(() => {
    if (!enabled) return;
    if (status === "unsupported") return;
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setStatus("denied");
    }
  }, [enabled, status]);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    setStatus("loading");

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        sessionStorage.setItem(storageKey(tournamentId), "denied");
        return;
      }

      // 2. Get VAPID public key
      const vapidPublicKey = await getVapidPublicKey();

      // 3. Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // 4. Subscribe via PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 5. POST subscription to server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          subscription: subscription.toJSON(),
        }),
      });

      if (!res.ok) throw new Error("Failed to register subscription on server");

      setStatus("subscribed");
      sessionStorage.setItem(storageKey(tournamentId), "subscribed");
    } catch (err) {
      console.error("[push] Subscribe error:", err);
      setStatus("error");
    }
  }, [tournamentId]);

  const unsubscribe = useCallback(async () => {
    setStatus("loading");

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          // Notify server first
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tournamentId,
              subscription: subscription.toJSON(),
            }),
          });

          // Then unsubscribe in the browser
          await subscription.unsubscribe();
        }
      }

      setStatus("unsubscribed");
      sessionStorage.setItem(storageKey(tournamentId), "unsubscribed");
    } catch (err) {
      console.error("[push] Unsubscribe error:", err);
      setStatus("error");
    }
  }, [tournamentId]);

  return {
    status,
    subscribe,
    unsubscribe,
    isSubscribed: status === "subscribed",
    isLoading: status === "loading",
  };
}
