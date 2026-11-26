import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoicePaidAsOnDate,
  computeLastPaymentDetailsAsOnBillingDate,
  computeOutstandingBillsAsOnBillingDate,
} from './invoicePrintHelpers';
import type { BillWiseDetails, FundInflowRegister, InvoiceRegister } from '../types/database';

const makeInv = (overrides: Partial<InvoiceRegister>): InvoiceRegister => ({
  InvoiceID: 'INV-1',
  Invoice_Number: 'INV/2026/001',
  PropertyID: 'PROP-1',
  OwnerID: 'OWN-1',
  Flat_Number: 'A-101',
  Owner_Name: 'Test Owner',
  Ownership_ID: 'OSH-1',
  Billing_Date: '2026-05-01',
  Bill_Period_From: '2026-05-01',
  Bill_Period_To: '2026-05-31',
  Due_Date: '2026-05-15',
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
  Created_At: '2026-05-01',
  Approved_By: 'USR-ADMIN',
  Approved_At: '2026-05-01',
  Cancelled_By: null,
  Cancelled_At: null,
  Cancellation_Reason: null,
  Rate_Effective_Date: '2026-04-01',
  Remarks: '',
  ...overrides,
});

const makeReceipt = (overrides: Partial<FundInflowRegister>): FundInflowRegister => ({
  Transaction_ID: 'TXN-1',
  Receipt_Number: 'RCT-001',
  PropertyID: 'PROP-1',
  Flat_No: 'A-101',
  Ownership_ID: 'OSH-1',
  OwnerID: 'OWN-1',
  Owner_Name: 'Test Owner',
  Date_Of_Received: '2026-04-10',
  Received_Mode: 'UPI',
  Received_Reference: 'UTR1',
  Bank_Account: 'BANK-1',
  Received_Amount: 3500,
  Unallocated_Amount: 0,
  Receipt_Status: 'Confirmed',
  Remarks: '',
  File_Reference: '',
  Created_By: 'USR-ADMIN',
  Created_At: '2026-04-10',
  ...overrides,
});

const makeAlloc = (overrides: Partial<BillWiseDetails>): BillWiseDetails => ({
  Allocation_ID: 'ALL-1',
  Transaction_ID: 'TXN-1',
  InvoiceID: 'INV-1',
  Invoice_Number: 'INV/2026/001',
  PropertyID: 'PROP-1',
  Ownership_ID: 'OSH-1',
  OwnerID: 'OWN-1',
  Allocation_Date: '2026-04-10',
  Invoice_Amount: 3500,
  Previously_Paid: 0,
  Outstanding_Before: 3500,
  Allocated_Amount: 3500,
  Outstanding_After: 0,
  Remarks: '',
  Created_By: 'USR-ADMIN',
  Created_At: '2026-04-10',
  ...overrides,
});

test('Scenario 8: ignores payments allocated after Billing_Date in Paid So Far and Last Payment Details', () => {
  const invMay = makeInv({
    InvoiceID: 'INV-MAY',
    Invoice_Number: 'INV/2026/005',
    Billing_Date: '2026-05-01',
    Net_Charge_Amount: 3500,
    Paid_Amount: 3500, // Later paid in database
    Outstanding_Amount: 0,
    Invoice_Status: 'Paid',
  });
  const receipts = [
    makeReceipt({ Transaction_ID: 'TXN-MAY', Date_Of_Received: '2026-05-12', Received_Mode: 'NEFT', Received_Amount: 3500 }),
  ];
  const allocations = [
    makeAlloc({ Allocation_ID: 'AL-MAY', Transaction_ID: 'TXN-MAY', InvoiceID: 'INV-MAY', Allocation_Date: '2026-05-12', Allocated_Amount: 3500 }),
  ];

  const paidAsOn = computeInvoicePaidAsOnDate(invMay, [invMay], allocations, receipts);
  assert.equal(paidAsOn.paidSoFar, 0);
  assert.equal(paidAsOn.outstanding, 3500);
  assert.equal(paidAsOn.status, 'Unpaid');

  const lastPay = computeLastPaymentDetailsAsOnBillingDate(invMay, [invMay], allocations, receipts);
  assert.equal(lastPay, null);
});

test('Scenario 4 & 5: supports multi-payment on 1 invoice and 1 payment split across multiple invoices up to Billing Date', () => {
  const invApr = makeInv({
    InvoiceID: 'INV-APR',
    Invoice_Number: 'INV/2026/004',
    Billing_Date: '2026-04-01',
    Bill_Period_From: '2026-04-01',
    Bill_Period_To: '2026-04-30',
    Net_Charge_Amount: 4000,
  });
  const invMay = makeInv({
    InvoiceID: 'INV-MAY',
    Invoice_Number: 'INV/2026/005',
    Billing_Date: '2026-05-01',
    Bill_Period_From: '2026-05-01',
    Bill_Period_To: '2026-05-31',
    Net_Charge_Amount: 3500,
  });
  const receipts = [
    makeReceipt({ Transaction_ID: 'TXN-1', Date_Of_Received: '2026-04-05', Received_Mode: 'Cash', Received_Amount: 1500 }),
    makeReceipt({ Transaction_ID: 'TXN-2', Date_Of_Received: '2026-04-20', Received_Mode: 'NEFT', Received_Amount: 3000 }),
  ];
  const allocations = [
    makeAlloc({ Allocation_ID: 'A1', Transaction_ID: 'TXN-1', InvoiceID: 'INV-APR', Allocation_Date: '2026-04-05', Allocated_Amount: 1500 }),
    // TXN-2 split across INV-APR (1500) and INV-MAY (1500 advance/early on 2026-04-20)
    makeAlloc({ Allocation_ID: 'A2', Transaction_ID: 'TXN-2', InvoiceID: 'INV-APR', Allocation_Date: '2026-04-20', Allocated_Amount: 1500 }),
    makeAlloc({ Allocation_ID: 'A3', Transaction_ID: 'TXN-2', InvoiceID: 'INV-MAY', Allocation_Date: '2026-04-20', Allocated_Amount: 1500 }),
  ];

  // For INV-MAY on 2026-05-01, INV-MAY has 1500 allocated on 2026-04-20
  const mayPaid = computeInvoicePaidAsOnDate(invMay, [invApr, invMay], allocations, receipts);
  assert.equal(mayPaid.paidSoFar, 1500);
  assert.equal(mayPaid.outstanding, 2000);
  assert.equal(mayPaid.status, 'Partially Paid');

  // Last Payment Details on INV-MAY picks TXN-2 (2026-04-20), sums both splits = 3000, mode NEFT
  const lastPay = computeLastPaymentDetailsAsOnBillingDate(invMay, [invApr, invMay], allocations, receipts);
  assert.ok(lastPay);
  assert.equal(lastPay.lastPaymentDate, '2026-04-20');
  assert.equal(lastPay.lastPaymentAmount, 3000);
  assert.equal(lastPay.paymentMode, 'NEFT');
});

test('Scenario 9: Outstanding Bills as on Billing Date excludes future, cancelled, draft, fully paid bills and post-Billing-Date payments', () => {
  const invMar = makeInv({
    InvoiceID: 'INV-MAR',
    Invoice_Number: 'INV/2026/003',
    Billing_Date: '2026-03-01',
    Bill_Period_From: '2026-03-01',
    Bill_Period_To: '2026-03-31',
    Purpose: 'Monthly Maintenance',
    Net_Charge_Amount: 3000,
  });
  const invAprPaid = makeInv({
    InvoiceID: 'INV-APR-SF',
    Invoice_Number: 'INV/2026/004',
    Billing_Date: '2026-04-01',
    Bill_Period_From: '2026-04-01',
    Bill_Period_To: '2026-04-30',
    Purpose: 'Sinking Fund',
    Net_Charge_Amount: 2000,
  });
  const invMay = makeInv({
    InvoiceID: 'INV-MAY',
    Invoice_Number: 'INV/2026/005',
    Billing_Date: '2026-05-01',
    Bill_Period_From: '2026-05-01',
    Bill_Period_To: '2026-05-31',
    Purpose: 'Monthly Maintenance',
    Net_Charge_Amount: 3500,
  });
  const invJuneFuture = makeInv({
    InvoiceID: 'INV-JUN',
    Invoice_Number: 'INV/2026/006',
    Billing_Date: '2026-06-01',
    Net_Charge_Amount: 3500,
  });
  const invCancelled = makeInv({
    InvoiceID: 'INV-CAN',
    Invoice_Number: 'INV/2026/007',
    Billing_Date: '2026-04-15',
    Net_Charge_Amount: 1000,
    Invoice_Status: 'Cancelled',
  });
  const invOtherOwner = makeInv({
    InvoiceID: 'INV-OTHER',
    Invoice_Number: 'INV/2026/008',
    Ownership_ID: 'OSH-OTHER',
    Billing_Date: '2026-04-01',
    Net_Charge_Amount: 5000,
  });

  const allInvoices = [invMar, invAprPaid, invMay, invJuneFuture, invCancelled, invOtherOwner];
  const receipts = [
    makeReceipt({ Transaction_ID: 'TXN-APR1', Date_Of_Received: '2026-04-05', Received_Amount: 3000 }),
    makeReceipt({ Transaction_ID: 'TXN-MAY2', Date_Of_Received: '2026-05-10', Received_Amount: 2000 }),
  ];
  const allocations = [
    // 1000 allocated to INV-MAR on 2026-04-05 (before 2026-05-01 -> counts!)
    makeAlloc({ Allocation_ID: 'AL1', Transaction_ID: 'TXN-APR1', InvoiceID: 'INV-MAR', Allocation_Date: '2026-04-05', Allocated_Amount: 1000 }),
    // 2000 allocated to INV-APR-SF on 2026-04-05 (fully settles INV-APR-SF -> excluded from outstanding!)
    makeAlloc({ Allocation_ID: 'AL2', Transaction_ID: 'TXN-APR1', InvoiceID: 'INV-APR-SF', Allocation_Date: '2026-04-05', Allocated_Amount: 2000 }),
    // 2000 allocated to INV-MAR on 2026-05-10 (AFTER 2026-05-01 -> MUST BE IGNORED when viewing INV-MAY!)
    makeAlloc({ Allocation_ID: 'AL3', Transaction_ID: 'TXN-MAY2', InvoiceID: 'INV-MAR', Allocation_Date: '2026-05-10', Allocated_Amount: 2000 }),
  ];

  const os = computeOutstandingBillsAsOnBillingDate(invMay, allInvoices, allocations, receipts);
  assert.equal(os.rows.length, 2);
  assert.equal(os.rows[0].invoiceNumber, 'INV/2026/003');
  assert.equal(os.rows[0].paidAmount, 1000);
  assert.equal(os.rows[0].outstandingAmount, 2000);
  assert.equal(os.rows[1].invoiceNumber, 'INV/2026/005');
  assert.equal(os.rows[1].paidAmount, 0);
  assert.equal(os.rows[1].outstandingAmount, 3500);
  assert.equal(os.totalOutstanding, 5500);

  // When all bills for an ownership are fully paid on or before Billing_Date, returns empty rows + 0 total
  const settledOnDateInv = makeInv({
    InvoiceID: 'INV-SETTLED',
    Invoice_Number: 'INV/2026/009',
    Ownership_ID: 'OSH-CLEAR',
    Billing_Date: '2026-04-10',
    Net_Charge_Amount: 1500,
  });
  const settledAllocs = [
    makeAlloc({
      Allocation_ID: 'AL-CLEAR',
      Transaction_ID: 'TXN-CLEAR',
      InvoiceID: 'INV-SETTLED',
      Ownership_ID: 'OSH-CLEAR',
      Allocation_Date: '2026-04-10',
      Allocated_Amount: 1500,
    }),
  ];
  const settledReceipts = [
    makeReceipt({
      Transaction_ID: 'TXN-CLEAR',
      Ownership_ID: 'OSH-CLEAR',
      Date_Of_Received: '2026-04-10',
      Received_Amount: 1500,
    }),
  ];
  const fullOs = computeOutstandingBillsAsOnBillingDate(
    settledOnDateInv,
    [settledOnDateInv],
    settledAllocs,
    settledReceipts
  );
  assert.equal(fullOs.rows.length, 0);
  assert.equal(fullOs.totalOutstanding, 0);
});
