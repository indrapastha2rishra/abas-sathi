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
    "Gallery Master", "Preventive Maintenance Master", "Rate Property Mapping",
    "Property Utility Details", "Audit Log", "Financial Year Master", "Account Head Master"
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
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    requestId = cleanText_(body.requestId || Utilities.getUuid(),100);
    switch (body.action) {
      case "login": return login_(body);
      case "forgotPasswordRequest": return forgotPasswordRequest_(body);
      case "forgotPasswordVerify": return forgotPasswordVerify_(body);
    }
    if (body.action === "logout") {
      if (body.token) CacheService.getScriptCache().remove("SESSION_" + body.token);
      return json_({status:"success",message:"Signed out"});
    }
    const session = requireSession_(body.token);
    switch (body.action) {
      case "getSocietyData": return json_({status:"error",code:"SELECTIVE_READ_REQUIRED",message:"Use getModuleData to load one module at a time."});
      case "getModuleData": return getModuleData_(session, body);
      case "getModuleSchema": return getModuleSchema_(session, body);
      case "getDashboardSummary": return getDashboardSummary_(session);
      case "getReports": return getReports_(session, body);
      case "createReportSnapshot": return createReportSnapshot_(session, body);
      case "approveReportSnapshot": return approveReportSnapshot_(session, body);
      case "listReportSnapshots": return listReportSnapshots_(session, body);
      case "postOpeningBalances": return postOpeningBalances_(session, body);
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
}


// -----------------------------------------------------------------------------
// Version 5.3 read API: selective, paginated and server-authorized.
// Financial writes are intentionally NOT routed through generic CRUD.
// They require dedicated locked/idempotent transaction handlers.
// -----------------------------------------------------------------------------
const MODULE_SHEETS = {
  properties: "Property Master", owners: "Owner Master", ownershipHistory: "Ownership History",
  tenants: "Tenant Master", rates: "Rate Master", invoices: "Invoice_Register",
  receipts: "Fund Inflow Register", billWiseDetails: "Bill Wise Details",
  expenses: "Expense Register", expenseCategories: "Expense Category Master",
  bankAccounts: "Bank Account Master", activityRequests: "Activity Request Register",
  notices: "Notice Master", gallery: "Gallery Master",
  preventiveMaintenance: "Preventive Maintenance Master",
  propertyUtilityDetails: "Property Utility Details", financialYears: "Financial Year Master",
  ratePropertyMapping: "Rate Property Mapping", accountHeads: "Account Head Master", auditLogs: "Audit Log"
};

function getModuleData_(session, body) {
  const key = String(body.module || "");
  const sheetName = MODULE_SHEETS[key];
  if (!sheetName) throw new Error("Unknown or unsupported module.");
  authorizeModuleRead_(session, key);
  const page = Math.max(1, Math.floor(Number(body.page) || 1));
  const limit = Math.min(200, Math.max(1, Math.floor(Number(body.limit) || 50)));
  const ss = SpreadsheetApp.openById(session.databaseId);
  const sheet = ss.getSheetByName(sheetName) || (key==="invoices"?ss.getSheetByName("Invoice Register"):null);
  if(!sheet)throw new Error("Required sheet is missing: "+sheetName);
  const hasFilters=Boolean(body.search||body.status||body.propertyId||body.ownerId||body.fromDate||body.toDate);
  if(session.role!=="Resident"&&!hasFilters){
    const last=sheet.getLastRow(),total=Math.max(0,last-1),start=(page-1)*limit+2;
    const data=(total&&start<=last)?sheetObjectsRange_(sheet,start,Math.min(limit,last-start+1)):[];
    return json_({status:"success",module:key,data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
  }
  let records = session.role==="Resident" ? residentModuleRecords_(session,key,ss,sheet) : sheetObjects_(sheet);
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
  const sh=societySheet_(session,cfg.sheet).sh;
  if(key==="owners")ensureHeaders_(sh,["Owner_Status"]);
  const headers=headerMap_(sh);
  const hidden=["Created_By","Created_At","Updated_At","Approved_By","Approved_At","Cancelled_By","Cancelled_At","Password_Salt","Password_Hash","Society_Code","Owner_Status","Ownership_Status","Ownership_End_Date"];
  return json_({status:"success",module:key,idField:cfg.id,fields:headers.filter(h=>h&&!hidden.includes(h)&&h.indexOf("__")!==0),readOnlyFields:[cfg.id,"Created_By","Created_At","Updated_By","Updated_At"]});
}


function journalSheet_(ss){
  return ensureInternalSheet_(ss,"_Journal Ledger",["Journal_ID","Journal_Date","Source_Type","Source_ID","Account_Code","Account_Name","Account_Type","Debit","Credit","PropertyID","Ownership_ID","Narration","Posted_By","Posted_At","Status"]);
}
function postJournalEntry_(ss, sourceType, sourceId, journalDate, entries, session){
  const sh=journalSheet_(ss),existing=sheetObjects_(sh).filter(x=>String(x.Source_Type)===String(sourceType)&&String(x.Source_ID)===String(sourceId)&&String(x.Status)==="Posted");
  if(existing.length)return existing;
  const totalDebit=entries.reduce((a,x)=>a+Number(x.debit||0),0),totalCredit=entries.reduce((a,x)=>a+Number(x.credit||0),0);
  if(Math.abs(totalDebit-totalCredit)>0.009)throw new Error("Journal entry is not balanced.");
  const rows=entries.filter(x=>Number(x.debit||0)>0||Number(x.credit||0)>0).map(x=>({Journal_ID:"JRN-"+randomHex_(8),Journal_Date:journalDate||new Date(),Source_Type:sourceType,Source_ID:sourceId,Account_Code:x.accountCode||"",Account_Name:x.accountName,Account_Type:x.accountType,Debit:Number(x.debit||0),Credit:Number(x.credit||0),PropertyID:x.propertyId||"",Ownership_ID:x.ownershipId||"",Narration:x.narration||"",Posted_By:session.userId,Posted_At:new Date(),Status:"Posted"}));
  rows.forEach(r=>appendByHeaders_(sh,r));
  return rows;
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
    auditEvent_(session,"CREATE","Opening Balance",batch,"Opening balances posted as a balanced journal batch","",result);
    return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}

/**
 * Pure report builder: one row per Ownership_ID, not one row per OwnerID.
 * This preserves historical liability when a flat changes ownership.
 */
function buildOwnershipOutstandingRows_(invoiceRows, ownershipRows, propertyRows, ownerRows) {
  const ownershipById = {};
  (ownershipRows || []).forEach(x => { if (x.Ownership_ID) ownershipById[String(x.Ownership_ID)] = x; });
  const propertyById = {};
  (propertyRows || []).forEach(x => { if (x.PropertyID) propertyById[String(x.PropertyID)] = x; });
  const ownerById = {};
  (ownerRows || []).forEach(x => { if (x.OwnerID) ownerById[String(x.OwnerID)] = x; });
  const grouped = {};
  let unlinkedInvoiceCount = 0;
  (invoiceRows || []).forEach(inv => {
    if (String(inv.Invoice_Status || "") === "Cancelled") return;
    const net = Number(inv.Net_Charge_Amount || 0);
    const paid = Number(inv.Paid_Amount || 0);
    const rawDue = inv.Outstanding_Amount;
    const dueValue = rawDue === "" || rawDue === null || rawDue === undefined
      ? Math.max(0, net - paid)
      : Math.max(0, Number(rawDue || 0));
    if (!(dueValue > 0)) return;
    const ownershipId = String(inv.Ownership_ID || "");
    const propertyId = String(inv.PropertyID || "");
    const ownerId = String(inv.OwnerID || "");
    const key = ownershipId || ("UNLINKED:" + propertyId + ":" + ownerId);
    if (!ownershipId) unlinkedInvoiceCount++;
    const history = ownershipById[ownershipId] || {};
    const property = propertyById[propertyId] || {};
    const owner = ownerById[ownerId] || {};
    if (!grouped[key]) {
      grouped[key] = {
        Ownership_ID: ownershipId || "Not linked",
        PropertyID: propertyId,
        Flat_No: String(inv.Flat_Number || inv.Flat_No || property.Flat_No || property["Flat No."] || ""),
        OwnerID: ownerId,
        Owner_Name: String(inv.Owner_Name || owner.Owner_Name || ""),
        Ownership_Start_Date: history.Ownership_Start_Date || "",
        Ownership_End_Date: history.Ownership_End_Date || "",
        Ownership_Status: history.Ownership_Status || "Historical record not found",
        Invoice_Count: 0,
        Total_Billed: 0,
        Total_Paid: 0,
        Outstanding: 0,
        Data_Link_Status: ownershipId && history.Ownership_ID ? "Linked" : "Needs review"
      };
    }
    grouped[key].Invoice_Count++;
    grouped[key].Total_Billed += net;
    grouped[key].Total_Paid += paid;
    grouped[key].Outstanding += dueValue;
  });
  const data = Object.values(grouped).sort((a,b) => b.Outstanding - a.Outstanding);
  const totalOutstanding = data.reduce((sum,x) => sum + x.Outstanding, 0);
  return {
    data,
    summary: {
      ownershipCount: data.length,
      totalOutstanding,
      unlinkedInvoiceCount
    }
  };
}

function getReports_(session, body) {
  const type=String(body.reportType||"");
  if(["Admin","Accountant","Committee"].indexOf(session.role)<0) throw new Error("Permission denied.");
  if(type==="outstanding") {
    const invoiceRows=sheetObjects_(societySheet_(session,"Invoice_Register").sh);
    const grouped={};
    invoiceRows.forEach(x=>{
      if(String(x.Invoice_Status||"")==="Cancelled")return;
      const net=Number(x.Net_Charge_Amount||0),paid=Number(x.Paid_Amount||0);
      const rawDue=x.Outstanding_Amount;
      const due=rawDue===""||rawDue===null||rawDue===undefined?Math.max(0,net-paid):Math.max(0,Number(rawDue||0));
      if(!(due>0))return;
      const k=String(x.PropertyID||"");
      if(!grouped[k])grouped[k]={PropertyID:k,Flat_No:x.Flat_Number||x.Flat_No||"",Owner_Name:x.Owner_Name||"",Invoice_Count:0,Total_Billed:0,Total_Paid:0,Outstanding:0};
      grouped[k].Invoice_Count++;
      grouped[k].Total_Billed+=net;
      grouped[k].Total_Paid+=paid;
      grouped[k].Outstanding+=due;
    });
    const data=Object.values(grouped).sort((a,b)=>b.Outstanding-a.Outstanding);
    return json_({status:"success",reportType:type,data,summary:{propertyCount:data.length,totalOutstanding:data.reduce((a,x)=>a+x.Outstanding,0)},generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="receiptPayment") {
    const from=String(body.fromDate||"0000-01-01"),to=String(body.toDate||"9999-12-31");
    const receipts=sheetObjects_(societySheet_(session,"Fund Inflow Register").sh).filter(x=>x.Receipt_Status==="Confirmed"&&String(x.Date_Of_Received||"").slice(0,10)>=from&&String(x.Date_Of_Received||"").slice(0,10)<=to);
    const expenses=sheetObjects_(societySheet_(session,"Expense Register").sh).filter(x=>x.Expense_Status==="Paid"&&String(x.Payment_Date||"").slice(0,10)>=from&&String(x.Payment_Date||"").slice(0,10)<=to);
    const totalIn=receipts.reduce((a,x)=>a+Number(x.Received_Amount||0),0),totalOut=expenses.reduce((a,x)=>a+Number(x.Payment_Amount||0),0);
    const reportData=session.role==="Committee"?{receiptCount:receipts.length,expenseCount:expenses.length,totalReceipts:totalIn,totalPayments:totalOut,netCashMovement:totalIn-totalOut}:{receipts,expenses,totalReceipts:totalIn,totalPayments:totalOut,netCashMovement:totalIn-totalOut};
    return json_({status:"success",reportType:type,period:{from,to},data:reportData,generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="ownerOutstanding") {
    const rows=sheetObjects_(societySheet_(session,"Invoice_Register").sh).filter(x=>!["Cancelled","Paid"].includes(String(x.Invoice_Status))&&Number(x.Outstanding_Amount||0)>0);
    const grouped={};rows.forEach(x=>{const k=String(x.OwnerID||"");if(!grouped[k])grouped[k]={OwnerID:k,Owner_Name:x.Owner_Name||"",Property_Count:0,Outstanding:0,Invoice_Count:0};grouped[k].Outstanding+=Number(x.Outstanding_Amount||0);grouped[k].Invoice_Count++;});
    return json_({status:"success",reportType:type,data:Object.values(grouped),generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="ownershipOutstanding") {
    const invoiceRows = sheetObjects_(societySheet_(session,"Invoice_Register").sh);
    const ownershipRows = sheetObjects_(societySheet_(session,"Ownership History").sh);
    const propertyRows = sheetObjects_(societySheet_(session,"Property Master").sh);
    const ownerRows = sheetObjects_(societySheet_(session,"Owner Master").sh);
    const result = buildOwnershipOutstandingRows_(invoiceRows, ownershipRows, propertyRows, ownerRows);
    return json_({
      status:"success",
      reportType:type,
      data:result.data,
      summary:result.summary,
      generatedAt:new Date().toISOString(),
      auditStatus:"system-generated",
      note:"Outstanding is grouped by the Ownership_ID stored on each invoice. Unlinked legacy invoices are shown separately and require manual ownership verification."
    });
  }
  if(type==="expenseSummary") {
    const from=String(body.fromDate||"0000-01-01"),to=String(body.toDate||"9999-12-31");
    const rows=sheetObjects_(societySheet_(session,"Expense Register").sh).filter(x=>x.Expense_Status==="Paid"&&String(x.Payment_Date||"").slice(0,10)>=from&&String(x.Payment_Date||"").slice(0,10)<=to);
    const grouped={};rows.forEach(x=>{const k=String(x.Expense_Category||"Uncategorized");if(!grouped[k])grouped[k]={Category:k,Count:0,Total:0};grouped[k].Count++;grouped[k].Total+=Number(x.Payment_Amount||0);});
    return json_({status:"success",reportType:type,period:{from,to},data:Object.values(grouped),generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="financialYear") {
    const from=String(body.fromDate||"0000-01-01"),to=String(body.toDate||"9999-12-31");
    const invoices=sheetObjects_(societySheet_(session,"Invoice_Register").sh).filter(x=>String(x.Billing_Date||"").slice(0,10)>=from&&String(x.Billing_Date||"").slice(0,10)<=to&&x.Invoice_Status!=="Cancelled");
    const receipts=sheetObjects_(societySheet_(session,"Fund Inflow Register").sh).filter(x=>x.Receipt_Status==="Confirmed"&&String(x.Date_Of_Received||"").slice(0,10)>=from&&String(x.Date_Of_Received||"").slice(0,10)<=to);
    const expenses=sheetObjects_(societySheet_(session,"Expense Register").sh).filter(x=>x.Expense_Status==="Paid"&&String(x.Payment_Date||"").slice(0,10)>=from&&String(x.Payment_Date||"").slice(0,10)<=to);
    return json_({status:"success",reportType:type,period:{from,to},data:{invoiceCount:invoices.length,billed:invoices.reduce((a,x)=>a+Number(x.Net_Charge_Amount||0),0),receipts:receipts.reduce((a,x)=>a+Number(x.Received_Amount||0),0),paidExpenses:expenses.reduce((a,x)=>a+Number(x.Payment_Amount||0),0),outstanding:invoices.reduce((a,x)=>a+Number(x.Outstanding_Amount||0),0)},generatedAt:new Date().toISOString(),auditStatus:"system-generated"});
  }
  if(type==="balanceSheet") {
    const ss=SpreadsheetApp.openById(session.databaseId);
    const journal=ss.getSheetByName("_Journal Ledger");
    const snapshots=ss.getSheetByName("Report Snapshot Register");
    const asOfDate=String(body.asOfDate||"9999-12-31").slice(0,10);
    const posted=journal?sheetObjects_(journal).filter(x=>String(x.Status)==="Posted"&&String(x.Journal_Date||"").slice(0,10)<=asOfDate):[];
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
    return json_({status:"success",reportType:type,data:{accounts:rows,totalDebit,totalCredit,assetTotal,liabilityTotal,equityBase,income,expenses,equityTotal,difference,balanced:Math.abs(totalDebit-totalCredit)<0.01&&Math.abs(difference)<0.01,hasOpeningBalances,postedJournalCount:posted.length},generatedAt:new Date().toISOString(),auditStatus:latest?"latest-approved-snapshot-exists":"draft-unapproved",latestApprovedSnapshot:latest||null,warning:"Internal system-generated statement. It is not an independent statutory audit; confirm account mapping and opening balances with your auditor."});
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
    return current.some(x=>String(x.OwnerID)===String(registered.OwnerID)&&(!session.ownerId||String(session.ownerId)===String(x.OwnerID))&&(!session.ownershipId||String(session.ownershipId)===String(x.Ownership_ID)));
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
    if(module!=="gallery"||!recordId)return false;
    const sh=societySheet_(session,"Gallery Master").sh,found=rowById_(sh,"Gallery_ID",recordId);if(!found)return false;
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

function getDashboardSummary_(session) {
  const ss = SpreadsheetApp.openById(session.databaseId);
  const read = name => {const aliases={"Invoice_Register":["Invoice_Register","Invoice Register"]};const list=aliases[name]||[name];for(let i=0;i<list.length;i++){const sh=ss.getSheetByName(list[i]);if(sh)return sheetObjects_(sh);}return [];};
  const properties = session.role==="Resident"?residentModuleRecords_(session,"properties",ss,ss.getSheetByName("Property Master")):read("Property Master");
  const invoiceSheet=ss.getSheetByName("Invoice_Register")||ss.getSheetByName("Invoice Register");
  const invoices = session.role==="Resident"?residentModuleRecords_(session,"invoices",ss,invoiceSheet):read("Invoice_Register");
  const receiptSheet=ss.getSheetByName("Fund Inflow Register"),requestSheet=ss.getSheetByName("Activity Request Register");
  const receipts = session.role==="Resident"?residentModuleRecords_(session,"receipts",ss,receiptSheet):read("Fund Inflow Register");
  const requests = session.role==="Resident"?residentModuleRecords_(session,"activityRequests",ss,requestSheet):read("Activity Request Register");
  const paid = receipts.filter(r => String(r.Receipt_Status || r.Status || "").toLowerCase() === "confirmed");
  const outstanding = invoices.reduce((sum,r) => sum + Math.max(0,Number(r.Outstanding_Amount || 0)),0);
  return json_({status:"success",society:societyPublic_(session),summary:{totalProperties:properties.length,occupiedProperties:properties.filter(r=>String(r.Occupancy_Status||"").toLowerCase()==="occupied").length,totalInvoices:invoices.length,confirmedReceipts:paid.length,confirmedCollection:paid.reduce((s,r)=>s+Number(r.Received_Amount||0),0),outstandingMaintenance:outstanding,pendingRequests:requests.filter(r=>String(r.Request_Status||"").toLowerCase()==="pending").length,recentActivity:requests.slice(-5).reverse()}});
}

function authorizeModuleRead_(session,key) {
  const roleMap={
    properties:["Admin","Committee","Accountant","Resident"],
    owners:["Admin","Committee","Accountant","Resident"],
    ownershipHistory:["Admin","Committee","Accountant","Resident"],
    tenants:["Admin","Committee","Accountant","Resident"],
    rates:["Admin","Committee","Accountant"],
    invoices:["Admin","Committee","Accountant","Resident"],
    receipts:["Admin","Committee","Accountant","Resident"],
    billWiseDetails:["Admin","Committee","Accountant","Resident"],
    expenses:["Admin","Accountant"],
    expenseCategories:["Admin","Accountant"],
    bankAccounts:["Admin","Accountant"],
    activityRequests:["Admin","Committee","Resident"],
    notices:["Admin","Committee","Accountant","Resident"],
    gallery:["Admin","Committee","Accountant","Resident"],
    preventiveMaintenance:["Admin","Committee","Accountant"],
    ratePropertyMapping:["Admin","Accountant"],
    propertyUtilityDetails:["Admin","Committee","Accountant","Resident"],
    financialYears:["Admin","Accountant"],
    accountHeads:["Admin","Accountant"],
    auditLogs:["Admin","Accountant"]
  };
  if(!roleMap[key]||roleMap[key].indexOf(session.role)<0)throw new Error("Permission denied.");
}
function residentModuleRecords_(session,key,ss,sheet){
  const propertyId=String(session.propertyId||"");
  if(["properties","propertyUtilityDetails","invoices","receipts","billWiseDetails","ownershipHistory","tenants","activityRequests"].includes(key)){
    let rows=findRowsByHeaderValue_(sheet,"PropertyID",propertyId);
    if(key==="ownershipHistory")return rows.filter(r=>String(r.Ownership_Status||"")==="Current");
    if(key==="tenants")return rows.filter(r=>String(r.Status||"").toLowerCase()==="active");
    if(key==="activityRequests")return rows.filter(r=>String(r.Requested_By||"")===session.userId);
    if(["invoices","receipts","billWiseDetails"].includes(key)){
      const ownerships=findRowsByHeaderValue_(ss.getSheetByName("Ownership History"),"PropertyID",propertyId).filter(r=>String(r.Ownership_Status||"")==="Current").map(r=>String(r.Ownership_ID||""));
      return rows.filter(r=>ownerships.includes(String(r.Ownership_ID||"")));
    }
    return rows;
  }
  if(key==="owners"){
    const current=findRowsByHeaderValue_(ss.getSheetByName("Ownership History"),"PropertyID",propertyId).filter(r=>String(r.Ownership_Status||"")==="Current");
    const ids=current.map(r=>String(r.OwnerID||""));return ids.flatMap(id=>findRowsByHeaderValue_(sheet,"OwnerID",id));
  }
  if(key==="notices")return scopeRecords_(session,key,sheetObjects_(sheet),ss);
  if(key==="gallery")return scopeRecords_(session,key,sheetObjects_(sheet),ss);
  return [];
}
function scopeRecords_(session,key,records,ss) {
  if (session.role !== "Resident") return records;
  const propertyId = String(session.propertyId || "");
  const ownershipRows = sheetObjects_(ss.getSheetByName("Ownership History"));
  const currentOwnerships = ownershipRows.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Ownership_Status||"")==="Current");
  const currentOwnershipIds = currentOwnerships.map(r=>String(r.Ownership_ID||""));
  if (["properties","propertyUtilityDetails"].includes(key)) return records.filter(r=>String(r.PropertyID||"")===propertyId);
  if (["invoices","receipts","billWiseDetails"].includes(key)) return records.filter(r=>String(r.PropertyID||"")===propertyId&&currentOwnershipIds.includes(String(r.Ownership_ID||"")));
  if (key === "ownershipHistory") return records.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Ownership_Status||"")==="Current");
  if (key === "owners") {
    const ids = currentOwnerships.map(r=>String(r.OwnerID||""));
    return records.filter(r=>ids.includes(String(r.OwnerID||"")));
  }
  if (key === "tenants") return records.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Status||"").toLowerCase()==="active");
  if (key === "activityRequests") return records.filter(r=>String(r.PropertyID||"")===propertyId&&String(r.Requested_By||"")===session.userId);
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
  const code = normalizeSociety_(body.societyCode);
  const loginId = normalizeLogin_(body.loginId);
  const password = String(body.password || "");
  if (!code || !loginId || !password) throw new Error("Society Code, Login ID and Password are required.");
  const {society, usersSheet, rows} = societyAndUsers_(code);
  const failKey = "LOGIN_FAIL_" + sha256_(code + "|" + loginId);
  const cache = CacheService.getScriptCache();
  if (Number(cache.get(failKey) || 0) >= 10) throw new Error("Too many sign-in attempts. Please wait 15 minutes.");
  const user = rows.find(r => normalizeLogin_(r.Login_ID) === loginId);
  if (!user || String(user.Account_Status || "").trim().toLowerCase() !== "active") { recordLoginFailure_(failKey,cache); throw new Error("Invalid credentials or account is not active. Contact your society Admin."); }
  if (!user.Password_Salt || !user.Password_Hash) throw new Error("Password is not configured. Contact your society Admin.");
  const expected = String(user.Password_Hash);
  const currentSalt = String(user.Password_Salt);
  // Check the existing v5.1 SHA-256 format first. This avoids running the
  // newer KDF unnecessarily and allows existing users to sign in and upgrade.
  const legacyMatch = expected.length === 64 &&
    constantTimeEqual_(sha256_(currentSalt + password), expected);
  const currentMatch = !legacyMatch &&
    constantTimeEqual_(hashPassword_(currentSalt, password), expected);
  if (!legacyMatch && !currentMatch) {
    recordLoginFailure_(failKey,cache);
    throw new Error("Invalid credentials or account is not active. Contact your society Admin.");
  }
  cache.remove(failKey);
  // Upgrade legacy SHA-256 hashes after successful authentication.
  if (legacyMatch) {
    const salt = randomHex_(24);
    setCell_(usersSheet,user.__row,"Password_Salt",salt);
    setCell_(usersSheet,user.__row,"Password_Hash",hashPassword_(salt,password));
  }
  setCell_(usersSheet,user.__row,"Last_Login",new Date());
  const token = randomHex_(32);
  const session = {
    societyCode:code, societyName:String(society.Society_Name || ""),
     societyAddress:String(society.Society_Address || society.Registered_Address || society.Address || ""),
    databaseId:String(society.Database_ID), fullName:String(user.Full_Name || ""),
    userId:String(user.UserID || ""), loginId:String(user.Login_ID || ""),
    role:String(user.Role || "Resident"), propertyId:String(user.PropertyID || ""), ownershipId:String(user.Ownership_ID||""), ownerId:String(user.OwnerID||""),
    email:String(user.Email_ID || ""), mobile:String(user.Mobile_No || "")
  };
  CacheService.getScriptCache().put("SESSION_"+token,JSON.stringify(session),CONFIG.SESSION_TTL_SECONDS);
  const clientUser=Object.assign({},session);delete clientUser.databaseId;delete clientUser.ownershipId;delete clientUser.ownerId;
  return json_({status:"success",token,expiresIn:CONFIG.SESSION_TTL_SECONDS,user:clientUser});
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
  audit_(session,"USER_APPROVED",body.userId,"User account activated");
  return json_({status:"success",message:"User approved and activated."});
}
function adminRejectUser_(session,body) {
  requireRole_(session,["Admin"]);
  const {usersSheet,rows} = societyAndUsers_(session.societyCode);
  const user = rows.find(r => String(r.UserID) === String(body.userId));
  if (!user || user.Role === "Admin") throw new Error("User not found or cannot be rejected.");
  setCell_(usersSheet,user.__row,"Account_Status","Rejected");
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
  activityRequests:{sheet:"Activity Request Register",id:"Request_ID",roles:["Admin","Committee","Resident"],resident:true},
  notices:{sheet:"Notice Master",id:"Notice_ID",roles:["Admin","Committee"],resident:false},
  gallery:{sheet:"Gallery Master",id:"Gallery_ID",roles:["Admin","Committee"],resident:false},
  preventiveMaintenance:{sheet:"Preventive Maintenance Master",id:"Maintenance_ID",roles:["Admin","Committee"],resident:false},
  ratePropertyMapping:{sheet:"Rate Property Mapping",id:"Rate_Mapping_ID",roles:["Admin"],resident:false},
  propertyUtilityDetails:{sheet:"Property Utility Details",id:"Utility_ID",roles:["Admin","Accountant"],resident:false},
  financialYears:{sheet:"Financial Year Master",id:"FY_ID",roles:["Admin","Accountant"],resident:false},
  tenants:{sheet:"Tenant Master",id:"Tenant_ID",roles:["Admin","Committee"],resident:false},
  accountHeads:{sheet:"Account Head Master",id:"Account_ID",roles:["Admin","Accountant"],resident:false}
};
const FINANCE_ROLES={invoice:["Admin"],paymentSubmit:["Admin","Accountant","Resident"],paymentVerify:["Admin","Accountant"],expenseCreate:["Admin","Accountant"],expenseApprove:["Admin"],expensePay:["Admin","Accountant"]};

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
function findOperation_(sh,key){const rows=sh.getLastRow();if(rows<2)return null;const vals=sh.getRange(2,1,rows-1,5).getValues();for(let i=0;i<vals.length;i++)if(String(vals[i][0])===key)return {row:i+2,status:String(vals[i][3]),result:String(vals[i][4]||"")};return null;}
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
function requireModuleWrite_(session,mod,action){const cfg=CRUD_MODULES[mod];if(!cfg)throw new Error("Unsupported module.");if(cfg.roles.indexOf(session.role)<0)throw new Error("Permission denied.");if(mod==="bankAccounts"&&session.role==="Committee")throw new Error("Bank account details are restricted.");return cfg;}
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

function createRecord_(session,body){
  const cfg=requireModuleWrite_(session,String(body.module||""),"create");const id=requireOperationId_(body);const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const {ss,sh}=societySheet_(session,cfg.sheet);const ledger=operationLedger_(ss);const prior=findOperation_(ledger,id);if(prior){if(prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});throw new Error("A previous operation with this requestId is incomplete; contact Admin.");}
    if(String(body.module||"")==="owners")ensureHeaders_(sh,["Owner_Status"]);const headers=headerMap_(sh),data=safeRecord_(body.record,headers);if(body.module==="ownershipHistory"){data.Ownership_Status="Current";delete data.Ownership_End_Date;}validateMasterRecord_(session,String(body.module||""),data,"");const recordId=cleanText_(body.record&&body.record[cfg.id]||((cfg.id||"REC").replace(/ID$/i,"")+"-"+randomHex_(8)),100);if(!data[cfg.id])data[cfg.id]=recordId;
    if(body.module==="activityRequests"){data.Request_Number=data.Request_Number||("REQ-"+new Date().getFullYear()+"-"+String(sh.getLastRow()).padStart(5,"0"));data.Request_Date=data.Request_Date||new Date();data.Request_Status=data.Request_Status||"Pending";data.Assigned_To=data.Assigned_To||"Pending Assignment";data.Updated_At=new Date();}
    if(body.module==="notices"){data.Notice_Number=data.Notice_Number||("NOT-"+new Date().getFullYear()+"-"+String(sh.getLastRow()).padStart(4,"0"));data.Notice_Status=data.Notice_Status||"Draft";}
    if(body.module==="gallery"){data.Uploaded_By=session.userId;data.Uploaded_At=new Date();data.Status=data.Status||"Active";}
    if(body.module==="owners")data.Owner_Status=data.Owner_Status||"Active";
    if(body.module==="bankAccounts"){data.Current_Balance=Number(data.Opening_Balance||0);}
    if(cfg.resident){assertPropertyAccess_(session,data.PropertyID);if(session.role==="Resident"){const ownRows=sheetObjects_(societySheet_(session,"Ownership History").sh);const own=ownRows.find(x=>String(x.PropertyID)===String(data.PropertyID)&&String(x.Ownership_Status)==="Current");if(!own)throw new Error("No current ownership is linked to this property.");data.Ownership_ID=own.Ownership_ID;data.OwnerID=own.OwnerID;data.Requested_By=session.userId;data.Request_Status="Pending";}}
    if(cfg.id&&rowById_(sh,cfg.id,data[cfg.id]))throw new Error("Record already exists.");
    data.Created_By=session.userId;data.Created_At=new Date();writeOperation_(ledger,id,"createRecord",recordId,"STARTED",{});appendByHeaders_(sh,data);auditEvent_(session,"CREATE",cfg.sheet,recordId,"Created through server API","",data);
    const result={recordId,data};writeOperation_(ledger,id,"createRecord",recordId,"DONE",result);return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}
function updateRecord_(session,body){
  const cfg=requireModuleWrite_(session,String(body.module||""),"update");const id=requireOperationId_(body);const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const {ss,sh}=societySheet_(session,cfg.sheet);const ledger=operationLedger_(ss);const prior=findOperation_(ledger,id);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("A previous update is incomplete; reconcile it before retrying.");
    const recordId=cleanText_(body.recordId,100),found=rowById_(sh,cfg.id,recordId);if(!found)throw new Error("Record not found.");const current=objectFromRow_(found.headers,found.values);if(cfg.resident){assertPropertyAccess_(session,current.PropertyID);if(session.role==="Resident"&&String(current.Requested_By)!==String(session.userId))throw new Error("You may update only your own activity request.");}
    const changes=safeRecord_(body.record,found.headers);if(mod==="bankAccounts")delete changes.Opening_Balance;if(mod==="ownershipHistory"&&(Object.prototype.hasOwnProperty.call(body.record||{},"Ownership_Status")||Object.prototype.hasOwnProperty.call(body.record||{},"Ownership_End_Date")))throw new Error("Use End Ownership to close an ownership period; ownership history status/date cannot be edited directly.");validateMasterRecord_(session,mod,Object.assign({},current,changes),recordId);if(cfg.resident&&session.role==="Resident"){const allowed=["Subject","Description","Priority","Attachment"];Object.keys(changes).forEach(k=>{if(allowed.indexOf(k)<0)delete changes[k];});}
    changes.Updated_At=new Date();writeOperation_(ledger,id,"updateRecord",recordId,"STARTED",{});updateByHeaders_(sh,found.row,changes,[cfg.id,"Created_By","Created_At"]);auditEvent_(session,"UPDATE",cfg.sheet,recordId,"Record updated through server API",current,changes);
    const result={recordId};writeOperation_(ledger,id,"updateRecord",recordId,"DONE",result);return json_({status:"success",data:result});
  }finally{lock.releaseLock();}
}
function cancelRecord_(session,body){
  const mod=String(body.module||""),cfg=requireModuleWrite_(session,mod,"cancel");if(session.role==="Resident")throw new Error("Permission denied.");const id=requireOperationId_(body),recordId=cleanText_(body.recordId,100),reason=cleanText_(body.reason,300);if(!reason)throw new Error("Cancellation reason is required.");
  const lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,cfg.sheet),ledger=operationLedger_(ss),prior=findOperation_(ledger,id);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous cancellation is incomplete; reconcile it before retrying.");const found=rowById_(sh,cfg.id,recordId);if(!found)throw new Error("Record not found.");if(mod==="owners"){ensureHeaders_(sh,["Owner_Status"]);found.headers=headerMap_(sh);}const h=found.headers;
    const cancelMap={properties:["Property_Status","Inactive"],owners:["Owner_Status","Inactive"],ownershipHistory:["Ownership_Status","Previous"],rates:["Status","Inactive"],bankAccounts:["Status","Inactive"],expenseCategories:["Status","Inactive"],notices:["Notice_Status","Archived"],gallery:["Status","Archived"],tenants:["Status","Vacated"],activityRequests:["Request_Status","Cancelled"]};const target=cancelMap[mod];const statusKey=target&&h.indexOf(target[0])>=0?target[0]:["Invoice_Status","Expense_Status","Request_Status","Notice_Status","Status"].find(k=>h.indexOf(k)>=0);if(!statusKey)throw new Error("This record type does not support soft cancellation.");
    const current=objectFromRow_(found.headers,found.values);
    if(mod==="owners"&&sheetObjects_(societySheet_(session,"Ownership History").sh).some(x=>String(x.OwnerID)===recordId&&String(x.Ownership_Status)==="Current"))throw new Error("An owner with current ownership cannot be archived. End the ownership period first.");
    if(mod==="ownershipHistory"&&String(current.Ownership_Status)!=="Current")throw new Error("Only a current ownership record can be ended.");
    writeOperation_(ledger,id,"cancelRecord",recordId,"STARTED",{});const patch={};patch[statusKey]=target?target[1]:"Cancelled";
    if(mod==="ownershipHistory")patch.Ownership_End_Date=new Date();if(h.includes("Cancellation_Reason"))patch.Cancellation_Reason=reason;if(h.includes("Cancelled_By"))patch.Cancelled_By=session.userId;if(h.includes("Cancelled_At"))patch.Cancelled_At=new Date();updateByHeaders_(sh,found.row,patch,[cfg.id,"Created_By","Created_At"]);auditEvent_(session,"CANCEL",cfg.sheet,recordId,reason,objectFromRow_(found.headers,found.values),patch);writeOperation_(ledger,id,"cancelRecord",recordId,"DONE",{recordId});return json_({status:"success",data:{recordId}});}finally{lock.releaseLock();}
}
function generateInvoice_(session,body){
  requireRole_(session,FINANCE_ROLES.invoice);const opId=requireOperationId_(body),propertyId=cleanText_(body.propertyId,80),rateId=cleanText_(body.rateId,80);if(!propertyId||!rateId)throw new Error("Property and Rate are required.");
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
  requireRole_(session,FINANCE_ROLES.paymentSubmit);
  const opId=requireOperationId_(body),amount=Number(body.amount);if(!isFinite(amount)||amount<=0||amount>100000000)throw new Error("Payment amount must be greater than zero and within the permitted limit.");if(["UPI","NEFT","IMPS","Cheque","Cash","Card"].indexOf(String(body.mode))<0)throw new Error("Invalid payment mode.");const propertyId=cleanText_(body.propertyId,80);assertPropertyAccess_(session,propertyId);const own=assertOwnership_(session,propertyId,body.ownershipId,body.ownerId);
  const lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Fund Inflow Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,opId);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("A previous payment submission is incomplete; reconcile it before retrying.");
    const ref=cleanText_(body.reference,120);if(String(body.mode||"")!=="Cash"&&!ref)throw new Error("Payment transaction reference is required for non-cash payments.");if(ref){const existing=sheetObjects_(sh).find(r=>String(r.Received_Reference||"")===ref&&String(r.PropertyID)===propertyId&&String(r.Receipt_Status||"")!=="Cancelled");if(existing)throw new Error("This payment reference has already been submitted.");}
    const requestedInvoices=Array.isArray(body.invoiceIds)?body.invoiceIds:[];if(requestedInvoices.length){const invoiceRows=sheetObjects_(societySheet_(session,"Invoice_Register").sh);requestedInvoices.forEach(iid=>{const inv=invoiceRows.find(x=>String(x.InvoiceID)===String(iid));if(!inv||String(inv.PropertyID)!==propertyId||String(inv.Ownership_ID)!==String(own.Ownership_ID)||String(inv.Invoice_Status)==="Cancelled")throw new Error("One or more selected invoices are invalid for this ownership period.");});}
    const bankId=cleanText_(body.bankAccount,80);if(bankId){const bankRows=sheetObjects_(societySheet_(session,"Bank Account Master").sh);if(!bankRows.some(b=>String(b.BankAccount_ID)===bankId&&String(b.Status||"Active")==="Active"))throw new Error("Selected bank account is not active.");}
    const prop=sheetObjects_(societySheet_(session,"Property Master").sh).find(x=>String(x.PropertyID)===propertyId);const owner=sheetObjects_(societySheet_(session,"Owner Master").sh).find(x=>String(x.OwnerID)===String(own.OwnerID));const receiptNo="";const transactionId="TXN-"+randomHex_(8).toUpperCase();
    const record={Transaction_ID:transactionId,Receipt_Number:receiptNo,Date_Of_Received:new Date(),PropertyID:propertyId,Ownership_ID:own.Ownership_ID,OwnerID:own.OwnerID,Flat_No:prop?prop.Flat_No:"",Owner_Name:owner?owner.Owner_Name:"",Received_Amount:amount,Received_Mode:cleanText_(body.mode,30),Received_Reference:ref,Bank_Account:session.role==="Resident"?"":cleanText_(body.bankAccount,80),Unallocated_Amount:amount,Remarks:cleanText_(body.remarks,300),File_Reference:cleanText_(body.fileReference,300),Created_By:session.userId,Created_At:new Date(),Receipt_Status:"Pending Verification"};writeOperation_(ledger,opId,"submitPayment",transactionId,"STARTED",{});appendByHeaders_(sh,record);writeOperation_(ledger,opId,"submitPayment",transactionId,"DONE",{transactionId,receiptNo,amount});auditEvent_(session,"CREATE","Fund Inflow Register",transactionId,"Payment submitted; Amount="+amount,"",record);return json_({status:"success",data:{transactionId,receiptNo,amount,status:"Pending Verification",receipt:record}});
  }finally{lock.releaseLock();}
}
function confirmPayment_(session,body){return settlePayment_(session,body,false);}
function rejectPayment_(session,body){requireRole_(session,FINANCE_ROLES.paymentVerify);const reason=cleanText_(body.reason,300);if(!reason)throw new Error("Rejection reason is required.");const lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Fund Inflow Register"),ledger=operationLedger_(ss),op=requireOperationId_(body),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous payment rejection is incomplete; reconcile it before retrying.");const priorTxn=findOperationByActionRecord_(ledger,"rejectPayment",body.transactionId);if(priorTxn){if(priorTxn.status==="DONE")return json_({status:"success",duplicate:true});throw new Error("A previous rejection for this payment is incomplete; reconcile it before retrying.");}const f=rowById_(sh,"Transaction_ID",body.transactionId);if(!f)throw new Error("Payment not found.");const rec=objectFromRow_(f.headers,f.values);if(rec.Receipt_Status!=="Pending Verification")throw new Error("Only pending payments can be rejected.");writeOperation_(ledger,op,"rejectPayment",body.transactionId,"STARTED",{});updateByHeaders_(sh,f.row,{Receipt_Status:"Rejected",Remarks:String(rec.Remarks||"")+" | Rejected: "+reason},["Transaction_ID","Receipt_Number"]);writeOperation_(ledger,op,"rejectPayment",body.transactionId,"DONE",{transactionId:body.transactionId});auditEvent_(session,"CANCEL","Fund Inflow Register",body.transactionId,reason,rec,{Receipt_Status:"Rejected"});return json_({status:"success"});}finally{lock.releaseLock();}}
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
    const result={transactionId:receipt.Transaction_ID,receiptNo,bankAccount:bankId,allocated:totalAllocated,unallocated:remaining,allocationRows:writtenAllocations};writeOperation_(ledger,op,"confirmPayment",receipt.Transaction_ID,"DONE",result);auditEvent_(session,"ALLOCATE","Fund Inflow Register",receipt.Transaction_ID,"Allocated="+totalAllocated+", advance="+remaining,receipt,{Receipt_Status:"Confirmed",Receipt_Number:receiptNo,Unallocated_Amount:remaining,Bank_Account:bankId});return json_({status:"success",data:result});
  }finally{lock.releaseLock();}}
function allocatePayment_(session,body){return settlePayment_(session,body,false);}
function createExpense_(session,body){requireRole_(session,FINANCE_ROLES.expenseCreate);const op=requireOperationId_(body),r=body.record||{},amount=Number(r.Payment_Amount);if(!isFinite(amount)||amount<=0)throw new Error("Expense amount must be greater than zero.");if(!cleanText_(r.Expense_Category,100)||!cleanText_(r.Payee_Name,120)||!cleanText_(r.Particulars,300))throw new Error("Expense category, payee and particulars are required.");if(["UPI","NEFT","IMPS","Cheque","Cash","Card"].indexOf(String(r.Payment_Mode))<0)throw new Error("Invalid expense payment mode.");const lock=LockService.getScriptLock();lock.waitLock(15000);try{const bankSh=societySheet_(session,"Bank Account Master").sh;if(!sheetObjects_(bankSh).some(b=>String(b.BankAccount_ID)===String(r.Bank_Account)&&String(b.Status||"Active")==="Active"))throw new Error("Select an active society bank account.");const {ss,sh}=societySheet_(session,"Expense Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});if(prior)throw new Error("A previous expense creation is incomplete; reconcile it before retrying.");const existingExpense=sheetObjects_(sh).find(x=>String(x.Payment_Reference||"")===String(r.Payment_Reference||"")&&String(x.Payee_Name||"").toLowerCase()===String(r.Payee_Name||"").toLowerCase()&&Number(x.Payment_Amount||0)===amount&&String(x.Expense_Status||"")!=="Cancelled"&&String(r.Payment_Reference||"")!=="N/A");if(existingExpense)throw new Error("An expense with the same payee, payment reference and amount already exists.");writeOperation_(ledger,op,"createExpense","","STARTED",{});const id="EXP-"+randomHex_(8).toUpperCase(),voucher="VOU-"+new Date().getFullYear()+"-"+String(Math.max(1,sh.getLastRow())).padStart(6,"0");const rec=Object.assign({},r,{Expense_ID:id,Voucher_No:voucher,Expense_Status:"Pending Approval",Created_By:session.userId,Created_At:new Date(),Approved_By:"",Approved_At:"",Cancelled_By:"",Cancelled_At:"",Cancellation_Reason:""});appendByHeaders_(sh,rec);writeOperation_(ledger,op,"createExpense",id,"DONE",{expenseId:id,voucherNo:voucher});auditEvent_(session,"CREATE","Expense Register",id,"Voucher="+voucher,"",rec);return json_({status:"success",data:{expenseId:id,voucherNo:voucher,expense:rec}});}finally{lock.releaseLock();}}
function approveExpense_(session,body){requireRole_(session,FINANCE_ROLES.expenseApprove);return updateExpenseStatus_(session,body,"Approved");}
function markExpensePaid_(session,body){requireRole_(session,FINANCE_ROLES.expensePay);return updateExpenseStatus_(session,body,"Paid");}
function cancelExpense_(session,body){requireRole_(session,FINANCE_ROLES.expenseApprove);const reason=cleanText_(body.reason,300);if(!reason)throw new Error("Cancellation reason is required.");const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Expense Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous expense operation is incomplete; reconcile it before retrying.");const priorCancel=findOperationByActionRecord_(ledger,"cancelExpense",body.expenseId);if(priorCancel){if(priorCancel.status==="DONE")return json_({status:"success",duplicate:true});throw new Error("A previous cancellation for this expense is incomplete; reconcile it before retrying.");}const f=rowById_(sh,"Expense_ID",body.expenseId);if(!f)throw new Error("Expense not found.");const r=objectFromRow_(f.headers,f.values);if(r.Expense_Status==="Paid")throw new Error("Paid expenses cannot be cancelled. Use a reversal entry.");writeOperation_(ledger,op,"cancelExpense",body.expenseId,"STARTED",{});updateByHeaders_(sh,f.row,{Expense_Status:"Cancelled",Cancelled_By:session.userId,Cancelled_At:new Date(),Cancellation_Reason:reason},["Expense_ID","Voucher_No"]);writeOperation_(ledger,op,"cancelExpense",body.expenseId,"DONE",{expenseId:body.expenseId});auditEvent_(session,"CANCEL","Expense Register",body.expenseId,reason,r,{Expense_Status:"Cancelled"});return json_({status:"success"});}finally{lock.releaseLock();}}
function updateExpenseStatus_(session,body,status){const op=requireOperationId_(body),lock=LockService.getScriptLock();lock.waitLock(15000);try{const {ss,sh}=societySheet_(session,"Expense Register"),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true});if(prior)throw new Error("A previous expense operation is incomplete; reconcile it before retrying.");const priorExpense=findOperationByActionRecord_(ledger,"expensePaid",body.expenseId);if(status==="Paid"&&priorExpense){if(priorExpense.status==="DONE")return json_({status:"success",duplicate:true});throw new Error("A previous payment for this expense is incomplete; reconcile it before retrying.");}const f=rowById_(sh,"Expense_ID",body.expenseId);if(!f)throw new Error("Expense not found.");const r=objectFromRow_(f.headers,f.values);if(status==="Approved"&&r.Expense_Status!=="Pending Approval")throw new Error("Only pending expenses can be approved.");if(status==="Paid"&&String(r.Expense_Status)!=="Approved")throw new Error("Expense must be approved before it can be marked Paid.");if(status==="Paid"){const bankSh=societySheet_(session,"Bank Account Master").sh,bf=rowById_(bankSh,"BankAccount_ID",r.Bank_Account);if(!bf)throw new Error("Bank account not found.");const bank=objectFromRow_(bf.headers,bf.values),amount=Number(r.Payment_Amount||0),balance=Number(bank.Current_Balance||0);if(amount<=0||balance<amount)throw new Error("Insufficient bank balance or invalid expense amount.");writeOperation_(ledger,op,"expensePaid",body.expenseId,"STARTED",{});updateByHeaders_(bankSh,bf.row,{Current_Balance:balance-amount},["BankAccount_ID","Account_Number"]);const bankName=String(bank.Bank_Name||bank.Account_Name||r.Bank_Account);postJournalEntry_(ss,"Expense",body.expenseId,new Date(),[{accountName:"Expense: "+String(r.Expense_Category),accountType:"Expense",debit:amount,credit:0,narration:"Voucher "+String(r.Voucher_No||body.expenseId)},{accountName:"Bank: "+bankName,accountType:"Asset",debit:0,credit:amount,narration:"Voucher "+String(r.Voucher_No||body.expenseId)}],session);}
    if(status!=="Paid")writeOperation_(ledger,op,"expense"+status,body.expenseId,"STARTED",{});
    updateByHeaders_(sh,f.row,status==="Approved"?{Expense_Status:status,Approved_By:session.userId,Approved_At:new Date()}:{Expense_Status:"Paid",Approved_By:session.userId,Approved_At:r.Approved_At||new Date(),Payment_Date:r.Payment_Date||new Date()},["Expense_ID","Voucher_No"]);writeOperation_(ledger,op,"expense"+status,body.expenseId,"DONE",{expenseId:body.expenseId,status});auditEvent_(session,status==="Paid"?"APPROVE":"UPDATE","Expense Register",body.expenseId,status,r,{Expense_Status:status,Payment_Date:status==="Paid"?(r.Payment_Date||new Date()):r.Payment_Date});return json_({status:"success"});}finally{lock.releaseLock();}}

function createPrivateSocietyFolder_(session){const info=societyAndUsers_(session.societyCode).society;const folderId=String(info.Drive_Folder_ID||info.Drive_FolderID||info["Drive Folder ID"]||"");const folder=folderId?DriveApp.getFolderById(folderId):DriveApp.getFolderById(getConfigValue_("DEFAULT_DRIVE_FOLDER_ID"));if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Society Drive root folder must be private.");const name="Society_"+session.societyCode;const it=folder.getFoldersByName(name);const sub=it.hasNext()?it.next():folder.createFolder(name);if(sub.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Society private document folder must not be shared.");return sub;}
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
  if(categoryRoles[lower].indexOf(session.role)<0)throw new Error("Permission denied for this document category.");
  if(propertyId&&!sheetObjects_(societySheet_(session,"Property Master").sh).some(x=>String(x.PropertyID)===propertyId))throw new Error("Selected property does not exist in this society.");
  if(ownerId&&!sheetObjects_(societySheet_(session,"Owner Master").sh).some(x=>String(x.OwnerID)===ownerId))throw new Error("Selected owner does not exist in this society.");
  if(session.role==="Resident")assertPropertyAccess_(session,propertyId);
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
  let relatedTarget=null,relatedRecord=null,targetField="";
  if(relatedModule||relatedRecordId){
    const cfg=linkMap[lower];
    if(!cfg||cfg.module!==relatedModule||!relatedRecordId)throw new Error("The selected module does not match this document category.");
    const target=societySheet_(session,cfg.sheet);
    relatedTarget={cfg,sh:target.sh};
    const found=rowById_(target.sh,cfg.id,relatedRecordId);
    if(!found)throw new Error("Related record was not found.");
    relatedRecord=objectFromRow_(found.headers,found.values);
    if(relatedRecord.PropertyID)assertPropertyAccess_(session,relatedRecord.PropertyID);
    if(session.role==="Resident"&&lower==="activity request attachment"&&String(relatedRecord.Requested_By)!==String(session.userId))throw new Error("You may attach files only to your own activity requests.");
    if(propertyId&&relatedRecord.PropertyID&&String(propertyId)!==String(relatedRecord.PropertyID))throw new Error("Document property does not match the related record.");
    if(ownerId&&relatedRecord.OwnerID&&String(ownerId)!==String(relatedRecord.OwnerID))throw new Error("Document owner does not match the related ownership record.");
    targetField=cfg.fields.find(f=>found.headers.indexOf(f)>=0);
    if(!targetField)throw new Error("The related sheet has no document reference column. Add one of: "+cfg.fields.join(", "));
  }
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const ss=SpreadsheetApp.openById(session.databaseId),ledger=operationLedger_(ss),prior=findOperation_(ledger,op);
    if(prior&&prior.status==="DONE")return json_({status:"success",duplicate:true,data:JSON.parse(prior.result)});
    if(prior)throw new Error("A previous file upload is incomplete; check Drive and File Registry before retrying.");
    writeOperation_(ledger,op,"uploadPrivateFile","","STARTED",{});
    const folder=createPrivateSocietyFolder_(session),blob=Utilities.newBlob(bytes,mime,session.societyCode+"_"+Date.now()+"_"+name.replace(/[^\w.\-]/g,"_")),file=folder.createFile(blob);
    file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    let reg=ss.getSheetByName("_File Registry");
    if(!reg){reg=ss.insertSheet("_File Registry");reg.getRange(1,1,1,10).setValues([["File_ID","PropertyID","OwnerID","Category","Uploaded_By","Created_At","Related_Module","Related_Record_ID","File_Name","Mime_Type"]]);reg.hideSheet();}
    ensureHeaders_(reg,["File_ID","PropertyID","OwnerID","Category","Uploaded_By","Created_At","Related_Module","Related_Record_ID","File_Name","Mime_Type"]);
    appendByHeaders_(reg,{File_ID:file.getId(),PropertyID:propertyId,OwnerID:ownerId,Category:category,Uploaded_By:session.userId,Created_At:new Date(),Related_Module:relatedModule,Related_Record_ID:relatedRecordId,File_Name:file.getName(),Mime_Type:mime});
    let linked=false;
    if(relatedTarget&&relatedRecord){
      const found=rowById_(relatedTarget.sh,relatedTarget.cfg.id,relatedRecordId);
      if(!found)throw new Error("Related record was removed before the upload completed.");
      const regFile=rowById_(reg,"File_ID",file.getId());
      if(regFile)updateByHeaders_(reg,regFile.row,{PropertyID:propertyId||String(relatedRecord.PropertyID||""),OwnerID:ownerId||String(relatedRecord.OwnerID||"")},["File_ID"]);
      const patch={};patch[targetField]=file.getId();
      updateByHeaders_(relatedTarget.sh,found.row,patch,[relatedTarget.cfg.id,"Created_By","Created_At"]);
      auditEvent_(session,"UPDATE",relatedTarget.cfg.sheet,relatedRecordId,"Private document linked: "+category,relatedRecord,patch);linked=true;
    }
    const data={fileId:file.getId(),fileName:file.getName(),mimeType:mime,linked};
    writeOperation_(ledger,op,"uploadPrivateFile",file.getId(),"DONE",data);
    auditEvent_(session,"CREATE","Drive",file.getId(),"Category="+category,"",{fileId:file.getId(),fileName:file.getName(),propertyId,ownerId,relatedModule,relatedRecordId,linked});
    return json_({status:"success",data});
  }finally{lock.releaseLock();}
}
function getPrivateFile_(session,body){const fileId=cleanText_(body.fileId,200);if(!fileId)throw new Error("File ID is required.");const ss=SpreadsheetApp.openById(session.databaseId),reg=ss.getSheetByName("_File Registry");if(!reg)throw new Error("File registry is not available.");const registered=sheetObjects_(reg).find(r=>String(r.File_ID)===fileId);if(!registered)throw new Error("File is not registered to this society.");const category=String(registered.Category||"").toLowerCase();if(session.role==="Resident"){assertPropertyAccess_(session,registered.PropertyID);if(body.propertyId&&String(body.propertyId)!==String(registered.PropertyID))throw new Error("File property access denied.");if(["bank statement","expense voucher"].includes(category))throw new Error("This document category is not available to Resident accounts.");if(!residentCanAccessLinkedFile_(session,registered))throw new Error("This document is not available to your account or its linked record is not visible.");}else if(session.role==="Committee"&&["kyc","owner document","ownership document","bank statement"].includes(category)){throw new Error("This document category is restricted to Admin.");}else if(session.role==="Accountant"&&["kyc","owner document","ownership document"].includes(category)){throw new Error("This document category is restricted to Admin.");}const file=DriveApp.getFileById(fileId);if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw new Error("Public/shared Drive files are not served by this API.");let allowed=false;let level=[file.getParents()];for(let depth=0;depth<5&&level.length;depth++){const next=[];level.forEach(it=>{while(it.hasNext()){const folder=it.next();if(folder.getName()==="Society_"+session.societyCode)allowed=true;next.push(folder.getParents());}});level=next;}if(!allowed)throw new Error("File does not belong to this society folder.");const blob=file.getBlob();if(blob.getBytes().length>5*1024*1024)throw new Error("File too large for inline preview; use an authorized Drive workflow.");return json_({status:"success",data:{fileName:file.getName(),mimeType:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())}});}
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
function auditEvent_(session,action,module,recordId,remarks,oldValue,newValue){const sh=societySheet_(session,"Audit Log").sh;const stringify=v=>{if(v===undefined||v===null||v==="")return "";try{return JSON.stringify(v).slice(0,4500);}catch(e){return String(v).slice(0,4500);}};const row={Log_ID:"LOG-"+randomHex_(8),UserID:session.userId,User_Name:session.fullName||session.userId,Action_Type:action,Module_Name:module,Record_ID:recordId,Old_Value:stringify(oldValue),New_Value:stringify(newValue),Action_DateTime:new Date(),Remarks:cleanText_(remarks,500)};appendByHeaders_(sh,row);}

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
function getUserRow_(session) {
  const rows=societyAndUsers_(session.societyCode).rows;
  const user=rows.find(r=>String(r.UserID || r.Access_ID)===session.userId);
  if(!user) throw new Error("User not found."); return publicUser_(user);
}
function publicUser_(u) {
  if(!u) return {};
  return {UserID:String(u.UserID||u.Access_ID||""),Login_ID:String(u.Login_ID||""),Full_Name:String(u.Full_Name||""),Email_ID:String(u.Email_ID||""),Mobile_No:String(u.Mobile_No||""),Role:String(u.Role||""),PropertyID:String(u.PropertyID||""),Account_Status:String(u.Account_Status||""),Profile_Address:String(u.Profile_Address||""),Emergency_Contact:String(u.Emergency_Contact||""),KYC_Status:String(u.KYC_Status||"Not Submitted"),KYC_Documents:parseJsonArray_(u.KYC_Documents).map(d=>({fileId:d.fileId,fileName:d.fileName,uploadedAt:d.uploadedAt,status:d.status})) ,Created_At:String(u.Created_At||"")};
}
function requireSession_(token) {
  if(!token) throw new Error("Authentication required. Sign in again.");
  const raw=CacheService.getScriptCache().get("SESSION_"+token);
  if(!raw) throw new Error("Session expired. Sign in again.");
  const session=JSON.parse(raw);
  // Re-check account status and current role on every protected request so Admin
  // approval/rejection or role changes take effect without waiting for token expiry.
  const {rows}=societyAndUsers_(session.societyCode);
  const user=rows.find(r=>String(r.UserID||r.Access_ID)===session.userId);
  if(!user || String(user.Account_Status || "").trim().toLowerCase()!=="active") {
    CacheService.getScriptCache().remove("SESSION_"+token);
    throw new Error("Your account is inactive. Contact your society Admin.");
  }
  session.role=String(user.Role||session.role);
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
function hashPassword_(salt,password) {
  // Iterated HMAC-SHA256 KDF. Apps Script's String overload must be used
  // consistently: the HMAC output is a byte array, so encode it before using
  // it as the next round's String input. Passing the raw array with a String
  // key causes: (number[],String) method-signature mismatch.
  let value = Utilities.computeHmacSha256Signature(String(password), String(salt));
  for (let i = 1; i < CONFIG.PASSWORD_ITERATIONS; i++) {
    value = Utilities.computeHmacSha256Signature(
      Utilities.base64Encode(value), String(salt)
    );
  }
  return bytesToHex_(value);
}
function verifyPassword_(salt,password) {
  const old=sha256_(salt+password);
  // Support the previous 64-char legacy hash for one successful-login upgrade.
  return hashPassword_(salt,password); // new KDF; legacy comparison handled below by caller extension
}
function recordLoginFailure_(key,cache) { const n=Number(cache.get(key)||0)+1; cache.put(key,String(n),900); }
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
function errorCode_(e){const m=String(e&&e.message||e).toLowerCase();if(m.includes("permission denied")||m.includes("access denied"))return "PERMISSION_DENIED";if(m.includes("session")||m.includes("authentication")||m.includes("inactive")||m.includes("invalid credentials"))return "AUTH_ERROR";if(m.includes("missing")||m.includes("invalid")||m.includes("required")||m.includes("not found")||m.includes("already exists")||m.includes("not effective"))return "VALIDATION_ERROR";return "SERVER_ERROR";}
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
