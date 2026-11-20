# ABAS SATHI Version 5.6.2 — Deployment (বাংলা)

## 1. Backup
1. GitHub-এ বর্তমান deployed code-এর commit/tag `v5.6.1` তৈরি করুন।
2. Apps Script-এর বর্তমান `Code.gs` backup/download রাখুন এবং deployment version note করুন।
3. Central Master ও society spreadsheets backup রাখুন।

## 2. Frontend update
1. ZIP extract করুন।
2. Existing GitHub repository-তে updated source replace/merge করুন; `.env`, private IDs, credentials বা local build files publish করবেন না।
3. Commit `ABAS SATHI 5.6.2 login fast-path` নামে commit করতে পারেন।
4. Build/test করুন: `npm ci` (lock file থাকলে) অথবা `npm install`; তারপর `npm run lint`, `npm test`, `npm run build`.
5. Staging-এ deploy করে sign-in এবং all roles যাচাই করুন।

## 3. Apps Script update
1. Apps Script project খুলুন।
2. `apps_script/Code.gs` সম্পূর্ণ replace করে Save করুন।
3. Deploy → Manage deployments → Edit → New version → Deploy.
4. Existing Web App URL unchanged থাকলে frontend config বদলাবেন না; URL পরিবর্তন হলে বর্তমান `/exec` URL update করুন।
5. Execute as: Me এবং frontend-এর জন্য access setting existing deployment architecture অনুযায়ী রাখুন।

## 4. Validation checklist
- Society Code + Login ID + password দিয়ে login.
- ভুল password; invalid society; inactive account.
- Admin, Committee, Accountant, Resident.
- Login-এর পর dashboard shell immediately mount; Last_Login পরে update হচ্ছে কিনা.
- Resident শুধু নিজের property; role permission ও society isolation.
- Browser console timing diagnostics record করুন; network request timing-ও note করুন.
- Dashboard summary, payment/expense, invoice, reports, notices/gallery regression.

## 5. Rollback
- Frontend: GitHub-এ prior `v5.6.1` commit restore/revert করে redeploy.
- Apps Script: Manage deployments থেকে prior deployment/version select করে rollback বা prior code redeploy.
- v5.6.2 কোনো sheet/column migration করে না; rollback-এর জন্য data migration undo দরকার নেই.

**Production readiness:** code-level patch candidate. Live backend, frontend build, role tests এবং actual timing benchmark pass না হওয়া পর্যন্ত production-certified বলবেন না.
