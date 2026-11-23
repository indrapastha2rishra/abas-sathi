import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateResidentInvoiceMetrics } from './residentBilling';
import type { InvoiceRegister, FundInflowRegister, BillWiseDetails } from '../types/database';

const invoice = (id: string, amount: number, due = '2026-12-01', status = 'Issued') => ({
  InvoiceID: id, Invoice_Number: id, Billing_Date: '2026-11-01', Bill_Period_From: '2026-11-01', Bill_Period_To: '2026-11-30', Due_Date: due,
  Ownership_ID: 'OWN-1', PropertyID: 'PROP-1', OwnerID: 'OWNER-1', Purpose: 'Maintenance', Flat_Number: 'A-101', Owner_Name: 'Resident', RateID: 'R-1',
  Rate_Per_SqFt_Unit: 1, Area_Basis: 'None', Area_SqFt: 1, Quantity: 1, Unit_Of_Measure: 'Month', Charge_Amount: amount, Late_Fee: 0,
  Discount_Amount: 0, Adjustment_Amount: 0, Net_Charge_Amount: amount, Paid_Amount: 0, Outstanding_Amount: amount, Calculation_Method: 'Fixed Amount',
  Invoice_Description: '', Remarks: '', File_Reference: '', Invoice_Status: status, Created_By: '', Created_At: '', Approved_By: '', Approved_At: '', Cancelled_At: null,
  Cancelled_By: null, Cancellation_Reason: null, Rate_Effective_Date: '',
} as unknown as InvoiceRegister);
const receipt = (transactionId: string, status: string) => ({ Transaction_ID: transactionId, Receipt_Status: status } as FundInflowRegister);
const allocation = (transactionId: string, invoiceId: string, amount: number) => ({ Transaction_ID: transactionId, InvoiceID: invoiceId, Allocated_Amount: amount } as BillWiseDetails);

test('resident balances sum confirmed allocations only and cap at bill net', () => {
  const rows = calculateResidentInvoiceMetrics(
    [invoice('INV-1', 1000), invoice('INV-2', 1000)],
    [receipt('TX-1', 'Confirmed'), receipt('TX-2', 'Pending Verification')],
    [allocation('TX-1', 'INV-1', 600), allocation('TX-2', 'INV-1', 200), allocation('TX-1', 'INV-2', 1200)],
    new Date('2026-11-23T12:00:00'),
  );
  assert.equal(rows[0].Paid_Amount, 600);
  assert.equal(rows[0].Outstanding_Amount, 400);
  assert.equal(rows[0].Invoice_Status, 'Partially Paid');
  assert.equal(rows[1].Paid_Amount, 1000);
  assert.equal(rows[1].Outstanding_Amount, 0);
  assert.equal(rows[1].Invoice_Status, 'Paid');
});

test('resident balance excludes cancelled, draft, and pending-approval invoices', () => {
  const rows = calculateResidentInvoiceMetrics(
    [invoice('INV-1', 500, '2026-11-01', 'Issued'), invoice('INV-2', 500, '2026-11-01', 'Cancelled'), invoice('INV-3', 500, '2026-11-01', 'Draft'), invoice('INV-4', 500, '2026-11-01', 'Pending_Approval')],
    [], [], new Date('2026-11-23T12:00:00'),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Invoice_Status, 'Overdue');
  assert.equal(rows[0].Outstanding_Amount, 500);
});
