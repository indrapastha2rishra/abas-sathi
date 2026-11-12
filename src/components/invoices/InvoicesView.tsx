/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  Printer,
  Calendar,
  AlertCircle,
  CheckCircle,
  FileText,
  Calculator,
} from 'lucide-react';
import { calculateChargeAmount, calculateNetChargeAmount } from '../../utils/calculations';

interface Props {
  initialTab?: 'register' | 'generate' | 'rates' | 'outstanding';
}

export const InvoicesView: React.FC<Props> = ({ initialTab = 'register' }) => {
  const {
    invoices,
    properties,
    rates,
    generateInvoice,
    cancelInvoice,
    setPreviewInvoice,
    activeRole,
    t,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'register' | 'generate' | 'rates' | 'outstanding'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Generator form state
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?.PropertyID || '');
  const [selectedRateId, setSelectedRateId] = useState(rates[0]?.RateID || '');
  const [billPeriodFrom, setBillPeriodFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; });
  const [billPeriodTo, setBillPeriodTo] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(new Date(d.getFullYear(),d.getMonth()+1,0).getDate()).padStart(2,'0')}`; });
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()+30); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [lateFee, setLateFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!selectedPropertyId && properties.length) setSelectedPropertyId(properties[0].PropertyID);
    if (!selectedRateId && rates.length) setSelectedRateId(rates[0].RateID);
  }, [properties, rates, selectedPropertyId, selectedRateId]);

  // Selected property & rate for calculation preview
  const currentProperty = properties.find((p) => p.PropertyID === selectedPropertyId) || properties[0];
  const currentRate = rates.find((r) => r.RateID === selectedRateId) || rates[0];

  const previewArea = currentRate?.Area_Basis === 'Structural_Area' ? currentProperty?.Structural_Area || 0
    : currentRate?.Area_Basis === 'Carpet_Area' ? currentProperty?.Carpet_Area || 0
    : currentRate?.Area_Basis === 'Allocated_Common_Area' ? currentProperty?.Allocated_Common_Area || 0
    : currentRate?.Area_Basis === 'Super_Built-up_Area' ? currentProperty?.Super_Built_up_Area || 0 : 1;

  const baseCharge = currentRate
    ? calculateChargeAmount(currentRate.Calculation_Method, currentRate.Rate_Per_SqFt_Unit, previewArea, 1)
    : 0;

  const netCharge = calculateNetChargeAmount(baseCharge, lateFee, discount, adjustment);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
    const newInv = await generateInvoice({
      propertyId: selectedPropertyId, rateId: selectedRateId, billPeriodFrom, billPeriodTo, dueDate,
      lateFee: Number(lateFee), discount: Number(discount), adjustment: Number(adjustment), remarks,
    });

    setSuccessMessage(`Invoice ${newInv.Invoice_Number} generated successfully for Flat ${newInv.Flat_Number}!`);
    setTimeout(() => {
      setSuccessMessage('');
      setPreviewInvoice(newInv);
      setActiveSubTab('register');
    }, 1200);
    } catch (error:any) { window.alert(error?.message || 'Invoice could not be saved. Please retry.'); }
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.Invoice_Number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.Flat_Number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.Owner_Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.Purpose.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All'
        ? activeSubTab === 'outstanding'
          ? inv.Outstanding_Amount > 0
          : true
        : inv.Invoice_Status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#536B4D]" />
            {t.navMaintenanceInvoices} / রক্ষণাবেক্ষণ ও ইনভয়েস
          </h1>
          <p className="text-xs text-gray-500">
            Automated rate-based invoicing, snapshot retention, and outstanding ledger
          </p>
        </div>

        <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#E8E1D4]">
          <button
            onClick={() => setActiveSubTab('register')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'register'
                ? 'bg-white text-[#536B4D] shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Invoice Register ({invoices.length})
          </button>
          {activeRole !== 'Committee' && (
            <button
              onClick={() => setActiveSubTab('generate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'generate'
                  ? 'bg-white text-[#536B4D] shadow-xs'
                  : 'text-[#29352D]/70 hover:text-[#29352D]'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Generate Invoice
            </button>
          )}
          <button
            onClick={() => setActiveSubTab('rates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'rates'
                ? 'bg-white text-[#536B4D] shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Rate Master
          </button>
          <button
            onClick={() => setActiveSubTab('outstanding')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'outstanding'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Outstanding Dues
          </button>
        </div>
      </div>

      {/* SUBTAB 1: INVOICE REGISTER & OUTSTANDING */}
      {(activeSubTab === 'register' || activeSubTab === 'outstanding') && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-[#E8E1D4] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoice no, flat no, owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] pl-9 pr-3 py-2 text-xs text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Pending Verification">Pending Verification</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#536B4D] text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Invoice No</th>
                    <th className="px-4 py-3 font-semibold">Flat No</th>
                    <th className="px-4 py-3 font-semibold">Owner Name</th>
                    <th className="px-4 py-3 font-semibold">Purpose</th>
                    <th className="px-4 py-3 font-semibold">Billing Period</th>
                    <th className="px-4 py-3 font-semibold">Due Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Net Charge</th>
                    <th className="px-4 py-3 font-semibold text-right">Paid</th>
                    <th className="px-4 py-3 font-semibold text-right">Due</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.InvoiceID} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#29352D]">{inv.Invoice_Number}</td>
                      <td className="px-4 py-3 font-bold text-[#536B4D]">{inv.Flat_Number}</td>
                      <td className="px-4 py-3 font-medium">{inv.Owner_Name}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.Purpose}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {inv.Bill_Period_From} to {inv.Bill_Period_To}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{inv.Due_Date}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                        ₹{inv.Net_Charge_Amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        ₹{inv.Paid_Amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">
                        ₹{inv.Outstanding_Amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.Invoice_Status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.Invoice_Status === 'Overdue'
                              ? 'bg-red-100 text-red-800'
                              : inv.Invoice_Status === 'Pending Verification'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.Invoice_Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => setPreviewInvoice(inv)} className="flex items-center gap-1 text-xs font-semibold text-[#536B4D] hover:underline cursor-pointer">
                            <Printer className="h-3.5 w-3.5" /><span>View</span>
                          </button>
                          {activeRole==='Admin'&&inv.Invoice_Status!=='Cancelled'&&Number(inv.Paid_Amount||0)===0&&<button onClick={async()=>{const reason=window.prompt('Invoice cancellation reason:');if(!reason?.trim())return;try{await cancelInvoice(inv.InvoiceID,reason);}catch(e:any){window.alert(e?.message||'Invoice cancellation failed.');}}} className="text-xs font-semibold text-red-700 hover:underline">Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-gray-500 italic">
                        No invoices found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: GENERATE INVOICE FORM */}
      {activeSubTab === 'generate' && (
        <div className="max-w-3xl mx-auto rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="border-b border-[#E8E1D4] pb-3 mb-6">
            <h2 className="text-lg font-bold text-[#29352D] flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#536B4D]" />
              Generate Society Maintenance Invoice / নতুন ইনভয়েস তৈরি
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Select flat and approved rate to automatically snapshot property area and calculate net charges.
            </p>
          </div>

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {successMessage}
            </div>
          )}

          <form onSubmit={handleCreateInvoice} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Property */}
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">
                  Select Flat / ফ্ল্যাট নির্বাচন:
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2.5 font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.PropertyID} value={p.PropertyID}>
                      Flat {p.Flat_No} ({p.Block_Tower}) - {p.Super_Built_up_Area} sq.ft
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Super Built-up Area: {currentProperty?.Super_Built_up_Area} | Structural Area: {currentProperty?.Structural_Area} sq.ft | Floor: {currentProperty?.Floor_No}
                </p>
              </div>

              {/* Select Rate Master */}
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">
                  Approved Rate Schedule / রেট নির্বাচন:
                </label>
                <select
                  value={selectedRateId}
                  onChange={(e) => setSelectedRateId(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2.5 font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
                  required
                >
                  {rates.map((r) => (
                    <option key={r.RateID} value={r.RateID}>
                      {r.Purpose} ({r.Calculation_Method} @ ₹{r.Rate_Per_SqFt_Unit})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Method: {currentRate?.Calculation_Method} | Basis: {currentRate?.Area_Basis}
                </p>
              </div>
            </div>

            {/* Billing Period Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Period From:</label>
                <input
                  type="date"
                  value={billPeriodFrom}
                  onChange={(e) => setBillPeriodFrom(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Period To:</label>
                <input
                  type="date"
                  value={billPeriodTo}
                  onChange={(e) => setBillPeriodTo(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Due Date:</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                  required
                />
              </div>
            </div>

            {/* Financial Adjustments */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Late Fee (₹):</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lateFee}
                  onChange={(e) => setLateFee(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-[#29352D]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">Discount (₹):</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-[#29352D]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#29352D] mb-1">
                  Adjustment (₹): <span className="text-[10px] text-gray-500">(+debit, -credit)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={adjustment}
                  onChange={(e) => setAdjustment(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 text-[#29352D]"
                />
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="p-4 rounded-xl bg-[#536B4D]/5 border border-[#536B4D]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#536B4D] block">
                  Calculation Snapshot Preview
                </span>
                <p className="text-xs text-[#29352D] mt-0.5">
                  Base Charge ({previewArea} sq.ft × ₹{currentRate?.Rate_Per_SqFt_Unit}): <strong>₹{baseCharge.toFixed(2)}</strong>
                </p>
                <p className="text-[11px] text-gray-500">
                  Late Fee (+₹{lateFee}) - Discount (-₹{discount}) + Adjustment (₹{adjustment})
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block">Total Net Charge:</span>
                <span className="text-2xl font-bold text-[#536B4D]">₹{netCharge.toFixed(2)}</span>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block font-semibold text-[#29352D] mb-1">Remarks / বিবরণ:</label>
              <input
                type="text"
                placeholder="Optional notes or special resolution reference..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E8E1D4]">
              <button
                type="button"
                onClick={() => setActiveSubTab('register')}
                className="rounded-xl border border-[#E8E1D4] px-4 py-2.5 text-xs font-semibold text-[#29352D] hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#536B4D] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#3F523A] transition-colors shadow-xs cursor-pointer"
              >
                Issue Invoice & Save Snapshot
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 3: MAINTENANCE RATE MASTER */}
      {activeSubTab === 'rates' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] flex justify-between items-center bg-[#F7F4EC]">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">Maintenance Rate Master / রেট মাস্টার</h3>
              <p className="text-xs text-gray-500">Approved rate schedules passed by AGM Committee</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#536B4D]/10 text-[#536B4D]">
              All Rates Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rate ID</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">Calculation Method</th>
                  <th className="px-4 py-3 font-semibold">Area Basis</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate / Unit</th>
                  <th className="px-4 py-3 font-semibold">Effective From</th>
                  <th className="px-4 py-3 font-semibold">Approved By</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {rates.map((rate) => (
                  <tr key={rate.RateID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#29352D]">{rate.RateID}</td>
                    <td className="px-4 py-3 font-bold text-[#536B4D] text-sm">{rate.Purpose}</td>
                    <td className="px-4 py-3 font-medium">{rate.Calculation_Method}</td>
                    <td className="px-4 py-3 text-gray-600">{rate.Area_Basis}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                      ₹{rate.Rate_Per_SqFt_Unit.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{rate.Effective_From}</td>
                    <td className="px-4 py-3 text-gray-600">{rate.Approved_By}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {rate.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
