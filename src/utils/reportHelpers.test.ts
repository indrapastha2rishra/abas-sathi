import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOwnerOutstandingRows,
  computeOwnershipOutstandingClient,
  computePropertyOutstandingRows,
  resolveFYRangeForMonth,
  resolveReportKey,
  tabForReportKey,
  toReportAmount,
  toReportDateKey,
} from './reportHelpers';

test('resolveReportKey and tabForReportKey map all sidebar and internal report tabs', () => {
  const pairs: Array<[string, ReturnType<typeof resolveReportKey>]> = [
    ['reports_monthly', 'monthly'],
    ['reports_fy', 'fy'],
    ['reports_expense_summary', 'expense_summary'],
    ['reports_property_due', 'property_due'],
    ['reports_owner_due', 'owner_due'],
    ['reports_ownership_due', 'ownership_due'],
    ['reports_balancesheet', 'balancesheet'],
    ['reports_year_end', 'year_end'],
  ];
  for (const [tab, key] of pairs) {
    assert.equal(resolveReportKey(tab), key);
    assert.equal(tabForReportKey(key), tab);
  }
  assert.equal(resolveReportKey('unknown'), 'monthly');
});

test('toReportDateKey normalizes date strings and ISO timestamps accurately', () => {
  assert.equal(toReportDateKey('2026-05-01'), '2026-05-01');
  assert.equal(toReportDateKey('01-05-2026'), '2026-05-01');
  assert.equal(toReportDateKey('2026/05/01'), '2026-05-01');
  assert.equal(toReportDateKey(''), '');
  assert.equal(toReportAmount('₹1,250.50'), 1250.5);
  assert.equal(toReportAmount(undefined), 0);
});

test('computePropertyOutstandingRows uses confirmed receipts + bill allocations and ownership fallback', () => {
  const rows = computePropertyOutstandingRows({
    properties: [
      { PropertyID: 'P1', Flat_No: 'A-101', Block_Tower: 'A' } as any,
      { PropertyID: 'P2', Flat_No: 'A-102', Block_Tower: 'A' } as any,
    ],
    owners: [
      { OwnerID: 'O1', Owner_Name: 'Anirban Sen' } as any,
      { OwnerID: 'O2', Owner_Name: 'Riya Das' } as any,
    ],
    ownerships: [
      { Ownership_ID: 'OSH-1', PropertyID: 'P1', OwnerID: 'O1', Ownership_Status: 'Current' } as any,
      { Ownership_ID: 'OSH-2', PropertyID: 'P2', OwnerID: 'O2', Ownership_Status: 'Current' } as any,
    ],
    invoices: [
      {
        InvoiceID: 'INV-1',
        PropertyID: 'P1',
        Ownership_ID: 'OSH-1',
        OwnerID: 'O1',
        Owner_Name: '',
        Net_Charge_Amount: 3000,
        Paid_Amount: 0,
        Outstanding_Amount: 3000,
        Invoice_Status: 'Unpaid',
      } as any,
      {
        InvoiceID: 'INV-2',
        PropertyID: 'P2',
        Ownership_ID: 'OSH-2',
        OwnerID: 'O2',
        Owner_Name: 'Riya Das',
        Net_Charge_Amount: 2500,
        Paid_Amount: 2500,
        Outstanding_Amount: 0,
        Invoice_Status: 'Paid',
      } as any,
    ],
    receipts: [{ Transaction_ID: 'TXN-1', Receipt_Status: 'Confirmed' } as any],
    billAllocations: [{ Transaction_ID: 'TXN-1', InvoiceID: 'INV-1', Allocated_Amount: 1000 } as any],
  });

  const p1 = rows.find((r) => r.propertyId === 'P1')!;
  const p2 = rows.find((r) => r.propertyId === 'P2')!;
  assert.equal(p1.ownerName, 'Anirban Sen');
  assert.equal(p1.totalPaid, 1000);
  assert.equal(p1.totalDue, 2000);
  assert.equal(p1.status, 'Pending');
  assert.equal(p2.totalDue, 0);
  assert.equal(p2.status, 'Clear');
});

test('computeOwnerOutstandingRows and computeOwnershipOutstandingClient aggregate properly', () => {
  const invoices = [
    {
      InvoiceID: 'I1',
      PropertyID: 'P1',
      Ownership_ID: 'OSH-1',
      OwnerID: 'O1',
      Owner_Name: 'Owner One',
      Flat_Number: '101',
      Net_Charge_Amount: 2000,
      Paid_Amount: 500,
      Outstanding_Amount: 1500,
      Invoice_Status: 'Partially Paid',
    } as any,
    {
      InvoiceID: 'I2',
      PropertyID: 'P2',
      Ownership_ID: '',
      OwnerID: 'O1',
      Owner_Name: 'Owner One',
      Flat_Number: '102',
      Net_Charge_Amount: 1000,
      Paid_Amount: 0,
      Outstanding_Amount: 1000,
      Invoice_Status: 'Unpaid',
    } as any,
  ];
  const ownerRows = computeOwnerOutstandingRows({
    invoices,
    receipts: [],
    billAllocations: [],
    owners: [{ OwnerID: 'O1', Owner_Name: 'Owner One' } as any],
    properties: [],
  });
  assert.equal(ownerRows.length, 1);
  assert.equal(ownerRows[0].Property_Count, 2);
  assert.equal(ownerRows[0].Outstanding, 2500);

  const ownershipRes = computeOwnershipOutstandingClient({
    invoices,
    receipts: [],
    billAllocations: [],
    ownerships: [{ Ownership_ID: 'OSH-1', Ownership_Status: 'Current', Ownership_Start_Date: '2025-04-01' } as any],
    properties: [],
    owners: [],
  });
  assert.equal(ownershipRes.summary.ownershipCount, 2);
  assert.equal(ownershipRes.summary.unlinkedInvoiceCount, 1);
  assert.equal(ownershipRes.summary.totalOutstanding, 2500);
});

test('resolveFYRangeForMonth matches Financial Year Master or Indian FY fallback', () => {
  const fy = resolveFYRangeForMonth('2026-05', [
    { FY_ID: 'FY26', FY_Name: 'FY 2026-2027', Start_Date: '2026-04-01', End_Date: '2027-03-31' } as any,
  ]);
  assert.equal(fy.fyId, 'FY26');
  assert.equal(fy.startDate, '2026-04-01');
  assert.equal(fy.endDate, '2027-03-31');

  const fallback = resolveFYRangeForMonth('2025-02', []);
  assert.equal(fallback.fyName, 'FY 2024-2025');
  assert.equal(fallback.startDate, '2024-04-01');
  assert.equal(fallback.endDate, '2025-03-31');
});
