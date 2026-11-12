/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, CheckCircle2 } from 'lucide-react';

export const ReceiptPrintModal: React.FC = () => {
  const { previewReceipt, setPreviewReceipt, billAllocations, t } = useApp();

  if (!previewReceipt || previewReceipt.Receipt_Status !== 'Confirmed' || !previewReceipt.Receipt_Number) return null;

  const allocations = billAllocations.filter((a) => a.Transaction_ID === previewReceipt.Transaction_ID);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E8E1D4] my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-600"></span>
            <span className="font-semibold text-[#29352D] text-sm md:text-base">
              {t.actionPrint} - {previewReceipt.Receipt_Number}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-[#536B4D] px-4 py-2 text-xs md:text-sm font-medium text-white shadow-xs hover:bg-[#3F523A] transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>{t.actionPrint}</span>
            </button>
            <button
              onClick={() => setPreviewReceipt(null)}
              className="rounded-lg p-2 text-[#29352D]/70 hover:bg-[#E8E1D4] hover:text-[#29352D] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Money Receipt Document Body */}
        <div className="p-8 md:p-10 bg-white text-[#29352D] print:p-0">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-emerald-700 pb-5 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  AS
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#29352D]">
                    {t.appNameBengali} / {t.appName}
                  </h1>
                  <p className="text-xs font-medium text-[#C97958]">{t.tagline}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#29352D]/80">
                {t.apartmentName}
                <br />
                {t.apartmentAddress}
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="inline-block rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold tracking-wider text-emerald-800 uppercase">
                MONEY RECEIPT / মানি রসিদ
              </span>
              <p className="mt-2 text-base font-bold text-[#29352D]">{previewReceipt.Receipt_Number}</p>
              <p className="text-xs text-gray-500">Date: {previewReceipt.Date_Of_Received}</p>
              <span className="inline-block mt-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                {previewReceipt.Receipt_Status}
              </span>
            </div>
          </div>

          {/* Acknowledgement statement */}
          <div className="my-6 p-5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs md:text-sm leading-relaxed">
            <p>
              Received with thanks from <strong>{previewReceipt.Owner_Name}</strong> (Flat No: <strong>{previewReceipt.Flat_No}</strong>, Property ID: {previewReceipt.PropertyID})
              the sum of <strong className="text-base text-emerald-900">₹{previewReceipt.Received_Amount.toLocaleString('en-IN')}</strong>{' '}
              (Rupees in figures) via <strong>{previewReceipt.Received_Mode}</strong> (Ref: {previewReceipt.Received_Reference}).
            </p>
            {previewReceipt.Remarks && (
              <p className="mt-2 text-xs text-[#29352D]/70 italic">Remarks: {previewReceipt.Remarks}</p>
            )}
          </div>

          {/* Bill-wise Settlement Details */}
          <div className="my-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#536B4D] mb-2">
              Bill-wise Allocation Details / বিল অনুযায়ী সমন্বয়
            </h4>
            {allocations.length > 0 ? (
              <div className="overflow-x-auto border border-[#E8E1D4] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#E8E1D4] text-[#29352D]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Invoice No</th>
                      <th className="px-3 py-2 font-semibold text-right">Invoice Amt</th>
                      <th className="px-3 py-2 font-semibold text-right">O/S Before</th>
                      <th className="px-3 py-2 font-semibold text-right">Allocated</th>
                      <th className="px-3 py-2 font-semibold text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E1D4]">
                    {allocations.map((a) => (
                      <tr key={a.Allocation_ID}>
                        <td className="px-3 py-2 font-medium">{a.Invoice_Number}</td>
                        <td className="px-3 py-2 text-right">₹{a.Invoice_Amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">₹{a.Outstanding_Before.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">₹{a.Allocated_Amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">₹{a.Outstanding_After.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                No invoices allocated yet. Amount remains as unallocated advance balance.
              </p>
            )}

            {previewReceipt.Unallocated_Amount > 0 && (
              <div className="mt-3 flex justify-between items-center text-xs p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-medium">Unallocated Advance Balance (to be adjusted against future bills):</span>
                <span className="font-bold text-sm">₹{previewReceipt.Unallocated_Amount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Footer Signature */}
          <div className="mt-10 flex justify-between items-end border-t border-dashed border-[#E8E1D4] pt-6 text-xs text-gray-500">
            <div>
              <p className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Valid Electronic Payment Voucher
              </p>
              <p className="text-[10px]">Bank: {previewReceipt.Bank_Account}</p>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-gray-400 mb-1"></div>
              <p className="font-semibold text-[#29352D]">Authorized Signatory</p>
              <p className="text-[10px]">Abas Sathi Housing Society RWA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
