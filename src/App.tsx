/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
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
import { ResidentFlatView } from './components/resident/ResidentFlatView';
import { ResidentNoticesView } from './components/resident/ResidentNoticesView';
import { InvoicePrintModal } from './components/modals/InvoicePrintModal';
import { ReceiptPrintModal } from './components/modals/ReceiptPrintModal';
import { ExpenseVoucherModal } from './components/modals/ExpenseVoucherModal';
import { AdminUsersView, ProfileView } from './components/settings/AccountViews';

const MainLayout: React.FC = () => {
  const { activeTab, activeRole } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
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
  const [validatingSession, setValidatingSession] = useState<boolean>(() => Boolean(session));
  const [sessionError, setSessionError] = useState('');

  const validateSavedSession = async () => {
    if (!session?.token) {
      setValidatingSession(false);
      return;
    }
    setValidatingSession(true);
    setSessionError('');
    try {
      const result: any = await authRequest(
        { action: 'getMyProfile', token: session.token },
        { timeoutMs: 30000 }
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
    } catch (error: any) {
      if (error instanceof BackendRequestError && error.code === 'AUTH_ERROR') {
        localStorage.removeItem('abasSathiSession');
        setSession(null);
      } else {
        // Keep the local token but never mount protected pages until the server confirms it.
        setSessionError('The server could not validate your session. Check your connection and retry.');
      }
    } finally {
      setValidatingSession(false);
    }
  };

  useEffect(() => {
    if (session?.token) void validateSavedSession();
    // Validate only the token restored during the initial page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOutFromGate = async () => {
    const token = session?.token;
    try {
      if (token) await authRequest({ action: 'logout', token }, { timeoutMs: 10000 });
    } catch {
      // Local logout still proceeds if the network is unavailable.
    } finally {
      localStorage.removeItem('abasSathiSession');
      setSession(null);
      setSessionError('');
    }
  };

  if (validatingSession) return (
    <div className="min-h-screen bg-[#F7F4EC] flex flex-col items-center justify-center gap-3 text-[#536B4D]" role="status" aria-live="polite">
      <LoaderCircle className="animate-spin" size={30}/>
      <p className="text-sm font-semibold">Validating your secure session…</p>
    </div>
  );

  if (session && sessionError) return (
    <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#E8E1D4] bg-white p-6 text-center shadow-lg">
        <ShieldCheck className="mx-auto mb-3 text-[#536B4D]" size={32}/>
        <h1 className="text-lg font-bold text-[#29352D]">Session verification required</h1>
        <p className="mt-2 text-sm text-slate-600">{sessionError}</p>
        <button onClick={() => void validateSavedSession()} className="mt-5 min-h-11 w-full rounded-xl bg-[#536B4D] px-4 py-3 font-semibold text-white">
          Retry Session Verification
        </button>
        <button onClick={() => void signOutFromGate()} className="mt-2 min-h-10 w-full rounded-xl border border-[#E8E1D4] px-4 py-2 text-sm font-semibold text-slate-600">
          Sign Out
        </button>
      </div>
    </div>
  );

  if (!session) return <Login onLogin={setSession} />;

  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
