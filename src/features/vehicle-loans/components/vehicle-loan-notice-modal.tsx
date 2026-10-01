"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";
import { sendSettlementNoticeAction } from "../actions/vehicle-loan.actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface VehicleLoanNoticeModalProps {
  loan: VehicleCollateralLoanData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNoticeSent?: () => void;
}

export function VehicleLoanNoticeModal({
  loan,
  open,
  onOpenChange,
  onNoticeSent,
}: VehicleLoanNoticeModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);

  const noticeText = 
`🚨 *FINEXA - VEHICLE COLLATERAL SETTLEMENT NOTICE*

Dear ${loan.borrowerName},
Your Vehicle Collateral Loan (*${loan.applicationCode}*) for vehicle *${loan.vehicleMakeModel}* (Reg: *${loan.vehicleRegNumber}*) is due on *${loan.dueDate}*.

💰 *Total Amount Payable:* ₹${loan.totalAmountPayable.toLocaleString("en-IN")}
📍 *Vehicle Custody:* ${loan.yardLocation}
👤 *Lender Contact:* ${loan.lenderName} (${loan.lenderContact})

Please clear the settlement of ₹${loan.totalAmountPayable.toLocaleString("en-IN")} on or before the due date to collect your vehicle and original RC/RTO documents.
_Note: Delay beyond the due date activates vehicle custody liquidation clauses under signed Form 29 & 30._`;

  const cleanPhone = (loan.borrowerContact || "9876543210").replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(noticeText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(noticeText);
    setCopied(true);
    toast.success("Settlement notice copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, "_blank");
    toast.success("Opening WhatsApp with settlement notice!");
    if (onNoticeSent) onNoticeSent();
  };

  const handleSendSms = async () => {
    setIsSendingSms(true);
    try {
      const res = await sendSettlementNoticeAction({
        applicationCode: loan.applicationCode,
        borrowerName: loan.borrowerName,
        borrowerContact: loan.borrowerContact,
        lenderName: loan.lenderName,
        lenderContact: loan.lenderContact,
        vehicleRegNumber: loan.vehicleRegNumber,
        vehicleMakeModel: loan.vehicleMakeModel,
        totalAmountPayable: loan.totalAmountPayable,
        dueDate: loan.dueDate,
      });

      if (res.success) {
        if (res.smsSent) {
          toast.success("SMS settlement notice dispatched successfully!");
        } else {
          toast.info("Notice prepared! Use the WhatsApp link or copy text to notify.");
        }
        if (onNoticeSent) onNoticeSent();
      } else {
        toast.error(res.error || "Failed to trigger notice");
      }
    } catch (err: any) {
      toast.error("Error dispatching notice");
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl border border-border/60 bg-card p-6">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Trigger Settlement Notice
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Formal legal repayment reminder for ₹{loan.totalAmountPayable.toLocaleString("en-IN")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Notice Target Details */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Borrower</span>
            <p className="font-bold text-foreground">{loan.borrowerName}</p>
            <p className="text-muted-foreground">{loan.borrowerContact}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Vehicle Collateral</span>
            <p className="font-bold text-foreground">{loan.vehicleRegNumber}</p>
            <p className="text-muted-foreground">{loan.vehicleMakeModel}</p>
          </div>
        </div>

        {/* Notice Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Message Preview</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
          </div>
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 font-mono text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {noticeText}
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            This notice references legal covenants and signed RTO transfer Forms 29 & 30 under loan code <strong className="text-foreground">{loan.applicationCode}</strong>.
          </span>
        </div>

        <DialogFooter className="mt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleSendSms}
            disabled={isSendingSms}
            className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border/60 bg-secondary hover:bg-accent text-foreground text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSendingSms ? "Dispatching..." : "Send Direct SMS"}
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Open WhatsApp</span>
            <ExternalLink className="h-3 w-3 opacity-80" />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
