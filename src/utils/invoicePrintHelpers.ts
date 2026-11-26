/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BillWiseDetails, FundInflowRegister, InvoiceRegister } from '../types/database';
import { toInvoiceAmount } from './invoiceOutstanding';
import { toReportDateKey } from './reportHelpers';

const EXCLUDED_INVOICE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'draft',
  'pending_approval',
  'pending approval',
]);

const EXCLUDED_ALLOCATION_STATUSES = new Set([
  'cancelled',
  'canceled',
  'rejected',
  'void',
  'reversed',
]);

export interface HistoricalInvoiceAmounts {
  netCharge: number;
  paidSoFar: number;
  outstanding: number;
  status: InvoiceRegister['Invoice_Status'];
}

export interface LastPaymentDetails {
  lastPaymentDate: string;
  lastPaymentAmount: number;
  paymentMode: string;
  receiptNumber: string;
  transactionId: string;
}

export interface HistoricalOutstandingBillRow {
  invoiceId: string;
  invoiceNumber: string;
  billingDate: string;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  purpose: string;
  invoiceAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

export interface HistoricalOutstandingBillsResult {
  rows: HistoricalOutstandingBillRow[];
  totalOutstanding: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveOwnershipGroupKey(inv: Partial<InvoiceRegister>): string {
  const ownershipId = String(inv.Ownership_ID || '').trim();
  if (ownershipId) return ownershipId.toUpperCase();
  const propId = String(inv.PropertyID || '').trim().toUpperCase();
  const ownerId = String(inv.OwnerID || '').trim().toUpperCase();
  return `UNLINKED:${propId}:${ownerId}`;
}

function buildInvoiceLookup(invoices: InvoiceRegister[]) {
  const byId = new Map<string, InvoiceRegister>();
  const idByNumber = new Map<string, string>();
  (invoices || []).forEach((inv) => {
    const id = String(inv.InvoiceID || '').trim();
    const num = String(inv.Invoice_Number || '').trim();
    if (id) byId.set(id, inv);
    if (id && num) idByNumber.set(num, id);
  });
  return { byId, idByNumber };
}

function buildReceiptLookup(receipts: FundInflowRegister[]) {
  const byTxnId = new Map<string, FundInflowRegister>();
  (receipts || []).forEach((rec) => {
    const txnId = String(rec.Transaction_ID || '').trim();
    if (txnId) byTxnId.set(txnId, rec);
  });
  return byTxnId;
}

function isValidConfirmedAllocation(
  row: BillWiseDetails,
  receiptByTxnId: Map<string, FundInflowRegister>
): boolean {
  const allocStatus = String((row as any).Allocation_Status || (row as any).Status || '').trim().toLowerCase();
  if (allocStatus && EXCLUDED_ALLOCATION_STATUSES.has(allocStatus)) return false;
  const txnId = String(row.Transaction_ID || '').trim();
  if (txnId && receiptByTxnId.has(txnId)) {
    const rec = receiptByTxnId.get(txnId)!;
    const recStatus = String(rec.Receipt_Status || (rec as any).Status || '').trim().toLowerCase();
    if (recStatus !== 'confirmed') return false;
  }
  return true;
}

function getAllocationEffectiveDateKey(
  row: BillWiseDetails,
  receiptByTxnId: Map<string, FundInflowRegister>
): string {
  const txnId = String(row.Transaction_ID || '').trim();
  const receipt = txnId ? receiptByTxnId.get(txnId) : undefined;
  const allocDate = toReportDateKey(row.Allocation_Date);
  const receiptDate = receipt ? toReportDateKey(receipt.Date_Of_Received) : '';
  // If both dates are present, use the receipt/allocation date on record; guard against post-dated splits
  if (allocDate && receiptDate) return allocDate >= receiptDate ? allocDate : receiptDate;
  return allocDate || receiptDate || toReportDateKey(row.Created_At);
}

/**
 * Computes Paid So Far and Outstanding for a single invoice as on its Billing_Date
 * using Bill Wise Details Allocated_Amount matched by InvoiceID.
 */
export function computeInvoicePaidAsOnDate(
  invoice: InvoiceRegister,
  allInvoices: InvoiceRegister[],
  billAllocations: BillWiseDetails[],
  receipts: FundInflowRegister[]
): HistoricalInvoiceAmounts {
  const billingDateKey = toReportDateKey(invoice.Billing_Date);
  const netCharge = Math.max(0, roundMoney(toInvoiceAmount(invoice.Net_Charge_Amount)));
  const statusRaw = String(invoice.Invoice_Status || '').trim();
  const statusLower = statusRaw.toLowerCase();

  if (EXCLUDED_INVOICE_STATUSES.has(statusLower)) {
    return {
      netCharge,
      paidSoFar: 0,
      outstanding: 0,
      status: invoice.Invoice_Status,
    };
  }

  const targetId = String(invoice.InvoiceID || '').trim();
  const targetNum = String(invoice.Invoice_Number || '').trim();
  const { idByNumber } = buildInvoiceLookup(allInvoices);
  const receiptByTxnId = buildReceiptLookup(receipts);

  let allocatedTotal = 0;
  (billAllocations || []).forEach((row) => {
    if (!isValidConfirmedAllocation(row, receiptByTxnId)) return;
    const rowInvId =
      String(row.InvoiceID || '').trim() ||
      idByNumber.get(String(row.Invoice_Number || '').trim()) ||
      '';
    const matchesInvoice =
      (targetId && rowInvId === targetId) ||
      (!rowInvId && targetNum && String(row.Invoice_Number || '').trim() === targetNum);
    if (!matchesInvoice) return;

    const effDateKey = getAllocationEffectiveDateKey(row, receiptByTxnId);
    if (billingDateKey && effDateKey && effDateKey > billingDateKey) return;

    const amt = Math.max(0, toInvoiceAmount(row.Allocated_Amount));
    allocatedTotal = roundMoney(allocatedTotal + amt);
  });

  const paidSoFar = Math.min(netCharge, allocatedTotal);
  const outstanding = Math.max(0, roundMoney(netCharge - allocatedTotal));
  const dueDateKey = toReportDateKey(invoice.Due_Date);
  const derivedStatus: InvoiceRegister['Invoice_Status'] =
    outstanding <= 0
      ? 'Paid'
      : paidSoFar > 0
      ? 'Partially Paid'
      : billingDateKey && dueDateKey && dueDateKey < billingDateKey
      ? 'Overdue'
      : 'Unpaid';

  return {
    netCharge,
    paidSoFar,
    outstanding,
    status: derivedStatus,
  };
}

/**
 * Fetches Last Payment Details for the invoice's Ownership_ID on or before the invoice's Billing_Date
 * from Bill Wise Details + Fund Inflow Register. Never includes payments after Billing_Date.
 */
export function computeLastPaymentDetailsAsOnBillingDate(
  invoice: InvoiceRegister,
  allInvoices: InvoiceRegister[],
  billAllocations: BillWiseDetails[],
  receipts: FundInflowRegister[]
): LastPaymentDetails | null {
  const billingDateKey = toReportDateKey(invoice.Billing_Date);
  const targetOwnershipKey = resolveOwnershipGroupKey(invoice);
  const { byId: invoiceById, idByNumber } = buildInvoiceLookup(allInvoices);
  const receiptByTxnId = buildReceiptLookup(receipts);

  type PaymentGroup = {
    key: string;
    dateKey: string;
    amount: number;
    mode: string;
    receiptNumber: string;
    transactionId: string;
    orderTieBreaker: string;
  };
  const groups = new Map<string, PaymentGroup>();

  (billAllocations || []).forEach((row, idx) => {
    if (!isValidConfirmedAllocation(row, receiptByTxnId)) return;

    const rowInvId =
      String(row.InvoiceID || '').trim() ||
      idByNumber.get(String(row.Invoice_Number || '').trim()) ||
      '';
    const linkedInv = rowInvId ? invoiceById.get(rowInvId) : undefined;
    const txnId = String(row.Transaction_ID || '').trim();
    const receipt = txnId ? receiptByTxnId.get(txnId) : undefined;

    const rowOwnershipRaw = String(row.Ownership_ID || linkedInv?.Ownership_ID || receipt?.Ownership_ID || '').trim();
    const rowGroupKey = rowOwnershipRaw
      ? rowOwnershipRaw.toUpperCase()
      : linkedInv
      ? resolveOwnershipGroupKey(linkedInv)
      : receipt
      ? `UNLINKED:${String(receipt.PropertyID || '').trim().toUpperCase()}:${String(receipt.OwnerID || '').trim().toUpperCase()}`
      : `UNLINKED:${String(row.PropertyID || '').trim().toUpperCase()}:${String(row.OwnerID || '').trim().toUpperCase()}`;

    if (rowGroupKey !== targetOwnershipKey) return;

    const receiptDateKey = receipt ? toReportDateKey(receipt.Date_Of_Received) : '';
    const allocDateKey = toReportDateKey(row.Allocation_Date);
    const paymentDateKey = receiptDateKey || allocDateKey || toReportDateKey(row.Created_At);
    if (!paymentDateKey) return;
    if (billingDateKey && paymentDateKey > billingDateKey) return;
    if (billingDateKey && allocDateKey && allocDateKey > billingDateKey) return;

    const allocated = Math.max(0, toInvoiceAmount(row.Allocated_Amount));
    if (allocated <= 0) return;

    const groupKey = txnId || String(row.Allocation_ID || `ROW-${idx}`);
    const existing = groups.get(groupKey);
    if (existing) {
      existing.amount = roundMoney(existing.amount + allocated);
      if (paymentDateKey > existing.dateKey) existing.dateKey = paymentDateKey;
    } else {
      groups.set(groupKey, {
        key: groupKey,
        dateKey: paymentDateKey,
        amount: roundMoney(allocated),
        mode: String(receipt?.Received_Mode || 'Recorded').trim(),
        receiptNumber: String(receipt?.Receipt_Number || '').trim(),
        transactionId: txnId,
        orderTieBreaker: String(row.Allocation_ID || txnId || idx),
      });
    }
  });

  if (groups.size === 0) return null;

  const latest = Array.from(groups.values()).sort((a, b) => {
    const dateCmp = b.dateKey.localeCompare(a.dateKey);
    if (dateCmp !== 0) return dateCmp;
    return b.orderTieBreaker.localeCompare(a.orderTieBreaker, undefined, { numeric: true, sensitivity: 'base' });
  })[0];

  return {
    lastPaymentDate: latest.dateKey,
    lastPaymentAmount: latest.amount,
    paymentMode: latest.mode || '—',
    receiptNumber: latest.receiptNumber,
    transactionId: latest.transactionId,
  };
}

/**
 * Returns all non-cancelled, non-draft invoices for the same Ownership_ID issued
 * on or before the invoice's Billing_Date that still have positive Outstanding
 * balance as of that Billing_Date.
 */
export function computeOutstandingBillsAsOnBillingDate(
  invoice: InvoiceRegister,
  allInvoices: InvoiceRegister[],
  billAllocations: BillWiseDetails[],
  receipts: FundInflowRegister[]
): HistoricalOutstandingBillsResult {
  const asOnDateKey = toReportDateKey(invoice.Billing_Date);
  const targetOwnershipKey = resolveOwnershipGroupKey(invoice);
  const { idByNumber } = buildInvoiceLookup(allInvoices);
  const receiptByTxnId = buildReceiptLookup(receipts);

  const paidAsOnByInvoiceId = new Map<string, number>();
  (billAllocations || []).forEach((row) => {
    if (!isValidConfirmedAllocation(row, receiptByTxnId)) return;
    const effDateKey = getAllocationEffectiveDateKey(row, receiptByTxnId);
    if (asOnDateKey && effDateKey && effDateKey > asOnDateKey) return;

    const invId =
      String(row.InvoiceID || '').trim() ||
      idByNumber.get(String(row.Invoice_Number || '').trim()) ||
      '';
    if (!invId) return;

    const amt = Math.max(0, toInvoiceAmount(row.Allocated_Amount));
    paidAsOnByInvoiceId.set(invId, roundMoney((paidAsOnByInvoiceId.get(invId) || 0) + amt));
  });

  const rows: HistoricalOutstandingBillRow[] = [];
  (allInvoices || []).forEach((cand) => {
    const statusLower = String(cand.Invoice_Status || '').trim().toLowerCase();
    if (EXCLUDED_INVOICE_STATUSES.has(statusLower)) return;
    if (resolveOwnershipGroupKey(cand) !== targetOwnershipKey) return;

    const candBillingDate = toReportDateKey(cand.Billing_Date);
    if (asOnDateKey) {
      if (!candBillingDate || candBillingDate > asOnDateKey) return;
    }

    const invId = String(cand.InvoiceID || '').trim();
    const netCharge = Math.max(0, roundMoney(toInvoiceAmount(cand.Net_Charge_Amount)));
    const totalAllocated = Math.max(0, roundMoney(paidAsOnByInvoiceId.get(invId) || 0));
    const paidAmount = Math.min(netCharge, totalAllocated);
    const outstandingAmount = Math.max(0, roundMoney(netCharge - totalAllocated));

    if (outstandingAmount <= 0) return;

    rows.push({
      invoiceId: invId,
      invoiceNumber: String(cand.Invoice_Number || cand.InvoiceID || ''),
      billingDate: candBillingDate || String(cand.Billing_Date || ''),
      billingPeriodFrom: String(cand.Bill_Period_From || ''),
      billingPeriodTo: String(cand.Bill_Period_To || ''),
      purpose: String(cand.Purpose || ''),
      invoiceAmount: netCharge,
      paidAmount,
      outstandingAmount,
    });
  });

  rows.sort((a, b) => {
    const dCmp = a.billingDate.localeCompare(b.billingDate);
    if (dCmp !== 0) return dCmp;
    return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true, sensitivity: 'base' });
  });

  const totalOutstanding = roundMoney(rows.reduce((sum, r) => sum + r.outstandingAmount, 0));
  return { rows, totalOutstanding };
}
