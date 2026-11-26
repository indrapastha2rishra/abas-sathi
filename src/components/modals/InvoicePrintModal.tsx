/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import {
  computeInvoicePaidAsOnDate,
  computeLastPaymentDetailsAsOnBillingDate,
  computeOutstandingBillsAsOnBillingDate,
} from '../../utils/invoicePrintHelpers';
import { Printer, X } from 'lucide-react';

export const InvoicePrintModal: React.FC = () => {
  const {
    previewInvoice,
    setPreviewInvoice,
    invoices,
    billAllocations,
    receipts,
    societySettings,
    t,
  } = useApp();

  const historicalAmounts = useMemo(() => {
    if (!previewInvoice) return null;
    return computeInvoicePaidAsOnDate(previewInvoice, invoices, billAllocations, receipts);
  }, [previewInvoice, invoices, billAllocations, receipts]);

  const lastPayment = useMemo(() => {
    if (!previewInvoice) return null;
    return computeLastPaymentDetailsAsOnBillingDate(previewInvoice, invoices, billAllocations, receipts);
  }, [previewInvoice, invoices, billAllocations, receipts]);

  const outstandingBillsAsOn = useMemo(() => {
    if (!previewInvoice) return { rows: [], totalOutstanding: 0 };
    return computeOutstandingBillsAsOnBillingDate(previewInvoice, invoices, billAllocations, receipts);
  }, [previewInvoice, invoices, billAllocations, receipts]);

  if (!previewInvoice || !historicalAmounts) return null;

  const societyName = societySettings.societyName || '[Society Name]';
  const societyAddress = societySettings.societyAddress || '[Society Address]';
  const societyRegistrationNo = societySettings.societyRegistrationNo || '[Society Registration Number]';
  const billingDateFormatted = formatDateDisplay(previewInvoice.Billing_Date, '—');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="invoice-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs print:static print:bg-transparent print:p-0 print:overflow-visible">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E8E1D4] animate-in fade-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:border-none print:overflow-visible">
        {/* Modal Controls Header */}
        <div className="invoice-print-controls shrink-0 flex items-center justify-between border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
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
              <span>Print / Download PDF</span>
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
        <div className="p-6 md:p-8 bg-white text-[#29352D] overflow-y-auto flex-1 print:p-0 print:overflow-visible">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-[#536B4D] pb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#29352D]">
                {societyName}
              </h1>
              <p className="mt-2 text-xs text-[#29352D]/80 max-w-md space-y-0.5">
                <span className="block">
                  <strong>Society Address:</strong> {societyAddress}
                </span>
                <span className="block mt-0.5">
                  <strong>Society Registration No.:</strong> {societyRegistrationNo}
                </span>
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="inline-block rounded-md bg-[#536B4D]/10 px-3 py-1 text-xs font-bold tracking-wider text-[#536B4D] uppercase">
                MAINTENANCE INVOICE / বিল
              </span>
              <p className="mt-2 text-base font-bold text-[#29352D]">{previewInvoice.Invoice_Number}</p>
              <p className="text-xs text-gray-500">Billing Date: {formatDateDisplay(previewInvoice.Billing_Date, '—')}</p>
              <p className="text-xs font-semibold text-[#C97958]">Due Date: {formatDateDisplay(previewInvoice.Due_Date, '—')}</p>
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
                Period: <strong>{formatDateDisplay(previewInvoice.Bill_Period_From, '—')}</strong> to <strong>{formatDateDisplay(previewInvoice.Bill_Period_To, '—')}</strong>
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
                    ₹{Number(previewInvoice.Rate_Per_SqFt_Unit || 0).toFixed(2)} / {previewInvoice.Unit_Of_Measure}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">₹{Number(previewInvoice.Charge_Amount || 0).toFixed(2)}</td>
                </tr>
                {Number(previewInvoice.Late_Fee || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3 font-medium">2</td>
                    <td className="px-4 py-3 text-amber-700">Late Payment Surcharge / বিলম্ব ফি</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">+₹{Number(previewInvoice.Late_Fee || 0).toFixed(2)}</td>
                  </tr>
                )}
                {Number(previewInvoice.Discount_Amount || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3 font-medium">3</td>
                    <td className="px-4 py-3 text-emerald-700">Early Bird Concession / রিবেট</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">-₹{Number(previewInvoice.Discount_Amount || 0).toFixed(2)}</td>
                  </tr>
                )}
                {Number(previewInvoice.Adjustment_Amount || 0) !== 0 && (
                  <tr>
                    <td className="px-4 py-3 font-medium">4</td>
                    <td className="px-4 py-3">Prior Adjustment / সমন্বয়</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(previewInvoice.Adjustment_Amount || 0) > 0
                        ? `+₹${Number(previewInvoice.Adjustment_Amount || 0).toFixed(2)}`
                        : `-₹${Math.abs(Number(previewInvoice.Adjustment_Amount || 0)).toFixed(2)}`}
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
                <span className="font-bold text-lg text-[#29352D]">₹{historicalAmounts.netCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-t border-[#E8E1D4] pt-1">
                <span>Paid So Far:</span>
                <span className="text-emerald-700 font-semibold">₹{historicalAmounts.paidSoFar.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs py-1 border-t border-[#E8E1D4] pt-1">
                <span className="font-bold">Outstanding:</span>
                <span className="font-bold text-base text-[#C97958]">₹{historicalAmounts.outstanding.toFixed(2)}</span>
              </div>
              <div className="mt-2 text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  historicalAmounts.status === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : historicalAmounts.status === 'Overdue'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  Status: {historicalAmounts.status}
                </span>
              </div>
            </div>
          </div>

          {/* Last Payment Details (placed directly below Payment Instructions / Totals and directly above Outstanding Bills as on [Billing Date]) */}
          <div data-testid="invoice-last-payment-section" className="my-5 p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#536B4D] mb-2">
              Last Payment Details / সর্বশেষ পেমেন্ট বিবরণ
            </h4>
            {lastPayment ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[#29352D]/70 block">Last Payment Date</span>
                  <strong className="text-[#29352D]">{formatDateDisplay(lastPayment.lastPaymentDate, '—')}</strong>
                </div>
                <div>
                  <span className="text-[#29352D]/70 block">Last Payment Amount</span>
                  <strong className="text-emerald-800">
                    ₹{lastPayment.lastPaymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  <span className="text-[#29352D]/70 block">Mode of Payment</span>
                  <strong className="text-[#29352D]">{lastPayment.paymentMode}</strong>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#29352D]/70 italic">No Payment Recorded</p>
            )}
          </div>

          {/* Outstanding Bills as on [Billing Date] */}
          <div data-testid="invoice-outstanding-as-on-section" className="my-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#536B4D] mb-2">
              Outstanding Bills as on {billingDateFormatted}
            </h4>
            {outstandingBillsAsOn.rows.length > 0 ? (
              <div className="overflow-x-auto border border-[#E8E1D4] rounded-xl">
                <table className="w-full text-left text-[11px] leading-snug">
                  <thead className="bg-[#F7F4EC] text-[#29352D] border-b border-[#E8E1D4]">
                    <tr>
                      <th className="px-2.5 py-2 font-bold">Invoice Number</th>
                      <th className="px-2.5 py-2 font-bold whitespace-nowrap">Billing Date</th>
                      <th className="px-2.5 py-2 font-bold">Billing Period</th>
                      <th className="px-2.5 py-2 font-bold">Purpose</th>
                      <th className="px-2.5 py-2 font-bold text-right whitespace-nowrap">Invoice Amount</th>
                      <th className="px-2.5 py-2 font-bold text-right whitespace-nowrap">Paid Amount</th>
                      <th className="px-2.5 py-2 font-bold text-right whitespace-nowrap text-[#C97958]">Outstanding Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E1D4]">
                    {outstandingBillsAsOn.rows.map((row) => (
                      <tr key={row.invoiceId || row.invoiceNumber}>
                        <td className="px-2.5 py-2 font-semibold text-[#29352D] whitespace-nowrap">{row.invoiceNumber}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap">{formatDateDisplay(row.billingDate, '—')}</td>
                        <td className="px-2.5 py-2">
                          {formatDateDisplay(row.billingPeriodFrom, '—')} to {formatDateDisplay(row.billingPeriodTo, '—')}
                        </td>
                        <td className="px-2.5 py-2">{row.purpose || '—'}</td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap">₹{row.invoiceAmount.toFixed(2)}</td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap text-emerald-700">₹{row.paidAmount.toFixed(2)}</td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap font-bold text-[#C97958]">₹{row.outstandingAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F7F4EC] border-t border-[#E8E1D4] font-bold text-[#29352D]">
                    <tr>
                      <td colSpan={6} className="px-2.5 py-2 text-right">Total Outstanding</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-[#C97958]">
                        ₹{outstandingBillsAsOn.totalOutstanding.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#29352D]/70 italic p-3 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
                No Outstanding Bills
              </p>
            )}
          </div>

          {/* Footer Signature */}
          <div className="mt-10 flex justify-between items-end border-t border-dashed border-[#E8E1D4] pt-6 text-xs text-gray-500">
            <div>
              <p>Computer generated invoice, issued under authorized society seal.</p>
              <p>Verified on: {formatDateDisplay(new Date())}</p>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-gray-400 mb-1"></div>
              <p className="font-semibold text-[#29352D]">Honorary Treasurer</p>
              <p className="text-[10px]">{societyName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
