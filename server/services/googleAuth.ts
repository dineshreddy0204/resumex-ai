import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export interface ValidatedGoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

interface FirebasePublicKeysCache {
  keys: Record<string, string>;
  expiresAt: number;
}

export class GoogleAuthService {
  private client: OAuth2Client | null = null;
  private configuredClientId: string | undefined;
  private firebaseProjectId: string;
  private firebaseKeysCache: FirebasePublicKeysCache | null = null;

  constructor() {
    this.configuredClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    if (this.configuredClientId) {
      this.client = new OAuth2Client(this.configuredClientId);
    }
    this.firebaseProjectId = this.resolveFirebaseProjectId();
  }

  private resolveFirebaseProjectId(): string {
    if (process.env.FIREBASE_PROJECT_ID) {
      return process.env.FIREBASE_PROJECT_ID;
    }
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (parsed.projectId) {
          return parsed.projectId;
        }
      }
    } catch {
      // Fallback below
    }
    return 'massive-tracer-sds98';
  }

  private getClient(): OAuth2Client {
    const activeClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || this.configuredClientId;
    if (!this.client || this.configuredClientId !== activeClientId) {
      this.configuredClientId = activeClientId;
      this.client = new OAuth2Client(activeClientId);
    }
    return this.client;
  }

  /**
   * Fetches official Google Firebase public certificates for securetoken@system.gserviceaccount.com
   * with in-memory caching honoring HTTP Cache-Control headers.
   */
  private async getFirebasePublicKeys(forceRefresh = false): Promise<Record<string, string>> {
    const now = Date.now();
    if (!forceRefresh && this.firebaseKeysCache && this.firebaseKeysCache.expiresAt > now) {
      return this.firebaseKeysCache.keys;
    }

    try {
      const res = await fetch(
        'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch Google public keys: HTTP ${res.status}`);
      }

      const cacheControl = res.headers.get('cache-control') || '';
      const match = cacheControl.match(/max-age=(\d+)/);
      const maxAgeSec = match ? parseInt(match[1], 10) : 3600;

      const keys = (await res.json()) as Record<string, string>;
      this.firebaseKeysCache = {
        keys,
        expiresAt: now + maxAgeSec * 1000,
      };

      return keys;
    } catch (err: any) {
      if (this.firebaseKeysCache) {
        return this.firebaseKeysCache.keys;
      }
      throw new Error(`Unable to fetch Firebase verification public keys: ${err?.message || 'Network error'}`);
    }
  }

  /**
   * Cryptographically verifies a Firebase Authentication ID token.
   * Enforces RS256 signature verification against Google's public certificates,
   * matching project ID audience, issuer, expiration, and verified email.
   */
  public async verifyFirebaseIdToken(idToken: string): Promise<ValidatedGoogleUser> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed token: Must have 3 period-separated JWT segments.');
    }

    let header: { alg?: string; kid?: string; typ?: string };
    let payload: any;

    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    } catch {
      throw new Error('Failed to parse token headers or payload as valid JSON.');
    }

    if (header.alg !== 'RS256') {
      throw new Error(`Invalid token algorithm: "${header.alg}". Expected RS256.`);
    }

    if (!header.kid) {
      throw new Error('Token is missing "kid" (Key ID) header claim.');
    }

    const projectId = this.resolveFirebaseProjectId();
    const expectedIssuer = `https://securetoken.google.com/${projectId}`;

    if (payload.iss !== expectedIssuer) {
      throw new Error(`Invalid token issuer: "${payload.iss}". Expected "${expectedIssuer}".`);
    }

    if (payload.aud !== projectId) {
      throw new Error(`Token audience mismatch: "${payload.aud}". Expected project ID "${projectId}".`);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < nowSec) {
      throw new Error('Firebase ID token has expired. Please sign in again.');
    }

    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
      throw new Error('Firebase ID token issued in the future (clock skew detected).');
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Firebase ID token is missing a valid subject ("sub") claim.');
    }

    if (!payload.email || typeof payload.email !== 'string') {
      throw new Error('Firebase ID token is missing an email claim.');
    }

    if (payload.email_verified !== true) {
      throw new Error('Google account email is not verified by Google. Unverified Google emails cannot be accepted.');
    }

    // Cryptographic signature check against Google's public certificates
    let publicKeys = await this.getFirebasePublicKeys(false);
    let cert = publicKeys[header.kid];

    if (!cert) {
      // Key may have recently rotated; perform one forced refresh
      publicKeys = await this.getFirebasePublicKeys(true);
      cert = publicKeys[header.kid];
    }

    if (!cert) {
      throw new Error(`No matching Google public certificate found for Key ID: "${header.kid}".`);
    }

    const signedData = `${parts[0]}.${parts[1]}`;
    const signature = Buffer.from(parts[2], 'base64url');

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signedData);

    const isSignatureValid = verifier.verify(cert, signature);
    if (!isSignatureValid) {
      throw new Error('Firebase ID token cryptographic signature verification failed.');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase().trim(),
      name: payload.name || payload.email.split('@')[0] || 'Google User',
      picture: payload.picture,
      emailVerified: true,
    };
  }

  /**
   * Cryptographically verifies Google ID Token or Firebase ID token.
   * Auto-detects token issuer and performs rigorous signature and claim validation.
   */
  public async verifyIdToken(idToken: string): Promise<ValidatedGoogleUser> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google ID token is required and must be a valid string.');
    }

    // Inspect token segments
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Google ID token is not a valid 3-part JWT.');
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    } catch {
      throw new Error('Malformed token payload. Not valid JSON.');
    }

    // If token was issued by Firebase Authentication:
    if (typeof payload.iss === 'string' && payload.iss.startsWith('https://securetoken.google.com/')) {
      return this.verifyFirebaseIdToken(idToken);
    }

    // Otherwise, verify as standard Google OIDC ID token:
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || this.configuredClientId;
    if (!clientId) {
      throw new Error('Google sign-in is not configured on this server. Please configure GOOGLE_CLIENT_ID in your environment settings.');
    }

    const client = this.getClient();
    let verifiedPayload: TokenPayload | undefined;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      verifiedPayload = ticket.getPayload();
    } catch (err: any) {
      throw new Error(`Google ID token cryptographic verification failed: ${err?.message || 'Invalid signature'}`);
    }

    if (!verifiedPayload) {
      throw new Error('Google ID token contains no payload.');
    }

    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(verifiedPayload.iss)) {
      throw new Error(`Invalid token issuer: "${verifiedPayload.iss}". Must be accounts.google.com.`);
    }

    if (clientId && verifiedPayload.aud !== clientId) {
      throw new Error(`Token audience mismatch. Expected "${clientId}", received "${verifiedPayload.aud}".`);
    }

    if (!verifiedPayload.sub || typeof verifiedPayload.sub !== 'string') {
      throw new Error('Google ID token is missing a valid subject ("sub") claim.');
    }

    if (!verifiedPayload.email || typeof verifiedPayload.email !== 'string') {
      throw new Error('Google ID token is missing an email claim.');
    }

    if (verifiedPayload.email_verified !== true) {
      throw new Error('Google account email is not verified by Google. Unverified Google emails cannot be accepted.');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof verifiedPayload.exp !== 'number' || verifiedPayload.exp < nowSec) {
      throw new Error('Google ID token has expired. Please sign in again.');
    }
    if (typeof verifiedPayload.iat !== 'number' || verifiedPayload.iat > nowSec + 300) {
      throw new Error('Google ID token issued in the future (clock skew detected).');
    }

    return {
      sub: verifiedPayload.sub,
      email: verifiedPayload.email.toLowerCase().trim(),
      name: verifiedPayload.name || verifiedPayload.email.split('@')[0] || 'Google User',
      picture: verifiedPayload.picture,
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
      throw new Error('Google ID token cryptographic verification failed: Invalid token.');
    }
    return this.mockUser;
  }
}
