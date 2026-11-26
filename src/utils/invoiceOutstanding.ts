/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BillWiseDetails, FundInflowRegister, InvoiceRegister } from '../types/database';
import { toReportDateKey } from './reportHelpers';

const EXCLUDED_INVOICE_STATUSES = new Set([
  'cancelled',
  'draft',
  'pending_approval',
  'pending approval',
]);

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
    const txnId = String(rec.Transaction_ID || '').trim();
    if (!txnId) return;
    const status = String(rec.Receipt_Status || (rec as any).Status || '').trim().toLowerCase();
    receiptStatusByTxnId.set(txnId, status);
  });

  const invoiceIdByNumber = new Map<string, string>();
  (invoices || []).forEach((inv) => {
    const id = String(inv.InvoiceID || '').trim();
    const num = String(inv.Invoice_Number || '').trim();
    if (id && num) invoiceIdByNumber.set(num, id);
  });

const EXCLUDED_ALLOCATION_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'void',
  'reversed',
]);

  const allocatedByInvoiceId = new Map<string, number>();
  (billAllocations || []).forEach((row) => {
    const allocStatus = String((row as any).Allocation_Status || (row as any).Status || '').trim().toLowerCase();
    if (allocStatus && EXCLUDED_ALLOCATION_STATUSES.has(allocStatus)) return;
    const txnId = String(row.Transaction_ID || '').trim();
    if (txnId && receiptStatusByTxnId.has(txnId)) {
      const recStatus = receiptStatusByTxnId.get(txnId) || '';
      if (recStatus !== 'confirmed') return;
    }

    const invoiceId =
      String(row.InvoiceID || '').trim() ||
      invoiceIdByNumber.get(String(row.Invoice_Number || '').trim()) ||
      '';
    if (!invoiceId) return;
    const allocated = Math.max(0, toInvoiceAmount(row.Allocated_Amount));
    if (!Number.isFinite(allocated)) return;

    allocatedByInvoiceId.set(
      invoiceId,
      Math.round(((allocatedByInvoiceId.get(invoiceId) || 0) + allocated) * 100) / 100
    );
  });

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (invoices || []).map((inv) => {
    const rawStatus = String(inv.Invoice_Status || '').trim();
    const statusLower = rawStatus.toLowerCase();
    const invoiceId = String(inv.InvoiceID || '').trim();
    const netCharge = Math.max(0, Math.round(toInvoiceAmount(inv.Net_Charge_Amount) * 100) / 100);
    const totalAllocated = Math.max(0, Math.round((allocatedByInvoiceId.get(invoiceId) || 0) * 100) / 100);

    if (EXCLUDED_INVOICE_STATUSES.has(statusLower)) {
      return {
        ...inv,
        Net_Charge_Amount: netCharge,
        Paid_Amount: 0,
        Outstanding_Amount: 0,
        Allocated_Amount_Total: totalAllocated,
        Calculated_Outstanding: 0,
      };
    }

    const outstanding = Math.max(0, Math.round((netCharge - totalAllocated) * 100) / 100);
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
      Paid_Amount: totalAllocated,
      Outstanding_Amount: outstanding,
      Allocated_Amount_Total: totalAllocated,
      Calculated_Outstanding: outstanding,
      Invoice_Status: derivedStatus,
    };
  });
}
