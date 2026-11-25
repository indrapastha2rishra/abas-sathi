import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOwnerOutstandingRows,
  computeOwnershipOutstandingClient,
  computePropertyOutstandingRows,
  groupOwnershipOutstandingByFloor,
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

test('computeOwnershipOutstandingClient links Paid to Confirmed Fund Inflow Register and Bill Wise Details', () => {
  const res = computeOwnershipOutstandingClient({
    invoices: [
      {
        InvoiceID: 'I1',
        Invoice_Number: 'INV-101',
        PropertyID: 'P1',
        Ownership_ID: 'OSH-1',
        OwnerID: 'O1',
        Owner_Name: 'Owner One',
        Flat_Number: '101',
        Net_Charge_Amount: 3700,
        Paid_Amount: 0,
        Outstanding_Amount: 3700,
        Invoice_Status: 'Unpaid',
      } as any,
      {
        InvoiceID: 'I2',
        Invoice_Number: 'INV-102',
        PropertyID: 'P1',
        Ownership_ID: 'OSH-1',
        OwnerID: 'O1',
        Owner_Name: 'Owner One',
        Flat_Number: '101',
        Net_Charge_Amount: 3700,
        Paid_Amount: 0,
        Outstanding_Amount: 3700,
        Invoice_Status: 'Unpaid',
      } as any,
    ],
    receipts: [
      { Transaction_ID: 'TXN-1', Receipt_Status: 'Confirmed', Received_Amount: 3700 } as any,
      { Transaction_ID: 'TXN-2', Receipt_Status: 'Pending Verification', Received_Amount: 1500 } as any,
    ],
    billAllocations: [
      { Allocation_ID: 'ALL-1', Transaction_ID: 'TXN-1', InvoiceID: 'I1', Allocated_Amount: 3700 } as any,
      { Allocation_ID: 'ALL-2', Transaction_ID: 'TXN-2', InvoiceID: 'I2', Allocated_Amount: 1500 } as any,
    ],
    ownerships: [{ Ownership_ID: 'OSH-1', Ownership_Status: 'Current', Ownership_Start_Date: '2025-04-01' } as any],
    properties: [],
    owners: [],
  });
  assert.equal(res.data.length, 1);
  assert.equal(res.data[0].Total_Billed, 7400);
  assert.equal(res.data[0].Total_Paid, 3700);
  assert.equal(res.data[0].Outstanding, 3700);
  assert.equal(res.summary.totalOutstanding, 3700);
});

test('computeOwnershipOutstandingClient sums Allocated_Amount from Bill Wise Details grouped by Ownership_ID and groups by Floor_No', () => {
  const res = computeOwnershipOutstandingClient({
    invoices: [
      {
        InvoiceID: 'INV-1',
        Invoice_Number: 'INV-001',
        PropertyID: 'P-G1',
        Ownership_ID: 'OSH-G1',
        OwnerID: 'O1',
        Owner_Name: 'Ground Owner',
        Flat_Number: 'G-01',
        Net_Charge_Amount: 3000,
        Paid_Amount: 0,
        Outstanding_Amount: 3000,
        Invoice_Status: 'Unpaid',
      } as any,
      {
        InvoiceID: 'INV-2',
        Invoice_Number: 'INV-002',
        PropertyID: 'P-201',
        Ownership_ID: 'OSH-201',
        OwnerID: 'O2',
        Owner_Name: 'Second Floor Owner',
        Flat_Number: '201',
        Net_Charge_Amount: 5000,
        Paid_Amount: 0,
        Outstanding_Amount: 5000,
        Invoice_Status: 'Unpaid',
      } as any,
      {
        InvoiceID: 'INV-3',
        Invoice_Number: 'INV-003',
        PropertyID: 'P-101',
        Ownership_ID: 'OSH-101',
        OwnerID: 'O3',
        Owner_Name: 'First Floor Owner',
        Flat_Number: '101',
        Net_Charge_Amount: 4000,
        Paid_Amount: 0,
        Outstanding_Amount: 4000,
        Invoice_Status: 'Unpaid',
      } as any,
    ],
    receipts: [
      { Transaction_ID: 'TXN-A', Receipt_Status: 'Confirmed' } as any,
      { Transaction_ID: 'TXN-B', Receipt_Status: 'Confirmed' } as any,
      { Transaction_ID: 'TXN-PEND', Receipt_Status: 'Pending Verification' } as any,
    ],
    billAllocations: [
      // Multiple allocations for OSH-201 including one without InvoiceID (grouped strictly by Ownership_ID)
      { Allocation_ID: 'A1', Transaction_ID: 'TXN-A', InvoiceID: 'INV-2', Ownership_ID: 'OSH-201', Allocated_Amount: 1500 } as any,
      { Allocation_ID: 'A2', Transaction_ID: 'TXN-B', InvoiceID: '', Ownership_ID: 'OSH-201', Allocated_Amount: 1000 } as any,
      { Allocation_ID: 'A3', Transaction_ID: 'TXN-PEND', InvoiceID: 'INV-2', Ownership_ID: 'OSH-201', Allocated_Amount: 900 } as any,
      // Allocation for OSH-101 without Transaction_ID in receipts (direct Bill Wise Details entry)
      { Allocation_ID: 'A4', Transaction_ID: '', InvoiceID: 'INV-3', Ownership_ID: 'OSH-101', Allocated_Amount: 1200 } as any,
    ],
    ownerships: [
      { Ownership_ID: 'OSH-G1', PropertyID: 'P-G1', OwnerID: 'O1', Ownership_Status: 'Current' } as any,
      { Ownership_ID: 'OSH-201', PropertyID: 'P-201', OwnerID: 'O2', Ownership_Status: 'Current' } as any,
      { Ownership_ID: 'OSH-101', PropertyID: 'P-101', OwnerID: 'O3', Ownership_Status: 'Current' } as any,
    ],
    properties: [
      { PropertyID: 'P-G1', Flat_No: 'G-01', Floor_No: 0 } as any,
      { PropertyID: 'P-101', Flat_No: '101', Floor_No: 1 } as any,
      { PropertyID: 'P-201', Flat_No: '201', Floor_No: 2 } as any,
    ],
    owners: [],
  });

  assert.equal(res.data.length, 3);
  const g1 = res.data.find((r: any) => r.Ownership_ID === 'OSH-G1')!;
  const f1 = res.data.find((r: any) => r.Ownership_ID === 'OSH-101')!;
  const f2 = res.data.find((r: any) => r.Ownership_ID === 'OSH-201')!;
  assert.equal(g1.Floor_No, 0);
  assert.equal(g1.Total_Paid, 0);
  assert.equal(g1.Outstanding, 3000);
  assert.equal(f1.Total_Paid, 1200);
  assert.equal(f1.Outstanding, 2800);
  assert.equal(f2.Total_Paid, 2500); // 1500 + 1000, pending 900 excluded
  assert.equal(f2.Outstanding, 2500);

  const floorGroups = groupOwnershipOutstandingByFloor(res.data);
  assert.equal(floorGroups.length, 3);
  assert.deepEqual(
    floorGroups.map((g) => g.floorLabel),
    ['Floor 0', 'Floor 1', 'Floor 2']
  );
  assert.equal(floorGroups[0].totalOutstanding, 3000);
  assert.equal(floorGroups[1].totalOutstanding, 2800);
  assert.equal(floorGroups[2].totalOutstanding, 2500);
});

