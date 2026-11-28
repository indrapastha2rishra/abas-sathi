/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardFundSummary,
  computeDashboardInvoiceSummary,
  computeFinancialYearSummary,
  computeMaintenanceCollectionRate,
  computeMonthlyReceiptPaymentSummary,
  computeTotalOutstandingCollection,
  resolveDashboardFY,
} from './dashboardHelpers';
import {
  computeInvoiceOutstandingBills,
  toInvoiceAmount,
} from './invoiceOutstanding';
import {
  computeConfirmedInvoiceMetrics,
  computeOwnerOutstandingRows,
  computeOwnershipOutstandingClient,
  computePropertyOutstandingRows,
} from './reportHelpers';
import { calculateResidentInvoiceMetrics } from './residentBilling';
import {
  buildResidentStatementLedger,
  filterResidentScopedRecords,
  filterScopedAllocationsForInvoices,
  summarizeReceipts,
  summarizeResidentPortalData,
} from './residentPortalHelpers';
import { calculateFundSummary, summarizePaidExpenses } from './calculations';
import type {
  BankAccountMaster,
  BillWiseDetails,
  ExpenseRegister,
  FundInflowRegister,
  InvoiceRegister,
  OwnerMaster,
  OwnershipHistory,
  PropertyMaster,
  RateMaster,
} from '../types/database';

function buildFixtureDataset() {
  const properties: PropertyMaster[] = [
    {
      PropertyID: 'PROP-101',
      Flat_No: 'A-101',
      Block_Tower: 'A',
      Floor_No: 1,
      Property_Type: '2BHK',
      Carpet_Area: 900,
      Allocated_Common_Area: 150,
      Structural_Area: 1050,
      Super_Built_up_Area: 1150,
      Occupancy_Status: 'Self Occupied',
      Property_Status: 'Active',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
    {
      PropertyID: 'PROP-102',
      Flat_No: 'A-102',
      Block_Tower: 'A',
      Floor_No: 1,
      Property_Type: '3BHK',
      Carpet_Area: 1200,
      Allocated_Common_Area: 200,
      Structural_Area: 1400,
      Super_Built_up_Area: 1500,
      Occupancy_Status: 'Tenant Occupied',
      Property_Status: 'Active',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
  ];

  const owners: OwnerMaster[] = [
    {
      OwnerID: 'OWN-1',
      Owner_Name: 'Aarav Sen',
      Mobile_No: '9999900001',
      Email_ID: 'aarav@example.com',
      Emergency_Contact: '9999900011',
      Owner_Address: 'A-101',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
    {
      OwnerID: 'OWN-2',
      Owner_Name: 'Meera Das',
      Mobile_No: '9999900002',
      Email_ID: 'meera@example.com',
      Emergency_Contact: '9999900012',
      Owner_Address: 'A-102',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
    {
      OwnerID: 'OWN-OLD',
      Owner_Name: 'Previous Owner',
      Mobile_No: '9999900009',
      Email_ID: 'old@example.com',
      Emergency_Contact: '9999900019',
      Owner_Address: 'Old',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2024-04-01',
    },
  ];

  const ownerships: OwnershipHistory[] = [
    {
      Ownership_ID: 'OSH-101-CUR',
      PropertyID: 'PROP-101',
      OwnerID: 'OWN-1',
      Ownership_Type: 'Sole',
      Ownership_Share: 100,
      Ownership_Start_Date: '2025-04-01',
      Ownership_End_Date: null,
      Ownership_Status: 'Current',
      Municipality_Assessee_No: '',
      Municipality_Holding_No: '',
      Khatian: '',
      JL_No: '',
      Deed_No: '',
      Owner_Document: '',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
    {
      Ownership_ID: 'OSH-101-OLD',
      PropertyID: 'PROP-101',
      OwnerID: 'OWN-OLD',
      Ownership_Type: 'Sole',
      Ownership_Share: 100,
      Ownership_Start_Date: '2024-04-01',
      Ownership_End_Date: '2025-03-31',
      Ownership_Status: 'Transferred',
      Municipality_Assessee_No: '',
      Municipality_Holding_No: '',
      Khatian: '',
      JL_No: '',
      Deed_No: '',
      Owner_Document: '',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2024-04-01',
    },
    {
      Ownership_ID: 'OSH-102-CUR',
      PropertyID: 'PROP-102',
      OwnerID: 'OWN-2',
      Ownership_Type: 'Sole',
      Ownership_Share: 100,
      Ownership_Start_Date: '2025-04-01',
      Ownership_End_Date: null,
      Ownership_Status: 'Current',
      Municipality_Assessee_No: '',
      Municipality_Holding_No: '',
      Khatian: '',
      JL_No: '',
      Deed_No: '',
      Owner_Document: '',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
  ];

  const rates: RateMaster[] = [
    {
      RateID: 'RATE-MAINT',
      Purpose: 'Monthly Maintenance Charge',
      Area_Basis: 'Super_Built-up_Area',
      Rate_Per_SqFt_Unit: 2,
      Effective_From: '2025-04-01',
      Effective_To: null,
      Calculation_Method: 'Area × Rate',
      Applicable_To: 'All Properties',
      Status: 'Active',
      Remarks: 'CAM Maintenance',
      Approved_By: 'Admin',
      Approved_At: '2025-04-01',
      File_Reference: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
    {
      RateID: 'RATE-SINK',
      Purpose: 'Sinking Fund Levy',
      Area_Basis: 'None',
      Rate_Per_SqFt_Unit: 500,
      Effective_From: '2025-04-01',
      Effective_To: null,
      Calculation_Method: 'Fixed Amount',
      Applicable_To: 'All Properties',
      Status: 'Active',
      Remarks: 'Corpus reserve',
      Approved_By: 'Admin',
      Approved_At: '2025-04-01',
      File_Reference: '',
      Created_By: 'Admin',
      Created_At: '2025-04-01',
    },
  ];

  // Note: Includes formatted currency strings, partial payment, overpayment cap,
  // excluded statuses (Cancelled, Draft, Pending Approval), and a prior transferred owner invoice.
  const invoices: InvoiceRegister[] = [
    {
      InvoiceID: 'INV-1',
      Invoice_Number: 'INV-2026-0001',
      Billing_Date: '2026-04-01',
      Bill_Period_From: '2026-04-01',
      Bill_Period_To: '2026-04-30',
      Due_Date: '2026-04-15',
      Ownership_ID: 'OSH-101-CUR',
      PropertyID: 'PROP-101',
      OwnerID: 'OWN-1',
      Purpose: 'Monthly Maintenance',
      Flat_Number: 'A-101',
      Owner_Name: 'Aarav Sen',
      RateID: 'RATE-MAINT',
      Rate_Per_SqFt_Unit: 2,
      Area_Basis: 'Super_Built-up_Area',
      Area_SqFt: 1150,
      Quantity: 1,
      Unit_Of_Measure: 'SqFt',
      Charge_Amount: 2300,
      Late_Fee: 0,
      Discount_Amount: 0,
      Adjustment_Amount: 0,
      Net_Charge_Amount: '₹2,300.00' as unknown as number,
      Paid_Amount: 9999, // Stale sheet field: shared calculation MUST ignore and derive from BillWiseDetails
      Outstanding_Amount: 0,
      Calculation_Method: 'Area × Rate',
      Invoice_Description: 'April 2026 Maintenance',
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
    },
    {
      InvoiceID: 'INV-2',
      Invoice_Number: 'INV-2026-0002',
      Billing_Date: '2026-05-01',
      Bill_Period_From: '2026-05-01',
      Bill_Period_To: '2026-05-31',
      Due_Date: '2026-05-15',
      Ownership_ID: 'OSH-101-CUR',
      PropertyID: 'PROP-101',
      OwnerID: 'OWN-1',
      Purpose: 'Sinking Fund Levy',
      Flat_Number: 'A-101',
      Owner_Name: 'Aarav Sen',
      RateID: 'RATE-SINK',
      Rate_Per_SqFt_Unit: 500,
      Area_Basis: 'None',
      Area_SqFt: 0,
      Quantity: 1,
      Unit_Of_Measure: 'Unit',
      Charge_Amount: 500,
      Late_Fee: 0,
      Discount_Amount: 0,
      Adjustment_Amount: 0,
      Net_Charge_Amount: 500,
      Paid_Amount: 0,
      Outstanding_Amount: 500,
      Calculation_Method: 'Fixed Amount',
      Invoice_Description: 'Sinking Fund',
      Remarks: '',
      File_Reference: '',
      Invoice_Status: 'Unpaid',
      Created_By: 'Admin',
      Created_At: '2026-05-01',
      Approved_By: 'Admin',
      Approved_At: '2026-05-01',
      Cancelled_At: null,
      Cancelled_By: null,
      Cancellation_Reason: null,
      Rate_Effective_Date: '2026-05-01',
    },
    {
      // Overpaid / Paid in full (allocated 3100 against 3000 net; Paid_Amount capped at 3000)
      InvoiceID: 'INV-3',
      Invoice_Number: 'INV-2026-0003',
      Billing_Date: '2026-04-01',
      Bill_Period_From: '2026-04-01',
      Bill_Period_To: '2026-04-30',
      Due_Date: '2026-04-15',
      Ownership_ID: 'OSH-102-CUR',
      PropertyID: 'PROP-102',
      OwnerID: 'OWN-2',
      Purpose: 'Monthly Maintenance',
      Flat_Number: 'A-102',
      Owner_Name: 'Meera Das',
      RateID: 'RATE-MAINT',
      Rate_Per_SqFt_Unit: 2,
      Area_Basis: 'Super_Built-up_Area',
      Area_SqFt: 1500,
      Quantity: 1,
      Unit_Of_Measure: 'SqFt',
      Charge_Amount: 3000,
      Late_Fee: 0,
      Discount_Amount: 0,
      Adjustment_Amount: 0,
      Net_Charge_Amount: 3000,
      Paid_Amount: 0,
      Outstanding_Amount: 3000,
      Calculation_Method: 'Area × Rate',
      Invoice_Description: 'April 2026 Maintenance',
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
    },
    {
      // Excluded: Cancelled invoice
      InvoiceID: 'INV-CANCELLED',
      Invoice_Number: 'INV-2026-0004',
      Billing_Date: '2026-04-05',
      Bill_Period_From: '2026-04-01',
      Bill_Period_To: '2026-04-30',
      Due_Date: '2026-04-20',
      Ownership_ID: 'OSH-101-CUR',
      PropertyID: 'PROP-101',
      OwnerID: 'OWN-1',
      Purpose: 'Monthly Maintenance',
      Flat_Number: 'A-101',
      Owner_Name: 'Aarav Sen',
      RateID: 'RATE-MAINT',
      Rate_Per_SqFt_Unit: 2,
      Area_Basis: 'Super_Built-up_Area',
      Area_SqFt: 1150,
      Quantity: 1,
      Unit_Of_Measure: 'SqFt',
      Charge_Amount: 2300,
      Late_Fee: 0,
      Discount_Amount: 0,
      Adjustment_Amount: 0,
      Net_Charge_Amount: 2300,
      Paid_Amount: 0,
      Outstanding_Amount: 2300,
      Calculation_Method: 'Area × Rate',
      Invoice_Description: 'Duplicate cancelled bill',
      Remarks: '',
      File_Reference: '',
      Invoice_Status: 'Cancelled',
      Created_By: 'Admin',
      Created_At: '2026-04-05',
      Approved_By: '',
      Approved_At: '',
      Cancelled_At: '2026-04-06',
      Cancelled_By: 'Admin',
      Cancellation_Reason: 'Duplicate',
      Rate_Effective_Date: '2026-04-01',
    },
    {
      // Excluded: Draft / Pending Approval invoice
      InvoiceID: 'INV-DRAFT',
      Invoice_Number: 'INV-2026-0005',
      Billing_Date: '2026-05-05',
      Bill_Period_From: '2026-05-01',
      Bill_Period_To: '2026-05-31',
      Due_Date: '2026-05-20',
      Ownership_ID: 'OSH-102-CUR',
      PropertyID: 'PROP-102',
      OwnerID: 'OWN-2',
      Purpose: 'Monthly Maintenance',
      Flat_Number: 'A-102',
      Owner_Name: 'Meera Das',
      RateID: 'RATE-MAINT',
      Rate_Per_SqFt_Unit: 2,
      Area_Basis: 'Super_Built-up_Area',
      Area_SqFt: 1500,
      Quantity: 1,
      Unit_Of_Measure: 'SqFt',
      Charge_Amount: 3000,
      Late_Fee: 0,
      Discount_Amount: 0,
      Adjustment_Amount: 0,
      Net_Charge_Amount: 3000,
      Paid_Amount: 0,
      Outstanding_Amount: 3000,
      Calculation_Method: 'Area × Rate',
      Invoice_Description: 'Draft bill',
      Remarks: '',
      File_Reference: '',
      Invoice_Status: 'Pending Approval' as any,
      Created_By: 'Admin',
      Created_At: '2026-05-05',
      Approved_By: '',
      Approved_At: '',
      Cancelled_At: null,
      Cancelled_By: null,
      Cancellation_Reason: null,
      Rate_Effective_Date: '2026-05-01',
    },
    {
      // Previous transferred ownership bill on PROP-101 (must NOT leak to current resident OSH-101-CUR)
      InvoiceID: 'INV-OLD-OWN',
      Invoice_Number: 'INV-2025-0099',
      Billing_Date: '2025-03-01',
      Bill_Period_From: '2025-03-01',
      Bill_Period_To: '2025-03-31',
      Due_Date: '2025-03-15',
      Ownership_ID: 'OSH-101-OLD',
      PropertyID: 'PROP-101',
      OwnerID: 'OWN-OLD',
      Purpose: 'Monthly Maintenance',
      Flat_Number: 'A-101',
      Owner_Name: 'Previous Owner',
      RateID: 'RATE-MAINT',
      Rate_Per_SqFt_Unit: 2,
      Area_Basis: 'Super_Built-up_Area',
      Area_SqFt: 1150,
      Quantity: 1,
      Unit_Of_Measure: 'SqFt',
      Charge_Amount: 1000,
      Late_Fee: 0,
      Discount_Amount: 0,
      Adjustment_Amount: 0,
      Net_Charge_Amount: 1000,
      Paid_Amount: 0,
      Outstanding_Amount: 1000,
      Calculation_Method: 'Area × Rate',
      Invoice_Description: 'Old owner unpaid balance',
      Remarks: '',
      File_Reference: '',
      Invoice_Status: 'Unpaid',
      Created_By: 'Admin',
      Created_At: '2025-03-01',
      Approved_By: 'Admin',
      Approved_At: '2025-03-01',
      Cancelled_At: null,
      Cancelled_By: null,
      Cancellation_Reason: null,
      Rate_Effective_Date: '2025-03-01',
    },
  ];

  const receipts: FundInflowRegister[] = [
    {
      Transaction_ID: 'TXN-1',
      Receipt_Number: 'RCT-2026-00001',
      Date_Of_Received: '2026-04-10',
      PropertyID: 'PROP-101',
      Ownership_ID: 'OSH-101-CUR',
      OwnerID: 'OWN-1',
      Flat_No: 'A-101',
      Owner_Name: 'Aarav Sen',
      Received_Amount: '₹1,500.00' as unknown as number, // Partial 1,000 against INV-1 + 500 advance credit
      Received_Mode: 'UPI',
      Received_Reference: 'UTR1',
      Bank_Account: 'BANK-1',
      Unallocated_Amount: 500,
      Remarks: '',
      File_Reference: '',
      Created_By: 'Admin',
      Created_At: '2026-04-10',
      Receipt_Status: 'Confirmed',
    },
    {
      // Status fallback instead of Receipt_Status
      Transaction_ID: 'TXN-2',
      Receipt_Number: 'RCT-2026-00002',
      Date_Of_Received: '2026-04-12',
      PropertyID: 'PROP-102',
      Ownership_ID: 'OSH-102-CUR',
      OwnerID: 'OWN-2',
      Flat_No: 'A-102',
      Owner_Name: 'Meera Das',
      Received_Amount: 3100,
      Received_Mode: 'NEFT',
      Received_Reference: 'UTR2',
      Bank_Account: 'BANK-1',
      Unallocated_Amount: 0,
      Remarks: '',
      File_Reference: '',
      Created_By: 'Accountant',
      Created_At: '2026-04-12',
      Receipt_Status: '' as any,
      ...({ Status: 'Confirmed' } as any),
    },
    {
      // Pending Verification MUST NOT reduce outstanding or add to confirmed collection
      Transaction_ID: 'TXN-PENDING',
      Receipt_Number: '',
      Date_Of_Received: '2026-05-02',
      PropertyID: 'PROP-101',
      Ownership_ID: 'OSH-101-CUR',
      OwnerID: 'OWN-1',
      Flat_No: 'A-101',
      Owner_Name: 'Aarav Sen',
      Received_Amount: 1300,
      Received_Mode: 'UPI',
      Received_Reference: 'UTR-PEND',
      Bank_Account: 'BANK-1',
      Unallocated_Amount: 1300,
      Remarks: '',
      File_Reference: '',
      Created_By: 'Resident',
      Created_At: '2026-05-02',
      Receipt_Status: 'Pending Verification',
    },
  ];

  const billAllocations: BillWiseDetails[] = [
    {
      // Partial payment of 1,000 for PROP-101 INV-1 matched by lowercase Invoice_Number (no Ownership_ID on row)
      Allocation_ID: 'ALL-1',
      Transaction_ID: 'txn-1',
      InvoiceID: '',
      PropertyID: 'PROP-101',
      Ownership_ID: '',
      OwnerID: 'OWN-1',
      Invoice_Number: 'inv-2026-0001',
      Invoice_Amount: 2300,
      Previously_Paid: 0,
      Outstanding_Before: 2300,
      Allocated_Amount: '₹1,000.00' as unknown as number,
      Outstanding_After: 1300,
      Allocation_Date: '2026-04-10',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2026-04-10',
    },
    {
      // Over-allocation on INV-3: 3,100 against 3,000 -> Paid_Amount must clamp to 3,000
      Allocation_ID: 'ALL-2',
      Transaction_ID: 'TXN-2',
      InvoiceID: 'INV-3',
      PropertyID: 'PROP-102',
      Ownership_ID: 'OSH-102-CUR',
      OwnerID: 'OWN-2',
      Invoice_Number: 'INV-2026-0003',
      Invoice_Amount: 3000,
      Previously_Paid: 0,
      Outstanding_Before: 3000,
      Allocated_Amount: 3100,
      Outstanding_After: 0,
      Allocation_Date: '2026-04-12',
      Remarks: '',
      Created_By: 'Accountant',
      Created_At: '2026-04-12',
    },
    {
      // Allocation linked to Pending Verification receipt: MUST BE IGNORED
      Allocation_ID: 'ALL-PENDING',
      Transaction_ID: 'TXN-PENDING',
      InvoiceID: 'INV-1',
      PropertyID: 'PROP-101',
      Ownership_ID: 'OSH-101-CUR',
      OwnerID: 'OWN-1',
      Invoice_Number: 'INV-2026-0001',
      Invoice_Amount: 2300,
      Previously_Paid: 1000,
      Outstanding_Before: 1300,
      Allocated_Amount: 1300,
      Outstanding_After: 0,
      Allocation_Date: '2026-05-02',
      Remarks: '',
      Created_By: 'System',
      Created_At: '2026-05-02',
    },
    {
      // Reversed / Void allocation: MUST BE IGNORED
      Allocation_ID: 'ALL-REVERSED',
      Transaction_ID: 'TXN-1',
      InvoiceID: 'INV-2',
      PropertyID: 'PROP-101',
      Ownership_ID: 'OSH-101-CUR',
      OwnerID: 'OWN-1',
      Invoice_Number: 'INV-2026-0002',
      Invoice_Amount: 500,
      Previously_Paid: 0,
      Outstanding_Before: 500,
      Allocated_Amount: 500,
      Outstanding_After: 0,
      Allocation_Date: '2026-05-03',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2026-05-03',
      ...({ Allocation_Status: 'Reversed' } as any),
    },
  ];

  const expenses: ExpenseRegister[] = [
    {
      Expense_ID: 'EXP-1',
      Voucher_No: 'VOU-2026-001',
      Payment_Date: '2026-04-20',
      Expense_Category: 'Security',
      Expense_Subcategory: 'Guard Salary',
      Payee_Name: 'Shield Security',
      Particulars: 'April guard salary',
      Payment_Amount: '₹1,200.50' as unknown as number,
      Payment_Mode: 'NEFT',
      Payment_Reference: 'NEFT-1',
      Bank_Account: 'BANK-1',
      PropertyID: 'Common',
      Remarks: '',
      File_Reference: '',
      Expense_Status: 'Paid',
      Created_By: 'Accountant',
      Created_At: '2026-04-20',
      Approved_By: 'Admin',
      Approved_At: '2026-04-20',
      Cancelled_By: null,
      Cancelled_At: null,
      Cancellation_Reason: null,
    },
    {
      // Approved but unpaid: MUST NOT count as paid expense
      Expense_ID: 'EXP-2',
      Voucher_No: 'VOU-2026-002',
      Payment_Date: '2026-05-10',
      Expense_Category: 'Cleaning',
      Expense_Subcategory: 'Supplies',
      Payee_Name: 'CleanCo',
      Particulars: 'Pending payment',
      Payment_Amount: 800,
      Payment_Mode: 'UPI',
      Payment_Reference: '',
      Bank_Account: 'BANK-1',
      PropertyID: 'Common',
      Remarks: '',
      File_Reference: '',
      Expense_Status: 'Approved',
      Created_By: 'Accountant',
      Created_At: '2026-05-10',
      Approved_By: 'Admin',
      Approved_At: '2026-05-10',
      Cancelled_By: null,
      Cancelled_At: null,
      Cancellation_Reason: null,
    },
  ];

  const bankAccounts: BankAccountMaster[] = [
    {
      BankAccount_ID: 'BANK-1',
      Bank_Name: 'SBI',
      Branch_Name: 'Main',
      Account_Name: 'Society Maint A/C',
      Account_Number: '123456',
      IFSC_Code: 'SBIN000001',
      Account_Type: 'Savings',
      Opening_Balance: 10000,
      Current_Balance: 13399.5,
      Opening_Balance_Date: '2026-04-01',
      Status: 'Active',
      Remarks: '',
      Created_By: 'Admin',
      Created_At: '2026-04-01',
    },
  ];

  return { properties, owners, ownerships, rates, invoices, receipts, billAllocations, expenses, bankAccounts };
}

test('Admin, Committee, and Accountant shared financial summaries produce identical results on the same dataset', () => {
  const ds = buildFixtureDataset();
  const now = new Date(2026, 4, 20); // May 20, 2026

  // Expected values across all issued invoices (INV-1: 2300, INV-2: 500, INV-3: 3000, INV-OLD-OWN: 1000):
  // - Total Billed (all issued): 6800
  // - Confirmed Allocations: INV-1 = 1000, INV-3 = 3100 (Paid clamped to 3000) -> Total Paid = 4000
  // - Outstanding: INV-1 (1300) + INV-2 (500) + INV-3 (0) + INV-OLD-OWN (1000) = 2800
  const invoiceSummary = computeDashboardInvoiceSummary({
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    rates: ds.rates,
    periodStart: '2026-04-01',
    periodEnd: '2027-03-31',
    now,
  });

  assert.equal(invoiceSummary.totalBilled, 6800);
  assert.equal(invoiceSummary.totalCollected, 4000);
  assert.equal(invoiceSummary.totalOutstanding, 2800);

  // FY 2026-27 (April 2026 - March 2027) excludes INV-OLD-OWN (Billing_Date 2025-03-01):
  // FY Billed = 2300 + 500 + 3000 = 5800
  // FY Collected (capped per invoice) = 1000 + 3000 = 4000
  // FY Outstanding = 1300 + 500 + 0 = 1800
  assert.equal(invoiceSummary.fyBilled, 5800);
  assert.equal(invoiceSummary.fyCollected, 4000);
  assert.equal(invoiceSummary.fyOutstanding, 1800);

  // Maintenance only in FY 2026-27 excludes Sinking Fund INV-2 (500) and 2025 INV-OLD-OWN (1000):
  // Maint Billed = 2300 + 3000 = 5300, Maint Collected = 1000 + 3000 = 4000 -> 75.5%
  assert.equal(invoiceSummary.maintenanceBilled, 5300);
  assert.equal(invoiceSummary.maintenanceCollected, 4000);
  assert.equal(invoiceSummary.maintenanceCollectionRate, '75.5');

  // Verify FY Report helper matches Dashboard Invoice Summary + Fund Summary identically
  const fyReport = computeFinancialYearSummary({
    fyName: 'FY 2026-27',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    openingFundBalance: 10000,
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    expenses: ds.expenses,
    rates: ds.rates,
    now,
  });

  assert.equal(fyReport.billed, invoiceSummary.fyBilled);
  assert.equal(fyReport.outstanding, invoiceSummary.fyOutstanding);
  assert.equal(fyReport.maintenanceBilled, invoiceSummary.maintenanceBilled);
  assert.equal(fyReport.maintenanceCollected, invoiceSummary.maintenanceCollected);
  assert.equal(fyReport.maintenanceCollectionRate, invoiceSummary.maintenanceCollectionRate);
  assert.equal(fyReport.receipts, 4600); // TXN-1 (1500) + TXN-2 (3100); TXN-PENDING ignored
  assert.equal(fyReport.paidExpenses, 1200.5); // EXP-1 only; EXP-2 Approved not Paid
  assert.equal(fyReport.closingFundBalance, 13399.5); // 10000 + 4600 - 1200.5

  // Verify Dashboard Fund Summary matches FY Report cash movement
  const dashFund = computeDashboardFundSummary({
    fyRange: { fyId: 'FY-2627', fyName: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31' },
    bankAccounts: ds.bankAccounts,
    invoices: ds.invoices,
    billAllocations: ds.billAllocations,
    receipts: ds.receipts,
    expenses: ds.expenses,
  });
  assert.equal(dashFund.openingFundBalance, fyReport.openingFundBalance);
  assert.equal(dashFund.totalFundReceived, fyReport.receipts);
  assert.equal(dashFund.totalFundUtilized, fyReport.paidExpenses);
  assert.equal(dashFund.availableFund, fyReport.closingFundBalance);

  // Verify legacy calculateFundSummary also agrees on confirmed receipts & paid expenses
  const legacyFund = calculateFundSummary({
    receipts: ds.receipts,
    expenses: ds.expenses,
    invoices: ds.invoices,
    openingBalance: 10000,
    startDate: '2026-04-01',
    endDate: '2027-03-31',
  });
  assert.equal(legacyFund.totalFundReceived, fyReport.receipts);
  assert.equal(legacyFund.totalFundUtilized, fyReport.paidExpenses);
  assert.equal(legacyFund.availableFund, fyReport.closingFundBalance);

  // Verify Monthly Receipt & Payment continuity across April -> May 2026
  const aprilMonthly = computeMonthlyReceiptPaymentSummary({
    selectedMonth: '2026-04',
    fyStartDate: '2026-04-01',
    openingFYBalance: 10000,
    receipts: ds.receipts,
    expenses: ds.expenses,
  });
  const mayMonthly = computeMonthlyReceiptPaymentSummary({
    selectedMonth: '2026-05',
    fyStartDate: '2026-04-01',
    openingFYBalance: 10000,
    receipts: ds.receipts,
    expenses: ds.expenses,
  });
  assert.equal(aprilMonthly.openingAtMonthStart, 10000);
  assert.equal(aprilMonthly.totalMonthInflow, 4600);
  assert.equal(aprilMonthly.totalMonthOutflow, 1200.5);
  assert.equal(aprilMonthly.closingAtMonthEnd, 13399.5);
  assert.equal(mayMonthly.openingAtMonthStart, aprilMonthly.closingAtMonthEnd);
  assert.equal(mayMonthly.closingAtMonthEnd, 13399.5);

  // Verify Property-wise, Owner-wise, and Ownership-wise reports sum to exact same 2,800 total outstanding
  const propRows = computePropertyOutstandingRows({
    properties: ds.properties,
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    owners: ds.owners,
    ownerships: ds.ownerships,
  });
  const ownerRows = computeOwnerOutstandingRows({
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    owners: ds.owners,
    properties: ds.properties,
  });
  const ownershipReport = computeOwnershipOutstandingClient({
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    ownerships: ds.ownerships,
    properties: ds.properties,
    owners: ds.owners,
    asOfDate: now,
  });

  const propTotalDue = propRows.reduce((s, r) => s + r.totalDue, 0);
  const ownerTotalDue = ownerRows.reduce((s, r) => s + r.Outstanding, 0);
  assert.equal(propTotalDue, invoiceSummary.totalOutstanding);
  assert.equal(ownerTotalDue, invoiceSummary.totalOutstanding);
  assert.equal(ownershipReport.summary.totalOutstanding, invoiceSummary.totalOutstanding);
});

test('Resident portal & billing calculations match Admin logic for the resident’s authorized PropertyID and Ownership_ID', () => {
  const ds = buildFixtureDataset();
  const now = new Date(2026, 4, 20);

  // Master Admin calculation filtered to Resident 1 (PROP-101, OSH-101-CUR)
  const adminComputedAll = computeInvoiceOutstandingBills(ds.invoices, ds.billAllocations, ds.receipts, now);
  const adminRes1Invoices = adminComputedAll.filter(
    (inv) =>
      inv.PropertyID === 'PROP-101' &&
      inv.Ownership_ID === 'OSH-101-CUR' &&
      inv.Invoice_Status !== 'Cancelled' &&
      (inv.Invoice_Status as string) !== 'Pending Approval'
  );
  const adminRes1Billed = adminRes1Invoices.reduce((s, i) => s + toInvoiceAmount(i.Net_Charge_Amount), 0);
  const adminRes1Paid = adminRes1Invoices.reduce((s, i) => s + i.Paid_Amount, 0);
  const adminRes1Due = adminRes1Invoices.reduce((s, i) => s + i.Calculated_Outstanding, 0);

  assert.equal(adminRes1Billed, 2800); // INV-1 (2300) + INV-2 (500); excludes Cancelled & Old Owner
  assert.equal(adminRes1Paid, 1000);   // ALL-1 (1000); excludes ALL-PENDING & ALL-REVERSED
  assert.equal(adminRes1Due, 1800);    // 1300 + 500

  // Resident Portal summary (must match Admin slice 1:1 and isolate transferred/other-flat records)
  const portalSummary = summarizeResidentPortalData({
    property: ds.properties[0],
    ownershipId: 'OSH-101-CUR',
    userId: 'USR-RES-1',
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    activityRequests: [],
    ownerships: ds.ownerships,
    owners: ds.owners,
    tenants: [],
    propertyUtilities: [],
    notices: [],
    gallery: [],
    galleryPhotos: [],
    now,
  });

  assert.equal(portalSummary.totalBilled, adminRes1Billed);
  assert.equal(portalSummary.totalPaidAgainstBills, adminRes1Paid);
  assert.equal(portalSummary.totalOutstanding, adminRes1Due);
  assert.equal(portalSummary.confirmedReceivedTotal, 1500);
  assert.equal(portalSummary.advanceCreditTotal, 500);
  assert.equal(portalSummary.pendingVerificationAmount, 1300);

  // Resident bill metrics helper must also match Admin 1:1
  const scopedInvoices = filterResidentScopedRecords(ds.invoices, 'PROP-101', 'OSH-101-CUR');
  const scopedReceipts = filterResidentScopedRecords(ds.receipts, 'PROP-101', 'OSH-101-CUR');
  const scopedAllocs = filterScopedAllocationsForInvoices(
    ds.billAllocations,
    'PROP-101',
    'OSH-101-CUR',
    scopedInvoices,
    scopedReceipts
  );
  const residentMetrics = calculateResidentInvoiceMetrics(scopedInvoices, scopedReceipts, scopedAllocs, now);
  assert.equal(residentMetrics.length, 2);
  assert.equal(
    residentMetrics.find((i) => i.InvoiceID === 'INV-1')?.Paid_Amount,
    adminRes1Invoices.find((i) => i.InvoiceID === 'INV-1')?.Paid_Amount
  );
  assert.equal(
    residentMetrics.find((i) => i.InvoiceID === 'INV-1')?.Outstanding_Amount,
    adminRes1Invoices.find((i) => i.InvoiceID === 'INV-1')?.Calculated_Outstanding
  );

  // Resident Statement Ledger uses confirmed receipts for closing balance (2800 billed - 1500 confirmed = 1300 net ledger due including 500 advance)
  const ledger = buildResidentStatementLedger(scopedInvoices, scopedReceipts);
  assert.equal(ledger.periodDebit, 2800);
  assert.equal(ledger.periodCredit, 1500);
  assert.equal(ledger.closingBalance, 1300);
});

test('Over-allocation clamps Paid_Amount to Net_Charge_Amount and excludes raw unlinked negative outstanding', () => {
  const ds = buildFixtureDataset();
  const computed = computeInvoiceOutstandingBills(ds.invoices, ds.billAllocations, ds.receipts, new Date(2026, 4, 20));
  const inv3 = computed.find((i) => i.InvoiceID === 'INV-3');
  assert.ok(inv3);
  assert.equal(inv3.Net_Charge_Amount, 3000);
  assert.equal(inv3.Allocated_Amount_Total, 3100);
  assert.equal(inv3.Paid_Amount, 3000);
  assert.equal(inv3.Calculated_Outstanding, 0);
  assert.equal(inv3.Invoice_Status, 'Paid');

  // Direct confirm helpers agree
  const confirmedMetrics = computeConfirmedInvoiceMetrics(ds.invoices, ds.receipts, ds.billAllocations, new Date(2026, 4, 20));
  const inv3Metric = confirmedMetrics.find((m) => m.inv.InvoiceID === 'INV-3');
  assert.equal(inv3Metric?.paid, 3000);
  assert.equal(inv3Metric?.due, 0);

  // Total Outstanding Collection (non-FY) uses net minus unvoided confirmed BillWiseDetails
  const totalOutCol = computeTotalOutstandingCollection({
    invoices: ds.invoices,
    billAllocations: ds.billAllocations,
    receipts: ds.receipts,
  });
  assert.equal(totalOutCol.totalInvoiceRegister, 6800);
  assert.equal(totalOutCol.totalBillWiseDetails, 4100);
  assert.equal(totalOutCol.outstandingCollection, 2700);

  // Paid expense & receipt summaries handle formatted currency & status filtering
  const paidExp = summarizePaidExpenses(ds.expenses);
  assert.equal(paidExp.count, 1);
  assert.equal(paidExp.total, 1200.5);

  const recSum = summarizeReceipts(ds.receipts);
  assert.equal(recSum.confirmedReceiptsCount, 2);
  assert.equal(recSum.confirmedReceivedTotal, 4600);
  assert.equal(recSum.pendingVerificationCount, 1);
  assert.equal(recSum.pendingVerificationAmount, 1300);

  const maintRate = computeMaintenanceCollectionRate({
    invoices: ds.invoices,
    receipts: ds.receipts,
    billAllocations: ds.billAllocations,
    rates: ds.rates,
    periodStart: '2026-04-01',
    periodEnd: '2027-03-31',
  });
  assert.equal(maintRate.maintenanceBilled, 5300);
  assert.equal(maintRate.maintenanceCollected, 4000);
});

test('All 4 Dashboard report sections match identically across Admin, Committee (without bankAccounts), and Accountant', () => {
  const ds = buildFixtureDataset();
  const now = new Date(2026, 4, 20);
  const todayKey = '2026-05-20';
  const financialYears = [
    {
      FY_ID: 'FY-2627',
      FY_Name: 'FY 2026-27',
      Start_Date: '2026-04-01',
      End_Date: '2027-03-31',
      Is_Current: 'true',
      FY_Status: 'Active',
    },
  ] as any[];
  const serverFundBalanceSummary = {
    fy: financialYears[0],
    openingFundBalance: 10000,
    totalFundReceived: 4600,
    totalFundUtilized: 1200.5,
  };

  const evaluateDashboardReports = (roleBankAccounts: BankAccountMaster[]) => {
    const fy = resolveDashboardFY({ todayKey, financialYears, serverFy: serverFundBalanceSummary.fy });
    const invSummary = computeDashboardInvoiceSummary({
      invoices: ds.invoices,
      receipts: ds.receipts,
      billAllocations: ds.billAllocations,
      rates: ds.rates,
      periodStart: fy.startDate,
      periodEnd: fy.endDate,
      now,
    });
    const outCol = computeTotalOutstandingCollection({
      invoices: ds.invoices,
      billAllocations: ds.billAllocations,
      receipts: ds.receipts,
    });
    const fund = computeDashboardFundSummary({
      fyRange: fy,
      fundBalanceSummary: serverFundBalanceSummary,
      receipts: ds.receipts,
      expenses: ds.expenses,
      invoices: ds.invoices,
      billAllocations: ds.billAllocations,
      bankAccounts: roleBankAccounts,
      totalOutstanding: outCol.outstandingCollection,
    });
    const ownershipOut = computeOwnershipOutstandingClient({
      invoices: ds.invoices,
      receipts: ds.receipts,
      billAllocations: ds.billAllocations,
      ownerships: ds.ownerships,
      properties: ds.properties,
      owners: ds.owners,
      asOfDate: now,
    });
    return { fy, invSummary, outCol, fund, ownershipOut };
  };

  const adminView = evaluateDashboardReports(ds.bankAccounts);
  const committeeView = evaluateDashboardReports([]); // Committee must never receive bankAccounts
  const accountantView = evaluateDashboardReports(ds.bankAccounts);

  // 1. Outstanding Collection
  assert.deepEqual(committeeView.outCol, adminView.outCol);
  assert.deepEqual(accountantView.outCol, adminView.outCol);
  assert.equal(committeeView.fund.outstandingCollection, adminView.fund.outstandingCollection);
  assert.equal(accountantView.fund.outstandingCollection, adminView.fund.outstandingCollection);

  // 2. Ownership-wise Outstanding Report
  assert.deepEqual(committeeView.ownershipOut, adminView.ownershipOut);
  assert.deepEqual(accountantView.ownershipOut, adminView.ownershipOut);

  // 3. Maintenance Status Report
  assert.deepEqual(committeeView.invSummary.maintenanceDonutSegments, adminView.invSummary.maintenanceDonutSegments);
  assert.deepEqual(accountantView.invSummary.maintenanceDonutSegments, adminView.invSummary.maintenanceDonutSegments);
  assert.equal(committeeView.invSummary.maintenanceInvoiceCount, adminView.invSummary.maintenanceInvoiceCount);
  assert.equal(committeeView.invSummary.maintenancePaidCount, adminView.invSummary.maintenancePaidCount);
  assert.equal(committeeView.invSummary.maintenancePartialCount, adminView.invSummary.maintenancePartialCount);
  assert.equal(committeeView.invSummary.maintenanceUnpaidCount, adminView.invSummary.maintenanceUnpaidCount);
  assert.equal(committeeView.invSummary.maintenanceOverdueCount, adminView.invSummary.maintenanceOverdueCount);
  assert.equal(accountantView.invSummary.maintenanceInvoiceCount, adminView.invSummary.maintenanceInvoiceCount);

  // 4. Maintenance Collection Rate
  assert.equal(committeeView.invSummary.maintenanceCollectionRate, adminView.invSummary.maintenanceCollectionRate);
  assert.equal(accountantView.invSummary.maintenanceCollectionRate, adminView.invSummary.maintenanceCollectionRate);
  assert.equal(committeeView.invSummary.maintenanceCollected, adminView.invSummary.maintenanceCollected);
  assert.equal(committeeView.invSummary.maintenanceBilled, adminView.invSummary.maintenanceBilled);
  assert.equal(committeeView.invSummary.totalOutstanding, adminView.invSummary.totalOutstanding);
  assert.equal(committeeView.fy.fyName, adminView.fy.fyName);
});

