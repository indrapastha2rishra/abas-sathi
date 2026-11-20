# ABAS SATHI v5.6.3 — Deployment Guide (বাংলা)

1. এই ZIP-এর source backup রাখুন; সরাসরি production-এর উপর overwrite করবেন না।
2. GitHub staging branch-এ source upload/merge করুন।
3. Local/CI: `npm ci` → `npm test` → `npm run lint` → `npm run build`; সব PASS না হলে production deploy করবেন না।
4. `apps_script/Code.gs` Apps Script project-এ update করে **New deployment/version** দিন। Existing deployment URL unchanged রাখতে deployment manage/edit করে নতুন version select করুন (যদি আপনার setup-এ সম্ভব হয়)।
5. staging Society Code এবং test resident/accountant/admin account দিয়ে login, society isolation, disabled account, wrong password, password reset, session expiry পরীক্ষা করুন।
6. Browser console-এর `ABAS SATHI login timing` log থেকে `frontendLoginMs`, `backendAuthMs`, `backendLookupMs`, `backendPasswordVerifyMs` তুলনা করুন। কোনো identifier/credential/token log করবেন না।
7. 20 warm + 10 cold attempts, desktop/mobile networks-এ latency record করুন। 1-second target বাস্তব ফল দিয়ে যাচাই না হওয়া পর্যন্ত claim করবেন না।
8. সব যাচাই শেষে production deploy; সমস্যা হলে আগের GitHub build এবং Apps Script deployment version-এ rollback।

এই patch Google Apps Script + Sheets platform-এ 1 সেকেন্ড login নিশ্চিত করে না।
