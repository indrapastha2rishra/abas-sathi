import React, { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, RefreshCw, Save, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PERMISSION_MODULES, type RolePermissionRecord } from '../../utils/permissions';

const roles = ['Admin','Committee','Accountant','Resident'] as const;
const flags = ['Can_View','Can_Create','Can_Edit','Can_Delete','Can_Approve'] as const;
type Flag = typeof flags[number];
const emptyRow = ():RolePermissionRecord => ({Permission_ID:'',Role:'Committee',Module_Name:'Dashboard',Can_View:false,Can_Create:false,Can_Edit:false,Can_Delete:false,Can_Approve:false,Remarks:''});
const truth = (v:any) => v===true || String(v||'').trim().toLowerCase()==='true' || String(v||'').trim()==='1';

export const RolePermissionManager:React.FC = () => {
  const { rolePermissions, createModuleRecord, updateModuleRecord, deleteRolePermission, refreshRolePermissions, actualRole, hasPermission } = useApp();
  const [draft,setDraft] = useState<RolePermissionRecord|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [roleFilter,setRoleFilter] = useState('All');
  const rows = useMemo(()=>rolePermissions.filter(r=>roleFilter==='All'||String(r.Role)===roleFilter).sort((a,b)=>String(a.Role).localeCompare(String(b.Role))||String(a.Module_Name).localeCompare(String(b.Module_Name))),[rolePermissions,roleFilter]);
  const startNew = () => { setDraft(emptyRow()); setError(''); };
  const startEdit = (row:RolePermissionRecord) => { setDraft({...row, ...Object.fromEntries(flags.map(k=>[k,truth(row[k])]))}); setError(''); };
  const close = () => { if(!busy)setDraft(null); };
  const save = async () => {
    if(!draft||busy)return;
    if(!draft.Role||!draft.Module_Name){setError('Role ও Module নির্বাচন করুন।');return;}
    setBusy(true);setError('');
    try {
      const data = {...draft};
      if(!data.Permission_ID) data.Permission_ID=`RP-${String(data.Role).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      flags.forEach(k=>data[k]=truth(data[k]));
      if(rolePermissions.some(r=>String(r.Permission_ID)===String(data.Permission_ID))) await updateModuleRecord('rolePermissions',String(data.Permission_ID),data as Record<string,unknown>);
      else await createModuleRecord('rolePermissions',data as Record<string,unknown>);
      await refreshRolePermissions();setDraft(null);
    } catch(e:any){setError(String(e?.message||e));} finally{setBusy(false);}
  };
  const remove = async (row:RolePermissionRecord) => {
    if(!row.Permission_ID||!window.confirm(`Delete permission ${row.Role} / ${row.Module_Name}? Missing permission will deny access.`))return;
    setBusy(true);setError('');try{await deleteRolePermission(String(row.Permission_ID));}catch(e:any){setError(String(e?.message||e));}finally{setBusy(false);}
  };
  if(actualRole!=='Admin') return <div className="p-5 rounded-2xl border bg-white text-sm text-red-700">Permission management is Admin-only.</div>;
  return <div className="space-y-4 rounded-2xl border border-[#E8E1D4] bg-white p-4 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-bold text-[#29352D] flex gap-2 items-center"><ShieldCheck size={18}/> Role_Permission Configuration</h2><p className="text-xs text-slate-500 mt-1">Database-configured access. Missing or unknown permission records are denied.</p></div>
      <div className="flex gap-2"><button onClick={()=>void refreshRolePermissions()} disabled={busy} className="rounded-lg border px-3 py-2 text-xs font-semibold inline-flex gap-1 items-center"><RefreshCw size={14}/>Refresh</button>{hasPermission('Role Permission Management','Can_Create') && <button onClick={startNew} className="rounded-lg bg-[#536B4D] text-white px-3 py-2 text-xs font-bold inline-flex gap-1 items-center"><Plus size={14}/>Add Permission</button>}</div>
    </div>
    {error&&<div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
    <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold">Filter Role</label><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-xs"><option>All</option>{roles.map(r=><option key={r}>{r}</option>)}</select><span className="text-xs text-slate-500">{rows.length} permission record(s)</span></div>
    <div className="overflow-x-auto border rounded-xl"><table className="w-full min-w-[900px] text-xs text-left"><thead className="bg-[#536B4D] text-white"><tr>{['Permission ID','Role','Module','View','Create','Edit','Delete','Approve','Remarks','Actions'].map(h=><th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y">
      {rows.map(r=><tr key={r.Permission_ID} className="hover:bg-slate-50"><td className="px-3 py-2 font-mono">{r.Permission_ID}</td><td className="px-3 py-2 font-semibold">{r.Role}</td><td className="px-3 py-2">{r.Module_Name}</td>{flags.map(f=><td key={f} className="px-3 py-2 text-center">{truth(r[f])?'✓':'—'}</td>)}<td className="px-3 py-2 max-w-[180px] truncate" title={String(r.Remarks||'')}>{r.Remarks||''}</td><td className="px-3 py-2"><div className="flex gap-1">{hasPermission('Role Permission Management','Can_Edit') && <button title="Edit" onClick={()=>startEdit(r)} className="p-1.5 rounded hover:bg-slate-100"><Pencil size={14}/></button>}{hasPermission('Role Permission Management','Can_Delete') && <button title="Delete" onClick={()=>void remove(r)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={14}/></button>}</div></td></tr>)}
      {rows.length===0&&<tr><td colSpan={10} className="p-6 text-center text-slate-500">No permission rows found.</td></tr>}
    </tbody></table></div>
    {draft&&<div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-3"><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-4 space-y-4 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center"><h3 className="font-bold">{draft.Permission_ID?'Edit Permission':'Add Permission'}</h3><button onClick={close} className="p-1 rounded hover:bg-slate-100"><X size={18}/></button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs font-semibold">Role<select disabled={!!draft.Permission_ID} value={String(draft.Role||'')} onChange={e=>setDraft({...draft,Role:e.target.value})} className="mt-1 w-full border rounded-lg p-2"><option value="">Choose</option>{roles.map(r=><option key={r}>{r}</option>)}</select></label><label className="text-xs font-semibold">Module<select disabled={!!draft.Permission_ID} value={String(draft.Module_Name||'')} onChange={e=>setDraft({...draft,Module_Name:e.target.value})} className="mt-1 w-full border rounded-lg p-2"><option value="">Choose</option>{PERMISSION_MODULES.map(m=><option key={m}>{m}</option>)}</select></label></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{flags.map(f=>{const protectedAdminAccess=draft.Role==='Admin'&&draft.Module_Name==='Role Permission Management'&&['Can_View','Can_Create','Can_Edit'].includes(f);return <label key={f} className="flex items-center gap-2 border rounded-lg p-2 text-xs"><input type="checkbox" disabled={protectedAdminAccess} checked={truth(draft[f])} onChange={e=>setDraft({...draft,[f]:e.target.checked})}/>{f.replace('Can_','')}{protectedAdminAccess&&<span title="Protected to prevent Admin lockout">🔒</span>}</label>;})}</div>
      <label className="text-xs font-semibold block">Remarks<input value={String(draft.Remarks||'')} onChange={e=>setDraft({...draft,Remarks:e.target.value})} className="mt-1 w-full border rounded-lg p-2" maxLength={200}/></label>
      <div className="flex justify-end gap-2"><button onClick={close} disabled={busy} className="px-3 py-2 border rounded-lg text-xs font-semibold">Cancel</button><button onClick={()=>void save()} disabled={busy} className="px-3 py-2 bg-[#536B4D] text-white rounded-lg text-xs font-bold inline-flex gap-1 items-center"><Save size={14}/>{busy?'Saving…':'Save Permission'}</button></div>
    </div></div>}
  </div>;
};
