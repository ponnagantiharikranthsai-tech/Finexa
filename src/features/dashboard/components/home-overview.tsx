"use client";

import React, { useState, useTransition } from "react";
import dynamic from "next/dynamic";

// 1. Dynamic imports with SSR disabled for heavy modals on the main page
const CreateLoanModal = dynamic(
  () => import("@/features/loans/components/modals/create-loan-modal").then((m) => m.CreateLoanModal),
  { ssr: false }
);

const CapitalFundingModal = dynamic(
  () => import("@/features/capital/components/modals/capital-funding-modal").then((m) => m.CapitalFundingModal),
  { ssr: false }
);

export function HomeOverview() {
  const [activeModal, setActiveModal] = useState<"createLoan" | "capitalFunding" | null>(null);
  const [isPending, startTransition] = useTransition();

  // 2. Wrap state transitions to open/close modals without locking the main thread
  const handleOpenModal = (modalType: "createLoan" | "capitalFunding") => {
    startTransition(() => {
      setActiveModal(modalType);
    });
  };

  const handleCloseModal = () => {
    startTransition(() => {
      setActiveModal(null);
    });
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Welcome back to Finexa Smart Loan Management.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenModal("createLoan")}
            className="bg-[#eab308] px-4 py-2 text-xs sm:text-sm font-bold text-black rounded-xl hover:bg-yellow-400 transition-colors shadow-sm"
          >
            + New Loan
          </button>
          <button
            onClick={() => handleOpenModal("capitalFunding")}
            className="bg-[#27272a] border border-zinc-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            On-Demand Capital
          </button>
        </div>
      </div>

      {/* Render lazy-loaded modals conditionally */}
      {activeModal === "createLoan" && (
        <CreateLoanModal isOpen={true} onClose={handleCloseModal} />
      )}
      {activeModal === "capitalFunding" && (
        <CapitalFundingModal isOpen={true} onClose={handleCloseModal} />
      )}
    </div>
  );
}
