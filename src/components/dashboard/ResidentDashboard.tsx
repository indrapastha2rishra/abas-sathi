/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateDisplay } from '../../utils/dateFormat';
import { summarizeResidentPortalData } from '../../utils/residentPortalHelpers';
import { useApp } from '../../context/AppContext';
import {
  Home,
  Receipt,
  CreditCard,
  Wrench,
  CheckCircle2,
  Calendar,
  Image as ImageIcon,
  RefreshCw,
  Download,
  AlertCircle,
} from 'lucide-react';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const ResidentDashboard: React.FC = () => {
  const {
    currentUser,
    residentProperty,
    ownerships,
    owners,
    tenants,
    propertyUtilities,
    invoices,
    receipts,
    billAllocations,
    activityRequests,
    notices,
    gallery,
    galleryPhotos,
    getPrivateFile,
    refreshActiveData,
    isRefreshingData,
    t,
    setActiveTab,
    hasPermission,
    setPreviewInvoice,
    setPreviewReceipt,
  } = useApp();

  const summary = useMemo(
    () =>
      summarizeResidentPortalData({
        property: residentProperty,
        ownershipId: currentUser.Ownership_ID,
        userId: currentUser.UserID,
        invoices,
        receipts,
        billAllocations,
        activityRequests,
        ownerships,
        owners,
        tenants,
        propertyUtilities,
        notices,
        gallery,
        galleryPhotos,
      }),
    [
      residentProperty,
      currentUser.Ownership_ID,
      currentUser.UserID,
      invoices,
      receipts,
      billAllocations,
      activityRequests,
      ownerships,
      owners,
      tenants,
      propertyUtilities,
      notices,
      gallery,
      galleryPhotos,
    ]
  );

  const canViewFlat =
    hasPermission('My Flat', 'Can_View') ||
    hasPermission('Properties & Residents', 'Can_View') ||
    hasPermission('Resident Portal', 'Can_View');
  const canViewBills =
    hasPermission('My Bills', 'Can_View') ||
    hasPermission('Maintenance & Invoices', 'Can_View') ||
    hasPermission('Resident Portal', 'Can_View');
  const canPayNow =
    (hasPermission('Pay Now', 'Can_View') && hasPermission('Pay Now', 'Can_Create')) ||
    (hasPermission('Payments', 'Can_View') && hasPermission('Payments', 'Can_Create'));
  const canViewHistory =
    hasPermission('Payment History', 'Can_View') ||
    hasPermission('Payments', 'Can_View') ||
    hasPermission('Fund Inflow', 'Can_View') ||
    hasPermission('Resident Portal', 'Can_View');
  const canViewRequests =
    hasPermission('Activity Requests', 'Can_View') ||
    hasPermission('Resident Portal', 'Can_View');
  const canViewNotices =
    hasPermission('Notices & Gallery', 'Can_View') ||
    hasPermission('Notices', 'Can_View') ||
    hasPermission('Resident Portal', 'Can_View');
  const canViewGallery =
    hasPermission('Notices & Gallery', 'Can_View') ||
    hasPermission('Gallery', 'Can_View') ||
    hasPermission('Resident Portal', 'Can_View');

  const nextDueDate = summary.nextDueDate ? formatDateDisplay(summary.nextDueDate, 'None Pending') : 'None Pending';
  const recentBills = summary.billMetrics.slice(0, 4);
  const recentReceipts = summary.sortedReceipts.slice(0, 4);
  const recentRequests = summary.sortedRequests.slice(0, 2);
  const myProperty = residentProperty;

  const [galleryPhotoSources, setGalleryPhotoSources] = useState<Record<string, string>>({});
  const [noticeError, setNoticeError] = useState('');
  const attemptedRefsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const refsToLoad: string[] = [];
    const directUpdates: Record<string, string> = {};
    summary.activeGalleryEvents.slice(0, 3).forEach(({ photos }) => {
      photos.slice(0, 1).forEach(({ ref }) => {
        if (!ref) return;
        if (/^(https?:\/\/|data:|blob:|\/)/i.test(ref)) {
          if (!galleryPhotoSources[ref]) directUpdates[ref] = ref;
        } else if (!attemptedRefsRef.current.has(ref)) {
          attemptedRefsRef.current.add(ref);
          refsToLoad.push(ref);
        }
      });
    });
    if (Object.keys(directUpdates).length > 0 && !cancelled) {
      setGalleryPhotoSources((prev) => ({ ...prev, ...directUpdates }));
    }
    if (refsToLoad.length === 0) return () => { cancelled = true; };
    const loadPrivate = async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        refsToLoad.map(async (ref) => {
          try {
            const res: any = await getPrivateFile(ref);
            if (res?.data?.base64 && res?.data?.mimeType) {
              resolved[ref] = `data:${res.data.mimeType};base64,${res.data.base64}`;
            }
          } catch {
            // Keep placeholder
          }
        })
      );
      if (!cancelled && Object.keys(resolved).length > 0) {
        setGalleryPhotoSources((prev) => ({ ...prev, ...resolved }));
      }
    };
    void loadPrivate();
    return () => { cancelled = true; };
  }, [summary.activeGalleryEvents]);

  const downloadNoticeAttachment = async (fileId: string, fileName: string) => {
    setNoticeError('');
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
      setNoticeError(err?.message || 'Unable to download attachment.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1) Resident Welcome & My Outstanding Dues Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#536B4D] to-[#3F523A] p-6 text-white shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#C97958] text-white">
              Resident Portal / বাসিন্দা কর্নার
            </span>
            {myProperty ? (
              <span className="text-xs text-white/90 font-medium">
                Flat {myProperty.Flat_No} ({myProperty.Block_Tower || 'Main Block'})
              </span>
            ) : (
              <span className="text-xs text-amber-200 font-medium">Flat linkage pending</span>
            )}
            <button
              type="button"
              onClick={() => void refreshActiveData()}
              disabled={isRefreshingData}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshingData ? 'animate-spin' : ''}`} />
              <span>{isRefreshingData ? 'Syncing…' : 'Sync Sheet'}</span>
            </button>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Welcome, {currentUser.Full_Name || summary.currentOwner?.Owner_Name || 'Resident'}
          </h1>
          <p className="text-xs text-white/80">
            {t.apartmentName}
            {myProperty ? ` • ${myProperty.Block_Tower || 'Block'}, Floor ${myProperty.Floor_No ?? '—'}` : ''}
            {summary.currentOwnership?.Ownership_ID ? ` • Ownership: ${summary.currentOwnership.Ownership_ID}` : ''}
          </p>
        </div>

        {/* 1) My Outstanding Dues Quick Action Card */}
        <div className="rounded-xl bg-white/10 p-4 backdrop-blur-xs border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5 min-w-[280px]">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-white/75 block">My Outstanding Dues</span>
            <span className="text-2xl font-bold text-white block">{money(summary.totalOutstanding)}</span>
            <span className="block text-[11px] text-amber-200">
              Next Due: {nextDueDate}
              {summary.unpaidOrPartialCount > 0 ? ` (${summary.unpaidOrPartialCount} bill${summary.unpaidOrPartialCount > 1 ? 's' : ''})` : ''}
            </span>
            <div className="flex flex-wrap gap-2 pt-0.5 text-[10px]">
              {summary.pendingVerificationCount > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-100 border border-amber-300/30">
                  Pending Verification: {money(summary.pendingVerificationAmount)}
                </span>
              )}
              {summary.advanceCreditTotal > 0 && (
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-100 border border-emerald-300/30">
                  Advance Credit: {money(summary.advanceCreditTotal)}
                </span>
              )}
            </div>
          </div>
          {canPayNow && (
            <button
              onClick={() => setActiveTab('resident_pay')}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#C97958] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#A95D3E] shadow-sm transition-all cursor-pointer shrink-0"
            >
              <CreditCard className="h-4 w-4" />
              <span>Pay Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 1: 2) Flat Information, 3) Billing Summary, 4) Service Requests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2) Flat Information */}
        {canViewFlat && (
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D] flex items-center gap-1.5">
                  <Home className="h-4 w-4" />
                  Flat Information
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {myProperty?.Occupancy_Status || 'Not Linked'}
                </span>
              </div>
              {myProperty ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                    <span className="text-[#29352D]/70">Flat / Floor:</span>
                    <span className="font-bold text-[#29352D]">
                      {myProperty.Flat_No} ({myProperty.Block_Tower}) · Floor {myProperty.Floor_No}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                    <span className="text-[#29352D]/70">Registered Owner:</span>
                    <span className="font-semibold text-[#29352D]">{summary.currentOwner?.Owner_Name || currentUser.Full_Name || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                    <span className="text-[#29352D]/70">Unit Type:</span>
                    <span className="font-semibold text-[#29352D]">{myProperty.Property_Type || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                    <span className="text-[#29352D]/70">Structural / Carpet Area:</span>
                    <span className="font-bold text-[#536B4D]">
                      {myProperty.Structural_Area ?? '—'} / {myProperty.Carpet_Area ?? '—'} Sq.Ft.
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#29352D]/70">Ownership / Property ID:</span>
                    <span className="font-mono text-[11px] text-[#29352D]/80">
                      {summary.currentOwnership?.Ownership_ID || currentUser.Ownership_ID || '—'} · {myProperty.PropertyID}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-4 text-center">No flat profile linked to this account.</p>
              )}
            </div>
            <button
              onClick={() => setActiveTab('resident_flat')}
              className="w-full mt-3 rounded-lg border border-[#E8E1D4] py-1.5 text-xs font-bold text-[#536B4D] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
            >
              View Flat, Utilities & Owner Details
            </button>
          </div>
        )}

        {/* 3) Billing Summary */}
        {canViewBills && (
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D] flex items-center gap-1.5">
                  <Receipt className="h-4 w-4" />
                  Billing Summary
                </span>
                <button
                  onClick={() => setActiveTab('resident_bills')}
                  className="text-xs font-bold text-[#536B4D] hover:underline cursor-pointer"
                >
                  All Bills
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                  <span className="text-[#29352D]/70">Total Billed ({summary.billMetrics.length} Bills):</span>
                  <span className="font-bold text-[#29352D]">{money(summary.totalBilled)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                  <span className="text-[#29352D]/70">Paid (Confirmed Allocations):</span>
                  <span className="font-semibold text-emerald-700">{money(summary.totalPaidAgainstBills)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                  <span className="text-[#29352D]/70">Outstanding Balance:</span>
                  <span className="font-bold text-red-700">{money(summary.totalOutstanding)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
                  <span className="text-[#29352D]/70">Paid / Overdue Bills:</span>
                  <span className="font-semibold text-[#29352D]">
                    <span className="text-emerald-700">{summary.paidBillCount} Paid</span> ·{' '}
                    <span className={summary.overdueCount > 0 ? 'text-red-700 font-bold' : 'text-gray-500'}>
                      {summary.overdueCount} Overdue
                    </span>
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#29352D]/70">Pending Verification Receipts:</span>
                  <span className="font-semibold text-amber-700">
                    {summary.pendingVerificationCount} ({money(summary.pendingVerificationAmount)})
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('resident_reports')}
              className="w-full mt-3 rounded-lg border border-[#E8E1D4] py-1.5 text-xs font-bold text-[#536B4D] hover:bg-[#F7F4EC] transition-colors cursor-pointer"
            >
              Open Statement & My Reports
            </button>
          </div>
        )}

        {/* 4) Service Requests */}
        {canViewRequests && (
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D] flex items-center gap-1.5">
                  <Wrench className="h-4 w-4" />
                  Service Requests
                </span>
                <button
                  onClick={() => setActiveTab('resident_requests')}
                  className="text-xs font-bold text-[#536B4D] hover:underline cursor-pointer"
                >
                  View All ({summary.sortedRequests.length})
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#29352D]">Open Tickets: {summary.openReqCount}</span>
                    <span className="text-[10px] text-gray-500">Total: {summary.sortedRequests.length}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {summary.pendingReqCount} pending · {summary.inProgressReqCount} in progress · {summary.completedReqCount} completed
                  </p>
                </div>

                {recentRequests.length > 0 ? (
                  <div className="space-y-1.5">
                    {recentRequests.map((req) => (
                      <div key={req.Request_ID} className="p-2 rounded-lg border border-[#E8E1D4]/80 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#29352D] truncate">{req.Subject || req.Request_Category}</p>
                          <p className="text-[10px] text-gray-500">
                            {req.Request_Number || req.Request_ID} · {formatDateDisplay(req.Request_Date, '—')}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.Request_Status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.Request_Status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : req.Request_Status === 'Rejected' || req.Request_Status === 'Cancelled'
                              ? 'bg-neutral-200 text-neutral-700'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {req.Request_Status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 py-2">No service requests logged yet.</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('resident_requests')}
              className="w-full mt-3 rounded-lg border border-[#536B4D] py-1.5 text-xs font-bold text-[#536B4D] hover:bg-[#536B4D] hover:text-white transition-colors cursor-pointer"
            >
              + Raise / Track Service Request
            </button>
          </div>
        )}
      </div>

      {/* Row 2: 5) Recent Bills, Payment History & Receipts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        {canViewBills && (
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#536B4D]" />
                Recent Bills / সাম্প্রতিক বিলসমূহ
              </h3>
              <button
                onClick={() => setActiveTab('resident_bills')}
                className="text-xs text-[#536B4D] font-bold hover:underline cursor-pointer"
              >
                View All ({summary.billMetrics.length})
              </button>
            </div>

            <div className="space-y-3">
              {recentBills.map((inv) => (
                <div
                  key={inv.InvoiceID}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#29352D]">{inv.Invoice_Number || inv.InvoiceID}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.Invoice_Status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.Invoice_Status === 'Overdue'
                            ? 'bg-red-100 text-red-800'
                            : inv.Invoice_Status === 'Partially Paid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.Invoice_Status}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-[#29352D]/80 mt-0.5 truncate">{inv.Purpose}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Period: {formatDateDisplay(inv.Bill_Period_From, '—')} to {formatDateDisplay(inv.Bill_Period_To, '—')} · Due {formatDateDisplay(inv.Due_Date, '—')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-sm text-[#29352D] block">₹{Number(inv.Net_Charge_Amount || 0).toFixed(2)}</span>
                    <span className="text-[10px] text-gray-500 block">
                      Paid ₹{Number(inv.Paid_Amount || 0).toFixed(0)} · Due{' '}
                      <strong className={Number(inv.Outstanding_Amount || 0) > 0 ? 'text-red-700' : 'text-emerald-700'}>
                        ₹{Number(inv.Outstanding_Amount || 0).toFixed(0)}
                      </strong>
                    </span>
                    <div className="mt-1">
                      <button
                        onClick={() => setPreviewInvoice(inv as any)}
                        className="text-[11px] font-semibold text-[#536B4D] hover:underline cursor-pointer"
                      >
                        Download Bill
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {recentBills.length === 0 && (
                <p className="text-xs text-gray-500 italic p-4 text-center">No invoices issued for this flat yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Recent Payments & Receipts */}
        {canViewHistory && (
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                Payment History & Receipts / রসিদ
              </h3>
              <button
                onClick={() => setActiveTab('resident_history')}
                className="text-xs text-[#536B4D] font-bold hover:underline cursor-pointer"
              >
                All Receipts ({summary.sortedReceipts.length})
              </button>
            </div>

            <div className="space-y-3">
              {recentReceipts.map((rec) => {
                const statusLower = String(rec.Receipt_Status || '').trim().toLowerCase();
                const isConfirmed = statusLower === 'confirmed';
                const isRejected = statusLower === 'rejected' || statusLower === 'cancelled' || statusLower === 'bounced';
                const linkedAllocs = summary.myAllocations.filter(
                  (a) => String(a.Transaction_ID || '').trim() === String(rec.Transaction_ID || '').trim()
                );
                return (
                  <div
                    key={rec.Transaction_ID}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#E8E1D4] hover:bg-neutral-50 transition-colors text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#29352D]">{rec.Receipt_Number || rec.Transaction_ID}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isRejected
                              ? 'bg-red-50 text-red-800 border-red-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {rec.Receipt_Status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Date: {formatDateDisplay(rec.Date_Of_Received, '—')} • via {rec.Received_Mode}
                        {rec.Received_Reference ? ` • ${rec.Received_Reference}` : ''}
                      </p>
                      {isConfirmed && linkedAllocs.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {linkedAllocs.map((a) => (
                            <span key={a.Allocation_ID} className="rounded-md bg-white border border-[#E8E1D4] px-1.5 py-0.5 text-[10px] text-[#536B4D]">
                              {a.Invoice_Number}: ₹{Number(a.Allocated_Amount || 0).toFixed(2)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold text-sm ${isRejected ? 'text-red-700' : 'text-emerald-800'}`}>
                        {money(Number(rec.Received_Amount || 0))}
                      </span>
                      <div className="mt-1">
                        {isConfirmed && rec.Receipt_Number ? (
                          <button
                            onClick={() => setPreviewReceipt(rec)}
                            className="text-[11px] font-semibold text-[#536B4D] hover:underline cursor-pointer"
                          >
                            View Receipt
                          </button>
                        ) : isRejected ? (
                          <span className="text-[11px] text-red-700">{rec.Receipt_Status}</span>
                        ) : (
                          <span className="text-[11px] text-amber-700">Awaiting verification</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {recentReceipts.length === 0 && (
                <p className="text-xs text-gray-500 italic p-4 text-center">No payment receipts on record yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row 3: 6) Active Notices & 7) Active Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {canViewNotices && (
          <div className={`${canViewGallery ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs`}>
            <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#536B4D]" />
                Active Notices / সক্রিয় নোটিশ
              </h3>
              <button
                onClick={() => setActiveTab('resident_notices')}
                className="text-xs text-[#536B4D] font-bold hover:underline cursor-pointer"
              >
                View All ({summary.activeNotices.length})
              </button>
            </div>

            {noticeError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{noticeError}</span>
              </div>
            )}

            <div className="space-y-3">
              {summary.activeNotices.length === 0 && (
                <p className="text-xs text-gray-500 py-4 text-center">No active notices at present.</p>
              )}
              {summary.activeNotices.slice(0, 3).map((notice) => {
                const attachmentRef = String((notice as any).Attachment_File_ID || notice.Attachment || '').trim();
                return (
                  <div key={notice.Notice_ID} className="p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs">
                    <div className="flex justify-between items-center text-[10px] text-gray-500">
                      <span className="font-bold text-[#536B4D] uppercase">{notice.Notice_Category}</span>
                      <span>
                        Published: {formatDateDisplay(notice.Publish_Date, '—')}
                        {notice.Expiry_Date ? ` · Valid till ${formatDateDisplay(notice.Expiry_Date, '—')}` : ''}
                      </span>
                    </div>
                    <h4 className="font-bold text-[#29352D] mt-1">{notice.Notice_Title}</h4>
                    <p className="text-[#29352D]/80 mt-1 line-clamp-2">{notice.Notice_Description}</p>
                    {attachmentRef && (
                      <button
                        type="button"
                        onClick={() => void downloadNoticeAttachment(attachmentRef, notice.Notice_Title || 'notice-attachment')}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#536B4D] hover:underline cursor-pointer"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download Circular</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {canViewGallery && (
          <div className={`${canViewNotices ? 'lg:col-span-5' : 'lg:col-span-12'} rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs`}>
            <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[#536B4D]" />
                Active Gallery / সক্রিয় গ্যালারি
              </h3>
              <button
                onClick={() => setActiveTab('resident_notices')}
                className="text-xs text-[#536B4D] font-bold hover:underline cursor-pointer"
              >
                View Gallery ({summary.activeGalleryEvents.length})
              </button>
            </div>
            {summary.activeGalleryEvents.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No active gallery events at present.</p>
            ) : (
              <div className="space-y-3">
                {summary.activeGalleryEvents.slice(0, 3).map(({ event, photos }, idx) => {
                  const firstPhoto = photos[0];
                  const src = firstPhoto
                    ? galleryPhotoSources[firstPhoto.ref] || (/^(https?:\/\/|data:|blob:|\/)/i.test(firstPhoto.ref) ? firstPhoto.ref : '')
                    : '';
                  return idx === 0 ? (
                    <div
                      key={event.Gallery_ID}
                      onClick={() => setActiveTab('resident_notices')}
                      className="rounded-xl overflow-hidden border border-[#E8E1D4] cursor-pointer hover:border-[#536B4D]/60 transition-colors"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={firstPhoto?.caption || event.Event_Name}
                          className="h-36 w-full object-cover"
                        />
                      ) : (
                        <div className="h-36 w-full bg-[#F7F4EC] flex items-center justify-center text-gray-400 text-xs">
                          <ImageIcon className="h-5 w-5 text-[#536B4D]/40 mr-1.5" />
                          <span>{photos.length > 0 ? 'Loading photo…' : 'No photos attached'}</span>
                        </div>
                      )}
                      <div className="p-3 bg-[#F7F4EC]">
                        <p className="text-xs font-bold text-[#29352D]">{event.Event_Name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {formatDateDisplay(event.Event_Date, '—')}
                          {photos.length > 0 ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      key={event.Gallery_ID}
                      type="button"
                      onClick={() => setActiveTab('resident_notices')}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] hover:border-[#536B4D]/50 transition-colors cursor-pointer"
                    >
                      {src ? (
                        <img src={src} alt={event.Event_Name} className="h-11 w-14 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-11 w-14 rounded-lg bg-white border border-[#E8E1D4] flex items-center justify-center shrink-0">
                          <ImageIcon className="h-4 w-4 text-[#536B4D]/50" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#29352D] truncate">{event.Event_Name}</p>
                        <p className="text-[10px] text-gray-500">
                          {formatDateDisplay(event.Event_Date, '—')} · {photos.length} photo{photos.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
