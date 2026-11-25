/**
 * ABAS SATHI — Authentication, user administration and KYC backend.
 * Google Apps Script Web App. All authorization is enforced server-side.
 *
 * Required Central Master tabs:
 *   Society Master: Society_Code, Society_Status, Database_ID, Society_Name
 *   Society User Access: Society_Code, Login_ID, UserID, Full_Name, Email_ID,
 *     Mobile_No, Role, PropertyID, Account_Status, Password_Salt, Password_Hash
 *
 * Add these optional columns to Society User Access (the code can append them):
 *   Profile_Address, Emergency_Contact, KYC_Status, KYC_Documents,
 *   Created_At, Created_By, Approved_At, Approved_By, Last_Login,
 *   Password_Changed_At
 *
 * Deploy: Execute as Me; access: Anyone (required for static GitHub Pages).
 * This is a public HTTP endpoint protected by application sessions, rate limits,
 * validation and role checks. For regulated/high-risk production deployments,
 * prefer Firebase Authentication/Cloud Run and a managed database.
 */
const CONFIG = {
  CENTRAL_MASTER_SPREADSHEET_ID: "1zcvrYRj1BtgcCo8Skfyf14RVQOTuoGclldWxUWYy470",
  DEFAULT_DRIVE_FOLDER_ID: "1aUS1Dn09JSBP55C_yKmX4nWRirM_p9wB",
  SESSION_TTL_SECONDS: 21600,
  OTP_TTL_SECONDS: 600,
  PASSWORD_ITERATIONS: 12000,
  MAX_KYC_BYTES: 5 * 1024 * 1024,
  ALLOWED_KYC_TYPES: ["application/pdf", "image/jpeg", "image/png"],
  SOCIETY_SHEETS: [
    "Property Master", "Owner Master", "Ownership History", "Tenant Master",
    "Rate Master", "Invoice_Register", "Fund Inflow Register", "Bill Wise Details",
    "Expense Register", "Expense Category Master", "Bank Account Master",
    "User Master & Role Management", "Activity Request Register", "Notice Master",
    "Gallery Master", "Gallery_Photos", "Preventive Maintenance Master", "Rate Property Mapping",
    "Property Utility Details", "Audit Log", "Financial Year Master", "Account Head Master", "Role_Permission"
  ]
};
const USER_HEADERS = [
  "Society_Code","Login_ID","UserID","Full_Name","Email_ID","Mobile_No","Role",
  "PropertyID","Ownership_ID","OwnerID","Account_Status","Password_Salt","Password_Hash","Profile_Address",
  "Emergency_Contact","KYC_Status","KYC_Documents","Created_At","Created_By",
  "Approved_At","Approved_By","Last_Login","Password_Changed_At","Last_Updated_By","Last_Updated_At"
];

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if ((p.action || "ping") === "ping") return json_({status:"success", message:"ABAS SATHI backend online"});
    // Protected reads are POST-only so session tokens are not placed in URLs.
    if (p.action === "getSocietyData" || p.action === "getAllData" || p.token) {
      return json_({status:"error",code:"POST_REQUIRED",message:"Protected requests must use POST."});
    }
    return json_({status:"error",message:"Unknown action"});
  } catch (err) { return json_({status:"error",message:safeError_(err)}); }
}

function doPost(e) {
  let requestId = "";
  const backendStartedAt = Date.now();
  let actionName = "unknown";
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    requestId = cleanText_(body.requestId || Utilities.getUuid(),100);
    actionName = String(body.action || 'unknown');
    switch (body.action) {
      case "login": return login_(body);
      case "forgotPasswordRequest": return forgotPasswordRequest_(body);
      case "forgotPasswordVerify": return forgotPasswordVerify_(body);
    }
    if (body.action === "logout") {
      if (body.token) CacheService.getScriptCache().remove("SESSION_" + body.token);
      return json_({status:"success",message:"Signed out"});
    }
    // Last-login metadata is written after the frontend has already opened the
    // authenticated shell. This keeps a non-essential write off the login path.
    if (body.action === "updateLoginActivity") return updateLoginActivity_(body.token);
    const session = requireSession_(body.token);
    switch (body.action) {
      case "getSocietyData": return json_({status:"error",code:"SELECTIVE_READ_REQUIRED",message:"Use getModuleData to load one module at a time."});
      case "getModuleData": return getModuleData_(session, body);
      case "getMyPermissions": return getMyPermissions_(session);
      case "deleteRolePermission": return deleteRolePermission_(session, body);
      case "getModuleSchema": return getModuleSchema_(session, body);
      case "getDashboardSummary": requirePermission_(session,"Dashboard","Can_View"); return getDashboardSummary_(session, body);
      case "getDashboardData": return getDashboardData_(session, body);
      case "getRoleDashboardData": return getRoleDashboardData_(session, body);
      case "getReports": return getReports_(session, body);
      case "getFundBalanceSummary": requirePermission_(session,"Reports","Can_View"); return getFundBalanceSummary_(session, body);
      case "getYearEndClosingPreview": requirePermission_(session,"Reports","Can_View"); return getYearEndClosingPreview_(session, body);
      case "finalizeYearEndClosing": requirePermission_(session,"Reports","Can_Approve"); return finalizeYearEndClosing_(session, body);
      case "createReportSnapshot": requirePermission_(session,"Reports","Can_Create"); return createReportSnapshot_(session, body);
      case "approveReportSnapshot": requirePermission_(session,"Reports","Can_Approve"); return approveReportSnapshot_(session, body);
      case "listReportSnapshots": requirePermission_(session,"Reports","Can_View"); return listReportSnapshots_(session, body);
      case "postOpeningBalances": requireRole_(session,["Admin"]); requirePermission_(session,"Financial Transactions","Can_Create"); return postOpeningBalances_(session, body);
      case "listAccountingVouchers": requirePermission_(session,"Financial Transactions","Can_View"); return listAccountingVouchers_(session, body);
      case "createAccountingVoucher": requirePermission_(session,"Financial Transactions","Can_Create"); return createAccountingVoucher_(session, body);
      case "approveAccountingVoucher": requirePermission_(session,"Financial Transactions","Can_Approve"); return approveAccountingVoucher_(session, body);
      case "postAccountingVoucher": requirePermission_(session,"Financial Transactions","Can_Edit"); return postAccountingVoucher_(session, body);
      case "cancelAccountingVoucher": requirePermission_(session,"Financial Transactions","Can_Delete"); return cancelAccountingVoucher_(session, body);
      case "getAccountingBook": requirePermission_(session,"Financial Transactions","Can_View"); return getAccountingBook_(session, body);
      case "listPrivateFiles": return listPrivateFiles_(session, body);
      case "configureAutomatedBackup": return configureAutomatedBackup_(session, body);
      case "restoreSocietyBackup": return restoreSocietyBackup_(session, body);
      case "listSocietyBackups": return listSocietyBackups_(session, body);
      case "listRecoveryOperations": return listRecoveryOperations_(session, body);
      case "getMyProfile": return json_({status:"success",profile:publicUser_(getUserRow_(session))});
      case "adminCreateUser": return adminCreateUser_(session,body);
      case "adminListUsers": return adminListUsers_(session);
      case "adminUpdateUser": return adminUpdateUser_(session,body);
      case "adminSetUserStatus": return adminSetUserStatus_(session,body);
      case "adminApproveUser": return adminApproveUser_(session,body);
      case "adminRejectUser": return adminRejectUser_(session,body);
      case "adminSetKycStatus": return adminSetKycStatus_(session,body);
      case "updateMyProfile": return updateMyProfile_(session,body);
      case "uploadKycDocument": return uploadKycDocument_(session,body);
      case "submitPayment": return submitPayment_(session,body);
      case "confirmPayment": return confirmPayment_(session,body);
      case "rejectPayment": return rejectPayment_(session,body);
      case "allocatePayment": return allocatePayment_(session,body);
      case "generateInvoice": return generateInvoice_(session,body);
      case "cancelInvoice": return cancelInvoice_(session,body);
      case "createExpense": return createExpense_(session,body);
      case "approveExpense": return approveExpense_(session,body);
      case "markExpensePaid": return markExpensePaid_(session,body);
      case "cancelExpense": return cancelExpense_(session,body);
      case "createRecord": return createRecord_(session,body);
      case "updateRecord": return updateRecord_(session,body);
      case "cancelRecord": return cancelRecord_(session,body);
      case "uploadPrivateFile": return uploadPrivateFile_(session,body);
      case "getPrivateFile": return getPrivateFile_(session,body);
      case "createSocietyBackup": return createSocietyBackup_(session,body);
      default: return json_({status:"error",code:"UNSUPPORTED_ACTION",requestId,message:"Unsupported action"});
    }
  } catch (err) { return json_({status:"error",code:errorCode_(err),requestId,message:safeError_(err)}); }
  finally { try { console.log('ABAS_SATHI_BACKEND_TIMING ' + JSON.stringify({action:actionName,elapsedMs:Date.now()-backendStartedAt})); } catch (logError) {} }
}


// -----------------------------------------------------------------------------
// Version 6.0.3 read API: selective, paginated and server-authorized; request timing is logged.
// Financial writes are intentionally NOT routed through generic CRUD.
// They require dedicated locked/idempotent transaction handlers.
// -----------------------------------------------------------------------------
const MODULE_SHEETS = {
  properties: "Property Master", owners: "Owner Master", ownershipHistory: "Ownership History", rolePermissions: "Role_Permission",
  tenants: "Tenant Master", rates: "Rate Master", invoices: "Invoice_Register",
  receipts: "Fund Inflow Register", billWiseDetails: "Bill Wise Details",
  expenses: "Expense Register", expenseCategories: "Expense Category Master",
  bankAccounts: "Bank Account Master", activityRequests: "Activity Request Register",
  notices: "Notice Master", gallery: "Gallery Master", galleryPhotos: "Gallery_Photos",
  preventiveMaintenance: "Preventive Maintenance Master",
  propertyUtilityDetails: "Property Utility Details", financialYears: "Financial Year Master",
  ratePropertyMapping: "Rate Property Mapping", accountHeads: "Account Head Master", auditLogs: "Audit Log"
};

function getModuleData_(session, body) {
  const key = String(body.module || "");
  const sheetName = MODULE_SHEETS[key];
  if (!sheetName) throw new Error("Unknown or unsupported module.");
  const viewSession = residentViewSession_(session, body.viewAsResident);
  authorizeModuleRead_(session, key, Boolean(body.viewAsResident));
  const page = Math.max(1, Math.floor(Number(body.page) || 1));
  const limit = Math.min(200, Math.max(1, Math.floor(Number(body.limit) || 50)));
  const ss = SpreadsheetApp.openById(session.databaseId);
  const sheet = key === "rolePermissions" ? ensureRolePermissionSheet_(ss) : (ss.getSheetByName(sheetName) || (key==="invoices"?ss.getSheetByName("Invoice Register"):key==="galleryPhotos"?ss.getSheetByName("Gallery Photos"):null));
  if(!sheet){if(key==="galleryPhotos")return json_({status:"success",module:key,data:[],pagination:{page,limit,total,totalPages:0}});throw new Error("Required sheet is missing: "+sheetName);}
  if(key === "rolePermissions") {
    const all = sheetObjects_(sheet),start=(page-1)*limit,total=all.length;
    return json_({status:"success",module:key,data:all.slice(start,start+limit),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
  }
  const hasFilters=Boolean(body.search||body.status||body.propertyId||body.ownerId||body.fromDate||body.toDate);
  if(viewSession.role!=="Resident"&&!hasFilters){
    const last=sheet.getLastRow(),total=Math.max(0,last-1),start=(page-1)*limit+2;
    const data=(total&&start<=last)?sheetObjectsRange_(sheet,start,Math.min(limit,last-start+1)):[];
    return json_({status:"success",module:key,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
  }
  let records = viewSession.role==="Resident" ? residentModuleRecords_(viewSession,key,ss,sheet) : sheetObjects_(sheet);
  const search = String(body.search || "").trim().toLowerCase();
  if (search) records = records.filter(row => Object.keys(row).some(k => String(row[k] == null ? "" : row[k]).toLowerCase().includes(search)));
  const statusField = {properties:"Property_Status",rates:"Status",invoices:"Invoice_Status",receipts:"Receipt_Status",expenses:"Expense_Status",activityRequests:"Request_Status",notices:"Notice_Status",preventiveMaintenance:"Maintenance_Status",tenants:"Status",gallery:"Status",bankAccounts:"Status",expenseCategories:"Status",propertyUtilityDetails:"Status",financialYears:"FY_Status",ratePropertyMapping:"Status"}[key] || "Status";
  const dateField = {invoices:"Billing_Date",receipts:"Date_Of_Received",expenses:"Payment_Date",activityRequests:"Request_Date",notices:"Publish_Date",preventiveMaintenance:"Next_Service_Date",auditLogs:"Action_DateTime",gallery:"Event_Date",rates:"Effective_From",ownershipHistory:"Ownership_Start_Date",ratePropertyMapping:"Effective_From",propertyUtilityDetails:"Effective_From",financialYears:"Start_Date"}[key] || "Created_At";
  if (body.status != null && body.status !== "") records = records.filter(r => String(r[statusField] || "") === String(body.status));
  if (body.propertyId != null && body.propertyId !== "") records = records.filter(r => String(r.PropertyID || "") === String(body.propertyId));
  if (body.ownerId != null && body.ownerId !== "") records = records.filter(r => String(r.OwnerID || "") === String(body.ownerId));
  if (body.fromDate) records = records.filter(r => String(r[dateField] || "").slice(0,10) >= String(body.fromDate).slice(0,10));
  if (body.toDate) records = records.filter(r => String(r[dateField] || "").slice(0,10) <= String(body.toDate).slice(0,10));
  const total = records.length;
  const start = (page - 1) * limit;
  return json_({status:"success",module:key,data:records.slice(start,start+limit),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}


function getModuleSchema_(session, body) {
  const key=String(body.module||""), cfg=CRUD_MODULES[key], sheetName=MODULE_SHEETS[key];
  if(!cfg||!sheetName) throw new Error("Module does not support generic maintenance.");
  const roles=cfg.roles||[];
  if(roles.indexOf(session.role)<0) throw new Error("Permission denied.");
  if(key==="rolePermissions")requireRole_(session,["Admin"]);else requirePermission_(session,PERMISSION_MODULE_MAP_[key]||key,"Can_View");
  const sh=societySheet_(session,cfg.sheet).sh;
  if(key==="owners")ensureHeaders_(sh,["Owner_Status"]);
  const headers=headerMap_(sh);
  const hidden=["Created_By","Created_At","Updated_At","Approved_By","Approved_At","Cancelled_By","Cancelled_At","Password_Salt","Password_Hash","Society_Code","Owner_Status","Ownership_Status","Ownership_End_Date"];
  return json_({status:"success",module:key,idField:cfg.id,fields:headers.filter(h=>h&&!hidden.includes(h)&&h.indexOf("__")!==0),readOnlyFields:[cfg.id,"Created_By","Created_At","Updated_By","Updated_At"]});
}


function journalSheet_(ss){
  return ensureInternalSheet_(ss,"_Journal Ledger",["Journal_ID","Journal_Date","Source_Type","Source_ID","Account_Code","Account_Name","Account_Type","Debit","Credit","PropertyID","Ownership_ID","Narration","Posted_By","Posted_At","Status"]);
}
function voucherRegisterSheet_(ss){
  return ensureInternalSheet_(ss,"_Voucher Register",["Voucher_ID","Voucher_No","Voucher_Type","Voucher_Date","FY_ID","Narration","Total_Debit","Total_Credit","Voucher_Status","Reference_ID","Created_By","Created_At","Approved_By","Approved_At","Posted_By","Posted_At","Cancelled_By","Cancelled_At","Cancellation_Reason"]);
}
function journalDetailsSheet_(ss){
  return ensureInternalSheet_(ss,"_Journal Details",["Entry_ID","Voucher_ID","Voucher_No","Entry_Date","FY_ID","Account_ID","Account_Code","Account_Name","Account_Type","Debit_Amount","Credit_Amount","PropertyID","Ownership_ID","InvoiceID","Transaction_ID","Expense_ID","Narration","Entry_Status","Created_By","Created_At"]);
}
function resolveAccountingFY_(ss,dateValue,providedId){
  const sh=ss.getSheetByName("Financial Year Master");if(!sh)throw new Error("Financial Year Master is required for accounting voucher posting.");
  const date=String(dateValue||"").slice(0,10),rows=sheetObjects_(sh);
  const fy=rows.find(x=>(!providedId||String(x.FY_ID)===String(providedId))&&String(x.Start_Date||"").slice(0,10)<=date&&String(x.End_Date||"").slice(0,10)>=date);
  if(!fy)throw new Error("Voucher date does not belong to the selected/available Financial Year.");
  const status=String(fy.FY_Status||"Active").toLowerCase();if(["closed","finalized","locked","inactive"].includes(status))throw new Error("This Financial Year is closed for posting.");
  return String(fy.FY_ID||"");
}
function accountById_(ss,id){
  const sh=ss.getSheetByName("Account Head Master");
  if(!sh)throw new Error("Account Head Master sheet is required before posting vouchers.");
  const row=sheetObjects_(sh).find(x=>String(x.Account_ID)===String(id)&&String(x.Status||"Active")==="Active");
  if(!row)throw new Error("An active Account Head must be selected for every journal line.");
  return row;
}
function nextVoucherNo_(ss,type,date){
  const sh=voucherRegisterSheet_(ss),year=String(date||new Date()).slice(0,4)||String(new Date().getFullYear());
  const prefix=String(type||"JV").toUpperCase()+"-"+year+"-";
  const count=sheetObjects_(sh).filter(x=>String(x.Voucher_No||"").indexOf(prefix)===0).length+1;
  return prefix+String(count).padStart(6,"0");
}
function postJournalEntry_(ss, sourceType, sourceId, journalDate, entries, session){
  const sh=journalSheet_(ss),existing=sheetObjects_(sh).filter(x=>String(x.Source_Type)===String(sourceType)&&String(x.Source_ID)===String(sourceId)&&String(x.Status)==="Posted");
  if(existing.length)return existing;
  const clean=(entries||[]).filter(x=>Number(x.debit||0)>0||Number(x.credit||0)>0);
  if(clean.length<2)throw new Error("A journal must contain at least two non-zero lines.");
  const totalDebit=clean.reduce((a,x)=>a+Number(x.debit||0),0),totalCredit=clean.reduce((a,x)=>a+Number(x.credit||0),0);
  if(!isFinite(totalDebit)||!isFinite(totalCredit)||Math.abs(totalDebit-totalCredit)>0.009)throw new Error("Journal entry is not balanced.");
  clean.forEach(x=>{const d=Number(x.debit||0),c=Number(x.credit||0);if(d<0||c<0||(d>0&&c>0)||!isFinite(d)||!isFinite(c))throw new Error("Each journal line must have either a positive debit or a positive credit.");});
  const rows=clean.map(x=>({Journal_ID:"JRN-"+randomHex_(8),Journal_Date:journalDate||new Date(),Source_Type:sourceType,Source_ID:sourceId,Account_Code:x.accountCode||"",Account_Name:x.accountName,Account_Type:x.accountType,Debit:Number(x.debit||0),Credit:Number(x.credit||0),PropertyID:x.propertyId||"",Ownership_ID:x.ownershipId||"",Narration:x.narration||"",Posted_By:session.userId,Posted_At:new Date(),Status:"Posted"}));
  rows.forEach(r=>appendByHeaders_(sh,r));
  // Keep a voucher register and line-level journal detail for both automatic and manual postings.
  const vr=voucherRegisterSheet_(ss),jd=journalDetailsSheet_(ss),typeMap={Receipt:"RV",Expense:"PV",Contra:"CV",Invoice:"JV","Opening Balance":"JV","Invoice Reversal":"JV",RV:"RV",PV:"PV",JV:"JV",CV:"CV"};
  const existingVoucher=sheetObjects_(vr).find(x=>String(x.Voucher_ID)===String(sourceId));
  const voucherType=typeMap[String(sourceType)]||"JV",voucherId=existingVoucher?String(sourceId):"VCH-"+String(sourceId),voucherNo=existingVoucher?String(existingVoucher.Voucher_No):nextVoucherNo_(ss,voucherType,journalDate||new Date());
  if(existingVoucher){
    const vf=rowById_(vr,"Voucher_ID",voucherId);if(vf)updateByHeaders_(vr,vf.row,{Voucher_Status:"Posted",Posted_By:session.userId,Posted_At:new Date()},["Voucher_ID","Voucher_No"]);
    sheetObjects_(jd).filter(x=>String(x.Voucher_ID)===voucherId).forEach(x=>{const ef=rowById_(jd,"Entry_ID",x.Entry_ID);if(ef)updateByHeaders_(jd,ef.row,{Entry_Status:"Posted"},["Entry_ID","Voucher_ID"]);});
  } else {
    appendByHeaders_(vr,{Voucher_ID:voucherId,Voucher_No:voucherNo,Voucher_Type:voucherType,Voucher_Date:journalDate||new Date(),FY_ID:"",Narration:String(clean[0].narration||sourceType),Total_Debit:totalDebit,Total_Credit:totalCredit,Voucher_Status:"Posted",Reference_ID:String(sourceId),Created_By:session.userId,Created_At:new Date(),Approved_By:session.userId,Approved_At:new Date(),Posted_By:session.userId,Posted_At:new Date()});
    clean.forEach((x,i)=>appendByHeaders_(jd,{Entry_ID:rows[i].Journal_ID,Voucher_ID:voucherId,Voucher_No:voucherNo,Entry_Date:journalDate||new Date(),FY_ID:"",Account_ID:x.accountId||"",Account_Code:x.accountCode||"",Account_Name:x.accountName,Account_Type:x.accountType,Debit_Amount:Number(x.debit||0),Credit_Amount:Number(x.credit||0),PropertyID:x.propertyId||"",Ownership_ID:x.ownershipId||"",InvoiceID:x.invoiceId||"",Transaction_ID:x.transactionId||"",Expense_ID:x.expenseId||"",Narration:x.narration||"",Entry_Status:"Posted",Created_By:session.userId,Created_At:new Date()}));
  }
  return rows;
}

function listAccountingVouchers_(session,body){
  requireRole_(session,["Admin","Accountant","Committee"]);
  const ss=SpreadsheetApp.openById(session.databaseId),sh=voucherRegisterSheet_(ss);
  let rows=sheetObjects_(sh);if(body.voucherType)rows=rows.filter(x=>String(x.Voucher_Type)===String(body.voucherType));if(body.status)rows=rows.filter(x=>String(x.Voucher_Status)===String(body.status));
  return json_({status:"success",data:rows.slice(-Math.min(500,Math.max(1,Number(body.limit)||200))).reverse()});
}
function createAccountingVoucher_(session,body){
  requireRole_(session,["Admin","Accountant"]);const op=requireOperationId_(body),type=String(body.voucherType||"JV").toUpperCase(),date=cleanText_(body.voucherDate,10),narration=cleanText_(body.narration,500),lines=Array.isArray(body.lines)?body.lines:[];
  if(["RV","PV","JV","CV"].indexOf(type)<0)throw new Error("Invalid voucher type.");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("A valid voucher date is required.");if(!narration||lines.length<2||lines.length>100)throw new Error("Narration and 2–100 journal lines are required.");
  const lock=LockService.getScriptLock();lock.waitLock(20000);try{const ss=SpreadsheetApp.openById(session.databaseId),ops=operationLedger_(ss),prior=findOperation_(ops,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("Previous voucher operation is incomplete; reconcile before retrying.");
    const normalized=lines.map(x=>{const acc=accountById_(ss,x.accountId),d=Number(x.debit||0),c=Number(x.credit||0);if(!isFinite(d)||!isFinite(c)||d<0||c<0||(d>0&&c>0)||(d===0&&c===0))throw new Error("Each line must contain one positive debit or credit.");return {accountId:acc.Account_ID,accountCode:acc.Account_Code,accountName:acc.Account_Name,accountType:acc.Account_Type,debit:d,credit:c,propertyId:cleanText_(x.propertyId,80),ownershipId:cleanText_(x.ownershipId,80),narration:cleanText_(x.narration,300)||narration};});
    const dr=normalized.reduce((a,x)=>a+x.debit,0),cr=normalized.reduce((a,x)=>a+x.credit,0);if(Math.abs(dr-cr)>0.009)throw new Error("Total Debit must equal Total Credit before a voucher can be saved.");
    if(type==="CV"){if(normalized.some(x=>x.accountType!=="Asset")||normalized.filter(x=>x.debit>0).length!==1||normalized.filter(x=>x.credit>0).length!==1)throw new Error("Contra Voucher requires exactly one debit and one credit line, both Asset accounts.");}
    if(type==="RV"&&!normalized.some(x=>x.debit>0&&x.accountType==="Asset"))throw new Error("Receipt Voucher must debit a Cash or Bank (Asset) account.");
    if(type==="PV"&&!normalized.some(x=>x.credit>0&&x.accountType==="Asset"))throw new Error("Payment Voucher must credit a Cash or Bank (Asset) account.");
    const fyId=resolveAccountingFY_(ss,date,body.fyId||"");
    const id="VCH-"+randomHex_(8).toUpperCase(),no=nextVoucherNo_(ss,type,date),sh=voucherRegisterSheet_(ss),jd=journalDetailsSheet_(ss);writeOperation_(ops,op,"createAccountingVoucher",id,"STARTED",{});
    appendByHeaders_(sh,{Voucher_ID:id,Voucher_No:no,Voucher_Type:type,Voucher_Date:date,FY_ID:fyId,Narration:narration,Total_Debit:dr,Total_Credit:cr,Voucher_Status:"Pending Approval",Reference_ID:cleanText_(body.referenceId,100),Created_By:session.userId,Created_At:new Date()});
    normalized.forEach(x=>appendByHeaders_(jd,{Entry_ID:"ENT-"+randomHex_(8),Voucher_ID:id,Voucher_No:no,Entry_Date:date,FY_ID:fyId,Account_ID:x.accountId,Account_Code:x.accountCode,Account_Name:x.accountName,Account_Type:x.accountType,Debit_Amount:x.debit,Credit_Amount:x.credit,PropertyID:x.propertyId,Ownership_ID:x.ownershipId,Narration:x.narration,Entry_Status:"Pending Approval",Created_By:session.userId,Created_At:new Date()}));
    const result={voucherId:id,voucherNo:no,totalDebit:dr,totalCredit:cr,status:"Pending Approval"};writeOperation_(ops,op,"createAccountingVoucher",id,"DONE",result);auditEvent_(session,"CREATE","Voucher Register",id,"Created "+type+" "+no,"",result);return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}
function approveAccountingVoucher_(session,body){
  requireRole_(session,["Admin"]);const id=cleanText_(body.voucherId,100),shs=SpreadsheetApp.openById(session.databaseId),vr=voucherRegisterSheet_(shs),f=rowById_(vr,"Voucher_ID",id);if(!f)throw new Error("Voucher not found.");const v=objectFromRow_(f.headers,f.values);if(v.Voucher_Status!=="Pending Approval")throw new Error("Only pending vouchers can be approved.");updateByHeaders_(vr,f.row,{Voucher_Status:"Approved",Approved_By:session.userId,Approved_At:new Date()},["Voucher_ID","Voucher_No"]);auditEvent_(session,"APPROVE","Voucher Register",id,"Voucher approved",v,{Voucher_Status:"Approved"});return json_({status:"success"});
}
function postAccountingVoucher_(session,body){
  requireRole_(session,["Admin"]);const id=cleanText_(body.voucherId,100),op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(20000);try{const ss=SpreadsheetApp.openById(session.databaseId),ops=operationLedger_(ss),prior=findOperation_(ops,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("Previous posting is incomplete; reconcile before retrying.");const vr=voucherRegisterSheet_(ss),vf=rowById_(vr,"Voucher_ID",id);if(!vf)throw new Error("Voucher not found.");const v=objectFromRow_(vf.headers,vf.values);if(v.Voucher_Status!=="Approved")throw new Error("Only approved vouchers can be posted.");resolveAccountingFY_(ss,v.Voucher_Date,v.FY_ID);const jd=journalDetailsSheet_(ss),lines=sheetObjects_(jd).filter(x=>String(x.Voucher_ID)===id);if(lines.length<2)throw new Error("Voucher journal details are missing.");const entries=lines.map(x=>({accountCode:x.Account_Code,accountId:x.Account_ID,accountName:x.Account_Name,accountType:x.Account_Type,debit:Number(x.Debit_Amount||0),credit:Number(x.Credit_Amount||0),propertyId:x.PropertyID,ownershipId:x.Ownership_ID,narration:x.Narration}));const dr=entries.reduce((a,x)=>a+x.debit,0),cr=entries.reduce((a,x)=>a+x.credit,0);if(Math.abs(dr-cr)>0.009)throw new Error("Voucher is not balanced.");writeOperation_(ops,op,"postAccountingVoucher",id,"STARTED",{});postJournalEntry_(ss,v.Voucher_Type,id,v.Voucher_Date,entries,session);updateByHeaders_(vr,vf.row,{Voucher_Status:"Posted",Posted_By:session.userId,Posted_At:new Date()},["Voucher_ID","Voucher_No"]);lines.forEach(x=>{const r=rowById_(jd,"Entry_ID",x.Entry_ID);if(r)updateByHeaders_(jd,r.row,{Entry_Status:"Posted"},["Entry_ID","Voucher_ID"]);});const result={voucherId:id,voucherNo:v.Voucher_No,totalDebit:dr,totalCredit:cr,status:"Posted"};writeOperation_(ops,op,"postAccountingVoucher",id,"DONE",result);auditEvent_(session,"POST","Voucher Register",id,"Voucher posted to General Ledger","",result);return json_({status:"success",data:result});}finally{lock.releaseLock();}
}
function cancelAccountingVoucher_(session,body){
  requireRole_(session,["Admin"]);const id=cleanText_(body.voucherId,100),reason=cleanText_(body.reason,300);if(!reason)throw new Error("Cancellation reason is required.");const ss=SpreadsheetApp.openById(session.databaseId),vr=voucherRegisterSheet_(ss),f=rowById_(vr,"Voucher_ID",id);if(!f)throw new Error("Voucher not found.");const v=objectFromRow_(f.headers,f.values);if(v.Voucher_Status==="Posted")throw new Error("Posted vouchers cannot be cancelled. Create a reversal voucher.");if(["Cancelled","Rejected"].includes(v.Voucher_Status))throw new Error("Voucher is already closed.");updateByHeaders_(vr,f.row,{Voucher_Status:"Cancelled",Cancelled_By:session.userId,Cancelled_At:new Date(),Cancellation_Reason:reason},["Voucher_ID","Voucher_No"]);const jd=journalDetailsSheet_(ss);sheetObjects_(jd).filter(x=>String(x.Voucher_ID)===id).forEach(x=>{const r=rowById_(jd,"Entry_ID",x.Entry_ID);if(r)updateByHeaders_(jd,r.row,{Entry_Status:"Cancelled"},["Entry_ID","Voucher_ID"]);});auditEvent_(session,"CANCEL","Voucher Register",id,reason,v,{Voucher_Status:"Cancelled"});return json_({status:"success"});
}
function getAccountingBook_(session,body){
  requireRole_(session,["Admin","Accountant","Committee"]);const ss=SpreadsheetApp.openById(session.databaseId),j=journalSheet_(ss);let rows=sheetObjects_(j).filter(x=>String(x.Status)==="Posted");if(body.fromDate)rows=rows.filter(x=>String(x.Journal_Date).slice(0,10)>=String(body.fromDate));if(body.toDate)rows=rows.filter(x=>String(x.Journal_Date).slice(0,10)<=String(body.toDate));if(body.accountCode)rows=rows.filter(x=>String(x.Account_Code)===String(body.accountCode));if(body.sourceType)rows=rows.filter(x=>String(x.Source_Type)===String(body.sourceType));const dr=rows.reduce((a,x)=>a+Number(x.Debit||0),0),cr=rows.reduce((a,x)=>a+Number(x.Credit||0),0);return json_({status:"success",data:rows.slice(-1000).reverse(),summary:{totalDebit:dr,totalCredit:cr,balanced:Math.abs(dr-cr)<0.01,lineCount:rows.length}});
}
function postOpeningBalances_(session,body){
  requireRole_(session,["Admin"]);
  const op=requireOperationId_(body),entries=Array.isArray(body.entries)?body.entries:[];
  if(!entries.length||entries.length>100)throw new Error("Provide between 1 and 100 opening balance lines.");
  const normalized=entries.map(x=>({accountName:cleanText_(x.accountName,120),accountType:cleanText_(x.accountType,40),debit:Number(x.debit||0),credit:Number(x.credit||0),accountCode:cleanText_(x.accountCode,40)}));
  if(normalized.some(x=>!x.accountName||!["Asset","Liability","Equity","Fund"].includes(x.accountType)||!isFinite(x.debit)||!isFinite(x.credit)||x.debit<0||x.credit<0||(x.debit>0&&x.credit>0)))throw new Error("Each opening line needs an account, Asset/Liability/Equity type and one non-negative debit or credit.");
  const dr=normalized.reduce((a,x)=>a+x.debit,0),cr=normalized.reduce((a,x)=>a+x.credit,0);
  if(Math.abs(dr-cr)>0.009)throw new Error("Opening balances must have equal total debit and credit.");
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const ss=SpreadsheetApp.openById(session.databaseId),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("Opening balance posting is incomplete; reconcile before retrying.");
    const j=journalSheet_(ss),already=sheetObjects_(j).some(x=>x.Source_Type==="Opening Balance"&&x.Status==="Posted");
    if(already)throw new Error("Opening balances have already been posted. Use a reviewed adjustment journal instead.");
    writeOperation_(ledger,op,"postOpeningBalances","OPENING","STARTED",{});
    const batch="OPEN-"+randomHex_(8).toUpperCase();
    const rows=postJournalEntry_(ss,"Opening Balance",batch,cleanText_(body.effectiveDate,20)||new Date(),normalized.map(x=>({accountCode:x.accountCode,accountName:x.accountName,accountType:x.accountType,debit:x.debit,credit:x.credit,narration:"Approved opening balance"})),session);
    const result={batchId:batch,lineCount:rows.length,totalDebit:dr,totalCredit:cr};
    writeOperation_(ledger,op,"postOpeningBalances",batch,"DONE",result);
    clearFundBalanceCache_(session.societyCode);
    auditEvent_(session,"CREATE","Opening Balance",batch,"Opening balances posted as a balanced journal batch","",result);
    return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}

/**
 * Pure report builder: one row per Ownership_ID, not one row per OwnerID.
 * This preserves historical liability when a flat changes ownership.
 */
function buildOwnershipOutstandingRows_(invoiceRows, ownershipRows, propertyRows, ownerRows, receiptRows, billRows) {
  const ownershipById = {};
  (ownershipRows || []).forEach(x => { if (x.Ownership_ID) ownershipById[String(x.Ownership_ID).trim()] = x; });
  const propertyById = {};
  (propertyRows || []).forEach(x => { if (x.PropertyID) propertyById[String(x.PropertyID).trim()] = x; });
  const ownerById = {};
  (ownerRows || []).forEach(x => { if (x.OwnerID) ownerById[String(x.OwnerID).trim()] = x; });

  const receiptStatusByTxn = {};
  (receiptRows || []).forEach(r => {
    const txnId = String(r.Transaction_ID || "").trim();
    if (txnId) receiptStatusByTxn[txnId] = String(r.Receipt_Status || r.Status || "").trim().toLowerCase();
  });

  const excludedStatuses = { cancelled: true, draft: true, pending_approval: true, "pending approval": true };
  const keyByInvoiceId = {};
  const keyByInvoiceNumber = {};
  const grouped = {};

  (invoiceRows || []).forEach(inv => {
    const statusRaw = String(inv.Invoice_Status || "").trim().toLowerCase();
    if (excludedStatuses[statusRaw]) return;
    const ownershipId = String(inv.Ownership_ID || "").trim();
    const propertyId = String(inv.PropertyID || "").trim();
    const ownerId = String(inv.OwnerID || "").trim();
    const key = ownershipId || ("UNLINKED:" + propertyId + ":" + ownerId);
    const invId = String(inv.InvoiceID || "").trim();
    const invNum = String(inv.Invoice_Number || "").trim();
    if (invId) keyByInvoiceId[invId] = key;
    if (invNum) keyByInvoiceNumber[invNum] = key;

    const history = ownershipById[ownershipId] || {};
    const property = propertyById[propertyId] || {};
    const owner = ownerById[ownerId] || {};
    const floorRaw = property.Floor_No !== undefined && property.Floor_No !== ""
      ? property.Floor_No
      : (property["Floor No."] !== undefined && property["Floor No."] !== ""
        ? property["Floor No."]
        : (property["Floor No"] !== undefined && property["Floor No"] !== ""
          ? property["Floor No"]
          : (inv.Floor_No !== undefined ? inv.Floor_No : "")));

    if (!grouped[key]) {
      grouped[key] = {
        Ownership_ID: ownershipId || "Not linked",
        PropertyID: propertyId,
        Flat_No: String(inv.Flat_Number || inv.Flat_No || property.Flat_No || property["Flat No."] || ""),
        Floor_No: floorRaw === null || floorRaw === undefined ? "" : floorRaw,
        OwnerID: ownerId,
        Owner_Name: String(inv.Owner_Name || owner.Owner_Name || ""),
        Ownership_Start_Date: history.Ownership_Start_Date || "",
        Ownership_End_Date: history.Ownership_End_Date || "",
        Ownership_Status: history.Ownership_Status || "Historical record not found",
        Invoice_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0,
        Data_Link_Status: ownershipId && history.Ownership_ID ? "Linked" : "Needs review",
        _legacyPaid: 0,
        _hasOwnershipId: Boolean(ownershipId)
      };
    } else if (grouped[key].Floor_No === "" && floorRaw !== "" && floorRaw !== null && floorRaw !== undefined) {
      grouped[key].Floor_No = floorRaw;
    }

    const net = Math.max(0, fundMoney_(inv.Net_Charge_Amount));
    const legacyPaid = Math.max(0, fundMoney_(inv.Paid_Amount));
    grouped[key].Invoice_Count++;
    grouped[key].Total_Billed = fundMoney_(grouped[key].Total_Billed + net);
    grouped[key]._legacyPaid = fundMoney_(grouped[key]._legacyPaid + legacyPaid);
  });

  // Sum Allocated_Amount from Bill Wise Details grouped by Ownership_ID
  const allocatedByOwnership = {};
  (billRows || []).forEach(b => {
    const txnId = String(b.Transaction_ID || "").trim();
    if (txnId && Object.prototype.hasOwnProperty.call(receiptStatusByTxn, txnId) && receiptStatusByTxn[txnId] !== "confirmed") {
      return;
    }
    const directOwnershipId = String(b.Ownership_ID || "").trim();
    const invId = String(b.InvoiceID || "").trim();
    const invNum = String(b.Invoice_Number || "").trim();
    const resolvedKey = directOwnershipId || (invId ? (keyByInvoiceId[invId] || "") : "") || (invNum ? (keyByInvoiceNumber[invNum] || "") : "");
    if (!resolvedKey) return;
    allocatedByOwnership[resolvedKey] = fundMoney_((allocatedByOwnership[resolvedKey] || 0) + Math.max(0, fundMoney_(b.Allocated_Amount)));
  });

  const useBillWiseAllocations = Array.isArray(billRows) && billRows.length > 0;
  let unlinkedInvoiceCount = 0;

  const data = Object.keys(grouped).map(key => {
    const g = grouped[key];
    const paid = useBillWiseAllocations ? (allocatedByOwnership[key] || 0) : g._legacyPaid;
    const totalPaid = fundMoney_(Math.max(0, paid));
    const outstanding = Math.max(0, fundMoney_(g.Total_Billed - totalPaid));
    if (!g._hasOwnershipId && outstanding > 0) unlinkedInvoiceCount += g.Invoice_Count;
    return {
      Ownership_ID: g.Ownership_ID,
      PropertyID: g.PropertyID,
      Flat_No: g.Flat_No,
      Floor_No: g.Floor_No,
      OwnerID: g.OwnerID,
      Owner_Name: g.Owner_Name,
      Ownership_Start_Date: g.Ownership_Start_Date,
      Ownership_End_Date: g.Ownership_End_Date,
      Ownership_Status: g.Ownership_Status,
      Invoice_Count: g.Invoice_Count,
      Total_Billed: g.Total_Billed,
      Total_Paid: totalPaid,
      Outstanding: outstanding,
      Data_Link_Status: g.Data_Link_Status
    };
  })
    .filter(x => x.Outstanding > 0)
    .sort((a, b) => {
      const fA = a.Floor_No === "" || a.Floor_No === null || a.Floor_No === undefined ? Number.MAX_SAFE_INTEGER : Number(a.Floor_No);
      const fB = b.Floor_No === "" || b.Floor_No === null || b.Floor_No === undefined ? Number.MAX_SAFE_INTEGER : Number(b.Floor_No);
      const rankA = isFinite(fA) ? fA : (Number.MAX_SAFE_INTEGER - 1);
      const rankB = isFinite(fB) ? fB : (Number.MAX_SAFE_INTEGER - 1);
      if (rankA !== rankB) return rankA - rankB;
      return String(a.Flat_No || a.PropertyID || "").localeCompare(String(b.Flat_No || b.PropertyID || ""), undefined, { numeric: true, sensitivity: "base" });
    });

  const floorMap = {};
  data.forEach(r => {
    const fk = r.Floor_No === "" || r.Floor_No === null || r.Floor_No === undefined ? "__UNASSIGNED__" : String(r.Floor_No);
    if (!floorMap[fk]) {
      floorMap[fk] = {
        Floor_No: r.Floor_No,
        Ownership_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0
      };
    }
    floorMap[fk].Ownership_Count++;
    floorMap[fk].Total_Billed = fundMoney_(floorMap[fk].Total_Billed + r.Total_Billed);
    floorMap[fk].Total_Paid = fundMoney_(floorMap[fk].Total_Paid + r.Total_Paid);
    floorMap[fk].Outstanding = fundMoney_(floorMap[fk].Outstanding + r.Outstanding);
  });

  const totalOutstanding = fundMoney_(data.reduce((sum, x) => sum + x.Outstanding, 0));
  return {
    data,
    byFloor: Object.values(floorMap),
    summary: {
      ownershipCount: data.length,
      totalOutstanding,
      unlinkedInvoiceCount
    }
  };
}


const FUND_BALANCE_HEADERS_ = [
  "Balance_ID","FY_ID","FY_Name","Balance_Type","Bank_Account_ID","Account_Display_Name",
  "Opening_Balance","Total_Fund_Received","Total_Fund_Utilized","Other_Adjustment","Closing_Balance",
  "Actual_Closing_Balance","Reconciliation_Difference","Reconciliation_Status","Finalization_Status",
  "Prepared_By","Prepared_At","Reviewed_By","Reviewed_At","Finalized_By","Finalized_At","Remarks"
];
function fundBalanceSheet_(ss) {
  let sh=ss.getSheetByName("Fund Balance Register");
  if(!sh){sh=ss.insertSheet("Fund Balance Register");sh.getRange(1,1,1,FUND_BALANCE_HEADERS_.length).setValues([FUND_BALANCE_HEADERS_]);}
  else ensureHeaders_(sh,FUND_BALANCE_HEADERS_);
  return sh;
}
function clearFundBalanceCache_(societyCode){CacheService.getScriptCache().remove("FUND_BAL_"+sha256_(String(societyCode||"")));}
function fundDateKey_(v){
  if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone()||"Asia/Kolkata","yyyy-MM-dd");
  const s=String(v||"").trim();
  if(!s)return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  if(/^\d{4}\/\d{2}\/\d{2}$/.test(s))return s.replace(/\//g,"-");
  const dmy=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(dmy)return dmy[3]+"-"+dmy[2].padStart(2,"0")+"-"+dmy[1].padStart(2,"0");
  if(s.indexOf("T")>0||/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)){
    const d=new Date(s);
    if(!isNaN(d.getTime()))return Utilities.formatDate(d,Session.getScriptTimeZone()||"Asia/Kolkata","yyyy-MM-dd");
  }
  return s.slice(0,10);
}
function fundTodayKey_(){try{return Utilities.formatDate(new Date(),Session.getScriptTimeZone()||"Asia/Kolkata","yyyy-MM-dd");}catch(e){return new Date().toISOString().slice(0,10);}}
function fundMoney_(v){const n=Number(v||0);return isFinite(n)?Math.round(n*100)/100:0;}
function fundAccountKey_(value,accounts){
  const raw=String(value||"").trim().toLowerCase();if(!raw)return "UNMAPPED";
  for(let i=0;i<accounts.length;i++){
    const a=accounts[i];
    const candidates=[a.BankAccount_ID,a.Account_Name,a.Bank_Name,a.Account_Number,[a.Bank_Name,a.Account_Number].filter(Boolean).join(" ")]
      .map(x=>String(x||"").trim().toLowerCase()).filter(Boolean);
    if(candidates.includes(raw))return String(a.BankAccount_ID);
  }
  return "UNMAPPED";
}
function fundRowsForYear_(ss,fy,previousRows,initialCashOpening){
  const start=fundDateKey_(fy.Start_Date),end=fundDateKey_(fy.End_Date);
  const accounts=sheetObjects_(ss.getSheetByName("Bank Account Master"));
  const receipts=sheetObjects_(ss.getSheetByName("Fund Inflow Register")).filter(r=>String(r.Receipt_Status||"").toLowerCase()==="confirmed"&&fundDateKey_(r.Date_Of_Received)>=start&&fundDateKey_(r.Date_Of_Received)<=end);
  const expenses=sheetObjects_(ss.getSheetByName("Expense Register")).filter(e=>String(e.Expense_Status||"").toLowerCase()==="paid"&&fundDateKey_(e.Payment_Date)>=start&&fundDateKey_(e.Payment_Date)<=end);
  const existingByKey={};(previousRows||[]).forEach(r=>{existingByKey[String(r.Balance_Type)+"|"+String(r.Bank_Account_ID||"")]=r;});
  const receiptTotals={},expenseTotals={},unmapped={receipt:0,expense:0};
  receipts.forEach(r=>{const mode=String(r.Received_Mode||"").toLowerCase();const key=mode==="cash"?"CASH":fundAccountKey_(r.Bank_Account,accounts);const amount=fundMoney_(r.Received_Amount);if(key==="UNMAPPED")unmapped.receipt+=amount;receiptTotals[key]=(receiptTotals[key]||0)+amount;});
  expenses.forEach(e=>{const mode=String(e.Payment_Mode||"").toLowerCase();const key=mode==="cash"?"CASH":fundAccountKey_(e.Bank_Account,accounts);const amount=fundMoney_(e.Payment_Amount);if(key==="UNMAPPED")unmapped.expense+=amount;expenseTotals[key]=(expenseTotals[key]||0)+amount;});
  const keys=[{key:"CASH",type:"Cash",id:"",name:"Cash in Hand",account:null},...accounts.map(a=>({key:String(a.BankAccount_ID),type:"Bank",id:String(a.BankAccount_ID),name:String(a.Account_Name||a.Bank_Name||a.BankAccount_ID),account:a}))];
  if((receiptTotals.UNMAPPED||0)||(expenseTotals.UNMAPPED||0))keys.push({key:"UNMAPPED",type:"Unmapped",id:"",name:"Unmapped Bank Transactions",account:null});
  return keys.map(k=>{
    const prev=existingByKey[k.type+"|"+k.id]||existingByKey[(k.type==="Cash"?"Cash":"Bank")+"|"+k.id];
    const opening=prev?fundMoney_(prev.Closing_Balance):(previousRows&&previousRows.length?0:(k.type==="Bank"?fundMoney_(k.account&&k.account.Opening_Balance):k.type==="Cash"?fundMoney_(initialCashOpening):0));
    const received=fundMoney_(receiptTotals[k.key]||0),paid=fundMoney_(expenseTotals[k.key]||0),closing=fundMoney_(opening+received-paid);
    return {Balance_Type:k.type,Bank_Account_ID:k.id,Account_Display_Name:k.name,Opening_Balance:opening,Total_Fund_Received:received,Total_Fund_Utilized:paid,Other_Adjustment:0,Closing_Balance:closing,Actual_Closing_Balance:"",Reconciliation_Difference:"",Reconciliation_Status:"Pending",Finalization_Status:"Draft",Unmapped_Receipt_Amount:k.key==="UNMAPPED"?unmapped.receipt:0,Unmapped_Expense_Amount:k.key==="UNMAPPED"?unmapped.expense:0};
  });
}
function getYearEndContext_(ss,fyId){
  const years=sheetObjects_(ss.getSheetByName("Financial Year Master")).sort((a,b)=>fundDateKey_(a.Start_Date).localeCompare(fundDateKey_(b.Start_Date)));
  const fy=years.find(x=>String(x.FY_ID)===String(fyId));if(!fy)throw new Error("Selected Financial Year was not found.");
  const previous=years.filter(x=>fundDateKey_(x.End_Date)<fundDateKey_(fy.Start_Date)).sort((a,b)=>fundDateKey_(b.End_Date).localeCompare(fundDateKey_(a.End_Date)))[0]||null;
  const next=years.filter(x=>fundDateKey_(x.Start_Date)>fundDateKey_(fy.End_Date)).sort((a,b)=>fundDateKey_(a.Start_Date).localeCompare(fundDateKey_(b.Start_Date)))[0]||null;
  const sh=fundBalanceSheet_(ss),all=sheetObjects_(sh),current=all.filter(x=>String(x.FY_ID)===String(fy.FY_ID));
  const prevRows=previous?all.filter(x=>String(x.FY_ID)===String(previous.FY_ID)):[];
  if(previous&&(!prevRows.length||prevRows.some(x=>String(x.Finalization_Status)!=="Finalized")))throw new Error("The previous Financial Year must be finalized before this year can be prepared.");
  return {fy,previous,next,sh,all,current,prevRows,years};
}
function buildYearEndPreview_(ss,fyId,initialCashOpening){
  const c=getYearEndContext_(ss,fyId);
  if(c.current.length&&c.current.every(x=>String(x.Finalization_Status)==="Finalized"))return {fy:c.fy,previous:c.previous,next:c.next,rows:c.current,alreadyFinalized:true,canFinalize:false,unmappedTotal:0};
  let rows=fundRowsForYear_(ss,c.fy,c.prevRows,initialCashOpening);
  // If this FY already has a carried-forward opening, preserve it; never overwrite an approved opening.
  const currentByKey={};c.current.forEach(x=>currentByKey[String(x.Balance_Type)+"|"+String(x.Bank_Account_ID||"")]=x);
  rows=rows.map(r=>{const old=currentByKey[r.Balance_Type+"|"+r.Bank_Account_ID];return old?{...r,Opening_Balance:fundMoney_(old.Opening_Balance)}:r;});
  const unmappedTotal=rows.filter(r=>r.Balance_Type==="Unmapped").reduce((a,r)=>a+Number(r.Total_Fund_Received||0)+Number(r.Total_Fund_Utilized||0),0);
  return {fy:c.fy,previous:c.previous,next:c.next,rows,alreadyFinalized:false,canFinalize:fundDateKey_(c.fy.End_Date)<fundTodayKey_(),unmappedTotal};
}
function getYearEndClosingPreview_(session,body){
  requireRole_(session,["Admin"]);const ss=SpreadsheetApp.openById(session.databaseId);
  const preview=buildYearEndPreview_(ss,cleanText_(body.fyId,100),body.initialCashOpening);
  return json_({status:"success",data:preview,generatedAt:new Date().toISOString(),source:"Fund Balance Register + Fund Inflow Register + Expense Register"});
}
function getFundBalanceSummary_(session,body){
  requireRole_(session,["Admin","Accountant","Committee"]);
  const cache=CacheService.getScriptCache();
  const cacheKey="FUND_BAL_"+sha256_(String(session.societyCode||""));
  const cached=cache.get(cacheKey);
  if(cached){try{return json_(JSON.parse(cached));}catch(e){cache.remove(cacheKey);}}
  const ss=SpreadsheetApp.openById(session.databaseId);
  const years=sheetObjects_(ss.getSheetByName("Financial Year Master"));const today=fundTodayKey_();
  const fy=years.find(x=>fundDateKey_(x.Start_Date)<=today&&fundDateKey_(x.End_Date)>=today)||years.find(x=>String(x.Is_Current).toLowerCase()==="true")||years.sort((a,b)=>fundDateKey_(b.Start_Date).localeCompare(fundDateKey_(a.Start_Date)))[0];
  if(!fy)return json_({status:"success",data:{fy:null,openingFundBalance:0,totalFundReceived:0,totalFundUtilized:0,availableFund:0,sourceStatus:"No Financial Year configured"}});
  const sh=fundBalanceSheet_(ss),rows=sheetObjects_(sh),current=rows.filter(x=>String(x.FY_ID)===String(fy.FY_ID));
  const opening=current.length?current.reduce((a,x)=>a+fundMoney_(x.Opening_Balance),0):0;
  const from=fundDateKey_(fy.Start_Date),to=fundDateKey_(fy.End_Date);
  const received=sheetObjects_(ss.getSheetByName("Fund Inflow Register")).filter(x=>String(x.Receipt_Status||"").toLowerCase()==="confirmed"&&fundDateKey_(x.Date_Of_Received)>=from&&fundDateKey_(x.Date_Of_Received)<=today&&fundDateKey_(x.Date_Of_Received)<=to).reduce((a,x)=>a+fundMoney_(x.Received_Amount),0);
  const paid=sheetObjects_(ss.getSheetByName("Expense Register")).filter(x=>String(x.Expense_Status||"").toLowerCase()==="paid"&&fundDateKey_(x.Payment_Date)>=from&&fundDateKey_(x.Payment_Date)<=today&&fundDateKey_(x.Payment_Date)<=to).reduce((a,x)=>a+fundMoney_(x.Payment_Amount),0);
  const prev=years.filter(x=>fundDateKey_(x.End_Date)<from).sort((a,b)=>fundDateKey_(b.End_Date).localeCompare(fundDateKey_(a.End_Date)))[0];
  let effectiveOpening=opening,sourceStatus=current.length?"Fund Balance Register": "Opening balance not finalized";
  if(!current.length&&prev){const prevRows=rows.filter(x=>String(x.FY_ID)===String(prev.FY_ID));if(prevRows.length&&prevRows.every(x=>String(x.Finalization_Status)==="Finalized")){effectiveOpening=prevRows.reduce((a,x)=>a+fundMoney_(x.Closing_Balance),0);sourceStatus="Previous FY finalized closing balance";}}
  if(!current.length&&!prev){effectiveOpening=sheetObjects_(ss.getSheetByName("Bank Account Master")).reduce((a,x)=>a+fundMoney_(x.Opening_Balance),0);sourceStatus="Initial Bank Account Master opening balances; cash opening defaults to zero";}
  const payload={status:"success",data:{fy,openingFundBalance:fundMoney_(effectiveOpening),totalFundReceived:fundMoney_(received),totalFundUtilized:fundMoney_(paid),availableFund:fundMoney_(effectiveOpening+received-paid),sourceStatus,generatedAt:new Date().toISOString()}};
  const serialized=JSON.stringify(payload);if(serialized.length<=95000)cache.put(cacheKey,serialized,20);
  return json_(payload);
}
function finalizeYearEndClosing_(session,body){
  requireRole_(session,["Admin"]);const op=requireOperationId_(body),fyId=cleanText_(body.fyId,100),submitted=Array.isArray(body.rows)?body.rows:[];
  if(!fyId||!submitted.length||submitted.length>100)throw new Error("Select a Financial Year and provide its reconciliation rows.");
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const ss=SpreadsheetApp.openById(session.databaseId),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("A previous closing operation is incomplete; contact Admin before retrying.");
    const preview=buildYearEndPreview_(ss,fyId,body.initialCashOpening);if(preview.alreadyFinalized)throw new Error("This Financial Year has already been finalized.");
    if(!preview.canFinalize)throw new Error("The Financial Year end date has not passed. Closing cannot be finalized early.");
    const byKey={};submitted.forEach(r=>{byKey[String(r.Balance_Type)+"|"+String(r.Bank_Account_ID||"")]=r;});
    const rows=preview.rows.map(p=>{
      const r=byKey[p.Balance_Type+"|"+p.Bank_Account_ID];if(!r)throw new Error("Missing reconciliation for "+p.Account_Display_Name);
      if(p.Balance_Type==="Unmapped"&&(p.Total_Fund_Received||p.Total_Fund_Utilized))throw new Error("Unmapped bank transactions must be corrected before finalization.");
      const actual=Number(r.Actual_Closing_Balance);if(!isFinite(actual)||actual<0)throw new Error("Enter a valid actual closing balance for "+p.Account_Display_Name);
      const diff=fundMoney_(actual-p.Closing_Balance);if(Math.abs(diff)>0.009)throw new Error("Reconciliation difference for "+p.Account_Display_Name+" is not zero. Correct source entries or reconcile before finalizing.");
      return {...p,Actual_Closing_Balance:fundMoney_(actual),Reconciliation_Difference:diff,Reconciliation_Status:"Matched",Finalization_Status:"Finalized"};
    });
    const sh=fundBalanceSheet_(ss),existing=sheetObjects_(sh).filter(x=>String(x.FY_ID)===fyId);
    existing.forEach(x=>{if(String(x.Finalization_Status)==="Finalized")throw new Error("A finalized balance row cannot be changed.");});
    const nextExisting=preview.next?sheetObjects_(sh).filter(x=>String(x.FY_ID)===String(preview.next.FY_ID)):[];
    if(nextExisting.some(x=>String(x.Finalization_Status)==="Finalized"))throw new Error("Next Financial Year is already finalized; carry-forward cannot be overwritten.");
    writeOperation_(ledger,op,"finalizeYearEndClosing",fyId,"STARTED",{});
    const preparedAt=new Date();
    rows.forEach(r=>{
      const record={...r,Balance_ID:"FBR-"+randomHex_(8).toUpperCase(),FY_ID:fyId,FY_Name:preview.fy.FY_Name,Prepared_By:session.userId,Prepared_At:preparedAt,Reviewed_By:session.userId,Reviewed_At:preparedAt,Finalized_By:session.userId,Finalized_At:preparedAt,Remarks:cleanText_(body.remarks,500)};
      const old=existing.find(x=>String(x.Balance_Type)===String(r.Balance_Type)&&String(x.Bank_Account_ID||"")===String(r.Bank_Account_ID||""));
      if(old)updateByHeaders_(sh,old.__row,record,["Balance_ID","FY_ID","FY_Name","Balance_Type","Bank_Account_ID","Opening_Balance"]);else appendByHeaders_(sh,record);
    });
    // Create next FY's carried-forward opening rows only; receipt/payment totals remain zero.
    if(preview.next){
      rows.forEach(r=>{
        const old=nextExisting.find(x=>String(x.Balance_Type)===String(r.Balance_Type)&&String(x.Bank_Account_ID||"")===String(r.Bank_Account_ID||""));
        const carry={Balance_ID:"FBR-"+randomHex_(8).toUpperCase(),FY_ID:preview.next.FY_ID,FY_Name:preview.next.FY_Name,Balance_Type:r.Balance_Type,Bank_Account_ID:r.Bank_Account_ID,Account_Display_Name:r.Account_Display_Name,Opening_Balance:r.Closing_Balance,Total_Fund_Received:0,Total_Fund_Utilized:0,Other_Adjustment:0,Closing_Balance:r.Closing_Balance,Actual_Closing_Balance:"",Reconciliation_Difference:"",Reconciliation_Status:"Pending",Finalization_Status:"Opening Carried Forward",Prepared_By:session.userId,Prepared_At:preparedAt,Remarks:"Auto-carried from "+preview.fy.FY_Name};
        if(old)updateByHeaders_(sh,old.__row,carry,["Balance_ID","FY_ID","FY_Name","Balance_Type","Bank_Account_ID"]);else appendByHeaders_(sh,carry);
      });
    }
    const result={fyId,fyName:preview.fy.FY_Name,rowCount:rows.length,closingBalance:fundMoney_(rows.reduce((a,x)=>a+x.Closing_Balance,0)),nextFY:preview.next?preview.next.FY_Name:null,status:"Finalized"};
    writeOperation_(ledger,op,"finalizeYearEndClosing",fyId,"DONE",result);clearFundBalanceCache_(session.societyCode);auditEvent_(session,"FINALIZE","Fund Balance Register",fyId,"Year-end closing finalized and next FY opening carried forward","",result);
    return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}

function invoiceDueDetails_(invoiceRows, receiptRows, billRows) {
  const confirmedTxn = {};
  (receiptRows || []).forEach(r => {
    const txnId = String(r.Transaction_ID || "").trim();
    if (String(r.Receipt_Status || r.Status || "").trim().toLowerCase() === "confirmed" && txnId) {
      confirmedTxn[txnId] = true;
    }
  });
  const invoiceIdByNumber = {};
  (invoiceRows || []).forEach(inv => {
    const id = String(inv.InvoiceID || "").trim();
    const num = String(inv.Invoice_Number || "").trim();
    if (id && num) invoiceIdByNumber[num] = id;
  });
  const allocatedByInvoice = {};
  (billRows || []).forEach(b => {
    if (!confirmedTxn[String(b.Transaction_ID || "").trim()]) return;
    const id = String(b.InvoiceID || "").trim() || invoiceIdByNumber[String(b.Invoice_Number || "").trim()] || "";
    if (id) allocatedByInvoice[id] = fundMoney_((allocatedByInvoice[id] || 0) + fundMoney_(b.Allocated_Amount));
  });
  return (invoiceRows || []).map(inv => {
    const statusRaw = String(inv.Invoice_Status || "").trim().toLowerCase();
    const excluded = ["cancelled", "draft", "pending_approval", "pending approval"].includes(statusRaw);
    const id = String(inv.InvoiceID || "").trim();
    const net = fundMoney_(inv.Net_Charge_Amount);
    const hasAlloc = Object.prototype.hasOwnProperty.call(allocatedByInvoice, id);
    const paid = excluded ? 0 : Math.min(net, Math.max(0, hasAlloc ? allocatedByInvoice[id] : fundMoney_(inv.Paid_Amount)));
    const rawDue = inv.Outstanding_Amount;
    const due = excluded ? 0 : (hasAlloc || rawDue === "" || rawDue === null || rawDue === undefined ? Math.max(0, fundMoney_(net - paid)) : Math.max(0, fundMoney_(rawDue)));
    return { inv, excluded, net, paid, due };
  });
}

function openingBalanceAtDate_(ss, fromDate) {
  const years = sheetObjects_(ss.getSheetByName("Financial Year Master")).sort((a, b) => fundDateKey_(a.Start_Date).localeCompare(fundDateKey_(b.Start_Date)));
  const target = fundDateKey_(fromDate) || fundTodayKey_();
  const fy = years.find(x => fundDateKey_(x.Start_Date) <= target && fundDateKey_(x.End_Date) >= target)
    || years.find(x => String(x.Is_Current).toLowerCase() === "true")
    || years[years.length - 1]
    || null;
  const fbrSheet = fundBalanceSheet_(ss);
  const fbrRows = sheetObjects_(fbrSheet);
  let fyOpening = 0;
  let openingSource = "Bank Account Master";
  let fyStart = "";
  if (fy) {
    fyStart = fundDateKey_(fy.Start_Date);
    const current = fbrRows.filter(x => String(x.FY_ID) === String(fy.FY_ID));
    if (current.length) {
      fyOpening = current.reduce((a, x) => a + fundMoney_(x.Opening_Balance), 0);
      openingSource = "Fund Balance Register";
    } else {
      const prev = years.filter(x => fundDateKey_(x.End_Date) < fyStart).sort((a, b) => fundDateKey_(b.End_Date).localeCompare(fundDateKey_(a.End_Date)))[0];
      const prevRows = prev ? fbrRows.filter(x => String(x.FY_ID) === String(prev.FY_ID)) : [];
      if (prevRows.length && prevRows.every(x => String(x.Finalization_Status) === "Finalized")) {
        fyOpening = prevRows.reduce((a, x) => a + fundMoney_(x.Closing_Balance), 0);
        openingSource = "Previous FY Finalized Closing";
      } else {
        fyOpening = sheetObjects_(ss.getSheetByName("Bank Account Master")).reduce((a, x) => a + fundMoney_(x.Opening_Balance), 0);
      }
    }
  } else {
    fyOpening = sheetObjects_(ss.getSheetByName("Bank Account Master")).reduce((a, x) => a + fundMoney_(x.Opening_Balance), 0);
  }
  let priorIn = 0, priorOut = 0;
  if (fyStart && target > fyStart) {
    priorIn = sheetObjects_(ss.getSheetByName("Fund Inflow Register"))
      .filter(x => String(x.Receipt_Status || x.Status || "").trim().toLowerCase() === "confirmed")
      .filter(x => { const d = fundDateKey_(x.Date_Of_Received); return d >= fyStart && d < target; })
      .reduce((a, x) => a + fundMoney_(x.Received_Amount), 0);
    priorOut = sheetObjects_(ss.getSheetByName("Expense Register"))
      .filter(x => String(x.Expense_Status || "").trim().toLowerCase() === "paid")
      .filter(x => { const d = fundDateKey_(x.Payment_Date); return d >= fyStart && d < target; })
      .reduce((a, x) => a + fundMoney_(x.Payment_Amount), 0);
  }
  return { fy, fyOpening: fundMoney_(fyOpening), openingBalance: fundMoney_(fyOpening + priorIn - priorOut), openingSource };
}

function getReports_(session, body) {
  requirePermission_(session,"Reports","Can_View");
  const type=String(body.reportType||"");
  if(["Admin","Accountant","Committee"].indexOf(session.role)<0) throw new Error("Permission denied.");
  const ss = SpreadsheetApp.openById(session.databaseId);
  if(type==="outstanding") {
    const invoiceSheet = ss.getSheetByName("Invoice_Register") || ss.getSheetByName("Invoice Register");
    const invoiceRows = invoiceSheet ? sheetObjects_(invoiceSheet) : [];
    const propRows = sheetObjects_(ss.getSheetByName("Property Master"));
    const ownerRows = sheetObjects_(ss.getSheetByName("Owner Master"));
    const ownHistory = sheetObjects_(ss.getSheetByName("Ownership History"));
    const receiptRows = sheetObjects_(ss.getSheetByName("Fund Inflow Register"));
    const billRows = sheetObjects_(ss.getSheetByName("Bill Wise Details"));
    const ownerById = {}; ownerRows.forEach(o => { if (o.OwnerID) ownerById[String(o.OwnerID)] = o; });
    const currentOwnByProp = {};
    ownHistory.forEach(h => {
      if (String(h.PropertyID || "") && String(h.Ownership_Status || "").trim().toLowerCase() === "current") {
        currentOwnByProp[String(h.PropertyID)] = h;
      }
    });
    const grouped={};
    propRows.forEach(p => {
      const pid = String(p.PropertyID || "");
      if (!pid) return;
      const curOwn = currentOwnByProp[pid] || {};
      const ownRec = ownerById[String(curOwn.OwnerID || "")] || {};
      grouped[pid] = {
        PropertyID: pid,
        Flat_No: p.Flat_No || p["Flat No."] || "",
        Block_Tower: p.Block_Tower || p["Block / Tower"] || "",
        Owner_Name: ownRec.Owner_Name || "",
        Invoice_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0
      };
    });
    invoiceDueDetails_(invoiceRows, receiptRows, billRows).forEach(({ inv, excluded, net, paid, due }) => {
      if (excluded) return;
      const k = String(inv.PropertyID || "");
      if (!k) return;
      if (!grouped[k]) {
        grouped[k] = {
          PropertyID: k,
          Flat_No: inv.Flat_Number || inv.Flat_No || "",
          Block_Tower: "",
          Owner_Name: inv.Owner_Name || (ownerById[String(inv.OwnerID || "")] || {}).Owner_Name || "",
          Invoice_Count: 0,
          Total_Billed: 0,
          Total_Paid: 0,
          Outstanding: 0
        };
      }
      if (!grouped[k].Owner_Name) {
        grouped[k].Owner_Name = inv.Owner_Name || (ownerById[String(inv.OwnerID || "")] || {}).Owner_Name || "";
      }
      grouped[k].Invoice_Count++;
      grouped[k].Total_Billed = fundMoney_(grouped[k].Total_Billed + net);
      grouped[k].Total_Paid = fundMoney_(grouped[k].Total_Paid + paid);
      grouped[k].Outstanding = fundMoney_(grouped[k].Outstanding + due);
    });
    const data=Object.values(grouped).sort((a,b)=>(b.Outstanding-a.Outstanding)||String(a.Flat_No).localeCompare(String(b.Flat_No)));
    const pendingCount = data.filter(x => x.Outstanding > 0).length;
    return json_({status:"success",reportType:type,data,summary:{propertyCount:data.length,pendingCount,totalOutstanding:fundMoney_(data.reduce((a,x)=>a+x.Outstanding,0))},generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="receiptPayment") {
    const from=fundDateKey_(body.fromDate||"0000-01-01")||"0000-01-01";
    const to=fundDateKey_(body.toDate||"9999-12-31")||"9999-12-31";
    const receipts=sheetObjects_(ss.getSheetByName("Fund Inflow Register"))
      .filter(x=>String(x.Receipt_Status||x.Status||"").trim().toLowerCase()==="confirmed")
      .filter(x=>{const d=fundDateKey_(x.Date_Of_Received);return d&&d>=from&&d<=to;})
      .map(x=>({Transaction_ID:x.Transaction_ID,Receipt_Number:x.Receipt_Number,Date_Of_Received:fundDateKey_(x.Date_Of_Received),PropertyID:x.PropertyID,Flat_No:x.Flat_No,Owner_Name:x.Owner_Name,Received_Amount:fundMoney_(x.Received_Amount),Received_Mode:x.Received_Mode,Bank_Account:x.Bank_Account}));
    const expenses=sheetObjects_(ss.getSheetByName("Expense Register"))
      .filter(x=>String(x.Expense_Status||"").trim().toLowerCase()==="paid")
      .filter(x=>{const d=fundDateKey_(x.Payment_Date);return d&&d>=from&&d<=to;})
      .map(x=>({Expense_ID:x.Expense_ID,Voucher_No:x.Voucher_No,Payment_Date:fundDateKey_(x.Payment_Date),Expense_Category:x.Expense_Category,Payee_Name:x.Payee_Name,Payment_Amount:fundMoney_(x.Payment_Amount),Payment_Mode:x.Payment_Mode,Bank_Account:x.Bank_Account}));
    const totalIn=fundMoney_(receipts.reduce((a,x)=>a+x.Received_Amount,0));
    const totalOut=fundMoney_(expenses.reduce((a,x)=>a+x.Payment_Amount,0));
    const ob=openingBalanceAtDate_(ss,from);
    const closingBalance=fundMoney_(ob.openingBalance+totalIn-totalOut);
    const reportData={openingBalance:ob.openingBalance,openingSource:ob.openingSource,closingBalance,receiptCount:receipts.length,expenseCount:expenses.length,receipts,expenses,totalReceipts:totalIn,totalPayments:totalOut,netCashMovement:fundMoney_(totalIn-totalOut)};
    return json_({status:"success",reportType:type,period:{from,to},data:reportData,generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="ownerOutstanding") {
    const invoiceSheet = ss.getSheetByName("Invoice_Register") || ss.getSheetByName("Invoice Register");
    const invoiceRows = invoiceSheet ? sheetObjects_(invoiceSheet) : [];
    const ownerRows = sheetObjects_(ss.getSheetByName("Owner Master"));
    const propRows = sheetObjects_(ss.getSheetByName("Property Master"));
    const receiptRows = sheetObjects_(ss.getSheetByName("Fund Inflow Register"));
    const billRows = sheetObjects_(ss.getSheetByName("Bill Wise Details"));
    const ownerById = {}; ownerRows.forEach(o => { if (o.OwnerID) ownerById[String(o.OwnerID)] = o; });
    const propById = {}; propRows.forEach(p => { if (p.PropertyID) propById[String(p.PropertyID)] = p; });
    const grouped={};
    invoiceDueDetails_(invoiceRows, receiptRows, billRows).forEach(({ inv, excluded, net, paid, due }) => {
      if (excluded || !(due > 0)) return;
      const k = String(inv.OwnerID || inv.Owner_Name || inv.PropertyID || "UNMAPPED");
      const ownerRec = ownerById[String(inv.OwnerID || "")] || {};
      const propRec = propById[String(inv.PropertyID || "")] || {};
      if (!grouped[k]) grouped[k] = { OwnerID: String(inv.OwnerID || "—"), Owner_Name: inv.Owner_Name || ownerRec.Owner_Name || "Registered Owner", _props: {}, Flat_Numbers: "", Property_Count: 0, Invoice_Count: 0, Total_Billed: 0, Total_Paid: 0, Outstanding: 0 };
      const pid = String(inv.PropertyID || "");
      if (pid) grouped[k]._props[pid] = String(inv.Flat_Number || inv.Flat_No || propRec.Flat_No || pid);
      grouped[k].Invoice_Count++;
      grouped[k].Total_Billed = fundMoney_(grouped[k].Total_Billed + net);
      grouped[k].Total_Paid = fundMoney_(grouped[k].Total_Paid + paid);
      grouped[k].Outstanding = fundMoney_(grouped[k].Outstanding + due);
    });
    const data = Object.values(grouped).map(g => {
      const flats = Object.values(g._props);
      return { OwnerID: g.OwnerID, Owner_Name: g.Owner_Name, Property_Count: flats.length, Flat_Numbers: flats.join(", "), Invoice_Count: g.Invoice_Count, Total_Billed: g.Total_Billed, Total_Paid: g.Total_Paid, Outstanding: g.Outstanding };
    }).sort((a,b) => b.Outstanding - a.Outstanding);
    return json_({status:"success",reportType:type,data,summary:{ownerCount:data.length,totalOutstanding:fundMoney_(data.reduce((a,x)=>a+x.Outstanding,0))},generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="ownershipOutstanding") {
    const invCtx = societySheet_(session,"Invoice_Register");
    const invoiceRows = sheetObjects_(invCtx.sh);
    const ownershipRows = sheetObjects_(societySheet_(session,"Ownership History").sh);
    const propertyRows = sheetObjects_(societySheet_(session,"Property Master").sh);
    const ownerRows = sheetObjects_(societySheet_(session,"Owner Master").sh);
    const receiptRows = sheetObjects_(invCtx.ss.getSheetByName("Fund Inflow Register"));
    const billRows = sheetObjects_(invCtx.ss.getSheetByName("Bill Wise Details"));
    const result = buildOwnershipOutstandingRows_(invoiceRows, ownershipRows, propertyRows, ownerRows, receiptRows, billRows);
    return json_({
      status:"success",
      reportType:type,
      data:result.data,
      summary:result.summary,
      generatedAt:new Date().toISOString(),
      auditStatus:"system-generated",
      note:"Outstanding is grouped by Ownership_ID with Paid amounts linked to Confirmed receipts in Fund Inflow Register and allocations in Bill Wise Details. Unlinked legacy invoices are shown separately and require manual ownership verification."
    });
  }
  if(type==="expenseSummary") {
    const from=fundDateKey_(body.fromDate||"0000-01-01")||"0000-01-01";
    const to=fundDateKey_(body.toDate||"9999-12-31")||"9999-12-31";
    const rows=sheetObjects_(ss.getSheetByName("Expense Register"))
      .filter(x=>String(x.Expense_Status||"").trim().toLowerCase()==="paid")
      .filter(x=>{const d=fundDateKey_(x.Payment_Date);return d&&d>=from&&d<=to;});
    const grouped={};
    rows.forEach(x=>{
      const k=String(x.Expense_Category||"Uncategorized");
      if(!grouped[k])grouped[k]={Category:k,Count:0,Total:0};
      grouped[k].Count++;
      grouped[k].Total=fundMoney_(grouped[k].Total+fundMoney_(x.Payment_Amount));
    });
    const data=Object.values(grouped).sort((a,b)=>b.Total-a.Total);
    return json_({status:"success",reportType:type,period:{from,to},data,summary:{voucherCount:rows.length,totalPaid:fundMoney_(data.reduce((a,x)=>a+x.Total,0))},generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="financialYear") {
    const from=fundDateKey_(body.fromDate||"0000-01-01")||"0000-01-01";
    const to=fundDateKey_(body.toDate||"9999-12-31")||"9999-12-31";
    const invoiceSheet=ss.getSheetByName("Invoice_Register")||ss.getSheetByName("Invoice Register");
    const invoiceRows=invoiceSheet?sheetObjects_(invoiceSheet):[];
    const receiptRows=sheetObjects_(ss.getSheetByName("Fund Inflow Register"));
    const billRows=sheetObjects_(ss.getSheetByName("Bill Wise Details"));
    const filteredInv=invoiceDueDetails_(invoiceRows,receiptRows,billRows).filter(({inv,excluded})=>{
      if(excluded)return false;
      const d=fundDateKey_(inv.Billing_Date);
      return d&&d>=from&&d<=to;
    });
    const receipts=receiptRows.filter(x=>String(x.Receipt_Status||x.Status||"").trim().toLowerCase()==="confirmed").filter(x=>{const d=fundDateKey_(x.Date_Of_Received);return d&&d>=from&&d<=to;});
    const expenses=sheetObjects_(ss.getSheetByName("Expense Register")).filter(x=>String(x.Expense_Status||"").trim().toLowerCase()==="paid").filter(x=>{const d=fundDateKey_(x.Payment_Date);return d&&d>=from&&d<=to;});
    const ob=openingBalanceAtDate_(ss,from);
    const totalReceipts=fundMoney_(receipts.reduce((a,x)=>a+fundMoney_(x.Received_Amount),0));
    const totalPaidExpenses=fundMoney_(expenses.reduce((a,x)=>a+fundMoney_(x.Payment_Amount),0));
    return json_({status:"success",reportType:type,period:{from,to},data:{fyName:ob.fy?ob.fy.FY_Name:"",openingFundBalance:ob.openingBalance,openingSource:ob.openingSource,closingFundBalance:fundMoney_(ob.openingBalance+totalReceipts-totalPaidExpenses),invoiceCount:filteredInv.length,receiptCount:receipts.length,expenseCount:expenses.length,billed:fundMoney_(filteredInv.reduce((a,x)=>a+x.net,0)),receipts:totalReceipts,paidExpenses:totalPaidExpenses,outstanding:fundMoney_(filteredInv.reduce((a,x)=>a+x.due,0))},generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="balanceSheet") {
    const journal=ss.getSheetByName("_Journal Ledger");
    const snapshots=ss.getSheetByName("Report Snapshot Register");
    const accountHeadSheet=ss.getSheetByName("Account Head Master");
    const asOfDate=fundDateKey_(body.asOfDate||"9999-12-31")||"9999-12-31";
    const posted=journal?sheetObjects_(journal).filter(x=>String(x.Status)==="Posted"&&fundDateKey_(x.Journal_Date)<=asOfDate):[];
    const accounts={};
    posted.forEach(x=>{
      const key=String(x.Account_Name||"Unmapped");
      if(!accounts[key])accounts[key]={Account_Code:String(x.Account_Code||""),Account_Name:key,Account_Type:String(x.Account_Type||"Unclassified"),Debit:0,Credit:0,Net:0};
      accounts[key].Debit+=Number(x.Debit||0);accounts[key].Credit+=Number(x.Credit||0);
    });
    const rows=Object.values(accounts);
    rows.forEach(x=>x.Net=x.Debit-x.Credit);
    const totalDebit=rows.reduce((a,x)=>a+x.Debit,0),totalCredit=rows.reduce((a,x)=>a+x.Credit,0);
    const assetTotal=rows.filter(x=>x.Account_Type==="Asset").reduce((a,x)=>a+x.Net,0);
    const liabilityTotal=rows.filter(x=>x.Account_Type==="Liability").reduce((a,x)=>a-x.Net,0);
    const equityBase=rows.filter(x=>["Equity","Fund"].includes(x.Account_Type)).reduce((a,x)=>a-x.Net,0);
    const income=rows.filter(x=>x.Account_Type==="Income").reduce((a,x)=>a-x.Net,0);
    const expenses=rows.filter(x=>x.Account_Type==="Expense").reduce((a,x)=>a+x.Net,0);
    const equityTotal=equityBase+income-expenses;
    const difference=Math.round((assetTotal-liabilityTotal-equityTotal)*100)/100;
    const hasOpeningBalances=posted.some(x=>x.Source_Type==="Opening Balance");
    const latest=snapshots?sheetObjects_(snapshots).filter(x=>x.Report_Type==="Balance Sheet"&&x.Status==="Approved").sort((a,b)=>String(b.Approved_At).localeCompare(String(a.Approved_At)))[0]:null;
    const accountHeads=accountHeadSheet?sheetObjects_(accountHeadSheet):[];
    return json_({status:"success",reportType:type,data:{accounts:rows,accountHeads,totalDebit,totalCredit,assetTotal,liabilityTotal,equityBase,income,expenses,equityTotal,difference,balanced:Math.abs(totalDebit-totalCredit)<0.01&&Math.abs(difference)<0.01,hasOpeningBalances,postedJournalCount:posted.length},generatedAt:new Date().toISOString(),auditStatus:latest?"latest-approved-snapshot-exists":"draft-unapproved",latestApprovedSnapshot:latest||null,warning:"Internal system-generated statement. It is not an independent statutory audit; confirm account mapping and opening balances with your auditor."});
  }
  throw new Error("Unsupported report type.");
}

function createReportSnapshot_(session, body) {
  requireRole_(session,["Admin","Accountant"]);
  const type=String(body.reportType||"");
  if(type!=="Balance Sheet") throw new Error("Only Balance Sheet snapshots are supported by this approval workflow.");
  const asOfDate=cleanText_(body.asOfDate,20)||new Date().toISOString().slice(0,10);
  const report=JSON.parse(getReports_(session,{reportType:"balanceSheet",asOfDate}).getContent());
  if(!report.data||!report.data.hasOpeningBalances) throw new Error("Opening balances must be posted before creating a Balance Sheet snapshot.");
  if(!report.data.balanced) throw new Error("Trial balance is not balanced; snapshot cannot be submitted.");
  const ss=SpreadsheetApp.openById(session.databaseId),sh=ensureInternalSheet_(ss,"Report Snapshot Register",["Snapshot_ID","Report_Type","As_Of_Date","Payload_JSON","Payload_SHA256","Created_By","Created_At","Status","Approved_By","Approved_At","Remarks"]);
  const id="RPT-"+randomHex_(8).toUpperCase(),payload=JSON.stringify(report.data),hash=sha256_(payload);
  appendByHeaders_(sh,{Snapshot_ID:id,Report_Type:type,As_Of_Date:asOfDate,Payload_JSON:payload,Payload_SHA256:hash,Created_By:session.userId,Created_At:new Date(),Status:"Pending Approval",Remarks:cleanText_(body.remarks,500)});
  auditEvent_(session,"CREATE","Report Snapshot Register",id,"Balance Sheet snapshot submitted for approval","",{hash,reportType:type});
  return json_({status:"success",data:{snapshotId:id,hash,status:"Pending Approval"}});
}

function listReportSnapshots_(session,body){
  requireRole_(session,["Admin","Accountant"]);
  const sh=SpreadsheetApp.openById(session.databaseId).getSheetByName("Report Snapshot Register");
  const rows=sh?sheetObjects_(sh):[];
  const safe=rows.slice(-100).reverse().map(x=>({Snapshot_ID:x.Snapshot_ID,Report_Type:x.Report_Type,As_Of_Date:x.As_Of_Date,Created_By:x.Created_By,Created_At:x.Created_At,Status:x.Status,Approved_By:x.Approved_By,Approved_At:x.Approved_At,Payload_SHA256:x.Payload_SHA256}));
  return json_({status:"success",data:safe});
}

function approveReportSnapshot_(session, body) {
  requireRole_(session,["Admin"]);
  const id=cleanText_(body.snapshotId,80),ss=SpreadsheetApp.openById(session.databaseId),sh=ensureInternalSheet_(ss,"Report Snapshot Register",["Snapshot_ID","Report_Type","As_Of_Date","Payload_JSON","Payload_SHA256","Created_By","Created_At","Status","Approved_By","Approved_At","Remarks"]);
  const f=rowById_(sh,"Snapshot_ID",id);if(!f)throw new Error("Report snapshot not found.");
  const r=objectFromRow_(f.headers,f.values);if(r.Status!=="Pending Approval")throw new Error("Only pending report snapshots can be approved.");
  if(String(r.Created_By)===String(session.userId))throw new Error("The creator cannot approve their own report snapshot.");
  if(sha256_(String(r.Payload_JSON||""))!==String(r.Payload_SHA256||""))throw new Error("Report snapshot hash verification failed.");
  updateByHeaders_(sh,f.row,{Status:"Approved",Approved_By:session.userId,Approved_At:new Date()},["Snapshot_ID","Payload_JSON","Payload_SHA256","Created_By","Created_At"]);
  auditEvent_(session,"APPROVE","Report Snapshot Register",id,"Balance Sheet snapshot approved",r,{Status:"Approved",Approved_By:session.userId});
  return json_({status:"success",data:{snapshotId:id,status:"Approved"}});
}


function residentCanAccessLinkedFile_(session,registered){
  const category=String(registered.Category||"").toLowerCase(),module=String(registered.Related_Module||""),recordId=String(registered.Related_Record_ID||"");
  if(String(registered.PropertyID)!==String(session.propertyId))return false;
  if(category==="kyc")return String(registered.Uploaded_By)===String(session.userId);
  if(["owner document","ownership document"].includes(category)){
    if(!registered.OwnerID)return false;
    const current=sheetObjects_(societySheet_(session,"Ownership History").sh).filter(x=>String(x.PropertyID)===String(session.propertyId)&&String(x.Ownership_Status)==="Current");
    return current.some(x=>String(x.OwnerID)===String(registered.OwnerID)&&String(x.Ownership_ID)===String(session.ownershipId)&&(!session.ownerId||String(session.ownerId)===String(x.OwnerID)));
  }
  if(category==="activity request attachment"){
    if(module!=="activityRequests"||!recordId)return String(registered.Uploaded_By)===String(session.userId);
    const sh=societySheet_(session,"Activity Request Register").sh,found=rowById_(sh,"Request_ID",recordId);if(!found)return false;
    const r=objectFromRow_(found.headers,found.values);
    return String(r.PropertyID)===String(session.propertyId)&&String(r.Requested_By)===String(session.userId);
  }
  if(category==="payment proof"){
    if(module!=="receipts"||!recordId)return String(registered.Uploaded_By)===String(session.userId);
    const sh=societySheet_(session,"Fund Inflow Register").sh,found=rowById_(sh,"Transaction_ID",recordId);if(!found)return false;
    const r=objectFromRow_(found.headers,found.values);
    return String(r.PropertyID)===String(session.propertyId)&&(!session.ownershipId||String(r.Ownership_ID)===String(session.ownershipId));
  }
  if(category==="invoice pdf"){
    if(module!=="invoices"||!recordId)return false;
    const sh=societySheet_(session,"Invoice_Register").sh,found=rowById_(sh,"InvoiceID",recordId);if(!found)return false;
    const r=objectFromRow_(found.headers,found.values);
    return String(r.PropertyID)===String(session.propertyId)&&(!session.ownershipId||String(r.Ownership_ID)===String(session.ownershipId));
  }
  if(category==="notice attachment"){
    if(module!=="notices"||!recordId)return false;
    const sh=societySheet_(session,"Notice Master").sh,found=rowById_(sh,"Notice_ID",recordId);if(!found)return false;
    const r=objectFromRow_(found.headers,found.values),visibility=String(r.Visibility||"");
    if(String(r.Notice_Status)!=="Published")return false;
    if(["All","All Residents","Residents Only"].includes(visibility))return true;
    if(visibility==="Owners Only")return sheetObjects_(societySheet_(session,"Ownership History").sh).some(x=>String(x.PropertyID)===String(session.propertyId)&&String(x.Ownership_Status)==="Current");
    if(visibility==="Tenants Only")return sheetObjects_(societySheet_(session,"Tenant Master").sh).some(x=>String(x.PropertyID)===String(session.propertyId)&&String(x.Status||"").toLowerCase()==="active");
    if(visibility==="Selected Properties"){
      const selected=String(r.Selected_Properties||r.PropertyID||"").split(/[,;|]/).map(x=>x.trim()).filter(Boolean);
      return selected.includes(String(session.propertyId));
    }
    return false;
  }
  if(category==="gallery photo"){
    if(!["gallery","galleryPhotos"].includes(module)||!recordId)return false;
    let galleryId=recordId;
    if(module==="galleryPhotos"){
      const pSh=ss.getSheetByName("Gallery_Photos")||ss.getSheetByName("Gallery Photos");
      const pFound=pSh?rowById_(pSh,"Photo_ID",recordId):null;
      if(!pFound)return false;
      const pRec=objectFromRow_(pFound.headers,pFound.values);
      if(["inactive","archived","deleted"].includes(String(pRec.Status||"").trim().toLowerCase()))return false;
      galleryId=String(pRec.Gallery_ID||"").trim();
      if(!galleryId)return false;
    }
    const sh=societySheet_(session,"Gallery Master").sh,found=rowById_(sh,"Gallery_ID",galleryId);if(!found)return false;
    const r=objectFromRow_(found.headers,found.values),visibility=String(r.Visibility||"");
    if(["Inactive","Archived"].includes(String(r.Status)))return false;
    return ["Public","Residents Only","All Residents"].includes(visibility);
  }
  return String(registered.Uploaded_By)===String(session.userId);
}

function listPrivateFiles_(session, body) {
  const ss=SpreadsheetApp.openById(session.databaseId),sh=ss.getSheetByName("_File Registry");
  if(!sh)return json_({status:"success",data:[]});
  let rows=sheetObjects_(sh);
  if(session.role==="Resident")rows=rows.filter(x=>residentCanAccessLinkedFile_(session,x)&&!["bank statement","expense voucher"].includes(String(x.Category||"").toLowerCase()));
  if(session.role==="Committee")rows=rows.filter(x=>!["kyc","owner document","ownership document","bank statement"].includes(String(x.Category||"").toLowerCase()));
  if(session.role==="Accountant")rows=rows.filter(x=>!["kyc","owner document","ownership document"].includes(String(x.Category||"").toLowerCase()));
  if(body.category)rows=rows.filter(x=>String(x.Category)===String(body.category));
  return json_({status:"success",data:rows.slice(-Math.min(200,Math.max(1,Number(body.limit)||100))).reverse()});
}

function ensureInternalSheet_(ss,name,headers) {
  let sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.hideSheet();}
  else if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);}
  return sh;
}

/**
 * Dashboard bootstrap: return all dashboard-required datasets in one authenticated
 * request. This avoids 8-12 separate mobile round trips and repeated Central Master
 * permission checks after login. Sensitive modules remain role-filtered server-side.
 */
function sheetObjectsTail_(sh,limit) {
  if(!sh)return [];
  const last=sh.getLastRow();
  if(last<2)return [];
  const count=Math.max(1,Math.min(Number(limit)||500,last-1));
  const start=Math.max(2,last-count+1);
  return sheetObjectsRange_(sh,start,last-start+1);
}

/**
 * Dashboard bootstrap. Frequently changing, append-only modules are bounded to
 * a practical recent window; invoices/properties/ownership remain complete so
 * outstanding and ownership-sensitive figures are not silently truncated.
 * A short role-scoped cache removes duplicate full dashboard reads during rapid
 * navigation/reload. Cache entries are bypassed automatically when too large.
 */

/** V6.0.4 role-aware dashboard endpoint. Role is derived from authenticated session only. */
function getRoleDashboardData_(session, body) {
  const started=Date.now();
  const role=String(session.role||"");
  const allowed=["Admin","Committee","Accountant","Resident"];
  if(!allowed.includes(role)) throw new Error("Unsupported authenticated role for dashboard.");
  const result=getDashboardData_(session,body||{});
  console.info("ABAS_ROLE_DASHBOARD_TIMING",JSON.stringify({role:role,elapsedMs:Date.now()-started}));
  return result;
}

function getDashboardData_(session,body) {
  const viewSession=residentViewSession_(session,body&&body.viewAsResident);
  const role = String(viewSession.role || "Resident");
  const cache=CacheService.getScriptCache();
  const cacheKey="DASH_"+sha256_(String(session.societyCode)+"|"+role+"|"+String(session.propertyId||"")+"|"+String(session.ownershipId||"")+"|"+String(session.ownerId||"")+"|"+Boolean(body&&body.viewAsResident));
  const cached=cache.get(cacheKey);
  if(cached){try{return json_(JSON.parse(cached));}catch(e){cache.remove(cacheKey);}}
  const ss = SpreadsheetApp.openById(session.databaseId);
  let keys = role === "Resident"
    ? ["properties","owners","ownershipHistory","invoices","receipts","billWiseDetails","activityRequests","notices","gallery","galleryPhotos","propertyUtilityDetails"]
    : ["properties","ownershipHistory","tenants","invoices","receipts","billWiseDetails",
       ...(role === "Admin" || role === "Committee" || role === "Accountant" ? ["activityRequests","expenses"] : []),
       "notices","gallery","galleryPhotos","preventiveMaintenance",
       ...(role === "Admin" || role === "Accountant" ? ["bankAccounts"] : [])];
  const recentLimits={activityRequests:250,notices:150,gallery:30,galleryPhotos:200,preventiveMaintenance:250};
  const data = {};
  keys=keys.filter(function(key){
    const moduleName=PERMISSION_MODULE_MAP_[key]||key;
    const granted=rolePermission_(session,moduleName,"Can_View",role) || (key==="receipts" && rolePermission_(session,"Fund Inflow","Can_View",role));
    if(!granted) console.warn("ABAS_PERMISSION_AUDIT",JSON.stringify({role:role,module:key,permission:"Can_View",result:"DENIED",reason:"Role permission not granted",societyCode:session.societyCode||""}));
    return granted;
  });
  keys.forEach(function(key) {
    authorizeModuleRead_(session, key, Boolean(body&&body.viewAsResident));
    const sheetName = MODULE_SHEETS[key];
    const aliases = key === "invoices" ? ["Invoice_Register","Invoice Register"] : key === "galleryPhotos" ? ["Gallery_Photos","Gallery Photos"] : [sheetName];
    let sh = null;
    for (let i = 0; i < aliases.length; i++) {
      sh = ss.getSheetByName(aliases[i]);
      if (sh) break;
    }
    if (!sh) { data[key] = []; return; }
    let rows;
    if(role==="Resident") {
      rows=residentModuleRecords_(viewSession,key,ss,sh);
      if(recentLimits[key]) rows=rows.slice(-recentLimits[key]);
    } else {
      rows=recentLimits[key]?sheetObjectsTail_(sh,recentLimits[key]):sheetObjects_(sh);
    }
    data[key] = rows;
  });
  const payload={status:"success",data:data,generatedAt:new Date().toISOString(),source:"live-google-sheets",cache:"20-second role-scoped"};
  const serialized=JSON.stringify(payload);
  if(serialized.length<=95000)cache.put(cacheKey,serialized,20);
  return json_(payload);
}

function getDashboardSummary_(session, body) {
  const viewSession = residentViewSession_(session, body && body.viewAsResident);
  const cache=CacheService.getScriptCache();
  const cacheKey="DASH_SUM_"+sha256_(String(viewSession.societyCode)+"|"+String(viewSession.role||"")+"|"+String(viewSession.propertyId||"")+"|"+String(viewSession.ownershipId||""));
  const cached=cache.get(cacheKey);
  if(cached){try{return json_(JSON.parse(cached));}catch(e){cache.remove(cacheKey);}}
  const ss = SpreadsheetApp.openById(viewSession.databaseId);
  const read = name => {const aliases={"Invoice_Register":["Invoice_Register","Invoice Register"]};const list=aliases[name]||[name];for(let i=0;i<list.length;i++){const sh=ss.getSheetByName(list[i]);if(sh)return sheetObjects_(sh);}return [];};
  const properties = rolePermission_(session,"Properties & Residents","Can_View",viewSession.role)?(viewSession.role==="Resident"?residentModuleRecords_(viewSession,"properties",ss,ss.getSheetByName("Property Master")):read("Property Master")):[];
  const invoiceSheet=ss.getSheetByName("Invoice_Register")||ss.getSheetByName("Invoice Register");
  const invoices = rolePermission_(session,"Maintenance & Invoices","Can_View",viewSession.role)?(viewSession.role==="Resident"?residentModuleRecords_(viewSession,"invoices",ss,invoiceSheet):read("Invoice_Register")):[];
  const receiptSheet=ss.getSheetByName("Fund Inflow Register"),requestSheet=ss.getSheetByName("Activity Request Register");
  const receipts = (rolePermission_(session,"Payments","Can_View",viewSession.role)||rolePermission_(session,"Fund Inflow","Can_View",viewSession.role))?(viewSession.role==="Resident"?residentModuleRecords_(viewSession,"receipts",ss,receiptSheet):read("Fund Inflow Register")):[];
  const requests = rolePermission_(session,"Activity Requests","Can_View",viewSession.role)?(viewSession.role==="Resident"?residentModuleRecords_(viewSession,"activityRequests",ss,requestSheet):read("Activity Request Register")):[];
  const paid = receipts.filter(r => String(r.Receipt_Status || r.Status || "").toLowerCase() === "confirmed");
  const outstanding = invoices.reduce((sum,r) => sum + Math.max(0,Number(r.Outstanding_Amount || 0)),0);
  const payload={status:"success",society:societyPublic_(viewSession),summary:{totalProperties:properties.length,occupiedProperties:properties.filter(r=>String(r.Occupancy_Status||"").toLowerCase()==="occupied").length,totalInvoices:invoices.length,confirmedReceipts:paid.length,confirmedCollection:paid.reduce((s,r)=>s+Number(r.Received_Amount||0),0),outstandingMaintenance:outstanding,pendingRequests:requests.filter(r=>String(r.Request_Status||"").toLowerCase()==="pending").length,recentActivity:requests.slice(-5).reverse()}};
  const serialized=JSON.stringify(payload);if(serialized.length<=95000)cache.put(cacheKey,serialized,20);
  return json_(payload);
}

const PERMISSION_MODULE_MAP_ = {
  properties:"Properties & Residents", owners:"Owner Management", ownershipHistory:"Ownership History", tenants:"Tenant Management",
  rates:"Maintenance & Invoices", invoices:"Maintenance & Invoices", receipts:"Payments", billWiseDetails:"Bill Wise Details",
  expenses:"Expenses", expenseCategories:"Expenses", bankAccounts:"Bank Accounts", activityRequests:"Activity Requests",
  notices:"Notices", gallery:"Gallery", galleryPhotos:"Gallery", preventiveMaintenance:"Preventive Maintenance", ratePropertyMapping:"Maintenance & Invoices",
  propertyUtilityDetails:"Properties & Residents", financialYears:"Financial Year Management", accountHeads:"Account Heads",
  auditLogs:"Audit Log", rolePermissions:"Role Permission Management"
};
const ROLE_PERMISSION_HEADERS_=["Permission_ID","Role","Module_Name","Can_View","Can_Create","Can_Edit","Can_Delete","Can_Approve","Remarks"];
const ROLE_PERMISSION_MODULES_=["Dashboard","Properties & Residents","Owner Management","Ownership History","Tenant Management","Maintenance & Invoices","Payments","Fund Inflow","Bill Wise Details","Expenses","Activity Requests","Notices","Gallery","Preventive Maintenance","Reports","Financial Year Management","Account Heads","Bank Accounts","User Management","Role Permission Management","Settings","Audit Log","Financial Transactions","My Flat","My Bills","Pay Now","Payment History","Notices & Gallery","Resident Portal"];
function ensureRolePermissionSheet_(ss){
  let sh=ss.getSheetByName("Role_Permission");
  if(!sh){sh=ss.insertSheet("Role_Permission");sh.getRange(1,1,1,ROLE_PERMISSION_HEADERS_.length).setValues([ROLE_PERMISSION_HEADERS_]);}
  if(sh.getLastColumn()===0)sh.getRange(1,1,1,ROLE_PERMISSION_HEADERS_.length).setValues([ROLE_PERMISSION_HEADERS_]);
  const headers=headerMap_(sh);
  ROLE_PERMISSION_HEADERS_.forEach(h=>{if(headers.indexOf(h)<0){sh.getRange(1,sh.getLastColumn()+1).setValue(h);}});
  if(sh.getLastRow()<=1)seedRolePermissionDefaults_(sh);
  return sh;
}
function seedRolePermissionDefaults_(sh){
  const rows=[];let n=1;
  const defaultMap={
    Admin:ROLE_PERMISSION_MODULES_,
    Committee:["Dashboard","Properties & Residents","Owner Management","Ownership History","Tenant Management","Maintenance & Invoices","Payments","Bill Wise Details","Activity Requests","Expenses","Reports","Financial Year Management","Account Heads","Notices","Gallery","Preventive Maintenance","Resident Portal","My Flat","My Bills","Pay Now","Payment History","Notices & Gallery"],
    Accountant:["Dashboard","Properties & Residents","Owner Management","Maintenance & Invoices","Payments","Fund Inflow","Bill Wise Details","Expenses","Reports","Financial Year Management","Account Heads","Bank Accounts","Financial Transactions","Resident Portal","My Flat","My Bills","Pay Now","Payment History","Activity Requests","Notices","Gallery","Notices & Gallery"],
    Resident:["Dashboard","Resident Portal","Properties & Residents","Owner Management","Ownership History","Maintenance & Invoices","Payments","Bill Wise Details","My Flat","My Bills","Pay Now","Payment History","Activity Requests","Notices","Gallery","Notices & Gallery"]
  };
  function perms(role,module){
    if(role==="Admin")return {Can_View:true,Can_Create:true,Can_Edit:true,Can_Delete:module!=="Audit Log",Can_Approve:true};
    if(role==="Committee")return {Can_View:true,Can_Create:module==="Activity Requests",Can_Edit:module==="Activity Requests",Can_Delete:false,Can_Approve:["Activity Requests","Expenses"].includes(module)};
    if(role==="Accountant")return {Can_View:true,Can_Create:["Payments","Fund Inflow","Expenses","Financial Transactions"].includes(module),Can_Edit:["Payments","Fund Inflow","Bill Wise Details","Expenses"].includes(module),Can_Delete:false,Can_Approve:["Payments"].includes(module)};
    return {Can_View:true,Can_Create:["Pay Now","Activity Requests"].includes(module),Can_Edit:module==="Activity Requests",Can_Delete:false,Can_Approve:false};
  }
  Object.keys(defaultMap).forEach(role=>defaultMap[role].forEach(module=>{const a=perms(role,module);rows.push(["RP"+String(n++).padStart(5,"0"),role,module,a.Can_View,a.Can_Create,a.Can_Edit,a.Can_Delete,a.Can_Approve,"V6.0.0 starter permissions; Admin may customize per society"]);}));
  sh.getRange(2,1,rows.length,ROLE_PERMISSION_HEADERS_.length).setValues(rows);
}

function getMyPermissions_(session){
  const rows=rolePermissionRows_(session),roles=session.role==="Admin"?["Admin"]:session.role==="Resident"?["Resident"]:[session.role,"Resident"];
  const data=rows.filter(r=>roles.includes(String(r.Role||"")));
  return json_({status:"success",data,role:String(session.role||"")});
}
function rolePermissionRows_(session){
  const cache=CacheService.getScriptCache(),key="ROLE_PERMISSIONS_"+sha256_(String(session.societyCode||""));
  const cached=cache.get(key);if(cached){try{return JSON.parse(cached);}catch(e){cache.remove(key);}}
  const ss=SpreadsheetApp.openById(session.databaseId),sh=ensureRolePermissionSheet_(ss),rows=sheetObjects_(sh);
  const json=JSON.stringify(rows);if(json.length<90000)cache.put(key,json,30);return rows;
}
function clearRolePermissionCache_(societyCode){CacheService.getScriptCache().remove("ROLE_PERMISSIONS_"+sha256_(String(societyCode||"")));}
function rolePermission_(session,moduleName,action,effectiveRole){
  const role=effectiveRole||session.role,rows=rolePermissionRows_(session),row=rows.find(r=>String(r.Role||"").trim().toLowerCase()===String(role).trim().toLowerCase()&&String(r.Module_Name||"").trim().toLowerCase()===String(moduleName||"").trim().toLowerCase());
  return !!row && (row[action]===true||String(row[action]||"").trim().toLowerCase()==="true"||String(row[action]||"").trim()==="1");
}
function requirePermission_(session,moduleName,action,effectiveRole){
  if(!rolePermission_(session,moduleName,action,effectiveRole))throw new Error("Permission denied by Role_Permission configuration.");
}
function residentViewSession_(session,viewAsResident){
  if(!viewAsResident)return session;
  if(!["Committee","Accountant"].includes(session.role))throw new Error("Resident preview is available only to Committee and Accountant accounts.");
  const propertyId=String(session.propertyId||"").trim();
  const ownRows=propertyId?sheetObjects_(societySheet_(session,"Ownership History").sh).filter(x=>String(x.PropertyID).trim()===propertyId&&String(x.Ownership_Status).trim()==="Current"):[];
  let effectiveOwnershipId=String(session.ownershipId||"").trim();
  if(!effectiveOwnershipId&&propertyId){
    const matched=session.ownerId?ownRows.find(x=>String(x.OwnerID).trim()===String(session.ownerId).trim()):ownRows[0];
    if(matched&&matched.Ownership_ID)effectiveOwnershipId=String(matched.Ownership_ID).trim();
  }
  if(!propertyId||!effectiveOwnershipId)throw new Error("Resident View requires both PropertyID and Ownership_ID linked to your user account.");
  const current=ownRows.find(x=>String(x.Ownership_ID).trim()===effectiveOwnershipId);
  if(!current)throw new Error("Your linked Ownership_ID is not current for the assigned property.");
  return Object.assign({},session,{role:"Resident",ownerId:String(current.OwnerID||session.ownerId||""),ownershipId:effectiveOwnershipId});
}
function authorizeModuleRead_(session,key,viewAsResident){
  if(key==="rolePermissions"){
    requireRole_(session,["Admin"]);
    requirePermission_(session,"Role Permission Management","Can_View");
    return;
  }
  const moduleName=PERMISSION_MODULE_MAP_[key];if(!moduleName)throw new Error("Permission denied.");
  const effectiveRole=viewAsResident?"Resident":session.role;
  if(key==="receipts"&&(rolePermission_(session,"Payments","Can_View",effectiveRole)||rolePermission_(session,"Fund Inflow","Can_View",effectiveRole)))return;
  requirePermission_(session,moduleName,"Can_View",effectiveRole);
}

function residentModuleRecords_(session,key,ss,sheet){
  const norm=v=>String(v==null?"":v).trim().toUpperCase();
  const propertyId=String(session.propertyId||"").trim(),ownershipId=String(session.ownershipId||"").trim(),ownerId=String(session.ownerId||"").trim();
  if(!propertyId||!ownershipId||!sheet)return [];
  const ownershipSheet=ss.getSheetByName("Ownership History");
  if(!ownershipSheet)return [];
  const currentRows=findRowsByHeaderValue_(ownershipSheet,"PropertyID",propertyId).filter(r=>norm(r.Ownership_Status)==="CURRENT"&&norm(r.Ownership_ID)===norm(ownershipId)&&(!ownerId||norm(r.OwnerID)===norm(ownerId)));
  if(!currentRows.length){
    console.warn("ABAS_RESIDENT_MAPPING_AUDIT",JSON.stringify({userId:session.userId||"",propertyId:propertyId,ownerId:ownerId,ownershipId:ownershipId,result:"DENIED",reason:"No matching current ownership mapping"}));
    return [];
  }
  console.info("ABAS_RESIDENT_MAPPING_AUDIT",JSON.stringify({userId:session.userId||"",propertyId:propertyId,ownerId:ownerId,ownershipId:ownershipId,result:"VALID"}));
  const currentIds=currentRows.map(r=>String(r.Ownership_ID||"")),currentOwnerIds=currentRows.map(r=>String(r.OwnerID||""));
  if(["properties","propertyUtilityDetails","invoices","receipts","billWiseDetails","ownershipHistory","tenants","activityRequests"].includes(key)){
    let rows=findRowsByHeaderValue_(sheet,"PropertyID",propertyId);
    if(key==="ownershipHistory")return rows.filter(r=>norm(r.Ownership_Status)==="CURRENT"&&currentIds.some(id=>norm(id)===norm(r.Ownership_ID)));
    if(key==="tenants")return rows.filter(r=>String(r.Status||"").toLowerCase()==="active");
    if(key==="activityRequests")return rows.filter(r=>norm(r.Requested_By)===norm(session.userId));
    if(["invoices","receipts","billWiseDetails"].includes(key))return rows.filter(r=>currentIds.some(id=>norm(id)===norm(r.Ownership_ID)));
    return rows;
  }
  if(key==="owners")return currentOwnerIds.flatMap(id=>findRowsByHeaderValue_(sheet,"OwnerID",id));
  if(key==="notices")return scopeRecords_(session,key,sheetObjects_(sheet),ss);
  if(key==="gallery")return scopeRecords_(session,key,sheetObjects_(sheet),ss);
  if(key==="galleryPhotos"){
    const gallerySheet=ss.getSheetByName("Gallery Master");
    if(!gallerySheet)return [];
    const visibleGalleryIds=new Set(
      scopeRecords_(session,"gallery",sheetObjects_(gallerySheet),ss)
        .filter(r=>!["inactive","archived"].includes(String(r.Status||"").trim().toLowerCase()))
        .map(r=>String(r.Gallery_ID||"").trim())
        .filter(Boolean)
    );
    return sheetObjects_(sheet).filter(r=>visibleGalleryIds.has(String(r.Gallery_ID||"").trim())&&!["inactive","archived","deleted"].includes(String(r.Status||"").trim().toLowerCase()));
  }
  return [];
}
function scopeRecords_(session,key,records,ss) {
  if (session.role !== "Resident") return records;
  const propertyId = String(session.propertyId || "");
  const ownershipRows = sheetObjects_(ss.getSheetByName("Ownership History"));
  const currentOwnerships = ownershipRows.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Ownership_Status||"")==="Current"&&String(r.Ownership_ID||"")===String(session.ownershipId||"")&&(!session.ownerId||String(r.OwnerID||"")===String(session.ownerId)));
  const currentOwnershipIds = currentOwnerships.map(r=>String(r.Ownership_ID||""));
  if (["properties","propertyUtilityDetails"].includes(key)) return records.filter(r=>String(r.PropertyID||"")===propertyId);
  if (["invoices","receipts","billWiseDetails"].includes(key)) return records.filter(r=>String(r.PropertyID||"")===propertyId&&currentOwnershipIds.includes(String(r.Ownership_ID||"")));
  if (key === "ownershipHistory") return records.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Ownership_Status||"")==="Current");
  if (key === "owners") {
    const ids = currentOwnerships.map(r=>String(r.OwnerID||""));
    return records.filter(r=>ids.includes(String(r.OwnerID||"")));
  }
  if (key === "tenants") return records.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Status||"").toLowerCase()==="active");
  if (key === "activityRequests") return records.filter(r=>String(r.PropertyID||"")===propertyId&&norm(r.Requested_By)===norm(session.userId));
  if (key === "notices") return records.filter(r=>{
    const visibility=String(r.Visibility||"");
    if (visibility==="All"||visibility==="All Residents"||visibility==="Residents Only") return true;
    if (visibility==="Owners Only") return currentOwnerships.length>0;
    if (visibility==="Tenants Only") return sheetObjects_(ss.getSheetByName("Tenant Master")).some(t=>String(t.PropertyID)===propertyId&&String(t.Status||"").toLowerCase()==="active");
    if (visibility==="Selected Properties") return String(r.Selected_Properties||r.PropertyID||"").split(/[,;|]/).map(x=>x.trim()).includes(propertyId);
    return false;
  });
  if (key === "gallery") return records.filter(r=>["Public","Residents Only","All Residents"].includes(String(r.Visibility||"")));
  return [];
}
function societyPublic_(session) { return {societyCode:session.societyCode,societyName:session.societyName,societyAddress:session.societyAddress}; }

function login_(body) {
  const authStartedAt = Date.now();
  let lookupMs = 0, passwordVerifyMs = 0;
  const code = normalizeSociety_(body.societyCode);
  const loginId = normalizeLogin_(body.loginId);
  const password = String(body.password || "");
  if (!code || !loginId || !password) {
    throw new Error("Society Code, Login ID and Password are required.");
  }

  const cache = CacheService.getScriptCache();
  const failKey = "LOGIN_FAIL_" + sha256_(code + "|" + loginId);
  if (Number(cache.get(failKey) || 0) >= 10) {
    const err = new Error("Too many sign-in attempts. Please wait 15 minutes.");
    err.code = "RATE_LIMITED";
    throw err;
  }

  let context;
  const genericFailure = "Unable to sign in. Check your Society Code, Login ID and Password, or contact your society administrator.";
  try {
    const lookupStartedAt = Date.now();
    context = loginContext_(code, loginId);
    lookupMs = Date.now() - lookupStartedAt;
  } catch (lookupError) {
    const lookupMessage = String(lookupError && lookupError.message || "").toLowerCase();
    if (lookupMessage.includes("society not found") ||
        lookupMessage.includes("database is not configured") ||
        lookupMessage.includes("missing central master") ||
        lookupMessage.includes("missing central user access")) {
      recordLoginFailure_(failKey, cache);
      throw new Error(genericFailure);
    }
    throw new Error("Authentication service temporarily unavailable. Please try again later.");
  }

  const society = context.society;
  const usersSheet = context.usersSheet;
  const user = context.user;

  // Keep the same response for an unknown Login ID, inactive user or invalid password.
  if (!user || String(user.Account_Status || "").trim().toLowerCase() !== "active" ||
      !user.Password_Salt || !user.Password_Hash) {
    recordLoginFailure_(failKey, cache);
    throw new Error(genericFailure);
  }

  const expected = String(user.Password_Hash);
  const currentSalt = String(user.Password_Salt);
  // Check the existing v5.1 SHA-256 format first; upgrade it after successful sign-in.
  const passwordStartedAt = Date.now();
  const legacyMatch = expected.length === 64 &&
    constantTimeEqual_(sha256_(currentSalt + password), expected);
  const currentMatch = !legacyMatch &&
    constantTimeEqual_(hashPassword_(currentSalt, password), expected);
  passwordVerifyMs = Date.now() - passwordStartedAt;

  if (!legacyMatch && !currentMatch) {
    recordLoginFailure_(failKey, cache);
    throw new Error(genericFailure);
  }

  cache.remove(failKey);
  if (legacyMatch) {
    // Only resolve header columns when upgrading a legacy v5.1 SHA-256 hash.
    const loginHeaders = cachedAuthHeaders_(usersSheet);
    const saltCol = loginHeaders.indexOf("Password_Salt") + 1;
    const hashCol = loginHeaders.indexOf("Password_Hash") + 1;
    const lastLoginCol = loginHeaders.indexOf("Last_Login") + 1;
    if (!saltCol || !hashCol || !lastLoginCol) throw new Error("Authentication columns are missing from Society User Access.");
    const salt = randomHex_(24);
    usersSheet.getRange(user.__row, saltCol).setValue(salt);
    usersSheet.getRange(user.__row, hashCol).setValue(hashPassword_(salt, password));
  }
  // Last_Login is deferred to an authenticated metadata request after Dashboard mount.

  // Every successful device login receives a separate, unpredictable token.
  // No existing device session is invalidated by a new login.
  const token = randomHex_(32);
  const session = {
    societyCode: code,
    societyName: String(society.Society_Name || ""),
    societyAddress: String(society.Society_Address || society.Registered_Address || society.Address || ""),
    databaseId: String(society.Database_ID),
    fullName: String(user.Full_Name || ""),
    userId: String(user.UserID || user.Access_ID || ""),
    loginId: String(user.Login_ID || ""),
    role: String(user.Role || "Resident"),
    propertyId: String(user.PropertyID || ""),
    ownershipId: String(user.Ownership_ID || ""),
    ownerId: String(user.OwnerID || ""),
    email: String(user.Email_ID || ""),
    mobile: String(user.Mobile_No || ""),
    userAccessRow: Number(user.__row || 0)
  };
  cache.put("SESSION_" + token, JSON.stringify(session), CONFIG.SESSION_TTL_SECONDS);
  // The login response already contains this validated profile. Cache the safe
  // server-side profile so the first protected Dashboard request does not repeat
  // a Central Master user-list read. Role/status changes invalidate this cache.
  const safeAuthUser = Object.assign(publicUser_(user), {
    Ownership_ID: String(user.Ownership_ID || ""), OwnerID: String(user.OwnerID || "")
  });
  cache.put(sessionUserCacheKey_(code, session.userId), JSON.stringify(safeAuthUser), 30);

  const clientUser = Object.assign({}, session);
  delete clientUser.databaseId;
  delete clientUser.ownerId;
  delete clientUser.userAccessRow;
  return json_({
    status: "success",
    token: token,
    expiresIn: CONFIG.SESSION_TTL_SECONDS,
    user: clientUser,
    performance: { lookupMs: lookupMs, passwordVerifyMs: passwordVerifyMs, authMs: Date.now() - authStartedAt }
  });
}

function updateLoginActivity_(token) {
  if (!token) throw new Error("Authentication required.");
  const cache=CacheService.getScriptCache(), raw=cache.get("SESSION_"+token);
  if (!raw) throw new Error("Session expired. Sign in again.");
  const session=JSON.parse(raw), row=Number(session.userAccessRow||0);
  if (!row || !session.societyCode || !session.userId) return json_({status:"success",skipped:true});
  const master=SpreadsheetApp.openById(getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID"));
  const sh=master.getSheetByName("Society User Access");
  if (!sh) throw new Error("Missing Central Master tab: Society User Access");
  const headers=cachedAuthHeaders_(sh), userIdCol=headers.indexOf("UserID")+1,
    societyCol=headers.indexOf("Society_Code")+1, statusCol=headers.indexOf("Account_Status")+1,
    lastLoginCol=headers.indexOf("Last_Login")+1;
  if (!userIdCol||!societyCol||!statusCol||!lastLoginCol) throw new Error("Login activity columns are missing.");
  // Confirm the cached row still belongs to this user/society and is active.
  const values=sh.getRange(row,1,1,headers.length).getValues()[0], user=objectFromRow_(headers,values);
  if (String(user.UserID||user.Access_ID||"")!==String(session.userId) ||
      String(user.Society_Code||"").trim().toUpperCase()!==String(session.societyCode).toUpperCase() ||
      String(user.Account_Status||"").trim().toLowerCase()!=="active") return json_({status:"success",skipped:true});
  sh.getRange(row,lastLoginCol).setValue(new Date());
  return json_({status:"success"});
}

function adminCreateUser_(session,body) {
  requireRole_(session,["Admin"]);
  const code = normalizeSociety_(body.societyCode || session.societyCode);
  if (code !== session.societyCode) throw new Error("You can only manage users in your own society.");
  const name = cleanText_(body.fullName,100), loginId = normalizeLogin_(body.loginId);
  const email = cleanEmail_(body.email), mobile = cleanText_(body.mobile,20);
  const role = String(body.role || "");
  const password = String(body.password || "");
  if (!name || !loginId || !email || !mobile) throw new Error("Name, Login ID, email and mobile are required.");
  if (!["Committee","Accountant","Resident"].includes(role)) throw new Error("Admin can create Committee, Accountant or Resident accounts only.");
  validatePassword_(password);
  if (role === "Resident" && !cleanText_(body.propertyId,80)) throw new Error("Select a Property ID for Resident.");
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const {usersSheet,rows} = societyAndUsers_(code);
    if (rows.some(r => normalizeLogin_(r.Login_ID) === loginId)) throw new Error("This Login ID already exists.");
    if (rows.some(r => normalizeEmail_(r.Email_ID) === email)) throw new Error("This email is already registered.");
    ensureHeaders_(usersSheet,USER_HEADERS);
    const salt = randomHex_(24), now = new Date(), userId = "USR-" + randomHex_(6).toUpperCase();
    const record = {
      Society_Code:code, Login_ID:loginId, UserID:userId, Full_Name:name, Email_ID:email,
      Mobile_No:mobile, Role:role, PropertyID:role==="Resident"?cleanText_(body.propertyId,80):"", Ownership_ID:cleanText_(body.ownershipId,80), OwnerID:cleanText_(body.ownerId,80),
      Account_Status:"Pending", Password_Salt:salt, Password_Hash:hashPassword_(salt,password),
      Profile_Address:"", Emergency_Contact:"", KYC_Status:"Not Submitted", KYC_Documents:"[]",
      Created_At:now, Created_By:session.userId, Approved_At:"", Approved_By:"", Last_Login:"",
      Password_Changed_At:now
    };
    appendObject_(usersSheet,record);
    audit_(session,"USER_CREATED",userId,"New "+role+" user created; awaiting approval");
    return json_({status:"success",message:"User created as Pending. Approve the account before first login.",user:{UserID:userId,Login_ID:loginId,Full_Name:name,Role:role,Account_Status:"Pending"}});
  } finally { lock.releaseLock(); }
}

function adminListUsers_(session) {
  requireRole_(session,["Admin"]);
  const data = societyAndUsers_(session.societyCode).rows.map(publicUser_);
  return json_({status:"success",users:data});
}
function adminUpdateUser_(session,body){
  requireRole_(session,["Admin"]);const userId=cleanText_(body.userId,100),updates=body.updates||{};
  const context=societyAndUsers_(session.societyCode),user=context.rows.find(x=>String(x.UserID||x.Access_ID)===userId);
  if(!user)throw new Error("User account not found.");
  if(userId===session.userId&&updates.Role&&String(updates.Role)!=="Admin")throw new Error("You cannot change your own Admin role.");
  const patch={};
  if(updates.Full_Name!==undefined){const v=cleanText_(updates.Full_Name,120);if(!v)throw new Error("Full name is required.");patch.Full_Name=v;}
  if(updates.Email_ID!==undefined)patch.Email_ID=cleanEmail_(updates.Email_ID);
  if(updates.Mobile_No!==undefined){const v=cleanText_(updates.Mobile_No,20);if(!/^[+0-9() -]{7,20}$/.test(v))throw new Error("Enter a valid mobile number.");patch.Mobile_No=v;}
  if(updates.Role!==undefined){const role=String(updates.Role);if(!["Committee","Accountant","Resident"].includes(role))throw new Error("Only Committee, Accountant or Resident role can be assigned here.");patch.Role=role;}
  if(updates.PropertyID!==undefined){const propertyId=cleanText_(updates.PropertyID,80);if(String(patch.Role||user.Role)==="Resident"){const props=sheetObjects_(societySheet_(session,"Property Master").sh);if(!props.some(x=>String(x.PropertyID)===propertyId&&String(x.Property_Status||"Active")==="Active"))throw new Error("Select an active property for this Resident.");}patch.PropertyID=propertyId;}
  if(!Object.keys(patch).length)throw new Error("No editable fields were supplied.");
  patch.Last_Updated_By=session.userId;patch.Last_Updated_At=new Date();
  updateByHeaders_(context.usersSheet,user.__row,patch,["Society_Code","Login_ID","UserID","Password_Salt","Password_Hash"]);
  invalidateSessionUserCache_(session.societyCode,userId);
  auditEvent_(session,"UPDATE","Society User Access",userId,"User account profile/role updated",user,patch);
  return json_({status:"success",message:"User account updated.",data:{userId,updates:patch}});
}

function adminSetUserStatus_(session,body){
  requireRole_(session,["Admin"]);const userId=cleanText_(body.userId,100),status=String(body.status||"");
  if(!["Active","Inactive"].includes(status))throw new Error("Status must be Active or Inactive.");
  if(userId===session.userId&&status==="Inactive")throw new Error("You cannot deactivate your own account.");
  const context=societyAndUsers_(session.societyCode),user=context.rows.find(x=>String(x.UserID||x.Access_ID)===userId);
  if(!user)throw new Error("User account not found.");
  updateByHeaders_(context.usersSheet,user.__row,{Account_Status:status,Last_Updated_By:session.userId,Last_Updated_At:new Date()},["Society_Code","Login_ID","UserID","Password_Salt","Password_Hash"]);
  invalidateSessionUserCache_(session.societyCode,userId);
  auditEvent_(session,status==="Inactive"?"CANCEL":"UPDATE","Society User Access",userId,"Account status changed to "+status,user,{Account_Status:status});
  return json_({status:"success",message:"User account status updated to "+status+"."});
}

function adminApproveUser_(session,body) {
  requireRole_(session,["Admin"]);
  const {usersSheet,rows} = societyAndUsers_(session.societyCode);
  const user = rows.find(r => String(r.UserID) === String(body.userId));
  if (!user) throw new Error("User not found.");
  if (!["Committee","Accountant","Resident"].includes(String(user.Role))) throw new Error("Admin account cannot be approved through this action.");
  setCell_(usersSheet,user.__row,"Account_Status","Active");
  setCell_(usersSheet,user.__row,"Approved_At",new Date());
  setCell_(usersSheet,user.__row,"Approved_By",session.userId);
  invalidateSessionUserCache_(session.societyCode,body.userId);
  audit_(session,"USER_APPROVED",body.userId,"User account activated");
  return json_({status:"success",message:"User approved and activated."});
}
function adminRejectUser_(session,body) {
  requireRole_(session,["Admin"]);
  const {usersSheet,rows} = societyAndUsers_(session.societyCode);
  const user = rows.find(r => String(r.UserID) === String(body.userId));
  if (!user || user.Role === "Admin") throw new Error("User not found or cannot be rejected.");
  setCell_(usersSheet,user.__row,"Account_Status","Rejected");
  invalidateSessionUserCache_(session.societyCode,body.userId);
  audit_(session,"USER_REJECTED",body.userId,cleanText_(body.reason,250));
  return json_({status:"success",message:"User request rejected."});
}
function adminSetKycStatus_(session,body) {
  requireRole_(session,["Admin"]);
  const status=String(body.status||"");
  if(!["Verified","Rejected","Under Review"].includes(status)) throw new Error("Invalid KYC status.");
  const {usersSheet,rows}=societyAndUsers_(session.societyCode);
  const user=rows.find(r=>String(r.UserID)===String(body.userId));
  if(!user) throw new Error("User not found.");
  setCell_(usersSheet,user.__row,"KYC_Status",status);
  invalidateSessionUserCache_(session.societyCode,body.userId);
  audit_(session,"KYC_STATUS_UPDATED",body.userId,"KYC status: "+status);
  return json_({status:"success",message:"KYC status updated to "+status+"."});
}

function updateMyProfile_(session,body) {
  const {usersSheet,rows} = societyAndUsers_(session.societyCode);
  const user = rows.find(r => String(r.UserID || r.Access_ID) === session.userId);
  if (!user) throw new Error("User record not found.");
  const name = cleanText_(body.fullName,100), email = cleanEmail_(body.email), mobile = cleanText_(body.mobile,20);
  if (!name || !email || !mobile) throw new Error("Name, valid email and mobile are required.");
  if (normalizeEmail_(user.Email_ID) !== email) throw new Error("Email changes require administrator verification. Contact your Admin to update your registered email.");

  ["Full_Name","Email_ID","Mobile_No","Profile_Address","Emergency_Contact"].forEach(k => {
    const val = ({Full_Name:name,Email_ID:email,Mobile_No:mobile,Profile_Address:cleanText_(body.address,250),Emergency_Contact:cleanText_(body.emergencyContact,20)})[k];
    setCell_(usersSheet,user.__row,k,val);
  });
  invalidateSessionUserCache_(session.societyCode,session.userId);
  audit_(session,"PROFILE_UPDATED",session.userId,"Profile details updated");
  const updated = Object.assign({},user,{Full_Name:name,Email_ID:email,Mobile_No:mobile,Profile_Address:cleanText_(body.address,250),Emergency_Contact:cleanText_(body.emergencyContact,20)});
  return json_({status:"success",message:"Profile updated.",profile:publicUser_(updated)});
}

function uploadKycDocument_(session,body) {
  const fileName = cleanText_(body.fileName,120), mime = String(body.mimeType || "");
  if (!CONFIG.ALLOWED_KYC_TYPES.includes(mime)) throw new Error("Only PDF, JPG and PNG documents are accepted.");
  const encoded = String(body.base64 || "").replace(/^data:[^;]+;base64,/,"");
  if (encoded.length > 7 * 1024 * 1024) throw new Error("File must be smaller than 5 MB.");
  const bytes = Utilities.base64Decode(encoded);
  if (!bytes.length || bytes.length > CONFIG.MAX_KYC_BYTES) throw new Error("File must be smaller than 5 MB.");
  const {usersSheet,rows,society} = societyAndUsers_(session.societyCode);
  const user = rows.find(r => String(r.UserID || r.Access_ID) === session.userId);
  if (!user) throw new Error("User record not found.");
  const root = createPrivateSocietyFolder_(session);
  if (root.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error("KYC storage folder must be private. Remove public/link sharing from the configured Drive folder first.");
  const folderName = "KYC_" + session.societyCode;
  const folders = root.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : root.createFolder(folderName);
  const safeName = session.userId + "_" + Date.now() + "_" + fileName.replace(/[^\w.\-]/g,"_");
  const file = folder.createFile(Utilities.newBlob(bytes,mime,safeName));
  file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  const societyDb=SpreadsheetApp.openById(session.databaseId);let fileReg=societyDb.getSheetByName("_File Registry");if(!fileReg){fileReg=societyDb.insertSheet("_File Registry");fileReg.getRange(1,1,1,6).setValues([["File_ID","PropertyID","OwnerID","Category","Uploaded_By","Created_At"]]);fileReg.hideSheet();}fileReg.appendRow([file.getId(),String(user.PropertyID||""),"","KYC",session.userId,new Date()]);
  // Grant access only to uploader and active Admins of this society; never enable link/public sharing.
  if (session.email) { try { file.addViewer(session.email); } catch (e) {} }
  rows.filter(r => r.Role === "Admin" && String(r.Account_Status || "").trim().toLowerCase() === "active" && r.Email_ID)
    .forEach(r => { try { file.addViewer(String(r.Email_ID)); } catch (e) {} });
  const docs = parseJsonArray_(user.KYC_Documents);
  docs.push({fileId:file.getId(),fileName:safeName,mimeType:mime,uploadedAt:new Date().toISOString(),status:"Submitted"});
  setCell_(usersSheet,user.__row,"KYC_Documents",JSON.stringify(docs));
  setCell_(usersSheet,user.__row,"KYC_Status","Submitted");
  audit_(session,"KYC_UPLOADED",session.userId,"Private KYC document uploaded: "+safeName);
  return json_({status:"success",message:"Document uploaded privately. Contact Admin if verification is required.",documents:docs.map(d=>({fileName:d.fileName,uploadedAt:d.uploadedAt,status:d.status}))});
}

function forgotPasswordRequest_(body) {
  const code=normalizeSociety_(body.societyCode), loginId=normalizeLogin_(body.loginId), email=normalizeEmail_(body.email);
  if (!code || !loginId || !email) throw new Error("Society Code, Login ID and registered email are required.");
  const cache=CacheService.getScriptCache(), throttle="OTP_REQ_"+sha256_(code+"|"+loginId);
  if (cache.get(throttle)) throw new Error("Please wait before requesting another code.");
  const {rows}=societyAndUsers_(code);
  const user=rows.find(r=>normalizeLogin_(r.Login_ID)===loginId && normalizeEmail_(r.Email_ID)===email && String(r.Account_Status || "").trim().toLowerCase()==="active");
  // Same response whether a user exists or not, to reduce account enumeration.
  if (user) {
    const otp=String(parseInt(randomHex_(4),16)%900000+100000);
    const secret=randomHex_(16), digest=sha256_(secret+otp);
    cache.put("PWD_OTP_"+sha256_(code+"|"+loginId),JSON.stringify({digest,secret,userId:String(user.UserID),email,attempts:0}),CONFIG.OTP_TTL_SECONDS);
    MailApp.sendEmail({to:email,subject:"ABAS SATHI password reset code",body:"Your ABAS SATHI verification code is "+otp+". It expires in 10 minutes. If you did not request this, ignore this email."});
  }
  cache.put(throttle,"1",60);
  return json_({status:"success",message:"If the account details match an active user, a verification code has been sent to the registered email."});
}
function forgotPasswordVerify_(body) {
  const code=normalizeSociety_(body.societyCode), loginId=normalizeLogin_(body.loginId);
  const otp=String(body.otp||""), password=String(body.newPassword||"");
  validatePassword_(password);
  const cache=CacheService.getScriptCache(), key="PWD_OTP_"+sha256_(code+"|"+loginId);
  const raw=cache.get(key); if(!raw) throw new Error("Code expired or invalid. Request a new code.");
  const rec=JSON.parse(raw);
  if (rec.attempts>=5) {cache.remove(key);throw new Error("Too many incorrect attempts. Request a new code.");}
  if (!constantTimeEqual_(sha256_(rec.secret+otp),rec.digest)) {
    rec.attempts++;cache.put(key,JSON.stringify(rec),CONFIG.OTP_TTL_SECONDS);throw new Error("Incorrect verification code.");
  }
  const {usersSheet,rows}=societyAndUsers_(code), user=rows.find(r=>String(r.UserID || r.Access_ID)===rec.userId);
  if(!user || String(user.Account_Status || "").trim().toLowerCase()!=="active") throw new Error("Account cannot be reset.");
  const salt=randomHex_(24);
  setCell_(usersSheet,user.__row,"Password_Salt",salt);
  setCell_(usersSheet,user.__row,"Password_Hash",hashPassword_(salt,password));
  setCell_(usersSheet,user.__row,"Password_Changed_At",new Date());
  cache.remove(key);
  return json_({status:"success",message:"Password reset successfully. Please sign in."});
}

// -----------------------------------------------------------------------------
// Version 5.3.1 — server-authoritative CRUD and financial operations.
// Every financial mutation runs under ScriptLock and writes an operation key.
// The operation ledger is an internal tab, not part of the resident UI.
// -----------------------------------------------------------------------------
const CRUD_MODULES = {
  properties:{sheet:"Property Master",id:"PropertyID",roles:["Admin"],resident:false},
  owners:{sheet:"Owner Master",id:"OwnerID",roles:["Admin","Committee"],resident:false},
  ownershipHistory:{sheet:"Ownership History",id:"Ownership_ID",roles:["Admin"],resident:false},
  rates:{sheet:"Rate Master",id:"RateID",roles:["Admin"],resident:false},
  expenseCategories:{sheet:"Expense Category Master",id:"Category_ID",roles:["Admin"],resident:false},
  bankAccounts:{sheet:"Bank Account Master",id:"BankAccount_ID",roles:["Admin","Accountant"],resident:false},
  activityRequests:{sheet:"Activity Request Register",id:"Request_ID",roles:["Admin","Committee","Accountant","Resident"],resident:true},
  notices:{sheet:"Notice Master",id:"Notice_ID",roles:["Admin","Committee"],resident:false},
  gallery:{sheet:"Gallery Master",id:"Gallery_ID",roles:["Admin","Committee"],resident:false},
  preventiveMaintenance:{sheet:"Preventive Maintenance Master",id:"Maintenance_ID",roles:["Admin","Committee"],resident:false},
  ratePropertyMapping:{sheet:"Rate Property Mapping",id:"Rate_Mapping_ID",roles:["Admin"],resident:false},
  propertyUtilityDetails:{sheet:"Property Utility Details",id:"Utility_ID",roles:["Admin","Accountant"],resident:false},
  financialYears:{sheet:"Financial Year Master",id:"FY_ID",roles:["Admin","Accountant"],resident:false},
  tenants:{sheet:"Tenant Master",id:"Tenant_ID",roles:["Admin","Committee"],resident:false},
  accountHeads:{sheet:"Account Head Master",id:"Account_ID",roles:["Admin","Accountant"],resident:false},
  rolePermissions:{sheet:"Role_Permission",id:"Permission_ID",roles:["Admin"],resident:false}
};
const FINANCE_ROLES={invoice:["Admin"],paymentSubmit:["Admin","Accountant","Resident"],paymentVerify:["Admin","Accountant"],expenseCreate:["Admin","Accountant"],expenseApprove:["Admin","Committee"],expensePay:["Admin","Accountant"]};

function societySheet_(session,name){
  const ss=SpreadsheetApp.openById(session.databaseId);
  const aliases={"Invoice_Register":["Invoice_Register","Invoice Register"]};
  const names=aliases[name]||[name];
  for(let i=0;i<names.length;i++){const sh=ss.getSheetByName(names[i]);if(sh)return {ss,sh};}
  throw new Error("Required society sheet is missing: "+name);
}
function headerMap_(sh){const n=sh.getLastColumn();if(!n)throw new Error("Sheet has no header row.");return sh.getRange(1,1,1,n).getValues()[0].map(v=>String(v).trim());}
function operationLedger_(ss){
  let sh=ss.getSheetByName("_Operation Ledger");
  if(!sh){sh=ss.insertSheet("_Operation Ledger");sh.getRange(1,1,1,6).setValues([["Operation_ID","Action","Record_ID","Status","Result_JSON","Created_At"]]);sh.hideSheet();}
  return sh;
}
function findOperation_(sh,key){const last=sh.getLastRow();if(last<2)return null;const hits=sh.getRange(2,1,last-1,1).createTextFinder(String(key)).matchCase(true).matchEntireCell(true).findAll();if(!hits.length)return null;const row=hits[0].getRow(),v=sh.getRange(row,1,1,6).getValues()[0];return {row,status:String(v[3]||""),result:String(v[4]||"")};}
function findOperationByActionRecord_(sh,action,recordId){const last=sh.getLastRow();if(last<2)return null;const vals=sh.getRange(2,1,last-1,6).getValues();for(let i=0;i<vals.length;i++){if(String(vals[i][1])===String(action)&&String(vals[i][2])===String(recordId))return {row:i+2,status:String(vals[i][3]),result:String(vals[i][4]||"")};}return null;}
function requireOperationId_(body){const id=cleanText_(body.requestId||body.idempotencyKey,100);if(!id||id.length<12)throw new Error("A unique requestId (minimum 12 characters) is required.");return id;}
function writeOperation_(sh,key,action,recordId,status,result){
  const existing=findOperation_(sh,key),payload=JSON.stringify(result||{});
  if(existing){sh.getRange(existing.row,2,1,5).setValues([[action,recordId,status,payload,new Date()]]);}
  else {const row=sh.getLastRow()+1;sh.getRange(row,1,1,6).setValues([[key,action,recordId,status,payload,new Date()]]);}
}
function nextReceiptNumber_(sh){const headers=headerMap_(sh),col=headers.indexOf("Receipt_Number");if(col<0)throw new Error("Fund Inflow Register is missing Receipt_Number column.");const prefix="RCT-"+new Date().getFullYear()+"-";let max=0;if(sh.getLastRow()>1){const vals=sh.getRange(2,col+1,sh.getLastRow()-1,1).getDisplayValues();vals.forEach(r=>{const v=String(r[0]||"");if(v.indexOf(prefix)===0){const n=parseInt(v.slice(prefix.length),10);if(Number.isFinite(n))max=Math.max(max,n);}});}return prefix+String(max+1).padStart(6,"0");}
function rowById_(sh,idHeader,id){const h=headerMap_(sh),c=h.indexOf(idHeader);if(c<0)throw new Error("Missing key column: "+idHeader);const last=sh.getLastRow();if(last<2)return null;const vals=sh.getRange(2,c+1,last-1,1).getDisplayValues();for(let i=0;i<vals.length;i++)if(String(vals[i][0])===String(id))return {row:i+2,headers:h,values:sh.getRange(i+2,1,1,h.length).getValues()[0]};return null;}
function objectFromRow_(headers,values){const o={};headers.forEach((h,i)=>{if(h)o[h]=values[i] instanceof Date?values[i].toISOString():values[i];});return o;}
function assertPropertyAccess_(session,propertyId){if(session.role==="Resident"&&String(propertyId||"")!==String(session.propertyId||""))throw new Error("You may access records only for your linked property.");}
function assertOwnership_(session,propertyId,ownershipId,ownerId){
  assertPropertyAccess_(session,propertyId);if(!propertyId)throw new Error("PropertyID is required.");
  const {sh}=societySheet_(session,"Ownership History");const rows=sheetObjects_(sh);
  const match=rows.find(r=>String(r.PropertyID)===String(propertyId)&&String(r.Ownership_ID)===String(ownershipId)&&(!ownerId||String(r.OwnerID)===String(ownerId)));
  if(!match)throw new Error("The ownership record does not belong to this property.");
  if(session.role==="Resident"&&String(match.Ownership_Status||"")!=="Current")throw new Error("Residents may submit payments only for the current ownership period.");
  return match;
}
function appendByHeaders_(sh,obj){const h=headerMap_(sh);const row=h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:"");sh.getRange(sh.getLastRow()+1,1,1,h.length).setValues([row]);}
function updateByHeaders_(sh,row,obj,immutable){const h=headerMap_(sh),old=sh.getRange(row,1,1,h.length).getValues()[0];const blocked=(immutable||[]);const next=old.slice();h.forEach((key,i)=>{if(Object.prototype.hasOwnProperty.call(obj,key)&&blocked.indexOf(key)<0)next[i]=obj[key];});sh.getRange(row,1,1,h.length).setValues([next]);}
function actionMapForModuleWrite_(action){return ({create:"Can_Create",update:"Can_Edit",cancel:"Can_Delete"})[action]||"Can_View";}
function requireModuleWrite_(session,mod,action,body){const cfg=CRUD_MODULES[mod];if(!cfg)throw new Error("Unsupported module.");if(mod==="rolePermissions"){requireRole_(session,["Admin"]);requirePermission_(session,"Role Permission Management",actionMapForModuleWrite_(action));return cfg;}if(mod==="activityRequests"&&body&&body.viewAsResident){if(!["Committee","Accountant"].includes(session.role)||!session.propertyId||!session.ownershipId)throw new Error("Resident preview requires a linked PropertyID and Ownership_ID.");requirePermission_(session,"Activity Requests",action==="create"?"Can_Create":"Can_Edit","Resident");return cfg;}if(cfg.roles.indexOf(session.role)<0)throw new Error("Permission denied.");if(mod==="bankAccounts"&&session.role==="Committee")throw new Error("Bank account details are restricted.");const permissionModule=PERMISSION_MODULE_MAP_[mod]||mod;const actionMap={create:"Can_Create",update:mod==="activityRequests"&&body&&Object.prototype.hasOwnProperty.call(body.record||{},"Request_Status")?"Can_Approve":"Can_Edit",cancel:"Can_Delete"};requirePermission_(session,permissionModule,actionMap[action]||"Can_View");return cfg;}
function deleteRolePermission_(session,body){
  requireRole_(session,["Admin"]);requirePermission_(session,"Role Permission Management","Can_Delete");const permissionId=cleanText_(body.permissionId,100);if(!permissionId)throw new Error("Permission_ID is required.");
  const ss=SpreadsheetApp.openById(session.databaseId),sh=ensureRolePermissionSheet_(ss),found=rowById_(sh,"Permission_ID",permissionId);if(!found)throw new Error("Permission record not found.");
  const old=objectFromRow_(found.headers,found.values);if(String(old.Role)==="Admin"&&String(old.Module_Name)==="Role Permission Management")throw new Error("The Admin Role Permission Management record is protected from deletion.");const lock=LockService.getScriptLock();lock.waitLock(10000);try{sh.deleteRow(found.row);clearRolePermissionCache_(session.societyCode);auditEvent_(session,"DELETE","Role_Permission",permissionId,"Permission row deleted",old,"");return json_({status:"success",data:{permissionId}});}finally{lock.releaseLock();}
}
function safeRecord_(input,headers){const out={};const forbidden=["Society_Code","Password_Salt","Password_Hash","Created_By","Created_At","Approved_By","Approved_At","Cancelled_By","Cancelled_At","Current_Balance","Owner_Status","Paid_Amount","Outstanding_Amount","Receipt_Number","Voucher_No","Invoice_Number"];Object.keys(input||{}).forEach(k=>{if(headers.indexOf(k)>=0&&forbidden.indexOf(k)<0&&k.indexOf("__")!==0)out[k]=input[k];});return out;}


function validateMasterRecord_(session,mod,record,recordId){
  const ss=SpreadsheetApp.openById(session.databaseId),rows=(sheet)=>{const sh=ss.getSheetByName(sheet);if(!sh)throw new Error("Required sheet is missing: "+sheet);return sheetObjects_(sh);};
  const nonblank=(key,label)=>{if(!String(record[key]||"").trim())throw new Error(label+" is required.");};
  if(mod==="properties"){
    nonblank("Flat_No","Flat number");
    if(rows("Property Master").some(x=>String(x.PropertyID)!==String(recordId||record.PropertyID||"")&&String(x.Flat_No).toLowerCase()===String(record.Flat_No).toLowerCase()))throw new Error("This flat number already exists.");
  } else if(mod==="owners") nonblank("Owner_Name","Owner name");
  else if(mod==="ownershipHistory"){
    nonblank("PropertyID","Property");nonblank("OwnerID","Owner");nonblank("Ownership_Start_Date","Ownership start date");
    if(!rows("Property Master").some(x=>String(x.PropertyID)===String(record.PropertyID)&&String(x.Property_Status||"Active")==="Active"))throw new Error("Selected property does not exist or is inactive.");
    if(!rows("Owner Master").some(x=>String(x.OwnerID)===String(record.OwnerID)&&String(x.Owner_Status||"Active")==="Active"))throw new Error("Selected owner does not exist or is inactive.");
    const from=String(record.Ownership_Start_Date).slice(0,10),to=String(record.Ownership_End_Date||"").slice(0,10);
    if(to&&to<from)throw new Error("Ownership end date cannot be earlier than start date.");
    const shareKey=Object.keys(record).find(k=>/share/i.test(k));
    if(shareKey&&record[shareKey]!==""&&(Number(record[shareKey])<0||Number(record[shareKey])>100))throw new Error("Ownership share must be between 0 and 100 percent.");
    if(String(record.Ownership_Status)==="Current"&&shareKey){
      const sum=rows("Ownership History").filter(x=>String(x.PropertyID)===String(record.PropertyID)&&String(x.Ownership_Status)==="Current"&&String(x.Ownership_ID)!==String(recordId||record.Ownership_ID||"")).reduce((a,x)=>a+Number(x[shareKey]||0),0)+Number(record[shareKey]||0);
      if(sum>100.0001)throw new Error("Combined current ownership share cannot exceed 100 percent.");
    }
  } else if(mod==="rates"){
    nonblank("Purpose","Rate purpose");nonblank("Effective_From","Effective From");
    const rate=Number(record.Rate_Per_SqFt_Unit||record.Rate||0);if(!isFinite(rate)||rate<=0)throw new Error("Rate must be greater than zero.");
    if(record.Effective_To&&String(record.Effective_To).slice(0,10)<String(record.Effective_From).slice(0,10))throw new Error("Effective To cannot be earlier than Effective From.");
  } else if(mod==="bankAccounts"){
    nonblank("Bank_Name","Bank name");nonblank("Account_Number","Account number");
    if(rows("Bank Account Master").some(x=>String(x.BankAccount_ID)!==String(recordId||record.BankAccount_ID||"")&&String(x.Account_Number)===String(record.Account_Number)))throw new Error("This bank account number is already registered.");
  } else if(mod==="tenants"){
    nonblank("PropertyID","Property");nonblank("Tenant_Name","Tenant name");
    if(!rows("Property Master").some(x=>String(x.PropertyID)===String(record.PropertyID)&&String(x.Property_Status||"Active")==="Active"))throw new Error("Selected property does not exist or is inactive.");
  } else if(mod==="ratePropertyMapping"){
    nonblank("RateID","Rate");nonblank("PropertyID","Property");
    if(!rows("Rate Master").some(x=>String(x.RateID)===String(record.RateID)&&String(x.Status||"Active")==="Active"))throw new Error("Selected rate does not exist or is inactive.");
    if(!rows("Property Master").some(x=>String(x.PropertyID)===String(record.PropertyID)&&String(x.Property_Status||"Active")==="Active"))throw new Error("Selected property does not exist or is inactive.");
  } else if(mod==="propertyUtilityDetails"){
    nonblank("PropertyID","Property");if(!rows("Property Master").some(x=>String(x.PropertyID)===String(record.PropertyID)&&String(x.Property_Status||"Active")==="Active"))throw new Error("Selected property does not exist or is inactive.");
  } else if(mod==="financialYears"){
    nonblank("FY_Name","Financial year name");nonblank("Start_Date","Start date");nonblank("End_Date","End date");
    if(String(record.End_Date).slice(0,10)<String(record.Start_Date).slice(0,10))throw new Error("Financial year end date must be after start date.");
  } else if(mod==="accountHeads"){nonblank("Account_Name","Account name");nonblank("Account_Type","Account type");}
  else if(mod==="expenseCategories")nonblank("Category_Name","Expense category");
  else if(mod==="notices")nonblank("Notice_Title","Notice title");
  else if(mod==="gallery")nonblank("Event_Name","Event name");
  else if(mod==="preventiveMaintenance")nonblank("Asset_Name","Asset name");
  else if(mod==="activityRequests")nonblank("Subject","Request subject");
}

function validateRolePermissionRecord_(record,permissionSheet,skipId){
  if(!["Admin","Committee","Accountant","Resident"].includes(String(record.Role||"")))throw new Error("Role is invalid.");
  if(!ROLE_PERMISSION_MODULES_.includes(String(record.Module_Name||"")))throw new Error("Module_Name is invalid.");
  ["Can_View","Can_Create","Can_Edit","Can_Delete","Can_Approve"].forEach(k=>{record[k]=record[k]===true||String(record[k]||"").toLowerCase()==="true"||String(record[k])==="1";});
  if(!String(record.Permission_ID||""))throw new Error("Permission_ID is required.");
  if(String(record.Role)==="Admin"&&String(record.Module_Name)==="Role Permission Management"&&(!record.Can_View||!record.Can_Create||!record.Can_Edit))throw new Error("Admin Role Permission Management View/Create/Edit permissions are protected to prevent lockout.");
  if(permissionSheet){const dup=sheetObjects_(permissionSheet).some(r=>String(r.Permission_ID)!==String(skipId||"")&&String(r.Role)===String(record.Role)&&String(r.Module_Name)===String(record.Module_Name));if(dup)throw new Error("A permission record already exists for this Role and Module.");}
}
function createRecord_(session,body){
  const mod=String(body.module||""),cfg=requireModuleWrite_(session,mod,"create",body),id=requireOperationId_(body);if(mod==="activityRequests"&&body.viewAsResident){if(!["Committee","Accountant"].includes(session.role)||!session.propertyId||!session.ownershipId)throw new Error("Resident preview request requires your linked PropertyID and Ownership_ID.");requirePermission_(session,"Activity Requests","Can_Create","Resident");}
  const {ss,sh}=societySheet_(session,cfg.sheet);
  if(mod==="owners")ensureHeaders_(sh,["Owner_Status"]);
  const headers=headerMap_(sh),data=safeRecord_(body.record,headers);if(mod==="rolePermissions"){validateRolePermissionRecord_(data,sh);}
  if(mod==="ownershipHistory"){data.Ownership_Status="Current";delete data.Ownership_End_Date;}
  const recordId=cleanText_(body.record&&body.record[cfg.id]||((cfg.id||"REC").replace(/ID$/i,"")+"-"+randomHex_(8)),100);
  if(!data[cfg.id])data[cfg.id]=recordId;
  if(mod==="activityRequests"){data.Request_Date=data.Request_Date||new Date();data.Request_Status=data.Request_Status||"Pending";data.Assigned_To=data.Assigned_To||"Pending Assignment";data.Updated_At=new Date();}
  if(mod==="notices")data.Notice_Status=data.Notice_Status||"Draft";
  if(mod==="gallery"){data.Uploaded_By=session.userId;data.Uploaded_At=new Date();data.Status=data.Status||"Active";}
  if(mod==="owners")data.Owner_Status=data.Owner_Status||"Active";
  if(mod==="bankAccounts")data.Current_Balance=Number(data.Opening_Balance||0);
  if(cfg.resident){
    if(body.viewAsResident&&mod==="activityRequests")data.PropertyID=session.propertyId;
    assertPropertyAccess_(session,data.PropertyID);
    if(session.role==="Resident"||body.viewAsResident&&mod==="activityRequests"){
      const ownRows=sheetObjects_(societySheet_(session,"Ownership History").sh);
      const own=ownRows.find(x=>String(x.PropertyID)===String(data.PropertyID)&&String(x.Ownership_Status)==="Current");
      if(!own)throw new Error("No current ownership is linked to this property.");
      data.Ownership_ID=own.Ownership_ID;data.OwnerID=own.OwnerID;data.Requested_By=session.userId;data.Request_Status="Pending";
    }
  }
  // Perform expensive cross-sheet validation before taking the global lock.
  // High-integrity uniqueness/ownership constraints are checked again inside it.
  validateMasterRecord_(session,mod,data,"");
  data.Created_By=session.userId;data.Created_At=new Date();

  const lock=LockService.getScriptLock();lock.waitLock(5000);
  let result;
  try{
    const ledger=operationLedger_(ss),prior=findOperation_(ledger,id);
    if(prior){if(prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});throw new Error("A previous operation with this requestId is incomplete; contact Admin.");}
    if(mod==="properties"||mod==="ownershipHistory"||mod==="bankAccounts")validateMasterRecord_(session,mod,data,"");
    if(cfg.id&&rowById_(sh,cfg.id,data[cfg.id]))throw new Error("Record already exists.");
    if(mod==="activityRequests")data.Request_Number=data.Request_Number||("REQ-"+new Date().getFullYear()+"-"+String(sh.getLastRow()).padStart(5,"0"));
    if(mod==="notices")data.Notice_Number=data.Notice_Number||("NOT-"+new Date().getFullYear()+"-"+String(sh.getLastRow()).padStart(4,"0"));
    writeOperation_(ledger,id,"createRecord",recordId,"STARTED",{});
    appendByHeaders_(sh,data);
    result={recordId,data};
    writeOperation_(ledger,id,"createRecord",recordId,"DONE",result);
  }finally{lock.releaseLock();}
  // Audit is append-only but is not part of the critical row-write section.
  if(mod==="rolePermissions")clearRolePermissionCache_(session.societyCode);
  auditEvent_(session,"CREATE",cfg.sheet,recordId,"Created through server API","",data);
  return json_({status:"success",data:result});
}
function updateRecord_(session,body){
  const mod=String(body.module||""),cfg=requireModuleWrite_(session,mod,"update",body);if(mod==="activityRequests"&&body.viewAsResident){if(!["Committee","Accountant"].includes(session.role)||!session.propertyId)throw new Error("Resident preview request update requires your linked property.");requirePermission_(session,"Activity Requests","Can_Edit","Resident");}const id=requireOperationId_(body);const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const {ss,sh}=societySheet_(session,cfg.sheet);const ledger=operationLedger_(ss);const prior=findOperation_(ledger,id);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("A previous update is incomplete; reconcile it before retrying.");
    const recordId=cleanText_(body.recordId,100),found=rowById_(sh,cfg.id,recordId);if(!found)throw new Error("Record not found.");const current=objectFromRow_(found.headers,found.values);if(cfg.resident){if(body.viewAsResident)assertPropertyAccess_(Object.assign({},session,{role:"Resident"}),current.PropertyID);else assertPropertyAccess_(session,current.PropertyID);if((session.role==="Resident"||body.viewAsResident)&&String(current.Requested_By)!==String(session.userId))throw new Error("You may update only your own activity request.");}
    const changes=safeRecord_(body.record,found.headers);if(mod==="activityRequests"&&Object.prototype.hasOwnProperty.call(changes,"Request_Status")&&!body.viewAsResident)requirePermission_(session,"Activity Requests","Can_Approve");if(mod==="rolePermissions"){delete changes.Role;delete changes.Module_Name;validateRolePermissionRecord_(Object.assign({},current,changes),sh,recordId);if(String(current.Role)==="Admin"&&String(current.Module_Name)==="Role Permission Management"&&changes.Can_View===false)throw new Error("Admin permission-management access cannot be disabled here.");}if(mod==="bankAccounts")delete changes.Opening_Balance;if(mod==="ownershipHistory"&&(Object.prototype.hasOwnProperty.call(body.record||{},"Ownership_Status")||Object.prototype.hasOwnProperty.call(body.record||{},"Ownership_End_Date")))throw new Error("Use End Ownership to close an ownership period; ownership history status/date cannot be edited directly.");validateMasterRecord_(session,mod,Object.assign({},current,changes),recordId);if(cfg.resident&&(session.role==="Resident"||body.viewAsResident)){const allowed=["Subject","Description","Priority","Attachment"];Object.keys(changes).forEach(k=>{if(allowed.indexOf(k)<0)delete changes[k];});}
    changes.Updated_At=new Date();writeOperation_(ledger,id,"updateRecord",recordId,"STARTED",{});updateByHeaders_(sh,found.row,changes,[cfg.id,"Created_By","Created_At"]);auditEvent_(session,"UPDATE",cfg.sheet,recordId,"Record updated through server API",current,changes);if(mod==="rolePermissions")clearRolePermissionCache_(session.societyCode);
    const result={recordId};writeOperation_(ledger,id,"updateRecord",recordId,"DONE",result);return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}
function cancelRecord_(session,body){
  const mod=String(body.module||""),cfg=requireModuleWrite_(session,mod,"cancel",body);if(session.role==="Resident")throw new Error("Permission denied.");const id=requireOperationId_(body),recordId=cleanText_(body.recordId,100),reason=cleanText_(body.reason,300);if(!reason)throw new Error("Cancellation reason is required.");
  const lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,cfg.sheet),ledger=operationLedger_(ss),prior=findOperation_(ledger,id);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous cancellation is incomplete; reconcile it before retrying.");const found=rowById_(sh,cfg.id,recordId);if(!found)throw new Error("Record not found.");if(mod==="owners"){ensureHeaders_(sh,["Owner_Status"]);found.headers=headerMap_(sh);}const h=found.headers;
    const cancelMap={properties:["Property_Status","Inactive"],owners:["Owner_Status","Inactive"],ownershipHistory:["Ownership_Status","Previous"],rates:["Status","Inactive"],bankAccounts:["Status","Inactive"],expenseCategories:["Status","Inactive"],notices:["Notice_Status","Archived"],gallery:["Status","Archived"],tenants:["Status","Vacated"],activityRequests:["Request_Status","Cancelled"]};const target=cancelMap[mod];const statusKey=target&&h.indexOf(target[0])>=0?target[0]:["Invoice_Status","Expense_Status","Request_Status","Notice_Status","Status"].find(k=>h.indexOf(k)>=0);if(!statusKey)throw new Error("This record type does not support soft cancellation.");
    const current=objectFromRow_(found.headers,found.values);
    if(mod==="owners"&&sheetObjects_(societySheet_(session,"Ownership History").sh).some(x=>String(x.OwnerID)===recordId&&String(x.Ownership_Status)==="Current"))throw new Error("An owner with current ownership cannot be archived. End the ownership period first.");
    if(mod==="ownershipHistory"&&String(current.Ownership_Status)!=="Current")throw new Error("Only a current ownership record can be ended.");
    writeOperation_(ledger,id,"cancelRecord",recordId,"STARTED",{});const patch={};patch[statusKey]=target?target[1]:"Cancelled";
    if(mod==="ownershipHistory")patch.Ownership_End_Date=new Date();if(h.includes("Cancellation_Reason"))patch.Cancellation_Reason=reason;if(h.includes("Cancelled_By"))patch.Cancelled_By=session.userId;if(h.includes("Cancelled_At"))patch.Cancelled_At=new Date();updateByHeaders_(sh,found.row,patch,[cfg.id,"Created_By","Created_At"]);auditEvent_(session,"CANCEL",cfg.sheet,recordId,reason,objectFromRow_(found.headers,found.values),patch);writeOperation_(ledger,id,"cancelRecord",recordId,"DONE",{recordId});return json_({status:"success",data:{recordId}});}finally{lock.releaseLock();}
}
function generateInvoice_(session,body){
  requireRole_(session,FINANCE_ROLES.invoice);requirePermission_(session,"Maintenance & Invoices","Can_Create");const opId=requireOperationId_(body),propertyId=cleanText_(body.propertyId,80),rateId=cleanText_(body.rateId,80);if(!propertyId||!rateId)throw new Error("Property and Rate are required.");
  const lock=LockService.getScriptLock();lock.waitLock(20000);try{const {ss,sh}=societySheet_(session,"Invoice_Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,opId);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("A previous invoice generation is incomplete; reconcile it before retrying.");
    const props=sheetObjects_(societySheet_(session,"Property Master").sh),prop=props.find(x=>String(x.PropertyID)===propertyId&&String(x.Property_Status||"Active")==="Active");if(!prop)throw new Error("Active property not found.");
    const from=String(body.billPeriodFrom||""),to=String(body.billPeriodTo||""),date=from;if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||!/^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate||""))||String(body.dueDate)<from)throw new Error("Invalid billing period or due date.");
    const ownerships=sheetObjects_(societySheet_(session,"Ownership History").sh),candidates=ownerships.filter(x=>String(x.PropertyID)===propertyId&&(!x.Ownership_Start_Date||String(x.Ownership_Start_Date).slice(0,10)<=from)&&(!x.Ownership_End_Date||String(x.Ownership_End_Date).slice(0,10)>=to));if(candidates.length!==1)throw new Error(candidates.length?"Billing period overlaps multiple/joint ownership rows. Split the period or resolve ownership mapping before invoicing.":"No single ownership record covers the full billing period. Split the billing period at the ownership transfer date.");const own=candidates[0];
    const existingInvoices=sheetObjects_(sh);if(existingInvoices.some(x=>String(x.PropertyID)===propertyId&&String(x.RateID)===rateId&&String(x.Bill_Period_From)===from&&String(x.Bill_Period_To)===to&&String(x.Ownership_ID)===String(own.Ownership_ID)&&String(x.Invoice_Status)!=="Cancelled"))throw new Error("An invoice already exists for this property, ownership, rate and billing period.");
    const rates=sheetObjects_(societySheet_(session,"Rate Master").sh),rate=rates.find(x=>String(x.RateID)===rateId&&String(x.Status||x.Rate_Status)==="Active");if(!rate)throw new Error("Active rate not found.");if(String(rate.Applicable_To||"All Properties")!=="All Properties"&&String(rate.Applicable_To)!=="All"){const mappings=sheetObjects_(societySheet_(session,"Rate Property Mapping").sh);if(!mappings.some(m=>String(m.RateID)===rateId&&String(m.PropertyID)===propertyId&&String(m.Status||"Active")==="Active"&&(!m.Effective_From||String(m.Effective_From).slice(0,10)<=from)&&(!m.Effective_To||String(m.Effective_To).slice(0,10)>=from)))throw new Error("This rate is not mapped to the selected property for the billing period.");}
    if(String(rate.Effective_From||"")>date||(rate.Effective_To&&String(rate.Effective_To).slice(0,10)<date))throw new Error("Rate is not effective for the billing period.");
    const basis=String(rate.Area_Basis||"None"),area=Number(prop[basis]||0),quantity=Number(body.quantity||1),unitRate=Number(rate.Rate_Per_SqFt_Unit||rate.Rate||0);let charge=0;const method=String(rate.Calculation_Method||"Fixed Amount");if(!isFinite(unitRate)||unitRate<=0||!isFinite(quantity)||quantity<=0)throw new Error("Rate and quantity must be positive valid numbers.");if((method==="Area × Rate"||method==="Area x Rate")&&(!isFinite(area)||area<=0))throw new Error("The selected property does not have the required chargeable area.");if(method==="Area × Rate"||method==="Area x Rate")charge=area*unitRate;else if(method==="Quantity × Rate"||method==="Quantity x Rate")charge=quantity*unitRate;else charge=unitRate;
    const late=Number(body.lateFee||0),discount=Number(body.discount||0),adjust=Number(body.adjustment||0);if(![late,discount,adjust].every(isFinite)||late<0||discount<0)throw new Error("Late fee and discount must be valid non-negative amounts.");charge=Math.round(charge*100)/100;const net=Math.round((charge+late-discount+adjust)*100)/100;if(net<0)throw new Error("Net invoice amount cannot be negative.");
    const invoiceId="INV-ID-"+randomHex_(8).toUpperCase(),invoiceNo="INV-"+new Date().getFullYear()+"-"+String(sh.getLastRow()).padStart(4,"0");const owner=sheetObjects_(societySheet_(session,"Owner Master").sh).find(x=>String(x.OwnerID)===String(own.OwnerID));
    const record={InvoiceID:invoiceId,Invoice_Number:invoiceNo,Billing_Date:new Date(),Bill_Period_From:from,Bill_Period_To:to,Due_Date:cleanText_(body.dueDate,20),Ownership_ID:own.Ownership_ID,PropertyID:propertyId,OwnerID:own.OwnerID,Purpose:rate.Purpose,Flat_Number:prop.Flat_No,Owner_Name:owner?owner.Owner_Name:"",RateID:rateId,Rate_Per_SqFt_Unit:unitRate,Area_Basis:basis,Area_SqFt:area,Quantity:quantity,Charge_Amount:charge,Late_Fee:late,Discount_Amount:discount,Adjustment_Amount:adjust,Net_Charge_Amount:net,Paid_Amount:0,Outstanding_Amount:net,Calculation_Method:method,Unit_Of_Measure:(method==="Area × Rate"||method==="Area x Rate")?"Sq.Ft.":"Unit",Invoice_Description:String(rate.Purpose||"Charge")+" for Flat "+String(prop.Flat_No||"")+" ("+from+" to "+to+")",File_Reference:"",Invoice_Status:"Unpaid",Created_By:session.userId,Created_At:new Date(),Approved_By:session.userId,Approved_At:new Date(),Cancelled_At:"",Cancelled_By:"",Cancellation_Reason:"",Rate_Effective_Date:rate.Effective_From,Remarks:cleanText_(body.remarks,300)};
    writeOperation_(ledger,opId,"generateInvoice",invoiceId,"STARTED",{});appendByHeaders_(sh,record);postJournalEntry_(ss,"Invoice",invoiceId,new Date(),[{accountName:"Accounts Receivable",accountType:"Asset",debit:net,credit:0,propertyId,ownershipId:own.Ownership_ID,narration:"Invoice "+invoiceNo},{accountName:String(rate.Purpose||"Maintenance")+" Income",accountType:"Income",debit:0,credit:net,propertyId,ownershipId:own.Ownership_ID,narration:"Invoice "+invoiceNo}],session);auditEvent_(session,"CREATE","Invoice_Register",invoiceId,"Invoice generated; Net amount="+net,"",record);writeOperation_(ledger,opId,"generateInvoice",invoiceId,"DONE",{invoiceId,invoiceNo,net});return json_({status:"success",data:{invoiceId,invoiceNo,net,invoice:record}});
  }finally{lock.releaseLock();}
}
function cancelInvoice_(session,body){
  requireRole_(session,["Admin"]);const op=requireOperationId_(body),invoiceId=cleanText_(body.invoiceId,100),reason=cleanText_(body.reason,300);
  if(!reason)throw new Error("Invoice cancellation reason is required.");
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const ss=SpreadsheetApp.openById(session.databaseId),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});
    if(prior)throw new Error("Previous invoice cancellation is incomplete; reconcile before retrying.");
    const sh=societySheet_(session,"Invoice_Register").sh,found=rowById_(sh,"InvoiceID",invoiceId);if(!found)throw new Error("Invoice not found.");
    const inv=objectFromRow_(found.headers,found.values);if(inv.Invoice_Status==="Cancelled")throw new Error("Invoice is already cancelled.");
    if(Number(inv.Paid_Amount||0)>0)throw new Error("An invoice with received payments cannot be cancelled. Post a reviewed credit/reversal workflow instead.");
    writeOperation_(ledger,op,"cancelInvoice",invoiceId,"STARTED",{});
    updateByHeaders_(sh,found.row,{Invoice_Status:"Cancelled",Cancellation_Reason:reason,Cancelled_By:session.userId,Cancelled_At:new Date()},["InvoiceID","Invoice_Number"]);
    const amount=Number(inv.Net_Charge_Amount||0);
    if(amount>0)postJournalEntry_(ss,"Invoice Reversal",invoiceId,new Date(),[{accountName:String(inv.Purpose||"Maintenance")+" Income",accountType:"Income",debit:amount,credit:0,propertyId:inv.PropertyID,ownershipId:inv.Ownership_ID,narration:"Cancel invoice "+inv.Invoice_Number},{accountName:"Accounts Receivable",accountType:"Asset",debit:0,credit:amount,propertyId:inv.PropertyID,ownershipId:inv.Ownership_ID,narration:"Cancel invoice "+inv.Invoice_Number}],session);
    auditEvent_(session,"CANCEL","Invoice_Register",invoiceId,reason,inv,{Invoice_Status:"Cancelled"});
    writeOperation_(ledger,op,"cancelInvoice",invoiceId,"DONE",{invoiceId});
    return json_({status:"success",data:{invoiceId,status:"Cancelled"}});
  }finally{lock.releaseLock();}
}

function submitPayment_(session,body){
  const residentPreview=Boolean(body.viewAsResident)&&["Committee","Accountant"].includes(session.role);
  if(residentPreview){if(!session.propertyId||!session.ownershipId||String(body.propertyId||"")!==String(session.propertyId)||String(body.ownershipId||"")!==String(session.ownershipId))throw new Error("Resident preview payment is restricted to your linked property and ownership.");requirePermission_(session,"Pay Now","Can_Create","Resident");}
  else if(session.role==="Resident")requirePermission_(session,"Pay Now","Can_Create","Resident");
  else {requireRole_(session,FINANCE_ROLES.paymentSubmit);requirePermission_(session,"Payments","Can_Create");}
  const opId=requireOperationId_(body),amount=Number(body.amount);if(!isFinite(amount)||amount<=0||amount>100000000)throw new Error("Payment amount must be greater than zero and within the permitted limit.");if(["UPI","NEFT","IMPS","Cheque","Cash","Card"].indexOf(String(body.mode))<0)throw new Error("Invalid payment mode.");const propertyId=cleanText_(body.propertyId,80);assertPropertyAccess_(session,propertyId);const ownershipSession=residentPreview?Object.assign({},session,{role:"Resident"}):session;const own=assertOwnership_(ownershipSession,propertyId,body.ownershipId,body.ownerId);
  const lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Fund Inflow Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,opId);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("A previous payment submission is incomplete; reconcile it before retrying.");
    const ref=cleanText_(body.reference,120);if(String(body.mode||"")!=="Cash"&&!ref)throw new Error("Payment transaction reference is required for non-cash payments.");if(ref){const existing=sheetObjects_(sh).find(r=>String(r.Received_Reference||"")===ref&&String(r.PropertyID)===propertyId&&String(r.Receipt_Status||"")!=="Cancelled");if(existing)throw new Error("This payment reference has already been submitted.");}
    const requestedInvoices=Array.isArray(body.invoiceIds)?body.invoiceIds:[];if(requestedInvoices.length){const invoiceRows=sheetObjects_(societySheet_(session,"Invoice_Register").sh);requestedInvoices.forEach(iid=>{const inv=invoiceRows.find(x=>String(x.InvoiceID)===String(iid));if(!inv||String(inv.PropertyID)!==propertyId||String(inv.Ownership_ID)!==String(own.Ownership_ID)||String(inv.Invoice_Status)==="Cancelled")throw new Error("One or more selected invoices are invalid for this ownership period.");});}
    const bankId=cleanText_(body.bankAccount,80);if(bankId){const bankRows=sheetObjects_(societySheet_(session,"Bank Account Master").sh);if(!bankRows.some(b=>String(b.BankAccount_ID)===bankId&&String(b.Status||"Active")==="Active"))throw new Error("Selected bank account is not active.");}
    const prop=sheetObjects_(societySheet_(session,"Property Master").sh).find(x=>String(x.PropertyID)===propertyId);const owner=sheetObjects_(societySheet_(session,"Owner Master").sh).find(x=>String(x.OwnerID)===String(own.OwnerID));const receiptNo="";const transactionId="TXN-"+randomHex_(8).toUpperCase();
    const record={Transaction_ID:transactionId,Receipt_Number:receiptNo,Date_Of_Received:new Date(),PropertyID:propertyId,Ownership_ID:own.Ownership_ID,OwnerID:own.OwnerID,Flat_No:prop?prop.Flat_No:"",Owner_Name:owner?owner.Owner_Name:"",Received_Amount:amount,Received_Mode:cleanText_(body.mode,30),Received_Reference:ref,Bank_Account:session.role==="Resident"||residentPreview?"":cleanText_(body.bankAccount,80),Unallocated_Amount:amount,Remarks:cleanText_(body.remarks,300),File_Reference:cleanText_(body.fileReference,300),Created_By:session.userId,Created_At:new Date(),Receipt_Status:"Pending Verification"};writeOperation_(ledger,opId,"submitPayment",transactionId,"STARTED",{});appendByHeaders_(sh,record);writeOperation_(ledger,opId,"submitPayment",transactionId,"DONE",{transactionId,receiptNo,amount});auditEvent_(session,"CREATE","Fund Inflow Register",transactionId,"Payment submitted; Amount="+amount,"",record);return json_({status:"success",data:{transactionId,receiptNo,amount,status:"Pending Verification",receipt:record}});
  }finally{lock.releaseLock();}
}
function confirmPayment_(session,body){requirePermission_(session,"Payments","Can_Approve");return settlePayment_(session,body,false);}
function rejectPayment_(session,body){requireRole_(session,FINANCE_ROLES.paymentVerify);requirePermission_(session,"Payments","Can_Approve");const reason=cleanText_(body.reason,300);if(!reason)throw new Error("Rejection reason is required.");const lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Fund Inflow Register"),ledger=operationLedger_(ss),op=requireOperationId_(body),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous payment rejection is incomplete; reconcile it before retrying.");const priorTxn=findOperationByActionRecord_(ledger,"rejectPayment",body.transactionId);if(priorTxn){if(priorTxn.status==="DONE")return json_({status:"success",duplicate:true});throw new Error("A previous rejection for this payment is incomplete; reconcile it before retrying.");}const f=rowById_(sh,"Transaction_ID",body.transactionId);if(!f)throw new Error("Payment not found.");const rec=objectFromRow_(f.headers,f.values);if(rec.Receipt_Status!=="Pending Verification")throw new Error("Only pending payments can be rejected.");writeOperation_(ledger,op,"rejectPayment",body.transactionId,"STARTED",{});updateByHeaders_(sh,f.row,{Receipt_Status:"Rejected",Remarks:String(rec.Remarks||"")+" | Rejected: "+reason},["Transaction_ID","Receipt_Number"]);writeOperation_(ledger,op,"rejectPayment",body.transactionId,"DONE",{transactionId:body.transactionId});auditEvent_(session,"CANCEL","Fund Inflow Register",body.transactionId,reason,rec,{Receipt_Status:"Rejected"});return json_({status:"success"});}finally{lock.releaseLock();}}
function settlePayment_(session,body,unused){requireRole_(session,FINANCE_ROLES.paymentVerify);const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(20000);try{const {ss,sh}=societySheet_(session,"Fund Inflow Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("A previous payment confirmation is incomplete; reconcile it before retrying.");const priorTxn=findOperationByActionRecord_(ledger,"confirmPayment",body.transactionId);if(priorTxn){if(priorTxn.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(priorTxn.result)});throw new Error("A previous confirmation for this payment is incomplete; reconcile it before retrying.");}const found=rowById_(sh,"Transaction_ID",body.transactionId);if(!found)throw new Error("Payment not found.");const receipt=objectFromRow_(found.headers,found.values);if(receipt.Receipt_Status!=="Pending Verification")throw new Error("Only pending payments can be confirmed.");const allocations=Array.isArray(body.allocations)?body.allocations:[];let remaining=Number(receipt.Received_Amount),totalAllocated=0;const invSh=societySheet_(session,"Invoice_Register").sh,billSh=societySheet_(session,"Bill Wise Details").sh;const invoiceRows=sheetObjects_(invSh);const toWrite=[],seenInvoiceIds={};
    allocations.forEach(a=>{if(seenInvoiceIds[String(a.invoiceId)])throw new Error("Duplicate invoice allocation was supplied.");seenInvoiceIds[String(a.invoiceId)]=true;const inv=invoiceRows.find(x=>String(x.InvoiceID)===String(a.invoiceId));if(!inv)throw new Error("Invoice not found: "+a.invoiceId);if(String(inv.PropertyID)!==String(receipt.PropertyID))throw new Error("Payment can only be allocated to invoices for the same property.");if(String(inv.Ownership_ID)!==String(receipt.Ownership_ID))throw new Error("Invoice ownership period does not match payment ownership.");const out=Math.max(0,Number(inv.Outstanding_Amount||0)),amt=Number(a.amount);if(!isFinite(amt)||amt<=0||amt>out||amt>remaining)throw new Error("Invalid allocation amount.");const after=out-amt;toWrite.push({invoice:inv,amount:amt,before:out,after});remaining-=amt;totalAllocated+=amt;});
    const bankSh=societySheet_(session,"Bank Account Master").sh;let bankId=String(receipt.Bank_Account||"");let bf=bankId?rowById_(bankSh,"BankAccount_ID",bankId):null;if(!bf){const activeBanks=sheetObjects_(bankSh).filter(b=>String(b.Status||"Active")==="Active");const defaultBank=activeBanks.find(b=>String(b.Is_Default||"").toLowerCase()==="true"||String(b.Is_Default||"")==="1")||activeBanks[0];if(defaultBank){bankId=String(defaultBank.BankAccount_ID);bf=rowById_(bankSh,"BankAccount_ID",bankId);}}if(!bf)throw new Error("No active bank account is configured; payment confirmation was not completed.");const receiptNo=nextReceiptNumber_(sh);
    writeOperation_(ledger,op,"confirmPayment",body.transactionId,"STARTED",{});
    const writtenAllocations=[];toWrite.forEach(x=>{const f=rowById_(invSh,"InvoiceID",x.invoice.InvoiceID);updateByHeaders_(invSh,f.row,{Paid_Amount:Number(x.invoice.Paid_Amount||0)+x.amount,Outstanding_Amount:x.after,Invoice_Status:x.after<=0?"Paid":"Partially Paid"},["InvoiceID","Invoice_Number"]);const allocation={Allocation_ID:"ALC-"+randomHex_(7),Transaction_ID:receipt.Transaction_ID,InvoiceID:x.invoice.InvoiceID,PropertyID:receipt.PropertyID,Ownership_ID:receipt.Ownership_ID,OwnerID:receipt.OwnerID,Invoice_Number:x.invoice.Invoice_Number,Invoice_Amount:x.invoice.Net_Charge_Amount,Previously_Paid:x.invoice.Paid_Amount,Outstanding_Before:x.before,Allocated_Amount:x.amount,Outstanding_After:x.after,Allocation_Date:new Date(),Created_By:session.userId,Created_At:new Date()};appendByHeaders_(billSh,allocation);writtenAllocations.push(allocation);});
    updateByHeaders_(bankSh,bf.row,{Current_Balance:Number(objectFromRow_(bf.headers,bf.values).Current_Balance||0)+Number(receipt.Received_Amount)},["BankAccount_ID","Account_Number"]);updateByHeaders_(sh,found.row,{Receipt_Status:"Confirmed",Unallocated_Amount:remaining,Bank_Account:bankId,Receipt_Number:receiptNo},["Transaction_ID"]);
    const bankRec=objectFromRow_(bf.headers,bf.values);
    const journalEntries=[{accountName:"Bank: "+String(bankRec.Bank_Name||bankRec.Account_Name||bankId),accountType:"Asset",debit:Number(receipt.Received_Amount),credit:0,propertyId:receipt.PropertyID,ownershipId:receipt.Ownership_ID,narration:"Receipt "+receiptNo}];
    if(totalAllocated>0)journalEntries.push({accountName:"Accounts Receivable",accountType:"Asset",debit:0,credit:totalAllocated,propertyId:receipt.PropertyID,ownershipId:receipt.Ownership_ID,narration:"Allocation for receipt "+receiptNo});
    if(remaining>0)journalEntries.push({accountName:"Resident Advances",accountType:"Liability",debit:0,credit:remaining,propertyId:receipt.PropertyID,ownershipId:receipt.Ownership_ID,narration:"Unallocated advance "+receiptNo});
    postJournalEntry_(ss,"Receipt",receipt.Transaction_ID,new Date(),journalEntries,session);
    const result={transactionId:receipt.Transaction_ID,receiptNo,bankAccount:bankId,allocated:totalAllocated,unallocated:remaining,allocationRows:writtenAllocations};writeOperation_(ledger,op,"confirmPayment",receipt.Transaction_ID,"DONE",result);clearFundBalanceCache_(session.societyCode);auditEvent_(session,"ALLOCATE","Fund Inflow Register",receipt.Transaction_ID,"Allocated="+totalAllocated+", advance="+remaining,receipt,{Receipt_Status:"Confirmed",Receipt_Number:receiptNo,Unallocated_Amount:remaining,Bank_Account:bankId});return json_({status:"success",data:result});
  }finally{lock.releaseLock();}}
function allocatePayment_(session,body){requirePermission_(session,"Bill Wise Details","Can_Edit");return settlePayment_(session,body,false);}
function createExpense_(session,body){requireRole_(session,FINANCE_ROLES.expenseCreate);requirePermission_(session,"Expenses","Can_Create");const op=requireOperationId_(body),r=body.record||{},amount=Number(r.Payment_Amount);if(!isFinite(amount)||amount<=0)throw new Error("Expense amount must be greater than zero.");if(!cleanText_(r.Expense_Category,100)||!cleanText_(r.Payee_Name,120)||!cleanText_(r.Particulars,300))throw new Error("Expense category, payee and particulars are required.");if(["UPI","NEFT","IMPS","Cheque","Cash","Card"].indexOf(String(r.Payment_Mode))<0)throw new Error("Invalid expense payment mode.");const lock=LockService.getScriptLock();lock.waitLock(15000);try{const bankSh=societySheet_(session,"Bank Account Master").sh;if(!sheetObjects_(bankSh).some(b=>String(b.BankAccount_ID)===String(r.Bank_Account)&&String(b.Status||"Active")==="Active"))throw new Error("Select an active society bank account.");const {ss,sh}=societySheet_(session,"Expense Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("A previous expense creation is incomplete; reconcile it before retrying.");const existingExpense=sheetObjects_(sh).find(x=>String(x.Payment_Reference||"")===String(r.Payment_Reference||"")&&String(x.Payee_Name||"").toLowerCase()===String(r.Payee_Name||"").toLowerCase()&&Number(x.Payment_Amount||0)===amount&&String(x.Expense_Status||"")!=="Cancelled"&&String(r.Payment_Reference||"")!=="N/A");if(existingExpense)throw new Error("An expense with the same payee, payment reference and amount already exists.");writeOperation_(ledger,op,"createExpense","","STARTED",{});const id="EXP-"+randomHex_(8).toUpperCase(),voucher="VOU-"+new Date().getFullYear()+"-"+String(Math.max(1,sh.getLastRow())).padStart(6,"0");const rec=Object.assign({},r,{Expense_ID:id,Voucher_No:voucher,Expense_Status:"Pending Approval",Created_By:session.userId,Created_At:new Date(),Approved_By:"",Approved_At:"",Cancelled_By:"",Cancelled_At:"",Cancellation_Reason:""});appendByHeaders_(sh,rec);writeOperation_(ledger,op,"createExpense",id,"DONE",{expenseId:id,voucherNo:voucher});auditEvent_(session,"CREATE","Expense Register",id,"Voucher="+voucher,"",rec);return json_({status:"success",data:{expenseId:id,voucherNo:voucher,expense:rec}});}finally{lock.releaseLock();}}
function approveExpense_(session,body){requireRole_(session,FINANCE_ROLES.expenseApprove);requirePermission_(session,"Expenses","Can_Approve");return updateExpenseStatus_(session,body,"Approved");}
function markExpensePaid_(session,body){requireRole_(session,FINANCE_ROLES.expensePay);requirePermission_(session,"Expenses","Can_Edit");return updateExpenseStatus_(session,body,"Paid");}
function cancelExpense_(session,body){requireRole_(session,FINANCE_ROLES.expenseApprove);requirePermission_(session,"Expenses","Can_Delete");const reason=cleanText_(body.reason,300);if(!reason)throw new Error("Cancellation reason is required.");const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Expense Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous expense operation is incomplete; reconcile it before retrying.");const priorCancel=findOperationByActionRecord_(ledger,"cancelExpense",body.expenseId);if(priorCancel){if(priorCancel.status==="DONE")return json_({status:"success",duplicate:true});throw new Error("A previous cancellation for this expense is incomplete; reconcile it before retrying.");}const f=rowById_(sh,"Expense_ID",body.expenseId);if(!f)throw new Error("Expense not found.");const r=objectFromRow_(f.headers,f.values);if(r.Expense_Status==="Paid")throw new Error("Paid expenses cannot be cancelled. Use a reversal entry.");writeOperation_(ledger,op,"cancelExpense",body.expenseId,"STARTED",{});updateByHeaders_(sh,f.row,{Expense_Status:"Cancelled",Cancelled_By:session.userId,Cancelled_At:new Date(),Cancellation_Reason:reason},["Expense_ID","Voucher_No"]);writeOperation_(ledger,op,"cancelExpense",body.expenseId,"DONE",{expenseId:body.expenseId});clearFundBalanceCache_(session.societyCode);auditEvent_(session,"CANCEL","Expense Register",body.expenseId,reason,r,{Expense_Status:"Cancelled"});return json_({status:"success"});}finally{lock.releaseLock();}}
function updateExpenseStatus_(session,body,status){const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Expense Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous expense operation is incomplete; reconcile it before retrying.");const priorExpense=findOperationByActionRecord_(ledger,"expensePaid",body.expenseId);if(status==="Paid"&&priorExpense){if(priorExpense.status==="DONE")return json_({status:"success",duplicate:true});throw new Error("A previous payment for this expense is incomplete; reconcile it before retrying.");}const f=rowById_(sh,"Expense_ID",body.expenseId);if(!f)throw new Error("Expense not found.");const r=objectFromRow_(f.headers,f.values);if(status==="Approved"&&r.Expense_Status!=="Pending Approval")throw new Error("Only pending expenses can be approved.");if(status==="Paid"&&String(r.Expense_Status)!=="Approved")throw new Error("Expense must be approved before it can be marked Paid.");if(status==="Paid"){const bankSh=societySheet_(session,"Bank Account Master").sh,bf=rowById_(bankSh,"BankAccount_ID",r.Bank_Account);if(!bf)throw new Error("Bank account not found.");const bank=objectFromRow_(bf.headers,bf.values),amount=Number(r.Payment_Amount||0),balance=Number(bank.Current_Balance||0);if(amount<=0||balance<amount)throw new Error("Insufficient bank balance or invalid expense amount.");writeOperation_(ledger,op,"expensePaid",body.expenseId,"STARTED",{});updateByHeaders_(bankSh,bf.row,{Current_Balance:balance-amount},["BankAccount_ID","Account_Number"]);const bankName=String(bank.Bank_Name||bank.Account_Name||r.Bank_Account);postJournalEntry_(ss,"Expense",body.expenseId,new Date(),[{accountName:"Expense: "+String(r.Expense_Category),accountType:"Expense",debit:amount,credit:0,narration:"Voucher "+String(r.Voucher_No||body.expenseId)},{accountName:"Bank: "+bankName,accountType:"Asset",debit:0,credit:amount,narration:"Voucher "+String(r.Voucher_No||body.expenseId)}],session);}
    if(status!=="Paid")writeOperation_(ledger,op,"expense"+status,body.expenseId,"STARTED",{});
    updateByHeaders_(sh,f.row,status==="Approved"?{Expense_Status:status,Approved_By:session.userId,Approved_At:new Date()}:{Expense_Status:"Paid",Approved_By:session.userId,Approved_At:r.Approved_At||new Date(),Payment_Date:r.Payment_Date||new Date()},["Expense_ID","Voucher_No"]);writeOperation_(ledger,op,"expense"+status,body.expenseId,"DONE",{expenseId:body.expenseId,status});clearFundBalanceCache_(session.societyCode);auditEvent_(session,status==="Paid"?"APPROVE":"UPDATE","Expense Register",body.expenseId,status,r,{Expense_Status:status,Payment_Date:status==="Paid"?(r.Payment_Date||new Date()):r.Payment_Date});return json_({status:"success"});}finally{lock.releaseLock();}}

function societyDriveInfo_(code){
  const master=SpreadsheetApp.openById(getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID"));
  const sh=master.getSheetByName("Society Master");if(!sh)throw new Error("Missing Central Master tab: Society Master");
  const headers=headerMap_(sh),col=headers.indexOf("Society_Code")+1;if(!col)throw new Error("Missing required column: Society_Code");
  const last=sh.getLastRow();if(last<2)throw new Error("Society not found or inactive.");
  const hits=sh.getRange(2,col,last-1,1).createTextFinder(String(code)).matchCase(false).matchEntireCell(true).findAll();
  if(hits.length!==1)throw new Error("Society not found or duplicated.");
  const info=objectFromRow_(headers,sh.getRange(hits[0].getRow(),1,1,headers.length).getValues()[0]);
  if(String(info.Society_Status||"").trim().toLowerCase()!=="active")throw new Error("Society is inactive.");
  return info;
}

function createPrivateSocietyFolder_(session){
  const cache=CacheService.getScriptCache(),key="DRIVE_FOLDER_"+sha256_(String(session.societyCode));
  const cachedId=cache.get(key);
  if(cachedId){try{const cached=DriveApp.getFolderById(cachedId);if(cached.getSharingAccess()===DriveApp.Access.PRIVATE)return cached;}catch(e){}cache.remove(key);}
  const info=societyDriveInfo_(session.societyCode);
  const rootId=String(info.Drive_Folder_ID||info.Drive_FolderID||info["Drive Folder ID"]||"");
  const root=rootId?DriveApp.getFolderById(rootId):DriveApp.getFolderById(getConfigValue_("DEFAULT_DRIVE_FOLDER_ID"));
  if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Society Drive root folder must be private.");
  const name="Society_"+session.societyCode,iterator=root.getFoldersByName(name);
  const sub=iterator.hasNext()?iterator.next():root.createFolder(name);
  if(sub.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Society private document folder must not be shared.");
  cache.put(key,sub.getId(),21600);return sub;
}
function uploadPrivateFile_(session,body){
  const op=requireOperationId_(body),name=cleanText_(body.fileName,120),mime=String(body.mimeType||""),encoded=String(body.base64||"").replace(/^data:[^;]+;base64,/i,"");
  if(!name)throw new Error("File name is required.");
  if(["application/pdf","image/jpeg","image/png"].indexOf(mime)<0)throw new Error("Only PDF, JPG and PNG files are accepted.");
  if(encoded.length>7*1024*1024)throw new Error("Maximum upload size is 5 MB.");
  const bytes=Utilities.base64Decode(encoded);if(!bytes.length||bytes.length>5*1024*1024)throw new Error("Maximum upload size is 5 MB.");
  const category=cleanText_(body.category,40),lower=category.toLowerCase(),propertyId=cleanText_(body.propertyId,80),ownerId=cleanText_(body.ownerId,80);
  const relatedModule=cleanText_(body.relatedModule,60),relatedRecordId=cleanText_(body.relatedRecordId,100);
  const categoryRoles={
    "owner document":["Admin"],"ownership document":["Admin"],"property document":["Admin"],
    "expense voucher":["Admin","Accountant"],"gallery photo":["Admin","Committee"],
    "notice attachment":["Admin","Committee"],"activity request attachment":["Admin","Committee","Resident"],
    "payment proof":["Admin","Accountant","Resident"],"invoice pdf":["Admin","Accountant"],
    "kyc":["Admin"],"bank statement":["Admin"]
  };
  if(!categoryRoles[lower])throw new Error("Unsupported document category.");
  const residentPreview=Boolean(body.viewAsResident)&&["Committee","Accountant"].includes(session.role);
  const previewAllowedCategories=["payment proof","activity request attachment"];
  if(categoryRoles[lower].indexOf(session.role)<0&&!(residentPreview&&previewAllowedCategories.includes(lower)))throw new Error("Permission denied for this document category.");
  if(residentPreview){if(!session.propertyId||!session.ownershipId||String(propertyId)!==String(session.propertyId))throw new Error("Resident preview document access is restricted to your linked property and ownership.");if(lower==="payment proof")requirePermission_(session,"Pay Now","Can_Create","Resident");if(lower==="activity request attachment")requirePermission_(session,"Activity Requests","Can_Create","Resident");}
  if(propertyId&&!rowById_(societySheet_(session,"Property Master").sh,"PropertyID",propertyId))throw new Error("Selected property does not exist in this society.");
  if(ownerId&&!rowById_(societySheet_(session,"Owner Master").sh,"OwnerID",ownerId))throw new Error("Selected owner does not exist in this society.");
  if(session.role==="Resident"||residentPreview)assertPropertyAccess_(residentPreview?Object.assign({},session,{role:"Resident"}):session,propertyId);
  const linkMap={
    "owner document":{module:"ownershipHistory",sheet:"Ownership History",id:"Ownership_ID",fields:["Owner_Document","Owner_Document_File_ID"]},
    "ownership document":{module:"ownershipHistory",sheet:"Ownership History",id:"Ownership_ID",fields:["Owner_Document","Owner_Document_File_ID"]},
    "property document":{module:"properties",sheet:"Property Master",id:"PropertyID",fields:["Property_Document","Document_File_ID"]},
    "expense voucher":{module:"expenses",sheet:"Expense Register",id:"Expense_ID",fields:["Supporting_Document","File_Reference","Voucher_File_ID"]},
    "gallery photo":{module:"gallery",sheet:"Gallery Master",id:"Gallery_ID",fields:["Photo_File_Reference","Photo_File_ID","Image_File_ID","File_Reference"]},
    "notice attachment":{module:"notices",sheet:"Notice Master",id:"Notice_ID",fields:["Attachment_File_ID","File_Reference","Attachment"]},
    "activity request attachment":{module:"activityRequests",sheet:"Activity Request Register",id:"Request_ID",fields:["Attachment","Attachment_File_ID"]},
    "payment proof":{module:"receipts",sheet:"Fund Inflow Register",id:"Transaction_ID",fields:["File_Reference","Payment_Proof_File_ID"]},
    "invoice pdf":{module:"invoices",sheet:"Invoice_Register",id:"InvoiceID",fields:["File_Reference","Invoice_PDF_File_ID"]}
  };
  let relatedTarget=null,relatedRecord=null,targetField="",resolvedPropertyId=propertyId,resolvedOwnerId=ownerId;
  if(relatedModule||relatedRecordId){
    const cfg=linkMap[lower];
    if(!cfg||cfg.module!==relatedModule||!relatedRecordId)throw new Error("The selected module does not match this document category.");
    const target=societySheet_(session,cfg.sheet),found=rowById_(target.sh,cfg.id,relatedRecordId);
    if(!found)throw new Error("Related record was not found.");
    relatedTarget={cfg,sh:target.sh};relatedRecord=objectFromRow_(found.headers,found.values);
    if(relatedRecord.PropertyID)assertPropertyAccess_(residentPreview?Object.assign({},session,{role:"Resident"}):session,relatedRecord.PropertyID);
    if((session.role==="Resident"||residentPreview)&&lower==="activity request attachment"&&String(relatedRecord.Requested_By)!==String(session.userId))throw new Error("You may attach files only to your own activity requests.");
    if(residentPreview&&lower==="payment proof"){if(String(relatedRecord.Created_By||"")!==String(session.userId))throw new Error("Resident preview may upload proof only to a payment submitted by your account.");assertOwnership_(Object.assign({},session,{role:"Resident"}),relatedRecord.PropertyID,relatedRecord.Ownership_ID,relatedRecord.OwnerID);}
    if(propertyId&&relatedRecord.PropertyID&&String(propertyId)!==String(relatedRecord.PropertyID))throw new Error("Document property does not match the related record.");
    if(ownerId&&relatedRecord.OwnerID&&String(ownerId)!==String(relatedRecord.OwnerID))throw new Error("Document owner does not match the related ownership record.");
    resolvedPropertyId=resolvedPropertyId||String(relatedRecord.PropertyID||"");
    resolvedOwnerId=resolvedOwnerId||String(relatedRecord.OwnerID||"");
    targetField=cfg.fields.find(f=>found.headers.indexOf(f)>=0);
    if(!targetField)throw new Error("The related sheet has no document reference column. Add one of: "+cfg.fields.join(", "));
  }

  // Critical section 1: reserve the idempotency key. Do not keep the global
  // Apps Script lock while calling Drive (which can take several seconds).
  const lock=LockService.getScriptLock();let ss,ledger;
  lock.waitLock(5000);
  try{
    ss=SpreadsheetApp.openById(session.databaseId);ledger=operationLedger_(ss);
    const prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior&&prior.status!=="FAILED")throw new Error("A previous file upload is in progress or incomplete; check File Registry before retrying.");
    writeOperation_(ledger,op,"uploadPrivateFile","","STARTED",{});
  }finally{lock.releaseLock();}

  // Slow I/O outside the global lock: society folder lookup (cached), Drive file
  // creation and privacy enforcement can now run concurrently for other users.
  let file=null,reg=null,linked=false,committed=false;
  try{
    const folder=createPrivateSocietyFolder_(session);
    const safeName=name.replace(/[^\w.\-]/g,"_");
    const blob=Utilities.newBlob(bytes,mime,session.societyCode+"_"+Date.now()+"_"+safeName);
    file=folder.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);

    // Critical section 2: atomically register/link the file and finish its operation.
    lock.waitLock(5000);
    try{
      reg=ss.getSheetByName("_File Registry");
      if(!reg){reg=ss.insertSheet("_File Registry");reg.getRange(1,1,1,10).setValues([["File_ID","PropertyID","OwnerID","Category","Uploaded_By","Created_At","Related_Module","Related_Record_ID","File_Name","Mime_Type"]]);reg.hideSheet();}
      ensureHeaders_(reg,["File_ID","PropertyID","OwnerID","Category","Uploaded_By","Created_At","Related_Module","Related_Record_ID","File_Name","Mime_Type"]);
      appendByHeaders_(reg,{File_ID:file.getId(),PropertyID:resolvedPropertyId,OwnerID:resolvedOwnerId,Category:category,Uploaded_By:session.userId,Created_At:new Date(),Related_Module:relatedModule,Related_Record_ID:relatedRecordId,File_Name:file.getName(),Mime_Type:mime});
      if(relatedTarget&&relatedRecord){
        const found=rowById_(relatedTarget.sh,relatedTarget.cfg.id,relatedRecordId);
        if(!found)throw new Error("Related record was removed before the upload completed.");
        const patch={};patch[targetField]=file.getId();
        updateByHeaders_(relatedTarget.sh,found.row,patch,[relatedTarget.cfg.id,"Created_By","Created_At"]);
        linked=true;
      }
      const data={fileId:file.getId(),fileName:file.getName(),mimeType:mime,linked};
      writeOperation_(ledger,op,"uploadPrivateFile",file.getId(),"DONE",data);
      committed=true;
    }finally{lock.releaseLock();}
  }catch(uploadError){
    // Best-effort rollback: do not leave a visible registry reference to an
    // uncommitted file. FAILED operations may be safely retried with the same ID.
    if(!committed){
      try{lock.waitLock(5000);try{
        if(linked&&relatedTarget&&relatedRecord){const found=rowById_(relatedTarget.sh,relatedTarget.cfg.id,relatedRecordId);if(found&&String(found.values[found.headers.indexOf(targetField)]||"")===String(file&&file.getId()||"")){const restore={};restore[targetField]=relatedRecord[targetField]||"";updateByHeaders_(relatedTarget.sh,found.row,restore,[relatedTarget.cfg.id,"Created_By","Created_At"]);}}
        if(reg&&file){const rf=rowById_(reg,"File_ID",file.getId());if(rf)reg.deleteRow(rf.row);}
        writeOperation_(ledger,op,"uploadPrivateFile",file?file.getId():"","FAILED",{message:String(uploadError&&uploadError.message||uploadError).slice(0,200)});
      }finally{lock.releaseLock();}}catch(cleanupError){Logger.log("Upload rollback warning: "+cleanupError);}
      if(file){try{file.setTrashed(true);}catch(trashError){Logger.log("Upload cleanup warning: "+trashError);}}
    }
    throw uploadError;
  }
  if(linked)auditEvent_(session,"UPDATE",relatedTarget.cfg.sheet,relatedRecordId,"Private document linked: "+category,relatedRecord,{[targetField]:file.getId()});
  auditEvent_(session,"CREATE","Drive",file.getId(),"Category="+category,"",{fileId:file.getId(),fileName:file.getName(),propertyId:resolvedPropertyId,ownerId:resolvedOwnerId,relatedModule,relatedRecordId,linked});
  return json_({status:"success",data:{fileId:file.getId(),fileName:file.getName(),mimeType:mime,linked}});
}
function getPrivateFile_(session,body){const fileId=cleanText_(body.fileId,200);if(!fileId)throw new Error("File ID is required.");const ss=SpreadsheetApp.openById(session.databaseId),reg=ss.getSheetByName("_File Registry");if(!reg)throw new Error("File registry is not available.");const registered=sheetObjects_(reg).find(r=>String(r.File_ID)===fileId);if(!registered)throw new Error("File is not registered to this society.");const category=String(registered.Category||"").toLowerCase(),residentPreview=Boolean(body.viewAsResident)&&["Committee","Accountant"].includes(session.role);if(session.role==="Resident"||residentPreview){const residentSession=residentPreview?residentViewSession_(session,true):session;assertPropertyAccess_(residentSession,registered.PropertyID);if(body.propertyId&&String(body.propertyId)!==String(registered.PropertyID))throw new Error("File property access denied.");if(["bank statement","expense voucher","kyc"].includes(category))throw new Error("This document category is not available in Resident View.");if(!residentCanAccessLinkedFile_(residentSession,registered))throw new Error("This document is not available to your account or its linked record is not visible.");}else if(session.role==="Committee"&&["kyc","owner document","ownership document","bank statement"].includes(category)){throw new Error("This document category is restricted to Admin.");}else if(session.role==="Accountant"&&["kyc","owner document","ownership document"].includes(category)){throw new Error("This document category is restricted to Admin.");}const file=DriveApp.getFileById(fileId);if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Public/shared Drive files are not served by this API.");let allowed=false;let level=[file.getParents()];for(let depth=0;depth<5&&level.length;depth++){const next=[];level.forEach(it=>{while(it.hasNext()){const folder=it.next();if(folder.getName()==="Society_"+session.societyCode)allowed=true;next.push(folder.getParents());}});level=next;}if(!allowed)throw new Error("File does not belong to this society folder.");const blob=file.getBlob();if(blob.getBytes().length>5*1024*1024)throw new Error("File too large for inline preview; use an authorized Drive workflow.");return json_({status:"success",data:{fileName:file.getName(),mimeType:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())}});}
function createSocietyBackup_(session,body){
  requireRole_(session,["Admin"]);const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const ss=SpreadsheetApp.openById(session.databaseId),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("A previous backup operation is incomplete; check Drive and Backup Log before retrying.");
    writeOperation_(ledger,op,"createSocietyBackup","","STARTED",{});
    const folder=createPrivateSocietyFolder_(session),stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyyMMdd_HHmmss");
    const copy=DriveApp.getFileById(session.databaseId).makeCopy("ABAS_BACKUP_"+session.societyCode+"_"+stamp,folder);
    copy.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    const data={fileId:copy.getId(),fileName:copy.getName(),createdAt:new Date().toISOString(),societyCode:session.societyCode};
    const log=ensureInternalSheet_(ss,"_Backup Log",["Backup_ID","Society_Code","File_ID","File_Name","Created_At","Created_By","Backup_Type","Status"]);
    appendByHeaders_(log,{Backup_ID:"BKP-"+randomHex_(8),Society_Code:session.societyCode,File_ID:copy.getId(),File_Name:copy.getName(),Created_At:new Date(),Created_By:session.userId,Backup_Type:"Manual",Status:"Completed"});
    writeOperation_(ledger,op,"createSocietyBackup",copy.getId(),"DONE",data);
    auditEvent_(session,"CREATE","Backup",copy.getId(),"Society database backup completed","",data);
    return json_({status:"success",data});
  }finally{lock.releaseLock();}
}

function configureAutomatedBackup_(session,body){
  requireRole_(session,["Admin"]);
  const enabled=body.enabled!==false;
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="runScheduledSocietyBackups").forEach(t=>ScriptApp.deleteTrigger(t));
  if(enabled){ScriptApp.newTrigger("runScheduledSocietyBackups").timeBased().everyDays(1).atHour(2).create();PropertiesService.getScriptProperties().setProperty("AUTOMATED_BACKUP_ENABLED","true");}
  else PropertiesService.getScriptProperties().setProperty("AUTOMATED_BACKUP_ENABLED","false");
  auditEvent_(session,"UPDATE","Backup Schedule","DAILY",enabled?"Daily backup trigger enabled":"Daily backup trigger disabled","", {enabled});
  return json_({status:"success",data:{enabled,frequency:"daily",approximateHour:2,timeZone:Session.getScriptTimeZone()}});
}

function runScheduledSocietyBackups(){
  if(PropertiesService.getScriptProperties().getProperty("AUTOMATED_BACKUP_ENABLED")!=="true")return;
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    const central=SpreadsheetApp.openById(getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID"));
    const sm=central.getSheetByName("Society Master");if(!sm)throw new Error("Missing Society Master.");
    const societies=sheetObjects_(sm).filter(x=>String(x.Society_Status||"").toLowerCase()==="active");
    const root=DriveApp.getFolderById(getConfigValue_("DEFAULT_DRIVE_FOLDER_ID"));
    if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Central backup root folder must be private.");
    const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyyMMdd_HHmmss");
    const centralCopy=DriveApp.getFileById(central.getId()).makeCopy("ABAS_CENTRAL_MASTER_BACKUP_"+stamp,root);
    centralCopy.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    const centralLog=ensureInternalSheet_(central,"_Backup Log",["Backup_ID","Society_Code","File_ID","File_Name","Created_At","Created_By","Backup_Type","Status"]);
    appendByHeaders_(centralLog,{Backup_ID:"BKP-"+randomHex_(8),Society_Code:"CENTRAL",File_ID:centralCopy.getId(),File_Name:centralCopy.getName(),Created_At:new Date(),Created_By:"AUTOMATION",Backup_Type:"Daily",Status:"Completed"});
    const results=[];
    societies.forEach(soc=>{
      try{
        const code=String(soc.Society_Code||""),db=String(soc.Database_ID||soc.Database_Spreadsheet_ID||soc["Database Spreadsheet ID"]||"");
        const folderId=String(soc.Drive_Folder_ID||soc.Drive_FolderID||soc["Drive Folder ID"]||"");
        if(!code||!db||!folderId)throw new Error("Missing society code, database ID or Drive folder ID.");
        const societyRoot=DriveApp.getFolderById(folderId);if(societyRoot.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Society Drive folder must be private.");
        const nested=societyRoot.getFoldersByName("Society_"+code);const folder=nested.hasNext()?nested.next():societyRoot.createFolder("Society_"+code);
        if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Society backup subfolder must be private.");
        const file=DriveApp.getFileById(db).makeCopy("ABAS_BACKUP_"+code+"_"+stamp,folder);file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
        const societyDb=SpreadsheetApp.openById(db),log=ensureInternalSheet_(societyDb,"_Backup Log",["Backup_ID","Society_Code","File_ID","File_Name","Created_At","Created_By","Backup_Type","Status"]);
        appendByHeaders_(log,{Backup_ID:"BKP-"+randomHex_(8),Society_Code:code,File_ID:file.getId(),File_Name:file.getName(),Created_At:new Date(),Created_By:"AUTOMATION",Backup_Type:"Daily",Status:"Completed"});
        results.push({societyCode:code,status:"Completed",fileId:file.getId()});
      }catch(err){results.push({societyCode:String(soc.Society_Code||""),status:"Failed",message:safeError_(err)});}
    });
    const runLog=ensureInternalSheet_(central,"_Backup Run Log",["Run_ID","Run_At","Central_Backup_ID","Society_Results_JSON"]);
    appendByHeaders_(runLog,{Run_ID:"RUN-"+randomHex_(8),Run_At:new Date(),Central_Backup_ID:centralCopy.getId(),Society_Results_JSON:JSON.stringify(results)});
  }finally{lock.releaseLock();}
}

function listRecoveryOperations_(session,body){
  requireRole_(session,["Admin"]);
  const ss=SpreadsheetApp.openById(session.databaseId),sh=operationLedger_(ss);
  const rows=sheetObjects_(sh).filter(x=>String(x.Status)==="STARTED"||String(x.Status)==="RECOVERY_REQUIRED");
  return json_({status:"success",data:rows.slice(-100).reverse(),message:"Review these operations against their target register rows before retrying or manually reconciling."});
}

function listSocietyBackups_(session,body){
  requireRole_(session,["Admin"]);
  const ss=SpreadsheetApp.openById(session.databaseId),sh=ss.getSheetByName("_Backup Log");
  return json_({status:"success",data:sh?sheetObjects_(sh).filter(x=>String(x.Society_Code)===String(session.societyCode)).slice(-100).reverse():[]});
}

function restoreSocietyBackup_(session,body){
  requireRole_(session,["Admin"]);
  const backupId=cleanText_(body.backupFileId,200);if(!backupId)throw new Error("Backup file ID is required.");
  const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    const target=SpreadsheetApp.openById(session.databaseId),ledger=operationLedger_(target),prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("A previous restore is incomplete. Inspect the target spreadsheet before retrying.");
    const log=target.getSheetByName("_Backup Log");if(!log)throw new Error("No backup log exists for this society.");
    const approved=sheetObjects_(log).some(x=>String(x.File_ID)===backupId&&String(x.Society_Code)===String(session.societyCode)&&String(x.Status)==="Completed");
    if(!approved)throw new Error("Backup is not registered to this society; restore denied.");
    const folder=createPrivateSocietyFolder_(session),file=DriveApp.getFileById(backupId);
    let inside=false;const parents=file.getParents();while(parents.hasNext()){if(parents.next().getId()===folder.getId())inside=true;}
    if(!inside)throw new Error("Backup file is outside this society's private backup folder.");
    writeOperation_(ledger,op,"restoreSocietyBackup",backupId,"STARTED",{});
    const pre=DriveApp.getFileById(session.databaseId).makeCopy("ABAS_PRE_RESTORE_"+session.societyCode+"_"+Date.now(),folder);pre.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    const source=SpreadsheetApp.openById(backupId);
    const sourceSheets=source.getSheets();
    sourceSheets.forEach(src=>{
      const temp=src.copyTo(target);const tempName="__RESTORE__"+src.getName().slice(0,70)+"_"+randomHex_(3);temp.setName(tempName);
      const existing=target.getSheetByName(src.getName());if(existing&&existing.getSheetId()!==temp.getSheetId())target.deleteSheet(existing);
      temp.setName(src.getName());
    });
    const backupLog=ensureInternalSheet_(target,"_Backup Log",["Backup_ID","Society_Code","File_ID","File_Name","Created_At","Created_By","Backup_Type","Status"]);
    appendByHeaders_(backupLog,{Backup_ID:"BKP-"+randomHex_(8),Society_Code:session.societyCode,File_ID:backupId,File_Name:file.getName(),Created_At:new Date(),Created_By:session.userId,Backup_Type:"Restore Source",Status:"Completed"});
    appendByHeaders_(backupLog,{Backup_ID:"BKP-"+randomHex_(8),Society_Code:session.societyCode,File_ID:pre.getId(),File_Name:pre.getName(),Created_At:new Date(),Created_By:session.userId,Backup_Type:"Pre-Restore",Status:"Completed"});
    const restoreLog=ensureInternalSheet_(target,"_Restore Log",["Restore_ID","Backup_File_ID","Pre_Restore_Backup_ID","Restored_By","Restored_At","Status"]);
    appendByHeaders_(restoreLog,{Restore_ID:"RST-"+randomHex_(8),Backup_File_ID:backupId,Pre_Restore_Backup_ID:pre.getId(),Restored_By:session.userId,Restored_At:new Date(),Status:"Completed"});
    const result={restoredFrom:backupId,preRestoreBackupId:pre.getId(),restoredAt:new Date().toISOString(),sheetCount:sourceSheets.length};
    const restoredLedger=operationLedger_(target);
    writeOperation_(restoredLedger,op,"restoreSocietyBackup",backupId,"DONE",result);
    auditEvent_(session,"RESTORE","Society Database",backupId,"Database restored; pre-restore copy="+pre.getId(),"",result);
    return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}
function auditEvent_(session,action,module,recordId,remarks,oldValue,newValue){const sh=societySheet_(session,"Audit Log").sh;const stringify=v=>{if(v===undefined||v===null||v==="")return "";try{return JSON.stringify(v).slice(0,4500);}catch(e){return String(v).slice(0,4500);}};const row={Log_ID:"LOG-"+randomHex_(8),UserID:session.userId,User_Name:session.fullName||session.userId,Action_Type:action,Module_Name:module,Record_ID:recordId,Old_Value:stringify(oldValue),New_Value:stringify(newValue),Action_DateTime:new Date(),Remarks:cleanText_(remarks,500)};const headers=headerMap_(sh);sh.appendRow(headers.map(h=>Object.prototype.hasOwnProperty.call(row,h)?row[h]:""));}

function getConfigValue_(key){const value=PropertiesService.getScriptProperties().getProperty(key)||CONFIG[key];if(!value)throw new Error("Missing Apps Script Project Property: "+key);return String(value);}

function findRowsByHeaderValue_(sh,header,value){
  if(!sh||sh.getLastRow()<2)return[];
  const headers=headerMap_(sh),col=headers.indexOf(header);
  if(col<0)throw new Error("Missing required column: "+header);
  // Read the data block once. The former implementation issued one extra
  // Spreadsheet service call for every matching row, slowing every login
  // and every authenticated API request that revalidates the user.
  const rowCount=sh.getLastRow()-1,range=sh.getRange(2,1,rowCount,headers.length);
  const display=range.getDisplayValues(),values=range.getValues();
  const target=String(value).trim().toUpperCase(),out=[];
  for(let i=0;i<values.length;i++){
    if(String(display[i][col]||"").trim().toUpperCase()!==target)continue;
    const obj=objectFromRow_(headers,values[i]);obj.__row=i+2;out.push(obj);
  }
  return out;
}
function societyAndUsers_(code) {
  const master=SpreadsheetApp.openById(getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID"));
  const societySheet=master.getSheetByName("Society Master");if(!societySheet)throw new Error('Missing Central Master tab: Society Master');
  const societyRows=findRowsByHeaderValue_(societySheet,"Society_Code",code);const society=societyRows[0];
  if(societyRows.length!==1||!society||String(society.Society_Status||"").trim().toLowerCase()!=="active")throw new Error("Society not found, duplicated or inactive.");
  society.Database_ID=society.Database_ID||society.Database_Spreadsheet_ID||society["Database Spreadsheet ID"];if(!society.Database_ID)throw new Error("Society database is not configured.");
  const usersSheet=master.getSheetByName("Society User Access");if(!usersSheet)throw new Error('Missing Central Master tab: Society User Access');
  ensureHeaders_(usersSheet,USER_HEADERS);const rows=findRowsByHeaderValue_(usersSheet,"Society_Code",code);
  return {society,usersSheet,rows};
}
/**
 * Login-only lookup: find the exact Society_Code and Login_ID rows instead of
 * downloading and parsing every user row for that society on every sign-in.
 * Password hash verification remains unchanged (12,000 HMAC-SHA256 rounds).
 */
function cachedAuthHeaders_(sh) {
  const cache = CacheService.getScriptCache();
  const key = "AUTH_HEADERS_" + sha256_(String(sh.getParent().getId()) + "|" + sh.getName());
  const cached = cache.get(key);
  if (cached) {
    try { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length) return parsed; }
    catch (e) { cache.remove(key); }
  }
  const headers = headerMap_(sh);
  cache.put(key, JSON.stringify(headers), 300);
  return headers;
}

function loginContext_(code, loginId) {
  const master = SpreadsheetApp.openById(getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID"));
  const societySheet = master.getSheetByName("Society Master");
  const usersSheet = master.getSheetByName("Society User Access");
  if (!societySheet) throw new Error('Missing Central Master tab: Society Master');
  if (!usersSheet) throw new Error('Missing Central User Access tab: Society User Access');
  // Authentication is read-only with respect to sheet structure. Header repair belongs
  // to setup/admin maintenance, not the login critical path.
  const societyHeaders = cachedAuthHeaders_(societySheet);
  const societyCodeCol = societyHeaders.indexOf("Society_Code") + 1;
  if (!societyCodeCol) throw new Error("Missing required column: Society_Code");
  const societyLast = societySheet.getLastRow();
  if (societyLast < 2) throw new Error("Society not found, duplicated or inactive.");
  // Cache only row indexes (never credentials or database values). Each cached
  // row is reread and validated on every login; stale/invalid cache falls back
  // to a fresh TextFinder lookup. This reduces repeated scans without delaying
  // Society deactivation or Database_ID changes beyond the current request.
  const indexCache = CacheService.getScriptCache();
  const societyIndexKey = "AUTH_SOCIETY_ROW_" + sha256_(String(code));
  let societyRow = Number(indexCache.get(societyIndexKey) || 0);
  let society = null;
  if (societyRow >= 2 && societyRow <= societyLast) {
    const cachedSociety = objectFromRow_(societyHeaders, societySheet.getRange(societyRow, 1, 1, societyHeaders.length).getValues()[0]);
    if (String(cachedSociety.Society_Code || "").trim().toUpperCase() === code) society = cachedSociety;
    else societyRow = 0;
  } else societyRow = 0;
  if (!societyRow) {
    const societyMatches = societySheet.getRange(2, societyCodeCol, societyLast - 1, 1)
      .createTextFinder(String(code)).matchCase(false).matchEntireCell(true).findAll();
    if (societyMatches.length !== 1) throw new Error("Society not found, duplicated or inactive.");
    societyRow = societyMatches[0].getRow();
    society = objectFromRow_(societyHeaders, societySheet.getRange(societyRow, 1, 1, societyHeaders.length).getValues()[0]);
    indexCache.put(societyIndexKey, String(societyRow), 300);
  }
  if (String(society.Society_Status || "").trim().toLowerCase() !== "active") throw new Error("Society not found, duplicated or inactive.");
  society.Database_ID = society.Database_ID || society.Database_Spreadsheet_ID || society["Database Spreadsheet ID"];
  if (!society.Database_ID) throw new Error("Society database is not configured.");

  const userHeaders = cachedAuthHeaders_(usersSheet);
  const loginCol = userHeaders.indexOf("Login_ID") + 1;
  const societyCol = userHeaders.indexOf("Society_Code") + 1;
  if (!loginCol || !societyCol) throw new Error("Society User Access is missing Login_ID or Society_Code.");
  const userLast = usersSheet.getLastRow();
  if (userLast < 2) return { society, usersSheet, user: null };
  const userIndexKey = "AUTH_USER_ROW_" + sha256_(String(code) + "|" + String(loginId));
  let cachedUserRow = Number(indexCache.get(userIndexKey) || 0);
  let user = null;
  if (cachedUserRow >= 2 && cachedUserRow <= userLast) {
    const cachedUser = objectFromRow_(userHeaders, usersSheet.getRange(cachedUserRow, 1, 1, userHeaders.length).getValues()[0]);
    if (normalizeSociety_(cachedUser.Society_Code) === code && normalizeLogin_(cachedUser.Login_ID) === loginId) {
      cachedUser.__row = cachedUserRow;
      user = cachedUser;
    } else cachedUserRow = 0;
  } else cachedUserRow = 0;
  const candidates = user ? [] : usersSheet.getRange(2, loginCol, userLast - 1, 1)
    .createTextFinder(String(loginId)).matchCase(false).matchEntireCell(true).findAll();
  // TextFinder narrows Login_ID candidates. For a small row span, read the
  // candidates together in one service call and validate Society_Code in code.
  const candidateRows = candidates.map(r => r.getRow()).sort((a,b)=>a-b);
  if (candidateRows.length) {
    const first = candidateRows[0], last = candidateRows[candidateRows.length-1];
    const span = last-first+1;
    if (span <= 200) {
      const batch = usersSheet.getRange(first,1,span,userHeaders.length).getValues();
      for (let i=0;i<candidateRows.length;i++) {
        const row=candidateRows[i], candidate=objectFromRow_(userHeaders,batch[row-first]);
        if (String(candidate.Society_Code||"").trim().toUpperCase()!==code) continue;
        if (user) throw new Error("Duplicate Login_ID found for this society.");
        candidate.__row=row; user=candidate;
        indexCache.put(userIndexKey, String(row), 300);
      }
    } else {
      // Avoid broad reads where duplicate IDs span an unusually large row range.
      for (let i=0;i<candidateRows.length;i++) {
        const row=candidateRows[i], values=usersSheet.getRange(row,1,1,userHeaders.length).getValues()[0];
        const candidate=objectFromRow_(userHeaders,values);
        if (String(candidate.Society_Code||"").trim().toUpperCase()!==code) continue;
        if (user) throw new Error("Duplicate Login_ID found for this society.");
        candidate.__row=row; user=candidate;
        indexCache.put(userIndexKey, String(row), 300);
      }
    }
  }
  return { society, usersSheet, user };
}

function sessionUserCacheKey_(societyCode,userId) {
  return "AUTH_USER_" + sha256_(String(societyCode) + "|" + String(userId));
}
function invalidateSessionUserCache_(societyCode,userId) {
  CacheService.getScriptCache().remove(sessionUserCacheKey_(societyCode,userId));
}
function getCachedSessionUser_(societyCode,userId) {
  const cache=CacheService.getScriptCache(),key=sessionUserCacheKey_(societyCode,userId);
  const cached=cache.get(key);
  if(cached){try{return JSON.parse(cached);}catch(e){cache.remove(key);}}
  const rows=societyAndUsers_(societyCode).rows;
  const user=rows.find(r=>String(r.UserID || r.Access_ID)===String(userId));
  if(!user)return null;
  const safe=Object.assign(publicUser_(user),{Ownership_ID:String(user.Ownership_ID||""),OwnerID:String(user.OwnerID||"")});
  // Short cache reduces a full Central Master read on every API request.
  // Account/role changes explicitly invalidate this entry; manual Sheet edits
  // take effect within at most 30 seconds.
  cache.put(key,JSON.stringify(safe),30);
  return safe;
}
function getUserRow_(session) {
  const user=getCachedSessionUser_(session.societyCode,session.userId);
  if(!user) throw new Error("User not found.");
  return user;
}
function publicUser_(u) {
  if(!u) return {};
  return {UserID:String(u.UserID||u.Access_ID||""),Login_ID:String(u.Login_ID||""),Full_Name:String(u.Full_Name||""),Email_ID:String(u.Email_ID||""),Mobile_No:String(u.Mobile_No||""),Role:String(u.Role||""),PropertyID:String(u.PropertyID||""),Ownership_ID:String(u.Ownership_ID||""),Account_Status:String(u.Account_Status||""),Profile_Address:String(u.Profile_Address||""),Emergency_Contact:String(u.Emergency_Contact||""),KYC_Status:String(u.KYC_Status||"Not Submitted"),KYC_Documents:parseJsonArray_(u.KYC_Documents).map(d=>({fileId:d.fileId,fileName:d.fileName,uploadedAt:d.uploadedAt,status:d.status})) ,Created_At:String(u.Created_At||"")};
}
function requireSession_(token) {
  if(!token) throw new Error("Authentication required. Sign in again.");
  const raw=CacheService.getScriptCache().get("SESSION_"+token);
  if(!raw) throw new Error("Session expired. Sign in again.");
  const session=JSON.parse(raw);
  // Re-check account status and current role on every protected request so Admin
  // approval/rejection or role changes take effect without waiting for token expiry.
  const user=getCachedSessionUser_(session.societyCode,session.userId);
  if(!user || String(user.Account_Status || "").trim().toLowerCase()!=="active") {
    CacheService.getScriptCache().remove("SESSION_"+token);
    throw new Error("Your account is inactive. Contact your society Admin.");
  }
  const currentRole=String(user.Role||"");
  if(!["Admin","Committee","Accountant","Resident"].includes(currentRole)) {
    CacheService.getScriptCache().remove("SESSION_"+token);
    throw new Error("Your account role is not authorized. Contact your society Admin.");
  }
  session.role=currentRole;
  session.propertyId=String(user.PropertyID||"");
  session.ownershipId=String(user.Ownership_ID||"");session.ownerId=String(user.OwnerID||"");
  session.fullName=String(user.Full_Name||session.fullName);
  session.email=String(user.Email_ID||session.email);
  session.mobile=String(user.Mobile_No||session.mobile);
  // Sliding expiry: an active user remains signed in while using the app,
  // but an idle session still expires after the configured TTL.
  CacheService.getScriptCache().put("SESSION_"+token,JSON.stringify(session),CONFIG.SESSION_TTL_SECONDS);
  return session;
}
function requireRole_(session,roles) {if(!roles.includes(session.role)) throw new Error("Permission denied.");}
const SHA256_K_ = new Int32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
const SHA256_H0_ = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const B64_CHARS_ = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function utf8Bytes_(str) {
  const s = unescape(encodeURIComponent(String(str)));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function sha256Compress_(state, block, w) {
  for (let i = 0; i < 16; i++) {
    const j = i * 4;
    w[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
  }
  for (let i = 16; i < 64; i++) {
    const x = w[i - 15], y = w[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let a = state[0], b = state[1], c = state[2], d = state[3];
  let e = state[4], f = state[5], g = state[6], h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ ((~e) & g);
    const temp1 = (h + S1 + ch + SHA256_K_[i] + w[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) | 0;
    h = g; g = f; f = e; e = (d + temp1) | 0;
    d = c; c = b; b = a; a = (temp1 + temp2) | 0;
  }
  state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0; state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0; state[7] = (state[7] + h) | 0;
}
function sha256Raw_(bytes) {
  const len = bytes.length;
  const totalLen = ((len + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[len] = 0x80;
  const bitLenHi = Math.floor((len * 8) / 0x100000000);
  const bitLenLo = (len * 8) >>> 0;
  padded[totalLen - 8] = (bitLenHi >>> 24) & 0xff;
  padded[totalLen - 7] = (bitLenHi >>> 16) & 0xff;
  padded[totalLen - 6] = (bitLenHi >>> 8) & 0xff;
  padded[totalLen - 5] = bitLenHi & 0xff;
  padded[totalLen - 4] = (bitLenLo >>> 24) & 0xff;
  padded[totalLen - 3] = (bitLenLo >>> 16) & 0xff;
  padded[totalLen - 2] = (bitLenLo >>> 8) & 0xff;
  padded[totalLen - 1] = bitLenLo & 0xff;
  const state = new Int32Array(SHA256_H0_);
  const w = new Int32Array(64);
  for (let off = 0; off < totalLen; off += 64) {
    sha256Compress_(state, padded.subarray(off, off + 64), w);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const v = state[i];
    out[i * 4] = (v >>> 24) & 0xff;
    out[i * 4 + 1] = (v >>> 16) & 0xff;
    out[i * 4 + 2] = (v >>> 8) & 0xff;
    out[i * 4 + 3] = v & 0xff;
  }
  return out;
}
function hashPassword_(salt,password) {
  // Pure-JS V8 iterated HMAC-SHA256 KDF (bit-identical to Utilities.computeHmacSha256Signature + base64Encode, ~300x faster).
  let key = utf8Bytes_(salt);
  if (key.length > 64) key = sha256Raw_(key);
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const b = i < key.length ? key[i] : 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  const w = new Int32Array(64);
  const ipadInit = new Int32Array(SHA256_H0_);
  sha256Compress_(ipadInit, ipad, w);
  const opadInit = new Int32Array(SHA256_H0_);
  sha256Compress_(opadInit, opad, w);

  const msg0 = utf8Bytes_(password);
  const inner0Len = 64 + msg0.length;
  const inner0Total = ((inner0Len + 9 + 63) >> 6) << 6;
  const inner0Pad = new Uint8Array(inner0Total - 64);
  inner0Pad.set(msg0);
  inner0Pad[msg0.length] = 0x80;
  const bitLen0Lo = (inner0Len * 8) >>> 0;
  const bitLen0Hi = Math.floor((inner0Len * 8) / 0x100000000);
  inner0Pad[inner0Pad.length - 8] = (bitLen0Hi >>> 24) & 0xff;
  inner0Pad[inner0Pad.length - 7] = (bitLen0Hi >>> 16) & 0xff;
  inner0Pad[inner0Pad.length - 6] = (bitLen0Hi >>> 8) & 0xff;
  inner0Pad[inner0Pad.length - 5] = bitLen0Hi & 0xff;
  inner0Pad[inner0Pad.length - 4] = (bitLen0Lo >>> 24) & 0xff;
  inner0Pad[inner0Pad.length - 3] = (bitLen0Lo >>> 16) & 0xff;
  inner0Pad[inner0Pad.length - 2] = (bitLen0Lo >>> 8) & 0xff;
  inner0Pad[inner0Pad.length - 1] = bitLen0Lo & 0xff;

  const innerState = new Int32Array(8);
  const outerState = new Int32Array(8);
  innerState.set(ipadInit);
  for (let off = 0; off < inner0Pad.length; off += 64) {
    sha256Compress_(innerState, inner0Pad.subarray(off, off + 64), w);
  }

  const outerBlock = new Uint8Array(64);
  outerBlock[32] = 0x80;
  outerBlock[62] = 0x03;
  const innerBlock = new Uint8Array(64);
  innerBlock[44] = 0x80;
  innerBlock[62] = 0x03;
  innerBlock[63] = 0x60;
  const digestBytes = new Uint8Array(32);

  function finishOuter() {
    for (let i = 0; i < 8; i++) {
      const v = innerState[i];
      outerBlock[i * 4] = (v >>> 24) & 0xff;
      outerBlock[i * 4 + 1] = (v >>> 16) & 0xff;
      outerBlock[i * 4 + 2] = (v >>> 8) & 0xff;
      outerBlock[i * 4 + 3] = v & 0xff;
    }
    outerState.set(opadInit);
    sha256Compress_(outerState, outerBlock, w);
    for (let i = 0; i < 8; i++) {
      const v = outerState[i];
      digestBytes[i * 4] = (v >>> 24) & 0xff;
      digestBytes[i * 4 + 1] = (v >>> 16) & 0xff;
      digestBytes[i * 4 + 2] = (v >>> 8) & 0xff;
      digestBytes[i * 4 + 3] = v & 0xff;
    }
  }

  finishOuter();
  for (let round = 1; round < CONFIG.PASSWORD_ITERATIONS; round++) {
    let p = 0;
    for (let i = 0; i < 30; i += 3) {
      const n = (digestBytes[i] << 16) | (digestBytes[i + 1] << 8) | digestBytes[i + 2];
      innerBlock[p++] = B64_CHARS_.charCodeAt((n >>> 18) & 63);
      innerBlock[p++] = B64_CHARS_.charCodeAt((n >>> 12) & 63);
      innerBlock[p++] = B64_CHARS_.charCodeAt((n >>> 6) & 63);
      innerBlock[p++] = B64_CHARS_.charCodeAt(n & 63);
    }
    const nLast = (digestBytes[30] << 16) | (digestBytes[31] << 8);
    innerBlock[p++] = B64_CHARS_.charCodeAt((nLast >>> 18) & 63);
    innerBlock[p++] = B64_CHARS_.charCodeAt((nLast >>> 12) & 63);
    innerBlock[p++] = B64_CHARS_.charCodeAt((nLast >>> 6) & 63);
    innerBlock[p++] = 61;
    innerState.set(ipadInit);
    sha256Compress_(innerState, innerBlock, w);
    finishOuter();
  }

  let hex = "";
  for (let i = 0; i < 32; i++) {
    hex += (digestBytes[i] < 16 ? "0" : "") + digestBytes[i].toString(16);
  }
  return hex;
}
function verifyPassword_(salt,password) {
  const old=sha256_(salt+password);
  // Support the previous 64-char legacy hash for one successful-login upgrade.
  return hashPassword_(salt,password); // new KDF; legacy comparison handled below by caller extension
}
function recordLoginFailure_(key,cache) {
  // Cache entries expire automatically after 15 minutes; there is no permanent account lock.
  const lock = LockService.getScriptLock();
  if (lock.tryLock(1500)) {
    try {
      const n = Number(cache.get(key) || 0) + 1;
      cache.put(key, String(n), 900);
    } finally {
      lock.releaseLock();
    }
  } else {
    const n = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(n), 900);
  }
}
function constantTimeEqual_(a,b) {
  a=String(a);b=String(b);let diff=a.length^b.length;
  const n=Math.max(a.length,b.length);for(let i=0;i<n;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}
function randomHex_(n) {return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,Utilities.getUuid()+Utilities.getUuid()).slice(0,n));}
function bytesToHex_(bytes){return bytes.map(b=>("0"+((b+256)%256).toString(16)).slice(-2)).join("");}
function sha256_(v){return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v),Utilities.Charset.UTF_8));}
function validatePassword_(p){if(p.length<12||p.length>128||!/[a-z]/.test(p)||!/[A-Z]/.test(p)||!/[0-9]/.test(p)||!/[^A-Za-z0-9]/.test(p))throw new Error("Password must be 12–128 characters and include upper/lowercase letters, a number and a symbol.");}
function cleanText_(v,max){return String(v||"").trim().replace(/[<>]/g,"").slice(0,max);}
function cleanEmail_(v){const s=normalizeEmail_(v);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new Error("Enter a valid email address.");return s;}
function normalizeEmail_(v){return String(v||"").trim().toLowerCase();}
function normalizeLogin_(v){return String(v||"").trim().toLowerCase();}
function normalizeSociety_(v){return String(v||"").trim().toUpperCase();}
function ensureHeaders_(sh,headers){
  const last=sh.getLastColumn(), existing=last?sh.getRange(1,1,1,last).getValues()[0].map(String):[];
  if(!last){sh.getRange(1,1,1,headers.length).setValues([headers]);return;}
  let changed=false;
  headers.forEach(h=>{if(existing.indexOf(h)<0){existing.push(h);changed=true;}});
  if(changed)sh.getRange(1,1,1,existing.length).setValues([existing]);
}
function setCell_(sh,row,header,value){
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const col=headers.indexOf(header);if(col<0)throw new Error("Missing user column: "+header);
  sh.getRange(row,col+1).setValue(value);
}
function appendObject_(sh,obj){
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(h=>Object.prototype.hasOwnProperty.call(obj,h)?obj[h]:""));
}
function sheetObjects_(sh){
  if(!sh)return[];const vals=sh.getDataRange().getValues();if(vals.length<2)return[];
  const heads=vals[0].map(h=>String(h).trim()), out=[];
  for(let i=1;i<vals.length;i++){const r=vals[i];if(!r.some(v=>v!==""&&v!==null))continue;const o={__row:i+1};heads.forEach((h,j)=>{if(h)o[h]=r[j] instanceof Date?r[j].toISOString():r[j];});out.push(o);}
  return out;
}
function sheetObjectsRange_(sh,startRow,numRows){if(!numRows)return[];const n=sh.getLastColumn(),vals=sh.getRange(startRow,1,numRows,n).getValues(),heads=sh.getRange(1,1,1,n).getValues()[0].map(h=>String(h).trim()),out=[];for(let i=0;i<vals.length;i++){const r=vals[i];if(!r.some(v=>v!==""&&v!==null))continue;const o={__row:startRow+i};heads.forEach((h,j)=>{if(h)o[h]=r[j] instanceof Date?r[j].toISOString():r[j];});out.push(o);}return out;}
function parseJsonArray_(v){try{const a=JSON.parse(String(v||"[]"));return Array.isArray(a)?a:[];}catch(e){return[];}}
function audit_(s,action,id,remarks){
  try{const ss=SpreadsheetApp.openById(s.databaseId),sh=ss.getSheetByName("Audit Log");if(sh)sh.appendRow([Utilities.getUuid(),s.userId,action,"User Management",id,"", "",new Date(),remarks]);}catch(e){}
}
function nextReceipt_(sh){return "RCT-"+String(Math.max(sh.getLastRow(),1)).padStart(6,"0");}
function errorCode_(e){const m=String(e&&e.message||e).toLowerCase();if(m.includes("too many sign-in attempts"))return "RATE_LIMITED";if(m.includes("permission denied")||m.includes("access denied"))return "PERMISSION_DENIED";if(m.includes("session")||m.includes("authentication")||m.includes("inactive")||m.includes("invalid credentials")||m.includes("unable to sign in"))return "AUTH_ERROR";if(m.includes("missing")||m.includes("invalid")||m.includes("required")||m.includes("not found")||m.includes("already exists")||m.includes("not effective"))return "VALIDATION_ERROR";return "SERVER_ERROR";}
function safeError_(e){const m=String(e&&e.message||e);return m.length>250?m.slice(0,250):m;}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}

/** One-time helper for first Admin bootstrap only. Set temporary values, run, then remove them. */
function authorizeRequiredServices() {
  SpreadsheetApp.openById(getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID")).getName();
  DriveApp.getFolderById(getConfigValue_("DEFAULT_DRIVE_FOLDER_ID")).getName();
  MailApp.getRemainingDailyQuota();
  Logger.log("Spreadsheet, Drive and Mail permissions authorized.");
}

/**
 * Bootstrap is intentionally disabled because SO001 already has an Active Admin.
 * Do not run this to reset an existing account.
 */
function bootstrapFirstAdmin() {
  throw new Error("An Active Admin already exists. Use resetExistingAdminPasswordOnce() to reset its password.");
}

/**
 * ONE-TIME ADMIN PASSWORD RESET for the existing SO001 Admin.
 *
 * Before running:
 * 1) Replace the placeholder below with a new unique password.
 * 2) Save the project.
 * 3) Select resetExistingAdminPasswordOnce in the function dropdown and Run.
 * 4) After SUCCESS, remove this helper and deploy a new version.
 *
 * Never share the password, Password_Salt or Password_Hash.
 */
function resetExistingAdminPasswordOnce() {
  const societyCode = "SO001";
  const loginId = "admin";
  const newPassword = "REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD";

  if (newPassword === "REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD") {
    throw new Error("First set your own new password inside resetExistingAdminPasswordOnce().");
  }

  validatePassword_(newPassword);

  const result = societyAndUsers_(societyCode);
  const matches = result.rows.filter(r =>
    normalizeLogin_(r.Login_ID) === normalizeLogin_(loginId) &&
    String(r.Role || "").trim().toLowerCase() === "admin" &&
    String(r.Account_Status || "").trim().toLowerCase() === "active"
  );

  if (matches.length !== 1) {
    throw new Error("Expected exactly one Active Admin for SO001/admin; found " + matches.length + ".");
  }

  const user = matches[0];
  const newSalt = randomHex_(24);
  const newHash = hashPassword_(newSalt, newPassword);

  setCell_(result.usersSheet, user.__row, "Password_Salt", newSalt);
  setCell_(result.usersSheet, user.__row, "Password_Hash", newHash);
  setCell_(result.usersSheet, user.__row, "Password_Changed_At", new Date());

  Logger.log("SUCCESS: Existing Admin password reset.");
  Logger.log("Society Code: " + societyCode);
  Logger.log("Login ID: " + loginId);
}

/**
 * Safe diagnostic: logs account metadata only, never password or hash values.
 * Run this if the reset helper reports that it cannot find exactly one Admin.
 */
function diagnoseExistingAdminRecord() {
  const societyCode = "SO001";
  const loginId = "admin";
  const result = societyAndUsers_(societyCode);

  const matches = result.rows.filter(r =>
    normalizeLogin_(r.Login_ID) === normalizeLogin_(loginId)
  );

  Logger.log("Society Code: " + societyCode);
  Logger.log("Matching Login ID rows: " + matches.length);

  matches.forEach((r, i) => {
    Logger.log("Record " + (i + 1) +
      " | Role=" + String(r.Role || "").trim() +
      " | Account_Status=" + String(r.Account_Status || "").trim() +
      " | Password_Salt present=" + Boolean(r.Password_Salt) +
      " | Password_Hash present=" + Boolean(r.Password_Hash) +
      " | Sheet row=" + r.__row);
  });
}


/**
 * Owner-run Central Master backup. Run manually from Apps Script, not from the
 * society web app. Requires CENTRAL_MASTER_SPREADSHEET_ID and
 * DEFAULT_DRIVE_FOLDER_ID Script Properties. Restore is a manual owner action.
 */
function backupCentralMasterManual() {
  const centralId=getConfigValue_("CENTRAL_MASTER_SPREADSHEET_ID");
  const root=DriveApp.getFolderById(getConfigValue_("DEFAULT_DRIVE_FOLDER_ID"));
  if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Backup root folder must be private.");
  const source=DriveApp.getFileById(centralId);
  const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyyMMdd_HHmmss");
  const copy=source.makeCopy("ABAS_CENTRAL_MASTER_BACKUP_"+stamp,root);
  copy.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  Logger.log("Central Master backup created: "+copy.getName()+" | File ID: "+copy.getId());
}
