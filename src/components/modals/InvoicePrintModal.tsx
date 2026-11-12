/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, Download, X, CheckCircle, ShieldCheck } from 'lucide-react';

export const InvoicePrintModal: React.FC = () => {
  const { previewInvoice, setPreviewInvoice, t, language } = useApp();

  if (!previewInvoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E8E1D4] my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#536B4D]"></span>
            <span className="font-semibold text-[#29352D] text-sm md:text-base">
              {t.actionPrint} - {previewInvoice.Invoice_Number}
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
              onClick={() => setPreviewInvoice(null)}
              className="rounded-lg p-2 text-[#29352D]/70 hover:bg-[#E8E1D4] hover:text-[#29352D] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div className="p-8 md:p-10 bg-white text-[#29352D] print:p-0">
          {/* Header & Logo */}
          <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-[#536B4D] pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#536B4D] flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  AS
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#29352D]">
                    {t.appNameBengali} / {t.appName}
                  </h1>
                  <p className="text-xs font-medium text-[#C97958]">{t.tagline}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[#29352D]/80 max-w-sm">
                {t.apartmentName}
                <br />
                {t.apartmentAddress}
                <br />
                KMC Ward 93 | Registered Society No: KOL/ACT/2014/9912
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="inline-block rounded-md bg-[#536B4D]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#536B4D] uppercase">
                MAINTENANCE INVOICE / বিল
              </span>
              <p className="mt-2 text-base font-bold text-[#29352D]">{previewInvoice.Invoice_Number}</p>
              <p className="text-xs text-gray-500">Billing Date: {previewInvoice.Billing_Date}</p>
              <p className="text-xs font-semibold text-[#C97958]">Due Date: {previewInvoice.Due_Date}</p>
            </div>
          </div>

          {/* Billed To / Property Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#536B4D]">Billed To / সদস্যের নাম</p>
              <h3 className="text-base font-bold text-[#29352D] mt-1">{previewInvoice.Owner_Name}</h3>
              <p className="text-xs text-[#29352D]/80">Owner ID: {previewInvoice.OwnerID}</p>
              <p className="text-xs text-[#29352D]/80">Flat No: <strong className="text-black">{previewInvoice.Flat_Number}</strong></p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#536B4D]">Property & Billing Period</p>
              <p className="text-xs text-[#29352D]/80 mt-1">Property ID: {previewInvoice.PropertyID}</p>
              <p className="text-xs text-[#29352D]/80">
                Structural Area: <strong>{previewInvoice.Area_SqFt} Sq.Ft.</strong>
              </p>
              <p className="text-xs text-[#29352D]/80">
                Period: <strong>{previewInvoice.Bill_Period_From}</strong> to <strong>{previewInvoice.Bill_Period_To}</strong>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto my-6 border border-[#E8E1D4] rounded-xl">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sl.</th>
                  <th className="px-4 py-3 font-semibold">Particulars / Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Calculation Basis</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                <tr>
                  <td className="px-4 py-3 font-medium">1</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#29352D]">{previewInvoice.Purpose}</p>
                    <p className="text-xs text-gray-500">{previewInvoice.Invoice_Description}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {previewInvoice.Area_SqFt} {previewInvoice.Unit_Of_Measure}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ₹{previewInvoice.Rate_Per_SqFt_Unit.toFixed(2)} / {previewInvoice.Unit_Of_Measure}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">₹{previewInvoice.Charge_Amount.toFixed(2)}</td>
                </tr>
                {previewInvoice.Late_Fee > 0 && (
                  <tr>
                    <td className="px-4 py-3 font-medium">2</td>
                    <td className="px-4 py-3 text-amber-700">Late Payment Surcharge / বিলম্ব ফি</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">+₹{previewInvoice.Late_Fee.toFixed(2)}</td>
                  </tr>
                )}
                {previewInvoice.Discount_Amount > 0 && (
                  <tr>
                    <td className="px-4 py-3 font-medium">3</td>
                    <td className="px-4 py-3 text-emerald-700">Early Bird Concession / রিবেট</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">-₹{previewInvoice.Discount_Amount.toFixed(2)}</td>
                  </tr>
                )}
                {previewInvoice.Adjustment_Amount !== 0 && (
                  <tr>
                    <td className="px-4 py-3 font-medium">4</td>
                    <td className="px-4 py-3">Prior Adjustment / সমন্বয়</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {previewInvoice.Adjustment_Amount > 0 ? `+₹${previewInvoice.Adjustment_Amount.toFixed(2)}` : `-₹${Math.abs(previewInvoice.Adjustment_Amount).toFixed(2)}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals & Status */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-4 border-t border-[#E8E1D4]">
            <div className="text-xs text-[#29352D]/80 max-w-md">
              <p className="font-semibold text-[#536B4D]">Payment Instructions / পেমেন্ট নির্দেশিকা:</p>
              <p>• Please obtain current verified bank/UPI details from your Society Admin.</p>
              <p>• Please quote Flat No & Invoice No in payment remarks.</p>
            </div>
            <div className="w-full md:w-64 bg-[#F7F4EC] p-4 rounded-xl border border-[#E8E1D4] text-right">
              <div className="flex justify-between text-xs py-1">
                <span>Net Payable:</span>
                <span className="font-bold text-lg text-[#29352D]">₹{previewInvoice.Net_Charge_Amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-t border-[#E8E1D4] pt-1">
                <span>Paid So Far:</span>
                <span className="text-emerald-700 font-semibold">₹{previewInvoice.Paid_Amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-t border-[#E8E1D4] pt-1">
                <span className="font-bold">Outstanding:</span>
                <span className="font-bold text-base text-[#C97958]">₹{previewInvoice.Outstanding_Amount.toFixed(2)}</span>
              </div>
              <div className="mt-2 text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  previewInvoice.Invoice_Status === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : previewInvoice.Invoice_Status === 'Overdue'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  Status: {previewInvoice.Invoice_Status}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Signature */}
          <div className="mt-12 flex justify-between items-end border-t border-dashed border-[#E8E1D4] pt-6 text-xs text-gray-500">
            <div>
              <p>Computer generated invoice, issued under authorized society seal.</p>
              <p>Verified on: {new Date().toLocaleDateString('en-IN')}</p>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-gray-400 mb-1"></div>
              <p className="font-semibold text-[#29352D]">Honorary Treasurer</p>
              <p className="text-[10px]">Abas Sathi Housing Society RWA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
