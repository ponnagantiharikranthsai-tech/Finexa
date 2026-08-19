"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Download, WifiOff, CheckCircle2, X } from "lucide-react";

export function PwaRegister() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // 1. Identify borrower-facing routes (e.g., /apply/[code])
  const isBorrowerRoute = pathname?.startsWith("/apply");

  // 2. Helper to check if app is running in installed standalone PWA mode
  const isStandaloneMode = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes("android-app://")
    );
  }, []);

  // 3. Helper to check if user has already seen/dismissed the install card
  const hasSeenInstallCard = useCallback(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("finexa_install_card_seen") === "true";
    } catch (e) {
      return false;
    }
  }, []);

  // 4. Dismiss card & store flag in localStorage permanently
  const dismissInstallCard = useCallback(() => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem("finexa_install_card_seen", "true");
    } catch (e) {}
  }, []);

  // Service Worker Registration & Event Listeners
  useEffect(() => {
    // 1. Service Worker Registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  toast("New FINEXA version available!", {
                    description: "Click update to load the latest features.",
                    action: {
                      label: "Update Now",
                      onClick: () => {
                        window.location.reload();
                      },
                    },
                    duration: 10000,
                  });
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("PWA Service Worker registration notice:", err);
        });
    }

    // 2. Android Chrome PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check conditions: NOT borrower route, NOT standalone PWA, NOT already seen
      if (!isBorrowerRoute && !isStandaloneMode() && !hasSeenInstallCard()) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 3. Online/Offline Network Listeners
    const handleOffline = () => {
      if (!isBorrowerRoute) {
        toast.error("Internet connection lost. Financial actions require an active connection.", {
          icon: <WifiOff className="h-4 w-4 text-destructive" />,
          duration: 6000,
        });
      }
    };

    const handleOnline = () => {
      if (!isBorrowerRoute) {
        toast.success("Internet connection restored.", {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          duration: 4000,
        });
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isBorrowerRoute, isStandaloneMode, hasSeenInstallCard]);

  // 5-Second Auto-Dismiss Timer
  useEffect(() => {
    if (!showInstallBanner) return;

    const timer = setTimeout(() => {
      dismissInstallCard();
    }, 5000);

    return () => clearTimeout(timer);
  }, [showInstallBanner, dismissInstallCard]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      dismissInstallCard();
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("FINEXA App installed successfully!");
      }
    } catch (e) {
      console.warn("PWA install prompt error:", e);
    } finally {
      setDeferredPrompt(null);
      dismissInstallCard();
    }
  };

  // Guard: NEVER render on borrower application routes, installed PWA, or after dismissal
  if (isBorrowerRoute || isStandaloneMode() || !showInstallBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 max-w-sm rounded-2xl bg-[#17181D]/95 border border-[#FFD54A]/30 p-4 pt-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 relative">
      {/* Top-Right Close Button */}
      <button
        type="button"
        onClick={dismissInstallCard}
        className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-white/5 hover:bg-white/15 active:bg-red-500 active:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD54A] shrink-0"
        title="Close install prompt"
        aria-label="Close install prompt"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Card Body */}
      <div className="flex items-center gap-3 pr-6">
        <img
          src="/icon-192.png"
          alt="Finexa App Icon"
          className="h-10 w-10 object-contain rounded-xl bg-white border border-border/50 shrink-0 shadow-sm"
        />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-black uppercase tracking-wider text-white">Install FINEXA App</p>
          <p className="text-[10px] text-zinc-400 truncate">Fast standalone access on your phone</p>
        </div>

        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#FFD54A] text-[#0B0F19] text-xs font-extrabold uppercase tracking-wider hover:bg-[#FFE082] transition-colors shrink-0 shadow-md cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" /> Install
        </button>
      </div>
    </div>
  );
}
