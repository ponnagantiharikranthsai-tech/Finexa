"use client";

import React, { useState, useEffect } from "react";
import { 
  Car, 
  Plus, 
  LayoutDashboard, 
  FileText, 
  ArrowLeft,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { VehicleCollateralLoanData } from "@/features/vehicle-loans/types/vehicle-loan.types";
import { DEFAULT_VEHICLE_LOAN } from "@/features/vehicle-loans/schemas/vehicle-loan.schema";
import { VehicleLoanDashboard } from "@/features/vehicle-loans/components/vehicle-loan-dashboard";
import { VehicleLoanWizardForm } from "@/features/vehicle-loans/components/vehicle-loan-wizard-form";
import { fetchVehicleLoansAction } from "@/features/vehicle-loans/actions/vehicle-loan.actions";

export default function VehicleLoansPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "wizard">("dashboard");
  const [loans, setLoans] = useState<VehicleCollateralLoanData[]>([DEFAULT_VEHICLE_LOAN as any]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadLoans = async () => {
    setIsLoading(true);
    try {
      const res = await fetchVehicleLoansAction();
      if (res.success && res.data && res.data.length > 0) {
        setLoans(res.data);
      } else {
        setLoans([DEFAULT_VEHICLE_LOAN as any]);
      }
    } catch {
      setLoans([DEFAULT_VEHICLE_LOAN as any]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const handleLoanCreated = (newLoan: VehicleCollateralLoanData) => {
    setLoans((prev) => [newLoan, ...prev.filter((l) => l.applicationCode !== newLoan.applicationCode)]);
    setActiveTab("dashboard");
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-foreground">
                Vehicle Collateral Loan Management
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage vehicle-backed emergency micro-loans, physical yard bailment, and legal agreements
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "dashboard"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Yard Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wizard")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "wizard"
                ? "fx-brand-gradient text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Agreement Form</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === "dashboard" ? (
        <VehicleLoanDashboard
          initialLoans={loans}
          onOpenNewLoanWizard={() => setActiveTab("wizard")}
          onRefresh={loadLoans}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </button>

            <span className="text-xs text-muted-foreground">
              Auto-generating legal pledge agreement with dual signatures
            </span>
          </div>

          <VehicleLoanWizardForm
            onSuccess={handleLoanCreated}
            onCancel={() => setActiveTab("dashboard")}
          />
        </div>
      )}
    </div>
  );
}
