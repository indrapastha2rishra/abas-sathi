/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateDisplay } from '../../utils/dateFormat';
import {
  Building2,
  Users,
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  CheckCircle,
  Home,
} from 'lucide-react';

type PropertySubTab = 'all' | 'owners' | 'history' | 'tenants';

const resolvePropertySubTab = (subtab?: string): PropertySubTab => {
  switch (subtab) {
    case 'properties_owners':
      return 'owners';
    case 'properties_history':
      return 'history';
    case 'properties_tenants':
      return 'tenants';
    case 'properties_all':
    default:
      return 'all';
  }
};

const tabForPropertySubTab = (sub: PropertySubTab): string => {
  switch (sub) {
    case 'owners':
      return 'properties_owners';
    case 'history':
      return 'properties_history';
    case 'tenants':
      return 'properties_tenants';
    case 'all':
    default:
      return 'properties_all';
  }
};

const formatAreaFromDatabase = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
};


export const PropertiesView: React.FC<{ subtab?: string }> = ({ subtab = 'properties_all' }) => {
  const { properties, owners, ownerships, tenants, setActiveTab, canAccessTab, t } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<PropertySubTab>(() => resolvePropertySubTab(subtab));

  useEffect(() => {
    setActiveSubTab(resolvePropertySubTab(subtab));
  }, [subtab]);

  const handleSelectSubTab = (next: PropertySubTab) => {
    setActiveSubTab(next);
    const targetTab = tabForPropertySubTab(next);
    if (canAccessTab(targetTab)) {
      setActiveTab(targetTab);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [towerFilter, setTowerFilter] = useState('All');
  const [occupancyFilter, setOccupancyFilter] = useState('All');
  const normalizedQuery = searchTerm.trim().toLowerCase();

  // Filter properties
  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      !normalizedQuery ||
      String(p.Flat_No || '').toLowerCase().includes(normalizedQuery) ||
      String(p.PropertyID || '').toLowerCase().includes(normalizedQuery) ||
      String(p.Block_Tower || '').toLowerCase().includes(normalizedQuery);
    const matchesTower = towerFilter === 'All' || p.Block_Tower === towerFilter;
    const matchesOcc = occupancyFilter === 'All' || p.Occupancy_Status === occupancyFilter;
    return matchesSearch && matchesTower && matchesOcc;
  });

  // Filter owners
  const filteredOwners = owners.filter((o) => {
    if (!normalizedQuery) return true;
    return (
      String(o.Owner_Name || '').toLowerCase().includes(normalizedQuery) ||
      String(o.OwnerID || '').toLowerCase().includes(normalizedQuery) ||
      String(o.Mobile_No || '').toLowerCase().includes(normalizedQuery) ||
      String(o.Email_ID || '').toLowerCase().includes(normalizedQuery)
    );
  });

  // Filter ownership history
  const filteredOwnerships = ownerships.filter((osh) => {
    if (!normalizedQuery) return true;
    const property = properties.find((p) => p.PropertyID === osh.PropertyID);
    const owner = owners.find((o) => o.OwnerID === osh.OwnerID);
    return (
      String(osh.Ownership_ID || '').toLowerCase().includes(normalizedQuery) ||
      String(osh.PropertyID || '').toLowerCase().includes(normalizedQuery) ||
      String(property?.Flat_No || '').toLowerCase().includes(normalizedQuery) ||
      String(owner?.Owner_Name || '').toLowerCase().includes(normalizedQuery) ||
      String(osh.Deed_No || '').toLowerCase().includes(normalizedQuery)
    );
  });

  // Filter tenants
  const filteredTenants = tenants.filter((ten) => {
    if (!normalizedQuery) return true;
    const property = properties.find((p) => p.PropertyID === ten.PropertyID);
    return (
      String(ten.Tenant_ID || '').toLowerCase().includes(normalizedQuery) ||
      String(ten.Tenant_Name || '').toLowerCase().includes(normalizedQuery) ||
      String(ten.PropertyID || '').toLowerCase().includes(normalizedQuery) ||
      String(property?.Flat_No || '').toLowerCase().includes(normalizedQuery) ||
      String(ten.Mobile_No || '').toLowerCase().includes(normalizedQuery)
    );
  });

  const towerOptions = Array.from(new Set(properties.map((p) => String(p.Block_Tower || '').trim()).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#536B4D]" />
            {t.navPropertiesResidents} / সম্পত্তি ও বাসিন্দা
          </h1>
          <p className="text-xs text-gray-500">
            Property records, owner details and ownership history
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#E8E1D4]">
          <button
            onClick={() => handleSelectSubTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-white text-[#536B4D] shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            All Flats ({properties.length})
          </button>
          <button
            onClick={() => handleSelectSubTab('owners')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'owners'
                ? 'bg-white text-[#536B4D] shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Owners ({owners.length})
          </button>
          <button
            onClick={() => handleSelectSubTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-white text-[#536B4D] shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Ownership History ({ownerships.length})
          </button>
          <button
            onClick={() => handleSelectSubTab('tenants')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'tenants'
                ? 'bg-white text-[#536B4D] shadow-xs'
                : 'text-[#29352D]/70 hover:text-[#29352D]'
            }`}
          >
            Tenants ({tenants.length})
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-[#E8E1D4] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search flat no, owner, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] pl-9 pr-3 py-2 text-xs text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
          />
        </div>

        {activeSubTab === 'all' && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={towerFilter}
              onChange={(e) => setTowerFilter(e.target.value)}
              className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden cursor-pointer"
            >
              <option value="All">All Towers</option>
              {towerOptions.map((tower) => (
                <option key={tower} value={tower}>{tower}</option>
              ))}
            </select>

            <select
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value)}
              className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden cursor-pointer"
            >
              <option value="All">All Occupancy</option>
              <option value="Self Occupied">Self Occupied</option>
              <option value="Tenant Occupied">Tenant Occupied</option>
              <option value="Vacant">Vacant</option>
            </select>
          </div>
        )}
      </div>

      {/* SUBTAB 1: ALL PROPERTIES */}
      {activeSubTab === 'all' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Property ID</th>
                  <th className="px-4 py-3 font-semibold">Flat No</th>
                  <th className="px-4 py-3 font-semibold">Tower / Block</th>
                  <th className="px-4 py-3 font-semibold">Floor</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Carpet Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Allocated Common Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Structural Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Super Built-up Area</th>
                  <th className="px-4 py-3 font-semibold text-center">Occupancy Status</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {filteredProperties.map((prop) => (
                  <tr key={prop.PropertyID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-500">{prop.PropertyID}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D] text-sm">{prop.Flat_No}</td>
                    <td className="px-4 py-3 font-medium text-[#536B4D]">{prop.Block_Tower}</td>
                    <td className="px-4 py-3">Floor {prop.Floor_No}</td>
                    <td className="px-4 py-3 font-semibold">{prop.Property_Type}</td>
                    <td className="px-4 py-3 text-right">{formatAreaFromDatabase(prop.Carpet_Area)} sq.ft</td>
                    <td className="px-4 py-3 text-right">{formatAreaFromDatabase(prop.Allocated_Common_Area)} sq.ft</td>
                    <td className="px-4 py-3 text-right">{formatAreaFromDatabase(prop.Structural_Area)} sq.ft</td>
                    <td className="px-4 py-3 text-right font-bold text-[#536B4D]">{formatAreaFromDatabase(prop.Super_Built_up_Area)} sq.ft</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          prop.Occupancy_Status === 'Self Occupied'
                            ? 'bg-emerald-100 text-emerald-800'
                            : prop.Occupancy_Status === 'Tenant Occupied'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {prop.Occupancy_Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">
                        {prop.Property_Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-[#E8E1D4] text-xs text-gray-500 flex justify-between items-center">
            <span>Showing {filteredProperties.length} of {properties.length} total properties</span>
            <span className="font-semibold text-[#536B4D]">KMC Ward 93 Registered Records</span>
          </div>
        </div>
      )}

      {/* SUBTAB 2: OWNER DIRECTORY */}
      {activeSubTab === 'owners' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Owner ID</th>
                  <th className="px-4 py-3 font-semibold">Owner Name</th>
                  <th className="px-4 py-3 font-semibold">Mobile Number</th>
                  <th className="px-4 py-3 font-semibold">Email ID</th>
                  <th className="px-4 py-3 font-semibold">Emergency Contact</th>
                  <th className="px-4 py-3 font-semibold">Registered Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {filteredOwners.map((owner) => (
                  <tr key={owner.OwnerID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-500">{owner.OwnerID}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D] text-sm">{owner.Owner_Name}</td>
                    <td className="px-4 py-3 font-mono text-[#536B4D]">{owner.Mobile_No}</td>
                    <td className="px-4 py-3 text-gray-600">{owner.Email_ID}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{owner.Emergency_Contact}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{owner.Owner_Address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: OWNERSHIP HISTORY */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Ownership ID</th>
                  <th className="px-4 py-3 font-semibold">Owner Name</th>
                  <th className="px-4 py-3 font-semibold">Flat No.</th>
                  <th className="px-4 py-3 font-semibold">Floor No.</th>
                  <th className="px-4 py-3 font-semibold">Property Type</th>
                  <th className="px-4 py-3 font-semibold text-right">Carpet Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Allocated Common Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Structural Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Super Built-up Area</th>
                  <th className="px-4 py-3 font-semibold">Deed Number</th>
                  <th className="px-4 py-3 font-semibold">KMC Assessee No</th>
                  <th className="px-4 py-3 font-semibold">KMC Holding No</th>
                  <th className="px-4 py-3 font-semibold">Khatian / JL</th>
                  <th className="px-4 py-3 font-semibold text-center">Share</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {filteredOwnerships.map((osh) => {
                  const property = properties.find((p) => p.PropertyID === osh.PropertyID);
                  const owner = owners.find((o) => o.OwnerID === osh.OwnerID);
                  return (
                    <tr key={osh.Ownership_ID} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#29352D]">{osh.Ownership_ID}</td>
                      <td className="px-4 py-3 font-semibold">{owner?.Owner_Name || '—'}</td>
                      <td className="px-4 py-3 font-bold text-[#536B4D]">{property?.Flat_No || '—'}</td>
                      <td className="px-4 py-3">{property?.Floor_No ?? '—'}</td>
                      <td className="px-4 py-3">{property?.Property_Type || '—'}</td>
                      <td className="px-4 py-3 text-right">{formatAreaFromDatabase(property?.Carpet_Area)}</td>
                      <td className="px-4 py-3 text-right">{formatAreaFromDatabase(property?.Allocated_Common_Area)}</td>
                      <td className="px-4 py-3 text-right">{formatAreaFromDatabase(property?.Structural_Area)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAreaFromDatabase(property?.Super_Built_up_Area)}</td>
                      <td className="px-4 py-3 font-mono text-[#C97958] font-semibold">{osh.Deed_No || '—'}</td>
                      <td className="px-4 py-3 font-mono">{osh.Municipality_Assessee_No || '—'}</td>
                      <td className="px-4 py-3 font-mono">{osh.Municipality_Holding_No || '—'}</td>
                      <td className="px-4 py-3 font-mono">{osh.Khatian || '—'} (JL: {osh.JL_No || '—'})</td>
                      <td className="px-4 py-3 text-center font-bold">{osh.Ownership_Share}%</td>
                      <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">{osh.Ownership_Status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TENANTS */}
      {activeSubTab === 'tenants' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tenant ID</th>
                  <th className="px-4 py-3 font-semibold">Property ID</th>
                  <th className="px-4 py-3 font-semibold">Tenant Name</th>
                  <th className="px-4 py-3 font-semibold">Contact Mobile</th>
                  <th className="px-4 py-3 font-semibold">Lease Period</th>
                  <th className="px-4 py-3 font-semibold">Agreement Document</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {filteredTenants.map((ten) => (
                  <tr key={ten.Tenant_ID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500">{ten.Tenant_ID}</td>
                    <td className="px-4 py-3 font-bold text-[#536B4D]">{ten.PropertyID}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D] text-sm">{ten.Tenant_Name}</td>
                    <td className="px-4 py-3 font-mono">{ten.Mobile_No}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateDisplay(ten.Occupancy_Start_Date) || '—'} to {formatDateDisplay(ten.Occupancy_End_Date) || 'Ongoing'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#536B4D] underline">
                      {ten.Tenant_Document}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {ten.Status}
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
