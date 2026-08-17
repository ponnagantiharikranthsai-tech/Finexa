import React from "react";
import { CreditCard } from "lucide-react";

export default function LoansLoading() {
  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Loading loan portfolio...
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-card/60 border border-border/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
