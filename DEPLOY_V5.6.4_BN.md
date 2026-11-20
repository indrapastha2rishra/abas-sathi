# ABAS SATHI v5.6.4 — Deployment Guide (বাংলা)

## সতর্কতা
এই release returning-user app-shell restore দ্রুত করে। এটি offline database cache নয়, offline transaction system নয়, এবং first-time Login-কে 1 second guaranteed করে না। **Production-এর আগে staging test করুন।**

## Deploy
1. বর্তমান GitHub branch, Apps Script deployment এবং source ZIP backup করুন।
2. v5.6.4 ZIP extract করে staging branch/source update করুন।
3. Project folder-এ `npm install` চালান।
4. `npm test` চালান।
5. `npm run lint` এবং `npm run build` চালান। সব successful না হলে production deploy করবেন না।
6. Apps Script backend-এ এই release-এর authentication API change নেই; backend deploy change দরকার নেই। Current deployed backend URL/config অপরিবর্তিত রাখুন।
7. Staging deploy করে saved session থাকা user-এর app open timing record করুন; অন্তত 10 warm/reopen test এবং slow-network throttling test করুন।
8. Online verification success, invalid token, network offline, reconnect, sign-out এবং resident/admin role screens পরীক্ষা করুন।
9. App shell immediate open হলেও data requests ও writes server authorization-এর অধীন আছে কিনা confirm করুন। Offline-এ financial transaction submit করতে দেবেন না।
10. Staging acceptance ও owner approval-এর পর production deploy করুন।

## Rollback
1. GitHub/hosting provider-এ previous v5.6.3 deployment restore করুন।
2. Local browser session key `abasSathiSession` existing format-এ থাকে; database migration নেই।
3. Backend/Google Sheets schema migration এই release-এ নেই।

## Validation checklist
- [ ] Admin saved session restores shell immediately
- [ ] Accountant saved session restores shell immediately
- [ ] Committee saved session restores shell immediately
- [ ] Resident saved session restores shell immediately
- [ ] Valid server session refreshes profile
- [ ] Invalid/revoked server session returns to Login
- [ ] Slow server response does not block shell
- [ ] Offline banner and Retry work
- [ ] Reconnect triggers background verification
- [ ] Offline transaction/write fails safely
- [ ] npm test / lint / build pass in local environment
- [ ] Real device/browser timing documented
