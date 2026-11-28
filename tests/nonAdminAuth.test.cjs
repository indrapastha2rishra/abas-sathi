const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');

const codeSource = fs.readFileSync(path.join(__dirname, '..', 'apps_script', 'Code.gs'), 'utf8');

function makeSheet(name, rows, parent) {
  const data = rows.map(r => [...r]);
  const sheet = {
    getName: () => name,
    getParent: () => parent,
    getLastRow: () => data.length,
    getLastColumn: () => (data[0] ? data[0].length : 0),
    getDataRange: () => sheet.getRange(1, 1, Math.max(1, data.length), Math.max(1, sheet.getLastColumn())),
    appendRow: (row) => { data.push([...row]); },
    hideSheet: () => {},
    getRange: (startRow, startCol, numRows = 1, numCols = 1) => {
      const readBlock = () => {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const rowArr = data[startRow - 1 + r] || [];
          const slice = [];
          for (let c = 0; c < numCols; c++) {
            slice.push(rowArr[startCol - 1 + c] ?? '');
          }
          out.push(slice);
        }
        return out;
      };
      return {
        getValues: () => readBlock(),
        getDisplayValues: () => readBlock().map(r => r.map(v => (v instanceof Date ? v.toISOString() : String(v ?? '')))),
        setValue: (val) => {
          while (data.length < startRow) data.push([]);
          while (data[startRow - 1].length < startCol) data[startRow - 1].push('');
          data[startRow - 1][startCol - 1] = val;
        },
        setValues: (vals) => {
          for (let r = 0; r < vals.length; r++) {
            const targetRow = startRow - 1 + r;
            while (data.length <= targetRow) data.push([]);
            for (let c = 0; c < vals[r].length; c++) {
              const targetCol = startCol - 1 + c;
              while (data[targetRow].length < targetCol) data[targetRow].push('');
              data[targetRow][targetCol] = vals[r][c];
            }
          }
        },
        createTextFinder: (query) => {
          let matchCase = true;
          let entire = false;
          const finder = {
            matchCase: (b) => { matchCase = Boolean(b); return finder; },
            matchEntireCell: (b) => { entire = Boolean(b); return finder; },
            findAll: () => {
              const q = matchCase ? String(query) : String(query).toLowerCase();
              const hits = [];
              for (let r = 0; r < numRows; r++) {
                for (let c = 0; c < numCols; c++) {
                  const rowIdx = startRow + r;
                  const colIdx = startCol + c;
                  const raw = String((data[rowIdx - 1] && data[rowIdx - 1][colIdx - 1]) ?? '');
                  const hay = matchCase ? raw : raw.toLowerCase();
                  const ok = entire ? hay === q : hay.includes(q);
                  if (ok) hits.push({ getRow: () => rowIdx, getColumn: () => colIdx });
                }
              }
              return hits;
            },
          };
          return finder;
        },
      };
    },
    _data: data,
  };
  return sheet;
}

function makeSpreadsheet(id, sheetsByName) {
  const ss = {
    getId: () => id,
    getSheetByName: (name) => sheetsByName[name] || null,
    insertSheet: (name) => {
      const sh = makeSheet(name, [], ss);
      sheetsByName[name] = sh;
      return sh;
    },
  };
  Object.keys(sheetsByName).forEach((name) => {
    sheetsByName[name] = makeSheet(name, sheetsByName[name], ss);
  });
  return ss;
}

function createBackendHarness({ userRows, rolePermissionRows, ownershipRows }) {
  const cacheMap = new Map();
  const centralId = '1zcvrYRj1BtgcCo8Skfyf14RVQOTuoGclldWxUWYy470';
  const societyDbId = 'SOC-DB-1';

  const centralSheets = {
    'Society Master': [
      ['Society_Code', 'Society_Status', 'Database_ID', 'Society_Name', 'Society_Address'],
      ['SO001', 'Active', societyDbId, 'Indraprastha Apartments', 'Rishra'],
    ],
    'Society User Access': [
      ['Society_Code', 'Login_ID', 'UserID', 'Full_Name', 'Email_ID', 'Mobile_No', 'Role', 'PropertyID', 'Ownership_ID', 'OwnerID', 'Account_Status', 'Password_Salt', 'Password_Hash', 'Last_Login', 'KYC_Documents'],
      ...userRows,
    ],
  };

  const societySheets = {
    'Property Master': [
      ['PropertyID', 'Flat_No', 'Block_Tower', 'Floor_No', 'Occupancy_Status', 'Property_Status'],
      ['PROP-101', '101', 'A', 1, 'Self Occupied', 'Active'],
      ['PROP-102', '102', 'A', 1, 'Self Occupied', 'Active'],
    ],
    'Owner Master': [
      ['OwnerID', 'Owner_Name', 'Email_ID', 'Mobile_No'],
      ['OWNR-1', 'Rina Sen', 'rina@example.com', '9876543210'],
      ['OWNR-2', 'Amit Das', 'amit@example.com', '9876543211'],
    ],
    'Ownership History': [
      ['Ownership_ID', 'PropertyID', 'OwnerID', 'Ownership_Status', 'Ownership_Start_Date'],
      ...(ownershipRows || [
        ['OWN-101', 'PROP-101', 'OWNR-1', 'Current', '2025-04-01'],
        ['OWN-102', 'PROP-102', 'OWNR-2', 'Current', '2025-04-01'],
      ]),
    ],
    'Tenant Master': [['Tenant_ID', 'PropertyID', 'Status']],
    'Rate Master': [['RateID', 'Purpose', 'Area_Basis', 'Rate_Per_SqFt_Unit', 'Status']],
    'Invoice_Register': [
      ['InvoiceID', 'Invoice_Number', 'PropertyID', 'Ownership_ID', 'Net_Charge_Amount', 'Paid_Amount', 'Outstanding_Amount', 'Invoice_Status'],
      ['INV-1', 'INV-001', 'PROP-101', 'OWN-101', 2500, 0, 2500, 'Unpaid'],
      ['INV-2', 'INV-002', 'PROP-102', 'OWN-102', 3000, 0, 3000, 'Unpaid'],
    ],
    'Fund Inflow Register': [['Transaction_ID', 'PropertyID', 'Ownership_ID', 'Receipt_Status', 'Received_Amount']],
    'Bill Wise Details': [['Allocation_ID', 'Transaction_ID', 'InvoiceID', 'PropertyID', 'Ownership_ID', 'Allocated_Amount']],
    'Expense Register': [['Expense_ID', 'Expense_Status', 'Payment_Amount', 'Payment_Date']],
    'Bank Account Master': [['BankAccount_ID', 'Account_Name', 'Opening_Balance']],
    'Activity Request Register': [['Request_ID', 'PropertyID', 'Requested_By', 'Request_Status']],
    'Notice Master': [['Notice_ID', 'Notice_Title', 'Notice_Status', 'Visibility']],
    'Gallery Master': [['Gallery_ID', 'Event_Title', 'Status', 'Visibility']],
    'Gallery_Photos': [['Photo_ID', 'Gallery_ID', 'Status']],
    'Preventive Maintenance Master': [['Maintenance_ID', 'Maintenance_Status']],
    'Property Utility Details': [['Utility_ID', 'PropertyID']],
    'Financial Year Master': [['FY_ID', 'FY_Name', 'Start_Date', 'End_Date', 'Is_Current']],
    'Audit Log': [['Log_ID', 'UserID', 'Action_Type', 'Module_Name', 'Record_ID']],
    'Role_Permission': rolePermissionRows || [
      ['Permission_ID', 'Role', 'Module_Name', 'Can_View', 'Can_Create', 'Can_Edit', 'Can_Delete', 'Can_Approve', 'Remarks'],
    ],
  };

  const centralSs = makeSpreadsheet(centralId, centralSheets);
  const societySs = makeSpreadsheet(societyDbId, societySheets);
  const dbMap = { [centralId]: centralSs, [societyDbId]: societySs };

  const sandbox = {
    console,
    Logger: { log: () => {} },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '', setProperty: () => {} }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, tryLock: () => true, releaseLock: () => {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheMap.has(k) ? cacheMap.get(k) : null),
        put: (k, v) => { cacheMap.set(k, String(v)); },
        remove: (k) => { cacheMap.delete(k); },
      }),
    },
    SpreadsheetApp: {
      openById: (id) => {
        if (!dbMap[id]) throw new Error('Unknown spreadsheet: ' + id);
        return dbMap[id];
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (str) => ({
        setMimeType: () => ({ getContent: () => str }),
        getContent: () => str,
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_alg, val) => Array.from(crypto.createHash('sha256').update(String(val), 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: (d) => new Date(d).toISOString().slice(0, 10),
    },
  };

  vm.runInNewContext(codeSource, sandbox, { timeout: 5000 });
  const callPost = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  return { sandbox, callPost, centralSs, societySs };
}

test('Committee, Accountant, and Resident accounts can log in, load permissions, and fetch role dashboard data even with role casing/whitespace and partial Role_Permission sheet', () => {
  const harness = createBackendHarness({
    userRows: [],
    rolePermissionRows: [
      ['Permission_ID', 'Role', 'Module_Name', 'Can_View', 'Can_Create', 'Can_Edit', 'Can_Delete', 'Can_Approve', 'Remarks'],
      // Deliberately simulate an existing sheet that only has Admin rows configured (> 1 row)
      ['RP00001', 'Admin', 'Dashboard', true, true, true, true, true, 'Existing Admin row'],
    ],
  });

  const hashPassword = harness.sandbox.hashPassword_;
  const sha256 = harness.sandbox.sha256_;

  const adminSalt = 'salt-admin-01';
  const committeeSalt = 'salt-committee-01';
  const accountantSalt = 'salt-accountant-01';
  const residentSalt = 'salt-resident-01';

  const usersSheet = harness.centralSs.getSheetByName('Society User Access');
  // 1) Admin
  usersSheet.appendRow(['SO001', 'admin', 'USR-ADM1', 'Society Admin', 'admin@example.com', '9000000001', 'Admin', '', '', '', 'Active', adminSalt, hashPassword(adminSalt, 'AdminPass#2026A'), '', '[]']);
  // 2) Committee with whitespace in Login_ID & lowercase role, plus a Rejected duplicate row
  usersSheet.appendRow(['SO001', 'comm1', 'USR-OLD1', 'Old Rejected', 'oldcomm@example.com', '9000000002', 'Committee', '', '', '', 'Rejected', committeeSalt, hashPassword(committeeSalt, 'WrongPass#2026A'), '', '[]']);
  usersSheet.appendRow(['SO001', ' comm1 ', 'USR-COM1', 'Committee Member', 'comm@example.com', '9000000002', ' committee ', '', '', '', 'Active', committeeSalt, hashPassword(committeeSalt, 'CommPass#2026A'), '', '[]']);
  // 3) Accountant with legacy v5.1 SHA-256 hash and NO Last_Login column needed
  usersSheet.appendRow(['SO001', 'acct1', 'USR-ACC1', 'Society Accountant', 'acct@example.com', '9000000003', 'ACCOUNTANT', '', '', '', 'Active', accountantSalt, sha256(accountantSalt + 'AcctPass#2026A'), '', '[]']);
  // 4) Resident with blank UserID (manually added in sheet) and lowercase role
  usersSheet.appendRow(['SO001', 'res101', '', 'Rina Sen', 'rina@example.com', '9876543210', 'resident', 'PROP-101', 'OWN-101', 'OWNR-1', 'Active', residentSalt, hashPassword(residentSalt, 'ResPass#2026A'), '', '[]']);

  // Committee login -> getMyPermissions -> getRoleDashboardData -> getMyProfile
  const commLogin = harness.callPost({ action: 'login', societyCode: 'so001', loginId: 'COMM1', password: 'CommPass#2026A' });
  assert.equal(commLogin.status, 'success');
  assert.equal(commLogin.user.role, 'Committee');
  const commPerms = harness.callPost({ action: 'getMyPermissions', token: commLogin.token });
  assert.equal(commPerms.status, 'success');
  assert.ok(commPerms.data.some(r => r.Role === 'Committee' && r.Module_Name === 'Dashboard' && r.Can_View === true));
  const commDash = harness.callPost({ action: 'getRoleDashboardData', token: commLogin.token });
  assert.equal(commDash.status, 'success');
  assert.equal(commDash.data.invoices.length, 2);

  // Accountant login (with legacy SHA-256 upgrade) -> getMyPermissions -> getRoleDashboardData
  const acctLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'acct1', password: 'AcctPass#2026A' });
  assert.equal(acctLogin.status, 'success');
  assert.equal(acctLogin.user.role, 'Accountant');
  const acctPerms = harness.callPost({ action: 'getMyPermissions', token: acctLogin.token });
  assert.equal(acctPerms.status, 'success');
  assert.ok(acctPerms.data.some(r => r.Role === 'Accountant' && r.Module_Name === 'Dashboard' && r.Can_View === true));
  const acctDash = harness.callPost({ action: 'getRoleDashboardData', token: acctLogin.token });
  assert.equal(acctDash.status, 'success');
  // Legacy hash should have upgraded to KDF format
  assert.equal(acctLogin.user.userId, 'USR-ACC1');
  const acctLoginAgain = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'acct1', password: 'AcctPass#2026A' });
  assert.equal(acctLoginAgain.status, 'success');

  // Resident login (blank UserID auto-repaired + strictly scoped to PROP-101 / OWN-101)
  const resLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'res101', password: 'ResPass#2026A' });
  assert.equal(resLogin.status, 'success');
  assert.equal(resLogin.user.role, 'Resident');
  assert.ok(resLogin.user.userId.startsWith('USR-'));
  const resPerms = harness.callPost({ action: 'getMyPermissions', token: resLogin.token });
  assert.equal(resPerms.status, 'success');
  assert.ok(resPerms.data.some(r => r.Role === 'Resident' && r.Module_Name === 'Dashboard' && r.Can_View === true));
  const resDash = harness.callPost({ action: 'getRoleDashboardData', token: resLogin.token });
  assert.equal(resDash.status, 'success');
  assert.equal(resDash.data.properties.length, 1);
  assert.equal(resDash.data.properties[0].PropertyID, 'PROP-101');
  assert.equal(resDash.data.invoices.length, 1);
  assert.equal(resDash.data.invoices[0].InvoiceID, 'INV-1');
  const resProfile = harness.callPost({ action: 'getMyProfile', token: resLogin.token });
  assert.equal(resProfile.status, 'success');
  assert.equal(resProfile.profile.Role, 'Resident');
});

test('Pending/wrong-password/unknown-role accounts fail closed cleanly', () => {
  const harness = createBackendHarness({ userRows: [] });
  const hashPassword = harness.sandbox.hashPassword_;
  const usersSheet = harness.centralSs.getSheetByName('Society User Access');
  const salt = 'salt-test-02';
  usersSheet.appendRow(['SO001', 'pending_res', 'USR-PEND', 'Pending Resident', 'pend@example.com', '9000000010', 'Resident', 'PROP-101', 'OWN-101', 'OWNR-1', 'Pending', salt, hashPassword(salt, 'PendPass#2026A'), '', '[]']);
  usersSheet.appendRow(['SO001', 'bad_role', 'USR-BADR', 'Bad Role', 'bad@example.com', '9000000011', 'SuperAdmin', '', '', '', 'Active', salt, hashPassword(salt, 'BadRole#2026A'), '', '[]']);
  usersSheet.appendRow(['SO001', 'active_comm', 'USR-ACTC', 'Active Comm', 'actc@example.com', '9000000012', 'Committee', '', '', '', 'Active', salt, hashPassword(salt, 'GoodPass#2026A'), '', '[]']);

  const pendingRes = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'pending_res', password: 'PendPass#2026A' });
  assert.equal(pendingRes.status, 'error');
  assert.equal(pendingRes.code, 'AUTH_ERROR');

  const wrongPw = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'active_comm', password: 'WrongPassword#2026A' });
  assert.equal(wrongPw.status, 'error');
  assert.equal(wrongPw.code, 'AUTH_ERROR');

  const badRole = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'bad_role', password: 'BadRole#2026A' });
  assert.equal(badRole.status, 'error');
  assert.equal(badRole.code, 'AUTH_ERROR');
});

test('adminCreateUser can immediately activate non-Admin accounts and auto-link Resident Ownership_ID', () => {
  const harness = createBackendHarness({ userRows: [] });
  const hashPassword = harness.sandbox.hashPassword_;
  const usersSheet = harness.centralSs.getSheetByName('Society User Access');
  const salt = 'salt-adm-03';
  usersSheet.appendRow(['SO001', 'admin', 'USR-ADM1', 'Society Admin', 'admin@example.com', '9000000001', 'Admin', '', '', '', 'Active', salt, hashPassword(salt, 'AdminPass#2026A'), '', '[]']);

  const admLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'admin', password: 'AdminPass#2026A' });
  assert.equal(admLogin.status, 'success');

  const created = harness.callPost({
    action: 'adminCreateUser',
    token: admLogin.token,
    fullName: 'Amit Das',
    loginId: 'amit102',
    email: 'amit@example.com',
    mobile: '9876543211',
    role: 'Resident',
    propertyId: 'PROP-102',
    password: 'AmitPass#2026A',
    activateImmediately: true,
  });
  assert.equal(created.status, 'success');
  assert.equal(created.user.Account_Status, 'Active');
  assert.equal(created.user.Ownership_ID, 'OWN-102');

  const resLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'amit102', password: 'AmitPass#2026A' });
  assert.equal(resLogin.status, 'success');
  assert.equal(resLogin.user.role, 'Resident');
  assert.equal(resLogin.user.ownershipId, 'OWN-102');
});

test('Committee and Accountant receive identical dashboard calculation datasets as Admin without Permission denied crashes, while bankAccounts stays hidden from Committee', () => {
  const harness = createBackendHarness({
    userRows: [],
    rolePermissionRows: [
      ['Permission_ID', 'Role', 'Module_Name', 'Can_View', 'Can_Create', 'Can_Edit', 'Can_Delete', 'Can_Approve', 'Remarks'],
      ['RP00001', 'Admin', 'Dashboard', true, true, true, true, true, 'Admin'],
      ['RP00002', 'Admin', 'Reports', true, true, true, true, true, 'Admin'],
      ['RP00003', 'Admin', 'Maintenance & Invoices', true, true, true, true, true, 'Admin'],
      ['RP00004', 'Admin', 'Payments', true, true, true, true, true, 'Admin'],
      ['RP00005', 'Admin', 'Bill Wise Details', true, true, true, true, true, 'Admin'],
      ['RP00006', 'Admin', 'Properties & Residents', true, true, true, true, true, 'Admin'],
      ['RP00007', 'Admin', 'Owner Management', true, true, true, true, true, 'Admin'],
      ['RP00008', 'Admin', 'Ownership History', true, true, true, true, true, 'Admin'],
      ['RP00009', 'Admin', 'Financial Year Management', true, true, true, true, true, 'Admin'],
      ['RP00010', 'Admin', 'Bank Accounts', true, true, true, true, true, 'Admin'],
      // Restrictive / partial Committee config: Reports + Maintenance & Invoices allowed, but Payments / Bill Wise Details / FY / Owners / Ownership History disabled or missing
      ['RP00101', 'Committee', 'Dashboard', true, false, false, false, false, 'Committee'],
      ['RP00102', 'Committee', 'Reports', true, false, false, false, false, 'Committee'],
      ['RP00103', 'Committee', 'Maintenance & Invoices', true, false, false, false, false, 'Committee'],
      ['RP00104', 'Committee', 'Payments', false, false, false, false, false, 'Committee'],
      ['RP00105', 'Committee', 'Bill Wise Details', false, false, false, false, false, 'Committee'],
      ['RP00106', 'Committee', 'Bank Accounts', true, false, false, false, false, 'Even if misconfigured true, Committee must never read bankAccounts'],
      // Restrictive Accountant config: Reports allowed, Bill Wise Details false
      ['RP00201', 'Accountant', 'Dashboard', true, false, false, false, false, 'Accountant'],
      ['RP00202', 'Accountant', 'Reports', true, false, false, false, false, 'Accountant'],
      ['RP00203', 'Accountant', 'Maintenance & Invoices', false, false, false, false, false, 'Accountant'],
      ['RP00204', 'Accountant', 'Bill Wise Details', false, false, false, false, false, 'Accountant'],
      ['RP00205', 'Accountant', 'Bank Accounts', true, false, false, false, false, 'Accountant'],
    ],
  });

  // Add realistic rows to Bill Wise Details, Fund Inflow Register, Financial Year Master, Bank Account Master
  harness.societySs.getSheetByName('Fund Inflow Register').appendRow(['TXN-1', 'PROP-101', 'OWN-101', 'Confirmed', 1500]);
  harness.societySs.getSheetByName('Bill Wise Details').appendRow(['ALL-1', 'TXN-1', 'INV-1', 'PROP-101', 'OWN-101', 1500]);
  harness.societySs.getSheetByName('Financial Year Master').appendRow(['FY-2627', 'FY 2026-27', '2026-04-01', '2027-03-31', 'true']);
  harness.societySs.getSheetByName('Bank Account Master').appendRow(['BANK-1', 'Society SBI', 10000]);

  const hashPassword = harness.sandbox.hashPassword_;
  const usersSheet = harness.centralSs.getSheetByName('Society User Access');
  const salt = 'salt-roles-04';
  usersSheet.appendRow(['SO001', 'adm1', 'USR-ADM', 'Admin User', 'adm@example.com', '9000000001', 'Admin', '', '', '', 'Active', salt, hashPassword(salt, 'AdmPass#2026A'), '', '[]']);
  usersSheet.appendRow(['SO001', 'com1', 'USR-COM', 'Committee User', 'com@example.com', '9000000002', 'Committee', '', '', '', 'Active', salt, hashPassword(salt, 'ComPass#2026A'), '', '[]']);
  usersSheet.appendRow(['SO001', 'acc1', 'USR-ACC', 'Accountant User', 'acc@example.com', '9000000003', 'Accountant', '', '', '', 'Active', salt, hashPassword(salt, 'AccPass#2026A'), '', '[]']);

  const admLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'adm1', password: 'AdmPass#2026A' });
  const comLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'com1', password: 'ComPass#2026A' });
  const accLogin = harness.callPost({ action: 'login', societyCode: 'SO001', loginId: 'acc1', password: 'AccPass#2026A' });

  const admDash = harness.callPost({ action: 'getRoleDashboardData', token: admLogin.token });
  const comDash = harness.callPost({ action: 'getRoleDashboardData', token: comLogin.token });
  const accDash = harness.callPost({ action: 'getRoleDashboardData', token: accLogin.token });

  assert.equal(admDash.status, 'success');
  assert.equal(comDash.status, 'success');
  assert.equal(accDash.status, 'success');

  const calcKeys = ['invoices', 'receipts', 'billWiseDetails', 'rates', 'financialYears', 'properties', 'owners', 'ownershipHistory'];
  for (const key of calcKeys) {
    assert.deepEqual(comDash.data[key], admDash.data[key], `Committee ${key} must match Admin`);
    assert.deepEqual(accDash.data[key], admDash.data[key], `Accountant ${key} must match Admin`);
    const comMod = harness.callPost({ action: 'getModuleData', token: comLogin.token, module: key, page: 1, limit: 200 });
    assert.equal(comMod.status, 'success', `Committee getModuleData(${key}) should succeed`);
    assert.deepEqual(comMod.data, admDash.data[key]);
  }

  // Bank accounts remain strictly protected: Admin & Accountant get them, Committee never does.
  assert.equal(admDash.data.bankAccounts.length, 1);
  assert.equal(accDash.data.bankAccounts.length, 1);
  assert.equal(comDash.data.bankAccounts, undefined);
  const comBankMod = harness.callPost({ action: 'getModuleData', token: comLogin.token, module: 'bankAccounts', page: 1, limit: 50 });
  assert.equal(comBankMod.status, 'error');
  assert.match(comBankMod.message, /restricted/i);
});

