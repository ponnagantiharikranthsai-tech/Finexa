"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { submitLoanApplicationAction } from "@/features/applications/actions/submit-application.action";
import { Wifi, WifiOff } from "lucide-react";

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables are missing.");
    return null;
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);

  // Check initial connection status on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
    }
  }, []);

  // 1. Process Offline Sync Queue when Connection returns
  const processSyncQueue = async () => {
    try {
      const queueRaw = localStorage.getItem("finexa_offline_sync_queue");
      if (!queueRaw) return;

      const queue: Array<{ type: string; data: any; id: string }> = JSON.parse(queueRaw);
      if (queue.length === 0) return;

      toast.loading(`Syncing ${queue.length} pending offline actions...`, { id: "offline-sync" });

      const failed: typeof queue = [];

      for (const item of queue) {
        if (item.type === "submit_application") {
          const formData = new FormData();
          Object.entries(item.data).forEach(([key, val]) => {
            formData.append(key, String(val));
          });

          const result = await submitLoanApplicationAction(null, formData);
          if (!result.success) {
            console.error("Failed to sync offline item:", result.error);
            failed.push(item);
          }
        }
      }

      if (failed.length > 0) {
        localStorage.setItem("finexa_offline_sync_queue", JSON.stringify(failed));
        toast.error(`Offline sync complete. ${failed.length} actions failed to synchronize.`, { id: "offline-sync" });
      } else {
        localStorage.removeItem("finexa_offline_sync_queue");
        toast.success("All offline actions successfully synchronized!", { id: "offline-sync" });
        router.refresh();
      }
    } catch (err) {
      console.error("Error processing offline queue:", err);
      toast.error("Failed to process offline queue.", { id: "offline-sync" });
    }
  };

  useEffect(() => {
    // 2. Network status event listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored! Finexa is back online.", {
        description: "Synchronizing data...",
        duration: 4000,
      });
      processSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Connection lost. You are now offline.", {
        description: "Your actions will be cached locally and synced when you reconnect.",
        duration: 5000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 3. Deferred Supabase Realtime Database Subscriptions (Async non-blocking)
    let channel: any = null;
    const timer = setTimeout(() => {
      const client = getSupabaseClient();
      if (!client) return;

      channel = client
        .channel("finexa-realtime-db")
        .on(
          "postgres_changes",
          { event: "*", schema: "public" },
          (payload) => {
            console.log("Realtime DB Broadcast payload:", payload);
            router.refresh();

            const table = payload.table;
            const event = payload.eventType;

            if (table && event) {
              let message = "";
              if (table === "loans") {
                message = event === "INSERT" ? "A new loan record has been registered." : "Loan details updated.";
              } else if (table === "borrowers") {
                message = event === "INSERT" ? "A new borrower profile has been created." : "Borrower details updated.";
              } else if (table === "loan_applications") {
                message = event === "INSERT" ? "A customer completed their loan application KYC!" : "Application status updated.";
              } else if (table === "payments") {
                message = "A new repayment was processed.";
              }

              if (message) {
                toast.info(message, {
                  description: "Synchronized in real-time.",
                  duration: 3500,
                });
              }
            }
          }
        )
        .subscribe();
    }, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(timer);
      if (channel) {
        const client = getSupabaseClient();
        client?.removeChannel(channel);
      }
    };
  }, [router]);

  return (
    <>
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black text-center text-xs font-bold py-1.5 flex items-center justify-center gap-2 select-none">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode: Using cached views. Submissions will queue locally.</span>
        </div>
      )}
      {children}
    </>
  );
}
