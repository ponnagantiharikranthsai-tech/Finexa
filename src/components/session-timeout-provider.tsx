"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logoutAction } from "@/features/auth/actions/logout.action";

// Constants for inactivity and background timeouts
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const BACKGROUND_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isPublic = pathname === "/" || pathname === "/login" || pathname.startsWith("/apply/");

  // Explicit logout handler — ONLY executed when user intentionally signs out
  const handleExplicitLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const fallbackTimer = setTimeout(() => {
      window.location.href = "/login";
    }, 500);

    try {
      sessionStorage.clear();
      localStorage.removeItem("finexa_background_timestamp");

      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut().catch(() => {});
      await logoutAction().catch(() => {});
    } catch (error) {
      console.error("Error during explicit logout:", error);
    } finally {
      clearTimeout(fallbackTimer);
      window.location.href = "/login";
    }
  }, [isLoggingOut]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Inactivity tracking & background timeout monitoring
  useEffect(() => {
    if (!mounted || isPublic || isLoggingOut) return;

    let inactivityTimer: NodeJS.Timeout | null = null;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleExplicitLogout();
      }, INACTIVITY_TIMEOUT);
    };

    const handleActivity = () => {
      resetInactivityTimer();
    };

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        localStorage.setItem("finexa_background_timestamp", Date.now().toString());
      } else {
        const exitTimeStr = localStorage.getItem("finexa_background_timestamp");
        if (exitTimeStr) {
          const exitTime = parseInt(exitTimeStr, 10);
          const elapsed = Date.now() - exitTime;

          if (elapsed > BACKGROUND_TIMEOUT) {
            handleExplicitLogout();
          } else {
            localStorage.removeItem("finexa_background_timestamp");
            resetInactivityTimer();
          }
        }
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, isPublic, isLoggingOut, handleExplicitLogout]);

  // Show "Signing out securely..." ONLY during explicit user logout
  if (isLoggingOut) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0F19] text-white">
        <div className="h-8 w-8 border-4 border-[#FFD54A]/30 border-t-[#FFD54A] rounded-full animate-spin mb-4" />
        <p className="text-xs text-zinc-400 font-medium">Signing out securely…</p>
      </div>
    );
  }

  return <>{children}</>;
}
