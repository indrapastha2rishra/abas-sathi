const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const context = { console, Date, Math, JSON, String, Number, Array, Object, isFinite, parseInt };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps_script/Code.gs'), 'utf8'), context);

const sheet = (values) => ({ getDataRange: () => ({ getValues: () => values }) });
function fakeSpreadsheet() {
  const sheets = {
    'Bank Account Master': sheet([
      ['BankAccount_ID','Bank_Name','Account_Name','Account_Number','Opening_Balance','Status'],
      ['B1','SBI','Society Current','1234',20000,'Active'],
    ]),
    'Fund Inflow Register': sheet([
      ['Receipt_Status','Date_Of_Received','Received_Mode','Bank_Account','Received_Amount'],
      ['Confirmed','2026-04-10','UPI','B1',3000],
      ['Confirmed','2026-04-11','Cash','B1',500],
      ['Pending Verification','2026-04-11','Cash','',10000],
    ]),
    'Expense Register': sheet([
      ['Expense_Status','Payment_Date','Payment_Mode','Bank_Account','Payment_Amount'],
      ['Paid','2026-04-12','NEFT','B1',1000],
      ['Paid','2026-04-12','Cash','B1',200],
      ['Approved','2026-04-13','Cash','',999],
    ]),
  };
  return { getSheetByName: (name) => sheets[name] || null };
}

test('year-end closing calculates Cash and Bank separately and counts only Confirmed/Paid records', () => {
  const rows = context.fundRowsForYear_(fakeSpreadsheet(), {
    FY_ID:'FY26', FY_Name:'FY 2026-27', Start_Date:'2026-04-01', End_Date:'2027-03-31'
  }, [], 1000);
  const cash = rows.find((row) => row.Balance_Type === 'Cash');
  const bank = rows.find((row) => row.Balance_Type === 'Bank');
  assert.equal(cash.Opening_Balance, 1000);
  assert.equal(cash.Total_Fund_Received, 500);
  assert.equal(cash.Total_Fund_Utilized, 200);
  assert.equal(cash.Closing_Balance, 1300);
  assert.equal(bank.Opening_Balance, 20000);
  assert.equal(bank.Total_Fund_Received, 3000);
  assert.equal(bank.Total_Fund_Utilized, 1000);
  assert.equal(bank.Closing_Balance, 22000);
});

test('next FY opening uses previous finalized closing, not Bank Account Master opening again', () => {
  const previous = [
    { Balance_Type:'Cash', Bank_Account_ID:'', Closing_Balance:1300 },
    { Balance_Type:'Bank', Bank_Account_ID:'B1', Closing_Balance:22000 },
  ];
  const rows = context.fundRowsForYear_(fakeSpreadsheet(), {
    FY_ID:'FY27', FY_Name:'FY 2027-28', Start_Date:'2027-04-01', End_Date:'2028-03-31'
  }, previous, 999999);
  assert.equal(rows.find((row) => row.Balance_Type === 'Cash').Opening_Balance, 1300);
  assert.equal(rows.find((row) => row.Balance_Type === 'Bank').Opening_Balance, 22000);
});
