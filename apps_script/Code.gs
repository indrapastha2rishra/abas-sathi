/**
 * ABAS SATHI — Multi-society Google Apps Script backend
 *
 * SETUP REQUIRED:
 * 1) Set CENTRAL_MASTER_SPREADSHEET_ID below to the Google Sheet ID of
 *    ABAS_SATHI_Central_Master_Database (converted to Google Sheets).
 * 2) In "Society User Access", add columns Password_Salt and Password_Hash.
 * 3) Store only SHA-256(salt + password) in Password_Hash. Never store plaintext.
 * 4) Society Master must contain Society_Code, Society_Status, Database_ID.
 * 5) Deploy as Web App. Use the same /exec URL in the frontend.
 *
 * IMPORTANT: Anyone-with-link deployment is still a public endpoint. This code
 * authenticates API requests with short-lived tokens, but Google Drive file
 * upload permissions and production hardening must be reviewed before real use.
 */
const CONFIG = {
  CENTRAL_MASTER_SPREADSHEET_ID: "PASTE_CENTRAL_MASTER_GOOGLE_SHEET_ID_HERE",
  DEFAULT_DRIVE_FOLDER_ID: "1aUS1Dn09JSBP55C_yKmX4nWRirM_p9wB",
  SESSION_TTL_SECONDS: 21600, // 6 hours
  SOCIETY_SHEETS: [
    "Property Master", "Owner Master", "Ownership History", "Tenant Master",
    "Rate Master", "Invoice_Register", "Fund Inflow Register", "Bill Wise Details",
    "Expense Register", "Expense Category Master", "Bank Account Master",
    "User Master & Role Management", "Activity Request Register", "Notice Master",
    "Gallery Master", "Preventive Maintenance Master", "Rate Property Mapping",
    "Property Utility Details", "Audit Log", "Financial Year Master",
    "Account Head Master"
  ]
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || "ping";
    if (action === "ping") {
      return json_({status:"success", message:"ABAS SATHI backend online", timestamp:new Date().toISOString()});
    }
    const session = requireSession_(p.token);
    if (action === "getSocietyData" || action === "getAllData") {
      const ss = SpreadsheetApp.openById(session.databaseId);
      const result = {};
      CONFIG.SOCIETY_SHEETS.forEach(name => {
        const sh = ss.getSheetByName(name);
        result[name] = sheetObjects_(sh);
      });
      return json_({
        status:"success",
        society:{societyCode:session.societyCode, societyName:session.societyName},
        data:result
      });
    }
    if (action === "getProperties") {
      const ss = SpreadsheetApp.openById(session.databaseId);
      return json_({status:"success", data:sheetObjects_(ss.getSheetByName("Property Master"))});
    }
    return json_({status:"error", message:"Unknown action"});
  } catch (err) {
    return json_({status:"error", message:String(err.message || err)});
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action;

    if (action === "login") return login_(body);

    const session = requireSession_(body.token);
    if (action === "logout") {
      CacheService.getScriptCache().remove("SESSION_" + body.token);
      return json_({status:"success", message:"Signed out"});
    }

    // Existing payment workflow kept, now protected by session validation.
    const ss = SpreadsheetApp.openById(session.databaseId);
    if (action === "submitPayment") {
      const sh = ss.getSheetByName("Fund Inflow Register");
      if (!sh) throw new Error('Missing sheet: Fund Inflow Register');
      sh.appendRow([
        body.transactionId || Utilities.getUuid(), body.receiptNumber || nextReceipt_(sh),
        new Date(), body.propertyId || "", body.ownershipId || "", body.ownerId || "",
        body.flatNo || "", body.ownerName || "", Number(body.amount || 0),
        body.mode || "", body.reference || "", body.bankAccount || "",
        Number(body.amount || 0), body.remarks || "", body.fileReference || "",
        session.fullName, new Date(), "Pending Verification"
      ]);
      return json_({status:"success", message:"Payment submitted for verification"});
    }
    return json_({status:"error", message:"Unsupported action"});
  } catch (err) {
    return json_({status:"error", message:String(err.message || err)});
  }
}

function login_(body) {
  const societyCode = String(body.societyCode || "").trim().toUpperCase();
  const loginId = String(body.loginId || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!societyCode || !loginId || !password) throw new Error("Society Code, Login ID and Password are required.");
  if (CONFIG.CENTRAL_MASTER_SPREADSHEET_ID.indexOf("PASTE_") === 0) {
    throw new Error("Backend setup incomplete: set CENTRAL_MASTER_SPREADSHEET_ID in Code.gs.");
  }

  const master = SpreadsheetApp.openById(CONFIG.CENTRAL_MASTER_SPREADSHEET_ID);
  const societyRows = sheetObjects_(master.getSheetByName("Society Master"));
  const society = societyRows.find(r => String(r.Society_Code || "").trim().toUpperCase() === societyCode);
  if (!society) throw new Error("Invalid Society Code.");
  if (String(society.Society_Status || "").toLowerCase() !== "active") {
    throw new Error("This society account is not Active. Please contact the administrator.");
  }
  if (!society.Database_ID) throw new Error("Society database is not configured.");

  const accessRows = sheetObjects_(master.getSheetByName("Society User Access"));
  const user = accessRows.find(r =>
    String(r.Society_Code || "").trim().toUpperCase() === societyCode &&
    String(r.Login_ID || "").trim().toLowerCase() === loginId
  );
  if (!user) throw new Error("Invalid Login ID or Password.");
  if (String(user.Account_Status || "").toLowerCase() !== "active") throw new Error("User account is not Active.");
  if (!user.Password_Salt || !user.Password_Hash) {
    throw new Error("Password is not configured for this user. Ask the Super Admin to set it up.");
  }
  const suppliedHash = sha256_(String(user.Password_Salt) + password);
  if (suppliedHash !== String(user.Password_Hash)) throw new Error("Invalid Login ID or Password.");

  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const session = {
    societyCode:societyCode,
    societyName:String(society.Society_Name || "ABAS SATHI"),
    databaseId:String(society.Database_ID),
    fullName:String(user.Full_Name || ""),
    userId:String(user.UserID || user.Access_ID || ""),
    loginId:String(user.Login_ID || ""),
    role:String(user.Role || "Resident"),
    propertyId:String(user.PropertyID || ""),
    email:String(user.Email_ID || ""),
    mobile:String(user.Mobile_No || "")
  };
  CacheService.getScriptCache().put("SESSION_" + token, JSON.stringify(session), CONFIG.SESSION_TTL_SECONDS);
  return json_({status:"success", token:token, expiresIn:CONFIG.SESSION_TTL_SECONDS, user:session});
}

function requireSession_(token) {
  if (!token) throw new Error("Authentication required. Please sign in again.");
  const raw = CacheService.getScriptCache().get("SESSION_" + token);
  if (!raw) throw new Error("Session expired. Please sign in again.");
  return JSON.parse(raw);
}

function sha256_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join("");
}

function sheetObjects_(sheet) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).filter(row => row.some(v => v !== "" && v !== null)).map(row => {
    const obj = {};
    headers.forEach((h,i) => { if (h) obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return obj;
  });
}

function nextReceipt_(sheet) {
  const n = Math.max(sheet.getLastRow(), 1);
  return "RCT-" + String(n).padStart(6, "0");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run once manually from Apps Script to create a salted hash for a user.
 * Replace the values and run createPasswordHash().
 * Copy the returned salt/hash into Society User Access.
 */
function createPasswordHash() {
  const password = "CHANGE_THIS_TEMPORARY_PASSWORD";
  const salt = Utilities.getUuid().replace(/-/g, "");
  const hash = sha256_(salt + password);
  Logger.log(JSON.stringify({Password_Salt:salt, Password_Hash:hash}));
}
