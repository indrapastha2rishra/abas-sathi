/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types/database';
import { Shield, Users, Calculator, Home, Check, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSwitcherModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeRole, setActiveRole, users, currentUser, switchUser, t } = useApp();

  if (!isOpen) return null;

  const roles: { role: UserRole; title: string; desc: string; icon: any; color: string }[] = [
    {
      role: 'Admin',
      title: 'Admin (সোসাইটি সভাপতি / প্রশাসক)',
      desc: 'Full authorized access. Generate invoices, approve expenses, manage members & settings.',
      icon: Shield,
      color: 'bg-[#536B4D] text-white',
    },
    {
      role: 'Committee',
      title: 'Committee Member (পরিচালনা কমিটি)',
      desc: 'View properties, financial statements, and manage & resolve resident service requests.',
      icon: Users,
      color: 'bg-indigo-700 text-white',
    },
    {
      role: 'Accountant',
      title: 'Accountant / Treasurer (হিসাবরক্ষক)',
      desc: 'Full financial operations: generate invoices, record payments, bill-wise allocation, and reports.',
      icon: Calculator,
      color: 'bg-emerald-700 text-white',
    },
    {
      role: 'Resident',
      title: 'Resident (ফ্ল্যাট বাসিন্দা / মালিক)',
      desc: 'Access own flat details, view personal maintenance bills, submit UPI payments, and raise requests.',
      icon: Home,
      color: 'bg-[#C97958] text-white',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-[#E8E1D4] my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#E8E1D4] bg-[#F7F4EC] px-6 py-4">
          <div>
            <h3 className="font-bold text-[#29352D] text-base md:text-lg">
              {t.actionSwitchRole} / ভূমিকা পরিবর্তন
            </h3>
            <p className="text-xs text-[#29352D]/70">
              Test role-based access control (RBAC) across all 4 user perspectives
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#29352D]/70 hover:bg-[#E8E1D4] hover:text-[#29352D] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            {roles.map((item) => {
              const Icon = item.icon;
              const isSelected = activeRole === item.role;

              return (
                <div
                  key={item.role}
                  onClick={() => {
                    setActiveRole(item.role);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                    isSelected
                      ? 'border-[#536B4D] bg-[#536B4D]/5 shadow-xs'
                      : 'border-[#E8E1D4] hover:border-[#536B4D]/50 hover:bg-neutral-50'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-[#29352D]">{item.title}</h4>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-xs font-bold text-[#536B4D] bg-[#536B4D]/10 px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#29352D]/70 mt-1">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {activeRole === 'Resident' && (
            <div className="mt-4 pt-4 border-t border-[#E8E1D4]">
              <label className="block text-xs font-semibold text-[#29352D] mb-1.5">
                Switch Resident Flat / সদস্য নির্বাচন করুন:
              </label>
              <select
                value={currentUser.UserID}
                onChange={(e) => switchUser(e.target.value)}
                className="w-full rounded-lg border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
              >
                {users
                  .filter((u) => u.Role === 'Resident')
                  .slice(0, 15)
                  .map((u) => (
                    <option key={u.UserID} value={u.UserID}>
                      Flat {u.PropertyID?.replace('PROP-BlockA-', 'A-').replace('PROP-BlockB-', 'B-')} : {u.Full_Name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="border-t border-[#E8E1D4] bg-[#F7F4EC] px-6 py-3 flex justify-between items-center text-xs text-[#29352D]/70">
          <span>Current: <strong>{currentUser.Full_Name}</strong> ({currentUser.Role})</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[#536B4D] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#3F523A] transition-colors cursor-pointer"
          >
            {t.actionClose}
          </button>
        </div>
      </div>
    </div>
  );
};
