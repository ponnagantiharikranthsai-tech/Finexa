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
  FileDown
} from "lucide-react";
import type { ApplicationWithBorrower } from "../repository/application.repository";
import { calculateDueDate } from "@/domain/due-date-calculator";

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
  const [interestAmount, setInterestAmount] = useState("5000");
  const [interestType, setInterestType] = useState<"monthly" | "daily">("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]!);
  const [dueDate, setDueDate] = useState("");
  const [loanDuration, setLoanDuration] = useState("30 Days");
  const [expiryDays, setExpiryDays] = useState("7");
  const [notes, setNotes] = useState("");

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
    fd.append("interestAmount", interestAmount);
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
        toast.error(typeof res.error === "string" ? res.error : "Failed to generate link");
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
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getShareMessage = (code: string, url: string, amt: string) => {
    return `Dear Customer, please complete your Finexa loan details for Rs. ${Number(amt).toLocaleString("en-IN")} using this secure link: ${url}\n\nReference Code: ${code}. Thank you!`;
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
        <DialogContent className="sm:max-w-[550px] rounded-2xl border border-border p-0 overflow-hidden bg-white dark:bg-card">
          <DialogHeader className="px-6 py-5 bg-secondary dark:bg-secondary border-b border-border">
            <DialogTitle className="font-bold text-base font-heading">Generate Customer Link</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Specify loan parameters below. A unique URL and QR code will be generated for the customer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateSubmit} className="p-6 space-y-4">
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
                <Label htmlFor="interestAmount" className={labelClass}>Interest Amount (₹)*</Label>
                <Input
                  id="interestAmount"
                  type="number"
                  value={interestAmount}
                  onChange={(e) => setInterestAmount(e.target.value)}
                  required
                  placeholder="5000"
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
                <Label htmlFor="loanDuration" className={labelClass}>Duration (e.g. 30 Days)*</Label>
                <Input
                  id="loanDuration"
                  value={loanDuration}
                  onChange={(e) => setLoanDuration(e.target.value)}
                  required
                  placeholder="30 Days"
                  className={inputClass}
                />
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
                ₹{(Number(principal || 0) + Number(interestAmount || 0)).toLocaleString("en-IN")}
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
        <DialogContent className="sm:max-w-[480px] rounded-2xl border border-border p-6 text-center bg-white dark:bg-card">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg font-heading text-emerald-500 dark:text-emerald-400">
              Application Link Generated!
            </DialogTitle>
          </DialogHeader>

          {generatedLinkData && (
            <div className="space-y-5 pt-4">
              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-secondary/30 dark:bg-secondary/20 border border-border rounded-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    generatedLinkData.url
                  )}`}
                  alt="Application Link QR Code"
                  className="h-44 w-44 object-contain rounded-lg border bg-white p-1"
                />
                <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
                  Borrower QR Code
                </p>
              </div>

              {/* URL Display */}
              <div className="flex items-center gap-2 bg-secondary dark:bg-secondary/60 p-3 rounded-xl border border-border">
                <span className="text-xs font-mono font-medium truncate flex-1 text-left text-foreground">
                  {generatedLinkData.url}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(generatedLinkData.url)}
                  className="h-8 w-8 p-0 rounded-lg shrink-0 text-primary"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Sharing Grid */}
              <div className="grid grid-cols-3 gap-2">
                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    getShareMessage(generatedLinkData.code, generatedLinkData.url, principal)
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 transition-colors"
                >
                  <Share2 className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">WhatsApp</span>
                </a>

                {/* SMS */}
                <a
                  href={`sms:?body=${encodeURIComponent(
                    getShareMessage(generatedLinkData.code, generatedLinkData.url, principal)
                  )}`}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 transition-colors"
                >
                  <Phone className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">SMS</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:?subject=${encodeURIComponent("Finexa Loan Application Link")}&body=${encodeURIComponent(
                    getShareMessage(generatedLinkData.code, generatedLinkData.url, principal)
                  )}`}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 transition-colors"
                >
                  <Mail className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Email</span>
                </a>
              </div>

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
