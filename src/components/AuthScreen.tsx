import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ArrowRight, RefreshCw, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { PlatformAuthApi } from '../services/authApi.js';
import type { PlayerProfile } from '../types/platform.js';
import Antigravity from './Antigravity.js';
import CodeSlots, { type CodeSlotsStatus } from './CodeSlots.js';

interface AuthScreenProps {
  onSuccess: (player: PlayerProfile) => void;
}

type AuthView =
  | 'login'
  | 'signup'
  | 'verify_signup'
  | 'forgot_request'
  | 'forgot_verify_code'
  | 'forgot_new_password';

type FieldName =
  | 'email'
  | 'username'
  | 'password'
  | 'repeatPassword'
  | 'code'
  | 'resetCode'
  | 'newPassword'
  | 'confirmNewPassword';

type FieldErrors = Partial<Record<FieldName, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [view, setView] = useState<AuthView>('login');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [code, setCode] = useState('');

  const [resetCode, setResetCode] = useState('');
  const [verifiedResetUsername, setVerifiedResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [signupCodeStatus, setSignupCodeStatus] = useState<CodeSlotsStatus>('idle');
  const [resetCodeStatus, setResetCodeStatus] = useState<CodeSlotsStatus>('idle');

  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const signupVerifyInFlightRef = useRef(false);
  const resetVerifyInFlightRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const clearAllErrors = () => {
    setFieldErrors({});
    setFormError(null);
  };

  const clearFieldError = (field: FieldName) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  const switchView = (next: AuthView) => {
    setView(next);
    clearAllErrors();
    setInfoMessage(null);
    setSignupCodeStatus('idle');
    setResetCodeStatus('idle');
    if (next === 'login' || next === 'signup' || next === 'forgot_request') {
      setResetCode('');
      setResetToken('');
      setVerifiedResetUsername('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const mapServerErrorToFields = (msg: string, activeView: AuthView) => {
    const lower = msg.toLowerCase();
    const mapped: FieldErrors = {};

    if (activeView === 'signup') {
      if (lower.includes('email')) mapped.email = msg;
      else if (lower.includes('username')) mapped.username = msg;
      else if (lower.includes('password')) mapped.password = msg;
    } else if (activeView === 'login') {
      if (lower.includes('invalid') || lower.includes('credentials') || lower.includes('password')) {
        mapped.email = 'Check your email address.';
        mapped.password = msg;
      } else if (lower.includes('email') || lower.includes('account') || lower.includes('not found')) {
        mapped.email = msg;
      }
    } else if (activeView === 'verify_signup') {
      mapped.code = msg;
    } else if (activeView === 'forgot_request') {
      mapped.email = msg;
    } else if (activeView === 'forgot_verify_code') {
      mapped.resetCode = msg;
    } else if (activeView === 'forgot_new_password') {
      if (lower.includes('password')) mapped.newPassword = msg;
    }

    if (Object.keys(mapped).length > 0) {
      setFieldErrors(mapped);
    } else {
      setFormError(msg);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllErrors();
    setInfoMessage(null);

    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!trimmedUsername) {
      errors.username = 'Username is required.';
    } else if (trimmedUsername.length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    } else if (trimmedUsername.length > 20) {
      errors.username = 'Username must be 20 characters or fewer.';
    } else if (!USERNAME_REGEX.test(trimmedUsername)) {
      errors.username = 'Username can only use letters, numbers, and underscores.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (!repeatPassword) {
      errors.repeatPassword = 'Please repeat your password.';
    } else if (password !== repeatPassword) {
      errors.repeatPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await PlatformAuthApi.signup(trimmedEmail, trimmedUsername, password);
      setCode('');
      setSignupCodeStatus('idle');
      setView('verify_signup');
      setInfoMessage(
        res.codePreview ? `${res.message} (Dev code: ${res.codePreview})` : res.message
      );
    } catch (err: unknown) {
      mapServerErrorToFields(err instanceof Error ? err.message : 'Signup failed', 'signup');
    } finally {
      setLoading(false);
    }
  };

  const submitVerifySignup = async (rawCode: string) => {
    if (signupVerifyInFlightRef.current || signupCodeStatus === 'success') return;
    clearAllErrors();

    const cleanCode = rawCode.trim();
    if (!cleanCode) {
      setFieldErrors({ code: 'Confirmation code is required.' });
      setSignupCodeStatus('error');
      schedule(() => setSignupCodeStatus('idle'), 500);
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setFieldErrors({ code: 'Please enter the full 6-digit numeric code.' });
      setSignupCodeStatus('error');
      schedule(() => setSignupCodeStatus('idle'), 500);
      return;
    }

    signupVerifyInFlightRef.current = true;
    setLoading(true);
    try {
      const res = await PlatformAuthApi.verifyCode(email.trim(), cleanCode);
      setSignupCodeStatus('success');
      schedule(() => {
        onSuccess(res.player);
      }, 700);
    } catch (err: unknown) {
      setSignupCodeStatus('error');
      mapServerErrorToFields(err instanceof Error ? err.message : 'Verification failed', 'verify_signup');
      schedule(() => {
        setSignupCodeStatus('idle');
        setCode('');
      }, 650);
    } finally {
      setLoading(false);
      signupVerifyInFlightRef.current = false;
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitVerifySignup(code);
  };

  const handleResendCode = async () => {
    clearAllErrors();
    setSignupCodeStatus('idle');
    setCode('');
    setLoading(true);
    try {
      const res = await PlatformAuthApi.resendCode(email.trim());
      setInfoMessage(
        res.codePreview ? `${res.message} (Dev code: ${res.codePreview})` : res.message
      );
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllErrors();

    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await PlatformAuthApi.login(trimmedEmail, password);
      onSuccess(res.player);
    } catch (err: unknown) {
      mapServerErrorToFields(err instanceof Error ? err.message : 'Invalid email or password.', 'login');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllErrors();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFieldErrors({ email: 'Email address is required.' });
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);
    try {
      const res = await PlatformAuthApi.forgotPassword(trimmedEmail);
      setResetCode('');
      setResetToken('');
      setVerifiedResetUsername('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetCodeStatus('idle');
      setInfoMessage(
        res.codePreview ? `${res.message} (Dev code: ${res.codePreview})` : res.message
      );
      setView('forgot_verify_code');
    } catch (err: unknown) {
      mapServerErrorToFields(
        err instanceof Error ? err.message : 'Password reset request failed.',
        'forgot_request'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitVerifyResetCode = async (rawCode: string) => {
    if (resetVerifyInFlightRef.current || resetCodeStatus === 'success') return;
    clearAllErrors();

    const cleanResetCode = rawCode.trim();
    if (!cleanResetCode) {
      setFieldErrors({ resetCode: 'Confirmation code is required.' });
      setResetCodeStatus('error');
      schedule(() => setResetCodeStatus('idle'), 500);
      return;
    }
    if (!/^\d{6}$/.test(cleanResetCode)) {
      setFieldErrors({ resetCode: 'Please enter the full 6-digit numeric code.' });
      setResetCodeStatus('error');
      schedule(() => setResetCodeStatus('idle'), 500);
      return;
    }

    resetVerifyInFlightRef.current = true;
    setLoading(true);
    try {
      const res = await PlatformAuthApi.verifyResetCode(email.trim(), cleanResetCode);
      setVerifiedResetUsername(res.username);
      setResetToken(res.resetToken);
      setResetCodeStatus('success');
      schedule(() => {
        setInfoMessage(null);
        setResetCodeStatus('idle');
        setView('forgot_new_password');
      }, 700);
    } catch (err: unknown) {
      setResetCodeStatus('error');
      mapServerErrorToFields(
        err instanceof Error ? err.message : 'Invalid or expired confirmation code.',
        'forgot_verify_code'
      );
      schedule(() => {
        setResetCodeStatus('idle');
        setResetCode('');
      }, 650);
    } finally {
      setLoading(false);
      resetVerifyInFlightRef.current = false;
    }
  };

  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitVerifyResetCode(resetCode);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAllErrors();

    if (!resetToken) {
      setFormError('Your password reset session expired. Please request a new code.');
      setView('forgot_request');
      return;
    }

    const errors: FieldErrors = {};

    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters.';
    }

    if (!confirmNewPassword) {
      errors.confirmNewPassword = 'Please repeat your new password.';
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await PlatformAuthApi.resetPassword(email.trim(), resetToken, newPassword);
      setInfoMessage(res.message || 'Password reset successfully. You may now log in.');
      setPassword('');
      setRepeatPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetCode('');
      setResetToken('');
      setVerifiedResetUsername('');
      setView('login');
    } catch (err: unknown) {
      mapServerErrorToFields(
        err instanceof Error ? err.message : 'Password reset failed.',
        'forgot_new_password'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    clearAllErrors();
    setResetCodeStatus('idle');
    setResetCode('');
    setLoading(true);
    try {
      const res = await PlatformAuthApi.forgotPassword(email.trim());
      setInfoMessage(
        res.codePreview ? `${res.message} (Dev code: ${res.codePreview})` : res.message
      );
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Resend reset code failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: FieldName) =>
    `input-flat auth-input ${fieldErrors[field] ? 'auth-input-error' : ''}`;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: '#09090B',
        backdropFilter: 'none'
      }}
    >
      {/* Black background with White Antigravity WebGL2 particles */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background: '#09090B'
        }}
      >
        <Antigravity
          count={1400}
          colors={['#FFFFFF', '#E4E4E7', '#A1A1AA']}
          colorMode="radial"
          lightMode={false}
          particleShape="capsule"
          particleSize={0.9}
          ringRadius={7}
          magnetRadius={9}
          ambient={0.25}
          opacity={0.92}
          autoAnimate={true}
          interactive={true}
          clickBurst={true}
        />
      </div>

      <div
        className="modal-card"
        style={{
          maxWidth: 440,
          position: 'relative',
          zIndex: 10,
          background: '#FFFFFF',
          border: '1px solid #27272A'
        }}
      >
        {/* Unified Platform Brand Title: MARBLE GAMES */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h1
            style={{
              fontSize: '1.625rem',
              fontWeight: 900,
              letterSpacing: '0.12em',
              color: '#09090B',
              margin: 0,
              textTransform: 'uppercase'
            }}
          >
            MARBLE GAMES
          </h1>
        </div>

        {(view === 'login' || view === 'signup') && (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => switchView('signup')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'none',
                  color: view === 'signup' ? '#09090B' : 'var(--text-muted)',
                  fontWeight: view === 'signup' ? 700 : 500,
                  borderBottom: view === 'signup' ? '2px solid #09090B' : 'none'
                }}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => switchView('login')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'none',
                  color: view === 'login' ? '#09090B' : 'var(--text-muted)',
                  fontWeight: view === 'login' ? 700 : 500,
                  borderBottom: view === 'login' ? '2px solid #09090B' : 'none'
                }}
              >
                Log In
              </button>
            </div>

            {infoMessage && (
              <div
                style={{
                  background: '#F4F4F5',
                  border: '1px solid #D4D4D8',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: '#09090B',
                  marginBottom: 14
                }}
              >
                {infoMessage}
              </div>
            )}

            {view === 'signup' ? (
              <form onSubmit={handleSignup} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: fieldErrors.email ? '#DC2626' : '#09090B',
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="player@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    className={inputClass('email')}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email && <div className="field-error-text">{fieldErrors.email}</div>}
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: fieldErrors.username ? '#DC2626' : '#09090B',
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="ShadowSniper"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      clearFieldError('username');
                    }}
                    className={inputClass('username')}
                    aria-invalid={Boolean(fieldErrors.username)}
                  />
                  {fieldErrors.username && <div className="field-error-text">{fieldErrors.username}</div>}
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: fieldErrors.password ? '#DC2626' : '#09090B',
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      className={inputClass('password')}
                      style={{ paddingRight: 40 }}
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && <div className="field-error-text">{fieldErrors.password}</div>}
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: fieldErrors.repeatPassword ? '#DC2626' : '#09090B',
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Repeat Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showRepeatPassword ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={repeatPassword}
                      onChange={(e) => {
                        setRepeatPassword(e.target.value);
                        clearFieldError('repeatPassword');
                      }}
                      className={inputClass('repeatPassword')}
                      style={{ paddingRight: 40 }}
                      aria-invalid={Boolean(fieldErrors.repeatPassword)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                      title={showRepeatPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRepeatPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  {fieldErrors.repeatPassword && (
                    <div className="field-error-text">{fieldErrors.repeatPassword}</div>
                  )}
                </div>

                {formError && (
                  <div style={{ color: '#DC2626', fontSize: '0.8125rem', textAlign: 'center', marginTop: 2 }}>
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-flat auth-btn-black"
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {loading ? 'Signing Up...' : 'Sign Up'}
                  <ArrowRight size={16} />
                </button>

                <div style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#09090B',
                      cursor: 'pointer',
                      fontWeight: 700,
                      padding: 0,
                      fontSize: '0.75rem',
                      textDecoration: 'underline'
                    }}
                  >
                    Log In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: fieldErrors.email ? '#DC2626' : '#09090B',
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="player@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFieldError('email');
                    }}
                    className={inputClass('email')}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email && <div className="field-error-text">{fieldErrors.email}</div>}
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: fieldErrors.password ? '#DC2626' : '#09090B',
                      marginBottom: 4,
                      display: 'block'
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      className={inputClass('password')}
                      style={{ paddingRight: 40 }}
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                      title={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && <div className="field-error-text">{fieldErrors.password}</div>}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    marginTop: -2
                  }}
                >
                  <button
                    type="button"
                    onClick={() => switchView('forgot_request')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '0.75rem'
                    }}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView('signup')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#09090B',
                      cursor: 'pointer',
                      fontWeight: 700,
                      padding: 0,
                      fontSize: '0.75rem',
                      textDecoration: 'underline'
                    }}
                  >
                    Sign up?
                  </button>
                </div>

                {formError && (
                  <div style={{ color: '#DC2626', fontSize: '0.8125rem', textAlign: 'center', marginTop: 2 }}>
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-flat auth-btn-black"
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {loading ? 'Logging In...' : 'Log In'}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </>
        )}

        {view === 'verify_signup' && (
          <form onSubmit={handleVerifyCode} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: '#09090B',
                  border: '1px solid #09090B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={20} color="#FFFFFF" />
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1rem', marginBottom: 2 }}>
                  Verify Email Code
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Enter the 6-digit confirmation code sent to <strong style={{ color: '#09090B' }}>{email}</strong>
                </p>
              </div>
            </div>

            {infoMessage && (
              <div
                style={{
                  background: '#F4F4F5',
                  border: '1px solid #D4D4D8',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: '#09090B'
                }}
              >
                {infoMessage}
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: fieldErrors.code ? '#DC2626' : '#09090B',
                  marginBottom: 10,
                  display: 'block'
                }}
              >
                6-Digit Confirmation Code
              </label>
              <CodeSlots
                length={6}
                value={code}
                onChange={(nextCode) => {
                  setCode(nextCode);
                  if (nextCode.length > 0) {
                    clearFieldError('code');
                    if (signupCodeStatus === 'error') setSignupCodeStatus('idle');
                  }
                }}
                onComplete={(completedCode) => {
                  submitVerifySignup(completedCode);
                }}
                status={signupCodeStatus}
                disabled={loading || signupCodeStatus === 'success'}
                autoFocus
                accentColor="#09090B"
                successColor="#10B981"
                inkColor="#09090B"
                slotColor="#F4F4F5"
                borderColor="#D4D4D8"
                digitColor="#FFFFFF"
                dangerColor="#DC2626"
                ariaLabel="Email verification code"
              />
              {fieldErrors.code && (
                <div className="field-error-text" style={{ textAlign: 'center', marginTop: 8 }}>
                  {fieldErrors.code}
                </div>
              )}
            </div>

            {formError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', textAlign: 'center' }}>{formError}</div>
            )}

            <button
              type="submit"
              disabled={loading || signupCodeStatus === 'success'}
              className="btn-flat auth-btn-black"
              style={{ width: '100%' }}
            >
              {signupCodeStatus === 'success'
                ? 'Verified!'
                : loading
                  ? 'Verifying...'
                  : 'Verify & Enter Hub'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="btn-flat"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  color: '#09090B'
                }}
              >
                <RefreshCw size={12} />
                Resend Code
              </button>

              <button
                type="button"
                onClick={() => switchView('signup')}
                className="btn-flat"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  color: 'var(--text-secondary)'
                }}
              >
                Back to Sign Up
              </button>
            </div>
          </form>
        )}

        {view === 'forgot_request' && (
          <form onSubmit={handleRequestReset} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: '#09090B',
                  border: '1px solid #09090B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <KeyRound size={20} color="#FFFFFF" />
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1rem', marginBottom: 2 }}>
                  Reset Password
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Enter your email address to receive a 6-digit verification code.
                </p>
              </div>
            </div>

            {infoMessage && (
              <div
                style={{
                  background: '#F4F4F5',
                  border: '1px solid #D4D4D8',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: '#09090B'
                }}
              >
                {infoMessage}
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: fieldErrors.email ? '#DC2626' : '#09090B',
                  marginBottom: 4,
                  display: 'block'
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                className={inputClass('email')}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && <div className="field-error-text">{fieldErrors.email}</div>}
            </div>

            {formError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', textAlign: 'center' }}>{formError}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-flat auth-btn-black"
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
              <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => switchView('login')}
                className="btn-flat"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  color: '#09090B'
                }}
              >
                <ArrowLeft size={14} />
                Back to Log In
              </button>
            </div>
          </form>
        )}

        {view === 'forgot_verify_code' && Boolean(email.trim()) && (
          <form onSubmit={handleVerifyResetCode} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: '#09090B',
                  border: '1px solid #09090B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <KeyRound size={20} color="#FFFFFF" />
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1rem', marginBottom: 2 }}>
                  Verify Reset Code
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Enter the 6-digit confirmation code sent to <strong style={{ color: '#09090B' }}>{email}</strong>
                </p>
              </div>
            </div>

            {infoMessage && (
              <div
                style={{
                  background: '#F4F4F5',
                  border: '1px solid #D4D4D8',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: '#09090B'
                }}
              >
                {infoMessage}
              </div>
            )}

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: fieldErrors.resetCode ? '#DC2626' : '#09090B',
                  marginBottom: 10,
                  display: 'block'
                }}
              >
                6-Digit Confirmation Code
              </label>
              <CodeSlots
                length={6}
                value={resetCode}
                onChange={(nextCode) => {
                  setResetCode(nextCode);
                  if (nextCode.length > 0) {
                    clearFieldError('resetCode');
                    if (resetCodeStatus === 'error') setResetCodeStatus('idle');
                  }
                }}
                onComplete={(completedCode) => {
                  submitVerifyResetCode(completedCode);
                }}
                status={resetCodeStatus}
                disabled={loading || resetCodeStatus === 'success'}
                autoFocus
                accentColor="#09090B"
                successColor="#10B981"
                inkColor="#09090B"
                slotColor="#F4F4F5"
                borderColor="#D4D4D8"
                digitColor="#FFFFFF"
                dangerColor="#DC2626"
                ariaLabel="Password reset confirmation code"
              />
              {fieldErrors.resetCode && (
                <div className="field-error-text" style={{ textAlign: 'center', marginTop: 8 }}>
                  {fieldErrors.resetCode}
                </div>
              )}
            </div>

            {formError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', textAlign: 'center' }}>{formError}</div>
            )}

            <button
              type="submit"
              disabled={loading || resetCodeStatus === 'success'}
              className="btn-flat auth-btn-black"
              style={{ width: '100%' }}
            >
              {resetCodeStatus === 'success'
                ? 'Code Verified!'
                : loading
                  ? 'Verifying...'
                  : 'Verify Code'}
              {resetCodeStatus !== 'success' && <ArrowRight size={16} />}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={handleResendResetCode}
                disabled={loading || resetCodeStatus === 'success'}
                className="btn-flat"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  color: '#09090B'
                }}
              >
                <RefreshCw size={12} />
                Resend Code
              </button>

              <button
                type="button"
                onClick={() => switchView('forgot_request')}
                className="btn-flat"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  color: 'var(--text-secondary)'
                }}
              >
                <ArrowLeft size={14} />
                Change Email
              </button>
            </div>
          </form>
        )}

        {view === 'forgot_new_password' && Boolean(resetToken && verifiedResetUsername) && (
          <form onSubmit={handleResetPassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: '#09090B',
                  border: '1px solid #09090B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <KeyRound size={20} color="#FFFFFF" />
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1rem', marginBottom: 2 }}>
                  Set New Password
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Identity verified. Choose a new password for your account.
                </p>
              </div>
            </div>

            {/* Verified Account Username Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: '#FAFAFA',
                border: '1px solid #E4E4E7'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#09090B',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  {(verifiedResetUsername.trim()[0] || 'P').toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: '#09090B',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {verifiedResetUsername}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {email}
                  </div>
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#047857',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 9999,
                  padding: '3px 8px',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={12} />
                Verified
              </span>
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: fieldErrors.newPassword ? '#DC2626' : '#09090B',
                  marginBottom: 4,
                  display: 'block'
                }}
              >
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  autoFocus
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearFieldError('newPassword');
                  }}
                  className={inputClass('newPassword')}
                  style={{ paddingRight: 40 }}
                  aria-invalid={Boolean(fieldErrors.newPassword)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              {fieldErrors.newPassword && <div className="field-error-text">{fieldErrors.newPassword}</div>}
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: fieldErrors.confirmNewPassword ? '#DC2626' : '#09090B',
                  marginBottom: 4,
                  display: 'block'
                }}
              >
                Repeat New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmNewPassword ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(e.target.value);
                    clearFieldError('confirmNewPassword');
                  }}
                  className={inputClass('confirmNewPassword')}
                  style={{ paddingRight: 40 }}
                  aria-invalid={Boolean(fieldErrors.confirmNewPassword)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  title={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              {fieldErrors.confirmNewPassword && (
                <div className="field-error-text">{fieldErrors.confirmNewPassword}</div>
              )}
            </div>

            {formError && (
              <div style={{ color: '#DC2626', fontSize: '0.8125rem', textAlign: 'center', marginTop: 2 }}>
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-flat auth-btn-black"
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
              <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => switchView('login')}
                className="btn-flat"
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 10px',
                  background: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  color: 'var(--text-secondary)'
                }}
              >
                <ArrowLeft size={14} />
                Back to Log In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
