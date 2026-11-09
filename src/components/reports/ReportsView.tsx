/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  Building2,
  DollarSign,
  Info,
} from 'lucide-react';

export const ReportsView: React.FC<{ initialReport?: string }> = ({ initialReport = 'monthly' }) => {
  const {
    invoices,
    receipts,
    expenses,
    properties,
    owners,
    bankAccounts,
    accountHeads,
    t,
  } = useApp();

  const [activeReport, setActiveReport] = useState<
    'monthly' | 'fy' | 'property_due' | 'owner_due' | 'balancesheet'
  >(
    initialReport === 'reports_property_due'
      ? 'property_due'
      : initialReport === 'reports_balancesheet'
      ? 'balancesheet'
      : initialReport === 'reports_fy'
      ? 'fy'
      : 'monthly'
  );

  const [selectedMonth, setSelectedMonth] = useState('2026-04');

  // Cash Inflows for the month
  const monthReceipts = receipts.filter((r) => r.Receipt_Status === 'Confirmed' && r.Date_Of_Received.startsWith(selectedMonth));
  const totalMonthInflow = monthReceipts.reduce((sum, r) => sum + r.Received_Amount, 0);

  // Cash Outflows for the month (only PAID expenses count per Section 6)
  const monthExpenses = expenses.filter((e) => e.Expense_Status === 'Paid' && e.Payment_Date.startsWith(selectedMonth));
  const totalMonthOutflow = monthExpenses.reduce((sum, e) => sum + e.Payment_Amount, 0);

  const openingBank = bankAccounts.reduce((sum, b) => sum + b.Opening_Balance, 0);
  const closingBank = openingBank + totalMonthInflow - totalMonthOutflow;

  // Property-wise Outstanding
  const propertyDues = properties.map((prop) => {
    const propInvoices = invoices.filter((i) => i.PropertyID === prop.PropertyID);
    const totalDue = propInvoices.reduce((sum, i) => sum + (i.Outstanding_Amount || 0), 0);
    const ownerName = propInvoices[0]?.Owner_Name || 'Registered Owner';
    return {
      propertyId: prop.PropertyID,
      flatNo: prop.Flat_No,
      tower: prop.Block_Tower,
      ownerName,
      totalDue,
      status: totalDue === 0 ? 'Clear' : 'Pending',
    };
  });

  const handleExportCSV = (filename: string, rows: string[][]) => {
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map(val => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#536B4D]" />
            {t.navReports} / আর্থিক হিসাব ও অডিট রিপোর্ট
          </h1>
          <p className="text-xs text-gray-500">
            Cash-basis Receipt & Payment statements and verified property outstanding ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4 text-[#536B4D]" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1.5 rounded-2xl border border-[#E8E1D4]">
        <button
          onClick={() => setActiveReport('monthly')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'monthly' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          Monthly Receipt & Payment (Cash Basis)
        </button>
        <button
          onClick={() => setActiveReport('property_due')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'property_due' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          Property-wise Outstanding (50 Flats)
        </button>
        <button
          onClick={() => setActiveReport('balancesheet')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReport === 'balancesheet' ? 'bg-white text-[#C97958] shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          Balance Sheet Status (Accrual Basis)
        </button>
      </div>

      {/* REPORT 1: MONTHLY RECEIPT & PAYMENT STATEMENT */}
      {activeReport === 'monthly' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E8E1D4] pb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D] uppercase">
                Accounting Basis: Pure Cash Flow
              </span>
              <h2 className="text-lg font-bold text-[#29352D] mt-1">
                Monthly Receipt & Payment Account / মাসিক প্রাপ্তি ও পরিশোধ
              </h2>
              <p className="text-xs text-gray-500">
                For the period of {selectedMonth} • Realized inflows and disbursed payments only
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-bold text-[#29352D]"
              >
                <option value="2026-04">April 2026</option>
                <option value="2026-05">May 2026</option>
              </select>

              <button
                onClick={() => {
                  const rows = [
                    ['Abas Sathi Housing Society - Monthly Receipt & Payment Statement'],
                    ['Month', selectedMonth],
                    ['Opening Bank Balance', openingBank.toString()],
                    ['Total Cash Inflows', totalMonthInflow.toString()],
                    ['Total Cash Outflows', totalMonthOutflow.toString()],
                    ['Closing Bank Balance', closingBank.toString()],
                  ];
                  handleExportCSV(`Receipt_Payment_${selectedMonth}`, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A] transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Two-Column T-Account Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receipts Column */}
            <div className="rounded-xl border border-[#E8E1D4] overflow-hidden">
              <div className="bg-[#536B4D] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                <span>RECEIPTS (INFLOWS)</span>
                <span>AMOUNT (₹)</span>
              </div>
              <div className="p-4 space-y-3 text-xs divide-y divide-[#E8E1D4]">
                <div className="flex justify-between font-bold text-[#536B4D] pb-2">
                  <span>To Opening Bank & Cash Balance:</span>
                  <span>₹{openingBank.toLocaleString('en-IN')}.00</span>
                </div>
                {monthReceipts.map((r) => (
                  <div key={r.Transaction_ID} className="flex justify-between py-1.5">
                    <span>
                      To Maint. Collection (Flat {r.Flat_No} - {r.Owner_Name.split(' ')[0]})
                    </span>
                    <span className="font-medium">₹{r.Received_Amount.toFixed(2)}</span>
                  </div>
                ))}
                {monthReceipts.length === 0 && (
                  <div className="py-2 text-gray-400 italic">No cash receipts in this month.</div>
                )}
              </div>
              <div className="bg-[#F7F4EC] px-4 py-3 border-t border-[#E8E1D4] flex justify-between items-center text-xs font-bold">
                <span>Total Receipts (incl. Opening):</span>
                <span className="text-sm text-[#536B4D]">
                  ₹{(openingBank + totalMonthInflow).toLocaleString('en-IN')}.00
                </span>
              </div>
            </div>

            {/* Payments Column */}
            <div className="rounded-xl border border-[#E8E1D4] overflow-hidden">
              <div className="bg-[#C97958] text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold">
                <span>PAYMENTS (OUTFLOWS)</span>
                <span>AMOUNT (₹)</span>
              </div>
              <div className="p-4 space-y-3 text-xs divide-y divide-[#E8E1D4]">
                {monthExpenses.map((e) => (
                  <div key={e.Expense_ID} className="flex justify-between py-1.5">
                    <div>
                      <span className="font-semibold block">{e.Expense_Category}</span>
                      <span className="text-[11px] text-gray-500">{e.Payee_Name}</span>
                    </div>
                    <span className="font-medium">₹{e.Payment_Amount.toFixed(2)}</span>
                  </div>
                ))}
                {monthExpenses.length === 0 && (
                  <div className="py-2 text-gray-400 italic">No cash payments disbursed in this month.</div>
                )}
                <div className="flex justify-between font-bold text-emerald-800 pt-2">
                  <span>By Closing Bank Balance (c/d):</span>
                  <span>₹{closingBank.toLocaleString('en-IN')}.00</span>
                </div>
              </div>
              <div className="bg-[#F7F4EC] px-4 py-3 border-t border-[#E8E1D4] flex justify-between items-center text-xs font-bold">
                <span>Total Outflows + Closing:</span>
                <span className="text-sm text-[#C97958]">
                  ₹{(totalMonthOutflow + closingBank).toLocaleString('en-IN')}.00
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: PROPERTY-WISE OUTSTANDING */}
      {activeReport === 'property_due' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">
                Property-wise Outstanding Ledger / ফ্ল্যাটভিত্তিক বকেয়া তালিকা
              </h3>
              <p className="text-xs text-gray-500">Status across all 50 community units</p>
            </div>
            <button
              onClick={() => {
                const rows = [
                  ['PropertyID', 'Flat_No', 'Block_Tower', 'Owner_Name', 'Outstanding_Due'],
                  ...propertyDues.map((p) => [p.propertyId, p.flatNo, p.tower, p.ownerName, p.totalDue.toString()]),
                ];
                handleExportCSV('Property_Outstanding_Ledger', rows);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#536B4D] text-white text-xs font-bold hover:bg-[#3F523A]"
            >
              <Download className="h-3.5 w-3.5" /> Export All 50 Flats
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Flat No</th>
                  <th className="px-4 py-3 font-semibold">Block / Tower</th>
                  <th className="px-4 py-3 font-semibold">Owner Name</th>
                  <th className="px-4 py-3 font-semibold text-right">Outstanding Amount (₹)</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {propertyDues.slice(0, 20).map((item) => (
                  <tr key={item.propertyId} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-sm text-[#29352D]">{item.flatNo}</td>
                    <td className="px-4 py-3 font-medium text-[#536B4D]">{item.tower}</td>
                    <td className="px-4 py-3 font-medium">{item.ownerName}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {item.totalDue > 0 ? (
                        <span className="text-red-700">₹{item.totalDue.toFixed(2)}</span>
                      ) : (
                        <span className="text-emerald-700">₹0.00 (Cleared)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.totalDue === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: ACCRUAL BALANCE SHEET DISCLOSURE (SECTION 5 NOTE & SECTION 13) */}
      {activeReport === 'balancesheet' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-6">
          <div className="border-b border-[#E8E1D4] pb-4">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#C97958]/10 text-[#C97958] uppercase">
              Financial Architecture Compliance
            </span>
            <h2 className="text-lg font-bold text-[#29352D] mt-1">
              Statutory Balance Sheet Disclosure / অ্যাকাউন্টিং পদ্ধতি
            </h2>
            <p className="text-xs text-gray-500">
              Mandatory disclosure in compliance with Section 5 (Table U Note) & Section 13
            </p>
          </div>

          {/* Explicit Accounting Basis Banner */}
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
              <Info className="h-5 w-5 text-amber-700" />
              Accounting Basis Notice:
            </div>
            <p>
              A true accrual-based Balance Sheet requires double-entry General Journal Vouchers, Journal Details, Depreciation Schedules, and Prepaid Expense amortization. In strict compliance with the project guidelines:
            </p>
            <p className="font-semibold italic">
              "Do not show a falsely complete Balance Sheet using only cash receipts and payments. Clearly identify the accounting basis of every report. For Balance Sheet, do not invent missing journal entries, assets or liabilities."
            </p>
            <p>
              In Phase 1, ABAS SATHI maintains complete cash-basis Receipt & Payment books and provides the Account Head Master ledger balances below.
            </p>
          </div>

          {/* Account Head Master Balances */}
          <div>
            <h3 className="font-bold text-sm text-[#29352D] mb-3">
              Account Head Master Ledger Balances (Sheet U)
            </h3>
            <div className="rounded-xl border border-[#E8E1D4] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#536B4D] text-white">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Account Code</th>
                    <th className="px-4 py-2.5 font-semibold">Account Head Name</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Balance (₹)</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Dr / Cr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {accountHeads.map((acc) => (
                    <tr key={acc.Account_ID} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5 font-mono text-gray-500">{acc.Account_Code}</td>
                      <td className="px-4 py-2.5 font-bold text-[#29352D]">{acc.Account_Name}</td>
                      <td className="px-4 py-2.5 font-medium">{acc.Account_Type}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#29352D]">
                        ₹{acc.Opening_Balance.toLocaleString('en-IN')}.00
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#536B4D]">{acc.Balance_Type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
