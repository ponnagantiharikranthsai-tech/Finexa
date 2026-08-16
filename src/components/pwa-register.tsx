"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, RefreshCw, WifiOff, CheckCircle2 } from "lucide-react";

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Service Worker Registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for service worker updates
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
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 3. Online/Offline Network Listeners
    const handleOffline = () => {
      toast.error("Internet connection lost. Financial actions require an active connection.", {
        icon: <WifiOff className="h-4 w-4 text-destructive" />,
        duration: 6000,
      });
    };

    const handleOnline = () => {
      toast.success("Internet connection restored.", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        duration: 4000,
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("FINEXA App installed successfully!");
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 max-w-sm rounded-2xl bg-[#17181D]/95 border border-[#FFD54A]/30 p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-3">
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
