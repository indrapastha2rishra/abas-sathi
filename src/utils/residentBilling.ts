import type { InvoiceRegister, FundInflowRegister, BillWiseDetails } from '../types/database';

const EXCLUDED_RESIDENT_INVOICE_STATUSES = new Set(['cancelled', 'draft', 'pending_approval', 'pending approval']);

/** Resident invoice balances are derived only from allocations belonging to confirmed receipts. */
export function calculateResidentInvoiceMetrics(
  invoices: InvoiceRegister[],
  receipts: FundInflowRegister[],
  allocations: BillWiseDetails[],
  now: Date = new Date(),
) {
  const confirmedTransactionIds = new Set(
    receipts
      .filter(receipt => String(receipt.Receipt_Status || '').trim().toLowerCase() === 'confirmed')
      .map(receipt => String(receipt.Transaction_ID || '')),
  );
  const allocatedByInvoice = new Map<string, number>();
  allocations.forEach(row => {
    if (!confirmedTransactionIds.has(String(row.Transaction_ID || ''))) return;
    const invoiceId = String(row.InvoiceID || '');
    if (!invoiceId) return;
    const amount = Math.max(0, Number(row.Allocated_Amount || 0));
    if (!Number.isFinite(amount)) return;
    allocatedByInvoice.set(invoiceId, (allocatedByInvoice.get(invoiceId) || 0) + amount);
  });

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return invoices
    .filter(invoice => !EXCLUDED_RESIDENT_INVOICE_STATUSES.has(String(invoice.Invoice_Status || '').trim().toLowerCase()))
    .map(invoice => {
      const net = Math.max(0, Number(invoice.Net_Charge_Amount || 0));
      const allocated = Math.max(0, allocatedByInvoice.get(String(invoice.InvoiceID || '')) || 0);
      const paid = Math.min(net, allocated);
      const outstanding = Math.max(0, net - paid);
      const dueDate = String(invoice.Due_Date || '').slice(0, 10);
      const status = outstanding <= 0
        ? 'Paid'
        : paid > 0
          ? 'Partially Paid'
          : dueDate && dueDate < today
            ? 'Overdue'
            : 'Unpaid';
      return { ...invoice, Paid_Amount: paid, Outstanding_Amount: outstanding, Invoice_Status: status };
    });
}
