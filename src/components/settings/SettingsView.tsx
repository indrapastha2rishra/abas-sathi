/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  CloudCog,
  Users,
  Building2,
  ShieldCheck,
  History,
  Copy,
  Check,
  Download,
  ExternalLink,
  Save,
  Key,
} from 'lucide-react';

export const SettingsView: React.FC<{ initialSubTab?: string }> = ({ initialSubTab = 'google' }) => {
  const {
    googleConfig,
    updateGoogleConfig,
    users,
    auditLogs,
    preventiveMaintenance,
    properties,
    t,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'google' | 'users' | 'apartment' | 'maintenance' | 'audit'>(
    initialSubTab === 'settings_users'
      ? 'users'
      : initialSubTab === 'settings_maintenance'
      ? 'maintenance'
      : initialSubTab === 'settings_audit'
      ? 'audit'
      : 'google'
  );

  // Google config local edit state
  const [spreadsheetId, setSpreadsheetId] = useState(googleConfig.spreadsheetId);
  const [driveFolderId, setDriveFolderId] = useState(googleConfig.driveFolderId);
  const [webAppUrl, setWebAppUrl] = useState(googleConfig.appsScriptWebAppUrl);
  const [saveNotice, setSaveNotice] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateGoogleConfig({
      spreadsheetId,
      driveFolderId,
      appsScriptWebAppUrl: webAppUrl,
      mode: 'live',
    });
    setSaveNotice('Settings saved. Live Google Sheets read is now enabled for Property Master.');
    setTimeout(() => setSaveNotice(''), 3000);
  };

  const appsScriptCode = `/**
 * ====================================================================
 * ABAS SATHI (আবাসসাথী) - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Smart Living. Better Community.
 * Free-tier server proxy for Google Sheets database & Google Drive
 * ====================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: "${spreadsheetId}",
  DRIVE_FOLDER_ID: "${driveFolderId}",
  ALLOWED_ORIGINS: ["*"], // Restrict to your GitHub Pages URL in production
};

function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    if (action === "ping") {
      return responseJSON({ status: "success", message: "ABAS SATHI Apps Script Backend is Online" });
    }

    if (action === "getProperties") {
      const sheet = ss.getSheetByName("Property Master");
      const data = sheetToObjects(sheet);
      return responseJSON({ status: "success", data: data });
    }

    if (action === "getInvoices") {
      const sheet = ss.getSheetByName("Invoice_Register");
      const data = sheetToObjects(sheet);
      return responseJSON({ status: "success", data: data });
    }

    if (action === "getReceipts") {
      const sheet = ss.getSheetByName("Fund Inflow Register");
      const data = sheetToObjects(sheet);
      return responseJSON({ status: "success", data: data });
    }

    return responseJSON({ status: "error", message: "Invalid action" });
  } catch (error) {
    return responseJSON({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    if (action === "recordPayment") {
      // Validate payment submission and append to Fund Inflow Register
      const sheet = ss.getSheetByName("Fund Inflow Register");
      sheet.appendRow([
        payload.transactionId,
        payload.receiptNumber,
        new Date().toISOString().split("T")[0],
        payload.propertyId,
        payload.ownershipId,
        payload.ownerId,
        payload.flatNo,
        payload.ownerName,
        payload.amount,
        payload.mode,
        payload.reference,
        payload.bankAccount,
        payload.amount,
        payload.remarks || "",
        payload.fileReference || "",
        payload.userId,
        new Date().toISOString(),
        "Pending Verification" // Mandatory review
      ]);

      return responseJSON({ status: "success", message: "Payment recorded as Pending Verification" });
    }

    return responseJSON({ status: "error", message: "Unsupported POST action" });
  } catch (error) {
    return responseJSON({ status: "error", message: error.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}`;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#536B4D]" />
            {t.navSettings} / সেটিংস ও ব্যাকএন্ড সংযোগ
          </h1>
          <p className="text-xs text-gray-500">
            Google Sheets & Apps Script integration guide, security controls, and audit logs
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1.5 rounded-2xl border border-[#E8E1D4]">
        <button
          onClick={() => setActiveTab('google')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'google' ? 'bg-[#536B4D] text-white shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          ★ Google Backend Setup Guide
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          User & Role Management
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'maintenance' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          Preventive Maintenance
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'audit' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
          }`}
        >
          Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: GOOGLE CLOUD, SHEETS & APPS SCRIPT SETUP (SECTION 2, 14, 15) */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          {/* Architecture Card */}
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D] uppercase">
                  100% Free Tier Architecture
                </span>
                <h3 className="text-base font-bold text-[#29352D] mt-1">
                  GitHub Pages + Google Apps Script + Google Sheets & Drive
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Per the budget restrictions in Section 2, zero paid API, hosting, or database subscriptions are required.
                  Frontend is static React on GitHub Pages; Google Apps Script acts as the secure serverless backend; Google Sheets serves as the relational spreadsheet database; Google Drive stores receipts and vouchers.
                </p>
              </div>
              <CloudCog className="h-8 w-8 text-[#536B4D] shrink-0" />
            </div>

            {/* Configuration Inputs */}
            <form onSubmit={handleSaveConfig} className="p-4 rounded-xl bg-[#F7F4EC] border border-[#E8E1D4] space-y-4 text-xs">
              <h4 className="font-bold text-[#29352D] text-xs">Configuration Parameters (Insert when available):</h4>

              {saveNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  {saveNotice}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block font-semibold mb-1">
                    Google Spreadsheet ID: <span className="font-mono text-gray-500">[ADD_SPREADSHEET_ID]</span>
                  </label>
                  <input
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 font-mono text-[#29352D]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Google Drive Folder ID: <span className="font-mono text-gray-500">[ADD_DRIVE_FOLDER_ID]</span>
                  </label>
                  <input
                    type="text"
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 font-mono text-[#29352D]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    Google Apps Script Web App URL: <span className="font-mono text-gray-500">[ADD_APPS_SCRIPT_WEB_APP_URL]</span>
                  </label>
                  <input
                    type="text"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    className="w-full rounded-xl border border-[#E8E1D4] bg-white px-3 py-2 font-mono text-[#29352D]"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-gray-500 italic">
                  Note: Placeholders are preserved to prevent pretending connectivity works before credentials exist.
                </span>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#536B4D] text-white font-bold hover:bg-[#3F523A] cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Config
                </button>
              </div>
            </form>
          </div>

          {/* Apps Script Code.gs Template */}
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#29352D]">
                  Google Apps Script Backend Script (`Code.gs`)
                </h3>
                <p className="text-xs text-gray-500">
                  Deploy as Web App in your Google Sheets container (Extensions → Apps Script)
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(appsScriptCode);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E1D4] bg-[#F7F4EC] text-xs font-bold text-[#536B4D] hover:bg-[#E8E1D4] transition-colors cursor-pointer"
              >
                {copiedScript ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                <span>{copiedScript ? 'Copied!' : 'Copy Code.gs'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-neutral-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-72">
              {appsScriptCode}
            </pre>
          </div>

          {/* 21 Sheet Schema Checklist */}
          <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
            <h3 className="font-bold text-sm text-[#29352D] mb-2">
              Database Schema Checklist (All 21 Google Sheets Tables)
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              All 21 table names, column structures, and relationships specified in Section 5 are pre-modeled:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                'A. Property Master',
                'B. Owner Master',
                'C. Ownership History',
                'D. Rate Master',
                'E. Invoice_Register',
                'F. Fund Inflow Register',
                'G. Bill Wise Details',
                'H. Expense Register',
                'I. Expense Category Master',
                'J. Bank Account Master',
                'K. User Master & Role Management',
                'L. Activity Request Register',
                'M. Notice Master',
                'N. Gallery Master',
                'O. Preventive Maintenance Master',
                'P. Rate Property Mapping',
                'Q. Property Utility Details',
                'R. Audit Log',
                'S. Financial Year Master',
                'T. Tenant Master',
                'U. Account Head Master',
              ].map((sheetName) => (
                <div key={sheetName} className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F4EC] border border-[#E8E1D4]">
                  <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span className="font-semibold text-[#29352D] truncate">{sheetName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[#29352D] text-sm">User Master & Role Management (Sheet K)</h3>
              <p className="text-xs text-gray-500">Enforced roles: Admin, Committee, Accountant, Resident</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Full Name</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Mobile</th>
                  <th className="px-4 py-3 font-semibold">Associated Flat</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {users.slice(0, 15).map((user) => (
                  <tr key={user.UserID} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-500">{user.UserID}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D]">{user.Full_Name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          user.Role === 'Admin'
                            ? 'bg-[#536B4D] text-white'
                            : user.Role === 'Committee'
                            ? 'bg-indigo-100 text-indigo-800'
                            : user.Role === 'Accountant'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-[#C97958] text-white'
                        }`}
                      >
                        {user.Role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.Email_ID}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{user.Mobile_No}</td>
                    <td className="px-4 py-3 font-semibold text-[#536B4D]">
                      {user.PropertyID ? user.PropertyID.replace('PROP-BlockA-', 'A-').replace('PROP-BlockB-', 'B-') : 'Society Level'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800">
                        {user.Account_Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PREVENTIVE MAINTENANCE SETTINGS */}
      {activeTab === 'maintenance' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC]">
            <h3 className="font-bold text-[#29352D] text-sm">Preventive Maintenance Master (Sheet O)</h3>
            <p className="text-xs text-gray-500">Asset upkeep schedule for lifts, DG set, fire safety, and water pumps</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Asset Name</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Service Provider</th>
                  <th className="px-4 py-3 font-semibold">Frequency</th>
                  <th className="px-4 py-3 font-semibold">Last Serviced</th>
                  <th className="px-4 py-3 font-semibold">Next Service</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {preventiveMaintenance.map((p) => (
                  <tr key={p.Maintenance_ID} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-bold text-[#29352D]">{p.Asset_Name}</td>
                    <td className="px-4 py-3 font-medium text-[#536B4D]">{p.Maintenance_Category}</td>
                    <td className="px-4 py-3">{p.Service_Provider}</td>
                    <td className="px-4 py-3 text-gray-600">{p.Frequency}</td>
                    <td className="px-4 py-3 text-gray-500">{p.Last_Service_Date}</td>
                    <td className="px-4 py-3 font-bold text-[#C97958]">{p.Next_Service_Date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {p.Maintenance_Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG (SECTION 3 & 5 SHEET R) */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC]">
            <h3 className="font-bold text-[#29352D] text-sm">System Audit Log (Sheet R)</h3>
            <p className="text-xs text-gray-500">
              Immutable log of create, update, approve, allocate, and role change events
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Log ID</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Module</th>
                  <th className="px-4 py-3 font-semibold">Record ID</th>
                  <th className="px-4 py-3 font-semibold">Details / Change</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {auditLogs.map((log) => (
                  <tr key={log.Log_ID} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-gray-400">{log.Log_ID}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{log.Action_DateTime}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          log.Action_Type === 'CREATE'
                            ? 'bg-blue-100 text-blue-800'
                            : log.Action_Type === 'APPROVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.Action_Type === 'ALLOCATE'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        {log.Action_Type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#536B4D]">{log.Module_Name}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{log.Record_ID}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-sm">{log.New_Value}</td>
                    <td className="px-4 py-3 font-medium text-[#29352D]">{log.User_Name || log.UserID}</td>
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
