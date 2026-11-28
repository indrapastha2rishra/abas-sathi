/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Home,
  Printer,
} from 'lucide-react';
import { NoticeMaster } from '../../types/database';
import { NoticeDetailModal } from '../modals/NoticeDetailModal';
import { OwnershipOutstandingPrintModal } from '../modals/OwnershipOutstandingPrintModal';
import { formatDateDisplay, getMonthShortName } from '../../utils/dateFormat';
import { readFundBalanceCache, writeFundBalanceCache } from '../../utils/localDataCache';
import {
  computeOwnershipOutstandingClient,
  getFloorMeta,
  groupOwnershipOutstandingByFloor,
  toReportAmount,
  toReportDateKey,
} from '../../utils/reportHelpers';
import {
  buildActiveGalleryEvents,
  computeDashboardFundSummary,
  computeDashboardInvoiceSummary,
  computeTotalOutstandingCollection,
  DASHBOARD_DONUT_CIRCUMFERENCE,
  filterActiveNotices,
  resolveDashboardFY,
  sortOwnershipOutstandingByFlatAsc,
} from '../../utils/dashboardHelpers';

export const AdminDashboard: React.FC = () => {
  const {
    properties,
    owners,
    ownerships,
    currentUser,
    invoices,
    receipts,
    expenses,
    bankAccounts,
    activityRequests,
    billAllocations,
    rates,
    tenants,
    preventiveMaintenance,
    financialYears,
    notices,
    gallery,
    galleryPhotos,
    societySettings,
    getPrivateFile,
    t,
    setActiveTab,
    getFundBalanceSummary,
    hasPermission,
    activeRole,
    actualRole,
    isResidentMode,
    isRefreshingData,
    toggleResidentMode,
  } = useApp();
  const sessionInfo = (() => {
    try { return JSON.parse(localStorage.getItem('abasSathiSession') || '{}'); } catch { return {}; }
  })();
  const [fundBalanceSummary,setFundBalanceSummary]=useState<any>(() => readFundBalanceCache(sessionInfo.societyCode, sessionInfo.user?.userId));
  const [residentModeNotice, setResidentModeNotice] = useState<string>('');
  const [showOwnershipPrintModal, setShowOwnershipPrintModal] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<NoticeMaster | null>(null);
  const [noticeAttachmentError, setNoticeAttachmentError] = useState('');

  const downloadNoticeAttachment = async (fileId: string, fileName: string) => {
    setNoticeAttachmentError('');
    if (/^https?:\/\//i.test(fileId)) {
      const a = document.createElement('a');
      a.href = fileId;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }
    try {
      const r: any = await getPrivateFile(fileId);
      const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || r.data.fileName || 'notice-attachment';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setNoticeAttachmentError(err?.message || 'Unable to download attachment.');
    }
  };
  useEffect(()=>{if(!['Admin','Accountant','Committee'].includes(currentUser.Role)||activeRole==='Resident'||isRefreshingData)return;let live=true;getFundBalanceSummary().then((r:any)=>{if(live && r?.data){setFundBalanceSummary(r.data);writeFundBalanceCache(sessionInfo.societyCode, sessionInfo.user?.userId, r.data);}}).catch((e:any)=>console.warn('Fund balance summary unavailable:',e?.message||e));return()=>{live=false;};},[currentUser.Role,activeRole,isRefreshingData]);

  // Metrics
  const totalProperties = properties.length;
  const occupiedProperties = properties.filter((p) => String(p.Occupancy_Status || '').trim().toLowerCase() !== 'vacant').length;
  const today = new Date();
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayKey = localDateKey(today);
  const isActiveTenant = (tenant: any) => {
    if (String(tenant.Status || '').trim().toLowerCase() !== 'active') return false;
    const start = toReportDateKey(tenant.Occupancy_Start_Date);
    const end = toReportDateKey(tenant.Occupancy_End_Date);
    return (!start || start <= todayKey) && (!end || end >= todayKey);
  };
  const tenantPropertyIds = new Set(tenants.filter(isActiveTenant).map((t: any) => String(t.PropertyID || '')).filter(Boolean));
  const tenantProperties = tenantPropertyIds.size;

  const occupancyRate = totalProperties > 0 ? ((occupiedProperties / totalProperties) * 100).toFixed(1) : '0';
  const tenantRate = totalProperties > 0 ? ((tenantProperties / totalProperties) * 100).toFixed(1) : '0';

  // Active Financial Year resolved from server/Financial Year Master with Indian FY fallback.
  const activeFYRange = useMemo(
    () =>
      resolveDashboardFY({
        todayKey,
        financialYears,
        serverFy: fundBalanceSummary?.fy,
      }),
    [todayKey, financialYears, fundBalanceSummary?.fy]
  );
  const financialYearLabel = activeFYRange.fyName;

  // Dashboard financial metrics match InvoicesView (Net_Charge_Amount - SUM(Allocated_Amount from Bill Wise Details by InvoiceID)).
  const {
    totalOutstanding,
    maintenanceBilled,
    maintenanceCollected,
    maintenanceOutstanding,
    maintenanceCollectionRate,
    maintenanceInvoiceCount,
    maintenancePaidCount,
    maintenancePartialCount,
    maintenanceUnpaidCount,
    maintenanceOverdueCount,
    maintenanceDonutSegments,
  } = useMemo(
    () =>
      computeDashboardInvoiceSummary({
        invoices,
        receipts,
        billAllocations,
        rates,
        periodStart: activeFYRange.startDate,
        periodEnd: activeFYRange.endDate,
      }),
    [invoices, receipts, billAllocations, rates, activeFYRange.startDate, activeFYRange.endDate]
  );

  // Last six calendar months: actual confirmed receipts from Fund Inflow Register.
  const toAmount = toReportAmount;
  const toLocalDateKey = toReportDateKey;
  const now = new Date();
  const confirmedReceipts = receipts.filter(
    (rec) => String(rec.Receipt_Status || (rec as any).Status || '').trim().toLowerCase() === 'confirmed'
  );
  const collectionTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const startKey = localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    const endKey = localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
    let count = 0;
    const collected = confirmedReceipts
      .filter((rec) => {
        const key = toLocalDateKey(rec.Date_Of_Received);
        const match = /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= startKey && key < endKey;
        if (match) count += 1;
        return match;
      })
      .reduce((sum, rec) => sum + toAmount(rec.Received_Amount), 0);
    return { month: `${getMonthShortName(monthDate.getMonth())}-${monthDate.getFullYear()}`, collected, count };
  });
  const maxMonthlyCollection = Math.max(1, ...collectionTrend.map(item => item.collected));
  const sixMonthTotalCollection = collectionTrend.reduce((sum, item) => sum + item.collected, 0);
  const averageMonthlyCollection = sixMonthTotalCollection / collectionTrend.length;

  const totalOutstandingSummary = useMemo(
    () =>
      computeTotalOutstandingCollection({
        invoices,
        billAllocations,
        receipts,
      }),
    [invoices, billAllocations, receipts]
  );

  const fundSummary = useMemo(
    () =>
      computeDashboardFundSummary({
        fyRange: activeFYRange,
        fundBalanceSummary,
        receipts,
        expenses,
        invoices,
        billAllocations,
        bankAccounts,
        totalOutstanding: totalOutstandingSummary.outstandingCollection,
      }),
    [activeFYRange, fundBalanceSummary, receipts, expenses, invoices, billAllocations, bankAccounts, totalOutstandingSummary.outstandingCollection]
  );

  const ownershipOutstanding = useMemo(
    () =>
      computeOwnershipOutstandingClient({
        invoices,
        receipts,
        billAllocations,
        ownerships,
        properties,
        owners,
      }),
    [invoices, receipts, billAllocations, ownerships, properties, owners]
  );
  const sortedOwnershipOutstandingRows = useMemo(
    () => sortOwnershipOutstandingByFlatAsc(ownershipOutstanding.data),
    [ownershipOutstanding.data]
  );
  const ownershipFloorSummary = useMemo(
    () => groupOwnershipOutstandingByFloor(ownershipOutstanding.data, properties),
    [ownershipOutstanding.data, properties]
  );
  const recentRequests = [...activityRequests]
    .sort((a, b) => String(b.Updated_At || b.Request_Date || b.Created_At || '').localeCompare(String(a.Updated_At || a.Request_Date || a.Created_At || '')))
    .slice(0, 4);
  const scheduledMaintenance = [...preventiveMaintenance]
    .filter(item => !['Completed', 'Cancelled'].includes(String(item.Maintenance_Status || '')))
    .sort((a, b) => toLocalDateKey(a.Next_Service_Date).localeCompare(toLocalDateKey(b.Next_Service_Date)))
    .slice(0, 5);
  const activeNotices = useMemo(
    () => filterActiveNotices(notices, todayKey),
    [notices, todayKey]
  );
  const activeGalleryEvents = useMemo(
    () => buildActiveGalleryEvents(gallery, galleryPhotos),
    [gallery, galleryPhotos]
  );
  const [galleryPhotoSources, setGalleryPhotoSources] = useState<Record<string, string>>({});
  const [selectedPhotoIdxByEvent, setSelectedPhotoIdxByEvent] = useState<Record<string, number>>({});
  const attemptedPhotoRefsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const refsToLoad: string[] = [];
    const directUpdates: Record<string, string> = {};

    activeGalleryEvents.forEach(({ photos }) => {
      photos.forEach((photo) => {
        const ref = photo.ref;
        if (!ref) return;
        if (/^(https?:\/\/|data:|blob:|\/)/i.test(ref)) {
          if (!galleryPhotoSources[ref]) directUpdates[ref] = ref;
        } else if (!attemptedPhotoRefsRef.current.has(ref)) {
          attemptedPhotoRefsRef.current.add(ref);
          refsToLoad.push(ref);
        }
      });
    });

    if (Object.keys(directUpdates).length > 0 && !cancelled) {
      setGalleryPhotoSources((prev) => ({ ...prev, ...directUpdates }));
    }

    if (refsToLoad.length === 0) return () => { cancelled = true; };

    const loadPrivatePhotos = async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        refsToLoad.map(async (ref) => {
          try {
            const res: any = await getPrivateFile(ref);
            if (res?.data?.base64 && res?.data?.mimeType) {
              resolved[ref] = `data:${res.data.mimeType};base64,${res.data.base64}`;
            }
          } catch {
            // Keep clean placeholder if private photo cannot be loaded
          }
        })
      );
      if (!cancelled && Object.keys(resolved).length > 0) {
        setGalleryPhotoSources((prev) => ({ ...prev, ...resolved }));
      }
    };

    void loadPrivatePhotos();
    return () => {
      cancelled = true;
    };
  }, [activeGalleryEvents]);

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
          {['Committee', 'Accountant'].includes(actualRole) && (
            <button
              onClick={() => {
                const ok = toggleResidentMode();
                if (!ok) {
                  setResidentModeNotice('Resident View চালু করতে User Master-এ আপনার user account-এর সঙ্গে current PropertyID ও Ownership_ID link করতে হবে।');
                } else {
                  setResidentModeNotice('');
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25 transition-colors shadow-xs cursor-pointer"
            >
              <Home className="h-4 w-4" />
              <span>{isResidentMode ? 'Staff Mode' : 'View as Resident'}</span>
            </button>
          )}
          {hasPermission('Maintenance & Invoices','Can_Create') && <button
            onClick={() => setActiveTab('invoices_generate')}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#536B4D] hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Generate Invoice</span>
          </button>}
          {hasPermission('Payments','Can_Create') && <button
            onClick={() => setActiveTab('payments_record')}
            className="flex items-center gap-1.5 rounded-xl bg-[#C97958] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#A95D3E] transition-colors shadow-xs cursor-pointer"
          >
            <Receipt className="h-4 w-4" />
            <span>Record Payment</span>
          </button>}
        </div>
      </div>

      {residentModeNotice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
          <span>{residentModeNotice}</span>
          <button onClick={() => setResidentModeNotice('')} className="text-amber-700 hover:underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* 4 Core KPIs from Section 10 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Properties */}
        {hasPermission('Properties & Residents','Can_View') && <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
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
            <span className="font-semibold text-[#536B4D]">Active records: {properties.filter(p => String(p.Property_Status || '').trim().toLowerCase() === 'active').length}</span>
          </div>
        </div>}

        {/* 2. Occupancy Rate */}
        {hasPermission('Properties & Residents','Can_View') && <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
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
        </div>}

        {/* 3. Tenant Rate */}
        {hasPermission('Tenant Management','Can_View') && <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
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
        </div>}

        {/* 4. Maintenance Collection Rate */}
        {hasPermission('Maintenance & Invoices','Can_View') && <div data-testid="kpi-maintenance-collection-rate" className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#29352D]/70">{t.statCollectionRate}</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#29352D] mt-2">{maintenanceCollectionRate}%</p>
          <p className="text-[11px] text-[#29352D]/70 mt-1">
            ₹{maintenanceCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })} / ₹{maintenanceBilled.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({financialYearLabel})
          </p>
          <p className="text-xs text-amber-700 font-semibold mt-0.5">
            Total Outstanding: ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>}
      </div>

      {/* Fund Summary (Items 5 to 9) - Financial Year wise */}
      {hasPermission('Reports','Can_View') && <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-4">
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
          {hasPermission('Bank Accounts','Can_View') && <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F4EC] border border-[#E8E1D4] font-medium text-[11px] text-[#29352D]">
              <Landmark className="h-3.5 w-3.5 text-[#536B4D]" />
              {bankAccounts.length} bank accounts
            </span>
          </div>}
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
              {fundBalanceSummary?.sourceStatus || 'Opening balance from Fund Balance Register'}
            </p>
            {hasPermission('Reports', 'Can_Create') && actualRole === 'Admin' && (
              <button
                onClick={() => setActiveTab('reports_year_end')}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-[#536B4D] hover:underline cursor-pointer"
              >
                <span>Fund Balance Register</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
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
              ₹{fundSummary.outstandingCollection.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
            <div className="mt-1 text-[10px] text-amber-700 font-medium">
              <span>Total Invoice Register − Bill Wise Details</span>
            </div>
            <p className="text-[10px] text-amber-600 mt-0.5">
              Invoice ₹{totalOutstandingSummary.totalInvoiceRegister.toLocaleString('en-IN', { maximumFractionDigits: 2 })} − Bill Wise ₹{totalOutstandingSummary.totalBillWiseDetails.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>}

      {/* Row 3: Status Donut Chart & Collection Trend Bar Chart */}
      {(hasPermission('Maintenance & Invoices','Can_View') || hasPermission('Payments','Can_View') || hasPermission('Fund Inflow','Can_View')) && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5. Maintenance Status Donut Breakdown */}
        {hasPermission('Maintenance & Invoices','Can_View') && <div data-testid="dashboard-maintenance-status" className="lg:col-span-5 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E1D4] pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#29352D]">
                  Maintenance Status / রক্ষণাবেক্ষণ অবস্থা
                </h3>
                <p className="text-xs text-gray-500">
                  Invoice_Register · Bill Wise Details · Fund Inflow ({financialYearLabel})
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{maintenanceInvoiceCount} Invoices</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('invoices_register')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#536B4D] hover:underline cursor-pointer"
                >
                  <span>Invoices</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
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
                  {maintenanceDonutSegments.map((seg) =>
                    seg.count > 0 ? (
                      <circle
                        key={seg.status}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="12"
                        strokeDasharray={`${seg.length} ${DASHBOARD_DONUT_CIRCUMFERENCE}`}
                        strokeDashoffset={String(seg.offset)}
                      />
                    ) : null
                  )}
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-bold text-[#29352D]">{maintenanceCollectionRate}%</span>
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
                  <span className="font-bold text-emerald-900">{maintenancePaidCount}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-blue-50">
                  <span className="flex items-center gap-1.5 text-blue-800 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                    Partially Paid
                  </span>
                  <span className="font-bold text-blue-900">{maintenancePartialCount}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50">
                  <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                    Unpaid
                  </span>
                  <span className="font-bold text-amber-900">{maintenanceUnpaidCount}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-red-50">
                  <span className="flex items-center gap-1.5 text-red-800 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#C97958]"></span>
                    Overdue
                  </span>
                  <span className="font-bold text-red-900">{maintenanceOverdueCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E8E1D4] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span>Billed: <strong className="text-[#29352D]">₹{maintenanceBilled.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
            <span>Paid: <strong className="text-emerald-700">₹{maintenanceCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
            <span>Due: <strong className="text-red-700">₹{maintenanceOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></span>
          </div>
        </div>}

        {/* 6. Maintenance Collection Trend – Last 6 Months */}
        {(hasPermission('Payments','Can_View') || hasPermission('Fund Inflow','Can_View') || hasPermission('Maintenance & Invoices','Can_View')) && <div className="lg:col-span-7 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E1D4] pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#29352D]">
                Collection Trend – Last 6 Months / বিগত ৬ মাসের আদায়
              </h3>
              <p className="text-xs text-gray-500">
                Confirmed receipts recorded in Fund Inflow Register ({confirmedReceipts.length} total confirmed)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#536B4D]">
                6M Total ₹{Math.round(sixMonthTotalCollection).toLocaleString('en-IN')} · Avg ₹{Math.round(averageMonthlyCollection).toLocaleString('en-IN')}
              </span>
              {hasPermission('Payments', 'Can_View') && (
                <button
                  onClick={() => setActiveTab('payments_receipts')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#536B4D] hover:underline cursor-pointer"
                >
                  <span>Fund Inflow</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
                    title={`Confirmed receipts (${item.count}): ₹${item.collected.toLocaleString('en-IN')}`}
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
              <span className="h-2.5 w-2.5 rounded-sm bg-[#E8E1D4]"></span> Fund Inflow Register monthly total
            </span>
          </div>
        </div>}
      </div>}

      {/* Row 3: 7. Ownership-wise Outstanding Report */}
      {(hasPermission('Reports', 'Can_View') || hasPermission('Maintenance & Invoices', 'Can_View')) && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E1D4] pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#C97958]" />
                7. Ownership-wise Outstanding / মালিকানার মেয়াদভিত্তিক বকেয়া রিপোর্ট
              </h3>
              <p className="text-xs text-gray-500">
                Total Outstanding:{' '}
                <strong className="text-red-700">
                  ₹{Number(ownershipOutstanding.summary.totalOutstanding || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>{' '}
                across {ownershipOutstanding.summary.ownershipCount} ownership record(s) • Net_Charge_Amount − Bill Wise Details (Invoice &amp; Owner wise)
                {ownershipOutstanding.summary.unlinkedInvoiceCount > 0
                  ? ` • ${ownershipOutstanding.summary.unlinkedInvoiceCount} unlinked invoice(s)`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 no-print">
              <button
                type="button"
                onClick={() => setShowOwnershipPrintModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#536B4D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3F523A] transition-colors shadow-2xs cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print/Download PDF</span>
              </button>
              {hasPermission('Reports', 'Can_View') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('reports_ownership_due')}
                  className="text-xs font-bold text-[#536B4D] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  View Complete Ownership Outstanding <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {ownershipFloorSummary.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[#536B4D]">By Floor:</span>
              {ownershipFloorSummary.map((grp) => (
                <span
                  key={grp.floorKey}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E1D4] bg-[#F7F4EC] px-2.5 py-1 text-[11px]"
                >
                  <span className="font-bold text-[#29352D]">{grp.floorLabel}:</span>
                  <span className="font-bold text-red-700">
                    ₹{grp.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-gray-500">({grp.ownershipCount})</span>
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4EC] text-[#29352D]">
                <tr>
                  <th className="px-3 py-2.5 font-bold">Ownership ID</th>
                  <th className="px-3 py-2.5 font-bold">PropertyID / Flat</th>
                  <th className="px-3 py-2.5 font-bold">Floor</th>
                  <th className="px-3 py-2.5 font-bold">Owner</th>
                  <th className="px-3 py-2.5 font-bold">Ownership Period</th>
                  <th className="px-3 py-2.5 font-bold text-right">Pending Invoices</th>
                  <th className="px-3 py-2.5 font-bold text-right text-red-700">Outstanding</th>
                  <th className="px-3 py-2.5 font-bold text-right" title="Pending duration in months from oldest unpaid bill">Due month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {sortedOwnershipOutstandingRows.slice(0, 8).map((r, i) => {
                  const pendingCount = Number(r.Pending_Invoice_Count ?? r.Invoice_Count ?? 0);
                  const dueMonths = Number(r.Due_Months || 0);
                  return (
                    <tr key={`${r.Ownership_ID}-${r.PropertyID}-${i}`} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-gray-600">{r.Ownership_ID}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-[#536B4D]">{r.Flat_No || r.PropertyID}</span>
                        {r.PropertyID && r.Flat_No && r.PropertyID !== r.Flat_No && (
                          <span className="block text-[10px] font-mono text-gray-500">{r.PropertyID}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-700">{getFloorMeta(r.Floor_No).floorLabel}</td>
                      <td className="px-3 py-2.5 font-medium text-[#29352D]">{r.Owner_Name || r.OwnerID || '—'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                        {formatDateDisplay(r.Ownership_Start_Date, '—')} to {formatDateDisplay(r.Ownership_End_Date, 'Current')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{pendingCount}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-red-700">
                        ₹{Number(r.Outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right whitespace-nowrap text-gray-700"
                        title={r.Oldest_Pending_Date ? `Oldest pending bill: ${formatDateDisplay(r.Oldest_Pending_Date, '')}` : undefined}
                      >
                        {dueMonths > 0
                          ? `${dueMonths} ${dueMonths === 1 ? 'month' : 'months'}`
                          : pendingCount > 0
                            ? '< 1 month'
                            : '—'}
                      </td>
                    </tr>
                  );
                })}
                {sortedOwnershipOutstandingRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                      No outstanding ownership dues found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sortedOwnershipOutstandingRows.length > 8 && (
            <p className="mt-3 text-[11px] text-gray-500 no-print">
              Showing top 8 of {sortedOwnershipOutstandingRows.length} ownership record(s) sorted by Flat No.
            </p>
          )}
        </div>
      )}

      {/* Row 4: 8. Recent Activity & 9. Preventive Maintenance Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 8. Recent Activity / Audit Log */}
        {hasPermission('Activity Requests','Can_View') && <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
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
                    <span className="text-[10px] text-gray-500">{formatDateDisplay(request.Updated_At || request.Request_Date, '—')}</span>
                  </div>
                  <p className="text-[#29352D]/80 mt-0.5">{request.Subject || request.Description}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Status: {request.Request_Status || 'Pending'} • Priority: {request.Priority || 'Normal'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* 9. Preventive Maintenance Progress */}
        {hasPermission('Preventive Maintenance','Can_View') && <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
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
                  <span className="font-semibold text-[#536B4D]">Next: {formatDateDisplay(asset.Next_Service_Date, '—')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>}
      </div>

      {/* Row 5: 10. Active Notices & Active Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Notices (Notice Master) */}
        {hasPermission('Notices','Can_View') && <div data-testid="dashboard-active-notices" className="lg:col-span-6 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#536B4D]" />
              Active Notices / সক্রিয় নোটিশ
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
              {activeNotices.length} Active
            </span>
          </div>

          <div className="space-y-3">
            {activeNotices.length === 0 && (
              <p className="text-xs text-gray-500 py-4 text-center">No active notices at present.</p>
            )}
            {activeNotices.slice(0, 5).map((notice) => (
              <button
                key={notice.Notice_ID}
                type="button"
                onClick={() => {
                  setNoticeAttachmentError('');
                  setSelectedNotice(notice);
                }}
                className="w-full text-left p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] hover:border-[#536B4D] hover:bg-[#F7F4EC]/80 transition-colors cursor-pointer group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
                      {notice.Notice_Category || 'General'}
                    </span>
                    {notice.Notice_Number && (
                      <span className="text-[10px] font-mono text-gray-500">{notice.Notice_Number}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {formatDateDisplay(notice.Publish_Date, '—')}
                    {notice.Expiry_Date ? ` · Valid till ${formatDateDisplay(notice.Expiry_Date, '—')}` : ''}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#29352D] mt-1.5 group-hover:text-[#536B4D] transition-colors">
                  {notice.Notice_Title}
                </h4>
                <p className="text-xs text-[#29352D]/80 line-clamp-2 mt-1">{notice.Notice_Description}</p>
                <span className="mt-1.5 inline-block text-[11px] font-semibold text-[#536B4D] group-hover:underline">
                  Read full notice →
                </span>
              </button>
            ))}
          </div>
        </div>}

        {/* Active Gallery (Gallery Master + Gallery_Photos) */}
        {hasPermission('Gallery','Can_View') && <div data-testid="dashboard-active-gallery" className="lg:col-span-6 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#536B4D]" />
              Active Gallery / সক্রিয় গ্যালারি
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
              {activeGalleryEvents.length} Active
            </span>
          </div>

          {activeGalleryEvents.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">No active gallery events at present.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeGalleryEvents.slice(0, 4).map(({ event, photos }) => {
                const rawIdx = selectedPhotoIdxByEvent[event.Gallery_ID] || 0;
                const activeIdx = photos.length > 0 ? Math.min(rawIdx, photos.length - 1) : 0;
                const currentPhoto = photos[activeIdx];
                const currentSrc = currentPhoto
                  ? galleryPhotoSources[currentPhoto.ref] ||
                    (/^(https?:\/\/|data:|blob:|\/)/i.test(currentPhoto.ref) ? currentPhoto.ref : '')
                  : '';
                return (
                  <div key={event.Gallery_ID} className="group rounded-xl overflow-hidden border border-[#E8E1D4] bg-white flex flex-col">
                    <div className="relative h-36 bg-[#F7F4EC] overflow-hidden">
                      {currentSrc ? (
                        <img
                          src={currentSrc}
                          alt={currentPhoto?.caption || event.Event_Name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-gray-400 text-[11px] gap-1">
                          <ImageIcon className="h-6 w-6 text-[#536B4D]/40" />
                          <span>{photos.length > 0 ? 'Loading photo…' : 'No photos attached'}</span>
                        </div>
                      )}
                      {photos.length > 0 && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/65 text-white text-[10px] font-semibold">
                          {activeIdx + 1} / {photos.length}
                        </span>
                      )}
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/65 text-white text-[10px]">
                        {formatDateDisplay(event.Event_Date, '—')}
                      </span>
                    </div>

                    {photos.length > 1 && (
                      <div className="flex items-center gap-1.5 px-2.5 pt-2 overflow-x-auto">
                        {photos.map((photo, idx) => {
                          const thumbSrc =
                            galleryPhotoSources[photo.ref] ||
                            (/^(https?:\/\/|data:|blob:|\/)/i.test(photo.ref) ? photo.ref : '');
                          return (
                            <button
                              key={photo.photoId}
                              type="button"
                              onClick={() =>
                                setSelectedPhotoIdxByEvent((prev) => ({
                                  ...prev,
                                  [event.Gallery_ID]: idx,
                                }))
                              }
                              aria-label={`View photo ${idx + 1} for ${event.Event_Name}`}
                              className={`h-9 w-11 shrink-0 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                                idx === activeIdx ? 'border-[#536B4D]' : 'border-[#E8E1D4] opacity-75 hover:opacity-100'
                              }`}
                            >
                              {thumbSrc ? (
                                <img src={thumbSrc} alt={photo.caption || event.Event_Name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-[#F7F4EC] flex items-center justify-center">
                                  <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="p-2.5 bg-white flex-1">
                      <p className="text-xs font-bold text-[#29352D] truncate">{event.Event_Name}</p>
                      {(currentPhoto?.caption || event.Event_Description) && (
                        <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">
                          {currentPhoto?.caption || event.Event_Description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </div>

      <NoticeDetailModal
        notice={selectedNotice}
        onClose={() => setSelectedNotice(null)}
        onDownloadAttachment={downloadNoticeAttachment}
        downloadError={noticeAttachmentError}
      />

      <OwnershipOutstandingPrintModal
        isOpen={showOwnershipPrintModal}
        onClose={() => setShowOwnershipPrintModal(false)}
        floorGroups={ownershipFloorSummary}
        totalOutstanding={Number(ownershipOutstanding.summary.totalOutstanding || 0)}
        ownershipCount={Number(ownershipOutstanding.summary.ownershipCount || sortedOwnershipOutstandingRows.length)}
        unlinkedInvoiceCount={Number(ownershipOutstanding.summary.unlinkedInvoiceCount || 0)}
        printedDate={todayKey}
        societyName={societySettings.societyName || t.apartmentName}
        societyAddress={societySettings.societyAddress}
        societyRegistrationNo={societySettings.societyRegistrationNo}
      />
    </div>
  );
};
