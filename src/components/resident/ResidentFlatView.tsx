/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Home, User, FileText, Shield, MapPin, Building, Key, CheckCircle } from 'lucide-react';

export const ResidentFlatView: React.FC = () => {
  const { residentProperty, ownerships, owners, currentUser, t } = useApp();

  const myOwnership = ownerships.find(
    (o) => o.PropertyID === residentProperty?.PropertyID && o.Ownership_Status === 'Current'
  );

  const myOwner = owners.find((o) => o.OwnerID === myOwnership?.OwnerID);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E8E1D4] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
          <Home className="h-5 w-5 text-[#536B4D]" />
          My Flat Details / আমার ফ্ল্যাটের বিবরণ
        </h1>
        <p className="text-xs text-gray-500">
          Property specifications, registered deed ownership, and municipal records
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flat Physical Specs */}
        <div className="rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E1D4] pb-3">
            <h3 className="font-bold text-sm text-[#29352D] flex items-center gap-2">
              <Building className="h-4 w-4 text-[#536B4D]" />
              Physical Specifications
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {residentProperty?.Occupancy_Status}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Flat Number:</span>
              <span className="font-bold text-[#29352D] text-sm">{residentProperty?.Flat_No}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Block / Tower:</span>
              <span className="font-semibold text-[#536B4D]">{residentProperty?.Block_Tower}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Floor:</span>
              <span className="font-medium text-[#29352D]">Floor {residentProperty?.Floor_No}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Flat Configuration:</span>
              <span className="font-bold text-[#29352D]">{residentProperty?.Property_Type}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Covered Carpet Area:</span>
              <span className="font-medium">{residentProperty?.Cover_Area} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Corridor / Common Share:</span>
              <span className="font-medium">{residentProperty?.Corridor_Area} Sq.Ft.</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500 font-bold">Super Builtup Area (Billing Basis):</span>
              <span className="font-bold text-[#536B4D] text-sm">{residentProperty?.Super_Builtup_Area} Sq.Ft.</span>
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
              Deed Verified
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Registered Owner:</span>
              <span className="font-bold text-[#29352D]">{myOwner?.Owner_Name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Ownership Share:</span>
              <span className="font-semibold text-[#29352D]">{myOwnership?.Ownership_Share}% ({myOwnership?.Ownership_Type})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Registered Deed Number:</span>
              <span className="font-mono font-bold text-[#C97958]">{myOwnership?.Deed_No}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">KMC Assessee Number:</span>
              <span className="font-mono">{myOwnership?.Municipality_Assessee_No}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">KMC Holding Number:</span>
              <span className="font-mono">{myOwnership?.Municipality_Holding_No}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E8E1D4]/60">
              <span className="text-gray-500">Khatian & JL Number:</span>
              <span className="font-mono">{myOwnership?.Khatian} (JL: {myOwnership?.JL_No})</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Title Deed Document:</span>
              <span className="font-mono text-[#536B4D] underline cursor-pointer">{myOwnership?.Owner_Document}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
