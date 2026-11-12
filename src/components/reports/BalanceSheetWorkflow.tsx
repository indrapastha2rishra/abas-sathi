import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';

type Line={accountCode:string;accountName:string;accountType:string;debit:number;credit:number};
export const BalanceSheetWorkflow: React.FC = () => {
  const { currentUser, getReport, postOpeningBalances, createReportSnapshot, approveReportSnapshot, listReportSnapshots } = useApp();
  const [report,setReport]=useState<any>(null);
  const [snapshots,setSnapshots]=useState<any[]>([]);
  const [lines,setLines]=useState<Line[]>([{accountCode:'',accountName:'',accountType:'Asset',debit:0,credit:0}]);
  const [effectiveDate,setEffectiveDate]=useState(new Date().toISOString().slice(0,10));
  const [snapshotId,setSnapshotId]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const totals=useMemo(()=>({debit:lines.reduce((a,x)=>a+Number(x.debit||0),0),credit:lines.reduce((a,x)=>a+Number(x.credit||0),0)}),[lines]);
  const refresh=async()=>{setBusy(true);try{const r:any=await getReport('balanceSheet',{asOfDate:effectiveDate});setReport(r);if(['Admin','Accountant'].includes(currentUser.Role))setSnapshots(await listReportSnapshots());else setSnapshots([]);}catch(e:any){setMessage(e?.message||'Could not load the balance sheet report.');}finally{setBusy(false);}};
  useEffect(()=>{void refresh();},[effectiveDate]);
  const change=(i:number,k:keyof Line,v:string)=>setLines(prev=>prev.map((x,j)=>j===i?{...x,[k]:k==='debit'||k==='credit'?Number(v||0):v}:x));
  const submitOpening=async()=>{if(Math.abs(totals.debit-totals.credit)>0.009){setMessage('Opening debit and credit totals must match.');return;}
    if(!window.confirm('Post these opening balances as a permanent balanced journal batch? This can only be corrected with an adjustment journal.'))return;
    setBusy(true);setMessage('');try{const r:any=await postOpeningBalances(lines.filter(x=>x.accountName.trim()&&(x.debit>0||x.credit>0)),effectiveDate);setMessage(`Opening balances posted. Batch: ${r.data?.batchId}`);await refresh();}
    catch(e:any){setMessage(e?.message||'Opening balance posting failed.');}finally{setBusy(false);}};
  const submitSnapshot=async()=>{setBusy(true);setMessage('');try{const r:any=await createReportSnapshot(effectiveDate,'System-generated balance sheet snapshot');setSnapshotId(r.data?.snapshotId||'');setMessage(`Snapshot submitted for approval: ${r.data?.snapshotId||''}`);await refresh();}
    catch(e:any){setMessage(e?.message||'Snapshot could not be created.');}finally{setBusy(false);}};
  const approve=async()=>{setBusy(true);setMessage('');try{const r:any=await approveReportSnapshot(snapshotId);setMessage(`Snapshot approved: ${r.data?.snapshotId}`);await refresh();}
    catch(e:any){setMessage(e?.message||'Approval failed.');}finally{setBusy(false);}};
  const data=report?.data||{};
  return <div className="space-y-4">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      This is an internal accounting workflow, not an independent statutory audit. Opening balances must be verified by the society's accountant/auditor. Posted opening balances are immutable; corrections require a reviewed adjustment journal.
    </div>
    <div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-bold text-sm">Server-side Balance Sheet & Trial Balance</h3><button onClick={()=>void refresh()} className="text-xs font-bold text-[#536B4D]">Refresh</button></div>
      {busy&&!report?<p className="text-xs text-gray-500">Loading report…</p>:<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg bg-[#F7F4EC] p-3"><div className="text-gray-500">Assets</div><strong>₹{Number(data.assetTotal||0).toLocaleString('en-IN')}</strong></div>
          <div className="rounded-lg bg-[#F7F4EC] p-3"><div className="text-gray-500">Liabilities</div><strong>₹{Number(data.liabilityTotal||0).toLocaleString('en-IN')}</strong></div>
          <div className="rounded-lg bg-[#F7F4EC] p-3"><div className="text-gray-500">Equity incl. surplus</div><strong>₹{Number(data.equityTotal||0).toLocaleString('en-IN')}</strong></div>
          <div className="rounded-lg bg-[#F7F4EC] p-3"><div className="text-gray-500">Difference</div><strong>₹{Number(data.difference||0).toLocaleString('en-IN')}</strong></div>
        </div>
        <p className="text-xs">Trial balance: {data.balanced?'Balanced':'Not balanced'} · Opening balances: {data.hasOpeningBalances?'Posted':'Not posted'} · Journal lines: {data.postedJournalCount||0} · Snapshot: {report?.auditStatus||'Draft'}</p>
        <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-[#536B4D] text-white"><tr><th className="p-2">Account</th><th className="p-2">Type</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2 text-right">Net (Dr-Cr)</th></tr></thead><tbody>{(data.accounts||[]).map((a:any)=><tr key={a.Account_Name} className="border-b"><td className="p-2">{a.Account_Name}</td><td className="p-2">{a.Account_Type}</td><td className="p-2 text-right">{Number(a.Debit||0).toFixed(2)}</td><td className="p-2 text-right">{Number(a.Credit||0).toFixed(2)}</td><td className="p-2 text-right">{Number(a.Net||0).toFixed(2)}</td></tr>)}</tbody></table></div>
      </>}
    </div>
    {currentUser.Role==='Admin'&&!data.hasOpeningBalances&&<div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <h3 className="font-bold text-sm">Opening Balance Entry (one-time)</h3>
      <label className="text-xs font-semibold">Effective Date<input type="date" value={effectiveDate} onChange={e=>setEffectiveDate(e.target.value)} className="ml-2 border rounded p-1"/></label>
      {lines.map((line,i)=><div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <label className="text-xs">Account Name<input value={line.accountName} onChange={e=>change(i,'accountName',e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
        <label className="text-xs">Account Type<select value={line.accountType} onChange={e=>change(i,'accountType',e.target.value)} className="mt-1 w-full border rounded p-2">{['Asset','Liability','Equity','Fund'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="text-xs">Debit<input type="number" min="0" step="0.01" value={line.debit} onChange={e=>change(i,'debit',e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
        <label className="text-xs">Credit<input type="number" min="0" step="0.01" value={line.credit} onChange={e=>change(i,'credit',e.target.value)} className="mt-1 w-full border rounded p-2"/></label>
        <button onClick={()=>setLines(prev=>prev.filter((_,j)=>j!==i))} className="text-xs text-red-700 p-2">Remove</button>
      </div>)}
      <div className="flex flex-wrap justify-between gap-2 text-xs"><button onClick={()=>setLines(prev=>[...prev,{accountCode:'',accountName:'',accountType:'Asset',debit:0,credit:0}])} className="border rounded-lg px-3 py-2">Add Account Line</button><span>Debit ₹{totals.debit.toFixed(2)} / Credit ₹{totals.credit.toFixed(2)}</span></div>
      <button disabled={busy||Math.abs(totals.debit-totals.credit)>0.009} onClick={()=>void submitOpening()} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold disabled:opacity-50">Post Opening Balances</button>
    </div>}
    {['Accountant','Admin'].includes(currentUser.Role)&&data.balanced&&data.hasOpeningBalances&&<button disabled={busy} onClick={()=>void submitSnapshot()} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold">Submit Balance Sheet for Admin Approval</button>}
    {currentUser.Role==='Admin'&&<div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-2">
      <h3 className="font-bold text-sm">Approve Report Snapshot</h3>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr><th className="p-2">Snapshot</th><th className="p-2">As Of</th><th className="p-2">Created By</th><th className="p-2">Status</th><th className="p-2">Select</th></tr></thead><tbody>{snapshots.filter(x=>x.Status==='Pending Approval').map(x=><tr key={x.Snapshot_ID} className="border-b"><td className="p-2 font-mono">{x.Snapshot_ID}</td><td className="p-2">{String(x.As_Of_Date||'').slice(0,10)}</td><td className="p-2">{x.Created_By}</td><td className="p-2">{x.Status}</td><td className="p-2"><button onClick={()=>setSnapshotId(x.Snapshot_ID)} className="text-[#536B4D] font-bold">Select</button></td></tr>)}</tbody></table></div>
      <input value={snapshotId} onChange={e=>setSnapshotId(e.target.value)} placeholder="Snapshot ID (created by another Accountant/Admin)" className="w-full border rounded-lg p-2 text-xs"/>
      <button disabled={busy||!snapshotId.trim()} onClick={()=>void approve()} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold">Verify Hash & Approve</button>
    </div>}
    {message&&<p className="rounded-lg border border-[#E8E1D4] bg-white p-3 text-xs">{message}</p>}
  </div>;
};
