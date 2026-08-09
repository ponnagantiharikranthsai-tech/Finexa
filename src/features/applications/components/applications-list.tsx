"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { generateLinkAction } from "../actions/generate-link.action";
import { getApplicationsAction } from "../actions/get-applications.action";
import { verifyApplicationAction } from "../actions/verify-application.action";
import {
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Clock,
  ArrowRight,
  Download,
  UserCheck,
  FileText,
  Phone,
  Mail,
  FileSignature,
  FileDown,
  MessageSquare
} from "lucide-react";
import type { ApplicationWithBorrower } from "../repository/application.repository";
import { calculateDueDate } from "@/domain/due-date-calculator";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";

interface ApplicationsListProps {
  initialApps: ApplicationWithBorrower[];
  total: number;
  totalPages: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-secondary text-primary border border-border",
    pending_verification: "bg-amber-500/10 text-amber-500 border border-amber-500/30 dark:text-amber-400 dark:border-amber-400/30",
    approved: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 dark:text-emerald-400 dark:border-emerald-400/30",
    expired: "bg-muted/50 text-muted-foreground border border-border/50",
  };

  const labelMap: Record<string, string> = {
    active: "Active Link",
    pending_verification: "Pending Verification",
    approved: "Approved",
    expired: "Expired",
  };

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status] ?? ""}`}>
      {labelMap[status] ?? status}
    </span>
  );
}

function calculateDurationText(startStr: string, dueStr: string, interestType: "monthly" | "daily"): string {
  if (!startStr || !dueStr) return "";
  
  const parseDate = (dStr: string) => {
    const [y, m, d] = dStr.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  };
  
  const start = parseDate(startStr);
  const due = parseDate(dueStr);
  
  if (due <= start) return "0 Days";
  
  const totalDays = Math.ceil((due.getTime() - start.getTime()) / (1000 * 3600 * 24));
  
  if (interestType === "daily") {
    return `${totalDays} ${totalDays === 1 ? "Day" : "Days"}`;
  } else {
    const totalMonths = Math.round(totalDays / 30.417);
    const months = Math.max(1, totalMonths);
    return `${months} ${months === 1 ? "Month" : "Months"}`;
  }
}

export function ApplicationsList({ initialApps, total: initialTotal, totalPages: initialTotalPages }: ApplicationsListProps) {
  const [apps, setApps] = useState<ApplicationWithBorrower[]>(initialApps);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Dialog States
  const [generateOpen, setGenerateOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithBorrower | null>(null);

  // Link Generation Form States
  const [principal, setPrincipal] = useState("50000");
  const [interestRate, setInterestRate] = useState("20");
  const [interestType, setInterestType] = useState<"monthly" | "daily">("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]!);
  const [dueDate, setDueDate] = useState("");
  const [loanDuration, setLoanDuration] = useState("30 Days");
  const [expiryDays, setExpiryDays] = useState("7");
  const [notes, setNotes] = useState("");

  // Live interest calculation (BR-1: ₹ per ₹1,000 / month)
  const numericPrincipal = Number(principal || 0);
  const numericRate = Number(interestRate || 0);
  const monthlyInterest = calculateMonthlyInterest(numericPrincipal, numericRate);
  const dailyInterest = monthlyInterest / 30;
  const computedInterestAmount = Math.max(0, Math.round(interestType === "daily" ? dailyInterest * 30 : monthlyInterest));
  const totalDueAtTerm = numericPrincipal + computedInterestAmount;

  // Result Link State
  const [generatedLinkData, setGeneratedLinkData] = useState<{ code: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-calculate Due Date if Start Date changes
  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate);
      const computedDue = calculateDueDate(start);
      setDueDate(computedDue.toISOString().split("T")[0]!);
    }
  }, [startDate]);

  // Auto-calculate Loan Duration when Start Date, Due Date, or Interest Type changes
  useEffect(() => {
    const computedDuration = calculateDurationText(startDate, dueDate, interestType);
    setLoanDuration(computedDuration);
  }, [startDate, dueDate, interestType]);

  // Refresh applications list
  const refreshApps = (currentSearch = search, currentStatus = status, currentPage = page) => {
    startTransition(async () => {
      const filters: any = {};
      if (currentSearch) filters.search = currentSearch;
      if (currentStatus !== "all") filters.status = currentStatus;
      const res = await getApplicationsAction(filters, currentPage, 20);
      if (res.success) {
        setApps(res.data.data);
      }
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    refreshApps(val, status, 1);
  };

  const handleStatusChange = (val: string | null) => {
    const s = val || "all";
    setStatus(s);
    setPage(1);
    refreshApps(search, s, 1);
  };

  // Generate Link submit
  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("principal", principal);
    fd.append("interestAmount", computedInterestAmount.toString());
    fd.append("interestType", interestType);
    fd.append("startDate", startDate);
    fd.append("dueDate", dueDate);
    fd.append("loanDuration", loanDuration);
    fd.append("expiryDays", expiryDays);
    fd.append("notes", notes);

    startTransition(async () => {
      const res = await generateLinkAction(null, fd);
      if (res.success) {
        setGeneratedLinkData(res.data);
        setGenerateOpen(false);
        setSuccessOpen(true);
        // Reset form
        setNotes("");
        refreshApps();
      } else {
        const errMsg = typeof res.error === "string"
          ? res.error
          : Object.entries(res.error)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
              .join("; ");
        toast.error(errMsg || "Failed to generate link");
      }
    });
  };

  // Verify / Approve or Reject Application
  const handleVerifyApplication = async (appId: string, actionType: "approve" | "reject") => {
    startTransition(async () => {
      const res = await verifyApplicationAction(appId, actionType);
      if (res.success) {
        toast.success(`Application successfully ${actionType === "approve" ? "approved" : "rejected"}!`);
        setDetailsOpen(false);
        refreshApps();
      } else {
        toast.error(typeof res.error === "string" ? res.error : `${actionType} action failed`);
      }
    });
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback for insecure HTTP contexts (like local network IP)
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback copy failed", err);
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    if (!generatedLinkData) return;
    const msg = getShareMessage(generatedLinkData.code, generatedLinkData.url, principal);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleSMSShare = () => {
    if (!generatedLinkData) return;
    const msg = getShareMessage(generatedLinkData.code, generatedLinkData.url, principal);
    const url = `sms:?body=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleEmailShare = () => {
    if (!generatedLinkData) return;
    const msg = getShareMessage(generatedLinkData.code, generatedLinkData.url, principal);
    const url = `mailto:?subject=${encodeURIComponent("FINEXA Loan Application")}&body=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleCopyMessage = () => {
    if (!generatedLinkData) return;
    const msg = getShareMessage(generatedLinkData.code, generatedLinkData.url, principal);
    copyToClipboard(msg);
    toast.success("Full share message copied!");
  };

  const handleNativeShare = async () => {
    if (generatedLinkData) {
      const shareMsg = getShareMessage(generatedLinkData.code, generatedLinkData.url, principal);
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({
            title: "Finexa Loan Application Link",
            text: shareMsg,
          });
          toast.success("Shared successfully!");
        } catch (err) {
          console.error("Native share failed:", err);
        }
      } else {
        handleCopyMessage();
      }
    }
  };

  const getShareMessage = (code: string, url: string, amt: string) => {
    return `📋 **FINEXA Loan Application**

Dear Customer,

Please complete your loan application by following these steps:

1. Open the loan application using the secure link below.
2. Fill in all required information accurately as per your official documents.
3. Review your details carefully and submit the application.
4. After submission, take a screenshot of the confirmation page and send it to your loan officer for verification.
5. Your application will be reviewed after successful verification. Providing incorrect information may result in rejection.

🔗 **Loan Application Link:**
${url}

Thank you for choosing **FINEXA – Smart Loan Management.**`;
  };

  const inputClass = "h-11 rounded-xl border-border focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const labelClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-5">
      {/* ─── Search and CTA Row ─── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-2.5 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code or borrower..."
              value={search}
              onChange={handleSearchChange}
              className="pl-10 h-10 rounded-xl"
            />
          </div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Links</SelectItem>
              <SelectItem value="pending_verification">Pending Verify</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => setGenerateOpen(true)}
          className="h-10 rounded-xl fx-brand-gradient text-white font-semibold flex items-center gap-1.5 px-4 fx-pressable shadow-md"
        >
          <Plus className="h-4 w-4" />
          Generate Customer Link
        </Button>
      </div>

      {/* ─── Table ─── */}
      <div className="bg-white dark:bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-secondary/50 dark:bg-secondary/40">
              <TableHead className="font-bold text-xs uppercase tracking-wider">Application Code</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Borrower</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Loan Amount</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Generated Date</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Expiry</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  No applications found. Click "Generate Loan Link" to create one.
                </TableCell>
              </TableRow>
            ) : (
              apps.map((app) => (
                <TableRow
                  key={app.applicationId}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedApp(app);
                    setDetailsOpen(true);
                  }}
                >
                  <TableCell className="font-semibold">{app.applicationCode}</TableCell>
                  <TableCell>
                    {app.borrower ? (
                      <div>
                        <p className="font-semibold text-sm">{app.borrower.name}</p>
                        <p className="text-xs text-muted-foreground">{app.borrower.mobile}</p>
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">Link Shared / Unsubmitted</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    ₹{Number(app.principal).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(app.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {app.expiryDate ? (
                      new Date(app.expiryDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={app.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 font-bold text-xs"
                      onClick={() => {
                        setSelectedApp(app);
                        setDetailsOpen(true);
                      }}
                    >
                      Details →
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Modal 1: Generate Link Form ─── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] rounded-2xl border border-border p-0 flex flex-col overflow-hidden bg-white dark:bg-card">
          <DialogHeader className="px-6 py-5 bg-secondary dark:bg-secondary border-b border-border shrink-0">
            <DialogTitle className="font-bold text-base font-heading">Generate Customer Link</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Specify loan parameters below. A unique URL and QR code will be generated for the customer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="principal" className={labelClass}>Loan Amount (₹)*</Label>
                <Input
                  id="principal"
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  required
                  placeholder="50000"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interestRate" className={labelClass}>Rate (₹ per ₹1,000 / month)*</Label>
                <Input
                  id="interestRate"
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  required
                  placeholder="20"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="interestType" className={labelClass}>Interest Type*</Label>
                <Select value={interestType} onValueChange={(val: any) => setInterestType(val)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Interest</SelectItem>
                    <SelectItem value="daily">Daily Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               <div className="space-y-1.5">
                <Label htmlFor="loanDuration" className={labelClass}>Duration*</Label>
                <Input
                  id="loanDuration"
                  value={loanDuration}
                  readOnly
                  disabled
                  placeholder="Auto-calculating..."
                  className={`${inputClass} bg-muted/40 cursor-not-allowed`}
                />
                <input type="hidden" name="loanDuration" value={loanDuration} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className={labelClass}>Start Date*</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dueDate" className={labelClass}>Due Date*</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="expiryDays" className={labelClass}>Link Expiry (Days)</Label>
                <Input
                  id="expiryDays"
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  placeholder="No Expiry"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="p-3.5 rounded-xl bg-secondary/80 border border-border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate Configuration:</span>
                <span className="font-semibold text-foreground">₹{numericRate} per ₹1,000 / month</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Interest:</span>
                <span className="font-semibold text-primary">₹{monthlyInterest.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold pt-1.5 border-t border-border/50 text-foreground">
                <span>Total Amount at Term:</span>
                <span className="text-primary text-sm">₹{totalDueAtTerm.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className={labelClass}>Admin Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this loan or borrower context..."
                className="rounded-xl border-border focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[70px]"
              />
            </div>

            {/* Total display */}
            <div className="bg-secondary/60 dark:bg-secondary/30 p-3.5 rounded-xl flex items-center justify-between border border-border/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Repayment Amount:</span>
              <span className="text-base font-extrabold text-foreground">
                ₹{totalDueAtTerm.toLocaleString("en-IN")}
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setGenerateOpen(false)}
                className="rounded-xl h-11 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl h-11 text-xs font-semibold px-5 fx-brand-gradient text-white fx-pressable shadow-md"
              >
                {isPending ? "Generating..." : "Generate Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Modal 2: Link Generated Success ─── */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="w-[92vw] max-w-[420px] rounded-2xl border border-border p-5 text-center bg-white dark:bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg font-heading text-emerald-500 dark:text-emerald-400">
              Application Link Generated!
            </DialogTitle>
          </DialogHeader>

          {generatedLinkData && (
            <div className="space-y-4 pt-3">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-3 bg-secondary/35 dark:bg-secondary/20 border border-border rounded-xl mx-auto w-full">
                <div className="bg-white p-1.5 rounded-lg border flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                      generatedLinkData.url
                    )}`}
                    alt="Application Link QR Code"
                    className="h-32 w-32 sm:h-36 sm:w-36 object-contain"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-widest font-bold">
                  Borrower QR Code
                </p>
              </div>

              {/* URL Display with rounded input and Copy button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-secondary dark:bg-secondary/60 p-2 rounded-xl border border-border">
                <input
                  type="text"
                  readOnly
                  value={generatedLinkData.url}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).select();
                    copyToClipboard(generatedLinkData.url);
                  }}
                  className="flex-1 bg-transparent border-0 ring-0 focus:ring-0 text-xs font-mono font-medium py-1 px-2 text-left text-foreground select-all outline-none overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(generatedLinkData.url)}
                  className="h-8 rounded-lg shrink-0 px-3 font-bold text-[10px] uppercase tracking-wider bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-1 shadow-sm w-full sm:w-auto"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Quick Share Options */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleWhatsAppShare}
                  className="rounded-xl border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 h-10"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.008c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span>WhatsApp</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSMSShare}
                  className="rounded-xl border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1.5 h-10"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>SMS</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEmailShare}
                  className="rounded-xl border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1.5 h-10"
                >
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyMessage}
                  className="rounded-xl border-border bg-secondary/35 hover:bg-secondary/70 font-bold text-xs flex items-center gap-1.5 h-10"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy Msg</span>
                </Button>
              </div>

              {/* Share via Device (Native Share Sheet) */}
              <Button
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-bold text-xs uppercase tracking-wider transition-all"
              >
                <Share2 className="h-4 w-4" />
                {typeof window !== "undefined" && typeof navigator !== "undefined" && "share" in navigator 
                  ? "Share via Device" 
                  : "Copy Share Message"
                }
              </Button>

              <div className="pt-2">
                <Button
                  onClick={() => setSuccessOpen(false)}
                  className="w-full h-11 rounded-xl font-bold bg-primary text-white hover:bg-primary/95"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Modal 3: View Details / Verification Drawer ─── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-[750px] w-[95vw] max-h-[85vh] overflow-y-auto rounded-2xl border border-border p-0 bg-white dark:bg-card">
          {selectedApp && (
            <div>
              {/* Header */}
              <div className="px-6 py-5 border-b border-border bg-secondary dark:bg-secondary flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base font-heading">Application Details</h2>
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-white border dark:bg-card">
                      {selectedApp.applicationCode}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pre-filled terms & borrower submitted KYC records.
                  </p>
                </div>
                <StatusBadge status={selectedApp.status} />
              </div>

              <div className="p-6 space-y-6">
                {/* Pre-filled Loan Terms */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Pre-filled Loan Terms</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-secondary/40 dark:bg-secondary/20 p-4 rounded-xl border border-border/50">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Principal</p>
                      <p className="text-sm font-extrabold mt-0.5 text-foreground">₹{Number(selectedApp.principal).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Interest Amount</p>
                      <p className="text-sm font-extrabold mt-0.5 text-foreground">₹{Number(selectedApp.interestAmount).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Type & Duration</p>
                      <p className="text-sm font-semibold mt-0.5 capitalize text-foreground">{selectedApp.interestType} ({selectedApp.loanDuration})</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Term Dates</p>
                      <p className="text-xs font-semibold mt-1 text-foreground">{selectedApp.startDate} to {selectedApp.dueDate}</p>
                    </div>
                  </div>
                </div>

                {selectedApp.borrower || selectedApp.customerName ? (
                  <>
                    {/* Borrower KYC Data */}
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] mb-3">Customer Details</h3>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">Full Name</span>
                            <span className="font-semibold text-foreground">
                              {selectedApp.borrower?.name || selectedApp.customerName}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">Father's Name</span>
                            <span className="font-semibold text-foreground">
                              {selectedApp.borrower?.fatherName || selectedApp.customerFatherName}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">Father's Mobile</span>
                            <span className="font-semibold text-foreground">
                              {selectedApp.borrower?.fatherMobile || selectedApp.customerFatherMobile || <span className="text-muted-foreground/60 italic">N/A</span>}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">Mobile Number</span>
                            <span className="font-semibold text-foreground">
                              {selectedApp.borrower?.mobile || selectedApp.customerMobile}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">Email Address</span>
                            <span className="font-semibold text-foreground">
                              {selectedApp.borrower?.email || selectedApp.customerEmail || <span className="text-muted-foreground/60 italic">N/A</span>}
                            </span>
                          </div>
                          <div className="flex flex-col border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium text-xs">Full Address</span>
                            <span className="font-semibold text-foreground mt-0.5">
                              {selectedApp.borrower?.address || selectedApp.customerAddress}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] mb-3">Identity Details</h3>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">Aadhaar Number</span>
                            <span className="font-semibold font-mono text-foreground">
                              {selectedApp.borrower?.aadhaarEncrypted || selectedApp.customerAadhaarEncrypted}
                            </span>
                          </div>
                          <div className="flex justify-between border-b border-border/40 pb-1.5">
                            <span className="text-muted-foreground font-medium">PAN Number</span>
                            <span className="font-semibold font-mono text-foreground uppercase">
                              {selectedApp.borrower?.panEncrypted || selectedApp.customerPanEncrypted}
                            </span>
                          </div>
                          {selectedApp.pdfUrl && (
                            <div className="pt-2">
                              <a
                                href={selectedApp.pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 text-[#D4AF37] hover:bg-[#D4AF37]/10 font-semibold transition-all text-xs"
                              >
                                <FileDown className="h-4 w-4" />
                                Download Signed Agreement PDF
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-secondary/20 p-8 rounded-xl border border-dashed border-border flex flex-col items-center text-center">
                    <Clock className="h-8 w-8 text-muted-foreground animate-pulse mb-2" />
                    <p className="font-bold text-sm text-foreground">Waiting for Borrower Submission</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      This application has not been completed by the borrower. Once they submit their details, they will appear here.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-secondary/20">
                <Button
                  variant="ghost"
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Close
                </Button>
                {selectedApp.status === "pending_verification" && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleVerifyApplication(selectedApp.applicationId, "reject")}
                      disabled={isPending}
                      variant="destructive"
                      className="rounded-xl font-semibold text-xs px-4 flex items-center gap-1.5 shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleVerifyApplication(selectedApp.applicationId, "approve")}
                      disabled={isPending}
                      className="rounded-xl font-semibold text-xs px-4 bg-[#FFD54A] hover:bg-[#FFE082] text-black flex items-center gap-1.5 shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
                    >
                      <UserCheck className="h-4 w-4" />
                      {isPending ? "Approving..." : "Approve Application"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
