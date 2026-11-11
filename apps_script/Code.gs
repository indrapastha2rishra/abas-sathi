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
  "PropertyID","Account_Status","Password_Salt","Password_Hash","Profile_Address",
  "Emergency_Contact","KYC_Status","KYC_Documents","Created_At","Created_By",
  "Approved_At","Approved_By","Last_Login","Password_Changed_At"
];

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if ((p.action || "ping") === "ping") return json_({status:"success", message:"ABAS SATHI backend online"});
    const session = requireSession_(p.token);
    if (p.action === "getSocietyData" || p.action === "getAllData") {
      const ss = SpreadsheetApp.openById(session.databaseId);
      const result = {};
      CONFIG.SOCIETY_SHEETS.forEach(name => {
        // Do not expose bank account credentials or user password records to normal clients.
        if (name === "Bank Account Master" && !["Admin","Accountant"].includes(session.role)) {
          result[name] = []; return;
        }
        if (name === "User Master & Role Management") { result[name] = []; return; }
        let records = sheetObjects_(ss.getSheetByName(name));
        if (session.role === "Resident") {
          const ownProperty = String(session.propertyId || "");
          const propertyScoped = ["Property Master","Invoice_Register","Fund Inflow Register","Bill Wise Details","Ownership History","Tenant Master","Property Utility Details"];
          if (propertyScoped.includes(name)) records = records.filter(r => String(r.PropertyID || "") === ownProperty);
          if (name === "Owner Master") {
            const ownOwnerIds = sheetObjects_(ss.getSheetByName("Ownership History"))
              .filter(r => String(r.PropertyID || "") === ownProperty).map(r => String(r.OwnerID || ""));
            records = records.filter(r => ownOwnerIds.includes(String(r.OwnerID || "")));
          }
          if (name === "Expense Register" || name === "Expense Category Master" || name === "Bank Account Master" || name === "Audit Log") records = [];
          if (name === "Activity Request Register") records = records.filter(r => String(r.PropertyID || "") === ownProperty && [session.userId,session.fullName].includes(String(r.Requested_By || "")));
          if (name === "Notice Master" || name === "Gallery Master") records = records.filter(r => {
            const visibility=String(r.Visibility||"");
            if (visibility === "All Residents") return true;
            if (visibility !== "Selected Properties") return false;
            const selected=String(r.Selected_Properties||r.PropertyID||"");
            return selected.split(/[,;|]/).map(x=>x.trim()).includes(ownProperty);
          });
        }
        result[name] = records;
      });
      return json_({status:"success", society:{societyCode:session.societyCode,societyName:session.societyName,societyAddress:session.societyAddress},data:result});
    }
    if (p.action === "getMyProfile") return json_({status:"success", profile:publicUser_(getUserRow_(session))});
    return json_({status:"error",message:"Unknown action"});
  } catch (err) { return json_({status:"error",message:safeError_(err)}); }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
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
      case "adminCreateUser": return adminCreateUser_(session,body);
      case "adminListUsers": return adminListUsers_(session);
      case "adminApproveUser": return adminApproveUser_(session,body);
      case "adminRejectUser": return adminRejectUser_(session,body);
      case "adminSetKycStatus": return adminSetKycStatus_(session,body);
      case "updateMyProfile": return updateMyProfile_(session,body);
      case "uploadKycDocument": return uploadKycDocument_(session,body);
      case "submitPayment": return submitPayment_(session,body);
      default: return json_({status:"error",message:"Unsupported action"});
    }
  } catch (err) { return json_({status:"error",message:safeError_(err)}); }
}

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
  if (!user || String(user.Account_Status).toLowerCase() !== "active") { recordLoginFailure_(failKey,cache); throw new Error("Invalid credentials or account is not active. Contact your society Admin."); }
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
    role:String(user.Role || "Resident"), propertyId:String(user.PropertyID || ""),
    email:String(user.Email_ID || ""), mobile:String(user.Mobile_No || "")
  };
  CacheService.getScriptCache().put("SESSION_"+token,JSON.stringify(session),CONFIG.SESSION_TTL_SECONDS);
  return json_({status:"success",token,expiresIn:CONFIG.SESSION_TTL_SECONDS,user:session});
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
      Mobile_No:mobile, Role:role, PropertyID:role==="Resident"?cleanText_(body.propertyId,80):"",
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
  const root = DriveApp.getFolderById(CONFIG.DEFAULT_DRIVE_FOLDER_ID);
  if (root.getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error("KYC storage folder must be private. Remove public/link sharing from the configured Drive folder first.");
  const folderName = "KYC_" + session.societyCode;
  const folders = root.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : root.createFolder(folderName);
  const safeName = session.userId + "_" + Date.now() + "_" + fileName.replace(/[^\w.\-]/g,"_");
  const file = folder.createFile(Utilities.newBlob(bytes,mime,safeName));
  // Grant access only to uploader and active Admins of this society; never enable link/public sharing.
  if (session.email) { try { file.addViewer(session.email); } catch (e) {} }
  rows.filter(r => r.Role === "Admin" && String(r.Account_Status).toLowerCase() === "active" && r.Email_ID)
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
  const user=rows.find(r=>normalizeLogin_(r.Login_ID)===loginId && normalizeEmail_(r.Email_ID)===email && String(r.Account_Status).toLowerCase()==="active");
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
  if(!user || String(user.Account_Status).toLowerCase()!=="active") throw new Error("Account cannot be reset.");
  const salt=randomHex_(24);
  setCell_(usersSheet,user.__row,"Password_Salt",salt);
  setCell_(usersSheet,user.__row,"Password_Hash",hashPassword_(salt,password));
  setCell_(usersSheet,user.__row,"Password_Changed_At",new Date());
  cache.remove(key);
  return json_({status:"success",message:"Password reset successfully. Please sign in."});
}

function submitPayment_(session,body) {
  const ss=SpreadsheetApp.openById(session.databaseId), sh=ss.getSheetByName("Fund Inflow Register");
  if(!sh) throw new Error("Missing sheet: Fund Inflow Register");
  if(session.role==="Resident" && String(body.propertyId||"")!==session.propertyId) throw new Error("You may submit payments only for your linked property.");
  sh.appendRow([body.transactionId||Utilities.getUuid(),body.receiptNumber||nextReceipt_(sh),new Date(),body.propertyId||"",body.ownershipId||"",body.ownerId||"",body.flatNo||"",body.ownerName||"",Number(body.amount||0),body.mode||"",body.reference||"",body.bankAccount||"",Number(body.amount||0),body.remarks||"",body.fileReference||"",session.userId,new Date(),"Pending Verification"]);
  return json_({status:"success",message:"Payment submitted for verification"});
}

function societyAndUsers_(code) {
  const master=SpreadsheetApp.openById(CONFIG.CENTRAL_MASTER_SPREADSHEET_ID);
  const societies=sheetObjects_(master.getSheetByName("Society Master"));
  const society=societies.find(r=>normalizeSociety_(r.Society_Code)===code);
  if(!society || String(society.Society_Status).toLowerCase()!=="active") throw new Error("Society not found or inactive.");
  if(!society.Database_ID) throw new Error("Society database is not configured.");
  const usersSheet=master.getSheetByName("Society User Access");
  if(!usersSheet) throw new Error('Missing Central Master tab: Society User Access');
  ensureHeaders_(usersSheet,USER_HEADERS);
  const rows=sheetObjects_(usersSheet);
  rows.forEach((r,i)=>r.__row=i+2);
  return {society,usersSheet,rows:rows.filter(r=>normalizeSociety_(r.Society_Code)===code)};
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
  if(!user || String(user.Account_Status).toLowerCase()!=="active") {
    CacheService.getScriptCache().remove("SESSION_"+token);
    throw new Error("Your account is inactive. Contact your society Admin.");
  }
  session.role=String(user.Role||session.role);
  session.propertyId=String(user.PropertyID||"");
  session.fullName=String(user.Full_Name||session.fullName);
  session.email=String(user.Email_ID||session.email);
  session.mobile=String(user.Mobile_No||session.mobile);
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
  headers.forEach(h=>{if(existing.indexOf(h)<0){existing.push(h);sh.getRange(1,existing.length).setValue(h);}});
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
function parseJsonArray_(v){try{const a=JSON.parse(String(v||"[]"));return Array.isArray(a)?a:[];}catch(e){return[];}}
function audit_(s,action,id,remarks){
  try{const ss=SpreadsheetApp.openById(s.databaseId),sh=ss.getSheetByName("Audit Log");if(sh)sh.appendRow([Utilities.getUuid(),s.userId,action,"User Management",id,"", "",new Date(),remarks]);}catch(e){}
}
function nextReceipt_(sh){return "RCT-"+String(Math.max(sh.getLastRow(),1)).padStart(6,"0");}
function safeError_(e){const m=String(e&&e.message||e);return m.length>250?m.slice(0,250):m;}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}

/** One-time helper for first Admin bootstrap only. Set temporary values, run, then remove them. */
function authorizeRequiredServices() {
  SpreadsheetApp.openById(CONFIG.CENTRAL_MASTER_SPREADSHEET_ID).getName();
  DriveApp.getFolderById(CONFIG.DEFAULT_DRIVE_FOLDER_ID).getName();
  MailApp.getRemainingDailyQuota();
  Logger.log("Spreadsheet, Drive and Mail permissions authorized.");
}

/** One-time helper for first Admin bootstrap only. Set temporary values, run, then remove them. */
function bootstrapFirstAdmin() {
  const societyCode="SO001", loginId="admin", password="AdminNew@2026";
  const email="indrapastha2rishra@gmail.com", fullName="Sanju Kr. Mallik";
  const {usersSheet,rows}=societyAndUsers_(societyCode);
  if(rows.some(r=>r.Role==="Admin" && String(r.Account_Status).toLowerCase()==="active"))throw new Error("An active Admin already exists.");
  validatePassword_(password);const salt=randomHex_(24);
  appendObject_(usersSheet,{Society_Code:societyCode,Login_ID:loginId,UserID:"USR-ADMIN-001",Full_Name:fullName,Email_ID:cleanEmail_(email),Mobile_No:"",Role:"Admin",PropertyID:"",Account_Status:"Active",Password_Salt:salt,Password_Hash:hashPassword_(salt,password),Profile_Address:"",Emergency_Contact:"",KYC_Status:"Not Submitted",KYC_Documents:"[]",Created_At:new Date(),Created_By:"SYSTEM",Approved_At:new Date(),Approved_By:"SYSTEM",Last_Login:"",Password_Changed_At:new Date()});
  Logger.log("Admin created. Login ID: "+loginId+"; set a unique password and remove bootstrap values from source.");
}
