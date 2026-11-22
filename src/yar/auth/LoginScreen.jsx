import React, { useState, useEffect } from 'react';
import YarLogo from '@/components/YarLogo';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { auth } from './access';
import { requestReset } from '../accounts/repository';
import { Field, useWords, errorText } from '../accounts/AccountUI';
import { usePrefs } from '../i18n/prefs';
import PhoneField from '../accounts/PhoneField';
import { iraqiPhone } from '../accounts/phone';
import { authApi } from '../services/api/authApi';

export function formatInternationalPhone(countryCode, input) {
  const trimmed = (input || '').trim();
  if (trimmed.startsWith('+')) {
    return trimmed.replace(/[\s-]/g, '');
  }
  const cleaned = trimmed.replace(/[\s-]/g, '').replace(/^0+/, '');
  const dial = (countryCode || '').trim().replace(/[\s-]/g, '');
  return `${dial}${cleaned}`;
}

export default function LoginScreen({ initialMode }) {
  const t = useWords(), { lang } = usePrefs();

  // Initial mode from prop, URL query or path if present
  const isRegisterInitial = typeof window !== 'undefined' && (
    window.location.pathname === '/register' ||
    new URLSearchParams(window.location.search).get('mode') === 'register'
  );

  const [mode, setMode] = useState(initialMode || (isRegisterInitial ? 'register' : 'login')); // 'login' | 'register' | 'verify_otp' | 'forgot'

  useEffect(() => {
    if (initialMode && initialMode !== mode) {
      setMode(initialMode);
      setError('');
      setStatusMsg('');
      setPassword('');
      setConfirmPassword('');
      setOtpCode('');
    }
  }, [initialMode]);
  const [identifier, setIdentifier] = useState(
    (typeof localStorage !== 'undefined' && localStorage.getItem('YAR_ADMIN_REMEMBER_PHONE')) || ''
  );
  const [countryCode, setCountryCode] = useState('+964');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // 60-second cooldown timer for WhatsApp OTP resend
  useEffect(() => {
    if (mode === 'verify_otp' && countdown === 0) {
      setCountdown(60);
    }
  }, [mode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  function resetState() {
    setError('');
    setStatusMsg('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setBusy(true);
    try {
      await auth.signIn(identifier, password);
      if (remember) {
        let phoneToRemember = identifier.trim().toLowerCase();
        if (!['admin', 'booking'].includes(phoneToRemember)) {
          try {
            phoneToRemember = iraqiPhone(identifier);
          } catch {
            phoneToRemember = identifier.trim();
          }
        }
        localStorage.setItem('YAR_ADMIN_REMEMBER_PHONE', phoneToRemember);
      } else {
        localStorage.removeItem('YAR_ADMIN_REMEMBER_PHONE');
      }
      window.location.assign('/dashboard');
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setStatusMsg('');

    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(t('يجب أن تتكون كلمة المرور من 12 خانة على الأقل، وتحتوي على أحرف وأرقام.', 'Password must be at least 12 characters and include letters and numbers.'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('كلمتا المرور غير متطابقتين.', 'Passwords must match.'));
      return;
    }

    setBusy(true);
    try {
      const formattedPhone = formatInternationalPhone(countryCode, identifier);
      await authApi.register({
        name: name.trim(),
        phone: formattedPhone,
        password,
        email: email.trim() || undefined,
      });
      setIdentifier(formattedPhone);
      setStatusMsg(t('تم إرسال رمز التحقق إلى واتساب بنجاح.', 'Verification code sent to WhatsApp successfully.'));
      setCountdown(60);
      setMode('verify_otp');
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setBusy(true);
    try {
      const formattedPhone = formatInternationalPhone(countryCode, identifier);
      await authApi.verifyOtp(formattedPhone, otpCode.trim());
      setStatusMsg(t('تم تفعيل الحساب بنجاح! جاري تسجيل الدخول...', 'Account activated successfully! Signing in...'));
      try {
        await auth.signIn(formattedPhone, password);
        window.location.assign('/dashboard');
      } catch {
        setMode('login');
        setStatusMsg(t('تم تفعيل الحساب بنجاح. يمكنك الآن تسجيل الدخول.', 'Account activated successfully. You can now sign in.'));
      }
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    if (countdown > 0 || busy) return;
    setError('');
    setBusy(true);
    try {
      const formattedPhone = formatInternationalPhone(countryCode, identifier);
      await authApi.requestOtp(formattedPhone);
      setStatusMsg(t('تمت إعادة إرسال رمز التحقق بنجاح.', 'Verification code resent successfully.'));
      setCountdown(60);
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    setBusy(true);
    try {
      const formattedPhone = formatInternationalPhone(countryCode, identifier);
      await requestReset(formattedPhone);
      setStatusMsg(
        t(
          'إذا كان الرقم مرتبطًا بحساب، فقد تم إرسال طلب إعادة التعيين.',
          'If this number is associated with an account, a reset request has been processed.'
        )
      );
    } catch (err) {
      setError(errorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-account" data-no-translate>
      <YarLogo lang={lang} className="login-logo" />

      {/* Titles */}
      {mode === 'login' && (
        <>
          <h1>{t('تسجيل الدخول', 'Sign In')}</h1>
          <p>{t('أدخل اسم المستخدم أو رقم الهاتف وكلمة المرور للوصول إلى لوحة التحكم', 'Enter your username or mobile number and password to access the dashboard.')}</p>
        </>
      )}

      {mode === 'register' && (
        <>
          <h1>{t('إنشاء حساب جديد', 'Create an Account')}</h1>
          <p>{t('أدخل بياناتك للتسجيل وسنرسل رمز التحقق عبر واتساب', 'Enter your details to register; an OTP will be sent via WhatsApp')}</p>
        </>
      )}

      {mode === 'verify_otp' && (
        <>
          <h1>{t('تأكيد وتفعيل الحساب', 'Verify & Activate Account')}</h1>
          <p>{t('أدخل رمز التحقق (OTP) المكوّن من 6 أرقام المرسل عبر واتساب', 'Enter the 6-digit verification code sent via WhatsApp')}</p>
        </>
      )}

      {mode === 'forgot' && (
        <>
          <h1>{t('نسيت كلمة المرور؟', 'Forgot Your Password?')}</h1>
          <p>{t('أدخل رقم الهاتف المرتبط بحسابك لإرسال طلب إعادة تعيين كلمة المرور', 'Enter the mobile number associated with your account to submit a password reset request')}</p>
        </>
      )}

      {/* Status & Error messages */}
      {statusMsg && (
        <p role="status" style={{ color: 'var(--public-gold)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={16} />
          {statusMsg}
        </p>
      )}
      {error && <p role="alert" style={{ color: 'var(--destructive)', margin: '8px 0' }}>{error}</p>}

      {/* Forms */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="account-form">
          <Field
            label={t('اسم المستخدم أو رقم الهاتف', 'Username or Mobile Number')}
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <div className="account-password">
            <Field
              label={t('كلمة المرور', 'Password')}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={show ? t('إخفاء كلمة المرور', 'Hide Password') : t('إظهار كلمة المرور', 'Show Password')}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <label className="account-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('تذكر رقم الهاتف', 'Remember Mobile Number')}
          </label>
          <Button disabled={busy} type="submit">
            {busy ? t('جاري المعالجة…', 'Processing…') : t('تسجيل الدخول', 'Sign In')}
            <ArrowUpRight />
          </Button>
        </form>
      )}

      {mode === 'register' && (
        <form onSubmit={handleRegister} className="account-form">
          <Field
            label={t('الاسم الكامل', 'Full Name')}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <PhoneField
            label={t('رقم الهاتف (مع الرمز الدولي)', 'Phone Number')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            country={countryCode}
            onCountryChange={setCountryCode}
            lang={lang}
            required
          />
          <Field
            label={t('البريد الإلكتروني (اختياري)', 'Email (Optional)')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="account-password">
            <Field
              label={t('كلمة المرور', 'Password')}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <small style={{ color: 'var(--muted-foreground)', fontSize: '11px', marginBlockStart: '-8px' }}>
            {t('يجب أن تتكون كلمة المرور من 12 خانة على الأقل وتتضمن أحرفاً وأرقاماً.', 'Must be at least 12 characters and include letters and numbers.')}
          </small>
          <Field
            label={t('تأكيد كلمة المرور', 'Confirm Password')}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button disabled={busy} type="submit">
            {busy ? t('جاري المعالجة…', 'Processing…') : t('إنشاء الحساب والمتابعة', 'Register & Proceed')}
            <ArrowUpRight />
          </Button>
        </form>
      )}

      {mode === 'verify_otp' && (
        <form onSubmit={handleVerifyOtp} className="account-form">
          <Field
            label={t('رمز التحقق (OTP)', 'Verification Code (OTP)')}
            placeholder="123456"
            autoComplete="one-time-code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            required
          />
          <Button disabled={busy} type="submit">
            {busy ? t('جاري المعالجة…', 'Processing…') : t('تأكيد وتفعيل', 'Verify & Activate')}
            <ArrowUpRight />
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={busy || countdown > 0}
            onClick={handleResendOtp}
          >
            {countdown > 0
              ? t(
                  `إعادة إرسال رمز التحقق (${countdown} ثانية)`,
                  `Resend verification code (${countdown}s)`
                )
              : t('إعادة إرسال رمز التحقق', 'Resend Verification Code')}
          </Button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={handleForgot} className="account-form">
          <PhoneField
            label={t('رقم الهاتف', 'Mobile Number')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            country={countryCode}
            onCountryChange={setCountryCode}
            lang={lang}
            required
          />
          <Button disabled={busy} type="submit">
            {busy ? t('جاري المعالجة…', 'Processing…') : t('إرسال الطلب', 'Submit Request')}
            <ArrowUpRight />
          </Button>
        </form>
      )}

      {/* Navigation links between modes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockStart: 12 }}>
        {mode === 'login' && (
          <>
            <Button
              variant="link"
              type="button"
              onClick={() => {
                resetState();
                setMode('register');
                if (typeof window !== 'undefined' && window.location.pathname === '/login') {
                  window.history.pushState({}, '', '/register');
                }
              }}
            >
              {t('ليس لديك حساب؟ إنشاء حساب جديد', 'Don’t have an account? Create an account')}
            </Button>
            <Button
              variant="link"
              type="button"
              onClick={() => {
                resetState();
                setMode('forgot');
              }}
            >
              {t('نسيت كلمة المرور؟', 'Forgot Password?')}
            </Button>
          </>
        )}

        {mode !== 'login' && (
          <Button
            variant="link"
            type="button"
            onClick={() => {
              resetState();
              setMode('login');
              if (typeof window !== 'undefined' && window.location.pathname === '/register') {
                window.history.pushState({}, '', '/login');
              }
            }}
          >
            {t('العودة لتسجيل الدخول', 'Back to Sign In')}
          </Button>
        )}
      </div>
    </div>
  );
}
