"use client";

import React, { useState } from "react";
import { 
  Car, 
  Plus, 
  Download, 
  MessageSquare, 
  FileText, 
  CheckCircle, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Clock, 
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Share2
} from "lucide-react";
import { VehicleCollateralLoanData, VehicleLoanStatus } from "../types/vehicle-loan.types";
import { VehicleLoanCountdown } from "./vehicle-loan-countdown";
import { VehicleLoanNoticeModal } from "./vehicle-loan-notice-modal";
import { ShareApplicationModal } from "./share-application-modal";
import { VehicleLoanPdfExportModal } from "./vehicle-loan-pdf-export-modal";
import { VehicleLoanAgreementPreview } from "./vehicle-loan-agreement-preview";
import { generateVehicleLoanAgreementPdf } from "../utils/generate-vehicle-agreement-pdf";
import { updateVehicleLoanStatusAction } from "../actions/vehicle-loan.actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VehicleLoanDashboardProps {
  initialLoans: VehicleCollateralLoanData[];
  onOpenNewLoanWizard: () => void;
  onRefresh?: () => void;
}

export function VehicleLoanDashboard({
  initialLoans,
  onOpenNewLoanWizard,
  onRefresh,
}: VehicleLoanDashboardProps) {
  const [loans, setLoans] = useState<VehicleCollateralLoanData[]>(initialLoans);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLoanForNotice, setSelectedLoanForNotice] = useState<VehicleCollateralLoanData | null>(null);
  const [selectedLoanForPreview, setSelectedLoanForPreview] = useState<VehicleCollateralLoanData | null>(null);
  const [selectedLoanForShare, setSelectedLoanForShare] = useState<VehicleCollateralLoanData | null>(null);
  const [selectedLoanForPdf, setSelectedLoanForPdf] = useState<VehicleCollateralLoanData | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Portfolio metrics
  const totalDisbursed = loans.reduce((acc, l) => acc + (l.principalAmount || 0), 0);
  const totalPayable = loans.reduce((acc, l) => acc + (l.totalAmountPayable || 0), 0);
  const totalYield = totalPayable - totalDisbursed;
  const inYardCount = loans.filter((l) => l.status === "active_in_yard" || l.collateralStatus.includes("yard")).length;

  const filteredLoans = loans.filter((loan) => {
    const matchesSearch = 
      loan.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.vehicleRegNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.applicationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.registeredOwner.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || loan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarkSettled = async (loan: VehicleCollateralLoanData) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateVehicleLoanStatusAction(loan.applicationCode, "settled_released", {
        notes: "Full settlement of ₹35,000 received. Collateral released.",
      });
      if (res.success && res.data) {
        setLoans((prev) => prev.map((l) => (l.applicationCode === loan.applicationCode ? res.data! : l)));
        toast.success(`Loan ${loan.applicationCode} marked as settled! Vehicle released.`);
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Status update error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDirectPdfDownload = async (loan: VehicleCollateralLoanData) => {
    try {
      await generateVehicleLoanAgreementPdf(loan);
      toast.success(`Agreement PDF for ${loan.vehicleRegNumber} downloaded!`);
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Disbursed */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Disbursed</span>
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
              ₹
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black tracking-tight text-foreground">
            ₹{totalDisbursed.toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Hospital / Emergency Micro-Loans</p>
        </div>

        {/* Expected Recovery */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Payable</span>
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              ₹
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black tracking-tight text-foreground">
            ₹{totalPayable.toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
            +₹{totalYield.toLocaleString("en-IN")} Anticipated Gain
          </p>
        </div>

        {/* In Yard Units */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Vehicles In Yard</span>
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Car className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {inYardCount} {inYardCount === 1 ? "Unit" : "Units"}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Physical Yard Custody</p>
        </div>

        {/* Next Due Date */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Next Due Date</span>
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-destructive/10 text-destructive">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-black tracking-tight text-destructive">
            23 Oct 2026
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">1-Month Maturity Term</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border/60 shadow-sm">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Reg (AP39QY9367), Borrower, or Code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border/60 bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="all">All Statuses</option>
            <option value="active_in_yard">Active in Yard</option>
            <option value="pending_settlement">Pending Notice</option>
            <option value="settled_released">Settled & Released</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-border/60 bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Ledger"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNewLoanWizard}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl fx-brand-gradient text-white text-xs font-bold shadow-md fx-cta-glow fx-pressable"
          >
            <Plus className="h-4 w-4" />
            <span>New Vehicle Loan</span>
          </button>
        </div>
      </div>

      {/* Vehicle Collateral Loan Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredLoans.map((loan) => {
          const isSettled = loan.status === "settled_released";
          const isActiveInYard = loan.status === "active_in_yard" || loan.status === "pending_settlement";

          return (
            <div
              key={loan.applicationCode}
              className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-all space-y-4"
            >
              {/* Header Row: Vehicle Badge, Reg, Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Car className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-foreground uppercase tracking-wide">
                        {loan.vehicleRegNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-muted/60 text-[10px] font-mono text-muted-foreground">
                        {loan.applicationCode}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                      {loan.vehicleMakeModel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  {isActiveInYard ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      <span className="h-2 w-2 rounded-full bg-amber-500 fx-pulse-dot" />
                      Active - Vehicle in Yard
                    </span>
                  ) : isSettled ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Settled - Collateral Released
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-foreground">
                      {loan.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Content Grid: Parties, Financials & Countdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Borrower & Owner */}
                <div className="space-y-2.5 p-3.5 rounded-xl bg-muted/20 border border-border/30 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Borrower</span>
                    <p className="font-bold text-foreground">{loan.borrowerName}</p>
                    <p className="text-muted-foreground text-[11px]">Mobile: {loan.borrowerContact}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Registered Vehicle Owner</span>
                    <p className="font-bold text-foreground">{loan.registeredOwner}</p>
                    <p className="text-muted-foreground text-[11px]">Role: Collateral Guarantor</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Lender / Financier</span>
                    <p className="font-semibold text-foreground">{loan.lenderName} ({loan.lenderContact})</p>
                  </div>
                </div>

                {/* Column 2: Vehicle Specs & Custody */}
                <div className="space-y-2.5 p-3.5 rounded-xl bg-muted/20 border border-border/30 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Engine & Chassis</span>
                    <p className="font-mono text-[11px] text-foreground font-semibold">Eng: {loan.engineNumber}</p>
                    <p className="font-mono text-[11px] text-foreground font-semibold">Chas: {loan.chassisNumber}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{loan.yardLocation}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {loan.documentsCollected.slice(0, 3).map((doc, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-background border border-border/50 text-[10px] text-muted-foreground">
                        {doc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Column 3: Countdown Timer Widget */}
                <div>
                  <VehicleLoanCountdown dueDate={loan.dueDate} status={loan.status} />
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Principal: <strong>₹{loan.principalAmount.toLocaleString("en-IN")}</strong></span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-primary font-bold">Total Payable: ₹{loan.totalAmountPayable.toLocaleString("en-IN")}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Send to Borrower Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedLoanForShare(loan)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-sm transition-colors"
                    title="Send application form link to borrower via WhatsApp or SMS"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Send Form to Borrower</span>
                  </button>

                  {/* Settlement Notice Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedLoanForNotice(loan)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Notice</span>
                  </button>

                  {/* View Agreement */}
                  <button
                    type="button"
                    onClick={() => setSelectedLoanForPreview(loan)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/60 bg-secondary hover:bg-accent text-foreground text-xs font-semibold transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Agreement</span>
                  </button>

                  {/* Export PDF Types Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedLoanForPdf(loan)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/60 bg-secondary hover:bg-accent text-foreground text-xs font-semibold transition-colors"
                    title="Export PDF Document Types (Application Form, Agreement, Yard Receipt)"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>PDF Types</span>
                  </button>

                  {/* Mark Settled Button */}
                  {!isSettled && (
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleMarkSettled(loan)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Release Vehicle</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredLoans.length === 0 && (
          <div className="p-12 text-center rounded-2xl bg-card border border-border/60">
            <Car className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-foreground">No Vehicle Collateral Loans Found</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? "No records matched your search query." : "Register your first vehicle collateral loan."}
            </p>
          </div>
        )}
      </div>

      {/* WhatsApp / SMS Notice Modal */}
      {selectedLoanForNotice && (
        <VehicleLoanNoticeModal
          loan={selectedLoanForNotice}
          open={!!selectedLoanForNotice}
          onOpenChange={(open) => !open && setSelectedLoanForNotice(null)}
          onNoticeSent={() => {
            setSelectedLoanForNotice(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Send Application Form to Borrower Modal */}
      {selectedLoanForShare && (
        <ShareApplicationModal
          loan={selectedLoanForShare}
          open={!!selectedLoanForShare}
          onOpenChange={(open) => !open && setSelectedLoanForShare(null)}
        />
      )}

      {/* PDF Types Export Modal */}
      {selectedLoanForPdf && (
        <VehicleLoanPdfExportModal
          loan={selectedLoanForPdf}
          open={!!selectedLoanForPdf}
          onOpenChange={(open) => !open && setSelectedLoanForPdf(null)}
        />
      )}

      {/* Agreement Preview Full Modal */}
      {selectedLoanForPreview && (
        <Dialog open={!!selectedLoanForPreview} onOpenChange={(open) => !open && setSelectedLoanForPreview(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Vehicle Collateral Loan Agreement - {selectedLoanForPreview.applicationCode}
              </DialogTitle>
            </DialogHeader>
            <VehicleLoanAgreementPreview loan={selectedLoanForPreview} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
