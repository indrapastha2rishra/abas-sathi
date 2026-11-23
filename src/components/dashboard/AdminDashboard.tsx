/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
    currentUser,
    invoices,
    receipts,
    expenses,
    bankAccounts,
    activityRequests,
    billAllocations,
    tenants,
    preventiveMaintenance,
    notices,
    gallery,
    t,
    setActiveTab,
    setPreviewInvoice,
    setPreviewReceipt,
    getFundBalanceSummary,
  } = useApp();
  const [fundBalanceSummary,setFundBalanceSummary]=useState<any>(null);
  useEffect(()=>{if(!['Admin','Accountant'].includes(currentUser.Role))return;let live=true;getFundBalanceSummary().then((r:any)=>{if(live)setFundBalanceSummary(r?.data||null);}).catch((e:any)=>console.warn('Fund balance summary unavailable:',e?.message||e));return()=>{live=false;};},[]);

  // Metrics
  const totalProperties = properties.length;
  const occupiedProperties = properties.filter((p) => p.Occupancy_Status !== 'Vacant').length;
  const today = new Date();
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayKey = localDateKey(today);
  const isActiveTenant = (tenant: any) => {
    if (String(tenant.Status || '').trim().toLowerCase() !== 'active') return false;
    const start = String(tenant.Occupancy_Start_Date || '').slice(0, 10);
    const end = String(tenant.Occupancy_End_Date || '').slice(0, 10);
    return (!start || start <= todayKey) && (!end || end >= todayKey);
  };
  const tenantPropertyIds = new Set(tenants.filter(isActiveTenant).map((t: any) => String(t.PropertyID || '')).filter(Boolean));
  const tenantProperties = tenantPropertyIds.size;

  const occupancyRate = totalProperties > 0 ? ((occupiedProperties / totalProperties) * 100).toFixed(1) : '0';
  const tenantRate = totalProperties > 0 ? ((tenantProperties / totalProperties) * 100).toFixed(1) : '0';

  // Dashboard financial metrics use confirmed Fund Inflow + Bill Wise Details as the
  // allocation ledger. Legacy invoices with no allocation rows fall back to Paid_Amount.
  const confirmedTransactionIds = new Set(receipts
    .filter(r => String(r.Receipt_Status || '').trim().toLowerCase() === 'confirmed')
    .map(r => String(r.Transaction_ID || '')));
  const allocationsByInvoice = new Map<string, number>();
  billAllocations.forEach(row => {
    if (!confirmedTransactionIds.has(String(row.Transaction_ID || ''))) return;
    const invoiceId = String(row.InvoiceID || '');
    if (invoiceId) allocationsByInvoice.set(invoiceId, (allocationsByInvoice.get(invoiceId) || 0) + Number(row.Allocated_Amount || 0));
  });
  const issuedInvoices = invoices.filter(inv => !['Cancelled', 'Draft', 'Pending_Approval', 'Pending Approval'].includes(String(inv.Invoice_Status || '')));
  const invoiceMetrics = issuedInvoices.map(inv => {
    const allocated = allocationsByInvoice.get(String(inv.InvoiceID || ''));
    const net = Number(inv.Net_Charge_Amount || 0);
    const paid = Math.min(net, Math.max(0, allocated !== undefined ? allocated : Number(inv.Paid_Amount || 0)));
    const due = Math.max(0, net - paid);
    const status = due <= 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : (String(inv.Due_Date || '').slice(0,10) < todayKey ? 'Overdue' : 'Unpaid');
    return { ...inv, Paid_Amount: paid, Outstanding_Amount: due, Invoice_Status: status };
  });
  const totalBilled = issuedInvoices.reduce((sum, inv) => sum + Number(inv.Net_Charge_Amount || 0), 0);
  const totalCollected = invoiceMetrics.reduce((sum, inv) => sum + Number(inv.Paid_Amount || 0), 0);
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '0';
  const paidCount = invoiceMetrics.filter(i => i.Invoice_Status === 'Paid').length;
  const partialCount = invoiceMetrics.filter(i => i.Invoice_Status === 'Partially Paid').length;
  const unpaidCount = invoiceMetrics.filter(i => i.Invoice_Status === 'Unpaid').length;
  const overdueCount = invoiceMetrics.filter(i => i.Invoice_Status === 'Overdue').length;

  // Flats with outstanding dues

  // Last six calendar months: actual confirmed receipts only.
  const now = new Date();
  const collectionTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const startKey = localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    const endKey = localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
    const inRange = (value: string) => {
      const key = String(value || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= startKey && key < endKey;
    };
    const collected = receipts
      .filter(rec => String(rec.Receipt_Status || '').trim().toLowerCase() === 'confirmed' && inRange(rec.Date_Of_Received))
      .reduce((sum, rec) => sum + Number(rec.Received_Amount || 0), 0);
    return { month: monthDate.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), collected };
  });
  const maxMonthlyCollection = Math.max(1, ...collectionTrend.map(item => item.collected));
  const averageMonthlyCollection = collectionTrend.reduce((sum, item) => sum + item.collected, 0) / collectionTrend.length;

  // Current Indian financial year (1 April – 31 March).
  const financialYearStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const financialYearLabel = `FY ${financialYearStart}-${financialYearStart + 1}`;
  // Authoritative opening balance is read from Fund Balance Register on the server.
  // Never derive FY opening from Bank Account Master once the register is configured.
  const openingBalanceTotal = Number(fundBalanceSummary?.openingFundBalance ?? 0);
  const fundSummary = calculateFundSummary({
    openingBalance: openingBalanceTotal, receipts, expenses, invoices,
    startDate: `${financialYearStart}-04-01`, endDate: `${financialYearStart + 1}-03-31`,
  });

  // Bill Wise Details is the allocation ledger. Only confirmed receipt allocations
  // reduce invoice dues. Legacy invoices without allocation rows use Paid_Amount.
  // Reuse the confirmed-receipt allocation map built above.
  const outstandingRows = invoiceMetrics
    .filter(inv => inv.Outstanding_Amount > 0)
    .sort((a, b) => String(a.Due_Date || '').localeCompare(String(b.Due_Date || '')));
  const totalOutstanding = outstandingRows.reduce((sum, inv) => sum + inv.Outstanding_Amount, 0);
  fundSummary.outstandingCollection = totalOutstanding;
  const recentRequests = [...activityRequests]
    .sort((a, b) => String(b.Updated_At || b.Request_Date || b.Created_At || '').localeCompare(String(a.Updated_At || a.Request_Date || a.Created_At || '')))
    .slice(0, 4);
  const scheduledMaintenance = [...preventiveMaintenance]
    .filter(item => !['Completed', 'Cancelled'].includes(String(item.Maintenance_Status || '')))
    .sort((a, b) => String(a.Next_Service_Date || '').localeCompare(String(b.Next_Service_Date || '')))
    .slice(0, 5);
  const activeNotices = notices
    .filter(notice => {
      const status = String(notice.Notice_Status || '').trim().toLowerCase();
      const publish = String(notice.Publish_Date || '').slice(0, 10);
      const expiry = String(notice.Expiry_Date || '').slice(0, 10);
      return status === 'published' && (!publish || publish <= todayKey) && (!expiry || expiry >= todayKey);
    })
    .sort((a, b) => String(b.Publish_Date || '').localeCompare(String(a.Publish_Date || '')));

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#536B4D] to-[#3F523A] p-6 text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-xs">
              {financialYearLabel}
            </span>
            <span className="text-xs text-white/80">Society Management Overview</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {t.apartmentName}
          </h1>
          <p className="text-xs text-white/80 mt-0.5">
            {t.tagline} • Live society overview.
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
            <span className="font-semibold text-[#536B4D]">Blocks: {new Set(properties.map(p => p.Block_Tower).filter(Boolean)).size}</span>
            <span>•</span>
            <span className="font-semibold text-[#536B4D]">Active records: {properties.filter(p => p.Property_Status === 'Active').length}</span>
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
            {tenantProperties} flats with active tenant records
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
                {financialYearLabel}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {t.fundSummarySubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F4EC] border border-[#E8E1D4] font-medium text-[11px] text-[#29352D]">
              <Landmark className="h-3.5 w-3.5 text-[#536B4D]" />
              {bankAccounts.length} bank accounts
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
              Opening balances from Bank Account Master
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
              <p className="text-xs text-gray-500">Confirmed receipts recorded in Fund Inflow Register</p>
            </div>
            <span className="text-xs font-semibold text-[#536B4D]">6-month average ₹{Math.round(averageMonthlyCollection).toLocaleString('en-IN')}</span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 pt-6 pb-2 h-48 border-b border-[#E8E1D4]">
            {collectionTrend.map((item) => (
              <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group">
                <span className="text-[10px] font-bold text-[#29352D] group-hover:text-[#536B4D] transition-colors">
                  ₹{Math.round(item.collected).toLocaleString('en-IN')}
                </span>
                <div className="w-full max-w-[36px] bg-[#E8E1D4] rounded-t-lg h-32 flex flex-col justify-end p-0.5">
                  <div
                    className="w-full bg-[#536B4D] rounded-t-md transition-all group-hover:bg-[#3F523A]"
                    style={{ height: `${item.collected > 0 ? Math.max(3, (item.collected / maxMonthlyCollection) * 100) : 0}%` }}
                    title={`Confirmed receipts: ₹${item.collected.toLocaleString('en-IN')}`}
                  ></div>
                </div>
                <span className="text-[10px] font-medium text-[#29352D]/70">{item.month}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#536B4D]"></span> Confirmed Collection
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#E8E1D4]"></span> Monthly receipt amount
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
              Total Outstanding: <strong className="text-red-700">₹{totalOutstanding.toLocaleString('en-IN')}</strong> across {outstandingRows.length} active invoices
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
              {outstandingRows.slice(0, 5).map((inv) => (
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
              onClick={() => setActiveTab('requests_all')}
              className="text-xs text-[#536B4D] font-bold hover:underline"
            >
              All Requests
            </button>
          </div>

          <div className="space-y-3">
            {recentRequests.length === 0 && <p className="text-xs text-gray-500">No society activity requests found.</p>}
            {recentRequests.map((request) => (
              <div
                key={request.Request_ID}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs"
              >
                <div className="p-1.5 rounded-lg bg-white shrink-0 border border-[#E8E1D4]">
                  <FileText className="h-3.5 w-3.5 text-[#536B4D]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#29352D]">
                      {request.Request_Number || request.Request_ID} • {request.Request_Category}
                    </span>
                    <span className="text-[10px] text-gray-500">{String(request.Updated_At || request.Request_Date || '').slice(0, 10)}</span>
                  </div>
                  <p className="text-[#29352D]/80 mt-0.5">{request.Subject || request.Description}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Status: {request.Request_Status || 'Pending'} • Priority: {request.Priority || 'Normal'}</p>
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
            {scheduledMaintenance.length === 0 && <p className="text-xs text-gray-500">No upcoming preventive maintenance is scheduled.</p>}
            {scheduledMaintenance.map((asset) => (
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
            <span className="text-xs text-gray-500">{activeNotices.length} Active</span>
          </div>

          <div className="space-y-3">
            {activeNotices.length === 0 && <p className="text-xs text-gray-500">No active notices at present.</p>}
            {activeNotices.slice(0, 3).map((notice) => (
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
