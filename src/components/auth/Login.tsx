import React, { useEffect, useRef, useState } from 'react';
import { Building2, LockKeyhole, Languages, ShieldCheck, ArrowLeft, LoaderCircle, Eye, EyeOff, Zap } from 'lucide-react';
import { authRequest, BackendRequestError } from '../../utils/authClient';

type Props = { onLogin: (session: any) => void };
type Mode = 'login' | 'forgot' | 'reset';
const REMEMBER_KEY = 'abasSathiRememberedLogin';

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
  const [remember,setRemember]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const submitLock=useRef(false);
  const bn=language==='bn';

  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(REMEMBER_KEY)||'null');
      if(saved&&typeof saved==='object') {
        setSocietyCode(String(saved.societyCode||''));
        setLoginId(String(saved.loginId||''));
        setRemember(true);
      } else setRemember(false);
    } catch { setRemember(false); }
  },[]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(submitLock.current||loading)return;
    const code=societyCode.trim().toUpperCase(), id=loginId.trim();
    if(!code||!id||!password){setError(bn?'সব তথ্য পূরণ করুন।':'Enter Society Code, Login ID and Password.');return;}
    submitLock.current=true;setError('');setNotice('');setLoading(true);
    try {
      if(remember) localStorage.setItem(REMEMBER_KEY,JSON.stringify({societyCode:code,loginId:id}));
      else localStorage.removeItem(REMEMBER_KEY);
      let result:any;
      try {
        result = await authRequest({action:'login',societyCode:code,loginId:id,password},{timeoutMs:30000});
      } catch (firstError) {
        // One bounded retry helps on mobile networks with a transient radio hand-off.
        // Login is read/verify-only; a retry cannot duplicate a financial operation.
        if (!(firstError instanceof BackendRequestError) || !firstError.retryable) throw firstError;
        await new Promise(resolve => window.setTimeout(resolve, 500));
        result = await authRequest({action:'login',societyCode:code,loginId:id,password},{timeoutMs:30000});
      }
      if(!result.token||!result.user)throw new Error('The server did not return a valid login session. Please try again.');
      const session={token:result.token,expiresAt:Date.now()+(result.expiresIn||21600)*1000,user:result.user,societyName:result.user.societyName,societyAddress:result.user.societyAddress,societyCode:result.user.societyCode};
      localStorage.setItem('abasSathiSession',JSON.stringify(session));
      setPassword('');
      onLogin(session);
    } catch(err:any){setError(err.message||'Unable to sign in. Please check your connection and try again.');}
    finally{submitLock.current=false;setLoading(false);}
  };
  const requestOtp=async(e:React.FormEvent)=>{
    e.preventDefault();if(submitLock.current||loading)return;submitLock.current=true;setError('');setNotice('');setLoading(true);
    try{
      const r:any=await authRequest({action:'forgotPasswordRequest',societyCode:societyCode.trim().toUpperCase(),loginId:loginId.trim(),email});
      setNotice(r.message);setMode('reset');
    }catch(err:any){setError(err.message||'Could not request reset code.');}
    finally{submitLock.current=false;setLoading(false);}
  };
  const reset=async(e:React.FormEvent)=>{
    e.preventDefault();if(submitLock.current||loading)return;submitLock.current=true;setError('');setNotice('');setLoading(true);
    try{
      const r:any=await authRequest({action:'forgotPasswordVerify',societyCode:societyCode.trim().toUpperCase(),loginId:loginId.trim(),otp,newPassword});
      setNotice(r.message);setPassword('');setNewPassword('');setOtp('');setMode('login');
    }catch(err:any){setError(err.message||'Password reset failed.');}
    finally{submitLock.current=false;setLoading(false);}
  };
  const input='w-full rounded-xl border border-slate-200 py-3 px-3 outline-none focus:border-[#536B4D] focus:ring-2 focus:ring-[#536B4D]/10 disabled:bg-slate-50';
  const field=(label:string,value:string,onChange:(v:string)=>void,placeholder:string,type='text',autoComplete?:string)=>(
    <label className="block"><span className="text-sm font-semibold text-slate-700">{label}</span><input required value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} autoComplete={autoComplete} className={`${input} mt-1.5`} disabled={loading}/></label>
  );
  return <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="text-center mb-7"><div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#536B4D] text-white flex items-center justify-center shadow-lg"><Building2 size={32}/></div>
        <h1 className="text-3xl font-bold tracking-tight text-[#29352D]">ABAS SATHI</h1><p className="mt-1 text-sm font-semibold text-[#C97958]">আবাসসাথী · Smart Living. Better Community.</p></div>
      <div className="bg-white rounded-3xl border border-[#E8E1D4] shadow-xl p-7">
        <div className="flex items-center justify-between mb-6"><div><h2 className="text-xl font-bold text-[#29352D]">{mode==='login'?(bn?'দ্রুত লগইন':'Quick Sign In'):mode==='forgot'?'Forgot Password':'Reset Password'}</h2><p className="text-sm text-slate-500 mt-1">{mode==='login'?(bn?'আপনার সোসাইটি ও অ্যাকাউন্টের তথ্য দিন':'Sign in securely with your society credentials'):mode==='forgot'?'Enter your registered account details':'Enter the verification code sent to your email'}</p></div>
          <button type="button" onClick={()=>setLanguage(bn?'en':'bn')} className="p-2 rounded-xl border border-slate-200 text-slate-600" title="Change language"><Languages size={18}/></button></div>
        {mode==='login'&&<form onSubmit={submit} className="space-y-4">
          {field(bn?'সোসাইটি কোড':'Society Code',societyCode,v=>setSocietyCode(v.toUpperCase()),'e.g. SO001','text','organization')}
          {field(bn?'লগইন আইডি':'Login ID',loginId,setLoginId,'Your Login ID','text','username')}
          <label className="block"><span className="text-sm font-semibold text-slate-700">{bn?'পাসওয়ার্ড':'Password'}</span><div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18}/><input required type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={bn?'পাসওয়ার্ড লিখুন':'Enter password'} autoComplete="current-password" className={`${input} pl-10 pr-11`} disabled={loading}/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-3 text-slate-400" aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          <div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} disabled={loading} className="accent-[#536B4D]"/> {bn?'এই ডিভাইসে সোসাইটি কোড ও লগইন আইডি মনে রাখুন':'Remember Society Code & Login ID'}</label><button type="button" onClick={()=>{setError('');setNotice('');setMode('forgot')}} className="text-sm font-semibold text-[#536B4D] hover:underline whitespace-nowrap">Forgot Password?</button></div>
          {error&&<div role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#536B4D] py-3.5 text-white font-bold hover:bg-[#40543B] disabled:opacity-70 flex items-center justify-center gap-2">{loading?<><LoaderCircle size={18} className="animate-spin"/>{bn?'যাচাই করা হচ্ছে...':'Verifying securely...'}</>:<><Zap size={17}/>{bn?'দ্রুত লগইন':'Quick Sign In'}</>}</button>
          <p className="text-center text-[11px] text-slate-400">Your password is never saved on this device.</p>
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
        {mode==='login'&&<div className="mt-6 flex items-start gap-2 rounded-xl bg-[#F7F4EC] p-3 text-xs leading-relaxed text-slate-600"><ShieldCheck size={17} className="shrink-0 text-[#536B4D]"/><span>{bn?'আপনার পাসওয়ার্ড যাচাই হয় সোসাইটির নিরাপদ সার্ভারে। অ্যাকাউন্ট অনুমোদনের জন্য সোসাইটি অ্যাডমিনের সঙ্গে যোগাযোগ করুন।':'Your password is verified by the society backend. Only your Society Admin can create and approve user accounts.'}</span></div>}
      </div><p className="mt-5 text-center text-xs text-slate-400">ABAS SATHI · Secure Society Access</p>
    </div>
  </div>;
};
