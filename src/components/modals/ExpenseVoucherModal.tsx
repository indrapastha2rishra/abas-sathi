/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, FileText } from 'lucide-react';

export const ExpenseVoucherModal: React.FC = () => {
  const { previewVoucher, setPreviewVoucher, t } = useApp();

  if (!previewVoucher) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E8E1D4] my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#C97958]"></span>
            <span className="font-semibold text-[#29352D] text-sm md:text-base">
              {t.actionPrint} - {previewVoucher.Voucher_No}
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
              onClick={() => setPreviewVoucher(null)}
              className="rounded-lg p-2 text-[#29352D]/70 hover:bg-[#E8E1D4] hover:text-[#29352D] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-8 md:p-10 bg-white text-[#29352D] print:p-0">
          <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-[#C97958] pb-5 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#C97958] flex items-center justify-center text-white font-bold text-lg shadow-sm">
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
              <span className="inline-block rounded-md bg-[#C97958]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#C97958] uppercase">
                EXPENSE PAYMENT VOUCHER / খরচের ভাউচার
              </span>
              <p className="mt-2 text-base font-bold text-[#29352D]">{previewVoucher.Voucher_No}</p>
              <p className="text-xs text-gray-500">Date: {previewVoucher.Payment_Date}</p>
              <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                previewVoucher.Expense_Status === 'Paid'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {previewVoucher.Expense_Status}
              </span>
            </div>
          </div>

          <div className="my-6 grid grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
              <p className="text-[#536B4D] font-bold uppercase tracking-wider">Paid To / প্রাপক</p>
              <p className="text-sm font-bold text-[#29352D] mt-1">{previewVoucher.Payee_Name}</p>
              <p className="text-[#29352D]/70 mt-1">Payment Mode: <strong>{previewVoucher.Payment_Mode}</strong></p>
              <p className="text-[#29352D]/70">Reference / UTR: {previewVoucher.Payment_Reference}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
              <p className="text-[#536B4D] font-bold uppercase tracking-wider">Category & Account</p>
              <p className="text-sm font-bold text-[#29352D] mt-1">{previewVoucher.Expense_Category}</p>
              <p className="text-[#29352D]/70 mt-1">Subcategory: {previewVoucher.Expense_Subcategory}</p>
              <p className="text-[#29352D]/70">Bank Account: {previewVoucher.Bank_Account}</p>
            </div>
          </div>

          <div className="my-6 p-4 rounded-xl border border-[#E8E1D4]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#536B4D] mb-1">Particulars / বিবরণ</p>
            <p className="text-sm text-[#29352D]">{previewVoucher.Particulars}</p>
            {previewVoucher.Remarks && (
              <p className="mt-2 text-xs text-gray-500 italic">Notes: {previewVoucher.Remarks}</p>
            )}
          </div>

          <div className="flex justify-between items-center p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
            <span className="text-sm font-semibold">Total Amount Disbursed:</span>
            <span className="text-xl font-bold text-[#29352D]">₹{previewVoucher.Payment_Amount.toLocaleString('en-IN')}.00</span>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 pt-6 border-t border-dashed border-[#E8E1D4] text-xs text-gray-500 text-center">
            <div>
              <div className="w-24 border-b border-gray-400 mx-auto mb-1"></div>
              <p className="font-semibold text-[#29352D]">Prepared By</p>
              <p className="text-[10px]">{previewVoucher.Created_By}</p>
            </div>
            <div>
              <div className="w-24 border-b border-gray-400 mx-auto mb-1"></div>
              <p className="font-semibold text-[#29352D]">Verified / Approved By</p>
              <p className="text-[10px]">{previewVoucher.Approved_By || 'Managing Committee'}</p>
            </div>
            <div>
              <div className="w-24 border-b border-gray-400 mx-auto mb-1"></div>
              <p className="font-semibold text-[#29352D]">Payee Signature</p>
              <p className="text-[10px]">Acknowledged Receipt</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
