"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface FinexaFeedbackProps {
  open: boolean;
  type?: "success" | "error" | "loading";
  title: string;
  subtitle?: string;
  duration?: number; // ms
  onClose?: () => void;
}

export function FinexaFeedbackOverlay({
  open,
  type = "success",
  title,
  subtitle,
  duration = 2000,
  onClose,
}: FinexaFeedbackProps) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
    if (open && type !== "loading" && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [open, type, duration, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-none">
      <div
        className={`pointer-events-auto max-w-sm w-full p-6 rounded-2xl border shadow-2xl text-center space-y-3 transition-all duration-300 ${
          type === "success"
            ? "bg-[#17181D]/95 border-[#D4AF37]/40 text-white fx-shadow-glow"
            : type === "error"
            ? "bg-[#1C1616]/95 border-red-500/40 text-white animate-shake"
            : "bg-[#17181D]/95 border-white/10 text-white"
        }`}
      >
        <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center">
          {type === "success" && (
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          )}
          {type === "error" && (
            <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
          )}
          {type === "loading" && (
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-extrabold uppercase tracking-wider text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground font-medium leading-relaxed">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
