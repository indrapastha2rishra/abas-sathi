import React,{useEffect,useState} from 'react';
import {authRequest} from '../../utils/authClient';
import {isStrongPassword} from '../../utils/authValidation';
import {useApp} from '../../context/AppContext';
import {UserPlus,CheckCircle, XCircle, UploadCloud, UserRound, ShieldCheck, Eye, EyeOff} from 'lucide-react';

const sessionToken=()=>{try{return JSON.parse(localStorage.getItem('abasSathiSession')||'{}').token||''}catch{return ''}};
const input='w-full rounded-xl border border-[#E8E1D4] px-3 py-2.5 text-sm outline-none focus:border-[#536B4D]';

export const AdminUsersView:React.FC=()=>{
 const {properties,ownerships,owners,currentUser,getPrivateFile}=useApp();
 const [users,setUsers]=useState<any[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [form,setForm]=useState({fullName:'',loginId:'',email:'',mobile:'',role:'Committee',propertyId:'',ownershipId:'',password:'',activateImmediately:true});
 const [showPassword,setShowPassword]=useState(false);
 const [editingUser,setEditingUser]=useState<any>(null);
 const token=sessionToken();
 const ownerNameById=new Map(owners.map(o=>[String(o.OwnerID||''),String(o.Owner_Name||'')]));
 const currentOwnershipsForProp=(propertyId:string)=>ownerships.filter(o=>String(o.PropertyID||'')===String(propertyId||'')&&String(o.Ownership_Status||'').trim().toLowerCase()==='current');
 const load=async()=>{setLoading(true);try{const r:any=await authRequest({action:'adminListUsers',token});setUsers(r.users||[])}catch(e:any){setError(e.message)}finally{setLoading(false)}};
 useEffect(()=>{if(currentUser.Role==='Admin')load();},[]);
 const handleCreatePropertyChange=(propertyId:string)=>{
  const matched=currentOwnershipsForProp(propertyId);
  setForm(prev=>({...prev,propertyId,ownershipId:matched.length===1?String(matched[0].Ownership_ID||''):''}));
 };
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(!isStrongPassword(form.password)){setError('Password must be 12–128 characters and include uppercase, lowercase, number, and symbol.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const matched=form.role==='Resident'?currentOwnershipsForProp(form.propertyId).find(o=>String(o.Ownership_ID||'')===String(form.ownershipId||'')):undefined;
   const r:any=await authRequest({action:'adminCreateUser',token,...form,ownerId:matched?.OwnerID?String(matched.OwnerID):''});
   setMessage(r.message);
   setForm({fullName:'',loginId:'',email:'',mobile:'',role:'Committee',propertyId:'',ownershipId:'',password:'',activateImmediately:true});
   await load();
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 };
 const act=async(userId:string,action:'adminApproveUser'|'adminRejectUser')=>{setBusy(true);setError('');try{const r:any=await authRequest({action,token,userId});setMessage(r.message);await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const setKyc=async(userId:string,status:string)=>{setBusy(true);setError('');try{const r:any=await authRequest({action:'adminSetKycStatus',token,userId,status});setMessage(r.message);await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const downloadKyc=async(fileId:string,fileName:string)=>{setBusy(true);setError('');try{const r:any=await getPrivateFile(fileId);const bytes=Uint8Array.from(atob(r.data.base64),(c)=>c.charCodeAt(0));const blob=new Blob([bytes],{type:r.data.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName||r.data.fileName||'kyc-document';a.click();URL.revokeObjectURL(url)}catch(e:any){setError(e.message||'KYC download failed.')}finally{setBusy(false)}};
 const saveEdit=async(e:React.FormEvent)=>{e.preventDefault();if(!editingUser)return;setBusy(true);setError('');try{const updates:any={Full_Name:editingUser.Full_Name,Email_ID:editingUser.Email_ID,Mobile_No:editingUser.Mobile_No,PropertyID:editingUser.PropertyID||'',Ownership_ID:editingUser.Ownership_ID||''};if(editingUser.Role!=='Admin')updates.Role=editingUser.Role;const r:any=await authRequest({action:'adminUpdateUser',token,userId:editingUser.UserID,updates});setMessage(r.message);setEditingUser(null);await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const changeStatus=async(u:any)=>{const next=u.Account_Status==='Active'?'Inactive':'Active';if(!window.confirm(`Set ${u.Full_Name} account to ${next}?`))return;setBusy(true);setError('');try{const r:any=await authRequest({action:'adminSetUserStatus',token,userId:u.UserID,status:next});setMessage(r.message);await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 if(currentUser.Role!=='Admin')return <div className="rounded-2xl bg-white p-6">Access denied. Only Admin can manage accounts.</div>;
 return <div className="space-y-5">
  <div><h1 className="text-xl font-bold text-[#29352D] flex items-center gap-2"><UserPlus size={20}/> User Management & Approval</h1><p className="text-sm text-slate-500 mt-1">Only Admin can create, approve or reject Committee, Accountant and Resident accounts.</p></div>
  {message&&<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{message}</div>}
  {error&&<div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
  <form onSubmit={create} className="rounded-2xl border border-[#E8E1D4] bg-white p-5 space-y-4">
   <h2 className="font-bold text-[#29352D]">Create New User</h2>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label className="text-xs font-semibold">Full Name<input required className={`${input} mt-1`} value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
    <label className="text-xs font-semibold">Login ID<input required className={`${input} mt-1`} value={form.loginId} onChange={e=>setForm({...form,loginId:e.target.value})}/></label>
    <label className="text-xs font-semibold">Email<input required type="email" className={`${input} mt-1`} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label className="text-xs font-semibold">Mobile<input required className={`${input} mt-1`} value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/></label>
    <label className="text-xs font-semibold">Role<select className={`${input} mt-1`} value={form.role} onChange={e=>setForm({...form,role:e.target.value,propertyId:e.target.value==='Resident'?form.propertyId:'',ownershipId:e.target.value==='Resident'?form.ownershipId:''})}><option>Committee</option><option>Accountant</option><option>Resident</option></select></label>
    {form.role==='Resident'&&<label className="text-xs font-semibold">Property / Flat<select required className={`${input} mt-1`} value={form.propertyId} onChange={e=>handleCreatePropertyChange(e.target.value)}><option value="">Select property</option>{properties.map(p=><option key={p.PropertyID} value={p.PropertyID}>{p.Flat_No} ({p.PropertyID})</option>)}</select></label>}
    {form.role==='Resident'&&form.propertyId&&<label className="text-xs font-semibold md:col-span-2">Current Ownership Record (auto-linked if single)<select className={`${input} mt-1`} value={form.ownershipId} onChange={e=>setForm({...form,ownershipId:e.target.value})}><option value="">Auto-link current ownership</option>{currentOwnershipsForProp(form.propertyId).map(o=><option key={o.Ownership_ID} value={o.Ownership_ID}>{o.Ownership_ID} — {ownerNameById.get(String(o.OwnerID||''))||o.OwnerID}</option>)}</select></label>}
    <label className="text-xs font-semibold md:col-span-2">Initial Password<div className="relative mt-1"><input required type={showPassword?'text':'password'} minLength={12} className={`${input} pr-10`} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-2.5 top-2.5 text-slate-500 hover:text-[#29352D]" aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><span className="block mt-1 text-[11px] text-slate-500">Minimum 12 characters with uppercase, lowercase, number and symbol. Share securely; user can reset it later.</span></label>
    <label className="md:col-span-2 flex items-center gap-2 text-xs font-semibold text-[#29352D]"><input type="checkbox" checked={form.activateImmediately} onChange={e=>setForm({...form,activateImmediately:e.target.checked})}/>Activate account immediately so user can sign in right away</label>
   </div>
   <button disabled={busy} className="rounded-xl bg-[#536B4D] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">{busy?'Saving...':(form.activateImmediately?'Create & Activate User':'Create Pending User')}</button>
  </form>
  {editingUser&&<form onSubmit={saveEdit} className="rounded-2xl border border-[#E8E1D4] bg-white p-5 space-y-3">
   <h2 className="font-bold">Edit User — {editingUser.Login_ID}</h2>
   <div className="grid md:grid-cols-2 gap-3">
    <label className="text-xs font-semibold">Full Name<input required className={`${input} mt-1`} value={editingUser.Full_Name||''} onChange={e=>setEditingUser({...editingUser,Full_Name:e.target.value})}/></label>
    <label className="text-xs font-semibold">Email<input required type="email" className={`${input} mt-1`} value={editingUser.Email_ID||''} onChange={e=>setEditingUser({...editingUser,Email_ID:e.target.value})}/></label>
    <label className="text-xs font-semibold">Mobile<input required className={`${input} mt-1`} value={editingUser.Mobile_No||''} onChange={e=>setEditingUser({...editingUser,Mobile_No:e.target.value})}/></label>
    <label className="text-xs font-semibold">Role<select disabled={editingUser.Role==='Admin'} className={`${input} mt-1`} value={editingUser.Role} onChange={e=>setEditingUser({...editingUser,Role:e.target.value,PropertyID:e.target.value==='Resident'?editingUser.PropertyID:'',Ownership_ID:e.target.value==='Resident'?editingUser.Ownership_ID:''})}><option>Committee</option><option>Accountant</option><option>Resident</option></select></label>
    {editingUser.Role==='Resident'&&<label className="text-xs font-semibold">Property<select required className={`${input} mt-1`} value={editingUser.PropertyID||''} onChange={e=>{const pid=e.target.value;const matched=currentOwnershipsForProp(pid);setEditingUser({...editingUser,PropertyID:pid,Ownership_ID:matched.length===1?String(matched[0].Ownership_ID||''):''});}}><option value="">Select property</option>{properties.map(p=><option key={p.PropertyID} value={p.PropertyID}>{p.Flat_No} ({p.PropertyID})</option>)}</select></label>}
    {editingUser.Role==='Resident'&&editingUser.PropertyID&&<label className="text-xs font-semibold">Ownership ID<select className={`${input} mt-1`} value={editingUser.Ownership_ID||''} onChange={e=>setEditingUser({...editingUser,Ownership_ID:e.target.value})}><option value="">Auto-link current ownership</option>{currentOwnershipsForProp(editingUser.PropertyID).map(o=><option key={o.Ownership_ID} value={o.Ownership_ID}>{o.Ownership_ID} — {ownerNameById.get(String(o.OwnerID||''))||o.OwnerID}</option>)}</select></label>}
   </div>
   <div className="flex gap-2"><button disabled={busy} className="rounded-xl bg-[#536B4D] px-4 py-2 text-xs font-bold text-white">Save User Changes</button><button type="button" onClick={()=>setEditingUser(null)} className="rounded-xl border px-4 py-2 text-xs">Cancel</button></div>
  </form>}
  <div className="rounded-2xl border border-[#E8E1D4] bg-white overflow-hidden">
   <div className="p-4 border-b border-[#E8E1D4] flex justify-between"><h2 className="font-bold">User Accounts</h2><button onClick={load} className="text-xs font-bold text-[#536B4D]">Refresh</button></div>
   {loading?<p className="p-5 text-sm text-slate-500">Loading users...</p>:<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#F7F4EC]"><tr>{['Name / Login ID','Role','Email','Property / Ownership','Account','KYC','Action'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#E8E1D4]">{users.map(u=><tr key={u.UserID}><td className="p-3"><b>{u.Full_Name}</b><div className="text-slate-500">{u.Login_ID}</div></td><td className="p-3">{u.Role}</td><td className="p-3">{u.Email_ID}</td><td className="p-3"><div>{u.PropertyID||'—'}</div>{u.Ownership_ID&&<div className="text-[10px] text-slate-500">{u.Ownership_ID}</div>}</td><td className="p-3">{u.Account_Status}</td><td className="p-3"><div>{u.KYC_Status||'Not Submitted'}</div>{u.KYC_Documents?.length>0&&<div className="mt-1 space-y-1">{u.KYC_Documents.map((d:any,i:number)=><button key={i} type="button" onClick={()=>void downloadKyc(d.fileId,d.fileName)} className="block text-blue-700 underline">{d.fileName} — Download</button>)}<div className="flex gap-1"><button disabled={busy} onClick={()=>setKyc(u.UserID,'Verified')} className="text-emerald-700 underline">Verify</button><button disabled={busy} onClick={()=>setKyc(u.UserID,'Under Review')} className="text-amber-700 underline">Review</button></div></div>}</td><td className="p-3"><div className="flex flex-wrap gap-2 items-center">{u.Account_Status==='Pending'&&<><button disabled={busy} onClick={()=>act(u.UserID,'adminApproveUser')} title="Approve" className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 cursor-pointer"><CheckCircle size={14}/><span>Approve</span></button><button disabled={busy} onClick={()=>act(u.UserID,'adminRejectUser')} title="Reject" className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 font-semibold text-red-600 hover:bg-red-100 cursor-pointer"><XCircle size={14}/><span>Reject</span></button></>}<button disabled={busy||u.Account_Status==='Pending'} onClick={()=>setEditingUser({...u})} className="text-[#536B4D] underline">Edit</button>{u.Account_Status!=='Pending'&&<button disabled={busy||u.UserID===currentUser.UserID} onClick={()=>void changeStatus(u)} className="text-red-700 underline">{u.Account_Status==='Active'?'Deactivate':'Activate'}</button>}</div></td></tr>)}</tbody></table></div>}
  </div>
 </div>;
};

export const ProfileView:React.FC=()=>{
 const {currentUser,getPrivateFile}=useApp();
 const [profile,setProfile]=useState<any>({fullName:currentUser.Full_Name,email:currentUser.Email_ID,mobile:currentUser.Mobile_No,address:'',emergencyContact:''});
 const [docs,setDocs]=useState<any[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const token=sessionToken();
 useEffect(()=>{authRequest<any>({action:'getMyProfile',token}).then(r=>{const p=r.profile||{};setProfile({fullName:p.Full_Name||currentUser.Full_Name,email:p.Email_ID||currentUser.Email_ID,mobile:p.Mobile_No||currentUser.Mobile_No,address:p.Profile_Address||'',emergencyContact:p.Emergency_Contact||''});setDocs(p.KYC_Documents||[])}).catch(e=>setError(e.message))},[]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const r:any=await authRequest({action:'updateMyProfile',token,...profile});setMessage(r.message);const saved=JSON.parse(localStorage.getItem('abasSathiSession')||'{}');if(saved.user){saved.user.fullName=profile.fullName;saved.user.mobile=profile.mobile;localStorage.setItem('abasSathiSession',JSON.stringify(saved));}}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const downloadKyc=async(fileId:string,fileName:string)=>{setBusy(true);setError('');try{const r:any=await getPrivateFile(fileId);const bytes=Uint8Array.from(atob(r.data.base64),(c)=>c.charCodeAt(0));const blob=new Blob([bytes],{type:r.data.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName||r.data.fileName||'kyc-document';a.click();URL.revokeObjectURL(url)}catch(e:any){setError(e.message||'KYC download failed.')}finally{setBusy(false)}};
 const upload=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){setError('Maximum file size is 5 MB.');return;}if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){setError('Only PDF, JPG and PNG are accepted.');return;}setBusy(true);setError('');try{const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});const r:any=await authRequest({action:'uploadKycDocument',token,fileName:file.name,mimeType:file.type,base64});setDocs(r.documents||[]);setMessage(r.message)}catch(e:any){setError(e.message)}finally{setBusy(false);e.target.value=''}};
 return <div className="max-w-3xl space-y-5"><div><h1 className="text-xl font-bold flex items-center gap-2"><UserRound size={20}/> My Profile & KYC</h1><p className="text-sm text-slate-500 mt-1">Update your contact details and submit supporting documents for verification.</p></div>
  {message&&<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{message}</div>}{error&&<div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
  <form onSubmit={save} className="rounded-2xl border border-[#E8E1D4] bg-white p-5 space-y-3"><h2 className="font-bold">Personal Information</h2>
   <div className="grid md:grid-cols-2 gap-3">{[['Full Name','fullName'],['Email','email'],['Mobile','mobile'],['Emergency Contact','emergencyContact'],['Address','address']].map(([label,key])=><label key={key} className="text-xs font-semibold">{label}<input className={`${input} mt-1`} value={profile[key]} onChange={e=>setProfile({...profile,[key]:e.target.value})} required={['fullName','email','mobile'].includes(key)} disabled={key==='email'} /></label>)}</div>
   <div className="text-xs text-slate-500">Login ID: {currentUser.UserID} · Role: {currentUser.Role} · Property: {currentUser.PropertyID||'Society level'}</div>
   <button disabled={busy} className="rounded-xl bg-[#536B4D] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save Profile</button>
  </form>
  <section className="rounded-2xl border border-[#E8E1D4] bg-white p-5 space-y-3"><h2 className="font-bold flex items-center gap-2"><ShieldCheck size={18}/> KYC & Supporting Documents</h2><p className="text-xs text-slate-500">Accepted formats: PDF, JPG, PNG. Maximum 5 MB per file. Documents are stored in the society's private Google Drive folder; public link sharing is not enabled.</p>
   <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C8D2C3] bg-[#F7F4EC] p-6 text-sm font-semibold text-[#536B4D] cursor-pointer"><UploadCloud size={20}/> Upload KYC Document<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={upload} disabled={busy}/></label>
   {docs.length>0?<ul className="divide-y divide-[#E8E1D4]">{docs.map((d,i)=><li key={i} className="py-2 text-sm flex justify-between"><button type="button" className="text-blue-700 underline" onClick={()=>void downloadKyc(d.fileId,d.fileName)}>{d.fileName} — Download</button><span className="text-xs text-slate-500">{d.status||'Submitted'}</span></li>)}</ul>:<p className="text-sm text-slate-400">No documents uploaded yet.</p>}
  </section>
 </div>;
};
