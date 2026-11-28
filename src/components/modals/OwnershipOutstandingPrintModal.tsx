/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Layers } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateFormat';
import { OwnershipFloorGroup, toReportAmount } from '../../utils/reportHelpers';

interface OwnershipOutstandingPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  floorGroups: OwnershipFloorGroup<any>[];
  totalOutstanding: number;
  ownershipCount: number;
  unlinkedInvoiceCount?: number;
  printedDate: string;
  societyName: string;
  societyAddress?: string;
  societyRegistrationNo?: string;
}

const formatINR = (val: unknown) =>
  `₹${toReportAmount(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const OwnershipOutstandingPrintModal: React.FC<OwnershipOutstandingPrintModalProps> = ({
  isOpen,
  onClose,
  floorGroups,
  totalOutstanding,
  ownershipCount,
  unlinkedInvoiceCount = 0,
  printedDate,
  societyName,
  societyAddress,
  societyRegistrationNo,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalPendingInvoices = floorGroups.reduce(
    (sum, grp) =>
      sum +
      grp.rows.reduce(
        (rowSum, row) => rowSum + Number(row.Pending_Invoice_Count ?? row.Invoice_Count ?? 0),
        0
      ),
    0
  );

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ownership-print-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="invoice-print-overlay ownership-pdf-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs print:static print:bg-transparent print:p-0 print:overflow-visible"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E8E1D4] animate-in fade-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:border-none print:overflow-visible">
        {/* Modal Controls Header */}
        <div className="invoice-print-controls shrink-0 flex items-center justify-between gap-3 border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-full bg-[#536B4D] shrink-0"></span>
            <span id="ownership-print-modal-title" className="font-semibold text-[#29352D] text-sm md:text-base truncate">
              Ownership-wise Outstanding Report (Floor-wise)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-[#536B4D] px-4 py-2 text-xs md:text-sm font-medium text-white shadow-xs hover:bg-[#3F523A] transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#29352D]/70 hover:bg-[#E8E1D4] hover:text-[#29352D] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 md:p-8 bg-white text-[#29352D] overflow-y-auto flex-1 space-y-6 print:p-0 print:overflow-visible print:space-y-4">
          {/* Society Letterhead */}
          <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-[#536B4D] pb-5 gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#29352D]">
                {societyName || '[Society Name]'}
              </h1>
              {societyAddress && (
                <p className="mt-1.5 text-xs text-[#29352D]/80 max-w-md whitespace-pre-line">
                  <strong>Society Address:</strong> {societyAddress}
                </p>
              )}
              {societyRegistrationNo && (
                <p className="mt-0.5 text-xs text-[#29352D]/80">
                  <strong>Society Registration No.:</strong> {societyRegistrationNo}
                </p>
              )}
            </div>
            <div className="text-left md:text-right">
              <span className="inline-block rounded-md bg-[#536B4D]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#536B4D] uppercase print:border print:border-[#536B4D]">
                OWNERSHIP-WISE OUTSTANDING REPORT
              </span>
              <p className="mt-1.5 text-xs font-semibold text-[#536B4D]">
                Grouped by Floor / ফ্লোরভিত্তিক বকেয়া রিপোর্ট
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Report Date: {formatDateDisplay(printedDate)}
              </p>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-3">
              <span className="text-gray-600">Floors with Dues</span>
              <strong className="block text-base text-[#29352D] mt-0.5">{floorGroups.length}</strong>
            </div>
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-3">
              <span className="text-gray-600">Ownership Records</span>
              <strong className="block text-base text-[#29352D] mt-0.5">{ownershipCount}</strong>
            </div>
            <div className="rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] p-3">
              <span className="text-gray-600">Pending Invoices</span>
              <strong className="block text-base text-[#29352D] mt-0.5">{totalPendingInvoices}</strong>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <span className="text-red-800">Total Outstanding</span>
              <strong className="block text-base text-red-700 mt-0.5">{formatINR(totalOutstanding)}</strong>
            </div>
          </div>

          {unlinkedInvoiceCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
              Note: {unlinkedInvoiceCount} unlinked legacy invoice(s) have no Ownership_ID assigned.
            </div>
          )}

          {/* Floor-wise Summary Chips */}
          {floorGroups.length > 0 && (
            <div className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC]/50 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#536B4D] mb-2 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Floor-wise Summary
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {floorGroups.map((grp) => (
                  <span
                    key={grp.floorKey}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E1D4] bg-white px-2.5 py-1 text-[11px]"
                  >
                    <span className="font-bold text-[#29352D]">{grp.floorLabel}:</span>
                    <span className="font-bold text-red-700">{formatINR(grp.totalOutstanding)}</span>
                    <span className="text-gray-500">({grp.ownershipCount})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Floor-by-Floor Detailed Tables */}
          <div className="space-y-5">
            {floorGroups.length === 0 ? (
              <div className="rounded-xl border border-[#E8E1D4] p-8 text-center text-xs text-gray-500">
                No outstanding ownership dues found.
              </div>
            ) : (
              floorGroups.map((grp) => {
                const floorPendingCount = grp.rows.reduce(
                  (sum, r) => sum + Number(r.Pending_Invoice_Count ?? r.Invoice_Count ?? 0),
                  0
                );
                return (
                  <div key={grp.floorKey} className="rounded-xl border border-[#E8E1D4] overflow-hidden break-inside-avoid-page">
                    <div className="bg-[#536B4D] text-white print:bg-[#F7F4EC] print:text-[#29352D] print:border-b print:border-[#536B4D] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{grp.floorLabel}</span>
                        <span className="rounded-md bg-white/15 print:bg-white print:border print:border-[#E8E1D4] px-2 py-0.5 text-[11px] font-semibold">
                          {grp.ownershipCount} ownership{grp.ownershipCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        <span>
                          Pending Invoices: <strong>{floorPendingCount}</strong>
                        </span>
                        <span className="rounded-md bg-white px-2 py-0.5 text-red-700 font-bold print:border print:border-red-300">
                          Floor Outstanding: {formatINR(grp.totalOutstanding)}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F7F4EC] text-[#29352D] border-b border-[#E8E1D4]">
                          <tr>
                            <th className="px-3 py-2 font-bold">Ownership ID</th>
                            <th className="px-3 py-2 font-bold">PropertyID / Flat</th>
                            <th className="px-3 py-2 font-bold">Owner</th>
                            <th className="px-3 py-2 font-bold">Ownership Period</th>
                            <th className="px-3 py-2 font-bold text-right">Pending Invoices</th>
                            <th className="px-3 py-2 font-bold text-right text-red-700">Outstanding</th>
                            <th className="px-3 py-2 font-bold text-right">Due month</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8E1D4]">
                          {grp.rows.map((r: any, idx: number) => {
                            const pendingCount = Number(r.Pending_Invoice_Count ?? r.Invoice_Count ?? 0);
                            const dueMonths = Number(r.Due_Months || 0);
                            return (
                              <tr key={`${r.Ownership_ID}-${r.PropertyID}-${idx}`} className="break-inside-avoid">
                                <td className="px-3 py-2 font-mono text-gray-700">{r.Ownership_ID}</td>
                                <td className="px-3 py-2">
                                  <span className="font-bold text-[#536B4D] print:text-[#29352D]">
                                    {r.Flat_No || r.PropertyID}
                                  </span>
                                  {r.PropertyID && r.Flat_No && r.PropertyID !== r.Flat_No && (
                                    <span className="block text-[10px] font-mono text-gray-500">{r.PropertyID}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-medium text-[#29352D]">{r.Owner_Name || r.OwnerID || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                                  {formatDateDisplay(r.Ownership_Start_Date, '—')} to{' '}
                                  {formatDateDisplay(r.Ownership_End_Date, 'Current')}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">{pendingCount}</td>
                                <td className="px-3 py-2 text-right font-bold text-red-700">{formatINR(r.Outstanding)}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap text-gray-700">
                                  {dueMonths > 0
                                    ? `${dueMonths} ${dueMonths === 1 ? 'month' : 'months'}`
                                    : pendingCount > 0
                                      ? '< 1 month'
                                      : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-[#F7F4EC]/80 border-t border-[#E8E1D4] font-bold text-[#29352D]">
                          <tr>
                            <td colSpan={4} className="px-3 py-2">
                              {grp.floorLabel} Subtotal ({grp.ownershipCount} ownership{grp.ownershipCount === 1 ? '' : 's'})
                            </td>
                            <td className="px-3 py-2 text-right">{floorPendingCount}</td>
                            <td className="px-3 py-2 text-right text-red-700">{formatINR(grp.totalOutstanding)}</td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Grand Total & Calculation Basis */}
          {floorGroups.length > 0 && (
            <div className="rounded-xl border-2 border-[#536B4D] bg-[#F7F4EC] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-[#29352D] uppercase tracking-wide">Grand Total (All Floors)</span>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Calculated as Invoice Register Net_Charge_Amount − Bill Wise Details Allocated_Amount (Invoice &amp; Owner wise).
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="text-[11px] text-gray-600 block">
                  {floorGroups.length} Floor(s) · {ownershipCount} Ownership(s) · {totalPendingInvoices} Pending Invoice(s)
                </span>
                <strong className="text-base font-bold text-red-700">{formatINR(totalOutstanding)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
