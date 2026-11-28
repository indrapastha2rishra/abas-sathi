/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const PRINT_TARGET_HEIGHT_PX = 990;
const ZOOM_STEPS: Array<{ factor: number; className: string }> = [
  { factor: 0.95, className: 'ownership-print-zoom-95' },
  { factor: 0.9, className: 'ownership-print-zoom-90' },
  { factor: 0.85, className: 'ownership-print-zoom-85' },
  { factor: 0.8, className: 'ownership-print-zoom-80' },
  { factor: 0.75, className: 'ownership-print-zoom-75' },
  { factor: 0.7, className: 'ownership-print-zoom-70' },
  { factor: 0.65, className: 'ownership-print-zoom-65' },
  { factor: 0.6, className: 'ownership-print-zoom-60' },
  { factor: 0.55, className: 'ownership-print-zoom-55' },
  { factor: 0.5, className: 'ownership-print-zoom-50' },
  { factor: 0.45, className: 'ownership-print-zoom-45' },
];

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
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [printZoomClass, setPrintZoomClass] = useState<string>('');

  const recomputePrintZoom = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    const height = el.scrollHeight;
    if (!height || height <= PRINT_TARGET_HEIGHT_PX) {
      setPrintZoomClass('');
      return;
    }
    const ratio = PRINT_TARGET_HEIGHT_PX / height;
    const matched = ZOOM_STEPS.find((step) => step.factor <= ratio);
    setPrintZoomClass(matched ? matched.className : 'ownership-print-zoom-45');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeprint', recomputePrintZoom);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', recomputePrintZoom);
    };
  }, [isOpen, onClose, recomputePrintZoom]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    recomputePrintZoom();
  }, [isOpen, floorGroups, totalOutstanding, ownershipCount, recomputePrintZoom]);

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

  const totalUnits = floorGroups.reduce((sum, grp) => sum + grp.rows.length, 0);
  const totalVisualRows = totalUnits + floorGroups.length * 2;
  const isUltraCompact = totalVisualRows > 38;
  const isCompact = !isUltraCompact && totalVisualRows > 20;

  const cellPad = isUltraCompact
    ? 'px-1.5 py-0.5'
    : isCompact
      ? 'px-2 py-0.5'
      : 'px-2 py-1';
  const tableText = isUltraCompact
    ? 'text-[9.5px] leading-tight'
    : isCompact
      ? 'text-[10px] leading-tight'
      : 'text-[11px] leading-snug';

  const handlePrintClick = () => {
    recomputePrintZoom();
    window.print();
  };

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
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[#F7F4EC] shadow-2xl overflow-hidden border border-[#E8E1D4] animate-in fade-in zoom-in-95 duration-200 print:max-h-none print:bg-white print:shadow-none print:border-none print:overflow-visible">
        {/* Modal Controls Header */}
        <div className="invoice-print-controls shrink-0 flex items-center justify-between gap-3 border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-full bg-[#536B4D] shrink-0"></span>
            <span id="ownership-print-modal-title" className="font-semibold text-[#29352D] text-sm md:text-base truncate">
              Ownership-wise Outstanding Report (Floor-wise · One-Page Format)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintClick}
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

        {/* Printable One-Page Sheet Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
          <div
            ref={sheetRef}
            className={`ownership-onepage-sheet ${printZoomClass} mx-auto w-full max-w-[790px] bg-white text-[#29352D] rounded-xl border border-[#E8E1D4] p-5 shadow-xs space-y-2.5 print:rounded-none print:border-0 print:p-0 print:shadow-none print:space-y-2`}
          >
            {/* Compact Society Letterhead */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-[#536B4D] pb-2 gap-2">
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold tracking-tight text-[#29352D] leading-tight">
                  {societyName || '[Society Name]'}
                </h1>
                {(societyAddress || societyRegistrationNo) && (
                  <p className="mt-0.5 text-[10px] text-[#29352D]/80 leading-snug">
                    {societyAddress && <span>{societyAddress}</span>}
                    {societyAddress && societyRegistrationNo && <span> · </span>}
                    {societyRegistrationNo && (
                      <span>
                        <strong>Reg. No.:</strong> {societyRegistrationNo}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="inline-block rounded bg-[#536B4D]/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#536B4D] uppercase border border-[#536B4D]/30">
                  OWNERSHIP-WISE OUTSTANDING REPORT
                </span>
                <p className="mt-0.5 text-[10px] font-semibold text-[#536B4D]">
                  Grouped by Floor · ফ্লোরভিত্তিক বকেয়া রিপোর্ট
                </p>
                <p className="text-[10px] text-gray-500">
                  Report Date: {formatDateDisplay(printedDate)}
                </p>
              </div>
            </div>

            {/* Compact Summary Strip */}
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              <div className="rounded-lg bg-[#F7F4EC] border border-[#E8E1D4] px-2.5 py-1.5 flex items-center justify-between gap-1">
                <span className="text-gray-600">Floors with Dues</span>
                <strong className="text-xs font-bold text-[#29352D]">{floorGroups.length}</strong>
              </div>
              <div className="rounded-lg bg-[#F7F4EC] border border-[#E8E1D4] px-2.5 py-1.5 flex items-center justify-between gap-1">
                <span className="text-gray-600">Ownerships</span>
                <strong className="text-xs font-bold text-[#29352D]">{ownershipCount}</strong>
              </div>
              <div className="rounded-lg bg-[#F7F4EC] border border-[#E8E1D4] px-2.5 py-1.5 flex items-center justify-between gap-1">
                <span className="text-gray-600">Pending Invoices</span>
                <strong className="text-xs font-bold text-[#29352D]">{totalPendingInvoices}</strong>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 flex items-center justify-between gap-1">
                <span className="text-red-800">Total Due</span>
                <strong className="text-xs font-bold text-red-700">{formatINR(totalOutstanding)}</strong>
              </div>
            </div>

            {unlinkedInvoiceCount > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] text-amber-900">
                Note: {unlinkedInvoiceCount} unlinked legacy invoice(s) have no Ownership_ID assigned.
              </div>
            )}

            {/* Compact Floor-wise Totals Ribbon */}
            {floorGroups.length > 0 && (
              <div className="rounded-lg border border-[#E8E1D4] bg-[#F7F4EC]/50 px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="font-bold uppercase tracking-wider text-[#536B4D] inline-flex items-center gap-1 mr-1">
                  <Layers className="h-3 w-3" />
                  Floor Summary:
                </span>
                {floorGroups.map((grp) => (
                  <span
                    key={grp.floorKey}
                    className="inline-flex items-center gap-1 rounded border border-[#E8E1D4] bg-white px-1.5 py-0.5"
                  >
                    <span className="font-bold text-[#29352D]">{grp.floorLabel}:</span>
                    <span className="font-bold text-red-700">{formatINR(grp.totalOutstanding)}</span>
                    <span className="text-gray-500">({grp.ownershipCount})</span>
                  </span>
                ))}
              </div>
            )}

            {/* Single Unified Floor-Grouped Table */}
            {floorGroups.length === 0 ? (
              <div className="rounded-lg border border-[#E8E1D4] p-6 text-center text-xs text-gray-500">
                No outstanding ownership dues found.
              </div>
            ) : (
              <div className="rounded-lg border border-[#E8E1D4] overflow-hidden">
                <table className={`w-full text-left border-collapse ${tableText}`}>
                  <thead className="bg-[#536B4D] text-white print:bg-[#EFECE4] print:text-[#29352D] print:border-b-2 print:border-[#536B4D]">
                    <tr>
                      <th className={`${cellPad} font-bold whitespace-nowrap`}>Ownership ID</th>
                      <th className={`${cellPad} font-bold whitespace-nowrap`}>Flat / Property</th>
                      <th className={`${cellPad} font-bold`}>Owner</th>
                      <th className={`${cellPad} font-bold whitespace-nowrap`}>Ownership Period</th>
                      <th className={`${cellPad} font-bold text-right whitespace-nowrap`}>Pending Inv.</th>
                      <th className={`${cellPad} font-bold text-right whitespace-nowrap`}>Outstanding</th>
                      <th className={`${cellPad} font-bold text-right whitespace-nowrap`}>Due Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {floorGroups.map((grp) => {
                      const floorPendingCount = grp.rows.reduce(
                        (sum, r) => sum + Number(r.Pending_Invoice_Count ?? r.Invoice_Count ?? 0),
                        0
                      );
                      return (
                        <React.Fragment key={grp.floorKey}>
                          {/* Floor Group Header Row */}
                          <tr className="bg-[#F7F4EC] border-t border-b border-[#536B4D]/35">
                            <td colSpan={7} className={`${cellPad} font-bold text-[#29352D]`}>
                              <div className="flex items-center justify-between gap-2">
                                <span>
                                  {grp.floorLabel}{' '}
                                  <span className="font-normal text-gray-600">
                                    ({grp.ownershipCount} ownership{grp.ownershipCount === 1 ? '' : 's'})
                                  </span>
                                </span>
                                <span className="text-[10px] font-semibold text-[#536B4D]">
                                  Floor Pending: {floorPendingCount} · Floor Due:{' '}
                                  <span className="font-bold text-red-700">{formatINR(grp.totalOutstanding)}</span>
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Floor Rows */}
                          {grp.rows.map((r: any, idx: number) => {
                            const pendingCount = Number(r.Pending_Invoice_Count ?? r.Invoice_Count ?? 0);
                            const dueMonths = Number(r.Due_Months || 0);
                            return (
                              <tr
                                key={`${r.Ownership_ID}-${r.PropertyID}-${idx}`}
                                className="border-b border-[#E8E1D4]/80 break-inside-avoid"
                              >
                                <td className={`${cellPad} font-mono text-gray-700 whitespace-nowrap`}>
                                  {r.Ownership_ID}
                                </td>
                                <td className={`${cellPad} whitespace-nowrap`}>
                                  <span className="font-bold text-[#536B4D] print:text-[#29352D]">
                                    {r.Flat_No || r.PropertyID}
                                  </span>
                                  {r.PropertyID && r.Flat_No && r.PropertyID !== r.Flat_No && (
                                    <span className="ml-1 text-[9px] font-mono text-gray-500">
                                      ({r.PropertyID})
                                    </span>
                                  )}
                                </td>
                                <td className={`${cellPad} font-medium text-[#29352D]`}>
                                  {r.Owner_Name || r.OwnerID || '—'}
                                </td>
                                <td className={`${cellPad} whitespace-nowrap text-gray-600`}>
                                  {formatDateDisplay(r.Ownership_Start_Date, '—')} to{' '}
                                  {formatDateDisplay(r.Ownership_End_Date, 'Current')}
                                </td>
                                <td className={`${cellPad} text-right font-medium`}>{pendingCount}</td>
                                <td className={`${cellPad} text-right font-bold text-red-700 whitespace-nowrap`}>
                                  {formatINR(r.Outstanding)}
                                </td>
                                <td className={`${cellPad} text-right whitespace-nowrap text-gray-700`}>
                                  {dueMonths > 0
                                    ? `${dueMonths} ${dueMonths === 1 ? 'month' : 'months'}`
                                    : pendingCount > 0
                                      ? '< 1 month'
                                      : '—'}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Floor Subtotal Row */}
                          <tr className="bg-[#F7F4EC]/60 border-b border-[#536B4D]/25 font-semibold text-[#29352D]">
                            <td colSpan={4} className={`${cellPad} text-right text-gray-700`}>
                              {grp.floorLabel} Subtotal ({grp.ownershipCount} unit{grp.ownershipCount === 1 ? '' : 's'})
                            </td>
                            <td className={`${cellPad} text-right`}>{floorPendingCount}</td>
                            <td className={`${cellPad} text-right font-bold text-red-700 whitespace-nowrap`}>
                              {formatINR(grp.totalOutstanding)}
                            </td>
                            <td className={cellPad}></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#EFECE4] border-t-2 border-[#536B4D] font-bold text-[#29352D]">
                    <tr>
                      <td colSpan={4} className={`${cellPad} uppercase tracking-wide`}>
                        Grand Total ({floorGroups.length} Floor{floorGroups.length === 1 ? '' : 's'} · {ownershipCount} Ownership{ownershipCount === 1 ? '' : 's'})
                      </td>
                      <td className={`${cellPad} text-right`}>{totalPendingInvoices}</td>
                      <td className={`${cellPad} text-right text-red-700 whitespace-nowrap`}>
                        {formatINR(totalOutstanding)}
                      </td>
                      <td className={cellPad}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Compact Calculation Footnote */}
            <p className="text-[9.5px] text-gray-500 pt-0.5">
              Calculation Basis: Invoice Register Net_Charge_Amount − Bill Wise Details Allocated_Amount (Invoice &amp; Owner wise).
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
