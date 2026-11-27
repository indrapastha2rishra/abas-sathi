import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActiveGalleryEvents,
  computeDashboardFundSummary,
  computeDashboardInvoiceSummary,
  computeMaintenanceCollectionRate,
  computeTotalOutstandingCollection,
  DASHBOARD_DONUT_CIRCUMFERENCE,
  filterActiveNotices,
  resolveDashboardFY,
  sortOwnershipOutstandingByFlatAsc,
} from './dashboardHelpers';
import type { GalleryMaster, GalleryPhoto, NoticeMaster } from '../types/database';

test('sortOwnershipOutstandingByFlatAsc sorts naturally by Flat_No ascending', () => {
  const rows = [
    { Ownership_ID: 'O3', Flat_No: 'B-201', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O2', Flat_No: 'A-102', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O4', Flat_No: 'A-10', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O1', Flat_No: 'A-2', Ownership_Start_Date: '2024-01-01' },
    { Ownership_ID: 'O5', Flat_No: 'A-101', Ownership_Start_Date: '2025-01-01' },
    { Ownership_ID: 'O0', Flat_No: 'A-101', Ownership_Start_Date: '2023-01-01' },
  ];

  const sorted = sortOwnershipOutstandingByFlatAsc(rows);
  assert.deepEqual(
    sorted.map((r) => `${r.Flat_No}:${r.Ownership_ID}`),
    ['A-2:O1', 'A-10:O4', 'A-101:O0', 'A-101:O5', 'A-102:O2', 'B-201:O3']
  );
});

test('filterActiveNotices supports Published/Active statuses and various date formats', () => {
  const notices: NoticeMaster[] = [
    {
      Notice_ID: 'N1',
      Notice_Number: 'NOT-1',
      Notice_Title: 'Older Active Notice',
      Notice_Category: 'General',
      Notice_Description: 'Details 1',
      Publish_Date: '01/04/2026',
      Expiry_Date: '31/12/2026',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Active' as any,
      Created_By: 'Admin',
      Created_At: '2026-04-01',
    },
    {
      Notice_ID: 'N2',
      Notice_Number: 'NOT-2',
      Notice_Title: 'Latest Published Notice',
      Notice_Category: 'Meeting',
      Notice_Description: 'Details 2',
      Publish_Date: '2026-05-05T10:00:00Z',
      Expiry_Date: '2026-06-30',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Published',
      Created_By: 'Admin',
      Created_At: '2026-05-05',
    },
    {
      Notice_ID: 'N3',
      Notice_Number: 'NOT-3',
      Notice_Title: 'Expired Notice',
      Notice_Category: 'General',
      Notice_Description: 'Expired',
      Publish_Date: '2026-01-01',
      Expiry_Date: '2026-04-30',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Published',
      Created_By: 'Admin',
      Created_At: '2026-01-01',
    },
    {
      Notice_ID: 'N4',
      Notice_Number: 'NOT-4',
      Notice_Title: 'Draft Notice',
      Notice_Category: 'General',
      Notice_Description: 'Draft',
      Publish_Date: '2026-05-01',
      Expiry_Date: '2026-12-31',
      Attachment: '',
      Visibility: 'All',
      Notice_Status: 'Draft',
      Created_By: 'Admin',
      Created_At: '2026-05-01',
    },
  ];

  const active = filterActiveNotices(notices, '2026-05-10');
  assert.deepEqual(
    active.map((n) => n.Notice_ID),
    ['N2', 'N1']
  );
});

test('buildActiveGalleryEvents connects Gallery Master with Gallery_Photos in display order', () => {
  const gallery: GalleryMaster[] = [
    {
      Gallery_ID: 'GAL-1',
      Event_Name: 'Durga Puja 2026',
      Event_Date: '2026-10-15',
      Event_Description: 'Community Puja',
      Photo_File_Reference: 'https://example.com/cover.jpg',
      Visibility: 'Residents Only',
      Uploaded_By: 'Admin',
      Uploaded_At: '2026-10-16',
      Status: 'Active',
    },
    {
      Gallery_ID: 'GAL-2',
      Event_Name: 'Old Event',
      Event_Date: '2025-01-26',
      Event_Description: 'Archived',
      Photo_File_Reference: 'https://example.com/old.jpg',
      Visibility: 'Residents Only',
      Uploaded_By: 'Admin',
      Uploaded_At: '2025-01-27',
      Status: 'Archived',
    },
  ];

  const galleryPhotos: GalleryPhoto[] = [
    {
      Photo_ID: 'PHO-2',
      Gallery_ID: 'GAL-1',
      Photo_File_Reference: 'https://example.com/second.jpg',
      Photo_Caption: 'Evening Aarti',
      Display_Order: 2,
      Status: 'Active',
    },
    {
      Photo_ID: 'PHO-1',
      Gallery_ID: 'GAL-1',
      Photo_File_Reference: 'DRIVE-FILE-1',
      Photo_Caption: 'Pandal Inauguration',
      Display_Order: 1,
      Status: 'Active',
    },
    {
      Photo_ID: 'PHO-3',
      Gallery_ID: 'GAL-1',
      Photo_File_Reference: 'https://example.com/hidden.jpg',
      Photo_Caption: 'Hidden',
      Display_Order: 3,
      Status: 'Inactive',
    },
  ];

  const events = buildActiveGalleryEvents(gallery, galleryPhotos);
  assert.equal(events.length, 1);
  assert.equal(events[0].event.Gallery_ID, 'GAL-1');
  assert.deepEqual(
    events[0].photos.map((p) => p.photoId),
    ['GAL-1-cover', 'PHO-1', 'PHO-2']
  );
  assert.equal(events[0].photos[1].caption, 'Pandal Inauguration');
});

test('computeDashboardInvoiceSummary matches Admin Panel invoice rules and builds all 4 donut segments', () => {
  const summary = computeDashboardInvoiceSummary({
    invoices: [
      { InvoiceID: 'I1', Invoice_Number: 'INV-1', Net_Charge_Amount: '₹2,000.00', Due_Date: '2026-05-20', Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'I2', Invoice_Number: 'INV-2', Net_Charge_Amount: 2000, Due_Date: '2026-05-20', Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'I3', Invoice_Number: 'INV-3', Net_Charge_Amount: 2000, Due_Date: '2026-05-20', Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'I4', Invoice_Number: 'INV-4', Net_Charge_Amount: 2000, Due_Date: '15/04/2026', Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'I5', Invoice_Number: 'INV-5', Net_Charge_Amount: 5000, Due_Date: '2026-04-01', Invoice_Status: 'Cancelled' } as any,
    ],
    receipts: [
      { Transaction_ID: ' TXN-1 ', Status: 'Confirmed' } as any,
      { Transaction_ID: 'TXN-2', Receipt_Status: 'Confirmed' } as any,
      { Transaction_ID: 'TXN-PEND', Receipt_Status: 'Pending Verification' } as any,
    ],
    billAllocations: [
      { Transaction_ID: 'TXN-1', InvoiceID: '', Invoice_Number: 'INV-1', Allocated_Amount: '₹2,000' } as any,
      { Transaction_ID: 'TXN-2', InvoiceID: ' I2 ', Allocated_Amount: 1000 } as any,
      { Transaction_ID: 'TXN-PEND', InvoiceID: 'I3', Allocated_Amount: 2000 } as any,
    ],
    now: new Date('2026-05-01T00:00:00'),
  });

  assert.equal(summary.issuedInvoices.length, 4);
  assert.equal(summary.paidCount, 1);
  assert.equal(summary.partialCount, 1);
  assert.equal(summary.unpaidCount, 1);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.totalBilled, 8000);
  assert.equal(summary.totalCollected, 3000);
  assert.equal(summary.totalOutstanding, 5000);
  assert.equal(summary.collectionRate, '37.5');

  const totalArcLength = summary.donutSegments.reduce((s, seg) => s + seg.length, 0);
  assert.ok(Math.abs(totalArcLength - DASHBOARD_DONUT_CIRCUMFERENCE) < 1e-6);
  assert.equal(summary.donutSegments[0].offset, 0);
  assert.ok(summary.donutSegments[1].offset < 0);
  assert.ok(summary.donutSegments[2].offset < summary.donutSegments[1].offset);
  assert.ok(summary.donutSegments[3].offset < summary.donutSegments[2].offset);
});

test('resolveDashboardFY and computeDashboardFundSummary mirror ReportsView FY summary rules', () => {
  const fyRange = resolveDashboardFY({
    todayKey: '2026-05-15',
    financialYears: [
      { FY_ID: 'FY26', FY_Name: 'FY 2026-2027', Start_Date: '2026-04-01', End_Date: '2027-03-31', Is_Current: true } as any,
    ],
  });
  assert.equal(fyRange.fyName, 'FY 2026-2027');

  const summary = computeDashboardFundSummary({
    fyRange,
    fundBalanceSummary: { openingFundBalance: 100000 },
    receipts: [
      { Transaction_ID: 'T1', Status: 'Confirmed', Date_Of_Received: '10/04/2026', Received_Amount: '₹2,500.25' } as any,
      { Transaction_ID: 'T2', Receipt_Status: 'Pending Verification', Date_Of_Received: '2026-04-12', Received_Amount: 5000 } as any,
    ],
    expenses: [
      { Expense_Status: 'Paid', Payment_Date: '2026-04-20', Payment_Amount: '₹1,000.10' } as any,
    ],
    invoices: [],
    bankAccounts: [{ BankAccount_ID: 'B1', Opening_Balance: 999999 } as any],
    totalOutstanding: 4500.5,
  });

  assert.equal(summary.openingFundBalance, 100000);
  assert.equal(summary.totalFundReceived, 2500.25);
  assert.equal(summary.totalFundUtilized, 1000.1);
  assert.equal(summary.availableFund, 101500.15);
  assert.equal(summary.outstandingCollection, 4500.5);
});

test('computeMaintenanceCollectionRate includes only issued Maintenance invoices in billing period with Bill Wise Details', () => {
  const result = computeMaintenanceCollectionRate({
    invoices: [
      {
        InvoiceID: 'M1',
        Invoice_Number: 'INV-M1',
        Purpose: 'Monthly Maintenance',
        Billing_Date: '2026-04-01',
        Bill_Period_From: '2026-04-01',
        Bill_Period_To: '2026-04-30',
        Net_Charge_Amount: 4000,
        Invoice_Status: 'Unpaid',
      } as any,
      {
        InvoiceID: 'M2',
        Invoice_Number: 'INV-M2',
        Purpose: 'Quarterly Maintenance',
        Billing_Date: '2026-05-01',
        Bill_Period_From: '2026-05-01',
        Bill_Period_To: '2026-05-31',
        Net_Charge_Amount: 6000,
        Invoice_Status: 'Partially Paid',
      } as any,
      {
        InvoiceID: 'M-DRAFT',
        Purpose: 'Monthly Maintenance',
        Billing_Date: '2026-05-01',
        Bill_Period_From: '2026-05-01',
        Bill_Period_To: '2026-05-31',
        Net_Charge_Amount: 5000,
        Invoice_Status: 'Draft',
      } as any,
      {
        InvoiceID: 'M-CANCEL',
        Purpose: 'Monthly Maintenance',
        Billing_Date: '2026-05-01',
        Bill_Period_From: '2026-05-01',
        Bill_Period_To: '2026-05-31',
        Net_Charge_Amount: 5000,
        Invoice_Status: 'Cancelled',
      } as any,
      {
        InvoiceID: 'SF-1',
        Purpose: 'Sinking Fund',
        Billing_Date: '2026-05-01',
        Bill_Period_From: '2026-05-01',
        Bill_Period_To: '2026-05-31',
        Net_Charge_Amount: 10000,
        Invoice_Status: 'Paid',
      } as any,
      {
        InvoiceID: 'M-PREV-FY',
        Purpose: 'Monthly Maintenance',
        Billing_Date: '2026-03-01',
        Bill_Period_From: '2026-03-01',
        Bill_Period_To: '2026-03-31',
        Net_Charge_Amount: 3000,
        Invoice_Status: 'Paid',
      } as any,
    ],
    receipts: [
      { Transaction_ID: 'T1', Receipt_Status: 'Confirmed' } as any,
      { Transaction_ID: 'T2', Receipt_Status: 'Confirmed' } as any,
      { Transaction_ID: 'T3', Receipt_Status: 'Confirmed' } as any,
    ],
    billAllocations: [
      { Transaction_ID: 'T1', InvoiceID: 'M1', Allocated_Amount: 4000 } as any,
      { Transaction_ID: 'T2', InvoiceID: 'M2', Allocated_Amount: 1500 } as any,
      { Transaction_ID: 'T3', InvoiceID: 'SF-1', Allocated_Amount: 10000 } as any,
      { Transaction_ID: 'T3', InvoiceID: 'M-PREV-FY', Allocated_Amount: 3000 } as any,
    ],
    periodStart: '2026-04-01',
    periodEnd: '2027-03-31',
  });

  // Only M1 (4000) + M2 (6000) = 10000 billed; 4000 + 1500 = 5500 collected -> 55.0%
  assert.equal(result.maintenanceInvoiceCount, 2);
  assert.equal(result.maintenanceBilled, 10000);
  assert.equal(result.maintenanceCollected, 5500);
  assert.equal(result.maintenanceCollectionRate, '55.0');
});

test('computeDashboardInvoiceSummary computes Maintenance Status donut from Invoice_Register, Bill Wise Details, Fund Inflow & Rate Master', () => {
  const summary = computeDashboardInvoiceSummary({
    invoices: [
      { InvoiceID: 'm1', Invoice_Number: 'INV-M1', RateID: 'RATE-M', Purpose: '', Billing_Date: '2026-04-01', Bill_Period_From: '2026-04-01', Bill_Period_To: '2026-04-30', Due_Date: '2026-04-15', Net_Charge_Amount: 2000, Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'M2', Invoice_Number: 'INV-M2', Purpose: 'Monthly Maintenance', Billing_Date: '2026-04-01', Bill_Period_From: '2026-04-01', Bill_Period_To: '2026-04-30', Due_Date: '2026-05-20', Net_Charge_Amount: 2000, Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'M3', Invoice_Number: 'INV-M3', Purpose: 'Monthly Maintenance', Billing_Date: '2026-05-01', Bill_Period_From: '2026-05-01', Bill_Period_To: '2026-05-31', Due_Date: '2026-05-25', Net_Charge_Amount: 2000, Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'M4', Invoice_Number: 'INV-M4', Purpose: 'Monthly Maintenance', Billing_Date: '2026-04-01', Bill_Period_From: '2026-04-01', Bill_Period_To: '2026-04-30', Due_Date: '2026-04-10', Net_Charge_Amount: 2000, Invoice_Status: 'Unpaid' } as any,
      { InvoiceID: 'SF1', Invoice_Number: 'INV-SF1', Purpose: 'Sinking Fund', Billing_Date: '2026-04-01', Bill_Period_From: '2026-04-01', Bill_Period_To: '2026-04-30', Due_Date: '2026-04-10', Net_Charge_Amount: 8000, Invoice_Status: 'Unpaid' } as any,
    ],
    rates: [
      { RateID: 'rate-m', Purpose: 'Quarterly Maintenance' } as any,
    ],
    receipts: [
      { Transaction_ID: 'txn-1', Receipt_Status: 'Confirmed' } as any,
      { Transaction_ID: 'TXN-2', Receipt_Status: 'Confirmed' } as any,
    ],
    billAllocations: [
      { Transaction_ID: 'TXN-1', InvoiceID: 'M1', Allocated_Amount: 2000 } as any,
      { Transaction_ID: 'txn-2', InvoiceID: '', Invoice_Number: 'inv-m2', Allocated_Amount: 500 } as any,
    ],
    periodStart: '2026-04-01',
    periodEnd: '2027-03-31',
    now: new Date('2026-05-01T00:00:00'),
  });

  assert.equal(summary.maintenanceInvoiceCount, 4);
  assert.equal(summary.maintenancePaidCount, 1);
  assert.equal(summary.maintenancePartialCount, 1);
  assert.equal(summary.maintenanceUnpaidCount, 1);
  assert.equal(summary.maintenanceOverdueCount, 1);
  assert.equal(summary.maintenanceBilled, 8000);
  assert.equal(summary.maintenanceCollected, 2500);
  assert.equal(summary.maintenanceOutstanding, 5500);
  assert.equal(summary.maintenanceCollectionRate, '31.3');
  const maintArc = summary.maintenanceDonutSegments.reduce((s, seg) => s + seg.length, 0);
  assert.ok(Math.abs(maintArc - DASHBOARD_DONUT_CIRCUMFERENCE) < 1e-6);
});

test('Total Outstanding Collection computes Invoice_Register minus Bill Wise Details across all years (not restricted to FY)', () => {
  const fyRange = resolveDashboardFY({
    todayKey: '2026-05-15',
    financialYears: [
      { FY_ID: 'FY26', FY_Name: 'FY 2026-2027', Start_Date: '2026-04-01', End_Date: '2027-03-31', Is_Current: true } as any,
    ],
  });
  const invoices = [
    { InvoiceID: 'I-FY1', Invoice_Number: 'INV-1', Billing_Date: '2026-04-05', Net_Charge_Amount: 5000, Invoice_Status: 'Unpaid' } as any,
    { InvoiceID: 'I-FY2', Invoice_Number: 'INV-2', Billing_Date: '2026-05-01', Net_Charge_Amount: 3000, Invoice_Status: 'Unpaid' } as any,
    { InvoiceID: 'I-PREV', Invoice_Number: 'INV-0', Billing_Date: '2026-03-15', Net_Charge_Amount: 9000, Invoice_Status: 'Unpaid' } as any,
  ];
  const receipts = [
    { Transaction_ID: 'T-FY1', Receipt_Status: 'Confirmed', Date_Of_Received: '2026-04-10', Received_Amount: 2000 } as any,
  ];
  const billAllocations = [
    { Transaction_ID: 'T-FY1', InvoiceID: 'I-FY1', Allocated_Amount: 2000 } as any,
    { Transaction_ID: '', InvoiceID: 'I-FY2', Allocated_Amount: 500 } as any,
  ];

  const invSummary = computeDashboardInvoiceSummary({
    invoices,
    receipts,
    billAllocations,
    periodStart: fyRange.startDate,
    periodEnd: fyRange.endDate,
  });
  assert.equal(invSummary.totalBilled, 17000);
  assert.equal(invSummary.totalCollected, 2500);
  assert.equal(invSummary.totalOutstanding, 14500);

  const directTotal = computeTotalOutstandingCollection({
    invoices,
    receipts,
    billAllocations: [
      ...billAllocations,
      // Allocation entry in Bill Wise Details whose InvoiceID isn't matched still reduces sheet total
      { Transaction_ID: '', InvoiceID: 'UNMATCHED-ID', Allocated_Amount: 500 } as any,
    ],
  });
  assert.equal(directTotal.totalInvoiceRegister, 17000);
  assert.equal(directTotal.totalBillWiseDetails, 3000);
  assert.equal(directTotal.outstandingCollection, 14000);

  const fundSummary = computeDashboardFundSummary({
    fyRange,
    receipts,
    expenses: [],
    invoices,
    billAllocations,
    bankAccounts: [],
  });
  assert.equal(fundSummary.outstandingCollection, 14500);
});
