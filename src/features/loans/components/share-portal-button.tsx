"use client";

import React, { useState } from "react";
import { getOrCreateBorrowerTokenAction } from "@/actions/borrower-portal";
import { toast } from "sonner";
import { Share2, MessageCircle, Copy, Check, ExternalLink, RefreshCw } from "lucide-react";

interface SharePortalButtonProps {
  loanId: string;
  borrowerName: string;
  borrowerPhone?: string | null;
  variant?: "button" | "card" | "icon";
  className?: string;
}

export function SharePortalButton({
  loanId,
  borrowerName,
  borrowerPhone,
  variant = "button",
  className = "",
}: SharePortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const cleanPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    return digits;
  };

  const getPortalUrl = async (): Promise<string | null> => {
    if (generatedUrl) return generatedUrl;
    setLoading(true);
    try {
      const res = await getOrCreateBorrowerTokenAction(loanId);
      if (res.success && res.token) {
        const url = `${window.location.origin}/portal/${res.token}`;
        setGeneratedUrl(url);
        return url;
      } else {
        toast.error("Failed to generate magic link passbook.");
        return null;
      }
    } catch {
      toast.error("An error occurred while generating the magic link.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const portalUrl = await getPortalUrl();
    if (!portalUrl) return;

    const shareData = {
      title: "FINEXA Digital Passbook",
      text: `Hello ${borrowerName}, view your FINEXA digital passbook and live balance here:`,
      url: portalUrl,
    };

    // Use Native Web Share API if supported by device/browser
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        // User cancelling the share sheet triggers AbortError, which should not error
        if (err?.name !== "AbortError") {
          console.error("Error sharing passbook:", err);
          await handleCopyLink();
        }
      }
    } else {
      // Fallback: Copy link to clipboard
      await handleCopyLink();
    }
  };

  const handleShareWhatsApp = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const portalUrl = await getPortalUrl();
    if (!portalUrl) return;

    const phone = cleanPhoneNumber(borrowerPhone);
    const message = encodeURIComponent(
      `Hello ${borrowerName}, view your FINEXA digital passbook and live balance here: ${portalUrl}`
    );

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(waUrl, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp with passbook link...");
  };

  const handleCopyLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const portalUrl = await getPortalUrl();
    if (!portalUrl) return;

    try {
      await navigator.clipboard.writeText(
        `Hello ${borrowerName}, view your FINEXA digital passbook and live balance here: ${portalUrl}`
      );
      setCopied(true);
      toast.success("Passbook link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy link to clipboard.");
    }
  };

  // Card Variant (For Detailed Audit Modal)
  if (variant === "card") {
    return (
      <div className={`p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-100">Borrower Digital Passbook</p>
              <p className="text-[10px] text-zinc-400">Live magic link with balance & repayment history</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
            Magic Link
          </span>
        </div>

        {generatedUrl && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-hidden">
            <span className="truncate flex-1">{generatedUrl}</span>
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 shrink-0 p-1"
              title="Open Portal in New Tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleShare}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            <span>Share Sheet</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={loading}
            className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Icon Only Variant
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        className={`h-9 w-9 flex items-center justify-center rounded-xl text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all ${className}`}
        title="Share Passbook"
      >
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
      </button>
    );
  }

  // Button Variant (Default for Loan Cards)
  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className={`h-9 px-3 flex-1 min-w-[120px] sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 text-xs font-bold whitespace-nowrap transition-all duration-200 fx-pressable disabled:opacity-50 ${className}`}
      title="Share Passbook via Any App"
    >
      {loading ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>Generating...</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>Share Passbook</span>
        </>
      )}
    </button>
  );
}
