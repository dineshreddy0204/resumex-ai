import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export interface ValidatedGoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

export class GoogleAuthService {
  private client: OAuth2Client;
  private configuredClientId: string | undefined;

  constructor() {
    this.configuredClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    this.client = new OAuth2Client(this.configuredClientId);
  }

  /**
   * Cryptographically verifies Google ID Token via Google OIDC public keys,
   * validates issuer, audience, subject, expiration, and email_verified claims.
   */
  public async verifyIdToken(idToken: string): Promise<ValidatedGoogleUser> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google ID token is required and must be a valid string.');
    }

    const clientId = this.configuredClientId || process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;

    // 1. Verify cryptographic signature & get payload
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: clientId ? [clientId] : undefined,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      // In local dev sandbox without Google credentials, check for dev simulation
      if (process.env.NODE_ENV !== 'production' && !clientId) {
        console.warn('[GoogleAuth] VITE_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID not set. Parsing simulated payload for dev testing.');
        try {
          const parts = idToken.split('.');
          if (parts.length === 3) {
            payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
          }
        } catch {
          // Ignore
        }
      }

      if (!payload) {
        throw new Error(`Google ID token cryptographic verification failed: ${err?.message || 'Invalid signature'}`);
      }
    }

    if (!payload) {
      throw new Error('Google ID token contains no payload.');
    }

    // 2. Validate Issuer claim
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid token issuer: "${payload.iss}". Must be accounts.google.com.`);
    }

    // 3. Validate Audience claim
    if (clientId && payload.aud !== clientId) {
      throw new Error(`Token audience mismatch. Expected "${clientId}", received "${payload.aud}".`);
    }

    // 4. Validate Subject claim
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Google ID token is missing a valid subject ("sub") claim.');
    }

    // 5. Validate Email claim
    if (!payload.email || typeof payload.email !== 'string') {
      throw new Error('Google ID token is missing an email claim.');
    }

    // 6. Validate Email Verified claim
    if (payload.email_verified !== true) {
      throw new Error('Google account email is not verified by Google. Unverified Google emails cannot be accepted.');
    }

    // 7. Validate Expiration & Timestamps
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      throw new Error('Google ID token has expired. Please sign in again.');
    }
    if (payload.iat > nowSec + 300) {
      // 5 min clock skew tolerance
      throw new Error('Google ID token issued in the future (clock skew detected).');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || payload.email.split('@')[0] || 'Google User',
      picture: payload.picture,
      emailVerified: true,
    };
  }
}

export const googleAuthService = new GoogleAuthService();
