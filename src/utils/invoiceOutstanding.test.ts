import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoiceOutstandingBills } from './invoiceOutstanding';
import type { BillWiseDetails, FundInflowRegister, InvoiceRegister } from '../types/database';

const makeInvoice = (overrides: Partial<InvoiceRegister>): InvoiceRegister => ({
  InvoiceID: 'INV-1',
  Invoice_Number: 'INV/2026/001',
  PropertyID: 'PROP-1',
  OwnerID: 'OWN-1',
  Flat_Number: 'A-101',
  Owner_Name: 'Anirban Chatterjee',
  Ownership_ID: 'OWNSHIP-1',
  Billing_Date: '2026-04-01',
  Bill_Period_From: '2026-04-01',
  Bill_Period_To: '2026-04-30',
  Due_Date: '2026-04-15',
  RateID: 'RATE-1',
  Rate_Per_SqFt_Unit: 3.5,
  Purpose: 'Monthly Maintenance',
  Calculation_Method: 'Area × Rate',
  Area_Basis: 'Super_Built-up_Area',
  Area_SqFt: 1000,
  Quantity: 1,
  Unit_Of_Measure: 'Sq.Ft',
  Charge_Amount: 3500,
  Late_Fee: 0,
  Discount_Amount: 0,
  Adjustment_Amount: 0,
  Net_Charge_Amount: 3500,
  Paid_Amount: 0,
  Outstanding_Amount: 3500,
  Invoice_Description: 'Monthly Maintenance',
  Invoice_Status: 'Unpaid',
  File_Reference: '',
  Created_By: 'USR-ADMIN',
  Created_At: '2026-04-01',
  Approved_By: 'USR-ADMIN',
  Approved_At: '2026-04-01',
  Cancelled_By: null,
  Cancelled_At: null,
  Cancellation_Reason: null,
  Rate_Effective_Date: '2026-04-01',
  Remarks: '',
  ...overrides,
});

const makeAllocation = (overrides: Partial<BillWiseDetails>): BillWiseDetails => ({
  Allocation_ID: 'ALLOC-1',
  Transaction_ID: 'TXN-1',
  InvoiceID: 'INV-1',
  Invoice_Number: 'INV/2026/001',
  PropertyID: 'PROP-1',
  Ownership_ID: 'OWNSHIP-1',
  OwnerID: 'OWN-1',
  Allocation_Date: '2026-04-10',
  Invoice_Amount: 3500,
  Previously_Paid: 0,
  Outstanding_Before: 3500,
  Allocated_Amount: 1000,
  Outstanding_After: 2500,
  Remarks: '',
  Created_By: 'USR-ADMIN',
  Created_At: '2026-04-10',
  ...overrides,
});

const makeReceipt = (overrides: Partial<FundInflowRegister>): FundInflowRegister => ({
  Transaction_ID: 'TXN-1',
  Receipt_Number: 'REC-001',
  PropertyID: 'PROP-1',
  Flat_No: 'A-101',
  Ownership_ID: 'OWNSHIP-1',
  OwnerID: 'OWN-1',
  Owner_Name: 'Anirban Chatterjee',
  Date_Of_Received: '2026-04-10',
  Received_Mode: 'UPI',
  Received_Reference: 'UTR1',
  Bank_Account: 'BANK-1',
  Received_Amount: 1000,
  Unallocated_Amount: 0,
  Receipt_Status: 'Confirmed',
  Remarks: '',
  File_Reference: '',
  Created_By: 'USR-ADMIN',
  Created_At: '2026-04-10',
  ...overrides,
});

test('computes Net_Charge_Amount - SUM(Allocated_Amount) across multiple allocations per InvoiceID', () => {
  const invoices = [
    makeInvoice({ InvoiceID: 'INV-1', Net_Charge_Amount: 5000, Paid_Amount: 0, Outstanding_Amount: 5000, Due_Date: '2026-05-20' }),
    makeInvoice({ InvoiceID: 'INV-2', Net_Charge_Amount: 2200, Paid_Amount: 999, Outstanding_Amount: 1201, Due_Date: '2026-05-20' }),
    makeInvoice({ InvoiceID: 'INV-3', Net_Charge_Amount: 1800, Paid_Amount: 0, Outstanding_Amount: 1800, Due_Date: '2026-04-05' }),
  ];
  const allocations = [
    makeAllocation({ Allocation_ID: 'A1', Transaction_ID: 'TXN-1', InvoiceID: 'INV-1', Allocated_Amount: 1500 }),
    makeAllocation({ Allocation_ID: 'A2', Transaction_ID: 'TXN-2', InvoiceID: 'INV-1', Allocated_Amount: 2000 }),
    makeAllocation({ Allocation_ID: 'A3', Transaction_ID: 'TXN-3', InvoiceID: 'INV-3', Allocated_Amount: 1800 }),
  ];

  const result = computeInvoiceOutstandingBills(invoices, allocations, [], new Date('2026-05-01T00:00:00Z'));

  assert.equal(result[0].Allocated_Amount_Total, 3500);
  assert.equal(result[0].Calculated_Outstanding, 1500);
  assert.equal(result[0].Outstanding_Amount, 1500);
  assert.equal(result[0].Paid_Amount, 3500);
  assert.equal(result[0].Invoice_Status, 'Partially Paid');

  // INV-2 has 0 allocations in Bill Wise Details, so its Outstanding is full Net_Charge_Amount (2200)
  assert.equal(result[1].Allocated_Amount_Total, 0);
  assert.equal(result[1].Calculated_Outstanding, 2200);
  assert.equal(result[1].Invoice_Status, 'Unpaid');

  // INV-3 is fully settled via Bill Wise Details
  assert.equal(result[2].Allocated_Amount_Total, 1800);
  assert.equal(result[2].Calculated_Outstanding, 0);
  assert.equal(result[2].Invoice_Status, 'Paid');
});

test('ignores allocations linked to non-confirmed receipts when receipts are provided and clamps overpayment at 0', () => {
  const invoices = [
    makeInvoice({ InvoiceID: 'INV-1', Net_Charge_Amount: 3000, Due_Date: '2026-04-01' }),
    makeInvoice({ InvoiceID: 'INV-CAN', Net_Charge_Amount: 3000, Invoice_Status: 'Cancelled' }),
  ];
  const allocations = [
    makeAllocation({ Allocation_ID: 'A1', Transaction_ID: 'TXN-OK', InvoiceID: 'INV-1', Allocated_Amount: 1200 }),
    makeAllocation({ Allocation_ID: 'A2', Transaction_ID: 'TXN-PEND', InvoiceID: 'INV-1', Allocated_Amount: 1800 }),
    makeAllocation({ Allocation_ID: 'A3', Transaction_ID: 'TXN-OK', InvoiceID: 'INV-1', Allocated_Amount: 2500 }),
  ];
  const receipts = [
    makeReceipt({ Transaction_ID: 'TXN-OK', Receipt_Status: 'Confirmed' }),
    makeReceipt({ Transaction_ID: 'TXN-PEND', Receipt_Status: 'Pending Verification' }),
  ];

  const result = computeInvoiceOutstandingBills(invoices, allocations, receipts, new Date('2026-05-01T00:00:00Z'));

  // Confirmed allocations total 1200 + 2500 = 3700 -> Net 3000 - 3700 clamped to 0
  assert.equal(result[0].Allocated_Amount_Total, 3700);
  assert.equal(result[0].Calculated_Outstanding, 0);
  assert.equal(result[0].Invoice_Status, 'Paid');

  // Cancelled invoice remains 0 outstanding
  assert.equal(result[1].Calculated_Outstanding, 0);
  assert.equal(result[1].Invoice_Status, 'Cancelled');
});

test('handles single payment split across multiple invoices and excludes cancelled allocations', () => {
  const invoices = [
    makeInvoice({ InvoiceID: 'INV-A', Invoice_Number: 'INV/01', Net_Charge_Amount: 2000, Due_Date: '2026-05-20' }),
    makeInvoice({ InvoiceID: 'INV-B', Invoice_Number: 'INV/02', Net_Charge_Amount: 3000, Due_Date: '2026-05-20' }),
  ];
  const receipts = [
    makeReceipt({ Transaction_ID: 'TXN-SPLIT', Received_Amount: 3500, Receipt_Status: 'Confirmed' }),
  ];
  const allocations = [
    makeAllocation({ Allocation_ID: 'AL-1', Transaction_ID: 'TXN-SPLIT', InvoiceID: 'INV-A', Allocated_Amount: 2000 }),
    makeAllocation({ Allocation_ID: 'AL-2', Transaction_ID: 'TXN-SPLIT', InvoiceID: 'INV-B', Allocated_Amount: 1500 }),
    makeAllocation({ Allocation_ID: 'AL-VOID', Transaction_ID: 'TXN-SPLIT', InvoiceID: 'INV-B', Allocated_Amount: 500, Status: 'Cancelled' } as any),
  ];

  const result = computeInvoiceOutstandingBills(invoices, allocations, receipts, new Date('2026-05-01T00:00:00Z'));
  assert.equal(result[0].Allocated_Amount_Total, 2000);
  assert.equal(result[0].Calculated_Outstanding, 0);
  assert.equal(result[0].Invoice_Status, 'Paid');

  assert.equal(result[1].Allocated_Amount_Total, 1500);
  assert.equal(result[1].Calculated_Outstanding, 1500);
  assert.equal(result[1].Invoice_Status, 'Partially Paid');
});
