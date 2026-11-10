import React, { useState } from 'react';
import { Building2, LockKeyhole, UserRound, Languages, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { authRequest } from '../../utils/authClient';

type Props = { onLogin: (session: any) => void };
type Mode = 'login' | 'forgot' | 'reset';

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [societyCode,setSocietyCode]=useState('');
  const [loginId,setLoginId]=useState('');
  const [password,setPassword]=useState('');
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [mode,setMode]=useState<Mode>('login');
  const [language,setLanguage]=useState<'en'|'bn'>('en');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false);
  const bn=language==='bn';

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setNotice('');setLoading(true);
    try {
      const result:any=await authRequest({action:'login',societyCode,loginId,password});
      const session={token:result.token,expiresAt:Date.now()+(result.expiresIn||21600)*1000,user:result.user,societyName:result.user.societyName,societyCode:result.user.societyCode};
      localStorage.setItem('abasSathiSession',JSON.stringify(session));onLogin(session);
    } catch(err:any){setError(err.message||'Unable to sign in.');}
    finally{setLoading(false);}
  };
  const requestOtp=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setNotice('');setLoading(true);
    try{
      const r:any=await authRequest({action:'forgotPasswordRequest',societyCode,loginId,email});
      setNotice(r.message);setMode('reset');
    }catch(err:any){setError(err.message||'Could not request reset code.');}
    finally{setLoading(false);}
  };
  const reset=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setNotice('');setLoading(true);
    try{
      const r:any=await authRequest({action:'forgotPasswordVerify',societyCode,loginId,otp,newPassword});
      setNotice(r.message);setPassword('');setNewPassword('');setOtp('');setMode('login');
    }catch(err:any){setError(err.message||'Password reset failed.');}
    finally{setLoading(false);}
  };
  const input='w-full rounded-xl border border-slate-200 py-3 px-3 outline-none focus:border-[#536B4D] focus:ring-2 focus:ring-[#536B4D]/10';
  const field=(label:string,value:string,onChange:(v:string)=>void,placeholder:string,type='text',autoComplete?:string)=>(
    <label className="block"><span className="text-sm font-semibold text-slate-700">{label}</span><input required value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} autoComplete={autoComplete} className={`${input} mt-1.5`}/></label>
  );
  return <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="text-center mb-7"><div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#536B4D] text-white flex items-center justify-center shadow-lg"><Building2 size={32}/></div>
        <h1 className="text-3xl font-bold tracking-tight text-[#29352D]">ABAS SATHI</h1><p className="mt-1 text-sm font-semibold text-[#C97958]">আবাসসাথী · Smart Living. Better Community.</p></div>
      <div className="bg-white rounded-3xl border border-[#E8E1D4] shadow-xl p-7">
        <div className="flex items-center justify-between mb-6"><div><h2 className="text-xl font-bold text-[#29352D]">{mode==='login'?(bn?'আপনার অ্যাকাউন্টে লগইন করুন':'Sign in to your account'):mode==='forgot'?'Forgot Password':'Reset Password'}</h2><p className="text-sm text-slate-500 mt-1">{mode==='login'?'Enter your society and account details':mode==='forgot'?'Enter your registered account details':'Enter the verification code sent to your email'}</p></div>
          <button type="button" onClick={()=>setLanguage(bn?'en':'bn')} className="p-2 rounded-xl border border-slate-200 text-slate-600" title="Change language"><Languages size={18}/></button></div>
        {mode==='login'&&<form onSubmit={submit} className="space-y-4">
          {field(bn?'সোসাইটি কোড':'Society Code',societyCode,v=>setSocietyCode(v.toUpperCase()),'e.g. SO001','text','organization')}
          {field(bn?'লগইন আইডি':'Login ID',loginId,setLoginId,'Your Login ID','text','username')}
          <label className="block"><span className="text-sm font-semibold text-slate-700">{bn?'পাসওয়ার্ড':'Password'}</span><div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18}/><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" className={`${input} pl-10`}/></div></label>
          <div className="text-right"><button type="button" onClick={()=>{setError('');setNotice('');setMode('forgot')}} className="text-sm font-semibold text-[#536B4D] hover:underline">Forgot Password?</button></div>
          {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-[#536B4D] py-3.5 text-white font-bold hover:bg-[#40543B] disabled:opacity-60">{loading?'Verifying...':bn?'লগইন':'Sign In'}</button>
        </form>}
        {mode==='forgot'&&<form onSubmit={requestOtp} className="space-y-4">
          {field('Society Code',societyCode,v=>setSocietyCode(v.toUpperCase()),'e.g. SO001')}
          {field('Login ID',loginId,setLoginId,'Your Login ID')}
          {field('Registered Email',email,setEmail,'name@example.com','email','email')}
          {error&&<div role="alert" className="text-sm text-red-700">{error}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-[#536B4D] py-3 text-white font-bold disabled:opacity-60">{loading?'Sending...':'Send verification code'}</button>
          <button type="button" onClick={()=>{setMode('login');setError('')}} className="w-full flex items-center justify-center gap-2 text-sm text-slate-600"><ArrowLeft size={15}/> Back to Login</button>
        </form>}
        {mode==='reset'&&<form onSubmit={reset} className="space-y-4">
          {notice&&<div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">{notice}</div>}
          {field('6-digit verification code',otp,setOtp,'000000')}
          {field('New Password',newPassword,setNewPassword,'At least 12 characters','password','new-password')}
          <p className="text-xs text-slate-500">Use at least 12 characters, including uppercase, lowercase, a number and a symbol.</p>
          {error&&<div role="alert" className="text-sm text-red-700">{error}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-[#536B4D] py-3 text-white font-bold disabled:opacity-60">{loading?'Verifying...':'Reset Password'}</button>
          <button type="button" onClick={()=>setMode('login')} className="w-full text-sm text-slate-600">Back to Login</button>
        </form>}
        {mode==='login'&&<div className="mt-6 flex items-start gap-2 rounded-xl bg-[#F7F4EC] p-3 text-xs leading-relaxed text-slate-600"><ShieldCheck size={17} className="shrink-0 text-[#536B4D]"/><span>{bn?'অ্যাকাউন্ট তৈরি ও অনুমোদনের জন্য সোসাইটি অ্যাডমিনের সঙ্গে যোগাযোগ করুন।':'Only your Society Admin can create and approve user accounts. Contact your administrator.'}</span></div>}
      </div><p className="mt-5 text-center text-xs text-slate-400">ABAS SATHI · Secure Society Access</p>
    </div>
  </div>;
};
