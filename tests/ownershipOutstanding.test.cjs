const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps_script', 'Code.gs'), 'utf8');
const context = {};
vm.runInNewContext(source, context, { timeout: 5000 });
const build = vm.runInContext('buildOwnershipOutstandingRows_', context);

test('ownership outstanding keeps liability separated by Ownership_ID for a transferred flat', () => {
  const invoices = [
    { InvoiceID:'I1', Ownership_ID:'OWN-OLD', PropertyID:'P1', OwnerID:'O1', Owner_Name:'Old Owner', Flat_Number:'A-101', Net_Charge_Amount:1000, Paid_Amount:400, Outstanding_Amount:600, Invoice_Status:'Unpaid' },
    { InvoiceID:'I2', Ownership_ID:'OWN-NEW', PropertyID:'P1', OwnerID:'O2', Owner_Name:'New Owner', Flat_Number:'A-101', Net_Charge_Amount:500, Paid_Amount:100, Outstanding_Amount:400, Invoice_Status:'Partially Paid' }
  ];
  const history = [
    { Ownership_ID:'OWN-OLD', PropertyID:'P1', OwnerID:'O1', Ownership_Start_Date:'2024-01-01', Ownership_End_Date:'2025-06-30', Ownership_Status:'Previous' },
    { Ownership_ID:'OWN-NEW', PropertyID:'P1', OwnerID:'O2', Ownership_Start_Date:'2025-07-01', Ownership_End_Date:'', Ownership_Status:'Current' }
  ];
  const result = build(invoices, history, [{PropertyID:'P1',Flat_No:'A-101'}], [
    {OwnerID:'O1',Owner_Name:'Old Owner'}, {OwnerID:'O2',Owner_Name:'New Owner'}
  ]);
  assert.equal(result.data.length, 2);
  assert.equal(result.data.find(x => x.Ownership_ID === 'OWN-OLD').Outstanding, 600);
  assert.equal(result.data.find(x => x.Ownership_ID === 'OWN-NEW').Outstanding, 400);
  assert.equal(result.summary.totalOutstanding, 1000);
});

test('ownership outstanding excludes cancelled and settled invoices and reports unlinked legacy rows', () => {
  const invoices = [
    {InvoiceID:'I1',Ownership_ID:'OWN-1',PropertyID:'P1',OwnerID:'O1',Net_Charge_Amount:100, Paid_Amount:100, Outstanding_Amount:0, Invoice_Status:'Paid'},
    {InvoiceID:'I2',Ownership_ID:'OWN-2',PropertyID:'P1',OwnerID:'O2',Net_Charge_Amount:500, Paid_Amount:0, Outstanding_Amount:500, Invoice_Status:'Cancelled'},
    {InvoiceID:'I3',Ownership_ID:'',PropertyID:'P2',OwnerID:'O3',Owner_Name:'Legacy Owner',Net_Charge_Amount:250, Paid_Amount:0, Outstanding_Amount:250, Invoice_Status:'Unpaid'}
  ];
  const result = build(invoices, [], [{PropertyID:'P2',Flat_No:'B-202'}], []);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].Ownership_ID, 'Not linked');
  assert.equal(result.data[0].Outstanding, 250);
  assert.equal(result.summary.unlinkedInvoiceCount, 1);
});

test('ownership outstanding derives Paid from Confirmed Fund Inflow Register receipts and Bill Wise Details allocations', () => {
  const invoices = [
    { InvoiceID:'I1', Invoice_Number:'INV-001', Ownership_ID:'OWN-1', PropertyID:'P1', OwnerID:'O1', Owner_Name:'Owner 1', Flat_Number:'101', Net_Charge_Amount:3700, Paid_Amount:0, Outstanding_Amount:3700, Invoice_Status:'Unpaid' },
    { InvoiceID:'I2', Invoice_Number:'INV-002', Ownership_ID:'OWN-1', PropertyID:'P1', OwnerID:'O1', Owner_Name:'Owner 1', Flat_Number:'101', Net_Charge_Amount:3700, Paid_Amount:0, Outstanding_Amount:3700, Invoice_Status:'Unpaid' },
    { InvoiceID:'I3', Invoice_Number:'INV-003', Ownership_ID:'OWN-2', PropertyID:'P2', OwnerID:'O2', Owner_Name:'Owner 2', Flat_Number:'102', Net_Charge_Amount:3000, Paid_Amount:0, Outstanding_Amount:3000, Invoice_Status:'Unpaid' },
  ];
  const history = [
    { Ownership_ID:'OWN-1', PropertyID:'P1', OwnerID:'O1', Ownership_Start_Date:'2025-04-01', Ownership_Status:'Current' },
    { Ownership_ID:'OWN-2', PropertyID:'P2', OwnerID:'O2', Ownership_Start_Date:'2025-04-01', Ownership_Status:'Current' },
  ];
  const receipts = [
    { Transaction_ID:'TXN-1', Ownership_ID:'OWN-1', Receipt_Status:'Confirmed', Received_Amount:3700 },
    { Transaction_ID:'TXN-2', Ownership_ID:'OWN-1', Receipt_Status:'Pending Verification', Received_Amount:1000 },
    { Transaction_ID:'TXN-3', Ownership_ID:'OWN-2', Receipt_Status:'Confirmed', Received_Amount:3000 },
  ];
  const billAllocations = [
    { Allocation_ID:'ALL-1', Transaction_ID:'TXN-1', InvoiceID:'I1', Ownership_ID:'OWN-1', Allocated_Amount:3700 },
    { Allocation_ID:'ALL-2', Transaction_ID:'TXN-2', InvoiceID:'I2', Ownership_ID:'OWN-1', Allocated_Amount:1000 },
    { Allocation_ID:'ALL-3', Transaction_ID:'TXN-3', InvoiceID:'', Invoice_Number:'INV-003', Ownership_ID:'OWN-2', Allocated_Amount:3000 },
  ];
  const result = build(invoices, history, [{PropertyID:'P1',Flat_No:'101'},{PropertyID:'P2',Flat_No:'102'}], [{OwnerID:'O1',Owner_Name:'Owner 1'},{OwnerID:'O2',Owner_Name:'Owner 2'}], receipts, billAllocations);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].Ownership_ID, 'OWN-1');
  assert.equal(result.data[0].Invoice_Count, 2);
  assert.equal(result.data[0].Total_Billed, 7400);
  assert.equal(result.data[0].Total_Paid, 3700);
  assert.equal(result.data[0].Outstanding, 3700);
  assert.equal(result.summary.totalOutstanding, 3700);
});

