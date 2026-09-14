/**
 * ResumeX AI — Google Identity Services (GIS) Frontend Integration Service
 * 
 * Manages Google Sign-In via Google Identity Services (gsi/client):
 * - Guarantees single-time initialization of google.accounts.id
 * - Manages popup authentication flow
 * - Intercepts and formats diagnostic origin errors (unregistered_origin / 401 invalid_client)
 * - Safely dispatches credential ID tokens directly to the backend without persistent client storage
 * - Never logs raw credentials or tokens
 */

export interface GoogleIdentityError {
  type: string;
  message: string;
  origin?: string;
  isOriginError?: boolean;
}

type SuccessCallback = (credential: string) => Promise<void>;
type ErrorCallback = (error: GoogleIdentityError) => void;

class GoogleIdentityManager {
  private isInitialized = false;
  private activeSuccessCallback: SuccessCallback | null = null;
  private activeErrorCallback: ErrorCallback | null = null;
  private isRenderingButton = false;

  /**
   * Retrieves the configured Google OAuth Web Client ID from Vite environment
   */
  public getGoogleClientId(): string {
    const id = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    return typeof id === 'string' ? id.trim() : '';
  }

  /**
   * Determines the current browser origin (scheme + host + port)
   */
  public getCurrentOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }

  /**
   * Checks if current connection protocol is secure
   */
  public isSecureOrigin(): boolean {
    if (typeof window === 'undefined') return false;
    const { protocol, hostname } = window.location;
    return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
  }

  /**
   * Checks if Google Identity Services SDK is loaded on window
   */
  public isScriptLoaded(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean((window as any).google?.accounts?.id)
    );
  }

  /**
   * Awaits Google Identity Services SDK readiness with timeout
   */
  public async waitForScript(timeoutMs = 4000): Promise<boolean> {
    if (this.isScriptLoaded()) return true;

    const start = Date.now();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.isScriptLoaded()) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Formats an origin error with actionable Google Cloud Console instructions
   */
  public createOriginErrorMessage(origin: string): string {
    return (
      `Google OAuth Origin Error (401: invalid_client / no registered origin):\n` +
      `The origin "${origin}" is not authorized in Google Cloud Console.\n` +
      `To resolve, add "${origin}" to "Authorized JavaScript origins" under your OAuth 2.0 Web Client ID.`
    );
  }

  /**
   * Initializes Google Identity Services once.
   * If already initialized, updates active callbacks.
   */
  public initialize(options: {
    onSuccess: SuccessCallback;
    onError: ErrorCallback;
  }): boolean {
    this.activeSuccessCallback = options.onSuccess;
    this.activeErrorCallback = options.onError;

    const clientId = this.getGoogleClientId();
    if (!clientId) {
      options.onError({
        type: 'missing_client_id',
        message:
          'Google Sign-In is not configured: VITE_GOOGLE_CLIENT_ID is missing from environment variables.',
      });
      return false;
    }

    if (!this.isSecureOrigin()) {
      options.onError({
        type: 'insecure_origin',
        message: 'Google Sign-In requires an HTTPS origin in production environments.',
        origin: this.getCurrentOrigin(),
      });
      return false;
    }

    if (!this.isScriptLoaded()) {
      // Script not loaded yet, caller can retry after waitForScript
      return false;
    }

    // Single-time initialization enforcement
    if (this.isInitialized) {
      return true;
    }

    try {
      const origin = this.getCurrentOrigin();

      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response || !response.credential) {
            this.activeErrorCallback?.({
              type: 'missing_credential',
              message: 'No credential was returned from Google Identity Services.',
            });
            return;
          }

          try {
            if (this.activeSuccessCallback) {
              await this.activeSuccessCallback(response.credential);
            }
          } catch (err: any) {
            this.activeErrorCallback?.({
              type: 'verification_failed',
              message: err?.message || 'Server verification of Google credential failed.',
            });
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        ux_mode: 'popup',
        error_callback: (error: any) => {
          const errType = error?.type || '';
          const errMsg = error?.message || '';

          if (
            errType === 'unregistered_origin' ||
            String(errType).includes('origin') ||
            String(errMsg).includes('origin')
          ) {
            this.activeErrorCallback?.({
              type: 'unregistered_origin',
              message: this.createOriginErrorMessage(origin),
              origin,
              isOriginError: true,
            });
          } else if (errType === 'popup_closed') {
            this.activeErrorCallback?.({
              type: 'popup_closed',
              message: 'Google Sign-In popup was closed before authentication completed.',
            });
          } else if (errType === 'popup_blocked_by_browser') {
            this.activeErrorCallback?.({
              type: 'popup_blocked',
              message: 'Google Sign-In popup was blocked by browser. Please allow popups for this site.',
            });
          } else if (errType === 'invalid_client') {
            this.activeErrorCallback?.({
              type: 'invalid_client',
              message:
                'Google OAuth Error: Invalid client ID. Ensure VITE_GOOGLE_CLIENT_ID matches your OAuth 2.0 Web Client ID in Google Cloud Console.',
            });
          } else {
            this.activeErrorCallback?.({
              type: errType || 'unknown_error',
              message: errMsg || 'Google authentication encountered an unexpected error.',
            });
          }
        },
      });

      this.isInitialized = true;
      return true;
    } catch (err: any) {
      options.onError({
        type: 'init_exception',
        message: err?.message || 'Failed to initialize Google Identity Services.',
      });
      return false;
    }
  }

  /**
   * Renders the official Google-styled Sign-In button into a DOM container element
   */
  public renderButton(
    container: HTMLElement,
    options?: {
      width?: number;
      text?: 'continue_with' | 'signin_with' | 'signup_with';
    }
  ): boolean {
    if (!this.isScriptLoaded() || !this.isInitialized) {
      return false;
    }

    if (this.isRenderingButton) {
      return true;
    }

    try {
      this.isRenderingButton = true;
      container.innerHTML = ''; // Clean existing contents

      const width = options?.width || Math.min(380, container.offsetWidth || 380);

      (window as any).google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: options?.text || 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
      });

      return true;
    } catch (err: any) {
      console.warn('[GoogleIdentityManager] renderButton failed:', err?.message);
      return false;
    } finally {
      this.isRenderingButton = false;
    }
  }

  /**
   * Prompts One Tap or triggers diagnostic notification inspection
   */
  public prompt(): void {
    if (!this.isScriptLoaded() || !this.isInitialized) {
      return;
    }

    try {
      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification?.isNotDisplayed?.()) {
          const reason = notification.getNotDisplayedReason?.();
          if (reason === 'unregistered_origin') {
            const origin = this.getCurrentOrigin();
            this.activeErrorCallback?.({
              type: 'unregistered_origin',
              message: this.createOriginErrorMessage(origin),
              origin,
              isOriginError: true,
            });
          }
        }
      });
    } catch (err: any) {
      console.warn('[GoogleIdentityManager] prompt failed:', err?.message);
    }
  }
}

export const googleIdentityManager = new GoogleIdentityManager();
