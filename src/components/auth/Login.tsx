import React, { useState } from 'react';
import { Building2, LockKeyhole, UserRound, KeyRound, Languages, ShieldCheck } from 'lucide-react';

const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec';

type Props = { onLogin: (session: any) => void };

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [societyCode, setSocietyCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<'en'|'bn'>('en');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const backendUrl = (() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('abasSathiGoogleConfig') || '{}');
      return cfg.appsScriptWebAppUrl || DEFAULT_BACKEND_URL;
    } catch { return DEFAULT_BACKEND_URL; }
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action:'login', societyCode, loginId, password })
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success' || !result.token || !result.user) {
        throw new Error(result.message || 'Login failed.');
      }
      const session = { token:result.token, expiresAt:Date.now() + (result.expiresIn || 21600)*1000,
        user:result.user, societyName:result.user.societyName, societyCode:result.user.societyCode };
      localStorage.setItem('abasSathiSession', JSON.stringify(session));
      onLogin(session);
    } catch (err:any) {
      setError(err?.message || 'Unable to connect to the server. Please try again.');
    } finally { setLoading(false); }
  };

  const bn = language === 'bn';
  return (
    <div className="min-h-screen bg-[#F7F4EC] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#536B4D] text-white flex items-center justify-center shadow-lg">
            <Building2 size={32}/>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#29352D]">ABAS SATHI</h1>
          <p className="mt-1 text-sm font-semibold text-[#C97958]">আবাসসাথী · Smart Living. Better Community.</p>
        </div>
        <div className="bg-white rounded-3xl border border-[#E8E1D4] shadow-xl p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#29352D]">{bn ? 'আপনার অ্যাকাউন্টে লগইন করুন' : 'Sign in to your account'}</h2>
              <p className="text-sm text-slate-500 mt-1">{bn ? 'আপনার সোসাইটির তথ্য দিয়ে প্রবেশ করুন' : 'Enter your society and account details'}</p>
            </div>
            <button type="button" onClick={()=>setLanguage(bn?'en':'bn')} className="p-2 rounded-xl border border-slate-200 text-slate-600" title="Change language">
              <Languages size={18}/>
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">{bn?'সোসাইটি কোড':'Society Code'}</span>
              <div className="relative mt-1.5"><Building2 className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                <input required value={societyCode} onChange={e=>setSocietyCode(e.target.value.toUpperCase())} placeholder="e.g. SO001" autoComplete="organization"
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-[#536B4D] focus:ring-2 focus:ring-[#536B4D]/10"/>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">{bn?'লগইন আইডি':'Login ID'}</span>
              <div className="relative mt-1.5"><UserRound className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                <input required value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="Your Login ID" autoComplete="username"
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-[#536B4D] focus:ring-2 focus:ring-[#536B4D]/10"/>
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">{bn?'পাসওয়ার্ড':'Password'}</span>
              <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                <input required type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-12 outline-none focus:border-[#536B4D] focus:ring-2 focus:ring-[#536B4D]/10"/>
                <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3 text-xs font-semibold text-slate-500">{showPassword?'Hide':'Show'}</button>
              </div>
            </label>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
            <button disabled={loading} className="w-full rounded-xl bg-[#536B4D] py-3.5 text-white font-bold hover:bg-[#40543B] disabled:opacity-60 transition-colors">
              {loading ? (bn?'যাচাই হচ্ছে...':'Verifying...') : (bn?'লগইন':'Sign In')}
            </button>
          </form>
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#F7F4EC] p-3 text-xs leading-relaxed text-slate-600">
            <ShieldCheck size={17} className="shrink-0 text-[#536B4D]"/>
            <span>{bn?'আপনার অ্যাকাউন্ট সোসাইটি অ্যাডমিন দ্বারা সক্রিয় থাকতে হবে।':'Your account must be active and registered by your society administrator.'}</span>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">ABAS SATHI · Secure Society Access</p>
      </div>
    </div>
  );
};
