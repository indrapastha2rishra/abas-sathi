import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { authRequest } from '../../utils/authClient';

const CATEGORIES = ['Owner Document','Expense Voucher','Gallery Photo','Notice Attachment','Activity Request Attachment','Payment Proof','Invoice PDF'];
export const DocumentCenter: React.FC = () => {
  const { currentUser, properties, owners, uploadPrivateFile, listPrivateFiles, getPrivateFile } = useApp();
  const [category,setCategory]=useState(CATEGORIES[0]);
  const [propertyId,setPropertyId]=useState(String(currentUser.PropertyID||''));
  const [ownerId,setOwnerId]=useState('');
  const [relatedModule,setRelatedModule]=useState('ownershipHistory');
  const [relatedRecordId,setRelatedRecordId]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [rows,setRows]=useState<any[]>([]);
  const [propertyOptions,setPropertyOptions]=useState<any[]>([]);
  const [ownerOptions,setOwnerOptions]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const moduleForCategory:Record<string,string>={'Owner Document':'ownershipHistory','Expense Voucher':'expenses','Gallery Photo':'gallery','Notice Attachment':'notices','Activity Request Attachment':'activityRequests','Payment Proof':'receipts','Invoice PDF':'invoices'};
  const allowed=CATEGORIES.filter(c=>{
    if(currentUser.Role==='Resident')return ['Activity Request Attachment','Payment Proof'].includes(c);
    if(currentUser.Role==='Committee')return !['Owner Document','Property Document','Payment Proof'].includes(c);
    if(currentUser.Role==='Accountant')return !['Owner Document','Property Document'].includes(c);
    return true;
  });
  const refresh=async()=>{setBusy(true);try{setRows(await listPrivateFiles());}catch(e:any){setMessage(e?.message||'Could not load documents.');}finally{setBusy(false);}};
  useEffect(()=>{void refresh();const loadOptions=async()=>{try{const session=JSON.parse(localStorage.getItem('abasSathiSession')||'{}');const [p,o]=await Promise.all([authRequest<any>({action:'getModuleData',token:session.token,module:'properties',page:1,limit:100}),authRequest<any>({action:'getModuleData',token:session.token,module:'owners',page:1,limit:200})]);setPropertyOptions(p.data||[]);setOwnerOptions(o.data||[]);}catch{/* optional selectors remain empty if this role cannot read them */}};void loadOptions();},[]);
  const upload=async(e:React.FormEvent)=>{e.preventDefault();if(!file){setMessage('Choose a file first.');return;}setBusy(true);setMessage('');
    try{const result=await uploadPrivateFile(file,category,propertyId||undefined,ownerId||undefined,relatedModule||undefined,relatedRecordId||undefined);setMessage(`Uploaded: ${result.fileName}`);setFile(null);await refresh();}
    catch(err:any){setMessage(err?.message||'Upload failed.');}finally{setBusy(false);}
  };
  const download=async(row:any)=>{setBusy(true);setMessage('');try{const result:any=await getPrivateFile(row.File_ID,row.PropertyID||undefined);const bytes=Uint8Array.from(atob(result.data.base64),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:result.data.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=result.data.fileName||row.File_Name||'document';a.click();URL.revokeObjectURL(url);}
    catch(err:any){setMessage(err?.message||'Download denied or failed.');}finally{setBusy(false);}};
  return <div className="space-y-4">
    <form onSubmit={upload} className="rounded-xl border border-[#E8E1D4] bg-white p-4 space-y-3">
      <h3 className="font-bold text-sm text-[#29352D]">Private Document Upload</h3>
      <p className="text-xs text-gray-500">Files are stored in the society's private Google Drive folder. Maximum 5 MB; PDF, JPG and PNG only.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs font-semibold">Document Category<select value={category} onChange={e=>{setCategory(e.target.value);setRelatedModule(moduleForCategory[e.target.value]||'');}} className="mt-1 w-full border rounded-lg p-2">{allowed.map(c=><option key={c}>{c}</option>)}</select></label>
        <label className="text-xs font-semibold">Property (optional)<select value={propertyId} onChange={e=>setPropertyId(e.target.value)} className="mt-1 w-full border rounded-lg p-2"><option value="">Select property</option>{(propertyOptions.length?propertyOptions:properties).map(p=><option key={p.PropertyID} value={p.PropertyID}>{p.Flat_No} — {p.PropertyID}</option>)}</select></label>
        <label className="text-xs font-semibold">Owner (optional)<select value={ownerId} onChange={e=>setOwnerId(e.target.value)} className="mt-1 w-full border rounded-lg p-2"><option value="">Select owner</option>{(ownerOptions.length?ownerOptions:owners).map(o=><option key={o.OwnerID} value={o.OwnerID}>{o.Owner_Name}</option>)}</select></label>
        <label className="text-xs font-semibold">Linked Module<select value={relatedModule} onChange={e=>setRelatedModule(e.target.value)} className="mt-1 w-full border rounded-lg p-2"><option value="">Do not link</option>{['ownershipHistory','expenses','gallery','notices','activityRequests','receipts','invoices'].map(m=><option key={m} value={m}>{m}</option>)}</select></label>
        <label className="text-xs font-semibold">Linked Record ID (optional)<input value={relatedRecordId} onChange={e=>setRelatedRecordId(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
        <label className="text-xs font-semibold">Select File<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-1 w-full border rounded-lg p-2"/></label>
      </div>
      <button disabled={busy||!file} className="rounded-lg bg-[#536B4D] text-white px-4 py-2 text-xs font-bold disabled:opacity-50">{busy?'Please wait…':'Upload to Private Drive'}</button>
      {message&&<p className="text-xs text-[#536B4D]">{message}</p>}
    </form>
    <div className="rounded-xl border border-[#E8E1D4] bg-white overflow-hidden">
      <div className="p-4 flex justify-between items-center"><h3 className="font-bold text-sm">Document Registry</h3><button onClick={()=>void refresh()} className="text-xs font-bold text-[#536B4D]">Refresh</button></div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-[#536B4D] text-white"><tr><th className="p-2">File</th><th className="p-2">Category</th><th className="p-2">Property</th><th className="p-2">Uploaded</th><th className="p-2">Action</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.File_ID} className="border-b"><td className="p-2">{r.File_Name||r.File_ID}</td><td className="p-2">{r.Category}</td><td className="p-2">{r.PropertyID||'—'}</td><td className="p-2">{String(r.Created_At||'').slice(0,10)}</td><td className="p-2"><button disabled={busy} onClick={()=>void download(r)} className="font-bold text-[#536B4D]">Download</button></td></tr>)}</tbody>
      </table>{!rows.length&&<p className="p-5 text-center text-xs text-gray-500">{busy?'Loading…':'No documents registered.'}</p>}</div>
    </div>
  </div>;
};
