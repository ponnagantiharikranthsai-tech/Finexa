"use client";

import React, { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

/**
 * SlowNetworkIndicator
 * Detects background server synchronizations taking > 1.5 seconds.
 * Surfaces an ultra-sleek, non-intrusive top-bar shimmer line and a discrete floating badge,
 * keeping the cached UI 100% interactive and legible.
 */
export function SlowNetworkIndicator() {
  const isFetching = useIsFetching();
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isFetching > 0) {
      // Trigger after 1500ms of active fetching
      timer = setTimeout(() => {
        setIsSlow(true);
      }, 1500);
    } else {
      setIsSlow(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isFetching]);

  if (!isSlow) return null;

  return (
    <>
      {/* 1. Subtle, high-performance top-bar progress line */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[9999] overflow-hidden bg-primary/20 pointer-events-none">
        <div className="h-full w-full fx-brand-gradient animate-pulse" />
      </div>

      {/* 2. Discreet slow network toast badge */}
      <div
        aria-live="polite"
        className="fixed bottom-20 md:bottom-5 right-4 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/95 border border-primary/30 shadow-lg backdrop-blur-md text-[11px] font-semibold text-foreground animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <RefreshCw className="h-3 w-3 text-primary animate-spin" />
        <span>Updating in background (Slow network)</span>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
      </div>
    </>
  );
}

