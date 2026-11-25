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

function createResidentHarness({ rolePermissionRows } = {}) {
  const cacheMap = new Map();
  const centralId = '1zcvrYRj1BtgcCo8Skfyf14RVQOTuoGclldWxUWYy470';
  const societyDbId = 'SOC-DB-RES';

  const centralSheets = {
    'Society Master': [
      ['Society_Code', 'Society_Status', 'Database_ID', 'Society_Name', 'Society_Address'],
      ['SO001', 'Active', societyDbId, 'Indraprastha Apartments', 'Rishra'],
    ],
    'Society User Access': [
      ['Society_Code', 'Login_ID', 'UserID', 'Full_Name', 'Email_ID', 'Mobile_No', 'Role', 'PropertyID', 'Ownership_ID', 'OwnerID', 'Account_Status', 'Password_Salt', 'Password_Hash', 'Last_Login', 'KYC_Documents'],
    ],
  };

  const societySheets = {
    'Property Master': [
      ['PropertyID', 'Flat_No', 'Block_Tower', 'Floor_No', 'Property_Type', 'Occupancy_Status', 'Property_Status'],
      ['PROP-101', '101', 'Tower A', 1, '3BHK', 'Self Occupied', 'Active'],
      ['PROP-102', '102', 'Tower A', 1, '2BHK', 'Tenant Occupied', 'Active'],
    ],
    'Owner Master': [
      ['OwnerID', 'Owner_Name', 'Email_ID', 'Mobile_No'],
      ['OWNR-1', 'Rina Sen', 'rina@example.com', '9876543210'],
      ['OWNR-2', 'Amit Das', 'amit@example.com', '9876543211'],
    ],
    'Ownership History': [
      ['Ownership_ID', 'PropertyID', 'OwnerID', 'Ownership_Status', 'Ownership_Start_Date'],
      ['OWN-101', 'PROP-101', 'OWNR-1', 'Current', '2025-04-01'],
      ['OWN-101-OLD', 'PROP-101', 'OWNR-2', 'Transferred', '2020-04-01'],
      ['OWN-102', 'PROP-102', 'OWNR-2', 'Current', '2025-04-01'],
    ],
    'Tenant Master': [
      ['Tenant_ID', 'PropertyID', 'Ownership_ID', 'Tenant_Name', 'Status'],
      ['TEN-101', 'PROP-101', 'OWN-101', 'Suman Paul', 'Active'],
      ['TEN-102', 'PROP-102', 'OWN-102', 'Kiran Roy', 'Active'],
    ],
    'Property Utility Details': [
      ['Utility_ID', 'PropertyID', 'Utility_Type', 'Consumer_ID', 'Meter_No', 'Status'],
      ['UT-101', 'PROP-101', 'WBSEDCL Electricity', 'CID-101', 'M-101', 'Active'],
      ['UT-102', 'PROP-102', 'WBSEDCL Electricity', 'CID-102', 'M-102', 'Active'],
    ],
    'Invoice_Register': [
      ['InvoiceID', 'Invoice_Number', 'PropertyID', 'Ownership_ID', 'OwnerID', 'Net_Charge_Amount', 'Paid_Amount', 'Outstanding_Amount', 'Invoice_Status'],
      ['INV-1', 'INV-001', ' prop-101 ', ' own-101 ', 'OWNR-1', 2500, 0, 2500, 'Unpaid'],
      ['INV-OLD', 'INV-OLD', 'PROP-101', 'OWN-101-OLD', 'OWNR-2', 999, 0, 999, 'Unpaid'],
      ['INV-2', 'INV-002', 'PROP-102', 'OWN-102', 'OWNR-2', 3000, 0, 3000, 'Unpaid'],
    ],
    'Fund Inflow Register': [
      ['Transaction_ID', 'Receipt_Number', 'Date_Of_Received', 'PropertyID', 'Ownership_ID', 'OwnerID', 'Flat_No', 'Owner_Name', 'Received_Amount', 'Received_Mode', 'Received_Reference', 'Bank_Account', 'Unallocated_Amount', 'Remarks', 'File_Reference', 'Created_By', 'Created_At', 'Receipt_Status'],
      ['TXN-1', 'RCT-1', '2026-04-05', 'PROP-101', 'OWN-101', 'OWNR-1', '101', 'Rina Sen', 2000, 'UPI', 'UPI-111', 'BA-1', 500, 'Apr bill', '', 'USR-ADM1', '2026-04-05', 'Confirmed'],
      ['TXN-2', 'RCT-2', '2026-04-06', 'PROP-102', 'OWN-102', 'OWNR-2', '102', 'Amit Das', 3000, 'NEFT', 'NEFT-222', 'BA-1', 0, 'Apr bill', '', 'USR-ADM1', '2026-04-06', 'Confirmed'],
    ],
    'Bill Wise Details': [
      ['Allocation_ID', 'Transaction_ID', 'InvoiceID', 'PropertyID', 'Ownership_ID', 'Allocated_Amount'],
      ['ALL-1', 'TXN-1', 'INV-1', 'PROP-101', 'OWN-101', 1500],
      ['ALL-2', 'TXN-2', 'INV-2', 'PROP-102', 'OWN-102', 3000],
    ],
    'Activity Request Register': [
      ['Request_ID', 'Request_Number', 'PropertyID', 'Ownership_ID', 'Requested_By', 'Subject', 'Request_Status'],
      ['REQ-1', 'REQ-001', 'PROP-101', 'OWN-101', 'USR-RES1', 'Leakage check', 'Pending'],
      ['REQ-LEGACY', 'REQ-002', 'PROP-101', '', 'USR-ADM1', 'Common lobby bulb', 'In Progress'],
      ['REQ-OTHER', 'REQ-003', 'PROP-102', 'OWN-102', 'USR-RES2', 'Private 102', 'Pending'],
    ],
    'Notice Master': [
      ['Notice_ID', 'Notice_Title', 'Notice_Status', 'Visibility', 'Publish_Date', 'Expiry_Date', 'Attachment'],
      ['NOT-ALL', 'AGM Schedule', 'Published', 'All', '2026-04-01', '2099-12-31', 'FILE-NOTICE-ALL'],
      ['NOT-RES', 'Residents Circular', 'Active', 'All Residents', '2026-04-02', '', ''],
      ['NOT-COMM', 'Committee Confidential', 'Published', 'Committee Only', '2026-04-03', '', 'FILE-NOTICE-COMM'],
    ],
    'Gallery Master': [
      ['Gallery_ID', 'Event_Name', 'Status', 'Visibility', 'Photo_File_Reference'],
      ['GAL-1', 'Durga Puja', 'Active', 'Residents Only', 'FILE-GAL-1'],
      ['GAL-COMM', 'Committee Meet', 'Active', 'Committee', 'FILE-GAL-COMM'],
    ],
    'Gallery_Photos': [
      ['Photo_ID', 'Gallery_ID', 'Photo_File_Reference', 'Status'],
      ['PH-1', ' gal-1 ', 'FILE-GAL-PH1', 'Active'],
      ['PH-2', 'GAL-COMM', 'FILE-GAL-COMM', 'Active'],
    ],
    '_File Registry': [
      ['File_ID', 'File_Name', 'Mime_Type', 'Category', 'PropertyID', 'OwnerID', 'Uploaded_By', 'Related_Module', 'Related_Record_ID'],
      ['FILE-NOTICE-ALL', 'agm.pdf', 'application/pdf', 'Notice Attachment', '', '', 'USR-ADM1', 'notices', 'NOT-ALL'],
      ['FILE-NOTICE-COMM', 'secret.pdf', 'application/pdf', 'Notice Attachment', '', '', 'USR-ADM1', 'notices', 'NOT-COMM'],
      ['FILE-GAL-PH1', 'puja.png', 'image/png', 'Gallery Photo', '', '', 'USR-ADM1', 'gallery', 'GAL-1'],
      ['FILE-OTHER-PROP', 'other.pdf', 'application/pdf', 'Payment Proof', 'PROP-102', 'OWNR-2', 'USR-RES2', 'receipts', 'TXN-2'],
    ],
    'Expense Register': [['Expense_ID', 'Expense_Status', 'Payment_Amount', 'Payment_Date']],
    'Bank Account Master': [['BankAccount_ID', 'Account_Name', 'Opening_Balance']],
    'Preventive Maintenance Master': [['Maintenance_ID', 'Maintenance_Status']],
    'Financial Year Master': [['FY_ID', 'FY_Name', 'Start_Date', 'End_Date', 'Is_Current']],
    'Audit Log': [['Log_ID', 'UserID', 'Action_Type', 'Module_Name', 'Record_ID']],
    'Role_Permission': rolePermissionRows || [
      ['Permission_ID', 'Role', 'Module_Name', 'Can_View', 'Can_Create', 'Can_Edit', 'Can_Delete', 'Can_Approve', 'Remarks'],
      ['RP1', 'Resident', 'Dashboard', true, false, false, false, false, ''],
      ['RP2', 'Resident', 'My Flat', true, false, false, false, false, ''],
      ['RP3', 'Resident', 'My Bills', true, false, false, false, false, ''],
      ['RP4', 'Resident', 'Pay Now', true, true, false, false, false, ''],
      ['RP5', 'Resident', 'Payment History', true, false, false, false, false, ''],
      ['RP6', 'Resident', 'Activity Requests', true, true, false, false, false, ''],
      ['RP7', 'Resident', 'Notices & Gallery', true, false, false, false, false, ''],
      ['RP8', 'Resident', 'Resident Portal', true, false, false, false, false, ''],
    ],
  };

  const centralSs = makeSpreadsheet(centralId, centralSheets);
  const societySs = makeSpreadsheet(societyDbId, societySheets);
  const dbMap = { [centralId]: centralSs, [societyDbId]: societySs };

  const fakeBlob = (fileId) => ({
    getBytes: () => Array.from(Buffer.from('FILE:' + fileId)),
    getContentType: () => (fileId.endsWith('PH1') ? 'image/png' : 'application/pdf'),
    getName: () => fileId + '.dat',
  });

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
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE', ANYONE: 'ANYONE' },
      getFileById: (fileId) => ({
        getBlob: () => fakeBlob(fileId),
        getName: () => fileId + '.dat',
        getMimeType: () => (fileId.endsWith('PH1') ? 'image/png' : 'application/pdf'),
        getSharingAccess: () => 'PRIVATE',
        getParents: () => {
          let yielded = false;
          return {
            hasNext: () => !yielded,
            next: () => {
              yielded = true;
              return {
                getName: () => 'Society_SO001',
                getParents: () => ({ hasNext: () => false, next: () => null }),
              };
            },
          };
        },
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
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
      computeDigest: (_alg, val) => Array.from(crypto.createHash('sha256').update(String(val), 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
      formatDate: (d) => new Date(d).toISOString().slice(0, 10),
    },
  };

  vm.runInNewContext(codeSource, sandbox, { timeout: 5000 });
  const hashPassword = sandbox.hashPassword_;
  const usersSheet = centralSs.getSheetByName('Society User Access');
  const salt = 'res-salt-1';
  usersSheet.appendRow(['SO001', 'res101', 'USR-RES1', 'Rina Sen', 'rina@example.com', '9876543210', 'Resident', 'PROP-101', 'OWN-101', 'OWNR-1', 'Active', salt, hashPassword(salt, 'ResPass#2026A'), '', '[]']);

  const callPost = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  const login = callPost({ action: 'login', societyCode: 'SO001', loginId: 'res101', password: 'ResPass#2026A' });
  assert.equal(login.status, 'success');
  return { sandbox, callPost, token: login.token, societySs };
}

test('Resident getRoleDashboardData loads all Resident Portal modules with strict PropertyID + Ownership_ID scoping and Resident permission aliases', () => {
  const harness = createResidentHarness();
  const dash = harness.callPost({ action: 'getRoleDashboardData', token: harness.token });
  assert.equal(dash.status, 'success');
  assert.equal(dash.data.properties.length, 1);
  assert.equal(dash.data.properties[0].PropertyID, 'PROP-101');
  assert.equal(dash.data.owners.length, 1);
  assert.equal(dash.data.owners[0].Owner_Name, 'Rina Sen');
  assert.equal(dash.data.tenants.length, 1);
  assert.equal(dash.data.propertyUtilityDetails.length, 1);
  assert.equal(dash.data.propertyUtilityDetails[0].Meter_No, 'M-101');
  // Strict ownership isolation: INV-1 matches (' prop-101 ', ' own-101 '), INV-OLD & INV-2 excluded
  assert.deepEqual(dash.data.invoices.map(i => i.InvoiceID), ['INV-1']);
  assert.deepEqual(dash.data.receipts.map(r => r.Transaction_ID), ['TXN-1']);
  assert.deepEqual(dash.data.billWiseDetails.map(a => a.Allocation_ID), ['ALL-1']);
  // Activity requests: PROP-101 with OWN-101 or blank ownership allowed, PROP-102 blocked
  assert.deepEqual(dash.data.activityRequests.map(r => r.Request_ID), ['REQ-1', 'REQ-LEGACY']);
  // Notices & Gallery: committee-only filtered out
  assert.deepEqual(dash.data.notices.map(n => n.Notice_ID), ['NOT-ALL', 'NOT-RES']);
  assert.deepEqual(dash.data.gallery.map(g => g.Gallery_ID), ['GAL-1']);
  assert.deepEqual(dash.data.galleryPhotos.map(p => p.Photo_ID), ['PH-1']);
});

test('Resident getModuleData respects Resident Role_Permission aliases and enforces default-deny when missing', () => {
  const deniedHarness = createResidentHarness({
    rolePermissionRows: [
      ['Permission_ID', 'Role', 'Module_Name', 'Can_View', 'Can_Create', 'Can_Edit', 'Can_Delete', 'Can_Approve', 'Remarks'],
      ['RP1', 'Resident', 'Dashboard', true, false, false, false, false, ''],
      ['RP2', 'Resident', 'My Flat', false, false, false, false, false, 'Denied'],
      ['RP3', 'Resident', 'My Bills', false, false, false, false, false, 'Denied'],
    ],
  });
  const deniedFlat = deniedHarness.callPost({ action: 'getModuleData', token: deniedHarness.token, module: 'propertyUtilityDetails' });
  assert.equal(deniedFlat.status, 'error');
  assert.match(deniedFlat.message, /Permission denied/);

  const deniedBills = deniedHarness.callPost({ action: 'getModuleData', token: deniedHarness.token, module: 'invoices' });
  assert.equal(deniedBills.status, 'error');

  const allowedHarness = createResidentHarness();
  const utilRes = allowedHarness.callPost({ action: 'getModuleData', token: allowedHarness.token, module: 'propertyUtilityDetails' });
  assert.equal(utilRes.status, 'success');
  assert.equal(utilRes.data.length, 1);
  const billRes = allowedHarness.callPost({ action: 'getModuleData', token: allowedHarness.token, module: 'invoices' });
  assert.equal(billRes.status, 'success');
  assert.deepEqual(billRes.data.map(i => i.InvoiceID), ['INV-1']);
});

test('Resident getPrivateFile allows active resident-visible notices/gallery and blocks committee/other-flat files', () => {
  const harness = createResidentHarness();

  const noticeFile = harness.callPost({ action: 'getPrivateFile', token: harness.token, fileId: 'FILE-NOTICE-ALL' });
  assert.equal(noticeFile.status, 'success');
  assert.ok(noticeFile.data.base64);

  const galleryPhoto = harness.callPost({ action: 'getPrivateFile', token: harness.token, fileId: 'FILE-GAL-PH1' });
  assert.equal(galleryPhoto.status, 'success');
  assert.equal(galleryPhoto.data.mimeType, 'image/png');

  const commNoticeFile = harness.callPost({ action: 'getPrivateFile', token: harness.token, fileId: 'FILE-NOTICE-COMM' });
  assert.equal(commNoticeFile.status, 'error');

  const otherFlatFile = harness.callPost({ action: 'getPrivateFile', token: harness.token, fileId: 'FILE-OTHER-PROP', propertyId: 'PROP-102' });
  assert.equal(otherFlatFile.status, 'error');
});

test('Resident submitPayment bumps dashboard cache version immediately so new payment is returned right away', () => {
  const harness = createResidentHarness();
  const dashBefore = harness.callPost({ action: 'getRoleDashboardData', token: harness.token });
  assert.equal(dashBefore.data.receipts.length, 1);

  const submitted = harness.callPost({
    action: 'submitPayment',
    token: harness.token,
    requestId: 'req-submit-pay-0001',
    propertyId: 'PROP-101',
    ownershipId: 'OWN-101',
    ownerId: 'OWNR-1',
    amount: 1000,
    mode: 'UPI',
    reference: 'UPI-999111',
    remarks: 'May payment',
  });
  assert.equal(submitted.status, 'success');

  const dashAfter = harness.callPost({ action: 'getRoleDashboardData', token: harness.token });
  assert.equal(dashAfter.status, 'success');
  assert.equal(dashAfter.data.receipts.length, 2);
});
