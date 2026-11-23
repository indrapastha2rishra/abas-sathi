const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'apps_script/Code.gs'), 'utf8');
const context = fs.readFileSync(path.join(root, 'src/context/AppContext.tsx'), 'utf8');

test('login uses a targeted Society + Login ID lookup', () => {
  assert.match(backend, /context\s*=\s*loginContext_\(code,\s*loginId\)/);
  assert.match(backend, /function loginContext_\(code, loginId\)/);
  assert.match(backend, /createTextFinder\(String\(loginId\)\)/);
  assert.doesNotMatch(backend.slice(backend.indexOf('function login_(body)'), backend.indexOf('function adminCreateUser_')), /societyAndUsers_\(code\)/);
});

test('operation ledger key lookup reads only matching rows', () => {
  assert.match(backend, /function findOperation_\(sh,key\).*createTextFinder\(String\(key\)\)/s);
});

test('Drive upload does not hold the global lock while creating the file', () => {
  const start = backend.indexOf('function uploadPrivateFile_(session,body)');
  const end = backend.indexOf('function getPrivateFile_(session,body)', start);
  const upload = backend.slice(start, end);
  const createFile = upload.indexOf('folder.createFile(blob)');
  const secondLock = upload.indexOf('lock.waitLock(5000)', upload.indexOf('lock.waitLock(5000)') + 1);
  assert.ok(createFile > 0, 'Drive createFile call must exist');
  assert.ok(secondLock > createFile, 'second critical section must begin after Drive createFile');
  assert.match(backend, /function createPrivateSocietyFolder_\(session\)[\s\S]*DRIVE_FOLDER_/);
});

test('upload validation uses keyed row lookup rather than full master-sheet reads', () => {
  const start = backend.indexOf('function uploadPrivateFile_(session,body)');
  const end = backend.indexOf('function getPrivateFile_(session,body)', start);
  const upload = backend.slice(start, end);
  assert.doesNotMatch(upload, /sheetObjects_\(societySheet_/);
  assert.match(upload, /rowById_\(societySheet_\(session,"Property Master"\)/);
  assert.match(upload, /rowById_\(societySheet_\(session,"Owner Master"\)/);
});

test('dashboard bootstrap no longer requests Audit Log', () => {
  const dashboardLine = context.split('\n').find(line => line.includes("dashboard: activeRole === 'Resident'"));
  assert.ok(dashboardLine);
  assert.doesNotMatch(dashboardLine, /auditLogs/);
});

test('browser upload avoids a data-URL intermediate buffer', () => {
  assert.match(context, /file\.arrayBuffer\(\)/);
  assert.match(context, /btoa\(binary\)/);
  assert.doesNotMatch(context, /reader\.readAsDataURL\(file\)/);
});

test('generic createRecord validates before acquiring the global write lock', () => {
  const start = backend.indexOf('function createRecord_(session,body)');
  const end = backend.indexOf('function updateRecord_(session,body)', start);
  const fn = backend.slice(start, end);
  assert.ok(fn.indexOf('validateMasterRecord_(session,mod,data,"")') < fn.indexOf('lock.waitLock(5000)'));
  assert.match(fn, /auditEvent_\(session,"CREATE"/);
});

test('audit events use appendRow rather than getLastRow plus setValues', () => {
  const start = backend.indexOf('function auditEvent_(');
  const end = backend.indexOf('function getConfigValue_', start);
  const fn = backend.slice(start, end);
  assert.match(fn, /sh\.appendRow\(/);
  assert.doesNotMatch(fn, /appendByHeaders_\(/);
});


test('login row-index cache stores only indexes and validates cached Society/Login ID rows', () => {
  const start = backend.indexOf('function loginContext_(code, loginId)');
  const end = backend.indexOf('function sessionUserCacheKey_', start);
  const fn = backend.slice(start, end);
  assert.match(fn, /AUTH_SOCIETY_ROW_/);
  assert.match(fn, /AUTH_USER_ROW_/);
  assert.match(fn, /cachedSociety\.Society_Code/);
  assert.match(fn, /normalizeSociety_\(cachedUser\.Society_Code\) === code/);
  assert.match(fn, /normalizeLogin_\(cachedUser\.Login_ID\) === loginId/);
  assert.match(fn, /createTextFinder\(String\(code\)\)/);
  assert.match(fn, /createTextFinder\(String\(loginId\)\)/);
  assert.doesNotMatch(fn, /Password_Hash|Password_Salt/);
});
