import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authRequest } from '../../utils/authClient';
import { useApp } from '../../context/AppContext';

type ModuleOption = { key:string; label:string; id:string; canArchive:boolean; roles:string[] };
const MODULES: ModuleOption[] = [
  {key:'properties',label:'Property Master',id:'PropertyID',canArchive:true,roles:['Admin']},
  {key:'owners',label:'Owner Master',id:'OwnerID',canArchive:true,roles:['Admin','Committee']},
  {key:'ownershipHistory',label:'Ownership History',id:'Ownership_ID',canArchive:true,roles:['Admin']},
  {key:'rates',label:'Rate Master',id:'RateID',canArchive:true,roles:['Admin']},
  {key:'expenseCategories',label:'Expense Category Master',id:'Category_ID',canArchive:true,roles:['Admin']},
  {key:'bankAccounts',label:'Bank Account Master',id:'BankAccount_ID',canArchive:true,roles:['Admin','Accountant']},
  {key:'tenants',label:'Tenant Master',id:'Tenant_ID',canArchive:true,roles:['Admin','Committee']},
  {key:'activityRequests',label:'Activity Request Register',id:'Request_ID',canArchive:true,roles:['Admin','Committee']},
  {key:'notices',label:'Notice Master',id:'Notice_ID',canArchive:true,roles:['Admin','Committee']},
  {key:'gallery',label:'Gallery Master',id:'Gallery_ID',canArchive:true,roles:['Admin','Committee']},
  {key:'preventiveMaintenance',label:'Preventive Maintenance Master',id:'Maintenance_ID',canArchive:true,roles:['Admin','Committee']},
  {key:'ratePropertyMapping',label:'Rate Property Mapping',id:'Rate_Mapping_ID',canArchive:true,roles:['Admin']},
  {key:'propertyUtilityDetails',label:'Property Utility Details',id:'Utility_ID',canArchive:true,roles:['Admin','Accountant']},
  {key:'financialYears',label:'Financial Year Master',id:'FY_ID',canArchive:true,roles:['Admin','Accountant']},
  {key:'accountHeads',label:'Account Head Master',id:'Account_ID',canArchive:true,roles:['Admin','Accountant']}
];
const SYSTEM_FIELDS = new Set(['Created_By','Created_At','Updated_By','Updated_At','Approved_By','Approved_At','Cancelled_By','Cancelled_At','Society_Code','Owner_Status','Ownership_Status','Ownership_End_Date','Password_Salt','Password_Hash']);

export const MasterDataManager: React.FC = () => {
  const { currentUser, createModuleRecord, updateModuleRecord, cancelModuleRecord } = useApp();
  const allowed = useMemo(() => MODULES.filter(m => m.roles.includes(currentUser.Role)), [currentUser.Role]);
  const [moduleKey,setModuleKey] = useState(allowed[0]?.key || 'properties');
  const selected = allowed.find(m=>m.key===moduleKey) || allowed[0];
  const [fields,setFields] = useState<string[]>([]);
  const [records,setRecords] = useState<Record<string,any>[]>([]);
  const [form,setForm] = useState<Record<string,any>>({});
  const [editing,setEditing] = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [archiveReason,setArchiveReason] = useState('');

  const load = useCallback(async () => {
    if(!selected)return;
    setLoading(true);setError('');
    try {
      const session=JSON.parse(localStorage.getItem('abasSathiSession')||'{}');
      const schema:any=await authRequest({action:'getModuleSchema',token:session.token,module:selected.key});
      const data:any=await authRequest({action:'getModuleData',token:session.token,module:selected.key,page:1,limit:200});
      setFields((schema.fields||[]).filter((f:string)=>!SYSTEM_FIELDS.has(f)));
      setRecords(Array.isArray(data.data)?data.data:[]);
    } catch(e:any){setError(e?.message||'Could not load module records.');}
    finally{setLoading(false);}
  },[selected?.key]);
  useEffect(()=>{void load();setEditing(null);setForm({});},[load]);

  const visible = records.filter(row=>Object.values(row).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())));
  const beginNew = () => {setEditing('');setForm({});setError('');};
  const beginEdit = (row:Record<string,any>) => {setEditing(String(row[selected.id]));setForm({...row});setError('');};
  const save = async (e:React.FormEvent) => {
    e.preventDefault();if(!selected)return;setSaving(true);setError('');
    try {
      const clean={...form};
      if(editing){await updateModuleRecord(selected.key,editing,clean);}
      else {await createModuleRecord(selected.key,clean);}
      setEditing(null);setForm({});await load();
    } catch(e:any){setError(e?.message||'Save failed. Your changes have not been confirmed.');}
    finally{setSaving(false);}
  };
  const archive = async (row:Record<string,any>) => {
    if(!selected?.canArchive)return;
    const reason=window.prompt('Enter a reason for archiving this record:');
    if(!reason?.trim())return;
    try{await cancelModuleRecord(selected.key,String(row[selected.id]),reason);await load();}
    catch(e:any){setError(e?.message||'Archive failed.');}
  };
  if(!allowed.length)return <div className="rounded-xl border p-5 text-sm text-gray-600">No master data modules are available for this role.</div>;

  if(!selected)return null;

  return <div className="space-y-4">
    <div className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <label className="text-xs font-semibold text-[#29352D] flex-1">Master Module
          <select value={selected.key} onChange={e=>setModuleKey(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8E1D4] p-2 bg-white">
            {allowed.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#29352D] flex-1">Search records
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search any field..." className="mt-1 w-full rounded-lg border border-[#E8E1D4] p-2"/>
        </label>
        <button onClick={beginNew} className="rounded-lg bg-[#536B4D] px-4 py-2 text-white text-xs font-bold">+ New Record</button>
        <button onClick={()=>void load()} className="rounded-lg border px-4 py-2 text-xs font-bold">Refresh</button>
      </div>
      {error&&<div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">{error}</div>}
      {loading?<p className="text-xs text-gray-500">Loading records…</p>:<div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#536B4D] text-white"><tr><th className="p-2">Record ID</th><th className="p-2">Summary</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead>
          <tbody>{visible.map((row,i)=><tr key={String(row[selected.id]||i)} className="border-b border-[#eee]">
            <td className="p-2 font-mono">{String(row[selected.id]||'')}</td>
            <td className="p-2">{String(row.Owner_Name||row.Flat_No||row.Purpose||row.Subject||row.Account_Name||row.Asset_Name||row.Notice_Title||row.Category_Name||row.Tenant_Name||'Record')}</td>
            <td className="p-2">{String(row.Property_Status||row.Owner_Status||row.Ownership_Status||row.Status||row.Request_Status||row.Notice_Status||row.FY_Status||'—')}</td>
            <td className="p-2 whitespace-nowrap"><button onClick={()=>beginEdit(row)} className="text-[#536B4D] font-bold mr-3">Edit</button>
              {selected.canArchive&&<button onClick={()=>void archive(row)} className="text-red-700 font-bold">{selected.key==='ownershipHistory'?'End Ownership':'Archive'}</button>}
            </td>
          </tr>)}</tbody>
        </table>
        {!visible.length&&<p className="p-5 text-center text-xs text-gray-500">No records found.</p>}
      </div>}
    </div>
    {editing!==null&&<form onSubmit={save} className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-bold text-sm">{editing?'Edit':'Create'} — {selected.label}</h3><button type="button" onClick={()=>{setEditing(null);setForm({});}} className="text-xs text-gray-500">Close</button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(field=>{
          const isId=field===selected.id;
          const value=form[field]??'';
          const numeric=/(amount|area|rate|share|quantity|floor|balance|percentage|percent|fee|discount|adjustment|number)$/i.test(field);
          const date=/(date|_from|_to|_at)$/i.test(field);
          const long=/(remarks|address|description|particulars|document|notes)$/i.test(field);
          return <label key={field} className="text-xs font-semibold text-[#29352D]">{field.replace(/_/g,' ')}
            {long?<textarea rows={2} value={String(value)} disabled={isId&&!!editing} onChange={e=>setForm(v=>({...v,[field]:e.target.value}))} className="mt-1 w-full rounded-lg border border-[#E8E1D4] p-2 font-normal"/>:
            <input type={date?'date':numeric?'number':'text'} step={numeric?'any':undefined} value={date?String(value).slice(0,10):String(value)} disabled={isId&&!!editing} onChange={e=>setForm(v=>({...v,[field]:numeric?(e.target.value===''?'':Number(e.target.value)):e.target.value}))} className="mt-1 w-full rounded-lg border border-[#E8E1D4] p-2 font-normal"/>}
          </label>;
        })}
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={()=>{setEditing(null);setForm({});}} className="rounded-lg border px-4 py-2 text-xs">Cancel</button><button disabled={saving} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold">{saving?'Saving…':'Save to Google Sheets'}</button></div>
    </form>}
  </div>;
};
