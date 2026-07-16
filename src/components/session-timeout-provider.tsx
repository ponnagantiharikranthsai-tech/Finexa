"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logoutAction } from "@/features/auth/actions/logout.action";

// Constants for inactivity and background timeouts
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const BACKGROUND_TIMEOUT = 5 * 60 * 1000;   // 5 minutes in milliseconds

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isPublic = pathname === "/" || pathname === "/login" || pathname.startsWith("/apply/");

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      // Clear client-side flags first to prevent re-triggering
      sessionStorage.removeItem("session_active");
      localStorage.removeItem("finexa_background_timestamp");

      // Sign out from Supabase client-side
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();

      // Sign out from server-side (clears cookies and redirects)
      await logoutAction();
      
      // Fallback redirect if server action didn't redirect
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error during secure automatic logout:", error);
      // Fallback redirect on error
      window.location.href = "/login";
    } finally {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, router]);

  // Set mounted flag
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Session persistence verification (tab closing & reopening protection)
  useEffect(() => {
    if (!mounted || isPublic) return;

    const isActive = sessionStorage.getItem("session_active") === "true";
    if (!isActive) {
      handleLogout();
    }
  }, [mounted, pathname, isPublic, handleLogout]);

  // 2. Inactivity tracking & background timeout monitoring
  useEffect(() => {
    if (!mounted || isPublic || isLoggingOut) return;

    let inactivityTimer: NodeJS.Timeout | null = null;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    };

    // Activity event handler
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Register activity events
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Visibility change handler (background monitoring)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to the background - save the exit timestamp
        localStorage.setItem("finexa_background_timestamp", Date.now().toString());
      } else {
        // App returned to the foreground - check how long it was hidden
        const exitTimeStr = localStorage.getItem("finexa_background_timestamp");
        if (exitTimeStr) {
          const exitTime = parseInt(exitTimeStr, 10);
          const elapsed = Date.now() - exitTime;

          if (elapsed > BACKGROUND_TIMEOUT) {
            handleLogout();
          } else {
            // Re-entered before timeout, clear the timestamp and reset inactivity
            localStorage.removeItem("finexa_background_timestamp");
            resetInactivityTimer();
          }
        }
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial timer start
    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, isPublic, isLoggingOut, handleLogout]);

  // 3. Back-forward cache (bfcache) check
  useEffect(() => {
    if (!mounted) return;

    const handlePageShow = (event: PageTransitionEvent) => {
      if (isPublic) return;
      
      const isActive = sessionStorage.getItem("session_active") === "true";
      if (!isActive) {
        handleLogout();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [mounted, isPublic, handleLogout]);

  // Show a secure full-screen loading state when:
  // - We are client-side (mounted)
  // - We are on a protected page
  // - The session_active flag is missing OR we are in the process of logging out.
  const isSessionInvalid = mounted && !isPublic && (sessionStorage.getItem("session_active") !== "true" || isLoggingOut);

  if (isSessionInvalid) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="h-8 w-8 border-4 border-[#FFD54A]/30 border-t-[#FFD54A] rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
