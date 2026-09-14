/**
 * ResumeX AI — Firebase Authentication & Google Sign-In Service
 *
 * Official Firebase Authentication integration via Google AI Studio.
 * Uses GoogleAuthProvider with signInWithPopup and inMemoryPersistence.
 * Strict Security Guarantees:
 * - Tokens are NEVER stored in localStorage or sessionStorage
 * - Server-side verification is mandatory before issuing ResumeX HttpOnly session cookies
 * - Clear diagnostics for unauthorized-domain and popup-blocked states
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
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
  currentHostname?: string;
  authDomain?: string;
  actionRequired?: string;
}

class FirebaseAuthManager {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private provider: GoogleAuthProvider | null = null;

  public getFirebaseConfig() {
    return {
      apiKey: firebaseConfig.apiKey || (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
      authDomain: firebaseConfig.authDomain || (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: firebaseConfig.projectId || (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
      appId: firebaseConfig.appId || (import.meta as any).env?.VITE_FIREBASE_APP_ID || '',
      storageBucket: firebaseConfig.storageBucket || '',
      messagingSenderId: firebaseConfig.messagingSenderId || '',
    };
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

  private initAuth(): Auth {
    if (this.auth) {
      return this.auth;
    }

    const config = this.getFirebaseConfig();
    if (!config.apiKey || !config.projectId) {
      throw new Error('Firebase configuration is incomplete. Missing apiKey or projectId.');
    }

    this.app = getApps().length > 0 ? getApp() : initializeApp(config);

    // Initialize with inMemoryPersistence to enforce zero localStorage/sessionStorage token leakage
    try {
      this.auth = initializeAuth(this.app, {
        persistence: inMemoryPersistence,
      });
    } catch {
      this.auth = getAuth(this.app);
    }

    this.provider = new GoogleAuthProvider();
    this.provider.setCustomParameters({
      prompt: 'select_account',
    });

    return this.auth;
  }

  /**
   * Initiates Google Sign-In popup flow via Firebase Authentication.
   * Obtains cryptographic ID token directly from Firebase User object.
   */
  public async signInWithGoogle(): Promise<FirebaseAuthResult> {
    const auth = this.initAuth();
    if (!this.provider) {
      this.provider = new GoogleAuthProvider();
      this.provider.setCustomParameters({
        prompt: 'select_account',
      });
    }

    try {
      const result = await signInWithPopup(auth, this.provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Clean up in-memory auth state after extracting token
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
      const parsedError = this.parseError(err);
      throw parsedError;
    }
  }

  public parseError(err: any): FirebaseAuthErrorDetails {
    const code = err?.code || 'auth/unknown';
    const rawMessage = err?.message || 'Authentication failed.';
    const currentHost = this.getCurrentHostname();
    const authDomain = this.getAuthDomain();

    if (code === 'auth/unauthorized-domain') {
      return {
        code,
        message: `This deployment domain (${currentHost}) is not in Firebase's Authorized Domains list.`,
        isUnauthorizedDomain: true,
        currentHostname: currentHost,
        authDomain,
        actionRequired: `Add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`,
      };
    }

    if (code === 'auth/popup-blocked') {
      return {
        code,
        message: 'The sign-in popup was blocked by your browser.',
        isPopupBlocked: true,
        actionRequired: 'Please allow popups for this site in your browser address bar and try again.',
      };
    }

    if (code === 'auth/popup-closed-by-user') {
      return {
        code,
        message: 'Sign-in cancelled: The Google authentication popup was closed before completing.',
      };
    }

    if (code === 'auth/cancelled-popup-request') {
      return {
        code,
        message: 'Another sign-in attempt is already in progress.',
      };
    }

    if (code === 'auth/network-request-failed') {
      return {
        code,
        message: 'Network connection failed. Please verify your internet connection and try again.',
      };
    }

    if (code === 'auth/operation-not-allowed') {
      return {
        code,
        message: 'Google Sign-In is not enabled in your Firebase Authentication project.',
        actionRequired: 'Enable Google under Firebase Console -> Authentication -> Sign-in method.',
      };
    }

    return {
      code,
      message: rawMessage,
    };
  }
}

export const firebaseAuthManager = new FirebaseAuthManager();
