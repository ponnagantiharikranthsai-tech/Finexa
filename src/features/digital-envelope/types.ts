export type EnvelopeType = "personal" | "third_party";

export interface DigitalEnvelopeItem {
  envelopeId: string;
  name: string;
  category: string;
  type: EnvelopeType;
  balance: number;
  targetAmount?: number | null;
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalEnvelopeTransactionItem {
  transactionId: string;
  envelopeId: string;
  envelopeName?: string;
  envelopeType?: EnvelopeType;
  envelopeCategory?: string;
  transactionType: "deposit" | "withdrawal" | "pay_bill" | "transfer";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  category?: string | null;
  description?: string | null;
  referenceParty?: string | null;
  createdAt: string;
}

export interface DigitalEnvelopeSummary {
  totalAccount2Balance: number;
  myNetEnvelopes: number;
  thirdPartyFunds: number;
  unallocatedCash: number;
  totalEnvelopesBalance: number;
  personalEnvelopesCount: number;
  thirdPartyEnvelopesCount: number;
}

export interface DigitalEnvelopeDashboardData {
  summary: DigitalEnvelopeSummary;
  personalEnvelopes: DigitalEnvelopeItem[];
  thirdPartyEnvelopes: DigitalEnvelopeItem[];
  recentTransactions: DigitalEnvelopeTransactionItem[];
}

