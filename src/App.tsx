/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { authRequest, BackendRequestError } from './utils/authClient';
import { isActiveAuthenticatedProfile } from './utils/authValidation';
import { Login } from './components/auth/Login';
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
import { MasterDataManager } from './components/settings/MasterDataManager';
import { ResidentFlatView } from './components/resident/ResidentFlatView';
import { ResidentNoticesView } from './components/resident/ResidentNoticesView';
import { InvoicePrintModal } from './components/modals/InvoicePrintModal';
import { ReceiptPrintModal } from './components/modals/ReceiptPrintModal';
import { ExpenseVoucherModal } from './components/modals/ExpenseVoucherModal';
import { AdminUsersView, ProfileView } from './components/settings/AccountViews';
import { FinancialTransactionsView } from './components/reports/FinancialTransactionsView';

const MainLayout: React.FC = () => {
  const { activeTab, activeRole, canAccessTab, isResidentMode, actualRole } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    if (!canAccessTab(activeTab)) return <div className="rounded-2xl border border-red-200 bg-white p-6 md:p-10 text-center space-y-2"><h2 className="text-lg font-bold text-red-700">Access Denied</h2><p className="text-sm text-slate-600">Role_Permission configuration does not allow viewing this module. Missing permission defaults to DENY.</p><button onClick={()=>window.location.replace(window.location.pathname)} className="mt-3 px-4 py-2 rounded-lg bg-[#536B4D] text-white text-sm font-semibold">Return to Dashboard</button></div>;
    if (activeTab === 'profile') return <ProfileView />;
    if (activeTab === 'settings_users') return <AdminUsersView />;
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

    // Financial Transactions
    if (activeTab.startsWith('financial_')) {
      return <FinancialTransactionsView initialType={activeTab === 'financial_pv' ? 'PV' : activeTab === 'financial_jv' ? 'JV' : activeTab === 'financial_cv' ? 'CV' : 'RV'} />;
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
          {isResidentMode && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800">Resident Preview Mode — actual role remains {actualRole}; resident-scoped view is active.</div>}
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
  // Restore the local session immediately. Network verification is deliberately
  // background-only so returning users never wait on slow Apps Script startup.
  const [session, setSession] = useState<any>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('abasSathiSession') || 'null');
      if (saved && saved.token && saved.expiresAt > Date.now()) return saved;
      localStorage.removeItem('abasSathiSession');
      return null;
    } catch {
      localStorage.removeItem('abasSathiSession');
      return null;
    }
  });
  const [sessionCheck, setSessionCheck] = useState<'none'|'checking'|'verified'|'offline'>('none');

  const validateSavedSession = async () => {
    if (!session?.token) {
      setSessionCheck('none');
      return;
    }
    setSessionCheck('checking');
    try {
      const result: any = await authRequest(
        { action: 'getMyProfile', token: session.token },
        { timeoutMs: 12000 }
      );
      const profile = result?.profile || {};
      if (!isActiveAuthenticatedProfile(profile)) {
        throw new BackendRequestError('The saved session is no longer valid.', undefined, false, 'AUTH_ERROR');
      }
      const refreshed = {
        ...session,
        expiresAt: Date.now() + 21600 * 1000,
        user: {
          ...session.user,
          userId: String(profile.UserID),
          loginId: String(profile.Login_ID || session.user?.loginId || ''),
          fullName: String(profile.Full_Name || session.user?.fullName || ''),
          email: String(profile.Email_ID || session.user?.email || ''),
          mobile: String(profile.Mobile_No || session.user?.mobile || ''),
          role: String(profile.Role),
          propertyId: String(profile.PropertyID || ''),
          accountStatus: String(profile.Account_Status),
        },
      };
      localStorage.setItem('abasSathiSession', JSON.stringify(refreshed));
      setSession(refreshed);
      setSessionCheck('verified');
    } catch (error: any) {
      if (error instanceof BackendRequestError && error.code === 'AUTH_ERROR') {
        localStorage.removeItem('abasSathiSession');
        setSession(null);
        setSessionCheck('none');
      } else {
        // Keep local identity/session for offline shell only. Every data request
        // and write is still server-authenticated and will fail closed offline.
        setSessionCheck('offline');
      }
    }
  };


  useEffect(() => {
    if (session?.token) void validateSavedSession();
    // Validate only the session restored at initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const onOffline = () => { if (session?.token) setSessionCheck('offline'); };
    const onOnline = () => { if (session?.token) void validateSavedSession(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
    // Session listeners are set up for the restored/new session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);


  const signOutFromGate = async () => {
    const token = session?.token;
    try {
      if (token) await authRequest({ action: 'logout', token }, { timeoutMs: 5000 });
    } catch {
      // Local logout still proceeds if the network is unavailable.
    } finally {
      localStorage.removeItem('abasSathiSession');
      setSession(null);
      setSessionCheck('none');
    }
  };

  if (!session) return <Login onLogin={(newSession) => { setSession(newSession); setSessionCheck('verified'); }} />;

  return (
    <AppProvider>
      <>
        {sessionCheck === 'checking' && (
          <div className="w-full px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-medium text-center" role="status" aria-live="polite">
            Session restored — verifying in background. App is opening.
          </div>
        )}
        {sessionCheck === 'offline' && (
          <div className="w-full px-3 py-2 bg-amber-50 text-amber-900 text-xs font-medium text-center" role="status" aria-live="polite">
            Offline / server unavailable. App shell is open; live data and any changes require connection.
            <button className="ml-2 underline font-semibold" onClick={() => void validateSavedSession()}>Retry</button>
            <button className="ml-2 underline font-semibold" onClick={() => void signOutFromGate()}>Sign out</button>
          </div>
        )}
        <MainLayout />
      </>
    </AppProvider>
  );
}
