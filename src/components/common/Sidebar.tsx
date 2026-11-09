/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Building2,
  Receipt,
  CreditCard,
  Wrench,
  TrendingDown,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Home,
  FileText,
  Clock,
  Image,
  CloudCog,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    activeRole,
    activeTab,
    setActiveTab,
    t,
    activityRequests,
    receipts,
    invoices,
  } = useApp();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    properties: true,
    invoices: true,
    payments: false,
    requests: false,
    expenses: false,
    reports: false,
    settings: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleNav = (tabId: string) => {
    setActiveTab(tabId);
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const pendingRequestsCount = activityRequests.filter((r) => r.Request_Status === 'Pending').length;
  const pendingReceiptsCount = receipts.filter((r) => r.Receipt_Status === 'Pending Verification').length;
  const overdueInvoicesCount = invoices.filter((i) => i.Invoice_Status === 'Overdue').length;

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-2xs no-print"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 md:w-72 border-r border-[#E8E1D4] bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 overflow-y-auto no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6">
          {/* RESIDENT SIDEBAR NAVIGATION */}
          {activeRole === 'Resident' ? (
            <div className="space-y-1.5">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#536B4D]">
                {t.roleResident} Navigation
              </div>

              <button
                onClick={() => handleNav('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{t.navDashboard}</span>
              </button>

              <button
                onClick={() => handleNav('resident_flat')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'resident_flat'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <Home className="h-4 w-4" />
                <span>{t.navMyFlat}</span>
              </button>

              <button
                onClick={() => handleNav('resident_bills')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'resident_bills'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Receipt className="h-4 w-4" />
                  <span>{t.navMyBills}</span>
                </div>
                {overdueInvoicesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-bold">
                    Due
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNav('resident_pay')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'resident_pay'
                    ? 'bg-[#C97958] text-white shadow-sm'
                    : 'bg-[#C97958]/10 text-[#C97958] hover:bg-[#C97958]/20'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>{t.navPayNow} / অনলাইনে জমা দিন</span>
              </button>

              <button
                onClick={() => handleNav('resident_history')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'resident_history'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>{t.navPaymentHistory}</span>
              </button>

              <button
                onClick={() => handleNav('resident_requests')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'resident_requests'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Wrench className="h-4 w-4" />
                  <span>{t.navActivityRequests}</span>
                </div>
                {pendingRequestsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNav('resident_notices')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'resident_notices'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <Image className="h-4 w-4" />
                <span>{t.navNoticesGallery}</span>
              </button>
            </div>
          ) : (
            /* ADMIN / COMMITTEE / ACCOUNTANT NAVIGATION */
            <div className="space-y-1.5">
              {/* 1. Dashboard */}
              <button
                onClick={() => handleNav('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#536B4D] text-white shadow-xs'
                    : 'text-[#29352D] hover:bg-[#F7F4EC]'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{t.navDashboard}</span>
              </button>

              {/* 2. Properties & Residents */}
              <div>
                <button
                  onClick={() => toggleSection('properties')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-[#536B4D]" />
                    <span>{t.navPropertiesResidents}</span>
                  </div>
                  {expandedSections.properties ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.properties && (
                  <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                    <button
                      onClick={() => handleNav('properties_all')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'properties_all' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navAllProperties} (50)
                    </button>
                    <button
                      onClick={() => handleNav('properties_owners')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'properties_owners' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navOwnerDirectory}
                    </button>
                    <button
                      onClick={() => handleNav('properties_history')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'properties_history' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navOwnershipHistory}
                    </button>
                    <button
                      onClick={() => handleNav('properties_tenants')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'properties_tenants' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navTenantDetails}
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Maintenance & Invoices */}
              <div>
                <button
                  onClick={() => toggleSection('invoices')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-[#536B4D]" />
                    <span>{t.navMaintenanceInvoices}</span>
                  </div>
                  {expandedSections.invoices ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.invoices && (
                  <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                    {activeRole !== 'Committee' && (
                      <button
                        onClick={() => handleNav('invoices_generate')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                          activeTab === 'invoices_generate' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                        }`}
                      >
                        {t.navGenerateInvoice}
                      </button>
                    )}
                    <button
                      onClick={() => handleNav('invoices_register')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'invoices_register' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navInvoiceRegister}
                    </button>
                    <button
                      onClick={() => handleNav('invoices_rates')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'invoices_rates' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navRateMaster}
                    </button>
                    <button
                      onClick={() => handleNav('invoices_outstanding')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'invoices_outstanding' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navOutstandingBills}
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Payments */}
              <div>
                <button
                  onClick={() => toggleSection('payments')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-[#536B4D]" />
                    <span>{t.navPayments}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pendingReceiptsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-100 text-amber-800 font-bold">
                        {pendingReceiptsCount}
                      </span>
                    )}
                    {expandedSections.payments ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </div>
                </button>
                {expandedSections.payments && (
                  <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                    {activeRole !== 'Committee' && (
                      <button
                        onClick={() => handleNav('payments_record')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                          activeTab === 'payments_record' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                        }`}
                      >
                        {t.navRecordPayment}
                      </button>
                    )}
                    <button
                      onClick={() => handleNav('payments_receipts')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'payments_receipts' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navReceiptRegister}
                    </button>
                    <button
                      onClick={() => handleNav('payments_allocation')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'payments_allocation' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navBillAllocation}
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Activity Requests */}
              <div>
                <button
                  onClick={() => toggleSection('requests')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Wrench className="h-4 w-4 text-[#536B4D]" />
                    <span>{t.navActivityRequests}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {pendingRequestsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-red-100 text-red-800 font-bold">
                        {pendingRequestsCount}
                      </span>
                    )}
                    {expandedSections.requests ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </div>
                </button>
                {expandedSections.requests && (
                  <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                    <button
                      onClick={() => handleNav('requests_all')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'requests_all' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navAllRequests}
                    </button>
                    <button
                      onClick={() => handleNav('requests_pending')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'requests_pending' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navPendingRequests}
                    </button>
                  </div>
                )}
              </div>

              {/* 6. Expenses (Admin & Accountant) */}
              {activeRole !== 'Committee' && (
                <div>
                  <button
                    onClick={() => toggleSection('expenses')}
                    className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingDown className="h-4 w-4 text-[#C97958]" />
                      <span>{t.navExpenses}</span>
                    </div>
                    {expandedSections.expenses ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  {expandedSections.expenses && (
                    <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                      <button
                        onClick={() => handleNav('expenses_add')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                          activeTab === 'expenses_add' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                        }`}
                      >
                        {t.navAddExpense}
                      </button>
                      <button
                        onClick={() => handleNav('expenses_register')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                          activeTab === 'expenses_register' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                        }`}
                      >
                        {t.navExpenseRegister}
                      </button>
                      <button
                        onClick={() => handleNav('expenses_categories')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                          activeTab === 'expenses_categories' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                        }`}
                      >
                        {t.navExpenseCategories}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 7. Reports */}
              <div>
                <button
                  onClick={() => toggleSection('reports')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-4 w-4 text-[#536B4D]" />
                    <span>{t.navReports}</span>
                  </div>
                  {expandedSections.reports ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.reports && (
                  <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                    <button
                      onClick={() => handleNav('reports_monthly')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'reports_monthly' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navMonthlyReceiptPayment}
                    </button>
                    <button
                      onClick={() => handleNav('reports_property_due')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'reports_property_due' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navPropertyOutstanding}
                    </button>
                    <button
                      onClick={() => handleNav('reports_balancesheet')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'reports_balancesheet' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navBalanceSheet}
                    </button>
                  </div>
                )}
              </div>

              {/* 8. Settings & Google Sync */}
              <div>
                <button
                  onClick={() => toggleSection('settings')}
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-[#29352D] hover:bg-[#F7F4EC] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-[#536B4D]" />
                    <span>{t.navSettings}</span>
                  </div>
                  {expandedSections.settings ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {expandedSections.settings && (
                  <div className="ml-7 mt-1 space-y-1 border-l-2 border-[#E8E1D4] pl-2">
                    <button
                      onClick={() => handleNav('settings_google')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer font-bold ${
                        activeTab === 'settings_google' ? 'text-[#C97958] bg-[#C97958]/10' : 'text-[#C97958] hover:underline'
                      }`}
                    >
                      ★ {t.navGoogleBackend}
                    </button>
                    <button
                      onClick={() => handleNav('settings_users')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'settings_users' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navUserManagement}
                    </button>
                    <button
                      onClick={() => handleNav('settings_maintenance')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'settings_maintenance' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navPreventiveMaintenance}
                    </button>
                    <button
                      onClick={() => handleNav('settings_audit')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs cursor-pointer ${
                        activeTab === 'settings_audit' ? 'text-[#536B4D] font-bold bg-[#536B4D]/10' : 'text-[#29352D]/80 hover:text-[#29352D]'
                      }`}
                    >
                      {t.navAuditLog}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Apartment Details badge */}
          <div className="rounded-xl bg-[#F7F4EC] p-3 text-xs border border-[#E8E1D4] space-y-1">
            <p className="font-bold text-[#536B4D]">{t.apartmentName}</p>
            <p className="text-[11px] text-[#29352D]/70">50 Flats | Ward 93, Jadavpur</p>
            <p className="text-[10px] text-[#C97958] font-medium">FY 2026-2027 (Active)</p>
          </div>
        </div>
      </aside>
    </>
  );
};
