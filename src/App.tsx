/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { ResidentDashboard } from './components/dashboard/ResidentDashboard';
import { PropertiesView } from './components/properties/PropertiesView';
import { InvoicesView } from './components/invoices/InvoicesView';
import { PaymentsView } from './components/payments/PaymentsView';
import { ActivityRequestsView } from './components/requests/ActivityRequestsView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { ResidentFlatView } from './components/resident/ResidentFlatView';
import { ResidentNoticesView } from './components/resident/ResidentNoticesView';
import { InvoicePrintModal } from './components/modals/InvoicePrintModal';
import { ReceiptPrintModal } from './components/modals/ReceiptPrintModal';
import { ExpenseVoucherModal } from './components/modals/ExpenseVoucherModal';

const MainLayout: React.FC = () => {
  const { activeTab, activeRole } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    // 1. Dashboard (Role-specific)
    if (activeTab === 'dashboard') {
      return activeRole === 'Resident' ? <ResidentDashboard /> : <AdminDashboard />;
    }

    // 2. Properties & Residents
    if (activeTab.startsWith('properties')) {
      return <PropertiesView subtab={activeTab} />;
    }

    // 3. Maintenance & Invoices
    if (activeTab.startsWith('invoices')) {
      return (
        <InvoicesView
          initialTab={
            activeTab === 'invoices_generate'
              ? 'generate'
              : activeTab === 'invoices_rates'
              ? 'rates'
              : activeTab === 'invoices_outstanding'
              ? 'outstanding'
              : 'register'
          }
        />
      );
    }

    // 4. Payments
    if (activeTab.startsWith('payments')) {
      return (
        <PaymentsView
          initialSubTab={
            activeTab === 'payments_record'
              ? 'record'
              : activeTab === 'payments_allocation'
              ? 'allocation'
              : activeTab === 'payments_advances'
              ? 'advances'
              : 'receipts'
          }
        />
      );
    }

    // 5. Activity Requests
    if (activeTab.startsWith('requests')) {
      return <ActivityRequestsView />;
    }

    // 6. Expenses
    if (activeTab.startsWith('expenses')) {
      return <ExpensesView />;
    }

    // 7. Reports
    if (activeTab.startsWith('reports')) {
      return <ReportsView initialReport={activeTab} />;
    }

    // 8. Settings & Google Cloud
    if (activeTab.startsWith('settings')) {
      return <SettingsView initialSubTab={activeTab} />;
    }

    // Resident Portal sub-pages
    if (activeTab === 'resident_flat') {
      return <ResidentFlatView />;
    }
    if (activeTab === 'resident_bills') {
      return <InvoicesView initialTab="register" />;
    }
    if (activeTab === 'resident_pay') {
      return <PaymentsView initialSubTab="pay_now" />;
    }
    if (activeTab === 'resident_history') {
      return <PaymentsView initialSubTab="receipts" />;
    }
    if (activeTab === 'resident_requests') {
      return <ActivityRequestsView />;
    }
    if (activeTab === 'resident_notices') {
      return <ResidentNoticesView />;
    }

    return activeRole === 'Resident' ? <ResidentDashboard /> : <AdminDashboard />;
  };

  return (
    <div className="min-h-screen bg-[#F7F4EC] text-[#29352D] flex flex-col">
      {/* Top Header */}
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1">
        {/* Navigation Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8 overflow-x-hidden">
          {renderContent()}
        </main>
      </div>

      {/* Resident Bottom Navigation (Mobile) */}
      <MobileBottomNav />

      {/* Print / Preview Modals */}
      <InvoicePrintModal />
      <ReceiptPrintModal />
      <ExpenseVoucherModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
