/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  PlusCircle,
} from 'lucide-react';
import { PaymentMode, FundInflowRegister } from '../../types/database';
import { formatDateDisplay } from '../../utils/dateFormat';
import { computeInvoiceOutstandingBills } from '../../utils/invoiceOutstanding';

interface Props {
  initialSubTab?: 'pay_now' | 'receipts' | 'allocation' | 'advances' | 'record';
}

const toAmt = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtAmt = (v: unknown): string => toAmt(v).toFixed(2);

export const PaymentsView: React.FC<Props> = ({ initialSubTab = 'receipts' }) => {
  const {
    activeRole,
    setActiveTab,
    canAccessTab,
    hasPermission,
    residentProperty,
    properties,
    owners,
    ownerships,
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
    initialSubTab
  );

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab, activeRole]);

  const handleSelectSubTab = (nextTab: 'pay_now' | 'receipts' | 'allocation' | 'advances' | 'record') => {
    setSubTab(nextTab);
    if (activeRole === 'Resident') return;
    const navTabMap: Partial<Record<'receipts' | 'allocation' | 'advances' | 'record', string>> = {
      record: 'payments_record',
      receipts: 'payments_receipts',
      allocation: 'payments_allocation',
      advances: 'payments_advances',
    };
    const targetNavTab = navTabMap[nextTab as 'receipts' | 'allocation' | 'advances' | 'record'];
    if (targetNavTab && canAccessTab(targetNavTab)) {
      setActiveTab(targetNavTab);
    }
  };

  // Resident data is scoped to the authenticated flat/property in the UI; backend authorization must enforce the same scope.
  const residentScopedReceipts = useMemo(
    () => (activeRole === 'Resident' ? receipts.filter(r => r.PropertyID === residentProperty?.PropertyID) : receipts),
    [activeRole, receipts, residentProperty?.PropertyID]
  );
  const residentScopedAllocations = useMemo(
    () => (activeRole === 'Resident' ? billAllocations.filter(a => a.PropertyID === residentProperty?.PropertyID) : billAllocations),
    [activeRole, billAllocations, residentProperty?.PropertyID]
  );

  const computedInvoices = useMemo(
    () => computeInvoiceOutstandingBills(invoices, billAllocations, receipts),
    [invoices, billAllocations, receipts]
  );

  // Resident "Pay Now" flow state
  const myInvoices = useMemo(
    () =>
      computedInvoices.filter(
        (i) =>
          i.PropertyID === residentProperty?.PropertyID &&
          !['cancelled', 'draft', 'pending_approval', 'pending approval'].includes(String(i.Invoice_Status || '').trim().toLowerCase()) &&
          toAmt(i.Calculated_Outstanding) > 0
      ),
    [computedInvoices, residentProperty?.PropertyID]
  );

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(
    () => myInvoices.map((i) => i.InvoiceID)
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

  // Admin / Accountant "Record Payment" flow state
  const [recordPropertyId, setRecordPropertyId] = useState<string>(() => properties[0]?.PropertyID || '');
  const [recordInvoiceIds, setRecordInvoiceIds] = useState<string[]>([]);
  const [recordAmount, setRecordAmount] = useState<string>('');
  const [recordMode, setRecordMode] = useState<PaymentMode>('UPI');
  const [recordRef, setRecordRef] = useState('');
  const [recordBankAccount, setRecordBankAccount] = useState<string>(() => bankAccounts[0]?.BankAccount_ID || '');
  const [recordRemarks, setRecordRemarks] = useState('');
  const [recordSuccess, setRecordSuccess] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    if (!recordPropertyId && properties.length > 0) {
      setRecordPropertyId(properties[0].PropertyID);
    }
  }, [properties, recordPropertyId]);

  useEffect(() => {
    if (!recordBankAccount && bankAccounts.length > 0) {
      setRecordBankAccount(bankAccounts[0].BankAccount_ID);
    }
  }, [bankAccounts, recordBankAccount]);

  const recordPropertyInvoices = useMemo(
    () =>
      computedInvoices.filter(
        (inv) =>
          String(inv.PropertyID || '') === String(recordPropertyId || '') &&
          !['cancelled', 'draft', 'pending_approval', 'pending approval'].includes(String(inv.Invoice_Status || '').trim().toLowerCase()) &&
          toAmt(inv.Calculated_Outstanding) > 0
      ),
    [computedInvoices, recordPropertyId]
  );

  const selectedRecordOwnership = useMemo(
    () =>
      ownerships.find(
        (o) =>
          String(o.PropertyID || '') === String(recordPropertyId || '') &&
          String(o.Ownership_Status || '').trim().toLowerCase() === 'current'
      ) || ownerships.find((o) => String(o.PropertyID || '') === String(recordPropertyId || '')),
    [ownerships, recordPropertyId]
  );

  const selectedRecordOwner = useMemo(
    () => owners.find((o) => String(o.OwnerID || '') === String(selectedRecordOwnership?.OwnerID || '')),
    [owners, selectedRecordOwnership?.OwnerID]
  );

  const handleToggleRecordInvoice = (invoiceId: string) => {
    setRecordInvoiceIds((prev) => {
      const next = prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId];
      const selectedTotal = recordPropertyInvoices
        .filter((inv) => next.includes(inv.InvoiceID))
        .reduce((sum, inv) => sum + toAmt(inv.Outstanding_Amount), 0);
      setRecordAmount(selectedTotal > 0 ? selectedTotal.toFixed(2) : '');
      return next;
    });
  };

  const handleAdminRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = toAmt(recordAmount);
    if (!recordPropertyId || numericAmount <= 0 || recordingPayment) return;
    setRecordingPayment(true);
    try {
      const created = await submitResidentPayment({
        propertyId: recordPropertyId,
        invoiceIds: recordInvoiceIds,
        amount: numericAmount,
        mode: recordMode,
        reference: recordRef,
        bankAccount: recordBankAccount,
        remarks: recordRemarks,
      });
      setRecordSuccess(`Payment recorded (Transaction ID: ${created.Transaction_ID}) with status "Pending Verification". Verify & allocate it from Receipt Register.`);
      setRecordRef('');
      setRecordRemarks('');
      setRecordInvoiceIds([]);
      setRecordAmount('');
    } catch (error: any) {
      window.alert(error?.message || 'Payment could not be recorded.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const advanceReceipts = useMemo(
    () =>
      receipts.filter(
        (r) => String(r.Receipt_Status || '').trim().toLowerCase() === 'confirmed' && toAmt(r.Unallocated_Amount) > 0
      ),
    [receipts]
  );

  // Selected invoices total sum
  const payableTotal = myInvoices
    .filter((inv) => selectedInvoiceIds.includes(inv.InvoiceID))
    .reduce((sum, inv) => sum + toAmt(inv.Outstanding_Amount), 0);

  const handleToggleInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const [submittingPayment, setSubmittingPayment] = useState(false);
  const handleResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payableTotal <= 0 || submittingPayment) return;
    setSubmittingPayment(true);
    try {
      const receipt = await submitResidentPayment({
        invoiceIds: selectedInvoiceIds, amount: payableTotal, mode: payMode, reference: payRef,
        bankAccount: bankAccounts[0]?.BankAccount_ID || '', remarks: residentRemarks,
      });
      let attachmentMessage = '';
      if (proofFile) {
        try {
          await uploadPrivateFile(proofFile, 'Payment Proof', residentProperty?.PropertyID, undefined, 'receipts', receipt.Transaction_ID);
          attachmentMessage = ' Payment proof uploaded.';
        } catch (uploadError:any) {
          attachmentMessage = ` Payment was saved, but proof upload failed: ${uploadError?.message || 'Please contact the Society Admin.'}`;
        }
      }
      setResidentSubmitSuccess(`Payment submitted for verification. Transaction ID: ${receipt.Transaction_ID}.${attachmentMessage} An official receipt will be issued after confirmation.`);
      setProofFile(null);
      setPayRef('');
      window.setTimeout(() => setResidentSubmitSuccess(''), 7000);
    } catch (error:any) {
      window.alert(error?.message || 'Payment could not be submitted. Please check the payment register before retrying.');
    } finally { setSubmittingPayment(false); }
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
            {activeRole === 'Resident' && initialSubTab === 'receipts' ? 'My Receipts / আমার রসিদ' : `${t.navPayments} / পেমেন্ট ও মানি রসিদ`}
          </h1>
          <p className="text-xs text-gray-500">
            Society UPI payments, fund inflow tracking, and safe bill-wise allocation
          </p>
        </div>

        <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#E8E1D4]">
          {activeRole === 'Resident' ? (
            <>
              {initialSubTab === 'pay_now' && <button
                onClick={() => setSubTab('pay_now')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'pay_now'
                    ? 'bg-[#C97958] text-white shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Pay Bills Online
              </button>}
              {initialSubTab === 'receipts' && <button
                onClick={() => setSubTab('receipts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'receipts'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                My Receipts
              </button>}
            </>
          ) : (
            <>
              {hasPermission('Payments', 'Can_Create') && (
                <button
                  onClick={() => handleSelectSubTab('record')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    subTab === 'record'
                      ? 'bg-white text-[#536B4D] shadow-xs'
                      : 'text-[#29352D]/70 hover:text-[#29352D]'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Record Payment
                </button>
              )}
              <button
                onClick={() => handleSelectSubTab('receipts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'receipts'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Receipt Register ({receipts.length})
              </button>
              {(hasPermission('Bill Wise Details','Can_Edit') || subTab === 'allocation') && <button
                onClick={() => handleSelectSubTab('allocation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'allocation'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Bill Allocations ({billAllocations.length})
              </button>}
              <button
                onClick={() => handleSelectSubTab('advances')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  subTab === 'advances'
                    ? 'bg-white text-[#536B4D] shadow-xs'
                    : 'text-[#29352D]/70 hover:text-[#29352D]'
                }`}
              >
                Advance Balances ({advanceReceipts.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* SUBTAB 0: ADMIN / ACCOUNTANT RECORD PAYMENT */}
      {subTab === 'record' && activeRole !== 'Resident' && (
        <div className="max-w-3xl mx-auto rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-5">
          <div className="border-b border-[#E8E1D4] pb-3">
            <h2 className="text-lg font-bold text-[#29352D] flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-[#536B4D]" />
              Record Society Payment / পেমেন্ট এন্ট্রি
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Record a flat owner payment into Fund Inflow Register for bank verification and bill-wise allocation.
            </p>
          </div>

          {recordSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {recordSuccess}
              </span>
              <button
                type="button"
                onClick={() => handleSelectSubTab('receipts')}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer shrink-0"
              >
                Open Receipt Register
              </button>
            </div>
          )}

          <form onSubmit={handleAdminRecordPayment} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Select Flat / Property:</label>
                <select
                  value={recordPropertyId}
                  onChange={(e) => {
                    setRecordPropertyId(e.target.value);
                    setRecordInvoiceIds([]);
                    setRecordAmount('');
                  }}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2.5 font-medium text-[#29352D]"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.PropertyID} value={p.PropertyID}>
                      Flat {p.Flat_No} ({p.Block_Tower || p.PropertyID})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Owner: {selectedRecordOwner?.Owner_Name || '—'} | Ownership: {selectedRecordOwnership?.Ownership_ID || '—'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Bank Account:</label>
                <select
                  value={recordBankAccount}
                  onChange={(e) => setRecordBankAccount(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2.5 text-[#29352D]"
                >
                  <option value="">Select Bank Account (Optional)</option>
                  {bankAccounts
                    .filter((b) => String(b.Status || 'Active') === 'Active')
                    .map((b) => (
                      <option key={b.BankAccount_ID} value={b.BankAccount_ID}>
                        {b.Bank_Name} ({b.Account_Type})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {recordPropertyInvoices.length > 0 && (
              <div className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC]/60 p-3.5 space-y-2">
                <span className="block font-semibold text-[#29352D]">Pending Invoices (Optional selection to auto-fill amount):</span>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {recordPropertyInvoices.map((inv) => {
                    const checked = recordInvoiceIds.includes(inv.InvoiceID);
                    return (
                      <label
                        key={inv.InvoiceID}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${
                          checked ? 'border-[#536B4D] bg-white' : 'border-[#E8E1D4] bg-white/70'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleRecordInvoice(inv.InvoiceID)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="font-semibold text-[#29352D]">{inv.Invoice_Number}</span>
                          <span className="text-gray-500">({inv.Purpose} • Due {formatDateDisplay(inv.Due_Date, '—')})</span>
                        </span>
                        <span className="font-bold text-red-700">₹{fmtAmt(inv.Outstanding_Amount)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Amount Received (₹):</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="e.g. 3700"
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 font-bold text-[#29352D]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Payment Mode:</label>
                <select
                  value={recordMode}
                  onChange={(e) => setRecordMode(e.target.value as PaymentMode)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                >
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="IMPS">IMPS</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">
                  UTR / Cheque Ref {recordMode === 'Cash' ? '(Optional)' : '(Required)'}:
                </label>
                <input
                  type="text"
                  required={recordMode !== 'Cash'}
                  placeholder="e.g. UTR123456"
                  value={recordRef}
                  onChange={(e) => setRecordRef(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 font-mono text-[#29352D]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#29352D] mb-1">Remarks:</label>
              <input
                type="text"
                placeholder="Optional receipt remarks..."
                value={recordRemarks}
                onChange={(e) => setRecordRemarks(e.target.value)}
                className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E8E1D4]">
              <button
                type="button"
                onClick={() => handleSelectSubTab('receipts')}
                className="px-4 py-2.5 rounded-xl border border-[#E8E1D4] text-[#29352D] hover:bg-neutral-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment || !recordPropertyId || toAmt(recordAmount) <= 0}
                className="px-6 py-2.5 rounded-xl bg-[#536B4D] text-white font-bold hover:bg-[#3F523A] shadow-xs cursor-pointer disabled:opacity-50"
              >
                {recordingPayment ? 'Recording Payment…' : 'Record Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                              Period: {formatDateDisplay(inv.Bill_Period_From, '—')} to {formatDateDisplay(inv.Bill_Period_To, '—')} | Due: {formatDateDisplay(inv.Due_Date, '—')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm text-[#29352D]">
                            ₹{fmtAmt(inv.Outstanding_Amount)}
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
                  disabled={payableTotal <= 0 || !payRef || submittingPayment}
                  className="w-full rounded-xl bg-[#C97958] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#A95D3E] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {submittingPayment ? 'Saving payment & uploading proof…' : 'Submit Payment For Verification'}
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
              <h3 className="font-bold text-[#29352D] text-sm">{activeRole === 'Resident' ? 'My Receipts / আমার রসিদ' : 'Fund Inflow Register / প্রাপ্তি রেজিস্টার'}</h3>
              <p className="text-xs text-gray-500">{activeRole === 'Resident' ? 'Your receipts and bill-wise payment adjustments' : 'Official Society Receipts and Inflow Log'}</p>
            </div>
            <span className="text-xs text-gray-500">{residentScopedReceipts.length} Total Receipts</span>
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
                {residentScopedReceipts.map((rec) => (
                  <React.Fragment key={rec.Transaction_ID}>
                  <tr className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#29352D]">{rec.Receipt_Number || rec.Transaction_ID}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDateDisplay(rec.Date_Of_Received, '—')}</td>
                    <td className="px-4 py-3 font-bold text-[#536B4D]">{rec.Flat_No}</td>
                    <td className="px-4 py-3 font-medium">{rec.Owner_Name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                      {rec.Received_Mode} • {rec.Received_Reference}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                      ₹{fmtAmt(rec.Received_Amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">
                      ₹{fmtAmt(rec.Unallocated_Amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.Receipt_Status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rec.Receipt_Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {rec.Receipt_Status === 'Pending Verification' && activeRole !== 'Resident' && hasPermission('Payments','Can_Approve') ? (
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
                  {activeRole === 'Resident' && residentScopedAllocations.filter(a => a.Transaction_ID === rec.Transaction_ID).length > 0 && (
                    <tr className="bg-[#F7F4EC]/70">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="font-semibold text-[#536B4D] mb-1">Bill-wise Allocation / বিল অনুযায়ী সমন্বয়</div>
                        <div className="flex flex-wrap gap-2">
                          {residentScopedAllocations.filter(a => a.Transaction_ID === rec.Transaction_ID).map(a => (
                            <span key={a.Allocation_ID} className="rounded-lg border border-[#E8E1D4] bg-white px-3 py-2 text-[11px]">
                              <strong className="block text-[#29352D]">{a.Invoice_Number}</strong>
                              <span className="block text-gray-500">Invoice: ₹{toAmt(a.Invoice_Amount).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                              <span className="block text-emerald-700">Allocated: ₹{toAmt(a.Allocated_Amount).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                              <span className="block text-amber-700">Balance After: ₹{toAmt(a.Outstanding_After).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
                {residentScopedReceipts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 italic">
                      No receipts recorded yet.
                    </td>
                  </tr>
                )}
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
                    <td className="px-4 py-3 text-gray-600">{formatDateDisplay(a.Allocation_Date, '—')}</td>
                    <td className="px-4 py-3 text-right">₹{fmtAmt(a.Invoice_Amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">₹{fmtAmt(a.Outstanding_Before)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      +₹{fmtAmt(a.Allocated_Amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                      ₹{fmtAmt(a.Outstanding_After)}
                    </td>
                  </tr>
                ))}
                {billAllocations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 italic">
                      No bill-wise allocations recorded yet.
                    </td>
                  </tr>
                )}
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
            {advanceReceipts.map((rec) => (
              <div
                key={rec.Transaction_ID}
                className="flex items-center justify-between p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs"
              >
                <div>
                  <span className="font-bold text-amber-900 text-sm">Flat {rec.Flat_No} • {rec.Owner_Name}</span>
                  <p className="text-gray-600 mt-0.5">
                    Receipt: {rec.Receipt_Number || rec.Transaction_ID} | Received: ₹{fmtAmt(rec.Received_Amount)} via {rec.Received_Mode}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 block">Available Advance Credit</span>
                  <span className="text-lg font-bold text-amber-900">₹{fmtAmt(rec.Unallocated_Amount)}</span>
                </div>
              </div>
            ))}
            {advanceReceipts.length === 0 && (
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
              Confirm bank realization of <strong>₹{fmtAmt(confirmingReceipt.Received_Amount)}</strong> from{' '}
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
