import React from "react";
import { CapitalFundingLedgerView } from "@/features/capital/components/capital-funding-ledger-view";
import { getFunderLedgerAction } from "@/features/capital/actions/get-funder-ledger.action";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CapitalLedgerPage({ params }: PageProps) {
  const { id } = await params;

  // Pre-fetch initial data server-side for fast instant render
  let initialData = null;
  try {
    const res = await getFunderLedgerAction(id);
    if (res.success && res.data) {
      initialData = res.data;
    }
  } catch (err) {
    console.error("Server pre-fetch error for funder ledger:", err);
  }

  return <CapitalFundingLedgerView funderId={id} initialData={initialData} />;
}
