"use client";

import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { CountdownTimeRemaining } from "../types/vehicle-loan.types";

interface VehicleLoanCountdownProps {
  dueDate: string; // "2026-10-23"
  applicationCode?: string;
  status?: string;
}

export function VehicleLoanCountdown({
  dueDate,
  status = "active_in_yard",
}: VehicleLoanCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<CountdownTimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOverdue: false,
    totalSecondsRemaining: 0,
  });

  useEffect(() => {
    function calculate() {
      // Due Date target: 23rd October 2026 23:59:59 IST
      const target = new Date(`${dueDate}T23:59:59`).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        const overdueDiff = Math.abs(diff);
        const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((overdueDiff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((overdueDiff / (1000 * 60)) % 60);
        const seconds = Math.floor((overdueDiff / 1000) % 60);
        setTimeLeft({
          days,
          hours,
          minutes,
          seconds,
          isOverdue: true,
          totalSecondsRemaining: 0,
        });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({
          days,
          hours,
          minutes,
          seconds,
          isOverdue: false,
          totalSecondsRemaining: Math.floor(diff / 1000),
        });
      }
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [dueDate]);

  const isUrgent = !timeLeft.isOverdue && timeLeft.days <= 5;
  const isSettled = status === "settled_released";

  if (isSettled) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-semibold">Settled & Collateral Vehicle Released</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>Settlement Countdown</span>
        </div>
        <div className="flex items-center gap-1">
          {timeLeft.isOverdue ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-destructive/15 text-destructive animate-pulse">
              <ShieldAlert className="h-3 w-3" />
              OVERDUE
            </span>
          ) : isUrgent ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              DUE SOON
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-primary/10 text-primary">
              1-MONTH TERM
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/40 border border-border/30">
          <span className="text-lg md:text-xl font-black tracking-tight text-foreground font-mono">
            {String(timeLeft.days).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Days
          </span>
        </div>

        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/40 border border-border/30">
          <span className="text-lg md:text-xl font-black tracking-tight text-foreground font-mono">
            {String(timeLeft.hours).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Hours
          </span>
        </div>

        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/40 border border-border/30">
          <span className="text-lg md:text-xl font-black tracking-tight text-foreground font-mono">
            {String(timeLeft.minutes).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Mins
          </span>
        </div>

        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/40 border border-border/30">
          <span className="text-lg md:text-xl font-black tracking-tight text-primary font-mono animate-pulse">
            {String(timeLeft.seconds).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Secs
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
        <span>Target: 23 Oct 2026</span>
        <span className="font-semibold text-foreground">₹35,000 Payable</span>
      </div>
    </div>
  );
}
