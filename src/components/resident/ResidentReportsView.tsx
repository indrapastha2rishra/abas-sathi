/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import {
  buildResidentStatementLedger,
  summarizeResidentPortalData,
  toResidentStatementCsv,
} from '../../utils/residentPortalHelpers';
import { BarChart3, Download, Printer, RefreshCw, FileText, CreditCard, Home, Wrench, Bell } from 'lucide-react';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

type ReportSection = 'statement' | 'bills' | 'payments' | 'flat' | 'requests';

export const ResidentReportsView: React.FC = () => {
  const {
    currentUser,
    residentProperty,
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
    setPreviewInvoice,
    setPreviewReceipt,
    refreshActiveData,
    isRefreshingData,
  } = useApp();

  const [section, setSection] = useState<ReportSection>('statement');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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

  const ledger = useMemo(
    () =>
      buildResidentStatementLedger(summary.billMetrics, summary.sortedReceipts, {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
    [summary.billMetrics, summary.sortedReceipts, fromDate, toDate]
  );

  const handleExportCsv = () => {
    const csv = toResidentStatementCsv(ledger.rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement-${residentProperty?.Flat_No || residentProperty?.PropertyID || 'flat'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#E8E1D4] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#536B4D]" />
            My Reports & Statement / আমার রিপোর্ট
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Scoped statement of account, confirmed payment adjustments, property & utility records for Flat {residentProperty?.Flat_No || '—'}
            {summary.currentOwnership?.Ownership_ID ? ` (${summary.currentOwnership.Ownership_ID})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => void refreshActiveData()}
            disabled={isRefreshingData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-xs font-semibold text-[#536B4D] hover:bg-[#F7F4EC] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
            <span>{isRefreshingData ? 'Syncing…' : 'Sync'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-[#536B4D]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#536B4D] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#3F523A] cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
          <div className="text-xs text-gray-500">Total Billed</div>
          <div className="mt-1 text-lg font-bold text-[#29352D]">{money(summary.totalBilled)}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{summary.billMetrics.length} invoice(s)</div>
        </div>
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
          <div className="text-xs text-gray-500">Confirmed Received</div>
          <div className="mt-1 text-lg font-bold text-emerald-700">{money(summary.confirmedReceivedTotal)}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{summary.confirmedReceiptsCount} receipt(s)</div>
        </div>
        <div className="rounded-2xl border border-red-100 bg-white p-4">
          <div className="text-xs text-gray-500">Outstanding Dues</div>
          <div className="mt-1 text-lg font-bold text-red-700">{money(summary.totalOutstanding)}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{summary.unpaidOrPartialCount} open bill(s)</div>
        </div>
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
          <div className="text-xs text-gray-500">Advance Credit</div>
          <div className="mt-1 text-lg font-bold text-[#536B4D]">{money(summary.advanceCreditTotal)}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">Unallocated balance</div>
        </div>
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-4">
          <div className="text-xs text-gray-500">Service Requests</div>
          <div className="mt-1 text-lg font-bold text-[#29352D]">{summary.sortedRequests.length}</div>
          <div className="mt-0.5 text-[11px] text-gray-500">{summary.openReqCount} open</div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-[#F7F4EC] p-1.5 rounded-xl border border-[#E8E1D4] no-print">
        {[
          { id: 'statement', label: 'Statement of Account', icon: FileText },
          { id: 'bills', label: `Bills & Allocations (${summary.billMetrics.length})`, icon: FileText },
          { id: 'payments', label: `Payment History (${summary.sortedReceipts.length})`, icon: CreditCard },
          { id: 'flat', label: 'Flat, Ownership & Utilities', icon: Home },
          { id: 'requests', label: `Requests & Notices (${summary.sortedRequests.length}/${summary.activeNotices.length})`, icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id as ReportSection)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                section === tab.id ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70 hover:text-[#29352D]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section 1: Statement of Account */}
      {section === 'statement' && (
        <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E1D4] pb-3">
            <div>
              <h2 className="font-bold text-sm text-[#29352D]">Statement of Account Ledger</h2>
              <p className="text-xs text-gray-500">
                Chronological billing and confirmed payment entries with running balance
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs no-print">
              <label className="flex items-center gap-1 text-gray-600">
                From:
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-lg border border-[#E8E1D4] bg-[#F7F4EC] px-2 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-1 text-gray-600">
                To:
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-lg border border-[#E8E1D4] bg-[#F7F4EC] px-2 py-1 text-xs"
                />
              </label>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="text-xs font-semibold text-[#536B4D] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#F7F4EC] p-3 rounded-xl border border-[#E8E1D4]">
            <div><span className="text-gray-500 block">Opening Balance</span><strong className="text-[#29352D]">{money(ledger.openingBalance)}</strong></div>
            <div><span className="text-gray-500 block">Period Billed (Debit)</span><strong className="text-[#29352D]">{money(ledger.periodDebit)}</strong></div>
            <div><span className="text-gray-500 block">Confirmed Paid (Credit)</span><strong className="text-emerald-700">{money(ledger.periodCredit)}</strong></div>
            <div><span className="text-gray-500 block">Net Closing Balance</span><strong className={ledger.closingBalance > 0 ? 'text-red-700' : 'text-emerald-700'}>{money(ledger.closingBalance)}</strong></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Reference No</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold">Particulars</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Billed (₹)</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Paid (₹)</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Balance (₹)</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {ledger.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 text-gray-600">{formatDateDisplay(row.date, '—')}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[#29352D]">{row.refNo}</td>
                    <td className="px-3 py-2.5">{row.entryType}</td>
                    <td className="px-3 py-2.5 text-gray-700">{row.description}</td>
                    <td className="px-3 py-2.5 text-right">{row.debit > 0 ? money(row.debit) : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700 font-medium">{row.credit > 0 ? money(row.credit) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#29352D]">{money(row.runningBalance)}</td>
                    <td className="px-3 py-2.5 text-center">{row.status}</td>
                  </tr>
                ))}
                {ledger.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-500 italic">
                      No statement entries found in the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 2: Bills & Allocations */}
      {section === 'bills' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-3">
            <h2 className="font-bold text-sm text-[#29352D]">My Invoice Summary (Confirmed Allocations Only)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#536B4D] text-white">
                  <tr>
                    <th className="px-3 py-2.5">Invoice</th>
                    <th className="px-3 py-2.5">Purpose</th>
                    <th className="px-3 py-2.5">Period</th>
                    <th className="px-3 py-2.5">Due Date</th>
                    <th className="px-3 py-2.5 text-right">Net Amount</th>
                    <th className="px-3 py-2.5 text-right">Paid</th>
                    <th className="px-3 py-2.5 text-right">Due</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {summary.billMetrics.map((i) => (
                    <tr key={i.InvoiceID}>
                      <td className="px-3 py-2.5 font-bold text-[#29352D]">{i.Invoice_Number || i.InvoiceID}</td>
                      <td className="px-3 py-2.5">{i.Purpose}</td>
                      <td className="px-3 py-2.5 text-gray-500">{formatDateDisplay(i.Bill_Period_From, '—')} – {formatDateDisplay(i.Bill_Period_To, '—')}</td>
                      <td className="px-3 py-2.5 text-gray-500">{formatDateDisplay(i.Due_Date, '—')}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{money(Number(i.Net_Charge_Amount || 0))}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-700">{money(Number(i.Paid_Amount || 0))}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-red-700">{money(Number(i.Outstanding_Amount || 0))}</td>
                      <td className="px-3 py-2.5 text-center">{i.Invoice_Status}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(i as any)}
                          className="font-semibold text-[#536B4D] hover:underline cursor-pointer"
                        >
                          View Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                  {summary.billMetrics.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500 italic">No invoice records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-3">
            <h2 className="font-bold text-sm text-[#29352D]">Bill-wise Allocation Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F7F4EC] text-[#29352D]">
                  <tr>
                    <th className="px-3 py-2">Allocation ID</th>
                    <th className="px-3 py-2">Invoice No</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Invoice Amt</th>
                    <th className="px-3 py-2 text-right">Allocated</th>
                    <th className="px-3 py-2 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {summary.myAllocations.map((a) => (
                    <tr key={a.Allocation_ID}>
                      <td className="px-3 py-2 font-mono text-gray-500">{a.Allocation_ID}</td>
                      <td className="px-3 py-2 font-semibold">{a.Invoice_Number}</td>
                      <td className="px-3 py-2 text-gray-500">{formatDateDisplay(a.Allocation_Date, '—')}</td>
                      <td className="px-3 py-2 text-right">{money(Number(a.Invoice_Amount || 0))}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-bold">{money(Number(a.Allocated_Amount || 0))}</td>
                      <td className="px-3 py-2 text-right">{money(Number(a.Outstanding_After || 0))}</td>
                    </tr>
                  ))}
                  {summary.myAllocations.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500 italic">No bill-wise allocations on record.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Section 3: Payment History */}
      {section === 'payments' && (
        <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-3">
          <h2 className="font-bold text-sm text-[#29352D]">My Payment History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-3 py-2.5">Receipt / Txn</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Mode & Reference</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-right">Unallocated</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {summary.sortedReceipts.map((r) => {
                  const isConfirmed = String(r.Receipt_Status || '').trim().toLowerCase() === 'confirmed';
                  return (
                    <tr key={r.Transaction_ID}>
                      <td className="px-3 py-2.5 font-bold">{r.Receipt_Number || r.Transaction_ID}</td>
                      <td className="px-3 py-2.5 text-gray-500">{formatDateDisplay(r.Date_Of_Received, '—')}</td>
                      <td className="px-3 py-2.5 font-mono">{r.Received_Mode} · {r.Received_Reference || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{money(Number(r.Received_Amount || 0))}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700">{money(Number(r.Unallocated_Amount || 0))}</td>
                      <td className="px-3 py-2.5 text-center">{r.Receipt_Status}</td>
                      <td className="px-3 py-2.5 text-right">
                        {isConfirmed && r.Receipt_Number ? (
                          <button
                            type="button"
                            onClick={() => setPreviewReceipt(r)}
                            className="font-semibold text-[#536B4D] hover:underline cursor-pointer"
                          >
                            View Receipt
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {summary.sortedReceipts.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500 italic">No payment records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 4: Flat, Ownership & Utilities */}
      {section === 'flat' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-2 text-xs">
            <h2 className="font-bold text-sm text-[#29352D] border-b border-[#E8E1D4] pb-2">Property & Ownership Record</h2>
            <p><strong>Flat:</strong> {residentProperty?.Flat_No || '—'} ({residentProperty?.Block_Tower || '—'}, Floor {residentProperty?.Floor_No ?? '—'})</p>
            <p><strong>Configuration:</strong> {residentProperty?.Property_Type || '—'} · <strong>Occupancy:</strong> {residentProperty?.Occupancy_Status || '—'}</p>
            <p><strong>Areas (Sq.Ft):</strong> Carpet {residentProperty?.Carpet_Area ?? '—'} · Structural {residentProperty?.Structural_Area ?? '—'} · Super Built-up {residentProperty?.Super_Built_up_Area ?? '—'}</p>
            <p><strong>Owner:</strong> {summary.currentOwner?.Owner_Name || currentUser.Full_Name || '—'} ({summary.currentOwner?.Mobile_No || currentUser.Mobile_No || '—'})</p>
            <p><strong>Current Ownership:</strong> {summary.currentOwnership?.Ownership_ID || currentUser.Ownership_ID || '—'} (Deed: {summary.currentOwnership?.Deed_No || '—'})</p>
            {summary.activeTenants.length > 0 && (
              <div className="pt-2 border-t border-[#E8E1D4]">
                <strong className="block mb-1">Active Tenant(s):</strong>
                {summary.activeTenants.map((t) => (
                  <p key={t.Tenant_ID}>{t.Tenant_Name} · {t.Mobile_No || '—'} ({t.Status})</p>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-2 text-xs">
            <h2 className="font-bold text-sm text-[#29352D] border-b border-[#E8E1D4] pb-2">Registered Utilities</h2>
            {summary.activeUtilities.map((u) => (
              <div key={u.Utility_ID} className="border-b border-[#E8E1D4]/70 py-2">
                <strong>{u.Utility_Type}</strong> · <span className="text-gray-600">{u.Status || 'Active'}</span>
                <div className="text-gray-500">Consumer ID: {u.Consumer_ID || '—'} · Meter: {u.Meter_No || '—'}</div>
              </div>
            ))}
            {summary.activeUtilities.length === 0 && (
              <p className="text-gray-500 italic">No utility records linked to this property.</p>
            )}
          </section>
        </div>
      )}

      {/* Section 5: Requests & Notices */}
      {section === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-2">
            <h2 className="font-bold text-sm text-[#29352D] flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-[#536B4D]" />
              My Activity Requests ({summary.sortedRequests.length})
            </h2>
            {summary.sortedRequests.map((r) => (
              <div key={r.Request_ID} className="border-b border-[#E8E1D4]/70 py-2 text-xs">
                <div className="flex justify-between">
                  <strong>{r.Request_Number || r.Request_ID} · {r.Subject || r.Request_Category}</strong>
                  <span className="font-semibold text-[#536B4D]">{r.Request_Status}</span>
                </div>
                <div className="text-gray-500">{formatDateDisplay(r.Request_Date, '—')} · Priority: {r.Priority}</div>
              </div>
            ))}
            {summary.sortedRequests.length === 0 && <p className="text-xs text-gray-500 italic">No requests found.</p>}
          </section>

          <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs space-y-2">
            <h2 className="font-bold text-sm text-[#29352D] flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-[#536B4D]" />
              Active Notices ({summary.activeNotices.length}) & Gallery ({summary.activeGalleryEvents.length})
            </h2>
            {summary.activeNotices.slice(0, 10).map((n) => (
              <div key={n.Notice_ID} className="border-b border-[#E8E1D4]/70 py-2 text-xs">
                <strong>{n.Notice_Title}</strong>
                <div className="text-gray-500">{formatDateDisplay(n.Publish_Date, '—')} · {n.Notice_Category}</div>
              </div>
            ))}
            {summary.activeNotices.length === 0 && <p className="text-xs text-gray-500 italic">No active notices right now.</p>}
          </section>
        </div>
      )}
    </div>
  );
};
