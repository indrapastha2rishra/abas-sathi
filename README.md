# ABAS SATHI (আবাসসাথী)
**Smart Living. Better Community.**

> Apartment Management App-cum-Website tailored for Bengali residential housing societies managing up to 50 flats.

---

## 1. Project Overview — Version 5.3.3

- **Website:** Responsive, bilingual (English & Bengali) React application with Admin, Committee, Accountant and Resident roles.
- **Backend integration:** Google Apps Script Web App with selective Google Sheets reads, validated write workflows, private Drive file APIs, backup and server-side reports.
- **Next release gate:** Complete live Google account authorization, staging tests, financial reconciliation and production deployment validation before launch.
- **Phase 4:** Android packaging via Capacitor / Trusted Web Activity (PWA-ready).

---

## 2. 100% Free-Tier Architecture

In accordance with strict budget guidelines:
- **Frontend:** React + TypeScript + Tailwind CSS (Hosted free on GitHub Pages over HTTPS).
- **Backend:** Google Apps Script Web App (`apps_script/Code.gs`).
- **Database:** Google Sheets (Relational 21-table database).
- **File Storage:** Google Drive (Stores payment screenshots, invoice PDFs, vouchers, and society notices).
- **Zero Paid Subscriptions:** No monthly database fees, paid hosting, or paid gateway charges.

---

## 3. Supported User Roles & Permissions

Users sign in with Society Code, Login ID and Password. Role and flat access are read from the Central Master Database.

1. **Admin (সোসাইটি সভাপতি / প্রশাসক):**
   - Society administration, user management, invoice generation, payment verification, expense approval, backup and report snapshot approval.
2. **Committee Member (পরিচালনা কমিটি):**
   - View properties, bills, receipts, and financial reports.
   - Manages and resolves resident Activity Requests.
3. **Accountant / Treasurer (হিসাবরক্ষক):**
   - Record and verify permitted financial entries, confirm payments, allocate receipts, mark Admin-approved expenses as Paid, manage bank records and prepare financial reports. Invoice generation remains Admin-only.
4. **Resident (ফ্ল্যাট বাসিন্দা / মালিক):**
   - Isolated to own flat details (e.g. Flat 101 - Anirban Mukherjee).
   - Views personal bills, downloads invoices, submits bank/UPI payment references with payment proof, and tracks service requests.
   - Mobile-friendly bottom navigation.

---

## 4. Setup & Deployment Guide

### A. Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. TypeScript check
npm run lint

# 4. Start development server
npm run dev
```

### B. GitHub Pages Deployment
1. Push this repository to GitHub.
2. Under **Repository Settings -> Pages**:
   - Set Source to `GitHub Actions` or `Deploy from a branch` (e.g., `gh-pages` or `main /docs`).
3. Build the static production bundle:
   ```bash
   npm run build
   ```
4. The site is live with HTTPS on `https://<your-username>.github.io/<repository-name>/`.

---

## 5. Google Sheets & Apps Script Setup

### Step 1: Create the Google Spreadsheet
Create a new Google Spreadsheet named `ABAS_SATHI_DB`. Create the following 21 sheets matching the exact column names:
1. `Property Master`
2. `Owner Master`
3. `Ownership History`
4. `Rate Master`
5. `Invoice_Register`
6. `Fund Inflow Register`
7. `Bill Wise Details`
8. `Expense Register`
9. `Expense Category Master`
10. `Bank Account Master`
11. `User Master`
12. `Activity Request Register`
13. `Notice Master`
14. `Gallery Master`
15. `Preventive Maintenance Master`
16. `Rate Property Mapping`
17. `Property Utility Details`
18. `Audit Log`
19. `Financial Year Master`
20. `Tenant Master`
21. `Account Head Master`

Copy your Spreadsheet ID from the URL:
`https://docs.google.com/spreadsheets/d/`**`[YOUR_SPREADSHEET_ID]`**`/edit`

### Step 2: Deploy Google Apps Script
1. Inside your Google Sheet, click **Extensions -> Apps Script**.
2. Replace `Code.gs` with the provided code in `/apps_script/Code.gs`.
3. In Apps Script → Project Settings → Script Properties, set `CENTRAL_MASTER_SPREADSHEET_ID` and `DEFAULT_DRIVE_FOLDER_ID` (see Version 5.3.1 release notes). Do not place these IDs in frontend code or public GitHub files.
4. Click **Deploy -> New Deployment**.
5. Select type: **Web App**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the generated Web App URL.

### Step 3: Configure ABAS SATHI Settings
Navigate to **Settings -> Google Backend Setup Guide** in ABAS SATHI and configure the Apps Script Web App URL. Spreadsheet and Drive IDs are configured only in Apps Script Script Properties / Central Master; they are not required in the browser.

---

## 6. Financial Calculations & Rules

- **Base Rate Calculation:**
  - Area × Rate: `Structural_Area × Rate_Per_SqFt`
  - Quantity × Rate: `Quantity × Unit_Rate`
  - Fixed Amount: Fixed fee
- **Net Charge Formula:**
  $$\text{Net Charge} = \text{Charge Amount} + \text{Late Fee} - \text{Discount} + \text{Adjustment}$$
- **Payment Verification Policy (Section 12):**
  - Resident payments are submitted as `Pending Verification`.
  - Only confirmed upon Accountant/Admin bank realization.
  - Money Receipts are issued only after verification.
- **Accrual Balance Sheet Notice:**
  - Cash-basis Receipt & Payment statements are distinguished from accrual balance sheets. Missing journal entries are never faked.

---

## 7. Branding & Colors

- **Primary Forest Green:** `#536B4D`
- **Background Warm Cream:** `#F7F4EC`
- **Terracotta Accent:** `#C97958`
- **Card Background:** `#FFFFFF`
- **Soft Beige:** `#E8E1D4`
- **Primary Text:** `#29352D`
- **Bengali Typography:** Noto Sans Bengali
- **English Typography:** Inter

---

*ABAS SATHI (আবাসসাথী) — Smart Living. Better Community.*


## Updated live multi-society setup (10-Nov-2026)

1. Convert `ABAS_SATHI_Central_Master_Database.xlsx` to a Google Sheet.
2. Copy its Spreadsheet ID into `CENTRAL_MASTER_SPREADSHEET_ID` in `apps_script/Code.gs`.
3. In `Society User Access`, add `Password_Salt` and `Password_Hash` columns.
4. Create each user's salted SHA-256 password hash using the helper `createPasswordHash()` (change the temporary password first), then paste the salt/hash into that user's row.
5. Ensure the society row has `Society_Code`, `Society_Status=Active`, and `Database_ID` pointing to that society's database spreadsheet.
6. Deploy the Apps Script as a Web App and set its `/exec` URL in `Login.tsx` if the deployment URL differs.
7. Push the complete updated repository to GitHub and allow the Actions deployment to finish.

The website starts at Login and does not initialize sample/demo records. Version 5.3.1 requests modules selectively from the authenticated backend. Some financial workflows now persist server-side; however, not every module has a complete screen-level CRUD form or live-tested workflow. This codebase remains a staging/pilot build, not a certified production accounting system. Complete the owner live-test checklist before real deployment.


## Authentication, profile and KYC update
See `AUTH_KYC_SETUP_BN_EN.txt` for the complete setup and deployment guide. The updated Apps Script backend is `apps_script/Code.gs`.


## Version 5.2 corrections

- Removed the Demo Mode badge and demo-mode configuration. The app requires a valid authenticated session and live Apps Script backend.
- The authenticated header shows the society name and the society address below it. Configure `Society_Address` (or `Registered_Address` / `Address`) in the Central `Society Master` tab.
- Canonical Property Master fields are `Carpet_Area`, `Allocated_Common_Area`, `Structural_Area`, and `Super_Built_up_Area`. The frontend accepts legacy area headers on read for migration compatibility; new/updated sheets should use the canonical names.
- Ownership History joins `Owner Master` and `Property Master` in the UI and no longer displays `PropertyID` as a column.
- Sign-out clears the local session immediately; server token revocation is sent best-effort in the background.


## Version 5.3 — selective read API foundation (12-Nov-2026)

This update changes protected society-data reads to POST requests so session tokens are no longer sent in query strings. It adds the following server-side read actions: `getModuleData` (module key, pagination, search and common filters) and `getDashboardSummary`. The existing v5.2 UI still calls the compatibility `getSocietyData` bulk-read action; migrate screens module-by-module before relying on selective loading for performance.

**Important release status:** Version 5.3 in this package is an incremental security/read-API foundation, not a completed production accounting release. Invoice generation, payment confirmation/allocation, expense approval, general CRUD, full Drive document workflows, backup/restore and complete server-side authorization for every action are not yet implemented. Do not use browser-only state updates as the official ledger. See `V5.3_IMPLEMENTATION_STATUS_BN.md` and `V5.3_API_REFERENCE.md`.

### API request format

Send JSON in a POST body with `Content-Type: text/plain;charset=utf-8` (to avoid an unnecessary CORS preflight for the Apps Script Web App):

```json
{
  "action": "getModuleData",
  "token": "<session-token>",
  "module": "properties",
  "page": 1,
  "limit": 50
}
```

Supported module keys and authorization notes are documented in `V5.3_API_REFERENCE.md`. Never place a session token in a URL or share it in screenshots/logs.

---

## Version 5.3.1 — Financial & Security Completion Work (12-Nov-2026)

**Release status: STAGING / PILOT ONLY — NOT CERTIFIED PRODUCTION READY.** This update adds server-side invoice generation, payment submission/confirmation/allocation, expense creation/approval-payment, allowlisted generic CRUD actions, selective per-screen module reads, private file registry/download checks, operation idempotency records and backup helpers. Some frontend financial actions now wait for backend confirmation before updating UI state. See:

- `V5.3.1_RELEASE_NOTES_BN.md` — Bengali changes, owner setup, known limits and rollback.
- `V5.3.1_API_REFERENCE.md` — request/response actions and role notes.
- `V5.3.1_TEST_REPORT.md` — actual checks run and blocked tests.

### Required Apps Script Script Properties (do not paste IDs into source code)

In Apps Script → Project Settings → Script Properties, add:

- `CENTRAL_MASTER_SPREADSHEET_ID` = your Central Master spreadsheet ID.
- `DEFAULT_DRIVE_FOLDER_ID` = private root Google Drive folder ID.

The `Society Master` tab should include `Society_Code`, `Society_Status`, `Database_ID`, `Society_Name`, and preferably `Drive_Folder_ID`. Each society database must preserve the exact tabs and headers in the database roadmap. `Invoice_Register` and `Invoice Register` are both accepted by the new selective reader/financial API.

### New internal tabs

The backend creates hidden `_Operation Ledger` and `_File Registry` tabs as needed. Do not delete or edit these tabs manually. A `STARTED` operation may have partially written data; reconcile the linked register rows before retrying.

### Selective loading

The React app now requests only modules needed by the active navigation screen using `getModuleData`. The API pages unfiltered non-Resident reads in 200-row windows. Filtered and Resident queries may still scan a complete sheet to apply row-level filters. Not all screens have server pagination controls yet.

### Live testing warning

No live Google account, deployed Apps Script endpoint, Drive folder, or GitHub repository was available in this development session. `npm install` timed out, so semantic TypeScript checking and Vite build were blocked. Do not treat this ZIP as a production-ready accounting ledger until the owner completes the live tests and deployment checklist in the Bengali release notes.


## Version 5.3.2 — Features carried forward

### Master Data CRUD
Open **Settings → Master Data CRUD**. Admin, Committee and Accountant see only modules allowed to their server-side role. Create/Edit/Archive requests are saved through authenticated Apps Script APIs. Ownership History is preserved; it is not physically archived.

### Private Document Center
Open **Settings → Documents**. Upload PDF/JPG/PNG files up to 5 MB. Files are private in the society's Drive folder. Categories include Owner Document, Expense Voucher, Gallery Photo, Notice Attachment, Activity Request Attachment, Payment Proof and Invoice PDF. Where a related module and record ID are supplied, the backend writes the file ID to the matching document-reference column. Downloads are authorized by the backend.

### Backup and Restore
Admin opens **Settings → Backup & Restore**. Manual backup copies the society spreadsheet. Daily automation copies Central Master and active society spreadsheets at approximately 02:00 in the Apps Script project timezone. Restore verifies that the backup is registered for the same society and creates a pre-restore copy before replacing sheets. The Apps Script owner must authorize Drive and trigger scopes. Test restore on a non-production copy first.

### Reports and Balance Sheet
`getReports` supports Receipt & Payment, Financial Year, Property Outstanding, Owner Outstanding, Expense Summary and Balance Sheet data. New invoice, confirmed payment, paid expense and invoice reversal transactions post double-entry rows to hidden `_Journal Ledger`. Admin can post one balanced opening-balance batch. Accountant can submit a Balance Sheet snapshot; a different Admin must verify its SHA-256 payload hash and approve it.

**Important:** The Balance Sheet is an internal system-generated report, not an independent statutory audit. Pre-Version 5.3.2 historical transactions are not automatically journalized. Before go-live, reconcile historical bank balances, outstanding receivables, advances, liabilities and equity into the one-time opening journal batch with the society's accountant/auditor. Use consistent account names: `Accounts Receivable`, `Resident Advances`, `Bank: <Bank_Name>`, `Expense: <Expense_Category>` and `<Purpose> Income`. Fund balances are grouped with equity in the Balance Sheet report.

### New internal tabs
The backend creates these hidden tabs as needed:
- `_Journal Ledger`
- `_Backup Log`
- `_Restore Log`
- `Report Snapshot Register`
- `_File Registry` (additional relationship and MIME metadata columns may be appended)
- `_Operation Ledger` (already used for idempotency and recovery state)

### Known limitations
- Apps Script/Sheets do not provide multi-sheet ACID transactions. If an execution stops after some writes, an operation can remain `STARTED`; reconcile the Operation Ledger and related rows before retrying.
- Drive upload uses Base64 request payloads and is limited to 5 MB. For larger documents, use a different authenticated upload architecture.
- Restore replaces sheets present in the backup but may preserve newer internal tabs not present in the backup. Compare the restored workbook against the backup after any restore.
- Automated backup retention/rotation is not configured; monitor Drive storage and remove old backups only after confirming a newer verified copy.
- Live Google Sheets/Drive tests and GitHub Pages deployment have not been performed in this environment.


## Version 5.3.3 — UI and Reporting Corrections

- Properties & Residents now display Carpet Area, Allocated Common Area, Structural Area and Super Built-up Area from their mapped database fields. The screen does not derive or calculate one area from another. Blank source cells display as a dash.
- Legacy `Super Buildup Area` and the distinct `Super Built-up Area` headers are mapped separately to avoid displaying one database field as another.
- Tenant lease periods display as `dd-MMM-yyyy to dd-MMM-yyyy`; blank end dates display as `Ongoing`.
- Outstanding Dues excludes cancelled and zero-due invoices and includes summary totals and overdue counts.
- Invoice Register displays Ownership ID, Billing Date and the charge components (Basic Charge, Late Fee, Discount, Adjustment, Net Charge, Paid and Outstanding).
- Financial Reports adds **Ownership-wise Outstanding**, grouped by `Ownership_ID` so different ownership periods for the same flat remain separate. Legacy invoices without an Ownership_ID are flagged for manual review.
- See `V5.3.3_RELEASE_NOTES_BN.md`, `MIGRATION_V5.3.2_TO_V5.3.3_BN.md`, `V5.3.3_API_REFERENCE.md` and `V5.3.3_TEST_REPORT.md`.

**Version 5.3.3 is a source update, not a live-service certification.** The Vite production build and live Apps Script/Sheets/Drive integration still require testing with the society owner's Google account.
