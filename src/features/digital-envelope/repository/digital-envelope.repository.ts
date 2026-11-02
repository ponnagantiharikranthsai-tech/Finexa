import { db } from "@/db/client";
import {
  digitalEnvelopesTable,
  digitalEnvelopeTransactionsTable,
  digitalEnvelopeSettingsTable,
  type DigitalEnvelope,
  type InsertDigitalEnvelope,
} from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import type {
  DigitalEnvelopeDashboardData,
  DigitalEnvelopeItem,
  DigitalEnvelopeTransactionItem,
  DigitalEnvelopeSummary,
  EnvelopeType,
} from "../types";

export class DigitalEnvelopeRepository {
  /**
   * Ensure default sample envelopes exist if the table is brand new / empty.
   */
  async ensureInitialSeed(): Promise<void> {
    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(digitalEnvelopesTable);

    const count = Number(existing[0]?.count ?? 0);
    if (count > 0) return;

    // Default Seed Envelopes matching the exact prompt examples:
    // Personal: EMI (400) + Savings (350) + Investments (250) = 1,000
    // Third-Party: Friend 1 (600) + Friend 2 (400) = 1,000
    // Total Account 2 = 2,000
    const seeds: Array<InsertDigitalEnvelope & { initialTxNotes: string }> = [
      {
        name: "EMI Reserve",
        category: "EMI",
        type: "personal",
        balance: "400.00",
        targetAmount: "1000.00",
        color: "blue",
        icon: "credit-card",
        notes: "Monthly loan and card EMIs reserve fund",
        initialTxNotes: "Opening EMI bucket allocation",
      },
      {
        name: "Emergency Savings",
        category: "Savings",
        type: "personal",
        balance: "350.00",
        targetAmount: "2000.00",
        color: "emerald",
        icon: "piggy-bank",
        notes: "Dedicated emergency liquid buffer",
        initialTxNotes: "Opening emergency savings allocation",
      },
      {
        name: "SIP & Investments",
        category: "Investment",
        type: "personal",
        balance: "250.00",
        targetAmount: "1500.00",
        color: "purple",
        icon: "trending-up",
        notes: "Monthly mutual funds and stocks investment pool",
        initialTxNotes: "Opening investment allocation",
      },
      {
        name: "Friend 1",
        category: "Friend / Third Party",
        type: "third_party",
        balance: "600.00",
        color: "amber",
        icon: "user",
        notes: "External funds held for Friend 1",
        initialTxNotes: "Held amount for Friend 1",
      },
      {
        name: "Friend 2",
        category: "Friend / Third Party",
        type: "third_party",
        balance: "400.00",
        color: "indigo",
        icon: "user",
        notes: "External funds held for Friend 2",
        initialTxNotes: "Held amount for Friend 2",
      },
    ];

    for (const seed of seeds) {
      const { initialTxNotes, ...insertData } = seed;
      const [inserted] = await db
        .insert(digitalEnvelopesTable)
        .values(insertData)
        .returning();

      if (inserted && Number(inserted.balance) > 0) {
        await db.insert(digitalEnvelopeTransactionsTable).values({
          envelopeId: inserted.envelopeId,
          transactionType: "deposit",
          amount: inserted.balance,
          balanceBefore: "0.00",
          balanceAfter: inserted.balance,
          category: inserted.category,
          description: initialTxNotes,
        });
      }
    }

    // Initialize stated bank balance to 2,000 (0 unallocated initially)
    await db
      .insert(digitalEnvelopeSettingsTable)
      .values({
        key: "account_2_bank_balance",
        value: "2000.00",
      })
      .onConflictDoUpdate({
        target: digitalEnvelopeSettingsTable.key,
        set: { value: "2000.00", updatedAt: sql`now()` },
      });
  }

  /**
   * Get entire dashboard data: summary, grouped envelopes, and recent movement audit trail.
   */
  async getDashboardData(): Promise<DigitalEnvelopeDashboardData> {
    await this.ensureInitialSeed();

    // 1. Fetch active envelopes
    const envelopesRaw = await db
      .select()
      .from(digitalEnvelopesTable)
      .where(eq(digitalEnvelopesTable.isArchived, false))
      .orderBy(digitalEnvelopesTable.createdAt);

    // 2. Fetch Stated Account 2 Bank Balance Setting
    const settingRaw = await db
      .select()
      .from(digitalEnvelopeSettingsTable)
      .where(eq(digitalEnvelopeSettingsTable.key, "account_2_bank_balance"))
      .limit(1);

    const personalEnvelopes: DigitalEnvelopeItem[] = [];
    const thirdPartyEnvelopes: DigitalEnvelopeItem[] = [];
    let myNetEnvelopes = 0;
    let thirdPartyFunds = 0;

    for (const env of envelopesRaw) {
      const bal = Number(env.balance) || 0;
      const item: DigitalEnvelopeItem = {
        envelopeId: env.envelopeId,
        name: env.name,
        category: env.category,
        type: env.type as EnvelopeType,
        balance: bal,
        targetAmount: env.targetAmount ? Number(env.targetAmount) : null,
        color: env.color,
        icon: env.icon,
        notes: env.notes,
        isArchived: env.isArchived,
        createdAt: env.createdAt.toISOString(),
        updatedAt: env.updatedAt.toISOString(),
      };

      if (env.type === "third_party") {
        thirdPartyEnvelopes.push(item);
        thirdPartyFunds += bal;
      } else {
        personalEnvelopes.push(item);
        myNetEnvelopes += bal;
      }
    }

    const totalEnvelopesBalance = myNetEnvelopes + thirdPartyFunds;

    // Stated bank balance
    let statedBankBalance = settingRaw[0]
      ? Number(settingRaw[0].value) || totalEnvelopesBalance
      : totalEnvelopesBalance;

    // Bank balance should never be less than total allocated envelopes
    if (statedBankBalance < totalEnvelopesBalance) {
      statedBankBalance = totalEnvelopesBalance;
    }

    const unallocatedCash = Math.max(0, statedBankBalance - totalEnvelopesBalance);
    const totalAccount2Balance = statedBankBalance;

    const summary: DigitalEnvelopeSummary = {
      totalAccount2Balance,
      myNetEnvelopes,
      thirdPartyFunds,
      unallocatedCash,
      totalEnvelopesBalance,
      personalEnvelopesCount: personalEnvelopes.length,
      thirdPartyEnvelopesCount: thirdPartyEnvelopes.length,
    };

    // 3. Fetch Recent Movement Audit Trail
    const txRaw = await db
      .select({
        transactionId: digitalEnvelopeTransactionsTable.transactionId,
        envelopeId: digitalEnvelopeTransactionsTable.envelopeId,
        transactionType: digitalEnvelopeTransactionsTable.transactionType,
        amount: digitalEnvelopeTransactionsTable.amount,
        balanceBefore: digitalEnvelopeTransactionsTable.balanceBefore,
        balanceAfter: digitalEnvelopeTransactionsTable.balanceAfter,
        category: digitalEnvelopeTransactionsTable.category,
        description: digitalEnvelopeTransactionsTable.description,
        referenceParty: digitalEnvelopeTransactionsTable.referenceParty,
        createdAt: digitalEnvelopeTransactionsTable.createdAt,
        envelopeName: digitalEnvelopesTable.name,
        envelopeType: digitalEnvelopesTable.type,
      })
      .from(digitalEnvelopeTransactionsTable)
      .leftJoin(
        digitalEnvelopesTable,
        eq(digitalEnvelopeTransactionsTable.envelopeId, digitalEnvelopesTable.envelopeId)
      )
      .orderBy(desc(digitalEnvelopeTransactionsTable.createdAt))
      .limit(60);

    const recentTransactions: DigitalEnvelopeTransactionItem[] = txRaw.map((tx) => ({
      transactionId: tx.transactionId,
      envelopeId: tx.envelopeId,
      envelopeName: tx.envelopeName || "Envelope",
      envelopeType: (tx.envelopeType as EnvelopeType) || "personal",
      envelopeCategory: tx.category || undefined,
      transactionType: tx.transactionType as any,
      amount: Number(tx.amount) || 0,
      balanceBefore: Number(tx.balanceBefore) || 0,
      balanceAfter: Number(tx.balanceAfter) || 0,
      category: tx.category,
      description: tx.description,
      referenceParty: tx.referenceParty,
      createdAt: tx.createdAt.toISOString(),
    }));

    return {
      summary,
      personalEnvelopes,
      thirdPartyEnvelopes,
      recentTransactions,
    };
  }

  /**
   * Create a new custom envelope with initial amount.
   */
  async createEnvelope(params: {
    name: string;
    category?: string;
    type: EnvelopeType;
    initialAmount?: number;
    targetAmount?: number | null;
    color?: string;
    icon?: string;
    notes?: string | null;
    fundSource?: "external" | "unallocated_cash";
    allowDuplicate?: boolean;
  }): Promise<DigitalEnvelopeItem> {
    const sanitizedName = params.name.trim();

    // 1. Check if an active envelope with the same name already exists (case-insensitive)
    const [existing] = await db
      .select()
      .from(digitalEnvelopesTable)
      .where(
        and(
          sql`LOWER(TRIM(${digitalEnvelopesTable.name})) = LOWER(TRIM(${sanitizedName}))`,
          eq(digitalEnvelopesTable.isArchived, false)
        )
      )
      .limit(1);

    if (existing && !params.allowDuplicate) {
      const err: any = new Error(
        `Envelope "${existing.name}" already exists with balance ₹${(Number(existing.balance) || 0).toLocaleString("en-IN")}.`
      );
      err.alreadyExists = true;
      err.existingEnvelope = {
        envelopeId: existing.envelopeId,
        name: existing.name,
        balance: Number(existing.balance) || 0,
        type: existing.type,
      };
      throw err;
    }

    // 2. Strictly sanitize inputs to prevent any SQL insertion errors
    const initialAmount = Math.max(0, Number(params.initialAmount) || 0);
    const sanitizedCategory = (params.category?.trim() || (params.type === "third_party" ? "Friend / Third Party" : "General")).trim();
    const sanitizedType = params.type === "third_party" ? "third_party" : "personal";

    // Strictly ensure targetAmount is a valid positive number string or null (NEVER empty string "")
    const targetAmtNum = params.targetAmount !== undefined && params.targetAmount !== null ? Number(params.targetAmount) : NaN;
    const sanitizedTargetAmount = (!isNaN(targetAmtNum) && targetAmtNum > 0) ? targetAmtNum.toFixed(2) : null;

    const sanitizedColor = (params.color?.trim()) || (params.type === "third_party" ? "amber" : "blue");
    const sanitizedIcon = (params.icon?.trim()) || (params.type === "third_party" ? "user" : "wallet");
    const sanitizedNotes = (params.notes && typeof params.notes === "string" && params.notes.trim().length > 0) ? params.notes.trim() : null;

    const [inserted] = await db
      .insert(digitalEnvelopesTable)
      .values({
        name: sanitizedName,
        category: sanitizedCategory,
        type: sanitizedType,
        balance: initialAmount.toFixed(2),
        targetAmount: sanitizedTargetAmount,
        color: sanitizedColor,
        icon: sanitizedIcon,
        notes: sanitizedNotes,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to create envelope.");
    }

    if (initialAmount > 0) {
      // Record initial movement in audit trail
      await db.insert(digitalEnvelopeTransactionsTable).values({
        envelopeId: inserted.envelopeId,
        transactionType: "deposit",
        amount: initialAmount.toFixed(2),
        balanceBefore: "0.00",
        balanceAfter: initialAmount.toFixed(2),
        category: inserted.category,
        description: `Initial envelope setup: ₹${initialAmount.toLocaleString("en-IN")}`,
      });

      // If funded externally, increase stated bank balance so unallocated cash remains stable
      if (params.fundSource !== "unallocated_cash") {
        await this.adjustBankBalance(initialAmount);
      }
    }

    return {
      envelopeId: inserted.envelopeId,
      name: inserted.name,
      category: inserted.category,
      type: inserted.type as EnvelopeType,
      balance: initialAmount,
      targetAmount: inserted.targetAmount ? Number(inserted.targetAmount) : null,
      color: inserted.color,
      icon: inserted.icon,
      notes: inserted.notes,
      isArchived: inserted.isArchived,
      createdAt: inserted.createdAt.toISOString(),
      updatedAt: inserted.updatedAt.toISOString(),
    };
  }

  /**
   * Add money to an existing envelope.
   */
  async addMoney(params: {
    envelopeId: string;
    amount: number;
    description?: string;
    fundSource?: "external" | "unallocated_cash";
  }): Promise<{ updatedEnvelope: DigitalEnvelopeItem; transaction: DigitalEnvelopeTransactionItem }> {
    const amount = Number(params.amount);
    if (!amount || amount <= 0) {
      throw new Error("Invalid deposit amount. Amount must be greater than zero.");
    }

    const [envelope] = await db
      .select()
      .from(digitalEnvelopesTable)
      .where(eq(digitalEnvelopesTable.envelopeId, params.envelopeId))
      .limit(1);

    if (!envelope) {
      throw new Error("Envelope not found.");
    }

    const currentBal = Number(envelope.balance) || 0;
    const newBal = currentBal + amount;

    // Update envelope balance
    const [updated] = await db
      .update(digitalEnvelopesTable)
      .set({
        balance: newBal.toFixed(2),
        updatedAt: sql`now()`,
      })
      .where(eq(digitalEnvelopesTable.envelopeId, params.envelopeId))
      .returning();

    const formattedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const defaultDesc = `Added on ${formattedDate}: ₹${amount.toLocaleString("en-IN")}`;

    // Insert movement audit record
    const [tx] = await db
      .insert(digitalEnvelopeTransactionsTable)
      .values({
        envelopeId: params.envelopeId,
        transactionType: "deposit",
        amount: amount.toFixed(2),
        balanceBefore: currentBal.toFixed(2),
        balanceAfter: newBal.toFixed(2),
        category: envelope.category,
        description: params.description?.trim() || defaultDesc,
      })
      .returning();

    // If source is external credit, increment stated bank balance
    if (params.fundSource !== "unallocated_cash") {
      await this.adjustBankBalance(amount);
    }

    return {
      updatedEnvelope: {
        envelopeId: updated.envelopeId,
        name: updated.name,
        category: updated.category,
        type: updated.type as EnvelopeType,
        balance: newBal,
        targetAmount: updated.targetAmount ? Number(updated.targetAmount) : null,
        color: updated.color,
        icon: updated.icon,
        notes: updated.notes,
        isArchived: updated.isArchived,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      transaction: {
        transactionId: tx.transactionId,
        envelopeId: tx.envelopeId,
        envelopeName: updated.name,
        envelopeType: updated.type as EnvelopeType,
        envelopeCategory: updated.category,
        transactionType: "deposit",
        amount,
        balanceBefore: currentBal,
        balanceAfter: newBal,
        category: tx.category,
        description: tx.description,
        referenceParty: tx.referenceParty,
        createdAt: tx.createdAt.toISOString(),
      },
    };
  }

  /**
   * Pay bill or withdraw money from an envelope.
   * Deducts from envelope balance, updates total Account 2 balance, and logs a clear movement record.
   */
  async payBillOrWithdraw(params: {
    envelopeId: string;
    amount: number;
    description: string;
    referenceParty?: string;
    isBillPayment?: boolean;
  }): Promise<{ updatedEnvelope: DigitalEnvelopeItem; transaction: DigitalEnvelopeTransactionItem }> {
    const amount = Number(params.amount);
    if (!amount || amount <= 0) {
      throw new Error("Invalid withdrawal amount. Amount must be greater than zero.");
    }

    const [envelope] = await db
      .select()
      .from(digitalEnvelopesTable)
      .where(eq(digitalEnvelopesTable.envelopeId, params.envelopeId))
      .limit(1);

    if (!envelope) {
      throw new Error("Envelope not found.");
    }

    const currentBal = Number(envelope.balance) || 0;
    if (currentBal < amount) {
      throw new Error(`Insufficient funds in "${envelope.name}". Available balance: ₹${currentBal.toLocaleString("en-IN")}`);
    }

    const newBal = currentBal - amount;

    // Update envelope balance
    const [updated] = await db
      .update(digitalEnvelopesTable)
      .set({
        balance: newBal.toFixed(2),
        updatedAt: sql`now()`,
      })
      .where(eq(digitalEnvelopesTable.envelopeId, params.envelopeId))
      .returning();

    const txType = params.isBillPayment ? "pay_bill" : "withdrawal";

    // Insert movement audit record
    const [tx] = await db
      .insert(digitalEnvelopeTransactionsTable)
      .values({
        envelopeId: params.envelopeId,
        transactionType: txType,
        amount: amount.toFixed(2),
        balanceBefore: currentBal.toFixed(2),
        balanceAfter: newBal.toFixed(2),
        category: envelope.category,
        description: params.description.trim(),
        referenceParty: params.referenceParty?.trim() || null,
      })
      .returning();

    // Deduct from stated bank balance so Account 2 reflects the actual outflow
    await this.adjustBankBalance(-amount);

    return {
      updatedEnvelope: {
        envelopeId: updated.envelopeId,
        name: updated.name,
        category: updated.category,
        type: updated.type as EnvelopeType,
        balance: newBal,
        targetAmount: updated.targetAmount ? Number(updated.targetAmount) : null,
        color: updated.color,
        icon: updated.icon,
        notes: updated.notes,
        isArchived: updated.isArchived,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      transaction: {
        transactionId: tx.transactionId,
        envelopeId: tx.envelopeId,
        envelopeName: updated.name,
        envelopeType: updated.type as EnvelopeType,
        envelopeCategory: updated.category,
        transactionType: txType as any,
        amount,
        balanceBefore: currentBal,
        balanceAfter: newBal,
        category: tx.category,
        description: tx.description,
        referenceParty: tx.referenceParty,
        createdAt: tx.createdAt.toISOString(),
      },
    };
  }

  /**
   * Set or reconcile Account 2 Bank Statement Balance.
   */
  async setBankBalance(newBalance: number): Promise<number> {
    const val = Math.max(0, Number(newBalance) || 0);

    await db
      .insert(digitalEnvelopeSettingsTable)
      .values({
        key: "account_2_bank_balance",
        value: val.toFixed(2),
      })
      .onConflictDoUpdate({
        target: digitalEnvelopeSettingsTable.key,
        set: { value: val.toFixed(2), updatedAt: sql`now()` },
      });

    return val;
  }

  /**
   * Helper to adjust the bank balance by a delta (positive or negative).
   */
  private async adjustBankBalance(delta: number): Promise<void> {
    const existing = await db
      .select()
      .from(digitalEnvelopeSettingsTable)
      .where(eq(digitalEnvelopeSettingsTable.key, "account_2_bank_balance"))
      .limit(1);

    const currentVal = existing[0] ? Number(existing[0].value) || 0 : 0;
    const newVal = Math.max(0, currentVal + delta);

    await db
      .insert(digitalEnvelopeSettingsTable)
      .values({
        key: "account_2_bank_balance",
        value: newVal.toFixed(2),
      })
      .onConflictDoUpdate({
        target: digitalEnvelopeSettingsTable.key,
        set: { value: newVal.toFixed(2), updatedAt: sql`now()` },
      });
  }

  /**
   * Update envelope properties (e.g. name, category, targetAmount, notes, color).
   */
  async updateEnvelope(params: {
    envelopeId: string;
    name?: string;
    category?: string;
    targetAmount?: number | null;
    color?: string;
    icon?: string;
    notes?: string | null;
  }): Promise<DigitalEnvelopeItem> {
    const [existing] = await db
      .select()
      .from(digitalEnvelopesTable)
      .where(eq(digitalEnvelopesTable.envelopeId, params.envelopeId))
      .limit(1);

    if (!existing) {
      throw new Error("Envelope not found.");
    }

    const updates: Partial<InsertDigitalEnvelope> = {
      updatedAt: new Date(),
    };

    if (params.name !== undefined) updates.name = params.name.trim();
    if (params.category !== undefined) updates.category = params.category.trim();
    if (params.targetAmount !== undefined) {
      const num = Number(params.targetAmount);
      updates.targetAmount = (!isNaN(num) && num > 0) ? num.toFixed(2) : null;
    }
    if (params.color !== undefined) updates.color = params.color;
    if (params.icon !== undefined) updates.icon = params.icon;
    if (params.notes !== undefined) {
      updates.notes = (params.notes && typeof params.notes === "string" && params.notes.trim().length > 0) ? params.notes.trim() : null;
    }

    const [updated] = await db
      .update(digitalEnvelopesTable)
      .set(updates)
      .where(eq(digitalEnvelopesTable.envelopeId, params.envelopeId))
      .returning();

    return {
      envelopeId: updated.envelopeId,
      name: updated.name,
      category: updated.category,
      type: updated.type as EnvelopeType,
      balance: Number(updated.balance) || 0,
      targetAmount: updated.targetAmount ? Number(updated.targetAmount) : null,
      color: updated.color,
      icon: updated.icon,
      notes: updated.notes,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete or archive an envelope.
   */
  async deleteEnvelope(envelopeId: string): Promise<void> {
    const [envelope] = await db
      .select()
      .from(digitalEnvelopesTable)
      .where(eq(digitalEnvelopesTable.envelopeId, envelopeId))
      .limit(1);

    if (!envelope) {
      throw new Error("Envelope not found.");
    }

    // Hard delete or archive: we delete from database (cascades transactions)
    await db
      .delete(digitalEnvelopesTable)
      .where(eq(digitalEnvelopesTable.envelopeId, envelopeId));
  }
}

export const digitalEnvelopeRepository = new DigitalEnvelopeRepository();
