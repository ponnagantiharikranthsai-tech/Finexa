"use client";

import React, { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBorrowerAction } from "../actions/delete-borrower.action";
import { useRouter } from "next/navigation";

interface DeleteBorrowerButtonProps {
  borrowerId: string;
  borrowerName: string;
  onSuccess?: () => void;
  showText?: boolean;
}

export function DeleteBorrowerButton({ borrowerId, borrowerName, onSuccess, showText }: DeleteBorrowerButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete ${borrowerName}? This will also permanently delete all their loans and repayments. This action cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await deleteBorrowerAction(borrowerId);
        if (res.success) {
          toast.success("Borrower deleted successfully!");
          if (onSuccess) {
            onSuccess();
          } else {
            router.refresh();
          }
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Failed to delete borrower.");
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className={`flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 rounded-lg ${
        showText
          ? "text-destructive hover:bg-destructive/10 px-3 py-1.5"
          : "p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
      }`}
      title="Delete Borrower"
    >
      <Trash2 className={`h-3.5 w-3.5 ${isPending ? "animate-pulse" : ""}`} />
      {showText && <span>Delete Borrower</span>}
    </button>
  );
}
