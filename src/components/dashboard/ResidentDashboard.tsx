/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  Receipt,
  CreditCard,
  Clock,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Image as ImageIcon,
  ArrowRight,
  Shield,
  FileCheck,
} from 'lucide-react';

export const ResidentDashboard: React.FC = () => {
  const {
    currentUser,
    residentProperty,
    invoices,
    receipts,
    activityRequests,
    notices,
    gallery,
    t,
    setActiveTab,
    setPreviewInvoice,
    setPreviewReceipt,
  } = useApp();

  const myProperty = residentProperty;

  // Filter bills & receipts belonging specifically to this flat
  const myInvoices = invoices.filter((i) => i.PropertyID === myProperty?.PropertyID);
  const myReceipts = receipts.filter((r) => r.PropertyID === myProperty?.PropertyID);
  const myRequests = activityRequests.filter((r) => r.PropertyID === myProperty?.PropertyID);

  const totalOutstanding = myInvoices.reduce((sum, inv) => sum + (inv.Outstanding_Amount || 0), 0);
  const nextDueDate = myInvoices.find((i) => i.Outstanding_Amount > 0)?.Due_Date || 'None Pending';

  return (
    <div className="space-y-6">
      {/* Resident Welcome & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#536B4D] to-[#3F523A] p-6 text-white shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#C97958] text-white">
              Resident Portal / বাসিন্দা কর্নার
            </span>
            <span className="text-xs text-white/80">Flat {myProperty?.Flat_No} ({myProperty?.Block_Tower})</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Welcome, {currentUser.Full_Name}
          </h1>
          <p className="text-xs text-white/80 mt-0.5">
            {t.apartmentName} • {myProperty?.Block_Tower}, Floor {myProperty?.Floor_No}
          </p>
        </div>

        {/* Quick Pay Action Card */}
        <div className="rounded-xl bg-white/10 p-4 backdrop-blur-xs border border-white/20 flex items-center justify-between gap-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-white/70 block">My Outstanding Dues</span>
            <span className="text-2xl font-bold text-white">₹{totalOutstanding.toLocaleString('en-IN')}</span>
            <span className="block text-[10px] text-amber-200 mt-0.5">Next Due: {nextDueDate}</span>
          </div>
          <button
            onClick={() => setActiveTab('resident_pay')}
            className="flex items-center gap-2 rounded-xl bg-[#C97958] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#A95D3E] shadow-sm transition-all cursor-pointer"
          >
            <CreditCard className="h-4 w-4" />
            <span>Pay Now</span>
          </button>
        </div>
      </div>

      {/* Grid: Flat Details & Recent Requests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* My Flat Information Card */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D] flex items-center gap-1.5">
              <Home className="h-4 w-4" />
              Flat Information
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {myProperty?.Occupancy_Status}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Flat Number:</span>
              <span className="font-bold text-[#29352D]">{myProperty?.Flat_No} ({myProperty?.Block_Tower})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Unit Type:</span>
              <span className="font-semibold text-[#29352D]">{myProperty?.Property_Type}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Super Builtup Area:</span>
              <span className="font-bold text-[#536B4D]">{myProperty?.Super_Builtup_Area} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Covered Area:</span>
              <span className="font-medium text-[#29352D]">{myProperty?.Cover_Area} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#29352D]/70">Property ID:</span>
              <span className="font-mono text-[11px] text-[#29352D]/80">{myProperty?.PropertyID}</span>
            </div>
          </div>
        </div>

        {/* Quick Outstanding Summary */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D] flex items-center gap-1.5">
              <Receipt className="h-4 w-4" />
              Billing Summary
            </span>
            <button
              onClick={() => setActiveTab('resident_bills')}
              className="text-xs font-bold text-[#536B4D] hover:underline"
            >
              All Bills
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Current Invoices:</span>
              <span className="font-bold text-[#29352D]">{myInvoices.length} Issued</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Paid In Full:</span>
              <span className="font-semibold text-emerald-700">
                {myInvoices.filter((i) => i.Invoice_Status === 'Paid').length}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/50">
              <span className="text-[#29352D]/70">Pending Verification:</span>
              <span className="font-semibold text-amber-700">
                {myInvoices.filter((i) => i.Invoice_Status === 'Pending Verification').length}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#29352D]/70">Overdue Invoices:</span>
              <span className="font-bold text-red-700">
                {myInvoices.filter((i) => i.Invoice_Status === 'Overdue').length}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Service Request */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#536B4D] flex items-center gap-1.5">
              <Wrench className="h-4 w-4" />
              Service Requests
            </span>
            <button
              onClick={() => setActiveTab('resident_requests')}
              className="text-xs font-bold text-[#536B4D] hover:underline"
            >
              Raise Request
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <p className="text-gray-500">
              Need assistance with plumbing, common electrical, or lift issues?
            </p>
            <div className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4]">
              <span className="text-[11px] font-bold text-[#29352D]">Active Tickets: {myRequests.length}</span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {myRequests.filter((r) => r.Request_Status === 'In Progress').length} in progress,{' '}
                {myRequests.filter((r) => r.Request_Status === 'Completed').length} resolved
              </p>
            </div>
            <button
              onClick={() => setActiveTab('resident_requests')}
              className="w-full mt-2 rounded-lg border border-[#536B4D] py-1.5 text-xs font-bold text-[#536B4D] hover:bg-[#536B4D] hover:text-white transition-colors"
            >
              + Raise New Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Recent Bills & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#536B4D]" />
              Recent Bills / সাম্প্রতিক বিলসমূহ
            </h3>
            <button
              onClick={() => setActiveTab('resident_bills')}
              className="text-xs text-[#536B4D] font-bold hover:underline"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {myInvoices.slice(0, 4).map((inv) => (
              <div
                key={inv.InvoiceID}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#29352D]">{inv.Invoice_Number}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Period: {inv.Bill_Period_From} to {inv.Bill_Period_To}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-[#29352D]">₹{inv.Net_Charge_Amount.toFixed(2)}</span>
                  <div className="mt-1">
                    <button
                      onClick={() => setPreviewInvoice(inv)}
                      className="text-[11px] font-semibold text-[#536B4D] hover:underline cursor-pointer"
                    >
                      Download Bill
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payments & Receipts */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              Payment History & Receipts / রসিদ
            </h3>
            <button
              onClick={() => setActiveTab('resident_history')}
              className="text-xs text-[#536B4D] font-bold hover:underline"
            >
              All Receipts
            </button>
          </div>

          <div className="space-y-3">
            {myReceipts.slice(0, 4).map((rec) => (
              <div
                key={rec.Transaction_ID}
                className="flex items-center justify-between p-3.5 rounded-xl border border-[#E8E1D4] hover:bg-neutral-50 transition-colors text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#29352D]">{rec.Receipt_Number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {rec.Receipt_Status}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Date: {rec.Date_Of_Received} • via {rec.Received_Mode}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-emerald-800">
                    ₹{rec.Received_Amount.toLocaleString('en-IN')}
                  </span>
                  <div className="mt-1">
                    <button
                      onClick={() => setPreviewReceipt(rec)}
                      className="text-[11px] font-semibold text-[#536B4D] hover:underline cursor-pointer"
                    >
                      View Receipt
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {myReceipts.length === 0 && (
              <p className="text-xs text-gray-500 italic p-4 text-center">No payment receipts on record yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Notices & Community Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#536B4D]" />
              Community Notice Board / সোসাইটি নোটিশ
            </h3>
          </div>

          <div className="space-y-3">
            {notices.slice(0, 3).map((notice) => (
              <div key={notice.Notice_ID} className="p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] text-xs">
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span className="font-bold text-[#536B4D] uppercase">{notice.Notice_Category}</span>
                  <span>{notice.Publish_Date}</span>
                </div>
                <h4 className="font-bold text-[#29352D] mt-1">{notice.Notice_Title}</h4>
                <p className="text-[#29352D]/80 mt-1 line-clamp-2">{notice.Notice_Description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#29352D] flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#536B4D]" />
              Event Gallery
            </h3>
          </div>
          {gallery.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-[#E8E1D4]">
              <img
                src={gallery[0].Photo_File_Reference}
                alt={gallery[0].Event_Name}
                className="h-36 w-full object-cover"
              />
              <div className="p-3 bg-[#F7F4EC]">
                <p className="text-xs font-bold text-[#29352D]">{gallery[0].Event_Name}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{gallery[0].Event_Date}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
