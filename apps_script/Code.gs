/**
 * ====================================================================
 * ABAS SATHI (আবাসসাথী) - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Project: Apartment Management Website & App
 * Tagline: Smart Living. Better Community.
 *
 * Free-Tier Backend for Google Sheets & Google Drive
 * ====================================================================
 */

// 1. CONFIGURATION PARAMETERS (Replace with your actual Google IDs)
const CONFIG = {
  SPREADSHEET_ID: "1wuCaLBQkWdnNadxXoWzDooYessirgqyKk-DSBNx7vpM",
  DRIVE_FOLDER_ID: "1aUS1Dn09JSBP55C_yKmX4nWRirM_p9wB",
  ALLOWED_ORIGINS: ["*"], // In production, restrict to your GitHub Pages domain (e.g. https://<username>.github.io)
};

/**
 * Handle HTTP GET Requests from Frontend
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "ping";
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    if (action === "ping") {
      return responseJSON({
        status: "success",
        message: "ABAS SATHI Google Apps Script Web App is Online & Ready",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getProperties") {
      const sheet = ss.getSheetByName("Property Master");
      return responseJSON({ status: "success", data: sheetToObjects(sheet) });
    }

    if (action === "getInvoices") {
      const sheet = ss.getSheetByName("Invoice_Register");
      return responseJSON({ status: "success", data: sheetToObjects(sheet) });
    }

    if (action === "getReceipts") {
      const sheet = ss.getSheetByName("Fund Inflow Register");
      return responseJSON({ status: "success", data: sheetToObjects(sheet) });
    }

    if (action === "getExpenses") {
      const sheet = ss.getSheetByName("Expense Register");
      return responseJSON({ status: "success", data: sheetToObjects(sheet) });
    }

    if (action === "getRequests") {
      const sheet = ss.getSheetByName("Activity Request Register");
      return responseJSON({ status: "success", data: sheetToObjects(sheet) });
    }

    if (action === "getNotices") {
      const sheet = ss.getSheetByName("Notice Master");
      return responseJSON({ status: "success", data: sheetToObjects(sheet) });
    }

    return responseJSON({ status: "error", message: "Unknown action parameter" });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Handle HTTP POST Requests from Frontend (Transactions, Payments, Expenses)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: "error", message: "No payload received" });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // 1. Submit Resident Payment (Pending Verification)
    if (action === "submitPayment") {
      const sheet = ss.getSheetByName("Fund Inflow Register");
      sheet.appendRow([
        payload.transactionId,
        payload.receiptNumber,
        new Date().toISOString().split("T")[0],
        payload.propertyId,
        payload.ownershipId,
        payload.ownerId,
        payload.flatNo,
        payload.ownerName,
        payload.amount,
        payload.mode,
        payload.reference,
        payload.bankAccount,
        payload.amount, // Unallocated until confirmed
        payload.remarks || "",
        payload.fileReference || "",
        payload.createdByName || "Resident",
        new Date().toISOString(),
        "Pending Verification" // Never marked as confirmed automatically
      ]);

      logAudit(ss, "CREATE", "Fund Inflow Register", payload.receiptNumber, `Payment of ₹${payload.amount} submitted`, payload.createdByName);
      return responseJSON({ status: "success", message: "Payment recorded as Pending Verification", receiptNumber: payload.receiptNumber });
    }

    // 2. Confirm Payment & Allocate to Invoices (Admin / Accountant)
    if (action === "confirmPayment") {
      // Find row in Fund Inflow Register and update status
      const receiptSheet = ss.getSheetByName("Fund Inflow Register");
      const rValues = receiptSheet.getDataRange().getValues();
      for (let i = 1; i < rValues.length; i++) {
        if (rValues[i][1] === payload.receiptNumber) {
          receiptSheet.getRange(i + 1, 18).setValue("Confirmed"); // Receipt_Status column
          break;
        }
      }

      logAudit(ss, "APPROVE", "Fund Inflow Register", payload.receiptNumber, "Payment confirmed and verified", payload.createdByName);
      return responseJSON({ status: "success", message: "Payment confirmed" });
    }

    // 3. Upload File Attachment to Google Drive
    if (action === "uploadFile") {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      const decodedData = Utilities.base64Decode(payload.base64Data);
      const blob = Utilities.newBlob(decodedData, payload.mimeType, payload.fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return responseJSON({
        status: "success",
        fileUrl: file.getUrl(),
        fileId: file.getId(),
        fileName: file.getName()
      });
    }

    return responseJSON({ status: "error", message: "Unsupported action: " + action });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Append to Audit Log (Sheet R)
 */
function logAudit(ss, actionType, moduleName, recordId, remarks, userName) {
  try {
    const auditSheet = ss.getSheetByName("Audit Log");
    if (auditSheet) {
      auditSheet.appendRow([
        "LOG-" + new Date().getTime(),
        userName || "System",
        actionType,
        moduleName,
        recordId,
        "",
        remarks,
        new Date().toISOString().replace("T", " ").substring(0, 19),
        remarks
      ]);
    }
  } catch (e) {
    // Audit logging is non-blocking
  }
}

/**
 * Helper to respond with JSON + CORS Headers
 */
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper to transform sheet rows to array of JSON objects
 */
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}
