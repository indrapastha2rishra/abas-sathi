/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  TrendingDown,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Printer,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { ExpenseRegister, PaymentMode } from '../../types/database';

export const ExpensesView: React.FC = () => {
  const {
    expenses,
    expenseCategories,
    bankAccounts,
    addExpense,
    approveExpense,
    setPreviewVoucher,
    activeRole,
    t,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'register' | 'add' | 'categories' | 'pending'>('register');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Form State
  const [category, setCategory] = useState(expenseCategories[0]?.Category_Name || 'Security');
  const [subcategory, setSubcategory] = useState(expenseCategories[0]?.Subcategory_Name || '');
  const [payee, setPayee] = useState('');
  const [particulars, setParticulars] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [mode, setMode] = useState<PaymentMode>('NEFT');
  const [reference, setReference] = useState('');
  const [bankAccount, setBankAccount] = useState(bankAccounts[0]?.BankAccount_ID || 'BANK-SBI-01');
  const [status, setStatus] = useState<ExpenseRegister['Expense_Status']>('Paid');
  const [remarks, setRemarks] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const newExp = addExpense({
      Payment_Date: new Date().toISOString().split('T')[0],
      Expense_Category: category,
      Expense_Subcategory: subcategory,
      Payee_Name: payee,
      Particulars: particulars,
      Payment_Amount: Number(amount),
      Payment_Mode: mode,
      Payment_Reference: reference || 'N/A',
      Bank_Account: bankAccount,
      PropertyID: 'Common',
      Remarks: remarks,
      File_Reference: `Voucher_${payee.replace(/\s+/g, '_')}.pdf`,
      Expense_Status: status,
    });

    setFormSuccess(`Voucher ${newExp.Voucher_No} created successfully!`);
    setTimeout(() => {
      setFormSuccess('');
      setPreviewVoucher(newExp);
      setActiveSubTab('register');
    }, 1200);
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.Voucher_No.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.Payee_Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.Particulars.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = categoryFilter === 'All' || exp.Expense_Category === categoryFilter;

    if (activeSubTab === 'pending') {
      return matchesSearch && matchesCat && exp.Expense_Status === 'Pending Approval';
    }

    return matchesSearch && matchesCat;
  });

  const totalPaidExpenses = expenses
    .filter((e) => e.Expense_Status === 'Paid')
    .reduce((sum, e) => sum + e.Payment_Amount, 0);

  return (
    <div className="space-y-6">
      {/* Title & Sub navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E1D4] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#29352D] flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[#C97958]" />
            {t.navExpenses} / সোসাইটির খরচ ও ভাউচার
          </h1>
          <p className="text-xs text-gray-500">
            Realized society expenditures with category breakdown, bank reconciliation, and vouchers
          </p>
        </div>

        <div className="flex flex-wrap gap-1 bg-[#F7F4EC] p-1 rounded-xl border border-[#E8E1D4]">
          <button
            onClick={() => setActiveSubTab('register')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeSubTab === 'register' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            Expense Register ({expenses.length})
          </button>
          <button
            onClick={() => setActiveSubTab('add')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 ${
              activeSubTab === 'add' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Expense
          </button>
          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeSubTab === 'categories' ? 'bg-white text-[#536B4D] shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            Categories Master (13)
          </button>
          <button
            onClick={() => setActiveSubTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              activeSubTab === 'pending' ? 'bg-white text-amber-700 shadow-xs' : 'text-[#29352D]/70'
            }`}
          >
            Pending Approvals ({expenses.filter((e) => e.Expense_Status === 'Pending Approval').length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1 & 4: EXPENSE REGISTER */}
      {(activeSubTab === 'register' || activeSubTab === 'pending') && (
        <div className="space-y-4">
          {/* Filter & Summary Card */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-[#E8E1D4] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search voucher no, payee, particulars..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] pl-9 pr-3 py-2 text-xs text-[#29352D] focus:border-[#536B4D] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-xs font-medium text-[#29352D] focus:border-[#536B4D] focus:outline-hidden cursor-pointer"
              >
                <option value="All">All Categories</option>
                {expenseCategories.map((c) => (
                  <option key={c.Category_ID} value={c.Category_Name}>
                    {c.Category_Name}
                  </option>
                ))}
              </select>

              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 shrink-0">
                Total Realized: ₹{totalPaidExpenses.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#536B4D] text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Voucher No</th>
                    <th className="px-4 py-3 font-semibold">Payment Date</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Payee Name</th>
                    <th className="px-4 py-3 font-semibold">Particulars</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount (₹)</th>
                    <th className="px-4 py-3 font-semibold">Mode & Ref</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E1D4]">
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.Expense_ID} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#29352D]">{exp.Voucher_No}</td>
                      <td className="px-4 py-3 text-gray-500">{exp.Payment_Date}</td>
                      <td className="px-4 py-3 font-semibold text-[#536B4D]">{exp.Expense_Category}</td>
                      <td className="px-4 py-3 font-medium text-[#29352D]">{exp.Payee_Name}</td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{exp.Particulars}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#29352D]">
                        ₹{exp.Payment_Amount.toLocaleString('en-IN')}.00
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                        {exp.Payment_Mode} ({exp.Payment_Reference})
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.Expense_Status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {exp.Expense_Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {exp.Expense_Status === 'Pending Approval' ? (
                          <button
                            onClick={() => approveExpense(exp.Expense_ID)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 cursor-pointer shadow-2xs"
                          >
                            Approve & Pay
                          </button>
                        ) : (
                          <button
                            onClick={() => setPreviewVoucher(exp)}
                            className="text-xs font-semibold text-[#536B4D] hover:underline cursor-pointer"
                          >
                            Voucher
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500 italic">
                        No expenses found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ADD EXPENSE FORM */}
      {activeSubTab === 'add' && (
        <div className="max-w-2xl mx-auto rounded-2xl border border-[#E8E1D4] bg-white p-6 shadow-2xs">
          <div className="border-b border-[#E8E1D4] pb-3 mb-6">
            <h2 className="text-lg font-bold text-[#29352D]">
              Record Society Expenditure / নতুন খরচ অন্তর্ভুক্ত করুন
            </h2>
            <p className="text-xs text-gray-500">
              Per rules: Only "Paid" expenses are counted in actual cash outflow statements.
            </p>
          </div>

          {formSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Expense Category / খরচের বিভাগ:</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    const catObj = expenseCategories.find((c) => c.Category_Name === e.target.value);
                    if (catObj) setSubcategory(catObj.Subcategory_Name);
                  }}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2.5 text-[#29352D]"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.Category_ID} value={c.Category_Name}>
                      {c.Category_Name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Subcategory / উপ-বিভাগ:</label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Payee / Vendor Name (প্রাপক):</label>
              <input
                type="text"
                required
                placeholder="e.g. Otis Elevator Company, CESC Limited, Electrician..."
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Particulars / বিবরণ:</label>
              <textarea
                required
                rows={2}
                placeholder="Describe expenditure purpose, invoice reference, or duty hours..."
                value={particulars}
                onChange={(e) => setParticulars(e.target.value)}
                className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold mb-1">Amount (₹) / টাকার অঙ্ক:</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 font-bold text-base text-[#29352D]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Payment Mode:</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as PaymentMode)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                >
                  <option value="NEFT">NEFT / Net Banking</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Petty Cash</option>
                  <option value="Card">Debit/Credit Card</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">UTR / Cheque Ref:</label>
                <input
                  type="text"
                  placeholder="e.g. NEFT/10294"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 font-mono text-[#29352D]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Bank Account Disbursed From:</label>
                <select
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.BankAccount_ID} value={b.BankAccount_ID}>
                      {b.Bank_Name} ({b.Account_Type}) - Balance: ₹{b.Current_Balance.toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Approval Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E8E1D4] bg-[#F7F4EC] px-3 py-2 text-[#29352D]"
                >
                  <option value="Paid">Paid (Already Disbursed)</option>
                  <option value="Pending Approval">Pending Approval (Committee Review)</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E8E1D4]">
              <button
                type="button"
                onClick={() => setActiveSubTab('register')}
                className="px-4 py-2.5 rounded-xl border border-[#E8E1D4] text-[#29352D] hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#536B4D] text-white font-bold hover:bg-[#3F523A] shadow-xs cursor-pointer"
              >
                Create Voucher & Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 3: EXPENSE CATEGORIES MASTER */}
      {activeSubTab === 'categories' && (
        <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-[#E8E1D4] bg-[#F7F4EC]">
            <h3 className="font-bold text-[#29352D] text-sm">Expense Category Master (Sheet I)</h3>
            <p className="text-xs text-gray-500">Row-based structure as mandated by database specification</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#536B4D] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category ID</th>
                  <th className="px-4 py-3 font-semibold">Category Name</th>
                  <th className="px-4 py-3 font-semibold">Default Subcategory</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E1D4]">
                {expenseCategories.map((c) => (
                  <tr key={c.Category_ID} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500">{c.Category_ID}</td>
                    <td className="px-4 py-3 font-bold text-[#29352D] text-sm">{c.Category_Name}</td>
                    <td className="px-4 py-3 font-medium text-[#536B4D]">{c.Subcategory_Name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.Description}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {c.Status}
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
