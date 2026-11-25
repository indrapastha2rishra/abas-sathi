import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResidentStatementLedger,
  filterResidentNotices,
  filterResidentScopedRecords,
  isResidentVisibleGallery,
  sortResidentInvoicesNewestFirst,
  sortResidentReceiptsNewestFirst,
  summarizeResidentPortalData,
  toResidentStatementCsv,
} from './residentPortalHelpers';

test('filterResidentScopedRecords strictly isolates by PropertyID and Ownership_ID', () => {
  const rows = [
    { PropertyID: 'P-101', Ownership_ID: 'OWN-1', Requested_By: 'U1' },
    { PropertyID: 'p-101 ', Ownership_ID: 'own-2', Requested_By: 'U2' },
    { PropertyID: 'P-101', Ownership_ID: '', Requested_By: 'U1' },
    { PropertyID: 'P-102', Ownership_ID: 'OWN-1', Requested_By: 'U1' },
  ];
  const strictFinancial = filterResidentScopedRecords(rows, 'P-101', 'OWN-1');
  assert.equal(strictFinancial.length, 1);
  assert.equal(strictFinancial[0].Ownership_ID, 'OWN-1');

  const tickets = filterResidentScopedRecords(rows, 'P-101', 'OWN-1', {
    allowBlankOwnership: true,
    requestedByUserId: 'U1',
  });
  assert.equal(tickets.length, 2);
});

test('filterResidentNotices enforces status, date window, and Resident visibility', () => {
  const notices: any[] = [
    { Notice_ID: 'N1', Notice_Title: 'AGM', Visibility: 'All', Notice_Status: 'Published', Publish_Date: '2026-04-01', Expiry_Date: '2026-12-31' },
    { Notice_ID: 'N2', Notice_Title: 'Owners Circular', Visibility: 'Owners Only', Notice_Status: 'Active', Publish_Date: '2026-04-02', Expiry_Date: '' },
    { Notice_ID: 'N3', Notice_Title: 'Board Minutes', Visibility: 'Committee Only', Notice_Status: 'Published', Publish_Date: '2026-04-03', Expiry_Date: '' },
    { Notice_ID: 'N4', Notice_Title: 'Tenant Rules', Visibility: 'Tenants Only', Notice_Status: 'Published', Publish_Date: '2026-04-04', Expiry_Date: '' },
    { Notice_ID: 'N5', Notice_Title: 'Old Notice', Visibility: 'All', Notice_Status: 'Published', Publish_Date: '2026-01-01', Expiry_Date: '2026-02-01' },
  ];
  const ownerVisible = filterResidentNotices(notices, '2026-05-01', { isOwner: true, isTenant: false });
  assert.deepEqual(ownerVisible.map((n) => n.Notice_ID), ['N2', 'N1']);

  const tenantVisible = filterResidentNotices(notices, '2026-05-01', { isOwner: false, isTenant: true });
  assert.deepEqual(tenantVisible.map((n) => n.Notice_ID), ['N4', 'N1']);

  assert.equal(isResidentVisibleGallery({ Visibility: 'Residents Only' }), true);
  assert.equal(isResidentVisibleGallery({ Visibility: 'Committee' }), false);
});

test('sorting puts newest invoices and receipts first', () => {
  const sortedInv = sortResidentInvoicesNewestFirst([
    { InvoiceID: '1', Invoice_Number: 'INV-1', Billing_Date: '2026-03-01' },
    { InvoiceID: '2', Invoice_Number: 'INV-2', Billing_Date: '2026-05-01' },
    { InvoiceID: '3', Invoice_Number: 'INV-3', Billing_Date: '2026-04-01' },
  ] as any);
  assert.deepEqual(sortedInv.map((i) => i.InvoiceID), ['2', '3', '1']);

  const sortedRec = sortResidentReceiptsNewestFirst([
    { Transaction_ID: 'T1', Date_Of_Received: '2026-03-10' },
    { Transaction_ID: 'T2', Date_Of_Received: '2026-05-12' },
  ] as any);
  assert.deepEqual(sortedRec.map((r) => r.Transaction_ID), ['T2', 'T1']);
});

test('summarizeResidentPortalData computes confirmed dues, advance credits, next due date, utilities & tenants', () => {
  const summary = summarizeResidentPortalData({
    property: { PropertyID: 'P-101', Flat_No: 'A-101', Block_Tower: 'Tower A', Floor_No: 1 } as any,
    ownershipId: 'OWN-1',
    userId: 'U-RES-1',
    now: new Date('2026-05-15T10:00:00Z'),
    invoices: [
      { InvoiceID: 'I1', Invoice_Number: 'INV-01', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Billing_Date: '2026-04-01', Due_Date: '2026-04-15', Net_Charge_Amount: 2000, Invoice_Status: 'Unpaid' },
      { InvoiceID: 'I2', Invoice_Number: 'INV-02', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Billing_Date: '2026-05-01', Due_Date: '2026-05-25', Net_Charge_Amount: 2000, Invoice_Status: 'Unpaid' },
      { InvoiceID: 'I3', Invoice_Number: 'INV-OLD', PropertyID: 'P-101', Ownership_ID: 'OWN-OLD', Billing_Date: '2026-01-01', Due_Date: '2026-01-15', Net_Charge_Amount: 5000, Invoice_Status: 'Unpaid' },
    ] as any,
    receipts: [
      { Transaction_ID: 'T1', Receipt_Number: 'RCT-1', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Date_Of_Received: '2026-04-10', Received_Amount: 2500, Unallocated_Amount: 500, Receipt_Status: 'Confirmed' },
      { Transaction_ID: 'T2', Receipt_Number: '', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Date_Of_Received: '2026-05-10', Received_Amount: 1000, Unallocated_Amount: 1000, Receipt_Status: 'Pending Verification' },
    ] as any,
    billAllocations: [
      { Allocation_ID: 'A1', Transaction_ID: 'T1', InvoiceID: 'I1', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Allocated_Amount: 2000 },
      { Allocation_ID: 'A2', Transaction_ID: 'T2', InvoiceID: 'I2', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Allocated_Amount: 1000 },
    ] as any,
    activityRequests: [
      { Request_ID: 'R1', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Request_Date: '2026-05-02', Request_Status: 'Pending' },
      { Request_ID: 'R2', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Request_Date: '2026-04-02', Request_Status: 'Completed' },
    ] as any,
    ownerships: [{ Ownership_ID: 'OWN-1', PropertyID: 'P-101', OwnerID: 'OW-1', Ownership_Status: 'Current' }] as any,
    owners: [{ OwnerID: 'OW-1', Owner_Name: 'Anirban Sen' }] as any,
    tenants: [{ Tenant_ID: 'TEN-1', PropertyID: 'P-101', Ownership_ID: 'OWN-1', Tenant_Name: 'Rohan', Status: 'Active' }] as any,
    propertyUtilities: [{ Utility_ID: 'UT-1', PropertyID: 'P-101', Utility_Type: 'WBSEDCL Electricity', Meter_No: 'M-999', Status: 'Active' }] as any,
    notices: [{ Notice_ID: 'N1', Notice_Title: 'Notice 1', Visibility: 'All', Notice_Status: 'Published', Publish_Date: '2026-05-01' }] as any,
    gallery: [{ Gallery_ID: 'G1', Event_Name: 'Pohela Boishakh', Event_Date: '2026-04-15', Visibility: 'Public', Status: 'Active', Photo_File_Reference: 'https://example.com/p.jpg' }] as any,
    galleryPhotos: [],
  });

  // Unconfirmed T2 allocation must NOT reduce outstanding dues
  assert.equal(summary.totalBilled, 4000);
  assert.equal(summary.totalPaidAgainstBills, 2000);
  assert.equal(summary.totalOutstanding, 2000);
  assert.equal(summary.nextDueDate, '2026-05-25');
  assert.equal(summary.confirmedReceivedTotal, 2500);
  assert.equal(summary.advanceCreditTotal, 500);
  assert.equal(summary.pendingVerificationCount, 1);
  assert.equal(summary.pendingVerificationAmount, 1000);
  assert.equal(summary.currentOwner?.Owner_Name, 'Anirban Sen');
  assert.equal(summary.activeTenants.length, 1);
  assert.equal(summary.activeUtilities.length, 1);
  assert.equal(summary.activeNotices.length, 1);
  assert.equal(summary.activeGalleryEvents.length, 1);
});

test('buildResidentStatementLedger and toResidentStatementCsv neutralize formula injection', () => {
  const ledger = buildResidentStatementLedger(
    [{ InvoiceID: 'I1', Invoice_Number: 'INV-01', Billing_Date: '2026-04-01', Purpose: '=CMD|calc', Net_Charge_Amount: 1500, Invoice_Status: 'Unpaid' }] as any,
    [{ Transaction_ID: 'T1', Receipt_Number: 'RCT-1', Date_Of_Received: '2026-04-10', Received_Mode: 'UPI', Received_Amount: 1000, Receipt_Status: 'Confirmed' }] as any
  );
  assert.equal(ledger.rows.length, 2);
  assert.equal(ledger.closingBalance, 500);
  const csv = toResidentStatementCsv(ledger.rows);
  assert.match(csv, /"'=CMD\|calc"/);
});
