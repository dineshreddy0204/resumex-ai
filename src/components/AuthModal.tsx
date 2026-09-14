import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { googleIdentityManager, type GoogleIdentityError } from '../services/googleIdentity';
import type { User, UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'signup' | 'verify' | 'forgot' | 'reset';
  initialToken?: string;
  onClose: () => void;
  onSuccess: (user: User, profile: UserProfile) => void;
  onTryDemo: () => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  initialToken = '',
  onClose,
  onSuccess,
  onTryDemo,
  showToast,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify' | 'forgot' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Verification & reset token state
  const [verifyToken, setVerifyToken] = useState(initialToken);
  const [verifyPromptNotice, setVerifyPromptNotice] = useState<string | null>(null);

  // Loading & error
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [originErrorInfo, setOriginErrorInfo] = useState<{ origin: string; message: string } | null>(null);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [isGoogleBtnRendered, setIsGoogleBtnRendered] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Google Identity Services once when modal opens in login/signup mode
  useEffect(() => {
    if (!isOpen || (mode !== 'login' && mode !== 'signup')) {
      return;
    }

    let isMounted = true;

    const setupGoogleAuth = async () => {
      // Check if client ID is configured
      const clientId = googleIdentityManager.getGoogleClientId();
      if (!clientId) {
        return;
      }

      // Wait for GIS SDK script to be ready
      const ready = await googleIdentityManager.waitForScript(3000);
      if (!isMounted || !ready) return;

      const initialized = googleIdentityManager.initialize({
        onSuccess: async (credential: string) => {
          setLoading(true);
          setErrorMessage(null);
          setOriginErrorInfo(null);
          try {
            const res = await api.googleAuth(credential);
            showToast('success', `Signed in with Google as ${res.user.name || res.user.email}`);
            onSuccess(res.user, res.profile);
            onClose();
          } catch (err: any) {
            setErrorMessage(err.message || 'Google token validation failed on the backend.');
          } finally {
            if (isMounted) setLoading(false);
          }
        },
        onError: (err: GoogleIdentityError) => {
          if (!isMounted) return;
          if (err.isOriginError && err.origin) {
            setOriginErrorInfo({ origin: err.origin, message: err.message });
          } else {
            setErrorMessage(err.message);
          }
        },
      });

      if (initialized && googleBtnContainerRef.current && isMounted) {
        const rendered = googleIdentityManager.renderButton(googleBtnContainerRef.current, {
          text: 'continue_with',
          width: 380,
        });
        if (rendered && isMounted) {
          setIsGoogleBtnRendered(true);
        }
      }
    };

    setupGoogleAuth();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(email.trim(), password);
        showToast('success', `Welcome back, ${res.user.name}!`);
        onSuccess(res.user, res.profile);
        onClose();
      } else if (mode === 'signup') {
        if (!agreeTerms) {
          setErrorMessage('Please accept the Terms of Service to create an account.');
          setLoading(false);
          return;
        }
        const res = await api.signup(name.trim(), email.trim(), password);
        if (res.requiresVerification) {
          setMode('verify');
          showToast('info', res.message || 'Please verify your email address to complete registration.');
          if (res.devVerificationUrl) {
            const urlObj = new URL(res.devVerificationUrl);
            const devToken = urlObj.searchParams.get('token');
            if (devToken) {
              setVerifyToken(devToken);
            }
            setVerifyPromptNotice(
              `Email dispatched to ${email}. In local dev mode, your token has been detected from the dev logger.`
            );
          } else {
            setVerifyPromptNotice(`A verification email was sent to ${email}. Please enter the token from your email.`);
          }
        } else if (res.user && res.profile) {
          showToast('success', `Account created! Welcome, ${res.user.name}.`);
          onSuccess(res.user, res.profile);
          onClose();
        }
      } else if (mode === 'verify') {
        if (!verifyToken.trim()) {
          setErrorMessage('Please enter your verification token.');
          setLoading(false);
          return;
        }
        const res = await api.verifyEmail(verifyToken.trim());
        showToast('success', 'Email confirmed! Your account is active.');
        onSuccess(res.user, res.profile);
        onClose();
      } else if (mode === 'forgot') {
        const res = await api.forgotPassword(email.trim());
        showToast('info', res.message);
        setMode('login');
      } else if (mode === 'reset') {
        if (!verifyToken.trim()) {
          setErrorMessage('Password reset token is required.');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setErrorMessage('New password must be at least 8 characters.');
          setLoading(false);
          return;
        }
        const res = await api.resetPassword(verifyToken.trim(), password);
        showToast('success', res.message || 'Password reset successfully. Please log in.');
        setMode('login');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMessage(null);
    setOriginErrorInfo(null);
    try {
      const clientId = googleIdentityManager.getGoogleClientId();
      if (!clientId) {
        setErrorMessage(
          'Google OAuth credentials are not configured in this environment (VITE_GOOGLE_CLIENT_ID is not set). Please use standard email registration or explore the Demo Sandbox.'
        );
        return;
      }

      if (!googleIdentityManager.isSecureOrigin()) {
        setErrorMessage('Google Sign-In requires an HTTPS origin in production environments.');
        return;
      }

      const ready = await googleIdentityManager.waitForScript(2500);
      if (!ready) {
        setErrorMessage(
          'Google Identity Services client library is loading or blocked by your browser. Please check your connection or ad-blocker.'
        );
        return;
      }

      const initialized = googleIdentityManager.initialize({
        onSuccess: async (credential: string) => {
          setLoading(true);
          try {
            const res = await api.googleAuth(credential);
            showToast('success', `Signed in with Google as ${res.user.name || res.user.email}`);
            onSuccess(res.user, res.profile);
            onClose();
          } catch (err: any) {
            setErrorMessage(err.message || 'Google token validation failed on the backend.');
          } finally {
            setLoading(false);
          }
        },
        onError: (err: GoogleIdentityError) => {
          if (err.isOriginError && err.origin) {
            setOriginErrorInfo({ origin: err.origin, message: err.message });
          } else {
            setErrorMessage(err.message);
          }
        },
      });

      if (initialized && googleBtnContainerRef.current) {
        const rendered = googleIdentityManager.renderButton(googleBtnContainerRef.current, {
          text: 'continue_with',
          width: 380,
        });
        if (rendered) {
          setIsGoogleBtnRendered(true);
          return;
        }
      }

      // Prompt One Tap / display diagnostic inspection if button render was unavailable
      googleIdentityManager.prompt();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#EAE8E1] w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[#6E6E63] hover:text-[#171713] hover:bg-[#FAF9F5] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#4F5D2F] text-white font-black flex items-center justify-center mx-auto mb-3 shadow-xs">
            RX
          </div>
          <h2 className="text-xl font-bold text-[#171713] tracking-tight">
            {mode === 'login' && 'Sign in to ResumeX AI'}
            {mode === 'signup' && 'Create Your ResumeX Account'}
            {mode === 'verify' && 'Verify Email Address'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-[#6E6E63] mt-1">
            {mode === 'login' && 'Access your ATS intelligence reports and resume versions'}
            {mode === 'signup' && 'Experience corporate ATS simulation & factual AI optimization'}
            {mode === 'verify' && 'Confirm your account with the secure cryptographic token'}
            {mode === 'forgot' && 'Enter your account email to receive reset instructions'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="flex rounded-lg bg-[#FAF9F5] p-1 border border-[#EAE8E1] mb-5">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                mode === 'login'
                  ? 'bg-white text-[#171713] shadow-xs border border-[#EAE8E1]'
                  : 'text-[#6E6E63] hover:text-[#171713]'
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-tab-signup"
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                mode === 'signup'
                  ? 'bg-white text-[#171713] shadow-xs border border-[#EAE8E1]'
                  : 'text-[#6E6E63] hover:text-[#171713]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Origin Configuration Error Diagnostic */}
        {originErrorInfo && (
          <div className="p-3.5 mb-4 rounded-xl bg-amber-50/95 border border-amber-300 text-xs text-amber-950 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900">Google OAuth Origin Not Authorized</div>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Google blocked authentication (401: invalid_client / no registered origin) because this deployment origin has not been added to Authorized JavaScript origins.
                </p>
              </div>
            </div>

            <div className="bg-white/90 p-2 rounded-lg border border-amber-200 text-[11px] font-mono break-all flex items-center justify-between gap-2">
              <span className="truncate select-all text-[#171713]">{originErrorInfo.origin}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(originErrorInfo.origin);
                  setCopiedOrigin(true);
                  setTimeout(() => setCopiedOrigin(false), 2000);
                }}
                className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-sans font-medium text-[10px] shrink-0 transition flex items-center gap-1"
              >
                {copiedOrigin ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-amber-800" />
                    <span>Copy Origin</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-[10px] text-amber-800/90 leading-tight">
              <span className="font-semibold">How to fix:</span> In Google Cloud Console &rarr; <strong>APIs &amp; Services</strong> &rarr; <strong>Credentials</strong> &rarr; Open your Web OAuth Client ID &rarr; Add the origin above to <strong>Authorized JavaScript origins</strong> &rarr; Click <strong>Save</strong>.
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && !originErrorInfo && (
          <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Verification Notification */}
        {verifyPromptNotice && mode === 'verify' && (
          <div className="p-3 mb-4 rounded-lg bg-[#4F5D2F]/10 border border-[#4F5D2F]/20 text-xs text-[#4F5D2F] space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Token Generated
            </div>
            <p className="text-[11px] opacity-90">{verifyPromptNotice}</p>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#6E6E63] absolute left-3 top-2.5" />
                <input
                  id="signup-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6E6E63] absolute left-3 top-2.5" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#171713]">
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-[#4F5D2F] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6E6E63] absolute left-3 top-2.5" />
                <input
                  id="auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' || mode === 'reset' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' || mode === 'reset' ? 'Min. 8 characters' : '••••••••'}
                  className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#6E6E63] hover:text-[#171713]"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {(mode === 'verify' || mode === 'reset') && (
            <div>
              <label className="block text-xs font-medium text-[#171713] mb-1">
                {mode === 'reset' ? 'Password Reset Token' : 'Verification Token'}
              </label>
              <input
                id="auth-verify-token-input"
                type="text"
                required
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder={mode === 'reset' ? 'Paste reset token...' : 'Paste 64-character verification token...'}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D5D2C7] bg-white font-mono focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div className="flex items-center gap-2">
              <input
                id="agree-terms-checkbox"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="rounded text-[#4F5D2F] focus:ring-[#4F5D2F]"
              />
              <label htmlFor="agree-terms-checkbox" className="text-[11px] text-[#6E6E63]">
                I agree to the Terms of Service, Privacy Policy, and truth-verification audit protocols.
              </label>
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#4F5D2F] text-white text-xs font-semibold hover:bg-[#37421F] transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === 'login' ? (
              'Sign In to Account'
            ) : mode === 'signup' ? (
              'Create Account'
            ) : mode === 'verify' ? (
              'Confirm & Activate Account'
            ) : mode === 'reset' ? (
              'Reset Password & Sign In'
            ) : (
              'Send Reset Instructions'
            )}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Alternative Actions for login/signup */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="mt-5 space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#EAE8E1] w-full" />
              <span className="bg-white px-2 text-[11px] text-[#6E6E63] absolute">OR</span>
            </div>

            {/* Google Identity Services Container & Fallback Button */}
            <div className="w-full flex flex-col items-center">
              <div
                ref={googleBtnContainerRef}
                id="google-auth-container"
                className={`w-full flex justify-center ${isGoogleBtnRendered ? 'min-h-[40px]' : 'hidden'}`}
              />

              {!isGoogleBtnRendered && (
                <button
                  id="google-auth-btn"
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-2 rounded-lg border border-[#D5D2C7] bg-white text-[#171713] text-xs font-medium hover:bg-[#FAF9F5] transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </button>
              )}
            </div>

            <button
              id="try-demo-auth-btn"
              type="button"
              onClick={() => {
                onClose();
                onTryDemo();
              }}
              className="w-full py-2 rounded-lg border border-[#C49A3A]/40 bg-[#FAF9F5] text-[#8E6D24] text-xs font-semibold hover:bg-[#F3EEDF] transition flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C49A3A]" />
              Explore Demo Sandbox (Alex Rivera)
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-xs text-[#4F5D2F] hover:underline font-medium"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
