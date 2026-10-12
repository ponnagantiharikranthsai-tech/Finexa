'use server';

import { db } from '@/db';
import { borrowerPortalTokens } from '@/db/schema/borrower-portal';
import { loans } from '@/db/schema/loans';
import { payments } from '@/db/schema/payments';
import { borrowers } from '@/db/schema/borrowers';
import { eq, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';

// Generate or fetch existing token for a loan
export async function getOrCreateBorrowerTokenAction(loanId: string) {
  try {
    const [existing] = await db
      .select()
      .from(borrowerPortalTokens)
      .where(eq(borrowerPortalTokens.loanId, loanId))
      .limit(1);

    if (existing) {
      return { success: true, token: existing.token };
    }

    const token = crypto.randomBytes(16).toString('hex');
    await db.insert(borrowerPortalTokens).values({
      loanId,
      token,
    });

    return { success: true, token };
  } catch (error) {
    console.error("getOrCreateBorrowerTokenAction error:", error);
    return { success: false, error: 'Failed to generate portal token' };
  }
}

// Fetch portal data using token
export async function getBorrowerPortalDataAction(token: string) {
  try {
    const [portalToken] = await db
      .select()
      .from(borrowerPortalTokens)
      .where(eq(borrowerPortalTokens.token, token))
      .limit(1);

    if (!portalToken || !portalToken.isActive) {
      return { success: false, error: 'Invalid or expired portal link' };
    }

    // Check expiration if set
    if (portalToken.expiresAt && new Date(portalToken.expiresAt) < new Date()) {
      return { success: false, error: 'Portal link has expired' };
    }

    // Increment view count asynchronously
    await db
      .update(borrowerPortalTokens)
      .set({ 
        viewsCount: sql`${borrowerPortalTokens.viewsCount} + 1`,
        lastAccessedAt: new Date()
      })
      .where(eq(borrowerPortalTokens.id, portalToken.id));

    // Fetch loan record
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.loanId, portalToken.loanId))
      .limit(1);

    if (!loan) {
      return { success: false, error: 'Loan record not found' };
    }

    // Fetch borrower record
    const [borrower] = await db
      .select({
        borrowerId: borrowers.borrowerId,
        name: borrowers.name,
        mobile: borrowers.mobile,
      })
      .from(borrowers)
      .where(eq(borrowers.borrowerId, loan.borrowerId))
      .limit(1);

    // Fetch repayment history
    const paymentsList = await db
      .select()
      .from(payments)
      .where(eq(payments.loanId, loan.loanId))
      .orderBy(desc(payments.paymentDate), desc(payments.recordedAt));

    const fullLoan = {
      ...loan,
      borrower,
      payments: paymentsList,
    };

    return { success: true, data: { loan: fullLoan, portalToken } };
  } catch (error) {
    console.error("getBorrowerPortalDataAction error:", error);
    return { success: false, error: 'Failed to fetch portal data' };
  }
}
