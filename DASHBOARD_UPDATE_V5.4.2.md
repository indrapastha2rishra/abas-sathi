# ABAS SATHI v5.4.2 — Dashboard Data Integration

## Updated dashboard sources

1. **Tenant Rate** — `Tenant Master`: counts distinct properties with an Active tenant whose occupancy start/end dates include the current local date. Divides by the dashboard's total property count.
2. **Total Fund Utilized** — `Expense Register`: retains the Financial Year filter and counts only `Expense_Status = Paid` rows, using `Payment_Date` and `Payment_Amount`.
3. **Collection Trend – Last 6 Months** — `Fund Inflow Register`: displays monthly totals of `Received_Amount` for `Receipt_Status = Confirmed`, based on `Date_Of_Received`. Pending, rejected and cancelled receipts are excluded.
4. **Outstanding Charges** — `Invoice_Register` plus `Bill Wise Details`: excludes cancelled/draft/pending-approval invoices; sums allocations linked to confirmed receipts and subtracts them from `Net_Charge_Amount`. For legacy invoices without allocation rows, falls back to `Paid_Amount`.
5. **Recent Society Activity** — `Activity Request Register`: latest requests ordered by Updated_At, then Request_Date / Created_At.
6. **Preventive Maintenance Schedule** — `Preventive Maintenance Master`: upcoming/in-progress items ordered by Next_Service_Date; overdue scheduled items are displayed as Overdue.
7. **Active Notices** — `Notice Master`: only Published notices within Publish_Date / Expiry_Date are shown.

## Backend and permissions

- `getDashboardData_` now includes Tenant Master and Bill Wise Details for non-resident dashboard loads.
- Accountant read access to Activity Request Register is enabled to match the existing role matrix's view permission.
- Resident dashboard payload remains property-scoped; existing resident notice visibility filtering is retained.
- Dashboard module plan now requests the additional datasets through the existing authenticated bootstrap API.

## Deployment

1. Replace the frontend source files in this release with the matching files in your GitHub repository.
2. Deploy the updated `apps_script/Code.gs` to the existing Apps Script project as a new version.
3. Keep the existing Web App deployment URL if updating the existing deployment; update the deployed version.
4. Run `npm install`, `npm run lint`, `npm test`, and `npm run build`.
5. Verify all seven dashboard sections using a test society with confirmed and unconfirmed receipts, Paid and non-Paid expenses, active/vacated tenants, bill allocations, requests, maintenance records and notices with expiry dates.

## Data assumptions / validation notes

- Sheet names follow the application's current backend mapping: `Invoice_Register`, `Fund Inflow Register`, `Bill Wise Details`, `Expense Register`, `Tenant Master`, `Activity Request Register`, `Preventive Maintenance Master`, and `Notice Master`.
- Date fields should be stored as valid Google Sheets dates or ISO `YYYY-MM-DD` values.
- `Bill Wise Details.Transaction_ID` must refer to a `Fund Inflow Register.Transaction_ID`; only confirmed receipts are counted as invoice allocations.
- FY date filtering normalizes Google Sheets ISO date-times to `YYYY-MM-DD`, so transactions on the financial-year end date are included.
- No financial or operational records are written by the dashboard. This update is read-only.
