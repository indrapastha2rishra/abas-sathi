# Version 5.3.1 → 5.3.2 Migration Guide (বাংলা)

## A. আগে যা করবেন
1. Version 5.3.1 project ZIP সংরক্ষণ করুন।
2. Central Master Spreadsheet ও প্রতিটি Society Database Spreadsheet-এর আলাদা Drive copy নিন।
3. Society database-এর tab names ও header rows পরিবর্তন করবেন না।
4. একটি test society/copy-তে প্রথম migration করুন।

## B. Code deployment
1. ZIP extract করুন।
2. Apps Script project খুলুন।
3. `apps_script/Code.gs` সম্পূর্ণ replace করুন।
4. Project Settings → Script Properties:
   - `CENTRAL_MASTER_SPREADSHEET_ID` = Central Master Spreadsheet ID
   - `DEFAULT_DRIVE_FOLDER_ID` = private central backup root folder ID
5. Society Master-এ প্রতিটি active society-এর `Database_ID` এবং `Drive_Folder_ID` সঠিক আছে নিশ্চিত করুন।
6. `Drive_Folder_ID` এবং default backup root folder অবশ্যই private হতে হবে।
7. Deploy → Manage deployments → Edit → New version → Deploy।
8. নতুন Web App URL frontend Settings-এ দিন।
9. Admin login করে Documents, Master Data CRUD এবং Backup & Restore tabs পরীক্ষা করুন।

## C. নতুন internal sheets
Backend প্রয়োজন অনুযায়ী hidden sheets তৈরি করবে:
- `_Journal Ledger`
- `_Backup Log`
- `_Restore Log`
- `Report Snapshot Register`
- `_File Registry`-তে নতুন metadata columns
- `Owner Master`-এ archive status-এর জন্য `Owner_Status` column (না থাকলে auto-add)
- Central Master-এ `_Backup Log` ও `_Backup Run Log`

এই internal sheets manually delete বা rename করবেন না।

## D. Opening balance migration
Version 5.3.1-এর historical transactions স্বয়ংক্রিয়ভাবে journal ledger-এ রূপান্তরিত হবে না।

1. নির্দিষ্ট go-live date বেছে নিন।
2. Bank statements থেকে প্রতিটি bank account-এর verified opening balance নিন।
3. Outstanding invoice report থেকে মোট receivables নির্ধারণ করুন।
4. Resident advance, payable/liability, reserve/equity এবং অন্যান্য opening balances accountant-এর সঙ্গে reconcile করুন।
5. Admin → Reports → Balance Sheet Status → Opening Balance Entry-তে debit ও credit lines দিন।
6. Total Debit = Total Credit না হলে পোস্ট হবে না।
7. একবার post হলে opening batch immutable; ভুল হলে manual adjustment journal প্রয়োজন (বর্তমান UI-তে adjustment posting নেই)।

## E. Financial workflow test
Test Society-তে:
1. একটি test invoice generate করুন।
2. Pending payment submit করুন।
3. Admin/Accountant confirm করুন।
4. Partial allocation ও unallocated advance যাচাই করুন।
5. একটি expense create করুন।
6. Admin approve করুন।
7. Admin/Accountant Mark Paid করুন।
8. Bank balance, outstanding, journal debit/credit এবং audit log মিলিয়ে দেখুন।
9. Unpaid invoice cancel করে reversal journal যাচাই করুন।

## F. Backup & Restore test
1. Admin → Settings → Backup & Restore → Create Backup Now।
2. Backup History থেকে File ID নোট করুন।
3. Test society-তে Restore চালান।
4. Pre-restore backup ID ও Restore Log যাচাই করুন।
5. Database sheet names, headers, rows এবং hidden internal tabs compare করুন।
6. সব ঠিক থাকলে তবেই production society-তে backup schedule enable করুন।

## G. Automated Backup
- Admin → Settings → Backup & Restore → Enable Daily Backup।
- Trigger আনুমানিক রাত ২টায় Apps Script project timezone অনুযায়ী চলবে।
- Apps Script owner-কে Trigger, Drive ও Spreadsheet permission authorize করতে হবে।
- Central Master ও active society spreadsheets private Drive folder-এ copy হবে।
- `_Backup Run Log`-এ run status পরীক্ষা করুন।

## H. Production Go-Live gate
Live ব্যবহারের আগে অবশ্যই:
- `npm install`, `npm run lint`, `npm test`, `npm run build` actual dependency environment-এ pass।
- GitHub Pages URL/base path যাচাই।
- SO001 ও SO002 cross-society isolation test।
- চারটি role-এর permission test।
- Private file upload/download access test।
- Manual backup এবং restore test pass।
- Accountant/auditor opening balances ও account mapping approve।
