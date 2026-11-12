import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';

export const BackupManager: React.FC = () => {
  const { createSocietyBackup, configureAutomatedBackup, restoreSocietyBackup, listSocietyBackups, listRecoveryOperations } = useApp();
  const [rows,setRows]=useState<any[]>([]);
  const [recoveryRows,setRecoveryRows]=useState<any[]>([]);
  const [backupId,setBackupId]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const refresh=async()=>{try{const [b,r]=await Promise.all([listSocietyBackups(),listRecoveryOperations()]);setRows(b);setRecoveryRows(r);}catch(e:any){setMessage(e?.message||'Could not load backup/recovery history.');}};
  useEffect(()=>{void refresh();},[]);
  const manual=async()=>{setBusy(true);setMessage('');try{const r:any=await createSocietyBackup();setMessage(`Backup completed. File ID: ${r.data?.fileId||'See backup history'}`);await refresh();}catch(e:any){setMessage(e?.message||'Backup failed.');}finally{setBusy(false);}};
  const schedule=async(enabled:boolean)=>{setBusy(true);setMessage('');try{const r:any=await configureAutomatedBackup(enabled);setMessage(enabled?`Daily backup enabled (approx. ${r.data?.approximateHour}:00, ${r.data?.timeZone}).`:'Daily backup disabled.');}catch(e:any){setMessage(e?.message||'Could not update schedule.');}finally{setBusy(false);}};
  const restore=async()=>{if(!backupId.trim())return;if(!window.confirm('Restore will replace the current society database sheets. A pre-restore copy is created automatically. Continue?'))return;setBusy(true);setMessage('');try{const r:any=await restoreSocietyBackup(backupId.trim());setMessage(`Restore completed. Pre-restore backup ID: ${r.data?.preRestoreBackupId||'not returned'}`);await refresh();}catch(e:any){setMessage(e?.message||'Restore failed.');}finally{setBusy(false);}};
  return <div className="space-y-4">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
      <strong>Important:</strong> Automated backups run using the Apps Script owner's authorization and script timezone. Restore replaces society database sheets. Test restore on a separate test society before using this in production.
    </div>
    <div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <h3 className="font-bold text-sm">Backup Schedule</h3>
      <p className="text-xs text-gray-600">Daily trigger at approximately 02:00 in the Apps Script project timezone. The central master and active society spreadsheets are copied to private Drive folders.</p>
      <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void schedule(true)} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold">Enable Daily Backup</button><button disabled={busy} onClick={()=>void schedule(false)} className="rounded-lg border px-4 py-2 text-xs font-bold">Disable Schedule</button><button disabled={busy} onClick={()=>void manual()} className="rounded-lg border px-4 py-2 text-xs font-bold">Create Backup Now</button></div>
    </div>
    <div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <div className="flex justify-between items-center"><h3 className="font-bold text-sm">Restore from Backup</h3><button onClick={()=>void refresh()} className="text-xs font-bold text-[#536B4D]">Refresh history</button></div>
      <label className="block text-xs font-semibold">Backup File ID<input value={backupId} onChange={e=>setBackupId(e.target.value)} placeholder="Paste a backup file ID from the list below" className="mt-1 w-full border rounded-lg p-2 font-mono"/></label>
      <button disabled={busy||!backupId.trim()} onClick={()=>void restore()} className="rounded-lg bg-red-700 text-white px-4 py-2 text-xs font-bold disabled:opacity-50">Restore Database</button>
    </div>
    {message&&<p className="rounded-lg border border-[#E8E1D4] bg-white p-3 text-xs">{message}</p>}
    <div className="rounded-xl border border-[#E8E1D4] bg-white overflow-hidden">
      <div className="p-4 font-bold text-sm">Backup History</div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-[#536B4D] text-white"><tr><th className="p-2">Created</th><th className="p-2">File Name</th><th className="p-2">Type</th><th className="p-2">Status</th><th className="p-2">File ID</th><th className="p-2">Action</th></tr></thead><tbody>
        {rows.map(r=><tr key={r.Backup_ID} className="border-b"><td className="p-2">{String(r.Created_At||'').slice(0,19)}</td><td className="p-2">{r.File_Name}</td><td className="p-2">{r.Backup_Type}</td><td className="p-2">{r.Status}</td><td className="p-2 font-mono">{r.File_ID}</td><td className="p-2"><button onClick={()=>setBackupId(r.File_ID)} className="font-bold text-[#536B4D]">Select</button></td></tr>)}
      </tbody></table>{!rows.length&&<p className="p-4 text-xs text-gray-500">No backup records are available.</p>}</div>
    </div>
    <div className="rounded-xl border border-amber-200 bg-white overflow-hidden">
      <div className="p-4"><h3 className="font-bold text-sm text-amber-900">Incomplete Operations — Manual Reconciliation Queue</h3><p className="text-xs text-gray-600 mt-1">Do not retry a STARTED operation blindly. Compare the target register, operation ID and audit log first.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-amber-100"><tr><th className="p-2">Operation ID</th><th className="p-2">Action</th><th className="p-2">Record ID</th><th className="p-2">Status</th><th className="p-2">Created</th></tr></thead><tbody>{recoveryRows.map(r=><tr key={r.Operation_ID} className="border-b"><td className="p-2 font-mono">{r.Operation_ID}</td><td className="p-2">{r.Action}</td><td className="p-2">{r.Record_ID}</td><td className="p-2">{r.Status}</td><td className="p-2">{String(r.Created_At||'').slice(0,19)}</td></tr>)}</tbody></table>{!recoveryRows.length&&<p className="p-4 text-xs text-gray-500">No incomplete operations found.</p>}</div>
    </div>
  </div>;
};
