/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Receipt,
  PlusCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Calendar,
  Image as ImageIcon,
  FileText,
  Landmark,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { calculateFundSummary } from '../../utils/calculations';

export const AdminDashboard: React.FC = () => {
  const {
    properties,
    invoices,
    receipts,
    expenses,
    bankAccounts,
    auditLogs,
    preventiveMaintenance,
    notices,
    gallery,
    t,
    setActiveTab,
    setPreviewInvoice,
    setPreviewReceipt,
  } = useApp();

  // Metrics
  const totalProperties = properties.length;
  const occupiedProperties = properties.filter((p) => p.Occupancy_Status !== 'Vacant').length;
  const tenantProperties = properties.filter((p) => p.Occupancy_Status === 'Tenant Occupied').length;

  const occupancyRate = totalProperties > 0 ? ((occupiedProperties / totalProperties) * 100).toFixed(1) : '0';
  const tenantRate = totalProperties > 0 ? ((tenantProperties / totalProperties) * 100).toFixed(1) : '0';

  // Invoice breakdown
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.Net_Charge_Amount, 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + (inv.Paid_Amount || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.Outstanding_Amount || 0), 0);
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '0';

  const paidCount = invoices.filter((i) => i.Invoice_Status === 'Paid').length;
  const partialCount = invoices.filter((i) => i.Invoice_Status === 'Partially Paid').length;
  const unpaidCount = invoices.filter((i) => i.Invoice_Status === 'Unpaid').length;
  const overdueCount = invoices.filter((i) => i.Invoice_Status === 'Overdue').length;

  // Flats with outstanding dues
  const overdueInvoices = invoices.filter((i) => i.Outstanding_Amount > 0);

  // Six-month collection data (historical simulation)
  const collectionTrend = [
    { month: 'Dec 25', billed: 154000, collected: 148000, percent: 96 },
    { month: 'Jan 26', billed: 154000, collected: 151000, percent: 98 },
    { month: 'Feb 26', billed: 154000, collected: 142000, percent: 92 },
    { month: 'Mar 26', billed: 154000, collected: 153000, percent: 99 },
    { month: 'Apr 26', billed: 158000, collected: 145000, percent: 91 },
    { month: 'May 26', billed: 158000, collected: 89000, percent: 56 },
  ];

  // Financial Year Fund Summary (Items 5 to 9)
  const openingBalanceTotal = bankAccounts.reduce((sum, b) => sum + (b.Opening_Balance || 0), 0);
  const fundSummary = calculateFundSummary({
    openingBalance: openingBalanceTotal,
    receipts,
    expenses,
    invoices,
    startDate: '2026-04-01',
    endDate: '2027-03-31',
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#536B4D] to-[#3F523A] p-6 text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-xs">
              FY 2026-2027
            </span>
            <span className="text-xs text-white/80">Kolkata Municipal Corp Ward 93</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {t.apartmentName}
          </h1>
          <p className="text-xs text-white/80 mt-0.5">
            {t.tagline} • Managing 50 residential units across 2 blocks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('invoices_generate')}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#536B4D] hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Generate Invoice</span>
          </button>
          <button
            onClick={() => setActiveTab('payments_record')}
            className="flex items-center gap-1.5 rounded-xl bg-[#C97958] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#A95D3E] transition-colors shadow-xs cursor-pointer"
          >
            <Receipt className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* 4 Core KPIs from Section 10 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Properties */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29352D]/70">{t.statTotalProperties}</span>
            <div className="p-2 rounded-xl bg-[#536B4D]/10 text-[#536B4D]">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#29352D] mt-2">{totalProperties}</p>
          <div className="flex items-center gap-1.5 text-xs text-[#29352D]/70 mt-1">
            <span className="font-semibold text-[#536B4D]">Block A: 25</span>
            <span>•</span>
            <span className="font-semibold text-[#536B4D]">Block B: 25</span>
          </div>
        </div>

        {/* 2. Occupancy Rate */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29352D]/70">{t.statOccupancyRate}</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#29352D] mt-2">{occupancyRate}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {occupiedProperties} occupied flats ({totalProperties - occupiedProperties} vacant)
          </p>
        </div>

        {/* 3. Tenant Rate */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29352D]/70">{t.statTenantRate}</span>
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#29352D] mt-2">{tenantRate}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {tenantProperties} rented flats (Police verified)
          </p>
        </div>

        {/* 4. Maintenance Collection Rate */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29352D]/70">{t.statCollectionRate}</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#29352D] mt-2">{collectionRate}%</p>
          <p className="text-xs text-amber-700 font-semibold mt-1">
            Total Outstanding: ₹{totalOutstanding.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Fund Summary (Items 5 to 9) - Financial Year wise */}
      <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E1D4] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#536B4D]"></span>
              <h2 className="text-sm font-bold text-[#29352D] tracking-tight">
                {t.fundSummaryTitle}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
                FY 2026-2027
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.fundSummarySubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F4EC] border border-[#E8E1D4] font-medium text-[11px] text-[#29352D]">
              <Landmark className="h-3.5 w-3.5 text-[#536B4D]" />
              SBI Op A/c & HDFC Sinking Fund
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 5. Opening Fund Balance */}
          <div className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] p-4 transition-all hover:border-[#536B4D]/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#29352D]/80">{t.statOpeningFundBalance}</span>
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-[#29352D] mt-2">
              ₹{fundSummary.openingFundBalance.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
              <span>{t.statOpeningFundDesc}</span>
            </div>
            <p className="text-[10px] text-[#536B4D] font-medium mt-0.5">
              SBI ₹4.85L + HDFC ₹12.50L
            </p>
          </div>

          {/* 6. Total Fund Received */}
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4 transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-900">{t.statTotalFundReceived}</span>
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-emerald-900 mt-2">
              ₹{fundSummary.totalFundReceived.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 text-[10px] text-emerald-700 font-medium">
              <span>{t.statTotalFundReceivedDesc}</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              Realized maintenance collections
            </p>
          </div>

          {/* 7. Total Fund Utilized */}
          <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-4 transition-all hover:border-red-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-red-900">{t.statTotalFundUtilized}</span>
              <div className="p-1.5 rounded-lg bg-red-100 text-red-800">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-red-900 mt-2">
              ₹{fundSummary.totalFundUtilized.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 text-[10px] text-red-700 font-medium">
              <span>{t.statTotalFundUtilizedDesc}</span>
            </div>
            <p className="text-[10px] text-red-600 mt-0.5">
              Verified & paid vouchers
            </p>
          </div>

          {/* 8. Available Fund (Opening + Received − Paid) */}
          <div className="rounded-xl border-2 border-[#536B4D] bg-[#536B4D]/5 p-4 shadow-2xs transition-all hover:bg-[#536B4D]/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#536B4D]">{t.statAvailableFund}</span>
              <div className="p-1.5 rounded-lg bg-[#536B4D] text-white">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-[#536B4D] mt-2">
              ₹{fundSummary.availableFund.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 text-[10px] text-[#29352D]/80 font-semibold">
              <span>{t.statAvailableFundDesc}</span>
            </div>
            <p className="text-[10px] text-[#536B4D] font-medium mt-0.5">
              Net society liquid balance
            </p>
          </div>

          {/* 9. Outstanding Collection */}
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-4 transition-all hover:border-amber-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-900">{t.statOutstandingCollection}</span>
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xl font-bold text-amber-900 mt-2">
              ₹{fundSummary.outstandingCollection.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 text-[10px] text-amber-700 font-medium">
              <span>{t.statOutstandingCollectionDesc}</span>
            </div>
            <p className="text-[10px] text-amber-600 mt-0.5">
              Unrealized flat dues (FY 26-27)
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Status Donut Chart & Collection Trend Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5. Maintenance Status Donut Breakdown */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D]">
              Maintenance Status / রক্ষণাবেক্ষণ অবস্থা
            </h3>
            <span className="text-xs text-gray-500">{invoices.length} Invoices</span>
          </div>

          {/* Graphical Donut Representation */}
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-4">
            <div className="relative flex items-center justify-center">
              <svg className="h-36 w-36 -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#E8E1D4"
                  strokeWidth="12"
                />
                {/* Paid slice */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#536B4D"
                  strokeWidth="12"
                  strokeDasharray={`${(paidCount / (invoices.length || 1)) * 238.7} 238.7`}
                  strokeDashoffset="0"
                />
                {/* Overdue slice */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#C97958"
                  strokeWidth="12"
                  strokeDasharray={`${(overdueCount / (invoices.length || 1)) * 238.7} 238.7`}
                  strokeDashoffset={`-${(paidCount / (invoices.length || 1)) * 238.7}`}
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-bold text-[#29352D]">{collectionRate}%</span>
                <span className="block text-[10px] text-gray-500 uppercase">Settled</span>
              </div>
            </div>

            {/* Legend & counts */}
            <div className="space-y-2 text-xs w-full max-w-[180px]">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50">
                <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#536B4D]"></span>
                  Paid
                </span>
                <span className="font-bold text-emerald-900">{paidCount}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-blue-50">
                <span className="flex items-center gap-1.5 text-blue-800 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                  Partially Paid
                </span>
                <span className="font-bold text-blue-900">{partialCount}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50">
                <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  Unpaid
                </span>
                <span className="font-bold text-amber-900">{unpaidCount}</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-red-50">
                <span className="flex items-center gap-1.5 text-red-800 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C97958]"></span>
                  Overdue
                </span>
                <span className="font-bold text-red-900">{overdueCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Maintenance Collection Trend – Last 6 Months */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#29352D]">
                Collection Trend – Last 6 Months / বিগত ৬ মাসের আদায়
              </h3>
              <p className="text-xs text-gray-500">Monthly billing vs actual realized collections</p>
            </div>
            <span className="text-xs font-semibold text-[#536B4D]">Average 95.2%</span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 pt-6 pb-2 h-48 border-b border-[#E8E1D4]">
            {collectionTrend.map((item) => (
              <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[10px] font-bold text-[#29352D] group-hover:text-[#536B4D] transition-colors">
                  {item.percent}%
                </span>
                <div className="w-full max-w-[36px] bg-[#E8E1D4] rounded-t-lg h-32 flex flex-col justify-end p-0.5">
                  <div
                    className="w-full bg-[#536B4D] rounded-t-md transition-all group-hover:bg-[#3F523A]"
                    style={{ height: `${item.percent}%` }}
                    title={`Realized: ₹${item.collected.toLocaleString('en-IN')} of ₹${item.billed.toLocaleString('en-IN')}`}
                  ></div>
                </div>
                <span className="text-[10px] font-medium text-[#29352D]/70">{item.month}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#536B4D]"></span> Realized Collection
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#E8E1D4]"></span> Total Billed
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: 7. Outstanding Maintenance Charges Total & Flat-wise Details */}
      <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E1D4] pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#C97958]" />
              7. Outstanding Charges / বকেয়া রক্ষণাবেক্ষণ বিবরণী
            </h3>
            <p className="text-xs text-gray-500">
              Total Outstanding: <strong className="text-red-700">₹{totalOutstanding.toLocaleString('en-IN')}</strong> across {overdueInvoices.length} active invoices
            </p>
          </div>
          <button
            onClick={() => setActiveTab('invoices_outstanding')}
            className="text-xs font-bold text-[#536B4D] hover:underline flex items-center gap-1"
          >
            View Complete Outstanding Register <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F4EC] text-[#29352D]">
              <tr>
                <th className="px-3 py-2.5 font-bold">Invoice No</th>
                <th className="px-3 py-2.5 font-bold">Flat No</th>
                <th className="px-3 py-2.5 font-bold">Owner Name</th>
                <th className="px-3 py-2.5 font-bold">Due Date</th>
                <th className="px-3 py-2.5 font-bold text-right">Net Bill</th>
                <th className="px-3 py-2.5 font-bold text-right">Paid</th>
                <th className="px-3 py-2.5 font-bold text-right text-red-700">Outstanding</th>
                <th className="px-3 py-2.5 font-bold text-center">Status</th>
                <th className="px-3 py-2.5 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E1D4]">
              {overdueInvoices.slice(0, 5).map((inv) => (
                <tr key={inv.InvoiceID} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{inv.Invoice_Number}</td>
                  <td className="px-3 py-2.5 font-bold text-[#536B4D]">{inv.Flat_Number}</td>
                  <td className="px-3 py-2.5">{inv.Owner_Name}</td>
                  <td className="px-3 py-2.5 text-gray-500">{inv.Due_Date}</td>
                  <td className="px-3 py-2.5 text-right font-medium">₹{inv.Net_Charge_Amount.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">₹{inv.Paid_Amount.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-red-700">₹{inv.Outstanding_Amount.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.Invoice_Status === 'Overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inv.Invoice_Status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => setPreviewInvoice(inv)}
                      className="text-xs font-semibold text-[#536B4D] hover:underline cursor-pointer"
                    >
                      View Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: 8. Recent Activity & 9. Preventive Maintenance Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 8. Recent Activity / Audit Log */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#536B4D]" />
              Recent Society Activity / সাম্প্রতিক কার্যক্রম
            </h3>
            <button
              onClick={() => setActiveTab('settings_audit')}
              className="text-xs text-[#536B4D] font-bold hover:underline"
            >
              All Logs
            </button>
          </div>

          <div className="space-y-3">
            {auditLogs.slice(0, 4).map((log) => (
              <div
                key={log.Log_ID}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs"
              >
                <div className="p-1.5 rounded-lg bg-white shrink-0 border border-[#E8E1D4]">
                  <FileText className="h-3.5 w-3.5 text-[#536B4D]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#29352D]">
                      {log.Action_Type} • {log.Module_Name}
                    </span>
                    <span className="text-[10px] text-gray-500">{log.Action_DateTime.split(' ')[0]}</span>
                  </div>
                  <p className="text-[#29352D]/80 mt-0.5">{log.New_Value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">By: {log.User_Name || log.UserID}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 9. Preventive Maintenance Progress */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#536B4D]" />
              Preventive Maintenance Schedule / রক্ষণাবেক্ষণ
            </h3>
            <button
              onClick={() => setActiveTab('settings_maintenance')}
              className="text-xs text-[#536B4D] font-bold hover:underline"
            >
              Manage Assets
            </button>
          </div>

          <div className="space-y-3">
            {preventiveMaintenance.map((asset) => (
              <div
                key={asset.Maintenance_ID}
                className="p-3 rounded-xl border border-[#E8E1D4] hover:border-[#536B4D]/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#29352D]">{asset.Asset_Name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      asset.Maintenance_Status === 'Scheduled'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : asset.Maintenance_Status === 'Overdue'
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {asset.Maintenance_Status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Vendor: {asset.Service_Provider}</span>
                  <span className="font-semibold text-[#536B4D]">Next: {asset.Next_Service_Date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: 10. Notices & Community Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Latest Notices */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#536B4D]" />
              Active Notices / বর্তমান নোটিশ
            </h3>
            <span className="text-xs text-gray-500">{notices.length} Published</span>
          </div>

          <div className="space-y-3">
            {notices.slice(0, 3).map((notice) => (
              <div
                key={notice.Notice_ID}
                className="p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
                    {notice.Notice_Category}
                  </span>
                  <span className="text-[10px] text-gray-500">{notice.Publish_Date}</span>
                </div>
                <h4 className="text-xs font-bold text-[#29352D] mt-1.5">{notice.Notice_Title}</h4>
                <p className="text-xs text-[#29352D]/80 line-clamp-2 mt-1">{notice.Notice_Description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Gallery preview */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#536B4D]" />
              Community Gallery / ছবি গ্যালারি
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {gallery.slice(0, 2).map((item) => (
              <div key={item.Gallery_ID} className="group relative rounded-xl overflow-hidden border border-[#E8E1D4]">
                <img
                  src={item.Photo_File_Reference}
                  alt={item.Event_Name}
                  className="h-28 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="p-2 bg-white">
                  <p className="text-[11px] font-bold text-[#29352D] truncate">{item.Event_Name}</p>
                  <p className="text-[9px] text-gray-500">{item.Event_Date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
