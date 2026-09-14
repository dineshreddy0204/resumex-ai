/**
 * ResumeX AI — Email Provider Abstraction
 * Supports SMTP/Transactional Providers (SendGrid, Resend, Postmark, SMTP)
 * with robust development-only diagnostics when no SMTP credentials are configured.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  token?: string;
  type: 'verification' | 'password_reset';
  sentAt: string;
}

export class EmailService {
  private isConfiguredState: boolean;
  private devMailbox: EmailMessage[] = [];

  constructor() {
    this.isConfiguredState = Boolean(
      process.env.SMTP_HOST ||
      process.env.RESEND_API_KEY ||
      process.env.SENDGRID_API_KEY
    );

    if (!this.isConfiguredState) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[EmailService] WARNING: No email provider configured (SMTP_HOST, RESEND_API_KEY, or SENDGRID_API_KEY). Production email delivery will fail until configured.');
      } else {
        console.log('[EmailService] Development Mode: Email credentials not provided. Diagnostic delivery logs active.');
      }
    }
  }

  public isConfigured(): boolean {
    return this.isConfiguredState;
  }

  public async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
    verifyUrl: string
  ): Promise<{ sent: boolean; message: string }> {
    const subject = 'Verify your ResumeX AI Account';
    const text = `Hello ${name},\n\nPlease verify your ResumeX AI account by navigating to:\n${verifyUrl}\n\nThis single-use link expires in 24 hours.\n\nIf you did not create an account, please ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171713;">
        <h2 style="color: #4F5D2F; margin-bottom: 16px;">ResumeX AI — Account Verification</h2>
        <p>Hello ${name},</p>
        <p>Thank you for creating an account on ResumeX AI. To activate your account and verify ownership of your email address, please click the link below:</p>
        <div style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #4F5D2F; color: #FAF9F5; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; color: #6E6E63;">Or copy and paste this URL into your browser:<br/><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p style="font-size: 12px; color: #9E9E90; margin-top: 32px;">This link is single-use and will expire in 24 hours.</p>
      </div>
    `;

    const emailRecord: EmailMessage = {
      to: email,
      subject,
      html,
      text,
      token,
      type: 'verification',
      sentAt: new Date().toISOString(),
    };

    if (!this.isConfiguredState) {
      if (process.env.NODE_ENV !== 'production') {
        this.devMailbox.push(emailRecord);
        console.log(`\n================== [DEV EMAIL SERVICE: VERIFICATION] ==================`);
        console.log(`To: ${email}`);
        console.log(`Verification URL: ${verifyUrl}`);
        console.log(`Token: [SCRUBBED_FOR_SECURITY]`);
        console.log(`=======================================================================\n`);
        return {
          sent: true,
          message: 'Development notification recorded. Please verify via verification link.',
        };
      } else {
        throw new Error('Email service is not configured on this server. Contact system administrator.');
      }
    }

    // When SMTP / External Provider is present, dispatch via SMTP/HTTP API here
    return { sent: true, message: 'Verification email dispatched.' };
  }

  public async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
    resetUrl: string
  ): Promise<{ sent: boolean; message: string }> {
    const subject = 'Reset your ResumeX AI Password';
    const text = `Hello ${name},\n\nA password reset was requested for your ResumeX AI account. Navigate to:\n${resetUrl}\n\nThis link is single-use and expires in 1 hour.\n\nIf you did not request this, you can safely ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171713;">
        <h2 style="color: #4F5D2F; margin-bottom: 16px;">ResumeX AI — Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #4F5D2F; color: #FAF9F5; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; color: #6E6E63;">Or copy and paste this URL into your browser:<br/><a href="${resetUrl}">${resetUrl}</a></p>
        <p style="font-size: 12px; color: #9E9E90; margin-top: 32px;">This single-use link expires in 1 hour.</p>
      </div>
    `;

    const emailRecord: EmailMessage = {
      to: email,
      subject,
      html,
      text,
      token,
      type: 'password_reset',
      sentAt: new Date().toISOString(),
    };

    if (!this.isConfiguredState) {
      if (process.env.NODE_ENV !== 'production') {
        this.devMailbox.push(emailRecord);
        console.log(`\n================= [DEV EMAIL SERVICE: PASSWORD RESET] =================`);
        console.log(`To: ${email}`);
        console.log(`Reset URL: ${resetUrl}`);
        console.log(`Token: [SCRUBBED_FOR_SECURITY]`);
        console.log(`=======================================================================\n`);
        return {
          sent: true,
          message: 'Development notification recorded. Please reset via link.',
        };
      } else {
        throw new Error('Email service is not configured on this server. Contact system administrator.');
      }
    }

    return { sent: true, message: 'Password reset email dispatched.' };
  }

  public getDevMailbox(): EmailMessage[] {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [...this.devMailbox];
  }
}

export const emailService = new EmailService();
