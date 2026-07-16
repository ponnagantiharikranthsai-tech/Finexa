"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, ChevronRight, Edit } from "lucide-react";
import type { BorrowerDetailResult } from "@/features/borrowers/actions/get-borrower-by-id.action";
import type { Loan } from "@/db/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateBorrowerAction } from "@/features/borrowers/actions/update-borrower.action";
import { useRouter } from "next/navigation";
import { DeleteBorrowerButton } from "@/features/borrowers/components/delete-borrower-button";
interface BorrowerDetailViewProps {
  borrower: BorrowerDetailResult;
  loans: Loan[];
  totalBorrowed: number;
  totalRepaid: number;
  outstandingBalance: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:   "bg-secondary text-primary dark:bg-secondary dark:text-primary/80 border border-border",
    overdue:  "bg-destructive/5 text-destructive dark:bg-destructive/10 dark:text-destructive border border-destructive/20",
    extended: "bg-accent text-primary dark:bg-secondary dark:text-primary/80 border border-border",
    closed:   "bg-secondary text-muted-foreground dark:bg-secondary dark:text-muted-foreground border border-border",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function BorrowerDetailView({
  borrower,
  loans,
  totalBorrowed,
  totalRepaid,
  outstandingBalance,
}: BorrowerDetailViewProps) {
  const [showSensitive, setShowSensitive] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const [name, setName] = useState(borrower.name);
  const [mobile, setMobile] = useState(borrower.mobile);
  const [email, setEmail] = useState(borrower.email || "");
  const [pan, setPan] = useState(borrower.panDecrypted);
  const [aadhaar, setAadhaar] = useState(borrower.aadhaarDecrypted);
  const [locationUrl, setLocationUrl] = useState(borrower.locationUrl || "");

  React.useEffect(() => {
    setName(borrower.name);
    setMobile(borrower.mobile);
    setEmail(borrower.email || "");
    setPan(borrower.panDecrypted);
    setAadhaar(borrower.aadhaarDecrypted);
    setLocationUrl(borrower.locationUrl || "");
  }, [borrower]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    const fd = new FormData();
    fd.append("borrowerId", borrower.borrowerId);
    fd.append("name", name);
    fd.append("mobile", mobile);
    fd.append("email", email);
    fd.append("pan", pan.toUpperCase());
    fd.append("aadhaar", aadhaar);
    fd.append("locationUrl", locationUrl);

    try {
      const res = await updateBorrowerAction(null, fd);
      if (res.success) {
        toast.success("Borrower updated successfully!");
        setEditOpen(false);
      } else {
        if (res.error && typeof res.error === "object") {
          const errors = Object.values(res.error).flat().join(", ");
          toast.error(errors || "Failed to update borrower.");
        } else {
          toast.error((res.error as string) || "Failed to update borrower.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const maskPan     = (pan: string)     => showSensitive ? pan     : `•••••${pan.slice(-5)}`;
  const maskAadhaar = (aadhaar: string) => showSensitive ? aadhaar : `••••••••${aadhaar.slice(-4)}`;

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <Link href="/borrowers">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Borrowers
        </button>
      </Link>

      {/* Hero — Credit Summary */}
      <div className="fx-brand-gradient rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Outstanding Balance</p>
            <p className="text-3xl font-bold tracking-tight">₹{outstandingBalance.toLocaleString("en-IN")}</p>
          </div>
          <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
            {borrower.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
          <div>
            <p className="text-white/60 text-xs">Total Borrowed</p>
            <p className="font-semibold">₹{totalBorrowed.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Total Repaid</p>
            <p className="font-semibold text-white">₹{totalRepaid.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── Left: Identity + Loan History ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border text-left">
              <div className="flex items-center gap-2.5">
                <img src="/logo.jpg" alt="Finexa Logo" className="h-8 w-auto object-contain rounded-md" />
                <div>
                  <h2 className="font-bold text-base">{borrower.name}</h2>
                  <p className="text-xs text-muted-foreground">KYC & Identity Verification</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSensitive(!showSensitive)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary dark:hover:bg-secondary"
                >
                  {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showSensitive ? "Hide" : "Reveal"} ID
                </button>
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary dark:hover:bg-secondary"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit Details
                </button>
                <DeleteBorrowerButton
                  borrowerId={borrower.borrowerId}
                  borrowerName={borrower.name}
                  showText={true}
                  onSuccess={() => router.push("/borrowers")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm">
              {[
                { label: "Mobile",  value: borrower.mobile },
                { label: "Email",   value: borrower.email },
                { label: "PAN",     value: maskPan(borrower.panDecrypted) },
                { label: "Aadhaar", value: maskAadhaar(borrower.aadhaarDecrypted) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              ))}
              {borrower.locationUrl && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Location</p>
                  <a
                    href={borrower.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary dark:text-primary hover:underline font-medium text-sm break-all"
                  >
                    Open in Maps ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Loan History */}
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-bold text-sm">Loan History</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{loans.length} loan{loans.length !== 1 ? "s" : ""} issued</p>
            </div>

            {loans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No loans issued yet.</p>
            ) : (
              <>
                {/* Mobile list */}
                <div className="p-4 space-y-2 md:hidden">
                  {loans.map((loan) => (
                    <Link key={loan.loanId} href={`/loans/${loan.loanId}`}>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-secondary dark:bg-secondary border border-border fx-transition hover:shadow-sm">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <StatusBadge status={loan.status} />
                            <span className="text-xs text-muted-foreground">{loan.dateGiven}</span>
                          </div>
                          <p className="font-semibold text-sm">₹{Number(loan.principal).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-muted-foreground">Due: {loan.dueDate}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary dark:bg-secondary">
                        {["Issued", "Principal", "Rate", "Due Date", "Status", ""].map((h) => (
                          <th key={h} className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3 ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {loans.map((loan) => (
                        <tr key={loan.loanId} className="fx-transition hover:bg-secondary dark:hover:bg-secondary">
                          <td className="px-5 py-3">{loan.dateGiven}</td>
                          <td className="px-5 py-3 font-medium">₹{Number(loan.principal).toLocaleString("en-IN")}</td>
                          <td className="px-5 py-3 text-muted-foreground">₹{Number(loan.interestRate)}/{loan.interestType === "monthly" ? "mo" : "d"}</td>
                          <td className="px-5 py-3">{loan.dueDate}</td>
                          <td className="px-5 py-3"><StatusBadge status={loan.status} /></td>
                          <td className="px-5 py-3 text-right">
                            <Link href={`/loans/${loan.loanId}`}>
                              <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-primary hover:underline">
                                View <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right: Stats card (desktop-only sidebar) ──────────────────────── */}
        <div className="hidden lg:block">
          <div className="bg-white dark:bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-bold text-sm">Credit Profile</h2>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {[
                { label: "Total Loans",      value: loans.length.toString() },
                { label: "Active / Overdue", value: `${loans.filter(l => l.status === "active").length} / ${loans.filter(l => l.status === "overdue").length}`, red: loans.some(l => l.status === "overdue") },
                { label: "Total Borrowed",   value: `₹${totalBorrowed.toLocaleString("en-IN")}` },
                { label: "Total Repaid",     value: `₹${totalRepaid.toLocaleString("en-IN")}`, green: true },
              ].map(({ label, value, red, green }) => (
                <div key={label} className="flex justify-between items-center border-b border-border pb-4 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${red ? "text-destructive" : green ? "text-primary" : ""}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold">Outstanding</span>
                <span className="font-bold text-lg text-primary dark:text-primary">₹{outstandingBalance.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-md fx-glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-lg">Edit Borrower Details</DialogTitle>
            <DialogDescription>
              Update KYC and contact details for <strong>{borrower.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name*</Label>
              <Input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile Number*</Label>
              <Input
                type="tel"
                placeholder="Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address*</Label>
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PAN Card Number*</Label>
              <Input
                type="text"
                placeholder="PAN Number"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aadhaar Card Number*</Label>
              <Input
                type="text"
                placeholder="Aadhaar Number"
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value)}
                required
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location URL (optional)</Label>
              <Input
                type="text"
                placeholder="Google Maps link"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                className="h-11 rounded-xl bg-transparent border-border fx-input-glass"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="rounded-xl border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl fx-brand-gradient border-0 text-white fx-cta-glow fx-pressable"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
