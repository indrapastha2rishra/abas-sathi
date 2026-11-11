/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateChargeAmount,
  calculateNetChargeAmount,
  allocatePaymentToInvoice,
  hasPermission,
  generateNextCode,
  calculateFundSummary,
} from './calculations';

test('calculateFundSummary computes FY fund balance, utilization, and available funds accurately', () => {
  const openingBalance = 1735000; // e.g. 485,000 SBI + 1,250,000 HDFC

  const dummyReceipts = [
    {
      Transaction_ID: 'TXN-1',
      Receipt_Number: 'REC-2026-0001',
      Date_Of_Received: '2026-04-08',
      PropertyID: 'PROP-BlockA-101',
      Ownership_ID: 'OSH-001',
      OwnerID: 'OWNER-001',
      Flat_No: '101',
      Owner_Name: 'Anirban Mukherjee',
      Received_Amount: 3700,
      Received_Mode: 'UPI' as const,
      Received_Reference: 'UPI/123',
      Bank_Account: 'BANK-SBI-01',
      Unallocated_Amount: 0,
      Remarks: '',
      File_Reference: '',
      Created_By: 'Accountant',
      Created_At: '2026-04-08',
      Receipt_Status: 'Confirmed' as const,
    },
    {
      Transaction_ID: 'TXN-2',
      Receipt_Number: 'REC-2026-0002',
      Date_Of_Received: '2026-04-10',
      PropertyID: 'PROP-BlockA-102',
      Ownership_ID: 'OSH-002',
      OwnerID: 'OWNER-002',
      Flat_No: '102',
      Owner_Name: 'Debashis Roy',
      Received_Amount: 3025,
      Received_Mode: 'NEFT' as const,
      Received_Reference: 'NEFT/456',
      Bank_Account: 'BANK-SBI-01',
      Unallocated_Amount: 0,
      Remarks: '',
      File_Reference: '',
      Created_By: 'Accountant',
      Created_At: '2026-04-10',
      Receipt_Status: 'Confirmed' as const,
    },
    {
      Transaction_ID: 'TXN-3',
      Receipt_Number: 'REC-2026-0003',
      Date_Of_Received: '2026-04-12',
      PropertyID: 'PROP-BlockA-103',
      Ownership_ID: 'OSH-003',
      OwnerID: 'OWNER-003',
      Flat_No: '103',
      Owner_Name: 'Sourav Ganguly',
      Received_Amount: 2000,
      Received_Mode: 'UPI' as const,
      Received_Reference: 'UPI/789',
      Bank_Account: 'BANK-SBI-01',
      Unallocated_Amount: 0,
      Remarks: '',
      File_Reference: '',
      Created_By: 'Accountant',
      Created_At: '2026-04-12',
      Receipt_Status: 'Pending Verification' as const, // Should be excluded from confirmed receipts
    },
  ];

  const dummyExpenses = [
    {
      Expense_Status: 'Paid',
      Payment_Amount: 36000,
      Payment_Date: '2026-04-05',
    },
    {
      Expense_Status: 'Paid',
      Payment_Amount: 22450,
      Payment_Date: '2026-04-12',
    },
    {
      Expense_Status: 'Pending Approval', // Should be excluded from paid fund utilization
      Payment_Amount: 11280,
      Payment_Date: '2026-05-05',
    },
  ];

  const dummyInvoices = [
    { Outstanding_Amount: 3700, Billing_Date: '2026-05-01' },
    { Outstanding_Amount: 1850, Billing_Date: '2026-05-01' },
    { Outstanding_Amount: 0, Billing_Date: '2026-04-01' },
  ];

  const summary = calculateFundSummary({
    openingBalance,
    receipts: dummyReceipts,
    expenses: dummyExpenses,
    invoices: dummyInvoices,
    startDate: '2026-04-01',
    endDate: '2027-03-31',
  });

  // Confirmed receipts: 3700 + 3025 = 6725
  assert.equal(summary.totalFundReceived, 6725);
  // Paid expenses: 36000 + 22450 = 58450
  assert.equal(summary.totalFundUtilized, 58450);
  // Available fund: 1735000 + 6725 - 58450 = 1683275
  assert.equal(summary.availableFund, 1683275);
  // Outstanding collection: 3700 + 1850 = 5550
  assert.equal(summary.outstandingCollection, 5550);
});
import { FundInflowRegister, InvoiceRegister } from '../types/database';

test('calculateChargeAmount computes Area × Rate correctly', () => {
  // 1200 sq.ft at ₹2.50 per sq.ft
  const result = calculateChargeAmount('Area × Rate', 2.5, 1200);
  assert.equal(result, 3000);
});

test('calculateChargeAmount computes Quantity × Rate correctly', () => {
  // 3 parking slots at ₹500
  const result = calculateChargeAmount('Quantity × Rate', 500, 0, 3);
  assert.equal(result, 1500);
});

test('calculateChargeAmount computes Fixed Amount correctly', () => {
  const result = calculateChargeAmount('Fixed Amount', 750, 1500);
  assert.equal(result, 750);
});

test('calculateNetChargeAmount applies late fee, discount, and adjustment', () => {
  // Net = 3000 + 100 (late fee) - 150 (discount) + 50 (debit adjustment) = 3000
  const netDebit = calculateNetChargeAmount(3000, 100, 150, 50);
  assert.equal(netDebit, 3000);

  // Negative adjustment means credit
  const netCredit = calculateNetChargeAmount(3000, 0, 0, -200);
  assert.equal(netCredit, 2800);
});

test('allocatePaymentToInvoice handles full allocation and updates statuses', () => {
  const dummyReceipt: FundInflowRegister = {
    Transaction_ID: 'TXN-1',
    Receipt_Number: 'REC-2026-0001',
    Date_Of_Received: '2026-04-05',
    PropertyID: 'PROP-101',
    Ownership_ID: 'OWN-101',
    OwnerID: 'O-1',
    Flat_No: '101',
    Owner_Name: 'Anirban Mukherjee',
    Received_Amount: 3000,
    Received_Mode: 'UPI',
    Received_Reference: 'UPI/6102948',
    Bank_Account: 'SBI-001',
    Unallocated_Amount: 3000,
    Remarks: 'Maintenance payment',
    File_Reference: '',
    Created_By: 'Resident',
    Created_At: '2026-04-05',
    Receipt_Status: 'Confirmed',
  };

  const dummyInvoice: InvoiceRegister = {
    InvoiceID: 'INV-1',
    Invoice_Number: 'INV-2026-0001',
    Billing_Date: '2026-04-01',
    Bill_Period_From: '2026-04-01',
    Bill_Period_To: '2026-04-30',
    Due_Date: '2026-04-15',
    Ownership_ID: 'OWN-101',
    PropertyID: 'PROP-101',
    OwnerID: 'O-1',
    Purpose: 'Society Maintenance',
    Flat_Number: '101',
    Owner_Name: 'Anirban Mukherjee',
    RateID: 'RATE-1',
    Rate_Per_SqFt_Unit: 2.5,
    Area_Basis: 'Structural_Area',
    Area_SqFt: 1200,
    Quantity: 1,
    Unit_Of_Measure: 'Sq.Ft.',
    Charge_Amount: 3000,
    Late_Fee: 0,
    Discount_Amount: 0,
    Adjustment_Amount: 0,
    Net_Charge_Amount: 3000,
    Paid_Amount: 0,
    Outstanding_Amount: 3000,
    Calculation_Method: 'Area × Rate',
    Invoice_Description: 'Monthly maintenance for April 2026',
    Remarks: '',
    File_Reference: '',
    Invoice_Status: 'Unpaid',
    Created_By: 'Admin',
    Created_At: '2026-04-01',
    Approved_By: 'Admin',
    Approved_At: '2026-04-01',
    Cancelled_At: null,
    Cancelled_By: null,
    Cancellation_Reason: null,
    Rate_Effective_Date: '2026-04-01',
  };

  const result = allocatePaymentToInvoice({
    receipt: dummyReceipt,
    invoice: dummyInvoice,
    userId: 'Accountant',
  });

  assert.equal(result.success, true);
  assert.equal(result.allocatedAmount, 3000);
  assert.equal(result.updatedReceipt?.Unallocated_Amount, 0);
  assert.equal(result.updatedInvoice?.Outstanding_Amount, 0);
  assert.equal(result.updatedInvoice?.Paid_Amount, 3000);
  assert.equal(result.updatedInvoice?.Invoice_Status, 'Paid');
  assert.equal(result.billDetail?.Outstanding_Before, 3000);
  assert.equal(result.billDetail?.Outstanding_After, 0);
});

test('allocatePaymentToInvoice handles partial allocation and leaves unallocated advance', () => {
  const dummyReceipt: FundInflowRegister = {
    Transaction_ID: 'TXN-2',
    Receipt_Number: 'REC-2026-0002',
    Date_Of_Received: '2026-04-05',
    PropertyID: 'PROP-102',
    Ownership_ID: 'OWN-102',
    OwnerID: 'O-2',
    Flat_No: '102',
    Owner_Name: 'Debashis Roy',
    Received_Amount: 5000,
    Received_Mode: 'NEFT',
    Received_Reference: 'NEFT/55491',
    Bank_Account: 'SBI-001',
    Unallocated_Amount: 5000,
    Remarks: 'Advance payment',
    File_Reference: '',
    Created_By: 'Resident',
    Created_At: '2026-04-05',
    Receipt_Status: 'Confirmed',
  };

  const dummyInvoice: InvoiceRegister = {
    InvoiceID: 'INV-2',
    Invoice_Number: 'INV-2026-0002',
    Billing_Date: '2026-04-01',
    Bill_Period_From: '2026-04-01',
    Bill_Period_To: '2026-04-30',
    Due_Date: '2026-04-15',
    Ownership_ID: 'OWN-102',
    PropertyID: 'PROP-102',
    OwnerID: 'O-2',
    Purpose: 'Society Maintenance',
    Flat_Number: '102',
    Owner_Name: 'Debashis Roy',
    RateID: 'RATE-1',
    Rate_Per_SqFt_Unit: 2.5,
    Area_Basis: 'Structural_Area',
    Area_SqFt: 1400,
    Quantity: 1,
    Unit_Of_Measure: 'Sq.Ft.',
    Charge_Amount: 3500,
    Late_Fee: 0,
    Discount_Amount: 0,
    Adjustment_Amount: 0,
    Net_Charge_Amount: 3500,
    Paid_Amount: 0,
    Outstanding_Amount: 3500,
    Calculation_Method: 'Area × Rate',
    Invoice_Description: 'Monthly maintenance',
    Remarks: '',
    File_Reference: '',
    Invoice_Status: 'Unpaid',
    Created_By: 'Admin',
    Created_At: '2026-04-01',
    Approved_By: 'Admin',
    Approved_At: '2026-04-01',
    Cancelled_At: null,
    Cancelled_By: null,
    Cancellation_Reason: null,
    Rate_Effective_Date: '2026-04-01',
  };

  const result = allocatePaymentToInvoice({
    receipt: dummyReceipt,
    invoice: dummyInvoice,
    userId: 'Accountant',
  });

  assert.equal(result.success, true);
  assert.equal(result.allocatedAmount, 3500);
  assert.equal(result.updatedReceipt?.Unallocated_Amount, 1500); // 5000 - 3500
  assert.equal(result.updatedInvoice?.Outstanding_Amount, 0);
  assert.equal(result.updatedInvoice?.Invoice_Status, 'Paid');
});

test('hasPermission enforces role boundaries', () => {
  assert.equal(hasPermission('Admin', 'settings_admin'), true);
  assert.equal(hasPermission('Accountant', 'settings_admin'), false);
  assert.equal(hasPermission('Accountant', 'payments_manage'), true);
  assert.equal(hasPermission('Committee', 'activity_requests_all'), true);
  assert.equal(hasPermission('Committee', 'expenses_manage'), false);
  assert.equal(hasPermission('Resident', 'resident_portal'), true);
  assert.equal(hasPermission('Resident', 'payments_manage'), false);
});

test('generateNextCode formats serial codes correctly', () => {
  assert.equal(generateNextCode('INV', 0), 'INV-2026-0001');
  assert.equal(generateNextCode('REC', 14), 'REC-2026-0015');
  assert.equal(generateNextCode('VOU', 99), 'VOU-2026-0100');
  assert.equal(generateNextCode('REQ', 3), 'REQ-2026-0004');
});
