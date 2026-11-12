# Version 5.3.2 → 5.3.3 Migration Guide (বাংলা)

## Migration impact
এই update-এ নতুন required database sheet বা required column যোগ হয়নি। Existing sheets ব্যবহার করা হবে:
- `Property Master`
- `Tenant Master`
- `Invoice_Register`
- `Ownership History`
- `Owner Master`

## Before updating
1. GitHub repository-এর ZIP backup নিন।
2. Central Master spreadsheet এবং প্রতিটি Society Database spreadsheet-এর copy নিন।
3. Apps Script-এর current source ও Script Properties-এর নিরাপদ record রাখুন।
4. Private Drive Root Folder ID এবং Central Master Spreadsheet ID GitHub source-এ রাখবেন না; Apps Script Script Properties-এ রাখবেন।

## Update steps
1. Version 5.3.3 ZIP extract করুন।
2. Existing GitHub repository-তে `.git`, `.github/workflows`, `.gitignore` preserve করে project source replace/merge করুন।
3. Commit ও push করুন; GitHub Actions build/deploy result দেখুন।
4. Existing Apps Script project-এ updated `apps_script/Code.gs` paste করুন।
5. Existing Script Properties অক্ষত রাখুন:
   - `CENTRAL_MASTER_SPREADSHEET_ID`
   - `DEFAULT_DRIVE_FOLDER_ID`
6. Save → Deploy → Manage deployments → Edit → New version → Deploy।
7. Existing Web App `/exec` URL অপরিবর্তিত আছে কি না যাচাই করুন।

## Data mapping note
- `Super Buildup Area` legacy header maps to `Structural_Area`.
- `Super Built-up Area` maps to `Super_Built_up_Area`.
- `Total Area` legacy header maps to `Super_Built_up_Area`.
- Area values are displayed from their mapped database fields; no area total is recalculated in the Properties & Residents screen.
- Empty area cells remain empty (displayed as —).

## Ownership-wise report note
Report uses `Ownership_ID` saved on each invoice. It does not infer ownership from the invoice date or current owner. Old invoices with blank Ownership_ID appear as `Not linked` and must be reconciled by an authorized accountant/admin. Do not bulk-fill historical Ownership_ID without reviewing each invoice's ownership period.

## Staging acceptance tests
- Check area mapping for all four area columns against the source sheet, including one row where `Super Buildup Area` and `Super Built-up Area` have different values.
- Check a tenant with both lease dates and another with blank lease end date.
- Check cancelled, partially paid, unpaid and fully paid invoices in Outstanding Dues.
- Check Invoice Register amounts against source Invoice_Register rows.
- Test one transferred flat with old and new Ownership_ID records and verify separate outstanding totals.
- Test an invoice with blank Ownership_ID; it must appear under `Not linked`.
- Verify Admin, Committee and Accountant report access; verify Resident cannot access this admin financial report.
- Compare report totals against a manually reconciled sample of Invoice_Register rows.

## Rollback
If acceptance tests fail, restore the previous GitHub release and previous Apps Script deployment version. Do not restore the production spreadsheet unless database content itself was changed; this release does not require sheet schema migration.
