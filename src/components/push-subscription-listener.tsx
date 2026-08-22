"use client";

import React, { useEffect } from "react";
import {
  getVapidPublicKeyAction,
  savePushSubscriptionAction,
} from "@/features/notifications/actions/payment-reminders.action";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushSubscriptionListener() {
  useEffect(() => {
    // Background silent PushSubscription verification & auto-repair
    const syncPushSubscription = async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }

      try {
        // Only run auto-repair if Notification permission is ALREADY granted by the user
        if (Notification.permission !== "granted") {
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();

        // If permission is granted but browser subscription object is missing, auto-subscribe silently
        if (!sub) {
          let vapidPublicKey = "";
          try {
            const vapidRes = await getVapidPublicKeyAction();
            if (vapidRes.success && vapidRes.data?.vapidPublicKey) {
              vapidPublicKey = vapidRes.data.vapidPublicKey;
            }
          } catch (e) {}

          if (!vapidPublicKey) {
            try {
              const apiRes = await fetch("/api/notifications/vapid-public-key").then((r) => r.json());
              if (apiRes.success && apiRes.vapidPublicKey) {
                vapidPublicKey = apiRes.vapidPublicKey;
              }
            } catch (e) {}
          }

          if (!vapidPublicKey) {
            vapidPublicKey = "BMMwceYHROJAXOTI9c5xai1_5bQIgc-uZPf0f1YJc1xk4IE47c7Hy2FDOnAjHTv1aN-Ilzv3Ce1Ub86pdkImhcc";
          }

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }

        if (sub) {
          const subJson = sub.toJSON();
          const endpoint = subJson.endpoint || "";
          const p256dh = subJson.keys?.p256dh || "";
          const auth = subJson.keys?.auth || "";

          if (endpoint && p256dh && auth) {
            let saved = false;
            try {
              const res = await savePushSubscriptionAction(endpoint, p256dh, auth);
              if (res.success) saved = true;
            } catch (e) {}

            if (!saved) {
              try {
                await fetch("/api/notifications/save-subscription", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(subJson),
                });
              } catch (e) {}
            }

            try {
              localStorage.setItem("finexa_push_active", "true");
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("[PUSH LISTENER NOTICE] Auto-repair push notice:", err);
      }
    };

    // Run 4.0 seconds after mount in idle callback to guarantee zero impact on app startup
    const timer = setTimeout(() => {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(syncPushSubscription);
      } else {
        syncPushSubscription();
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
