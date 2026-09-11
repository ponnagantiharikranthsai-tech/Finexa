"use client";

import { useEffect } from "react";

export function StartupPerformanceTracker() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.performance) {
      setTimeout(() => {
        const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType("paint");
        const fcp = paintEntries.find(p => p.name === "first-contentful-paint")?.startTime || 0;
        
        if (navEntry) {
          const htmlFetch = Math.round(navEntry.responseEnd);
          const domInteractive = Math.round(navEntry.domInteractive);
          const interactive = Math.round(navEntry.loadEventEnd || performance.now());

          console.log(
            `[FINEXA STARTUP PERFORMANCE]\n` +
            `├─ HTML Response: ${htmlFetch}ms\n` +
            `├─ First Contentful Paint: ${Math.round(fcp)}ms\n` +
            `├─ DOM Interactive: ${domInteractive}ms\n` +
            `└─ Fully Interactive: ${interactive}ms`
          );
        }
      }, 100);
    }
  }, []);

  return null;
}
