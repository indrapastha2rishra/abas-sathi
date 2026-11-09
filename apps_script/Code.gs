
/**
 * ====================================================================
 * ABAS SATHI (আবাসসাথী)
 * GOOGLE APPS SCRIPT BACKEND
 * Smart Living. Better Community.
 * ====================================================================
 */

// 1. CONFIGURATION
const CONFIG = {
  SPREADSHEET_ID: "1wuCaLBQkWdnNadxXoWzDooYessirgqyKk-DSBNx7vpM",
  DRIVE_FOLDER_ID: "1aUS1Dn09JSBP55C_yKmX4nWRirM_p9wB"
};

// 2. SHEET NAMES
const SHEETS = {
  PROPERTIES: "Property Master",
  INVOICES: "Invoice_Register",
  RECEIPTS: "Fund Inflow Register",
  EXPENSES: "Expense Register",
  REQUESTS: "Activity Request Register",
  NOTICES: "Notice Master",
  AUDIT: "Audit Log"
};

// 3. GET REQUEST
function doGet(e) {
  try {
    const action = e?.parameter?.action || "ping";

    if (action === "ping") {
      return responseJSON({
        status: "success",
        message: "ABAS SATHI Backend Online",
        timestamp: new Date().toISOString()
      });
    }

    const actions = {
      getProperties: SHEETS.PROPERTIES,
      getInvoices: SHEETS.INVOICES,
      getReceipts: SHEETS.RECEIPTS,
      getExpenses: SHEETS.EXPENSES,
      getRequests: SHEETS.REQUESTS,
      getNotices: SHEETS.NOTICES
    };

    const sheetName = actions[action];

    if (!sheetName) {
      throw new Error("Unknown GET action: " + action);
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getRequiredSheet(ss, sheetName);

    return responseJSON({
      status: "success",
      data: sheetToObjects(sheet)
    });

  } catch (err) {
    return responseJSON({
      status: "error",
      message: err.message || String(err)
    });
  }
}

// 4. POST REQUEST
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    if (!e?.postData?.contents) {
      throw new Error("No payload received");
    }

    const payload = JSON.parse(e.postData.contents);

    if (!payload.action) {
      throw new Error("Action is required");
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // PAYMENT SUBMISSION
    if (payload.action === "submitPayment") {

      validateRequired(payload, [
        "transactionId",
        "receiptNumber",
        "propertyId",
        "flatNo",
        "ownerName",
        "amount",
        "mode"
      ]);

      const amount = Number(payload.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid payment amount");
      }

      lock.waitLock(30000);

      const sheet = getRequiredSheet(ss, SHEETS.RECEIPTS);
      const values = sheet.getDataRange().getValues();

      // Duplicate Transaction / Receipt Check
      for (let i = 1; i < values.length; i++) {
        if (
          String(values[i][0]) === String(payload.transactionId) ||
          String(values[i][1]) === String(payload.receiptNumber)
        ) {
          throw new Error("Duplicate Transaction ID or Receipt Number");
        }
      }

      const now = new Date();

      sheet.appendRow([
        payload.transactionId,
        payload.receiptNumber,
        Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd"),
        payload.propertyId,
        payload.ownershipId || "",
        payload.ownerId || "",
        payload.flatNo,
        payload.ownerName,
        amount,
        payload.mode,
        payload.reference || "",
        payload.bankAccount || "",
        amount,
        payload.remarks || "",
        payload.fileReference || "",
        payload.createdByName || "Resident",
        now.toISOString(),
        "Pending Verification"
      ]);

      logAudit(
        ss,
        "CREATE",
        SHEETS.RECEIPTS,
        payload.receiptNumber,
        "Payment submitted: " + amount,
        payload.createdByName
      );

      return responseJSON({
        status: "success",
        message: "Payment submitted for verification",
        receiptNumber: payload.receiptNumber
      });
    }

    // PAYMENT CONFIRMATION
    if (payload.action === "confirmPayment") {

      validateRequired(payload, ["receiptNumber"]);

      lock.waitLock(30000);

      const sheet = getRequiredSheet(ss, SHEETS.RECEIPTS);
      const values = sheet.getDataRange().getValues();

      let foundRow = -1;

      for (let i = 1; i < values.length; i++) {
        if (
          String(values[i][1]) === String(payload.receiptNumber)
        ) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow === -1) {
        throw new Error("Receipt Number not found");
      }

      const statusCell = sheet.getRange(foundRow, 18);
      const currentStatus = statusCell.getValue();

      if (currentStatus === "Confirmed") {
        throw new Error("Payment is already confirmed");
      }

      statusCell.setValue("Confirmed");

      logAudit(
        ss,
        "APPROVE",
        SHEETS.RECEIPTS,
        payload.receiptNumber,
        "Payment confirmed",
        payload.createdByName
      );

      return responseJSON({
        status: "success",
        message: "Payment confirmed",
        receiptNumber: payload.receiptNumber
      });
    }

    // FILE UPLOAD
    if (payload.action === "uploadFile") {

      validateRequired(payload, [
        "base64Data",
        "mimeType",
        "fileName"
      ]);

      const decodedData = Utilities.base64Decode(
        payload.base64Data
      );

      const blob = Utilities.newBlob(
        decodedData,
        payload.mimeType,
        payload.fileName
      );

      const folder = DriveApp.getFolderById(
        CONFIG.DRIVE_FOLDER_ID
      );

      const file = folder.createFile(blob);

      // IMPORTANT:
      // File remains PRIVATE by default.
      // Do not enable Anyone With Link for personal documents.

      return responseJSON({
        status: "success",
        message: "File uploaded successfully",
        fileId: file.getId(),
        fileName: file.getName(),
        fileUrl: file.getUrl()
      });
    }

    throw new Error(
      "Unsupported POST action: " + payload.action
    );

  } catch (err) {

    return responseJSON({
      status: "error",
      message: err.message || String(err)
    });

  } finally {

    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

// 5. REQUIRED FIELD VALIDATION
function validateRequired(payload, fields) {
  fields.forEach(function(field) {
    if (
      payload[field] === undefined ||
      payload[field] === null ||
      String(payload[field]).trim() === ""
    ) {
      throw new Error("Required field missing: " + field);
    }
  });
}

// 6. GET REQUIRED SHEET
function getRequiredSheet(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }

  return sheet;
}

// 7. AUDIT LOG
function logAudit(
  ss,
  actionType,
  moduleName,
  recordId,
  remarks,
  userName
) {
  try {
    const sheet = ss.getSheetByName(SHEETS.AUDIT);

    if (sheet) {
      sheet.appendRow([
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
  } catch (err) {
    console.error("Audit Log Error: " + err.message);
  }
}

// 8. SHEET DATA TO JSON OBJECTS
function sheetToObjects(sheet) {
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();

  if (rows.length < 2) return [];

  const headers = rows[0];

  return rows.slice(1)
    .filter(row => row.some(value => value !== ""))
    .map(row => {
      const obj = {};

      headers.forEach((header, index) => {
        if (header !== "") {
          obj[header] = row[index];
        }
      });

      return obj;
    });
}

// 9. JSON RESPONSE
function responseJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
