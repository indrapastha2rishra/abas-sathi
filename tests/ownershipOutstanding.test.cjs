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
