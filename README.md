# ABAS SATHI (আবাসসাথী)
**Smart Living. Better Community.**

> Apartment Management App-cum-Website tailored for Bengali residential housing societies managing up to 50 flats.

---

## 1. Project Overview & Phase Roadmap

- **Phase 1 (Completed):** Fully functional, responsive, bilingual (English & Bengali) Website foundation. Includes all 4 roles (Admin, Committee, Accountant, Resident), 21 Google Sheets database models, rate calculations, payment workflows, print/save PDF modals, and Google Apps Script integration architecture.
- **Phase 2 (Next):** Live Google Sheets & Google Drive API backend synchronization.
- **Phase 3:** Website stabilization and production deployment on GitHub Pages.
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
   - Full access across all 8 modules.
   - Generates invoices, approves expenses, oversees preventive maintenance, and edits society profile.
2. **Committee Member (পরিচালনা কমিটি):**
   - View properties, bills, receipts, and financial reports.
   - Manages and resolves resident Activity Requests.
3. **Accountant / Treasurer (হিসাবরক্ষক):**
   - Full financial operations: Generate Invoices, Record Payments, Bill-wise Allocation, Expense Vouchers, and Monthly Receipt & Payment statements.
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

# 3. Start development server
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
3. Insert your `SPREADSHEET_ID` and `DRIVE_FOLDER_ID`.
4. Click **Deploy -> New Deployment**.
5. Select type: **Web App**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the generated Web App URL.

### Step 3: Configure ABAS SATHI Settings
Navigate to **Settings -> Google Backend Setup Guide** in the ABAS SATHI navigation:
- Paste `[ADD_SPREADSHEET_ID]`
- Paste `[ADD_DRIVE_FOLDER_ID]`
- Paste `[ADD_APPS_SCRIPT_WEB_APP_URL]`
- Click **Save Config**.

---

## 6. Financial Calculations & Rules

- **Base Rate Calculation:**
  - Area × Rate: `Super_Builtup_Area × Rate_Per_SqFt`
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

The website now starts at Login and does not initialize sample/demo records. After authentication it reads the society's 21 tabs through the backend. This version focuses on live reads; existing create/update actions in the React screens are not all synchronized to Sheets yet. Do not treat the website as production-ready accounting software until those write operations, role-based server authorization, and file permissions have been completed and tested.
