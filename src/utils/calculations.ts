/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CalculationMethod,
  UserRole,
  BillWiseDetails,
  FundInflowRegister,
  InvoiceRegister,
} from '../types/database';

/**
 * Calculates the base Charge_Amount based on calculation method.
 */
export function calculateChargeAmount(
  method: CalculationMethod,
  rate: number,
  area: number,
  quantity: number = 1
): number {
  switch (method) {
    case 'Area × Rate':
      return Math.round(area * rate * 100) / 100;
    case 'Quantity × Rate':
      return Math.round(quantity * rate * 100) / 100;
    case 'Fixed Amount':
      return Math.round(rate * 100) / 100;
    default:
      return 0;
  }
}

/**
 * Calculates the Net Charge Amount:
 * Net = Charge_Amount + Late_Fee - Discount_Amount + Adjustment_Amount
 * Note: Positive Adjustment means debit (increases charge); negative means credit (decreases charge).
 */
export function calculateNetChargeAmount(
  chargeAmount: number,
  lateFee: number = 0,
  discountAmount: number = 0,
  adjustmentAmount: number = 0
): number {
  const net = chargeAmount + lateFee - discountAmount + adjustmentAmount;
  return Math.max(0, Math.round(net * 100) / 100);
}

/**
 * Allocates an incoming payment to an invoice safely.
 * Returns the allocated bill detail record, and updated invoice and receipt amounts.
 */
export function allocatePaymentToInvoice(params: {
  receipt: FundInflowRegister;
  invoice: InvoiceRegister;
  requestedAmount?: number;
  userId: string;
  allocationDate?: string;
  remarks?: string;
}): {
  success: boolean;
  errorMessage?: string;
  allocatedAmount: number;
  billDetail?: BillWiseDetails;
  updatedReceipt?: FundInflowRegister;
  updatedInvoice?: InvoiceRegister;
} {
  const { receipt, invoice, requestedAmount, userId, allocationDate, remarks } = params;

  if (receipt.Unallocated_Amount <= 0) {
    return {
      success: false,
      errorMessage: 'Receipt has zero unallocated balance remaining.',
      allocatedAmount: 0,
    };
  }

  const outstanding = invoice.Outstanding_Amount ?? (invoice.Net_Charge_Amount - (invoice.Paid_Amount || 0));

  if (outstanding <= 0) {
    return {
      success: false,
      errorMessage: 'Invoice is already fully paid.',
      allocatedAmount: 0,
    };
  }

  // Desired allocation is minimum of unallocated amount, invoice outstanding, or requested amount
  const desired = requestedAmount !== undefined && requestedAmount > 0 ? requestedAmount : outstanding;
  const allocatedAmount = Math.min(receipt.Unallocated_Amount, outstanding, desired);

  if (allocatedAmount <= 0) {
    return {
      success: false,
      errorMessage: 'Invalid allocation amount.',
      allocatedAmount: 0,
    };
  }

  const previouslyPaid = invoice.Paid_Amount || 0;
  const outstandingBefore = outstanding;
  const outstandingAfter = Math.max(0, Math.round((outstandingBefore - allocatedAmount) * 100) / 100);
  const newPaidAmount = Math.round((previouslyPaid + allocatedAmount) * 100) / 100;

  const now = allocationDate || new Date().toISOString().split('T')[0];

  const billDetail: BillWiseDetails = {
    Allocation_ID: `ALL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    Transaction_ID: receipt.Transaction_ID,
    InvoiceID: invoice.InvoiceID,
    PropertyID: invoice.PropertyID,
    Ownership_ID: invoice.Ownership_ID,
    OwnerID: invoice.OwnerID,
    Invoice_Number: invoice.Invoice_Number,
    Invoice_Amount: invoice.Net_Charge_Amount,
    Previously_Paid: previouslyPaid,
    Outstanding_Before: outstandingBefore,
    Allocated_Amount: allocatedAmount,
    Outstanding_After: outstandingAfter,
    Allocation_Date: now,
    Remarks: remarks || `Allocated against ${receipt.Receipt_Number}`,
    Created_By: userId,
    Created_At: new Date().toISOString(),
  };

  const newUnallocated = Math.max(0, Math.round((receipt.Unallocated_Amount - allocatedAmount) * 100) / 100);

  const updatedReceipt: FundInflowRegister = {
    ...receipt,
    Unallocated_Amount: newUnallocated,
  };

  let newInvoiceStatus = invoice.Invoice_Status;
  if (outstandingAfter === 0) {
    newInvoiceStatus = 'Paid';
  } else if (newPaidAmount > 0) {
    newInvoiceStatus = 'Partially Paid';
  }

  const updatedInvoice: InvoiceRegister = {
    ...invoice,
    Paid_Amount: newPaidAmount,
    Outstanding_Amount: outstandingAfter,
    Invoice_Status: newInvoiceStatus,
  };

  return {
    success: true,
    allocatedAmount,
    billDetail,
    updatedReceipt,
    updatedInvoice,
  };
}

/**
 * Checks role permissions for a module/action.
 */
export function hasPermission(
  role: UserRole,
  module:
    | 'properties_view'
    | 'properties_manage'
    | 'invoices_view_all'
    | 'invoices_manage'
    | 'payments_view_all'
    | 'payments_manage'
    | 'expenses_manage'
    | 'expenses_approve'
    | 'reports_financial'
    | 'activity_requests_all'
    | 'activity_requests_assign'
    | 'settings_admin'
    | 'resident_portal'
): boolean {
  switch (role) {
    case 'Admin':
      return true;
    case 'Committee':
      return [
        'properties_view',
        'invoices_view_all',
        'payments_view_all',
        'reports_financial',
        'activity_requests_all',
        'activity_requests_assign',
      ].includes(module);
    case 'Accountant':
      return [
        'properties_view',
        'invoices_view_all',
        'invoices_manage',
        'payments_view_all',
        'payments_manage',
        'expenses_manage',
        'expenses_approve',
        'reports_financial',
      ].includes(module);
    case 'Resident':
      return ['resident_portal'].includes(module);
    default:
      return false;
  }
}

/**
 * Generates an incremental formatted ID (e.g. INV-2026-0001, REC-2026-0001).
 */
export function generateNextCode(prefix: 'INV' | 'REC' | 'VOU' | 'REQ', count: number): string {
  const year = 2026;
  const numStr = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${numStr}`;
}

export interface FundSummaryData {
  openingFundBalance: number;
  totalFundReceived: number;
  totalFundUtilized: number;
  availableFund: number;
  outstandingCollection: number;
}

/**
 * Calculates Financial Year-wise Fund Summary:
 * 5. Opening Fund Balance (At beginning of FY)
 * 6. Total Fund Received (Financial Year wise - Confirmed receipts)
 * 7. Total Fund Utilized (Financial Year wise - Paid expenses)
 * 8. Available Fund (Financial Year wise: Opening + Received − Paid)
 * 9. Outstanding Collection (Financial Year wise)
 */
export function calculateFundSummary(params: {
  openingBalance: number;
  receipts: FundInflowRegister[];
  expenses: { Expense_Status: string; Payment_Amount: number; Payment_Date: string }[];
  invoices: { Outstanding_Amount: number; Billing_Date: string }[];
  startDate?: string;
  endDate?: string;
}): FundSummaryData {
  const { openingBalance, receipts, expenses, invoices, startDate, endDate } = params;

  // Filter confirmed receipts within FY if dates provided
  const fyReceipts = receipts.filter((r) => {
    if (r.Receipt_Status !== 'Confirmed') return false;
    if (startDate && r.Date_Of_Received < startDate) return false;
    if (endDate && r.Date_Of_Received > endDate) return false;
    return true;
  });
  const totalFundReceived = fyReceipts.reduce((sum, r) => sum + (r.Received_Amount || 0), 0);

  // Filter paid expenses within FY
  const fyExpenses = expenses.filter((e) => {
    if (e.Expense_Status !== 'Paid') return false;
    if (startDate && e.Payment_Date < startDate) return false;
    if (endDate && e.Payment_Date > endDate) return false;
    return true;
  });
  const totalFundUtilized = fyExpenses.reduce((sum, e) => sum + (e.Payment_Amount || 0), 0);

  // Available Fund = Opening + Received - Paid
  const availableFund = Math.round((openingBalance + totalFundReceived - totalFundUtilized) * 100) / 100;

  // Outstanding Collection within FY
  const fyInvoices = invoices.filter((i) => {
    if (startDate && i.Billing_Date < startDate) return false;
    if (endDate && i.Billing_Date > endDate) return false;
    return true;
  });
  const outstandingCollection = fyInvoices.reduce((sum, i) => sum + (i.Outstanding_Amount || 0), 0);

  return {
    openingFundBalance: openingBalance,
    totalFundReceived,
    totalFundUtilized,
    availableFund,
    outstandingCollection,
  };
}
