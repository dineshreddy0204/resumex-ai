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

    // Reject if Google Auth is not configured
    if (!clientId) {
      throw new Error('Google sign-in is not configured on this server. Please configure GOOGLE_CLIENT_ID in your environment settings.');
    }

    // 1. Verify cryptographic signature & get payload
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      throw new Error(`Google ID token cryptographic verification failed: ${err?.message || 'Invalid signature'}`);
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

/**
 * Mock Google Authentication Service for automated tests only.
 * Provides deterministic, isolated identities without bypassing production cryptographic verifiers.
 */
export class MockGoogleAuthService {
  private mockUser: ValidatedGoogleUser;

  constructor(customUser?: Partial<ValidatedGoogleUser>) {
    this.mockUser = {
      sub: customUser?.sub || 'mock-google-sub-12345',
      email: (customUser?.email || 'test.verified@example.com').toLowerCase().trim(),
      name: customUser?.name || 'Test Verified User',
      picture: customUser?.picture || 'https://lh3.googleusercontent.com/a/default',
      emailVerified: customUser?.emailVerified !== undefined ? customUser.emailVerified : true,
    };
  }

  public async verifyIdToken(idToken: string): Promise<ValidatedGoogleUser> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google ID token is required and must be a valid string.');
    }
    if (idToken === 'invalid' || idToken === 'not-a-valid-jwt-token') {
      throw new Error('Google ID token cryptographic verification failed: invalid token.');
    }
    return this.mockUser;
  }
}

