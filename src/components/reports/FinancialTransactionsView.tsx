import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authRequest } from '../../utils/authClient';
import { useApp } from '../../context/AppContext';
import type { AccountHeadMaster } from '../../types/database';

type VoucherType = 'RV' | 'PV' | 'JV' | 'CV';
type Line = { accountId: string; debit: string; credit: string; narration: string };
type Voucher = { Voucher_ID: string; Voucher_No: string; Voucher_Type: VoucherType; Voucher_Date: string; Narration: string; Total_Debit: number; Total_Credit: number; Voucher_Status: string; Created_By?: string };
const today = new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ accountId: '', debit: '', credit: '', narration: '' });

export const FinancialTransactionsView: React.FC<{ initialType?: VoucherType }> = ({ initialType = 'RV' }) => {
  const { accountHeads, currentUser, hasPermission } = useApp();
  const [type, setType] = useState<VoucherType>(initialType);
  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const activeAccounts = useMemo(() => accountHeads.filter((a: AccountHeadMaster) => a.Status === 'Active'), [accountHeads]);
  const totals = useMemo(() => lines.reduce((a, x) => ({ debit: a.debit + Number(x.debit || 0), credit: a.credit + Number(x.credit || 0) }), { debit: 0, credit: 0 }), [lines]);
  const token = () => { try { return JSON.parse(localStorage.getItem('abasSathiSession') || '{}').token || ''; } catch { return ''; } };
  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    const requestId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `acct-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result: any = await authRequest({ action, token: token(), requestId, ...payload });
    return result;
  };
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try { const r: any = await call('listAccountingVouchers', { limit: 200 }); setVouchers(Array.isArray(r.data) ? r.data : []); }
    catch (e: any) { setError(e?.message || 'Voucher register could not be loaded.'); }
    finally { setBusy(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setType(initialType); }, [initialType]);
  const updateLine = (index: number, key: keyof Line, value: string) => setLines(prev => prev.map((x, i) => i === index ? { ...x, [key]: value } : x));
  const submit = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const payloadLines = lines.map(x => ({ accountId: x.accountId, debit: Number(x.debit || 0), credit: Number(x.credit || 0), narration: x.narration }));
      const r: any = await call('createAccountingVoucher', { voucherType: type, voucherDate: date, narration, lines: payloadLines });
      setMessage(`Voucher ${r.data?.voucherNo || ''} created and sent for approval.`); setNarration(''); setLines([emptyLine(), emptyLine()]); await refresh();
    } catch (e: any) { setError(e?.message || 'Voucher could not be saved.'); }
    finally { setBusy(false); }
  };
  const action = async (actionName: string, voucherId: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await call(actionName, { voucherId, reason: 'Cancelled by authorized administrator' }); setMessage('Voucher action completed.'); await refresh(); }
    catch (e: any) { setError(e?.message || 'Voucher action failed.'); }
    finally { setBusy(false); }
  };
  const canApprove = currentUser.Role === 'Admin' && hasPermission('Financial Transactions','Can_Approve');
  const canCreateVoucher = hasPermission('Financial Transactions','Can_Create');
  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold text-[#29352D]">Financial Transactions</h2><p className="text-xs text-gray-500 mt-1">Voucher entry, approval and posting to the existing journal ledger.</p></div>
    {currentUser.Role !== 'Committee' && canCreateVoucher && <div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-sm">Create Voucher</h3><span className="text-[11px] text-gray-500">New vouchers require Admin approval before posting.</span></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs font-semibold">Voucher Type<select value={type} onChange={e => setType(e.target.value as VoucherType)} className="mt-1 w-full border rounded-lg p-2 bg-white">{(['RV','PV','JV','CV'] as VoucherType[]).map(x => <option key={x} value={x}>{x} – {({RV:'Receipt',PV:'Payment',JV:'Journal',CV:'Contra'} as any)[x]} Voucher</option>)}</select></label>
        <label className="text-xs font-semibold">Voucher Date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full border rounded-lg p-2" /></label>
        <label className="text-xs font-semibold">Narration<input value={narration} onChange={e => setNarration(e.target.value)} maxLength={500} placeholder="Transaction description" className="mt-1 w-full border rounded-lg p-2" /></label>
      </div>
      <div className="space-y-2">
        {lines.map((line, i) => <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 items-end rounded-lg bg-[#F7F4EC] p-2">
          <label className="text-[11px] font-semibold">Account Head<select value={line.accountId} onChange={e => updateLine(i, 'accountId', e.target.value)} className="mt-1 w-full border rounded p-2 bg-white"><option value="">Select Account</option>{activeAccounts.map(a => <option key={a.Account_ID} value={a.Account_ID}>{a.Account_Code} – {a.Account_Name}</option>)}</select></label>
          <label className="text-[11px] font-semibold">Debit<input type="number" min="0" step="0.01" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
          <label className="text-[11px] font-semibold">Credit<input type="number" min="0" step="0.01" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
          <label className="text-[11px] font-semibold">Line Narration<input value={line.narration} onChange={e => updateLine(i, 'narration', e.target.value)} className="mt-1 w-full border rounded p-2" /></label>
          <button type="button" onClick={() => setLines(prev => prev.filter((_, j) => j !== i))} disabled={lines.length <= 2} className="text-xs text-red-700 px-2 py-2 disabled:opacity-30">Remove</button>
        </div>)}
        <button type="button" onClick={() => setLines(prev => [...prev, emptyLine()])} className="text-xs font-semibold text-[#536B4D] border rounded-lg px-3 py-2">+ Add Journal Line</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="text-xs font-semibold">Total Debit: ₹{totals.debit.toFixed(2)} <span className="mx-2 text-gray-400">|</span> Total Credit: ₹{totals.credit.toFixed(2)} <span className={`ml-2 ${Math.abs(totals.debit-totals.credit)<0.01 && totals.debit>0 ? 'text-green-700' : 'text-red-700'}`}>{Math.abs(totals.debit-totals.credit)<0.01 && totals.debit>0 ? 'Balanced' : 'Not balanced'}</span></div><button disabled={busy || !narration.trim() || !date || lines.length<2 || Math.abs(totals.debit-totals.credit)>0.009 || totals.debit<=0 || lines.some(x=>!x.accountId)} onClick={() => void submit()} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold disabled:opacity-40">Save for Approval</button></div>
      {activeAccounts.length===0 && <p className="text-xs text-amber-700">No Account Head records loaded. Configure active accounts in Account Head Master first.</p>}
    </div>}
    {error && <p className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-3 text-xs">{error}</p>}{message && <p className="rounded-lg border border-green-200 bg-green-50 text-green-800 p-3 text-xs">{message}</p>}
    <div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3"><div className="flex justify-between items-center"><h3 className="font-bold text-sm">Voucher Register</h3><button onClick={() => void refresh()} disabled={busy} className="text-xs border rounded-lg px-3 py-1.5">Refresh</button></div><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-[#536B4D] text-white"><tr><th className="p-2">Voucher No.</th><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Narration</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{vouchers.map(v => <tr key={v.Voucher_ID} className="border-b"><td className="p-2 font-mono">{v.Voucher_No}</td><td className="p-2">{String(v.Voucher_Date||'').slice(0,10)}</td><td className="p-2">{v.Voucher_Type}</td><td className="p-2">{v.Narration}</td><td className="p-2 text-right">₹{Number(v.Total_Debit||0).toFixed(2)}</td><td className="p-2 text-right">₹{Number(v.Total_Credit||0).toFixed(2)}</td><td className="p-2">{v.Voucher_Status}</td><td className="p-2 whitespace-nowrap">{canApprove && v.Voucher_Status==='Pending Approval' && <button disabled={busy} onClick={()=>void action('approveAccountingVoucher',v.Voucher_ID)} className="text-[#536B4D] font-bold mr-2">Approve</button>}{canApprove && v.Voucher_Status==='Approved' && <button disabled={busy} onClick={()=>void action('postAccountingVoucher',v.Voucher_ID)} className="text-blue-700 font-bold mr-2">Post</button>}{canApprove && ['Draft','Pending Approval','Approved'].includes(v.Voucher_Status) && <button disabled={busy} onClick={()=>void action('cancelAccountingVoucher',v.Voucher_ID)} className="text-red-700 font-bold">Cancel</button>}</td></tr>)}</tbody></table></div>{!vouchers.length && <p className="text-xs text-gray-500">No vouchers found.</p>}</div>
  </div>;
};
