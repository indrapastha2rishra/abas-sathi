# ABAS SATHI 5.6.1 — Deployment Guide (বাংলা)

## 0. Backup (অবশ্যই)
1. বর্তমান GitHub repository/branch-এর backup বা tag `v5.5.3` তৈরি করুন।
2. Apps Script Editor থেকে বর্তমান `Code.gs` copy করে local backup রাখুন।
3. Central Master এবং society spreadsheet-এর backup নিন। এই update কোনো database schema migration চায় না।

## 1. GitHub frontend update
1. ZIP extract করে `ABAS_SATHI_5.6.1_WORK` folder-এর source আপনার repository-তে তুলুন।
2. `package.json` version 5.6.1 নিশ্চিত করুন।
3. GitHub commit করুন, যেমন `Release ABAS SATHI 5.6.1 - login diagnostics`.
4. আপনার বিদ্যমান deployment workflow অনুযায়ী build/deploy চালান।

## 2. Apps Script backend update
1. Apps Script project খুলুন; `Code.gs`-এর backup আগে নিন।
2. Release ZIP-এর `apps_script/Code.gs` দিয়ে current file replace করুন।
3. Save করুন। Database sheet names/columns পরিবর্তন করা হয়নি।
4. **Deploy → Manage deployments → Edit** (existing web app) → নতুন version নির্বাচন/তৈরি করুন → Deploy।
5. Web app execute-as এবং access setting আগের deployment-এর মতো রাখুন। URL বদলে গেলে frontend config-এর URL update করুন।
6. Live login ও permissions test করার আগে production society users-কে update করবেন না।

## 3. Browser / mobile cache
- GitHub Pages বা deployment নতুন build serving করছে নিশ্চিত করুন।
- Desktop: hard refresh (Ctrl+Shift+R) করুন।
- Android: browser tab reload; প্রয়োজন হলে site cache clear করুন, তবে প্রথমে শুধু reload চেষ্টা করুন।
- Remembered Society Code/Login ID identifiers-only; password storage নেই।

## 4. Post-deploy test checklist
- Valid login: Admin, Committee, Accountant, Resident (test society accounts).
- Invalid Society Code/Login ID/password; inactive account; empty fields.
- Rapid double-click; backend timeout/network offline.
- Logout and login again; session expiration.
- Society isolation and each role's restricted pages/actions.
- Dashboard totals/financial calculations against source Sheets.
- Check browser console `ABAS SATHI login timing` diagnostics. Record backend auth, lookup, password verification and frontend total. Do not share console logs containing other application data.

## 5. Rollback
1. GitHub: redeploy/tag previous `v5.5.3` frontend.
2. Apps Script: Manage deployments → select previous deployment version (or create a deployment pointing to the saved 5.5.3 script backup).
3. Verify frontend/backend deployment URLs match.
4. Login-test all roles, then compare dashboard and financial records.
5. Since 5.6.1 does not alter sheets/columns, no database rollback/migration is expected.

## Performance expectation
No 3-second result is certified. Measure at least 5 warm and 5 cold login trials on a representative network and report median and worst-case. The Dashboard's existing multi-sheet bootstrap remains a known follow-up optimization.
