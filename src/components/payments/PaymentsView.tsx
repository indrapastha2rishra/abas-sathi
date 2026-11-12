/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CreditCard,
  Receipt,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ShieldCheck,
  Search,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { PaymentMode, FundInflowRegister } from '../../types/database';

interface Props {
  initialSubTab?: 'pay_now' | 'receipts' | 'allocation' | 'advances' | 'record';
}

export const PaymentsView: React.FC<Props> = ({ initialSubTab = 'receipts' }) => {
  const {
    activeRole,
    currentUser,
    residentProperty,
    invoices,
    receipts,
    billAllocations,
    bankAccounts,
    submitResidentPayment,
    uploadPrivateFile,
    confirmAndAllocatePayment,
    setPreviewReceipt,
    t,
  } = useApp();

  const [subTab, setSubTab] = useState<'pay_now' | 'receipts' | 'allocation' | 'advances' | 'record'>(
    activeRole === 'Resident' ? 'pay_now' : initialSubTab
  );

  // Resident "Pay Now" flow state
  const myInvoices = invoices.filter(
    (i) => i.PropertyID === residentProperty?.PropertyID && i.Outstanding_Amount > 0
  );

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(
    myInvoices.map((i) => i.InvoiceID)
  );
  const [payMode, setPayMode] = useState<PaymentMode>('UPI');
  const [payRef, setPayRef] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [residentRemarks, setResidentRemarks] = useState('');
  const [residentSubmitSuccess, setResidentSubmitSuccess] = useState('');
  const invoiceSelectionInitialized = useRef(false);
  useEffect(() => {
    if (!invoiceSelectionInitialized.current && myInvoices.length) {
      setSelectedInvoiceIds(myInvoices.map(i => i.InvoiceID));
      invoiceSelectionInitialized.current = true;
    }
  }, [myInvoices]);

  // Selected invoices total sum
  const payableTotal = myInvoices
    .filter((inv) => selectedInvoiceIds.includes(inv.InvoiceID))
    .reduce((sum, inv) => sum + inv.Outstanding_Amount, 0);

  const handleToggleInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payableTotal <= 0) return;

    try {
    const receipt = await submitResidentPayment({
      invoiceIds: selectedInvoiceIds, amount: payableTotal, mode: payMode, reference: payRef,
      bankAccount: bankAccounts[0]?.BankAccount_ID || '', remarks: residentRemarks,
      proofFileName: proofFile ? (await uploadPrivateFile(proofFile, 'Payment Proof', residentProperty?.PropertyID)).fileId : '',
    });

    setResidentSubmitSuccess(`Payment submitted for verification. Transaction ID: ${receipt.Transaction_ID}. An official receipt will be issued after confirmation.`);
    setPayRef('');
    setTimeout(() => setResidentSubmitSuccess(''), 3500);
    } catch (error:any) { window.alert(error?.message || 'Payment could not be submitted. Please retry.'); }
  };

  // Admin/Accountant confirmation modal state
  const [confirmingReceipt, setConfirmingReceipt] = useState<FundInflowRegister | null>(null);

  const handleConfirmReceipt = async (receipt: FundInflowRegister) => {
    try { const confirmed = await confirmAndAllocatePayment(receipt.Transaction_ID); setConfirmingReceipt(null); setPreviewReceipt(confirmed); }
    catch (error:any) { window.alert(error?.message || 'Payment confirmation failed.'); }
  };

  return (
    <div className="space-y-6">
      {/* Title & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#536B4D]" />
            {t.navPayments} / পেমেন্ট ও মানি রসিদ
          </h1>
          <p className="text-xs text-gray-500">
            Society UPI payments, fund inflow tracking, and safe bill-wise allocation
          </p>
        </div>

        <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#E8E1D4]">
          {activeRole === 'Resident' ? (
            <>
              <button
                onClick={() => setSubTab('pay_now')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'pay_now'
                    ? 'bg-[#C97958] text-white shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Pay Bills Online
              </button>
              <button
                onClick={() => setSubTab('receipts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'receipts'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                My Receipts
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSubTab('receipts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'receipts'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Receipt Register ({receipts.length})
              </button>
              <button
                onClick={() => setSubTab('allocation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'allocation'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Bill Allocations ({billAllocations.length})
              </button>
              <button
                onClick={() => setSubTab('advances')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'advances'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Advance Balances
              </button>
            </>
          )}
        </div>
      </div>

      {/* SUBTAB 1: RESIDENT "PAY NOW" FLOW (SECTION 12) */}
      {subTab === 'pay_now' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Bank / UPI Instructions & Invoice Selection */}
          <div className="lg:col-span-7 space-y-6">
            {/* Society payment instructions — private bank details are not embedded in frontend source. */}
            <div className="rounded-2xl border-2 border-[#536B4D] bg-white p-6 shadow-xs">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D] uppercase">
                Official Society Payment Channel
              </span>
              <h3 className="text-lg font-bold text-[#29352D] mt-1.5">Society Payment Instructions</h3>
              <p className="text-xs text-gray-600 mt-1">
                Please use only the verified bank or UPI details issued by your Society Admin/Committee. Private bank account information is not embedded in this public website.
              </p>
              <div className="mt-4 rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] p-4 text-xs text-[#29352D]">
                Contact your Society Admin to obtain the current verified payment details before transferring funds. Do not send money to account details received from unofficial sources.
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Important: Please mention Flat {residentProperty?.Flat_No} in your payment remark.</span>
              </div>
            </div>

            {/* Invoices Selection List */}
            <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
              <h3 className="font-bold text-sm text-[#29352D] mb-3">
                Select Bills to Pay / বকেয়া বিল নির্বাচন করুন
              </h3>
              {myInvoices.length > 0 ? (
                <div className="space-y-2">
                  {myInvoices.map((inv) => {
                    const isSelected = selectedInvoiceIds.includes(inv.InvoiceID);
                    return (
                      <div
                        key={inv.InvoiceID}
                        onClick={() => handleToggleInvoice(inv.InvoiceID)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#536B4D] bg-[#536B4D]/5'
                            : 'border-[#E8E1D4] hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="h-4 w-4 text-[#536B4D] rounded-sm focus:ring-[#536B4D]"
                          />
                          <div>
                            <span className="font-bold text-xs text-[#29352D] block">
                              {inv.Invoice_Number} ({inv.Purpose})
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Period: {inv.Bill_Period_From} to {inv.Bill_Period_To} | Due: {inv.Due_Date}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm text-[#29352D]">
                            ₹{inv.Outstanding_Amount.toFixed(2)}
                          </span>
                          <span className="block text-[10px] text-red-600 font-semibold">
                            {inv.Invoice_Status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 font-semibold">
                  ✓ Great news! Flat {residentProperty?.Flat_No} has zero pending maintenance bills.
                </div>
              )}
            </div>
          </div>

          {/* Right: Payment Submission Form */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs sticky top-24">
              <h3 className="text-sm font-bold text-[#29352D] pb-3 border-b border-[#E8E1D4]">
                Confirm & Submit Payment / পেমেন্ট প্রমাণ জমা দিন
              </h3>

              {residentSubmitSuccess && (
                <div className="my-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {residentSubmitSuccess}
                </div>
              )}

              <form onSubmit={handleResidentSubmit} className="mt-4 space-y-4 text-xs">
                {/* Total Payable Summary */}
                <div className="p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] flex justify-between items-center">
                  <span className="font-semibold text-[#29352D]">Total Payable:</span>
                  <span className="text-2xl font-bold text-[#C97958]">₹{payableTotal.toFixed(2)}</span>
                </div>

                <div>
                  <label className="block font-semibold text-[#29352D] mb-1">Payment Mode:</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
                  >
                    <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                    <option value="NEFT">NEFT / RTGS Net Banking</option>
                    <option value="IMPS">IMPS Instant Transfer</option>
                    <option value="Cheque">Account Payee Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#29352D] mb-1">
                    Transaction Reference / UTR Number:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UPI/61029481928 or UTR..."
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 font-mono text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Enter the 12-digit transaction ID or reference from your bank receipt.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-[#29352D] mb-1">
                    Payment Proof Attachment:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="flex-1 rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {proofFile ? `${proofFile.name} · ${(proofFile.size / 1024).toFixed(0)} KB` : 'Optional · PDF, JPG or PNG · Maximum 5 MB. The file is uploaded privately to your society Drive folder.'}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-[#29352D] mb-1">Notes (Optional):</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid for May maintenance"
                    value={residentRemarks}
                    onChange={(e) => setResidentRemarks(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                  />
                </div>

                {/* Section 12 Requirement Banner */}
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                  <strong>Verification Policy:</strong> Submitted payments remain in <em>"Pending Verification"</em> status until verified by society accountant/admin against bank statements. Once verified, official Money Receipt with digital serial is issued.
                </div>

                <button
                  type="submit"
                  disabled={payableTotal <= 0 || !payRef}
                  className="w-full rounded-xl bg-[#C97958] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#A95D3E] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Submit Payment For Verification
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: RECEIPT REGISTER */}
      {subTab === 'receipts' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">Fund Inflow Register / প্রাপ্তি রেজিস্টার</h3>
              <p className="text-xs text-gray-500">Official Society Receipts and Inflow Log</p>
            </div>
            <span className="text-xs text-gray-500">{receipts.length} Total Receipts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Receipt No</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Flat No</th>
                  <th className="px-4 py-3 font-semibold">Payer Name</th>
                  <th className="px-4 py-3 font-semibold">Mode & Ref</th>
                  <th className="px-4 py-3 font-semibold text-right">Received (₹)</th>
                  <th className="px-4 py-3 font-semibold text-right">Unallocated (₹)</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {receipts.map((rec) => (
                  <tr key={rec.Transaction_ID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#29352D]">{rec.Receipt_Number || rec.Transaction_ID}</td>
                    <td className="px-4 py-3 text-gray-500">{rec.Date_Of_Received}</td>
                    <td className="px-4 py-3 font-bold text-[#536B4D]">{rec.Flat_No}</td>
                    <td className="px-4 py-3 font-medium">{rec.Owner_Name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                      {rec.Received_Mode} • {rec.Received_Reference}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                      ₹{rec.Received_Amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">
                      ₹{rec.Unallocated_Amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.Receipt_Status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {rec.Receipt_Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {rec.Receipt_Status === 'Pending Verification' && activeRole !== 'Resident' ? (
                        <button
                          onClick={() => setConfirmingReceipt(rec)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 shadow-2xs cursor-pointer"
                        >
                          Verify & Allocate
                        </button>
                      ) : rec.Receipt_Status === 'Confirmed' ? (
                        <button onClick={() => setPreviewReceipt(rec)} className="text-xs font-semibold text-[#536B4D] hover:underline cursor-pointer">View Receipt</button>
                      ) : <span className="text-[10px] text-amber-700">Awaiting verification</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: BILL-WISE ALLOCATION REGISTER */}
      {subTab === 'allocation' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC]">
            <h3 className="font-bold text-[#29352D] text-sm">Bill-wise Details Register (Sheet G)</h3>
            <p className="text-xs text-gray-500">
              Audit trail showing how payments are matched and applied to individual invoices
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Allocation ID</th>
                  <th className="px-4 py-3 font-semibold">Invoice No</th>
                  <th className="px-4 py-3 font-semibold">Property ID</th>
                  <th className="px-4 py-3 font-semibold">Allocation Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Invoice Amt</th>
                  <th className="px-4 py-3 font-semibold text-right">O/S Before</th>
                  <th className="px-4 py-3 font-semibold text-right text-emerald-200">Allocated Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">O/S After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {billAllocations.map((a) => (
                  <tr key={a.Allocation_ID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500">{a.Allocation_ID}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D]">{a.Invoice_Number}</td>
                    <td className="px-4 py-3 font-mono text-[#536B4D]">{a.PropertyID}</td>
                    <td className="px-4 py-3 text-gray-600">{a.Allocation_Date}</td>
                    <td className="px-4 py-3 text-right">₹{a.Invoice_Amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">₹{a.Outstanding_Before.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      +₹{a.Allocated_Amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                      ₹{a.Outstanding_After.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ADVANCE BALANCES */}
      {subTab === 'advances' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC]">
            <h3 className="font-bold text-[#29352D] text-sm">Advance Payments Register</h3>
            <p className="text-xs text-gray-500">Unallocated payments held for future monthly billing</p>
          </div>

          <div className="p-6 space-y-4">
            {receipts.filter((r) => r.Receipt_Status === 'Confirmed' && r.Unallocated_Amount > 0).map((rec) => (
              <div
                key={rec.Transaction_ID}
                className="flex items-center justify-between p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs"
              >
                <div>
                  <span className="font-bold text-amber-900 text-sm">Flat {rec.Flat_No} • {rec.Owner_Name}</span>
                  <p className="text-gray-600 mt-0.5">
                    Receipt: {rec.Receipt_Number} | Received: ₹{rec.Received_Amount.toFixed(2)} via {rec.Received_Mode}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 block">Available Advance Credit</span>
                  <span className="text-lg font-bold text-amber-900">₹{rec.Unallocated_Amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {receipts.filter((r) => r.Unallocated_Amount > 0).length === 0 && (
              <p className="text-xs text-gray-500 italic text-center p-6">No advance balances remaining.</p>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL (Accountant / Admin) */}
      {confirmingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E8E1D4] space-y-4 text-xs">
            <h3 className="text-base font-bold text-[#29352D] border-b border-[#E8E1D4] pb-2">
              Confirm Receipt & Allocate / পেমেন্ট যাচাই ও সমন্বয়
            </h3>
            <p className="text-[#29352D]/80">
              Confirm bank realization of <strong>₹{confirmingReceipt.Received_Amount.toFixed(2)}</strong> from{' '}
              <strong>{confirmingReceipt.Owner_Name}</strong> (Flat {confirmingReceipt.Flat_No}).
            </p>
            <div className="p-3 rounded-xl bg-[#F7F4EC] space-y-1 font-mono text-[11px]">
              <p>Reference: {confirmingReceipt.Received_Reference}</p>
              <p>Mode: {confirmingReceipt.Received_Mode}</p>
              <p>Target Account: {confirmingReceipt.Bank_Account}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E1D4]">
              <button
                onClick={() => setConfirmingReceipt(null)}
                className="px-4 py-2 rounded-xl border border-[#E8E1D4] text-[#29352D] hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmReceipt(confirmingReceipt)}
                className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 shadow-xs"
              >
                Verify & Apply Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
