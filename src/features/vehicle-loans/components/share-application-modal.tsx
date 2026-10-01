"use client";

import React, { useState, useEffect } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  Send, 
  ExternalLink, 
  QrCode, 
  Smartphone,
  ShieldCheck,
  Link as LinkIcon
} from "lucide-react";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShareApplicationModalProps {
  loan: VehicleCollateralLoanData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareApplicationModal({
  loan,
  open,
  onOpenChange,
}: ShareApplicationModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [appUrl, setAppUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(`${window.location.origin}/apply/vehicle/${loan.applicationCode}`);
    }
  }, [loan.applicationCode]);

  const cleanPhone = (loan.borrowerContact || "9876543210").replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const whatsappMessage = 
`Hi ${loan.borrowerName},
Please complete and e-sign your FINEXA Vehicle Collateral Loan Application for *${loan.vehicleMakeModel}* (*${loan.vehicleRegNumber}*):

💰 *Principal Disbursed:* ₹${loan.principalAmount.toLocaleString("en-IN")}
🗓️ *Total Payable:* ₹${loan.totalAmountPayable.toLocaleString("en-IN")} due on *${loan.dueDate}*
📍 *Yard Custody:* ${loan.yardLocation}

👉 *Application Link:* ${appUrl}

Please verify your KYC details and accept the digital pledge agreement so we can complete your file.`;

  const whatsappShareUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    toast.success("Application link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappShareUrl, "_blank");
    toast.success(`Opening WhatsApp for ${loan.borrowerName}!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl border border-border/60 bg-card p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-primary/10 text-primary">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Send Application Form to Borrower
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Invite {loan.borrowerName} to complete KYC &amp; e-sign the vehicle pledge
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Borrower / Vehicle Capsule */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/40 text-xs">
          <div>
            <p className="font-bold text-foreground">{loan.borrowerName}</p>
            <p className="text-muted-foreground">{loan.borrowerContact} • ₹{loan.totalAmountPayable.toLocaleString("en-IN")}</p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono font-bold text-[11px]">
            {loan.vehicleRegNumber}
          </span>
        </div>

        {/* Link Copy Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Direct Borrower Portal Link</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={appUrl}
              className="flex-1 px-3 py-2 rounded-xl border border-border/60 bg-muted/20 text-xs font-mono text-foreground focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-secondary hover:bg-accent text-xs font-semibold text-foreground transition-colors shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* QR Code and Sharing Channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-2">
          {/* QR Code Card */}
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-muted/20 border border-border/30 text-center">
            <img
              src={qrCodeUrl}
              alt="Application Form QR Code"
              className="h-28 w-28 rounded-lg bg-white p-1 shadow-sm"
            />
            <span className="text-[10px] text-muted-foreground font-semibold mt-1.5 flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              Scan at Yard / Counter
            </span>
          </div>

          {/* Quick Share Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Send via WhatsApp</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </button>

            <button
              type="button"
              onClick={() => {
                window.open(`sms:${cleanPhone}?body=${encodeURIComponent(whatsappMessage)}`, "_self");
                toast.success("Opening SMS application!");
              }}
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border/60 bg-secondary hover:bg-accent text-foreground text-xs font-semibold transition-colors"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Send via Phone SMS</span>
            </button>
          </div>
        </div>

        {/* Footer Audit Notice */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            Once Kuppili Abhilash completes and signs the form online, the status in your FINEXA digital ledger will update automatically.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
