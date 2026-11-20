import React, { useEffect, useRef, useState } from 'react';
import {
  Building2, LockKeyhole, Languages, ShieldCheck, ArrowLeft, LoaderCircle,
  Eye, EyeOff, Zap, UserRound, Trash2, Mail, KeyRound, CheckCircle2
} from 'lucide-react';
import { authRequest, BackendRequestError } from '../../utils/authClient';
import { isStrongPassword } from '../../utils/authValidation';

type Props = { onLogin: (session: any) => void };
type Mode = 'login' | 'forgot' | 'reset';
type Language = 'en' | 'bn';
const REMEMBER_KEY = 'abasSathiRememberedLogin';

type RememberedLogin = { societyCode: string; loginId: string };

function readRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const societyCode = String(parsed?.societyCode || '').trim().toUpperCase();
    const loginId = String(parsed?.loginId || '').trim();
    return societyCode && loginId ? { societyCode, loginId } : null;
  } catch {
    localStorage.removeItem(REMEMBER_KEY);
    return null;
  }
}

function friendlyLoginError(error: unknown, language: Language): string {
  const bn = language === 'bn';
  if (error instanceof BackendRequestError) {
    if (error.code === 'AUTH_ERROR' || error.code === 'VALIDATION_ERROR') {
      return bn
        ? 'লগইন করা যায়নি। তথ্য যাচাই করুন অথবা সোসাইটি অ্যাডমিনের সঙ্গে যোগাযোগ করুন।'
        : 'Unable to sign in. Check your details or contact your society administrator.';
    }
    if (error.code === 'RATE_LIMITED') {
      return bn
        ? 'অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।'
        : 'Too many sign-in attempts. Please wait 15 minutes and try again.';
    }
    if (error.code === 'SERVER_ERROR') {
      return bn
        ? 'লগইন সার্ভার সাময়িকভাবে অনুপলব্ধ। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
        : 'The authentication service is temporarily unavailable. Please try again later.';
    }
    if (error.retryable) {
      return bn
        ? 'সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।'
        : 'Could not connect to the server. Check your internet connection and try again.';
    }
  }
  const message = String((error as any)?.message || '');
  if (/too many sign-in attempts/i.test(message)) {
    return bn
      ? 'অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।'
      : 'Too many sign-in attempts. Please wait 15 minutes and try again.';
  }
  return bn
    ? 'লগইন সম্পন্ন হয়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
    : 'Sign-in could not be completed. Check your connection and try again.';
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [societyCode, setSocietyCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<Mode>('login');
  const [language, setLanguage] = useState<Language>('en');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const submitLock = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const bn = language === 'bn';

  useEffect(() => {
    const saved = readRememberedLogin();
    if (saved) {
      setSocietyCode(saved.societyCode);
      setLoginId(saved.loginId);
      setRemember(true);
      setHasSavedLogin(true);
      // Focus the password field after the returning-user values are populated.
      window.setTimeout(() => passwordRef.current?.focus(), 80);
    }
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const clearSavedLogin = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setSocietyCode('');
    setLoginId('');
    setRemember(false);
    setHasSavedLogin(false);
    setError('');
    setNotice(bn ? 'এই ডিভাইস থেকে সংরক্ষিত লগইন তথ্য মুছে দেওয়া হয়েছে।' : 'Saved login details have been cleared from this device.');
  };

  const persistRememberedLogin = (codeValue: string, idValue: string) => {
    const code = codeValue.trim().toUpperCase();
    const id = idValue.trim();
    if (!remember || !code || !id) return;
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ societyCode: code, loginId: id }));
    setHasSavedLogin(true);
  };

  const changeRemember = (checked: boolean) => {
    setRemember(checked);
    if (!checked) {
      // Remove remembered identifiers immediately when the option is disabled.
      localStorage.removeItem(REMEMBER_KEY);
      setHasSavedLogin(false);
    } else {
      const code = societyCode.trim().toUpperCase();
      const id = loginId.trim();
      if (code && id) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ societyCode: code, loginId: id }));
        setHasSavedLogin(true);
      }
    }
  };

  const updateSocietyCode = (value: string) => {
    const next = value.toUpperCase();
    setSocietyCode(next);
    persistRememberedLogin(next, loginId);
  };

  const updateLoginId = (value: string) => {
    setLoginId(value);
    persistRememberedLogin(societyCode, value);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLock.current || loading) return;

    const code = societyCode.trim().toUpperCase();
    const id = loginId.trim();
    if (!code || !id || !password) {
      setError(bn ? 'সোসাইটি কোড, লগইন আইডি ও পাসওয়ার্ড লিখুন।' : 'Enter Society Code, Login ID and Password.');
      return;
    }

    submitLock.current = true;
    const loginStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      // The login endpoint already verifies the password, account status and role,
      // then returns the authenticated profile fields. Do not immediately call
      // getMyProfile again: that caused a second Apps Script execution and a full
      // Central Master lookup on every successful login.
      const result: any = await authRequest(
        { action: 'login', societyCode: code, loginId: id, password },
        { timeoutMs: 20000 }
      );

      if (!result?.token || !result?.user?.userId || !result?.user?.role) {
        throw new BackendRequestError('The server did not return a valid login session.', undefined, false, 'AUTH_ERROR');
      }

      const sessionUser = {
        ...result.user,
        userId: String(result.user.userId),
        loginId: String(result.user.loginId || id),
        fullName: String(result.user.fullName || ''),
        email: String(result.user.email || ''),
        mobile: String(result.user.mobile || ''),
        role: String(result.user.role),
        propertyId: String(result.user.propertyId || ''),
        accountStatus: 'Active',
      };

      const frontendLoginMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - loginStartedAt);
      // Privacy-safe timing diagnostics: never log identifiers, credentials, tokens, or response payloads.
      console.info('ABAS SATHI login timing', { frontendLoginMs, backendAuthMs: Number(result.performance?.authMs || 0), backendLookupMs: Number(result.performance?.lookupMs || 0), backendPasswordVerifyMs: Number(result.performance?.passwordVerifyMs || 0) });
      const session = {
        token: result.token,
        expiresAt: Date.now() + Number(result.expiresIn || 21600) * 1000,
        user: sessionUser,
        societyName: result.user.societyName || '',
        societyAddress: result.user.societyAddress || '',
        societyCode: code,
      };

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ societyCode: code, loginId: id }));
        setHasSavedLogin(true);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        setHasSavedLogin(false);
      }
      localStorage.setItem('abasSathiSession', JSON.stringify(session));
      setPassword('');
      onLogin(session);
    } catch (caught) {
      setPassword('');
      setError(friendlyLoginError(caught, language));
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const requestOtp = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (submitLock.current || loading || resendSeconds > 0) return;
    const code = societyCode.trim().toUpperCase();
    const id = loginId.trim();
    const mail = email.trim();
    if (!code || !id || !mail) {
      setError(bn ? 'সোসাইটি কোড, লগইন আইডি ও নিবন্ধিত ইমেল লিখুন।' : 'Enter Society Code, Login ID and registered email.');
      return;
    }
    submitLock.current = true;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response: any = await authRequest({
        action: 'forgotPasswordRequest',
        societyCode: code,
        loginId: id,
        email: mail,
      });
      setNotice(response.message || (bn
        ? 'যদি তথ্য মিলে যায়, নিবন্ধিত ইমেলে যাচাইকরণ কোড পাঠানো হয়েছে।'
        : 'If the details match an active account, a verification code has been sent.'));
      setMode('reset');
      setResendSeconds(60);
    } catch (caught: any) {
      setError(bn
        ? 'কোডের অনুরোধ সম্পন্ন হয়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
        : 'The verification-code request could not be completed. Please try again later.');
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLock.current || loading) return;
    if (!/^\d{6}$/.test(otp)) {
      setError(bn ? '৬ সংখ্যার OTP লিখুন।' : 'Enter the 6-digit verification code.');
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setError(bn
        ? 'পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে এবং বড় হাতের, ছোট হাতের, সংখ্যা ও বিশেষ চিহ্ন থাকতে হবে।'
        : 'Password must be 12–128 characters and include uppercase, lowercase, a number and a symbol.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(bn ? 'দুটি পাসওয়ার্ড মিলছে না।' : 'The passwords do not match.');
      return;
    }

    submitLock.current = true;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response: any = await authRequest({
        action: 'forgotPasswordVerify',
        societyCode: societyCode.trim().toUpperCase(),
        loginId: loginId.trim(),
        otp,
        newPassword,
      });
      setNotice(response.message || (bn ? 'পাসওয়ার্ড পরিবর্তন হয়েছে। লগইন করুন।' : 'Password reset successfully. Please sign in.'));
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setMode('login');
      setResendSeconds(0);
    } catch (caught: any) {
      const message = String(caught?.message || '');
      setError(bn
        ? (/expired|invalid|incorrect/i.test(message) ? 'OTP ভুল অথবা মেয়াদ শেষ। নতুন OTP নিন।' : 'পাসওয়ার্ড পরিবর্তন করা যায়নি। আবার চেষ্টা করুন।')
        : (/expired|invalid|incorrect/i.test(message) ? 'The code is invalid or has expired. Request a new code.' : 'Password reset could not be completed. Please try again.'));
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  };

  const inputClass = 'w-full min-h-12 rounded-xl border border-[#D9D5CB] bg-white py-3 pl-11 pr-3 text-base text-[#29352D] outline-none transition focus:border-[#536B4D] focus:ring-4 focus:ring-[#536B4D]/10 disabled:bg-slate-50';
  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    icon: React.ReactNode,
    type = 'text',
    autoComplete?: string,
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  ) => (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-[#29352D]">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#778276]">{icon}</span>
        <input
          required
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          disabled={loading}
          className={inputClass}
        />
      </span>
    </label>
  );

  return (
    <main className="abas-login-shell">
      <section className="w-full max-w-[440px]">
        <header className="mb-6 text-center sm:mb-7">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#536B4D] text-white shadow-lg sm:h-16 sm:w-16">
            <Building2 size={30} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#29352D] sm:text-3xl">ABAS SATHI</h1>
          <p className="mt-1 text-sm font-semibold text-[#C97958]">আবাসসাথী · Smart Living. Better Community.</p>
        </header>

        <div className="rounded-3xl border border-[#E8E1D4] bg-white p-5 shadow-xl shadow-[#29352D]/10 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-[#29352D]">
                {mode === 'login'
                  ? (bn ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন' : 'Welcome back')
                  : mode === 'forgot'
                    ? (bn ? 'পাসওয়ার্ড পুনরুদ্ধার' : 'Forgot Password')
                    : (bn ? 'নতুন পাসওয়ার্ড সেট করুন' : 'Reset Password')}
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {mode === 'login'
                  ? (bn ? 'সোসাইটির তথ্য দিয়ে নিরাপদে লগইন করুন।' : 'Sign in securely using your society credentials.')
                  : mode === 'forgot'
                    ? (bn ? 'আপনার নিবন্ধিত অ্যাকাউন্টের তথ্য দিন।' : 'Enter your registered account details.')
                    : (bn ? 'ইমেলে পাওয়া ৬ সংখ্যার কোড ও নতুন পাসওয়ার্ড দিন।' : 'Enter the 6-digit email code and choose a new password.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setLanguage(bn ? 'en' : 'bn'); setError(''); }}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#E8E1D4] px-3 text-sm font-semibold text-[#536B4D] hover:bg-[#F7F4EC] focus:outline-none focus:ring-4 focus:ring-[#536B4D]/15"
              aria-label={bn ? 'Switch to English' : 'বাংলায় পরিবর্তন করুন'}
            >
              <Languages size={17} aria-hidden="true" /> {bn ? 'English' : 'বাংলা'}
            </button>
          </div>

          {notice && (
            <div role="status" aria-live="polite" className="mb-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {field(bn ? 'সোসাইটি কোড' : 'Society Code', societyCode, updateSocietyCode, 'e.g. SO001', <Building2 size={18} />, 'text', 'organization')}
              {field(bn ? 'লগইন আইডি' : 'Login ID', loginId, updateLoginId, bn ? 'আপনার লগইন আইডি' : 'Enter your Login ID', <UserRound size={18} />, 'text', 'username')}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#29352D]">{bn ? 'পাসওয়ার্ড' : 'Password'}</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#778276]" size={18} aria-hidden="true" />
                  <input
                    ref={passwordRef}
                    required
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={bn ? 'পাসওয়ার্ড লিখুন' : 'Enter your password'}
                    autoComplete="current-password"
                    disabled={loading}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-[#F7F4EC] focus:outline-none focus:ring-2 focus:ring-[#536B4D]"
                    aria-label={showPassword ? (bn ? 'পাসওয়ার্ড লুকান' : 'Hide password') : (bn ? 'পাসওয়ার্ড দেখান' : 'Show password')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={event => changeRemember(event.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 accent-[#536B4D]"
                  />
                  <span>{bn ? 'এই ডিভাইসে লগইন আইডি মনে রাখুন' : 'Remember on this device'}</span>
                </label>
                <button type="button" onClick={() => { setError(''); setNotice(''); setMode('forgot'); }} className="min-h-10 text-sm font-semibold text-[#536B4D] hover:underline">
                  {bn ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                </button>
              </div>

              {hasSavedLogin && (
                <button type="button" onClick={clearSavedLogin} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-700">
                  <Trash2 size={14} /> {bn ? 'সংরক্ষিত লগইন তথ্য মুছুন' : 'Clear Saved Login'}
                </button>
              )}

              {error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#536B4D] px-4 py-3.5 font-bold text-white transition hover:bg-[#40543B] focus:outline-none focus:ring-4 focus:ring-[#536B4D]/25 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? <><LoaderCircle size={19} className="animate-spin" />{bn ? 'নিরাপদে যাচাই হচ্ছে...' : 'Signing In...'}</>
                  : <><Zap size={17} />{bn ? 'লগইন' : 'Sign In'}</>}
              </button>
              <p className="text-center text-xs text-slate-400">{bn ? 'আপনার পাসওয়ার্ড এই ডিভাইসে সংরক্ষণ করা হয় না।' : 'Your password is never stored by ABAS SATHI on this device.'}</p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={requestOtp} className="space-y-4">
              {field(bn ? 'সোসাইটি কোড' : 'Society Code', societyCode, updateSocietyCode, 'e.g. SO001', <Building2 size={18} />, 'text', 'organization')}
              {field(bn ? 'লগইন আইডি' : 'Login ID', loginId, updateLoginId, bn ? 'আপনার লগইন আইডি' : 'Your Login ID', <UserRound size={18} />, 'text', 'username')}
              {field(bn ? 'নিবন্ধিত ইমেল' : 'Registered Email', email, setEmail, 'name@example.com', <Mail size={18} />, 'email', 'email')}
              {error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
              <button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#536B4D] py-3 font-bold text-white disabled:opacity-60">
                {loading ? <><LoaderCircle size={18} className="animate-spin" />{bn ? 'পাঠানো হচ্ছে...' : 'Sending...'}</> : <>{bn ? 'যাচাইকরণ কোড পাঠান' : 'Send Verification Code'}</>}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); }} className="flex min-h-10 w-full items-center justify-center gap-2 text-sm text-slate-600">
                <ArrowLeft size={15} /> {bn ? 'লগইনে ফিরে যান' : 'Back to Login'}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={reset} className="space-y-4">
              {field(bn ? '৬ সংখ্যার OTP' : '6-digit verification code', otp, value => setOtp(value.replace(/\D/g, '').slice(0, 6)), '000000', <KeyRound size={18} />, 'text', 'one-time-code', 'numeric')}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[#29352D]">{bn ? 'নতুন পাসওয়ার্ড' : 'New Password'}</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#778276]" size={18} />
                  <input required minLength={12} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={bn ? 'কমপক্ষে ১২ অক্ষর' : 'At least 12 characters'} disabled={loading} className={`${inputClass} pr-12`} />
                  <button type="button" onClick={() => setShowNewPassword(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500" aria-label={showNewPassword ? 'Hide password' : 'Show password'}>
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {field(bn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password', confirmPassword, setConfirmPassword, bn ? 'আবার পাসওয়ার্ড লিখুন' : 'Re-enter new password', <LockKeyhole size={18} />, 'password', 'new-password')}
              <p className="text-xs leading-5 text-slate-500">{bn ? 'কমপক্ষে ১২ অক্ষর, বড় হাতের ও ছোট হাতের অক্ষর, সংখ্যা এবং বিশেষ চিহ্ন ব্যবহার করুন।' : 'Use 12–128 characters, including uppercase, lowercase, a number and a symbol.'}</p>
              {error && <div role="alert" aria-live="assertive" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
              <button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#536B4D] py-3 font-bold text-white disabled:opacity-60">
                {loading ? <><LoaderCircle size={18} className="animate-spin" />{bn ? 'যাচাই হচ্ছে...' : 'Verifying...'}</> : (bn ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Reset Password')}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => { setMode('login'); setError(''); }} className="min-h-10 text-sm text-slate-600">{bn ? 'লগইনে ফিরে যান' : 'Back to Login'}</button>
                <button type="button" onClick={() => requestOtp()} disabled={loading || resendSeconds > 0} className="min-h-10 text-sm font-semibold text-[#536B4D] disabled:text-slate-400">
                  {resendSeconds > 0
                    ? (bn ? `${resendSeconds} সেকেন্ড পরে আবার পাঠান` : `Resend in ${resendSeconds}s`)
                    : (bn ? 'আবার OTP পাঠান' : 'Resend OTP')}
                </button>
              </div>
            </form>
          )}

          {mode === 'login' && (
            <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#F7F4EC] p-3 text-xs leading-relaxed text-slate-600">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#536B4D]" aria-hidden="true" />
              <span>{bn
                ? 'আপনার পাসওয়ার্ড সোসাইটির সার্ভারে যাচাই হয়। অনুমোদিত অ্যাকাউন্টের জন্য সোসাইটি অ্যাডমিনের সঙ্গে যোগাযোগ করুন।'
                : 'Your password is verified by the society backend. Contact your Society Admin if your account needs approval.'}</span>
            </div>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">ABAS SATHI · Secure Society Access</p>
      </section>
    </main>
  );
};
