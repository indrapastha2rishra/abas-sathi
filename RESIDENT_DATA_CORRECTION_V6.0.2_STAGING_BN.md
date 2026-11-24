# ABAS SATHI 6.0.2 — Resident Data Correction (Staging)

## উদ্দেশ্য
Resident portal-এ Property Master-এর বাস্তব header naming এবং ID whitespace/case variation-এর কারণে record lookup ব্যর্থ হওয়া কমানো। Existing Google Sheets-এর header বা accounting row পরিবর্তন করা হয়নি।

## পরিবর্তন
- Frontend header normalization-এ `Flat No.`, `Block / Tower`, `Occupancy Status`, `Cover Area`, `Coridoor Area`, `Super Buildup Area`, `Super Built-up Area`-এর punctuation/space handling উন্নত করা হয়েছে।
- Resident property lookup-এ PropertyID trim করা হয়েছে।
- Apps Script resident ownership lookup-এ PropertyID, Ownership_ID, OwnerID, Ownership_Status ও Requested_By তুলনায় trim + case-insensitive matching ব্যবহার করা হয়েছে।
- Resident scoping-এ current Ownership History row আবশ্যকই রয়েছে; permission default-deny আচরণ পরিবর্তন করা হয়নি।
- Existing sheets, financial calculations, invoices, receipts, allocations, expense data বা ownership rows delete/rename করা হয়নি।

## Deployment সতর্কতা
এটি staging candidate, production-certified build নয়। এই environment-এ `npm install` dependency fetch timeout করেছে এবং `vite` পাওয়া যায়নি; তাই frontend production build ও automated test suite চালানো যায়নি। Live Google Sheets / Apps Script deployment / Firebase-authenticated Resident accounts-এও end-to-end test হয়নি।

## Deploy করার আগে আবশ্যিক যাচাই
1. Backup the society spreadsheet and Apps Script project.
2. `npm ci`, `npm run lint`, `npm test`, `npm run build` সফল করুন।
3. Apps Script Code.gs deploy করুন নতুন version হিসেবে; existing deployment URL/configuration অপরিবর্তিত রাখুন যদি না প্রয়োজন হয়।
4. Resident account (যেমন PROP-0102 / OSH-002) দিয়ে Dashboard, My Flat, My Bills, Pay Now, Payment History, Activity Requests, Notices & Gallery এবং My Reports যাচাই করুন।
5. অন্য PropertyID দিয়ে API response isolation পরীক্ষা করুন; Resident যেন অন্য flat-এর data না পায়।
6. Admin/Committee/Accountant permissions, payment allocation, receipt confirmation এবং financial reports regression-test করুন।
7. কোনো sheet header বা financial row পরিবর্তন করবেন না।
