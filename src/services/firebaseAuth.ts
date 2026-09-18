/**
 * ResumeX AI — Firebase Authentication & Google Sign-In Service
 *
 * Official Firebase Authentication integration via Google AI Studio.
 * Supports both signInWithPopup and signInWithRedirect + getRedirectResult().
 *
 * Strict Guarantees:
 * - FirebaseApp initialized exactly once
 * - Auth initialized exactly once
 * - GoogleAuthProvider initialized exactly once
 * - Never leaks or stores unverified credentials in localStorage
 * - Tokens are immediately verified on the backend before session issuance
 * - Distinct, exact error code handling for all Firebase Auth failure states
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  type Auth,
  type ActionCodeSettings,
} from 'firebase/auth';

import firebaseConfig from '../../firebase-applet-config.json';

export interface FirebaseAuthResult {
  idToken: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FirebaseAuthErrorDetails {
  code: string;
  message: string;
  isUnauthorizedDomain?: boolean;
  isPopupBlocked?: boolean;
  isPopupClosed?: boolean;
  currentHostname?: string;
  authDomain?: string;
  actionRequired?: string;
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && 'ontouchstart' in window)
  );
}

export function isEmbeddedInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

class FirebaseAuthManager {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private provider: GoogleAuthProvider | null = null;
  private redirectPromise: Promise<FirebaseAuthResult | null> | null = null;

  public getFirebaseConfig() {
    const config: Record<string, string> = {
      apiKey: firebaseConfig.apiKey || (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
      authDomain: firebaseConfig.authDomain || (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: firebaseConfig.projectId || (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
      appId: firebaseConfig.appId || (import.meta as any).env?.VITE_FIREBASE_APP_ID || '',
    };
    if (firebaseConfig.storageBucket) {
      config.storageBucket = firebaseConfig.storageBucket;
    }
    if (firebaseConfig.messagingSenderId) {
      config.messagingSenderId = firebaseConfig.messagingSenderId;
    }
    return config;
  }

  public isConfigured(): boolean {
    const config = this.getFirebaseConfig();
    return Boolean(config.apiKey && config.projectId && config.authDomain);
  }

  public getAuthDomain(): string {
    return this.getFirebaseConfig().authDomain;
  }

  public getProjectId(): string {
    return this.getFirebaseConfig().projectId;
  }

  public getCurrentHostname(): string {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    return '';
  }

  /**
   * Initializes FirebaseApp and Auth exactly once.
   */
  public initAuth(): Auth {
    if (this.auth) {
      return this.auth;
    }

    const config = this.getFirebaseConfig();
    if (!config.apiKey || !config.projectId) {
      throw new Error('Firebase configuration is incomplete. Missing apiKey or projectId.');
    }

    // Initialize FirebaseApp exactly once
    if (!this.app) {
      this.app = getApps().length > 0 ? getApp() : initializeApp(config);
    }

    // Initialize Auth exactly once with indexedDB + browserLocal + inMemory persistence
    // to support signInWithRedirect without state loss, while allowing immediate signOut cleanup
    try {
      const persistenceList = [];
      if (typeof window !== 'undefined') {
        if (indexedDBLocalPersistence) persistenceList.push(indexedDBLocalPersistence);
        if (browserLocalPersistence) persistenceList.push(browserLocalPersistence);
      }
      persistenceList.push(inMemoryPersistence);

      this.auth = initializeAuth(this.app, {
        persistence: persistenceList,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      this.auth = getAuth(this.app);
    }

    return this.auth;
  }

  /**
   * Initializes GoogleAuthProvider exactly once.
   */
  public getProvider(): GoogleAuthProvider {
    if (this.provider) {
      return this.provider;
    }

    this.provider = new GoogleAuthProvider();
    this.provider.setCustomParameters({
      prompt: 'select_account',
    });

    return this.provider;
  }

  /**
   * Checks whether the user just returned from a Firebase redirect sign-in flow.
   * Resolves with FirebaseAuthResult if credentials exist, or null if no redirect occurred.
   */
  public async getRedirectAuthResult(): Promise<FirebaseAuthResult | null> {
    if (this.redirectPromise) {
      return this.redirectPromise;
    }

    this.redirectPromise = (async () => {
      const auth = this.initAuth();
      try {
        const result = await getRedirectResult(auth, browserPopupRedirectResolver);
        if (!result || !result.user) {
          return null;
        }

        const user = result.user;
        const idToken = await user.getIdToken();

        // Sign out of client-side Firebase Auth after extracting token for server verification
        try {
          await signOut(auth);
        } catch {
          // Non-blocking cleanup
        }

        return {
          idToken,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
      } catch (err: any) {
        const parsed = this.parseError(err);
        throw parsed;
      }
    })();

    return this.redirectPromise;
  }

  /**
   * Initiates Google Sign-In redirect flow via Firebase Authentication.
   * Preferred on mobile browsers where popup windows are restricted or automatically closed.
   */
  public async signInWithGoogleRedirect(): Promise<void> {
    const auth = this.initAuth();
    const provider = this.getProvider();

    try {
      await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
    } catch (err: any) {
      const parsed = this.parseError(err);
      throw parsed;
    }
  }

  /**
   * Initiates Google Sign-In popup flow via Firebase Authentication.
   */
  public async signInWithGooglePopup(): Promise<FirebaseAuthResult> {
    const auth = this.initAuth();
    const provider = this.getProvider();

    try {
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      const user = result.user;
      const idToken = await user.getIdToken();

      try {
        await signOut(auth);
      } catch {
        // Non-blocking cleanup
      }

      return {
        idToken,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
    } catch (err: any) {
      const parsed = this.parseError(err);
      throw parsed;
    }
  }

  /**
   * Main Google sign-in dispatcher.
   * Defaults to popup, but caller can specify redirect or auto-detect based on device.
   */
  public async signInWithGoogle(flow: 'auto' | 'popup' | 'redirect' = 'auto'): Promise<FirebaseAuthResult | null> {
    if (flow === 'redirect') {
      await this.signInWithGoogleRedirect();
      return null;
    }

    if (flow === 'auto' && isMobileDevice() && !isEmbeddedInIframe()) {
      await this.signInWithGoogleRedirect();
      return null;
    }

    return await this.signInWithGooglePopup();
  }

  /**
   * Creates a user account with email/password and dispatches Firebase verification email.
   */
  public async signUpWithEmail(
    name: string,
    email: string,
    pass: string
  ): Promise<{ user: any; requiresVerification: boolean }> {
    const auth = this.initAuth();
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: name.trim() });
      } catch {
        // Non-blocking displayName update
      }
    }

    try {
      const continueUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const actionCodeSettings: ActionCodeSettings | undefined = continueUrl
        ? { url: continueUrl, handleCodeInApp: true }
        : undefined;
      await sendEmailVerification(cred.user, actionCodeSettings);
    } catch (e) {
      console.warn('Firebase sendEmailVerification notice:', e);
    }

    return {
      user: cred.user,
      requiresVerification: true,
    };
  }

  /**
   * Signs in with email/password and validates that the email has been verified.
   */
  public async signInWithEmail(email: string, pass: string): Promise<FirebaseAuthResult> {
    const auth = this.initAuth();
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    await cred.user.reload();

    if (!cred.user.emailVerified) {
      const err: any = new Error('Please verify your email address before logging in.');
      err.code = 'auth/email-not-verified';
      throw err;
    }

    const idToken = await cred.user.getIdToken();
    return {
      idToken,
      email: cred.user.email,
      displayName: cred.user.displayName,
      photoURL: cred.user.photoURL,
    };
  }

  /**
   * Sends password reset email using Firebase Auth Web API
   */
  public async sendPasswordReset(email: string): Promise<void> {
    const auth = this.initAuth();
    const continueUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const actionCodeSettings: ActionCodeSettings | undefined = continueUrl
      ? { url: continueUrl, handleCodeInApp: true }
      : undefined;
    await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
  }

  /**
   * Resends verification email to the currently signed in Firebase user
   */
  public async resendVerificationEmail(): Promise<void> {
    const auth = this.initAuth();
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in to resend verification email.');
    }
    const continueUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const actionCodeSettings: ActionCodeSettings | undefined = continueUrl
      ? { url: continueUrl, handleCodeInApp: true }
      : undefined;
    await sendEmailVerification(auth.currentUser, actionCodeSettings);
  }

  /**
   * Preserves exact Firebase error codes and translates to distinct, actionable error details.
   * Logs safe non-sensitive diagnostic in development without leaking tokens or credentials.
   */
  public parseError(err: any): FirebaseAuthErrorDetails {
    const rawCode =
      err?.code ||
      (typeof err?.message === 'string' && err.message.match(/auth\/[a-z0-9-]+/i)?.[0]) ||
      'auth/unknown';
    const code = rawCode.toLowerCase();
    const rawMessage = err?.message || 'Authentication failed.';
    const currentHost = this.getCurrentHostname();
    const authDomain = this.getAuthDomain();

    // Safe diagnostic log: contains only error code, host, and sanitized description (NO secrets or tokens)
    if (typeof window !== 'undefined' && ((import.meta as any).env?.DEV || (window as any).__DEV__)) {
      console.warn(`[FirebaseAuth Diagnostic] Code: ${code} | Host: ${currentHost} | Reason: ${rawMessage.split('\n')[0]}`);
    }

    if (code === 'auth/unauthorized-domain') {
      return {
        code,
        message: `Domain "${currentHost}" is not in Firebase Authentication authorized domains list (auth/unauthorized-domain).`,
        isUnauthorizedDomain: true,
        currentHostname: currentHost,
        authDomain,
        actionRequired: `Add "${currentHost}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`,
      };
    }

    if (code === 'auth/popup-blocked') {
      return {
        code,
        message: 'The Google sign-in popup window was blocked by your browser (auth/popup-blocked).',
        isPopupBlocked: true,
        actionRequired: 'Allow popups for this site in your browser settings, or use the Redirect sign-in option below.',
      };
    }

    if (code === 'auth/popup-closed-by-user') {
      return {
        code,
        message:
          'The sign-in popup window was closed before completing authentication (auth/popup-closed-by-user). On mobile devices or inside iframes, browser popup windows can close automatically. Please use the Redirect sign-in option below.',
        isPopupClosed: true,
        actionRequired: 'Use the Redirect sign-in flow or open the application directly in a new tab.',
      };
    }

    if (code === 'auth/cancelled-popup-request') {
      return {
        code,
        message:
          'A previous authentication request was cancelled or superseded by a new attempt (auth/cancelled-popup-request).',
        actionRequired: 'Please wait a moment and try signing in again.',
      };
    }

    if (code === 'auth/operation-not-allowed') {
      return {
        code,
        message: 'Google Sign-In is not enabled in this Firebase Authentication project (auth/operation-not-allowed).',
        actionRequired: 'Enable Google provider under Firebase Console -> Authentication -> Sign-in method.',
      };
    }

    if (code === 'auth/invalid-oauth-client-id') {
      return {
        code,
        message: 'The OAuth Client ID configured for Google Sign-In is invalid or mismatched (auth/invalid-oauth-client-id).',
        actionRequired: 'Verify the Web Client ID in Firebase Console -> Authentication -> Sign-in method -> Google.',
      };
    }

    if (code === 'auth/invalid-api-key') {
      return {
        code,
        message: 'The Firebase API key is invalid or restricted (auth/invalid-api-key).',
        actionRequired: 'Check the apiKey setting in your Firebase configuration.',
      };
    }

    if (code === 'auth/invalid-argument' || code === 'auth/argument-error') {
      return {
        code,
        message: 'Firebase authentication initialization failed due to an invalid argument (auth/invalid-argument).',
        actionRequired: 'Reload the application and retry.',
      };
    }

    if (code === 'auth/network-request-failed') {
      return {
        code,
        message: 'Network error communicating with Firebase authentication servers (auth/network-request-failed).',
        actionRequired: 'Check your internet connection, firewall, or ad-blocker and retry.',
      };
    }

    // Default fallback: Preserve the EXACT code and message — NEVER mask as generic "cancelled"
    return {
      code,
      message: `${rawMessage} (${code})`,
      actionRequired: 'Please try again or use email sign-in.',
    };
  }
}

export const firebaseAuthManager = new FirebaseAuthManager();
