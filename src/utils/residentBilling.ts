import type { InvoiceRegister, FundInflowRegister, BillWiseDetails } from '../types/database';
import {
  computeInvoiceOutstandingBills,
  isExcludedInvoiceStatus,
  type ComputedInvoiceOutstanding,
} from './invoiceOutstanding';

/** Resident invoice balances use the exact same master calculation logic as Admin (excluding draft/cancelled/pending-approval). */
export function calculateResidentInvoiceMetrics(
  invoices: InvoiceRegister[],
  receipts: FundInflowRegister[],
  allocations: BillWiseDetails[],
  now: Date = new Date(),
): ComputedInvoiceOutstanding[] {
  const issuedOnly = (invoices || []).filter((invoice) => !isExcludedInvoiceStatus(invoice.Invoice_Status));
  return computeInvoiceOutstandingBills(issuedOnly, allocations, receipts, now);
}
