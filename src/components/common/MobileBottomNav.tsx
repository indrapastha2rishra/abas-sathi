/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Receipt, CreditCard, Wrench, Bell } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { activeRole, activeTab, setActiveTab, t } = useApp();

  // Only display resident bottom navigation on mobile when role is Resident
  if (activeRole !== 'Resident') return null;

  const items = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'resident_bills', label: 'Bills', icon: Receipt },
    { id: 'resident_pay', label: 'Pay Now', icon: CreditCard, highlight: true },
    { id: 'resident_requests', label: 'Requests', icon: Wrench },
    { id: 'resident_notices', label: 'Notices', icon: Bell },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E8E1D4] bg-white/95 backdrop-blur-md md:hidden px-2 py-1.5 no-print shadow-lg">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center -mt-4 cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C97958] text-white shadow-md hover:bg-[#A95D3E] transition-all">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold text-[#C97958] mt-0.5">Pay Now</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-[#536B4D] font-bold' : 'text-[#29352D]/60 hover:text-[#29352D]'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
