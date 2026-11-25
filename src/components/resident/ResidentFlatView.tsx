/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import { normId, normText } from '../../utils/residentPortalHelpers';
import { Home, Shield, Building, Zap, Users, RefreshCw, Download, AlertCircle } from 'lucide-react';

export const ResidentFlatView: React.FC = () => {
  const {
    residentProperty,
    ownerships,
    owners,
    tenants,
    propertyUtilities,
    currentUser,
    getPrivateFile,
    refreshActiveData,
    isRefreshingData,
  } = useApp();

  const [docError, setDocError] = useState('');
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  const pid = residentProperty?.PropertyID || currentUser.PropertyID || '';

  const propertyOwnerships = useMemo(
    () => (ownerships || []).filter((o) => normId(o.PropertyID) === normId(pid)),
    [ownerships, pid]
  );

  const myOwnership = useMemo(
    () =>
      (currentUser.Ownership_ID
        ? propertyOwnerships.find((o) => normId(o.Ownership_ID) === normId(currentUser.Ownership_ID))
        : undefined) ||
      propertyOwnerships.find((o) => normText(o.Ownership_Status) === 'current') ||
      propertyOwnerships[0],
    [propertyOwnerships, currentUser.Ownership_ID]
  );

  const myOwner = useMemo(
    () => (owners || []).find((o) => normId(o.OwnerID) === normId(myOwnership?.OwnerID)),
    [owners, myOwnership?.OwnerID]
  );

  const myUtilities = useMemo(
    () => (propertyUtilities || []).filter((u) => normId(u.PropertyID) === normId(pid)),
    [propertyUtilities, pid]
  );

  const myTenants = useMemo(
    () =>
      (tenants || []).filter((t) => {
        if (normId(t.PropertyID) !== normId(pid)) return false;
        if (currentUser.Ownership_ID && t.Ownership_ID && normId(t.Ownership_ID) !== normId(currentUser.Ownership_ID)) {
          return false;
        }
        return true;
      }),
    [tenants, pid, currentUser.Ownership_ID]
  );

  const handleOpenDocument = async (fileRef: string, label: string) => {
    const cleanRef = String(fileRef || '').trim();
    if (!cleanRef) return;
    setDocError('');
    if (/^https?:\/\//i.test(cleanRef)) {
      const a = document.createElement('a');
      a.href = cleanRef;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }
    setDownloadingDoc(true);
    try {
      const r: any = await getPrivateFile(cleanRef, pid);
      const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: r.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.data.fileName || `${label}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDocError(err?.message || 'Unable to download document or access denied.');
    } finally {
      setDownloadingDoc(false);
    }
  };

  if (!residentProperty) {
    return (
      <div className="rounded-2xl border border-[#E8E1D4] bg-white p-8 text-center space-y-3">
        <Home className="h-8 w-8 text-[#536B4D]/60 mx-auto" />
        <h2 className="text-base font-bold text-[#29352D]">No Flat Linked to Your Account</h2>
        <p className="text-xs text-gray-500">
          Please contact your Society Admin to link your Property ID and Ownership ID in User Master.
        </p>
        <button
          type="button"
          onClick={() => void refreshActiveData()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#536B4D] px-4 py-2 text-xs font-bold text-white cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
          <span>Sync Live Sheet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E8E1D4] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <Home className="h-5 w-5 text-[#536B4D]" />
            My Flat Details / আমার ফ্ল্যাটের বিবরণ
          </h1>
          <p className="text-xs text-gray-500">
            Live Property Master, Ownership History, Utility Meters, and Occupancy records
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshActiveData()}
          disabled={isRefreshingData}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E1D4] bg-white px-3.5 py-2 text-xs font-semibold text-[#536B4D] hover:bg-[#F7F4EC] cursor-pointer self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingData ? 'animate-spin' : ''}`} />
          <span>{isRefreshingData ? 'Refreshing…' : 'Refresh Live Data'}</span>
        </button>
      </div>

      {docError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{docError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flat Physical Specs */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3">
            <h3 className="font-bold text-sm text-[#29352D] flex items-center gap-2">
              <Building className="h-4 w-4 text-[#536B4D]" />
              Physical Specifications
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {residentProperty.Occupancy_Status || 'Active'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Flat Number (Property ID):</span>
              <span className="font-bold text-[#29352D] text-sm">
                {residentProperty.Flat_No} <span className="font-mono text-xs text-gray-500">({residentProperty.PropertyID})</span>
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Block / Tower:</span>
              <span className="font-semibold text-[#536B4D]">{residentProperty.Block_Tower || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Floor:</span>
              <span className="font-medium text-[#29352D]">Floor {residentProperty.Floor_No ?? '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Flat Configuration:</span>
              <span className="font-bold text-[#29352D]">{residentProperty.Property_Type || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Carpet Area:</span>
              <span className="font-medium">{residentProperty.Carpet_Area ?? '—'} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Allocated Common Area:</span>
              <span className="font-medium">{residentProperty.Allocated_Common_Area ?? '—'} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Structural Area:</span>
              <span className="font-bold text-[#536B4D] text-sm">{residentProperty.Structural_Area ?? '—'} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500 font-bold">Super Built-up Area:</span>
              <span className="font-bold text-[#536B4D]">{residentProperty.Super_Built_up_Area ?? '—'} Sq.Ft.</span>
            </div>
          </div>
        </div>

        {/* Legal Title & Municipal Records */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3">
            <h3 className="font-bold text-sm text-[#29352D] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#536B4D]" />
              Ownership Title & Municipal Records
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#536B4D]/10 text-[#536B4D]">
              {myOwnership?.Ownership_Status || 'Linked'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Registered Owner:</span>
              <span className="font-bold text-[#29352D]">{myOwner?.Owner_Name || currentUser.Full_Name || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Contact (Mobile / Email):</span>
              <span className="font-medium text-[#29352D]">
                {myOwner?.Mobile_No || currentUser.Mobile_No || '—'} · {myOwner?.Email_ID || currentUser.Email_ID || '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Ownership ID & Start:</span>
              <span className="font-mono text-[#29352D]">
                {myOwnership?.Ownership_ID || currentUser.Ownership_ID || '—'} ({formatDateDisplay(myOwnership?.Ownership_Start_Date, '—')})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Ownership Share:</span>
              <span className="font-semibold text-[#29352D]">
                {myOwnership?.Ownership_Share ?? 100}% ({myOwnership?.Ownership_Type || '—'})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Registered Deed Number:</span>
              <span className="font-mono font-bold text-[#C97958]">{myOwnership?.Deed_No || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Assessee / Holding No:</span>
              <span className="font-mono">
                {myOwnership?.Municipality_Assessee_No || '—'} / {myOwnership?.Municipality_Holding_No || '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Khatian & JL Number:</span>
              <span className="font-mono">
                {myOwnership?.Khatian || '—'} (JL: {myOwnership?.JL_No || '—'})
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-500">Title Deed Document:</span>
              {myOwnership?.Owner_Document ? (
                <button
                  type="button"
                  disabled={downloadingDoc}
                  onClick={() => void handleOpenDocument(myOwnership.Owner_Document, `Deed-${residentProperty.Flat_No}`)}
                  className="inline-flex items-center gap-1 font-semibold text-[#536B4D] hover:underline cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingDoc ? 'Opening…' : 'Download Document'}</span>
                </button>
              ) : (
                <span className="text-gray-400">Not uploaded</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Property Utility Details */}
      <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3">
          <h3 className="font-bold text-sm text-[#29352D] flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#536B4D]" />
            Utility Meters & Connections (Property Utility Details)
          </h3>
          <span className="text-xs text-gray-500">{myUtilities.length} Record(s)</span>
        </div>

        {myUtilities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4EC] text-[#29352D]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Utility Type</th>
                  <th className="px-3 py-2 font-semibold">Consumer ID</th>
                  <th className="px-3 py-2 font-semibold">Installation No</th>
                  <th className="px-3 py-2 font-semibold">Meter No</th>
                  <th className="px-3 py-2 font-semibold">Effective From</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {myUtilities.map((u) => (
                  <tr key={u.Utility_ID}>
                    <td className="px-3 py-2.5 font-semibold text-[#29352D]">{u.Utility_Type}</td>
                    <td className="px-3 py-2.5 font-mono">{u.Consumer_ID || '—'}</td>
                    <td className="px-3 py-2.5 font-mono">{u.Installation_No || '—'}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#536B4D]">{u.Meter_No || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600">{formatDateDisplay(u.Effective_From, '—')}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          normText(u.Status) === 'disconnected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.Status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No utility meter records registered for this flat.</p>
        )}
      </div>

      {/* Tenant Details (if any) */}
      {myTenants.length > 0 && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3">
            <h3 className="font-bold text-sm text-[#29352D] flex items-center gap-2">
              <Users className="h-4 w-4 text-[#536B4D]" />
              Registered Tenant Details
            </h3>
            <span className="text-xs text-gray-500">{myTenants.length} Tenant Record(s)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {myTenants.map((ten) => (
              <div key={ten.Tenant_ID} className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#29352D] text-sm">{ten.Tenant_Name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-[#E8E1D4] text-[#536B4D]">
                    {ten.Status}
                  </span>
                </div>
                <p className="text-gray-600">Mobile: {ten.Mobile_No || '—'} · Email: {ten.Email_ID || '—'}</p>
                <p className="text-gray-500">
                  Occupancy: {formatDateDisplay(ten.Occupancy_Start_Date, '—')} to {formatDateDisplay(ten.Occupancy_End_Date, 'Present')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
