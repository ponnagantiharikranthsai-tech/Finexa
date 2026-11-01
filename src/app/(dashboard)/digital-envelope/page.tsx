import React from "react";
import { Metadata } from "next";
import { getEnvelopesAction } from "@/features/digital-envelope/actions/get-envelopes.action";
import { DigitalEnvelopeDashboard } from "@/features/digital-envelope/components/digital-envelope-dashboard";

export const metadata: Metadata = {
  title: "Digital Envelopes | Finexa",
  description: "Account 2 Digital Envelope partitioned cash buckets for EMI, Savings, Investments, and Friends.",
};

export default async function DigitalEnvelopePage() {
  const res = await getEnvelopesAction();
  const initialData = res.success ? res.data : undefined;

  return <DigitalEnvelopeDashboard initialData={initialData} />;
}

