const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const utilSrc=fs.readFileSync(path.join(root,'src/utils/permissions.ts'),'utf8');
const transpiled=ts.transpileModule(utilSrc,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportBag={};const moduleBag={exports:exportBag};new Function('exports','module',transpiled)(exportBag,moduleBag);
const {permissionGranted,actionForTab,moduleForTab,PERMISSION_MODULES}=moduleBag.exports;

test('Role_Permission lookup is role and module specific; missing rows deny',()=>{
 const rows=[{Role:'Committee',Module_Name:'Expenses',Can_View:'TRUE',Can_Approve:true},{Role:'Accountant',Module_Name:'Expenses',Can_View:true,Can_Approve:false}];
 assert.equal(permissionGranted(rows,'Committee','Expenses','Can_View'),true);
 assert.equal(permissionGranted(rows,'Accountant','Expenses','Can_Approve'),false);
 assert.equal(permissionGranted(rows,'Resident','Expenses','Can_View'),false);
 assert.equal(permissionGranted(rows,'Unknown','Expenses','Can_View'),false);
 assert.equal(permissionGranted(rows,'Committee','Unknown Module','Can_View'),false);
});

test('UI tab permission mapping separates module and action',()=>{
 assert.equal(moduleForTab('invoices_generate'),'Maintenance & Invoices');
 assert.equal(actionForTab('invoices_generate'),'Can_Create');
 assert.equal(actionForTab('resident_pay'),'Can_Create');
 assert.equal(actionForTab('settings_role_permissions'),'Can_View');
 assert.ok(PERMISSION_MODULES.includes('Role Permission Management'));
});

test('backend uses database permission sheet and default-deny enforcement',()=>{
 const backend=fs.readFileSync(path.join(root,'apps_script/Code.gs'),'utf8');
 assert.match(backend,/function ensureRolePermissionSheet_\(ss\)/);
 assert.match(backend,/function rolePermission_\(session,moduleName,action,effectiveRole\)/);
 assert.match(backend,/function requirePermission_\(session,moduleName,action,effectiveRole\)/);
 assert.match(backend,/case "getMyPermissions": return getMyPermissions_\(session\)/);
 assert.match(backend,/function getMyPermissions_\(session\)/);
 assert.match(backend,/requireRole_\(session,\["Admin"\]\);\s*requirePermission_\(session,"Role Permission Management","Can_View"\)/);
 assert.match(backend,/Permission denied by Role_Permission configuration/);
 assert.match(backend,/function residentViewSession_\(session,viewAsResident\)/);
 assert.ok(backend.includes("String(session.ownershipId||\"\")+\"|\"+String(session.ownerId||\"\")"),"Dashboard cache must isolate resident ownership sessions");
 assert.match(backend,/Resident View requires both PropertyID and Ownership_ID linked to your user account/);
 assert.match(backend,/const currentRows=findRowsByHeaderValue_\(ss.getSheetByName\("Ownership History"\),"PropertyID",propertyId\)/);
 assert.match(backend,/case "deleteRolePermission": return deleteRolePermission_\(session, body\)/);
});

test('staff resident preview does not mutate actual backend session role',()=>{
 const backend=fs.readFileSync(path.join(root,'apps_script/Code.gs'),'utf8');
 assert.match(backend,/return Object\.assign\(\{\},session,\{role:"Resident",ownerId:/);
 assert.match(backend,/Resident preview payment is restricted to your linked property and ownership/);
 assert.match(backend,/Resident preview request requires your linked PropertyID and Ownership_ID/);
});

test('front-end resident mode uses actual role and Resident permissions separately',()=>{
 const context=fs.readFileSync(path.join(root,'src/context/AppContext.tsx'),'utf8');
 assert.match(context,/const actualRole: UserRole = currentUser\.Role/);
 assert.match(context,/setIsResidentMode/);
 assert.match(context,/!currentUser\.Ownership_ID/);
 assert.match(context,/permissionGranted\(rolePermissions, effectiveRole/);
 const header=fs.readFileSync(path.join(root,'src/components/common/Header.tsx'),'utf8');
 assert.match(header,/View as Resident/);
 assert.match(header,/Staff Mode/);
});

test('empty Role_Permission sheet is seeded with segregated starter permissions for all four roles',()=>{
 const backend=fs.readFileSync(path.join(root,'apps_script/Code.gs'),'utf8');
 const start=backend.indexOf('function seedRolePermissionDefaults_(sh){');
 const end=backend.indexOf('\nfunction rolePermissionRows_',start);
 const seedFn=backend.slice(start,end);
 const moduleNames=['Dashboard','Properties & Residents','Owner Management','Ownership History','Tenant Management','Maintenance & Invoices','Payments','Fund Inflow','Bill Wise Details','Expenses','Activity Requests','Notices','Gallery','Preventive Maintenance','Reports','Financial Year Management','Account Heads','Bank Accounts','User Management','Role Permission Management','Settings','Audit Log','Financial Transactions','My Flat','My Bills','Pay Now','Payment History','Notices & Gallery','Resident Portal'];
 const headers=['Permission_ID','Role','Module_Name','Can_View','Can_Create','Can_Edit','Can_Delete','Can_Approve','Remarks'];
 let seeded=[];const mockSheet={getRange:()=>({setValues:(rows)=>{seeded=rows;}})};
 const seed=new Function('ROLE_PERMISSION_MODULES_','ROLE_PERMISSION_HEADERS_',`${seedFn}; return seedRolePermissionDefaults_;`)(moduleNames,headers);
 seed(mockSheet);
 const row=(role,module)=>seeded.find(r=>r[1]===role&&r[2]===module);
 assert.ok(row('Admin','Dashboard'));
 assert.equal(row('Committee','Expenses')[3],true);assert.equal(row('Committee','Expenses')[7],true);assert.equal(row('Committee','Expenses')[4],false);
 assert.equal(row('Accountant','Expenses')[4],true);assert.equal(row('Accountant','Expenses')[5],true);assert.equal(row('Accountant','Expenses')[7],false);
 assert.equal(row('Resident','Pay Now')[3],true);assert.equal(row('Resident','Pay Now')[4],true);
 assert.equal(row('Resident','Expenses'),undefined);
 assert.ok(seeded.every(r=>headers.length===r.length));
});
