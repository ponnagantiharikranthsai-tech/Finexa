"use client";

import React, { useState } from "react";
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Printer,
  ChevronRight
} from "lucide-react";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { VehicleLoanPdfType, VEHICLE_LOAN_PDF_TYPES } from "../types/vehicle-loan-pdf.types";
import { generateVehicleLoanAgreementPdf } from "../utils/generate-vehicle-agreement-pdf";
import { generateVehicleApplicationPdf } from "../utils/generate-vehicle-application-pdf";
import { generateYardCustodyPdf } from "../utils/generate-yard-custody-pdf";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface VehicleLoanPdfExportModalProps {
  loan: VehicleCollateralLoanData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleLoanPdfExportModal({
  loan,
  open,
  onOpenChange,
}: VehicleLoanPdfExportModalProps) {
  const [downloadingType, setDownloadingType] = useState<VehicleLoanPdfType | null>(null);

  const handleDownload = async (type: VehicleLoanPdfType) => {
    setDownloadingType(type);
    try {
      if (type === "borrower_application") {
        await generateVehicleApplicationPdf(loan);
        toast.success("Borrower Application PDF downloaded successfully!");
      } else if (type === "loan_agreement") {
        await generateVehicleLoanAgreementPdf(loan);
        toast.success("Legal Agreement Deed PDF downloaded successfully!");
      } else if (type === "yard_custody_receipt") {
        await generateYardCustodyPdf(loan);
        toast.success("Yard Custody Receipt PDF downloaded successfully!");
      } else {
        await generateVehicleLoanAgreementPdf(loan);
        toast.success("PDF document downloaded successfully!");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate PDF document");
    } finally {
      setDownloadingType(null);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "FileSpreadsheet":
        return <FileSpreadsheet className="h-5 w-5 text-primary" />;
      case "ShieldCheck":
        return <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case "CheckCircle2":
        return <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case "AlertTriangle":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      default:
        return <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded-3xl border border-border/60 bg-card p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/10 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Export PDF Document
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Choose the PDF document type to generate for {loan.applicationCode} ({loan.vehicleRegNumber})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Vehicle / Loan Summary Tag */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/40 text-xs">
          <div>
            <span className="font-bold text-foreground">{loan.borrowerName}</span>
            <span className="text-muted-foreground"> • {loan.vehicleMakeModel}</span>
          </div>
          <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
            {loan.vehicleRegNumber}
          </span>
        </div>

        {/* PDF Type Selection List */}
        <div className="space-y-2.5 pt-1">
          {VEHICLE_LOAN_PDF_TYPES.slice(0, 3).map((item) => {
            const isDownloading = downloadingType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                disabled={isDownloading}
                onClick={() => handleDownload(item.type)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-background hover:bg-muted/30 hover:border-primary/40 transition-all text-left group shadow-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-muted/40 group-hover:bg-primary/10 transition-colors">
                    {getIcon(item.iconName)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-muted text-muted-foreground">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-primary shrink-0 ml-2">
                  <span>{isDownloading ? "Generating..." : "Download"}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Print Option Footer */}
        <div className="pt-2 flex items-center justify-between text-xs border-t border-border/40">
          <span className="text-[11px] text-muted-foreground">Executive A4 Print Layouts</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 hover:bg-accent text-foreground text-xs font-semibold transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Open Browser Print</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
