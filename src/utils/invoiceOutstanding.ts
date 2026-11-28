/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BillWiseDetails, FundInflowRegister, InvoiceRegister } from '../types/database';
import { toReportDateKey } from './reportHelpers';

export const EXCLUDED_INVOICE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'draft',
  'pending_approval',
  'pending approval',
]);

export const EXCLUDED_ALLOCATION_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'void',
  'reversed',
]);

export function roundMoney(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

export function isExcludedInvoiceStatus(status: unknown): boolean {
  return EXCLUDED_INVOICE_STATUSES.has(String(status ?? '').trim().toLowerCase());
}

export function isExcludedAllocationStatus(row: { Allocation_Status?: unknown; Status?: unknown } | null | undefined): boolean {
  const status = String(row?.Allocation_Status || row?.Status || '').trim().toLowerCase();
  return Boolean(status && EXCLUDED_ALLOCATION_STATUSES.has(status));
}

export function isConfirmedReceipt(receipt: { Receipt_Status?: unknown; Status?: unknown } | null | undefined): boolean {
  return String(receipt?.Receipt_Status || receipt?.Status || '').trim().toLowerCase() === 'confirmed';
}

export function isPaidExpense(expense: { Expense_Status?: unknown; Status?: unknown } | null | undefined): boolean {
  return String(expense?.Expense_Status || expense?.Status || '').trim().toLowerCase() === 'paid';
}

export interface ComputedInvoiceOutstanding extends InvoiceRegister {
  Allocated_Amount_Total: number;
  Calculated_Outstanding: number;
}

export function toInvoiceAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Calculates invoice-wise Outstanding Bills using:
 *   Outstanding Bills = Net_Charge_Amount (Invoice_Register) - SUM(Allocated_Amount from Bill Wise Details by InvoiceID)
 * Multiple payment allocations for the same InvoiceID are summed and deducted from Net_Charge_Amount.
 * Allocations tied to a known non-confirmed receipt (e.g., Pending Verification, Cancelled, Rejected, Bounced)
 * are excluded when receipt records are present.
 */
export function computeInvoiceOutstandingBills(
  invoices: InvoiceRegister[],
  billAllocations: BillWiseDetails[],
  receipts: FundInflowRegister[] = [],
  now: Date = new Date()
): ComputedInvoiceOutstanding[] {
  const receiptStatusByTxnId = new Map<string, string>();
  (receipts || []).forEach((rec) => {
    const txnId = String(rec.Transaction_ID || '').trim().toUpperCase();
    if (!txnId) return;
    const status = String(rec.Receipt_Status || (rec as any).Status || '').trim().toLowerCase();
    receiptStatusByTxnId.set(txnId, status);
  });

  const canonicalInvoiceIdByUpper = new Map<string, string>();
  const invoiceIdByNumberUpper = new Map<string, string>();
  (invoices || []).forEach((inv) => {
    const id = String(inv.InvoiceID || '').trim();
    const num = String(inv.Invoice_Number || '').trim();
    if (id) canonicalInvoiceIdByUpper.set(id.toUpperCase(), id);
    if (id && num) invoiceIdByNumberUpper.set(num.toUpperCase(), id);
  });

  const allocatedByInvoiceId = new Map<string, number>();
  (billAllocations || []).forEach((row) => {
    if (isExcludedAllocationStatus(row as any)) return;
    const txnId = String(row.Transaction_ID || '').trim().toUpperCase();
    if (txnId && receiptStatusByTxnId.has(txnId)) {
      const recStatus = receiptStatusByTxnId.get(txnId) || '';
      if (recStatus !== 'confirmed') return;
    }

    const rawInvoiceId = String(row.InvoiceID || '').trim();
    const rawInvoiceNum = String(row.Invoice_Number || '').trim();
    const invoiceId =
      canonicalInvoiceIdByUpper.get(rawInvoiceId.toUpperCase()) ||
      invoiceIdByNumberUpper.get(rawInvoiceNum.toUpperCase()) ||
      rawInvoiceId;
    if (!invoiceId) return;
    const allocated = Math.max(0, toInvoiceAmount(row.Allocated_Amount));
    if (!Number.isFinite(allocated)) return;

    allocatedByInvoiceId.set(
      invoiceId,
      roundMoney((allocatedByInvoiceId.get(invoiceId) || 0) + allocated)
    );
  });

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (invoices || []).map((inv) => {
    const rawStatus = String(inv.Invoice_Status || '').trim();
    const invoiceId = String(inv.InvoiceID || '').trim();
    const netCharge = Math.max(0, roundMoney(toInvoiceAmount(inv.Net_Charge_Amount)));
    const totalAllocated = Math.max(0, roundMoney(allocatedByInvoiceId.get(invoiceId) || 0));

    if (isExcludedInvoiceStatus(rawStatus)) {
      return {
        ...inv,
        Net_Charge_Amount: netCharge,
        Paid_Amount: 0,
        Outstanding_Amount: 0,
        Allocated_Amount_Total: totalAllocated,
        Calculated_Outstanding: 0,
      };
    }

    const outstanding = Math.max(0, roundMoney(netCharge - totalAllocated));
    const paid = Math.min(netCharge, totalAllocated);
    const dueDate = toReportDateKey(inv.Due_Date);
    const derivedStatus: InvoiceRegister['Invoice_Status'] =
      outstanding <= 0
        ? 'Paid'
        : paid > 0
          ? 'Partially Paid'
          : dueDate && dueDate < todayKey
            ? 'Overdue'
            : 'Unpaid';

    return {
      ...inv,
      Net_Charge_Amount: netCharge,
      Paid_Amount: paid,
      Outstanding_Amount: outstanding,
      Allocated_Amount_Total: totalAllocated,
      Calculated_Outstanding: outstanding,
      Invoice_Status: derivedStatus,
    };
  });
}
