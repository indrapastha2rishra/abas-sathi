/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  Languages,
  UserCheck,
  Bell,
  Database,
  LogOut,
  ExternalLink,
  ChevronDown,
  Sparkles,
  ShieldAlert,
  UserRound,
} from 'lucide-react';

interface Props {
  onToggleSidebar: () => void;
}

export const Header: React.FC<Props> = ({ onToggleSidebar }) => {
  const {
    language,
    setLanguage,
    t,
    activeRole,
    currentUser,
    activityRequests,
    receipts,
    setActiveTab,
  } = useApp();

  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const [societyName] = useState(() => {
    try { return JSON.parse(localStorage.getItem('abasSathiSession') || '{}').societyName || 'ABAS SATHI'; }
    catch { return 'ABAS SATHI'; }
  });
  const signOut = async () => {
    try {
      const cfg = JSON.parse(localStorage.getItem('abasSathiGoogleConfig') || '{}');
      const url = cfg.appsScriptWebAppUrl || 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec';
      const session = JSON.parse(localStorage.getItem('abasSathiSession') || '{}');
      await fetch(url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'logout', token:session.token}) });
    } catch {}
    localStorage.removeItem('abasSathiSession');
    window.location.reload();
  };

  const pendingRequestsCount = activityRequests.filter((r) => r.Request_Status === 'Pending').length;
  const pendingReceiptsCount = receipts.filter((r) => r.Receipt_Status === 'Pending Verification').length;
  const totalNotifications = pendingRequestsCount + pendingReceiptsCount;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E8E1D4] bg-white px-4 md:px-6 shadow-2xs">
        {/* Left: Mobile hamburger & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#29352D] hover:bg-[#F7F4EC] transition-colors md:hidden cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {/* House Logo Symbol with Bengali Residential Theme */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#536B4D] text-white shadow-xs group-hover:bg-[#3F523A] transition-colors">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold tracking-tight text-[#29352D]">
                  {language === 'bn' ? t.appNameBengali : t.appName}
                </span>
                <span className="text-xs font-semibold text-[#536B4D] hidden sm:inline">
                  {language === 'bn' ? `(${t.appName})` : `(${t.appNameBengali})`}
                </span>
              </div>
              <p className="text-[10px] md:text-xs font-medium text-[#C97958] hidden xs:block">
                {t.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Right actions: Demo Badge, Language Switcher, Role Badge, Notifications */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Demo Mode Badge */}
          <div className="relative">
            <button
              onClick={() => setShowDemoInfo(!showDemoInfo)}
              className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#536B4D]/10 px-3 py-1 text-xs font-semibold text-[#536B4D] border border-[#536B4D]/20 hover:bg-[#536B4D]/20 transition-colors cursor-pointer"
              title="Click to view Phase 1 Demo Architecture status"
            >
              <span className="h-2 w-2 rounded-full bg-[#536B4D] animate-pulse"></span>
              <span>Phase 1 Demo Mode</span>
              <Database className="h-3.5 w-3.5 ml-0.5 opacity-70" />
            </button>

            {showDemoInfo && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white p-4 shadow-xl border border-[#E8E1D4] text-xs z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8E1D4]">
                  <span className="font-bold text-[#29352D] flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-[#536B4D]" />
                    Phase 1 Demo Architecture
                  </span>
                  <button
                    onClick={() => setShowDemoInfo(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-2 text-[#29352D]/80 leading-relaxed">
                  All 21 Google Sheets database structures and relationships are simulated with realistic in-memory state.
                </p>
                <div className="mt-2.5 p-2 rounded-lg bg-[#F7F4EC] space-y-1 font-mono text-[11px] text-[#29352D]">
                  <p>• Spreadsheet: [ADD_SPREADSHEET_ID]</p>
                  <p>• Drive Folder: [ADD_DRIVE_FOLDER_ID]</p>
                  <p>• Web App: [ADD_APPS_SCRIPT_WEB_APP_URL]</p>
                </div>
                <button
                  onClick={() => {
                    setShowDemoInfo(false);
                    setActiveTab('settings_google');
                  }}
                  className="mt-3 w-full rounded-lg bg-[#536B4D] py-1.5 text-center font-medium text-white hover:bg-[#3F523A] transition-colors"
                >
                  View Setup Guide & Code.gs
                </button>
              </div>
            )}
          </div>

          <div className="hidden md:block max-w-[220px] truncate text-sm font-semibold text-[#536B4D]" title={societyName}>{societyName}</div>

          {/* Bengali / English Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-2.5 py-1.5 text-xs font-semibold text-[#29352D] hover:bg-[#E8E1D4] transition-colors cursor-pointer"
            aria-label="Toggle language between English and Bengali"
            title="Switch Language / ভাষা পরিবর্তন করুন"
          >
            <Languages className="h-4 w-4 text-[#536B4D]" />
            <span className="font-bold">{language === 'en' ? 'বাংলা' : 'English'}</span>
          </button>

          <button onClick={() => setActiveTab('profile')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="My Profile"><UserRound size={15}/><span className="hidden sm:inline">Profile</span></button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                if (activeRole === 'Resident') {
                  setActiveTab('resident_requests');
                } else {
                  setActiveTab(pendingReceiptsCount > 0 ? 'payments_receipts' : 'requests_all');
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E8E1D4] text-[#29352D] hover:bg-[#F7F4EC] transition-colors cursor-pointer relative"
              aria-label="View notifications"
              title={`${totalNotifications} pending items`}
            >
              <Bell className="h-4 w-4" />
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C97958] text-[9px] font-bold text-white shadow-xs">
                  {totalNotifications}
                </span>
              )}
            </button>
          </div>
          <button onClick={signOut} className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Sign out"><LogOut size={15}/><span className="hidden sm:inline">Sign out</span></button>
        </div>
      </header>

    </>
  );
};
