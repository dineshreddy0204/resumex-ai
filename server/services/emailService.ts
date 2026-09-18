/**
 * ResumeX AI Core Ultra — Enterprise Email Notification Service
 *
 * Provides nodemailer-based SMTP transport with fallback safety,
 * secure audit logging, category preference gating, and non-blocking delivery.
 *
 * Adheres strictly to security specifications:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM loaded from env vars
 * - No secrets or tokens ever logged
 * - Structured failure response if SMTP is unconfigured
 * - User notification preference checking
 */

import nodemailer, { type Transporter } from 'nodemailer';
import crypto from 'crypto';
import type { EmailNotificationPreferences } from '../types';

export type NotificationType =
  | 'resume_analysis_completed'
  | 'ai_optimization_completed'
  | 'optimization_applied'
  | 'job_match_completed'
  | 'security_session_alert'
  | 'account_notification'
  | 'verification'
  | 'password_reset';

export interface EmailDispatchResult {
  success: boolean;
  code: string;
  message: string;
  messageId?: string;
  skipped?: boolean;
}

export interface EmailAuditLog {
  id: string;
  notificationType: NotificationType;
  recipientMasked: string;
  recipientHash: string;
  timestamp: string;
  providerStatus: string;
  success: boolean;
  errorCode?: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfiguredState: boolean = false;
  private auditLogs: EmailAuditLog[] = [];
  private static MAX_LOGS = 100;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST?.trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && (user || port)) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user ? { user, pass: pass || '' } : undefined,
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        });
        this.isConfiguredState = true;
      } catch (err) {
        console.error('[EmailService] Failed to initialize SMTP transporter:', err instanceof Error ? err.message : err);
        this.isConfiguredState = false;
        this.transporter = null;
      }
    } else {
      this.isConfiguredState = false;
      this.transporter = null;
    }
  }

  public isConfigured(): boolean {
    // Re-check env in case runtime updated
    if (!this.isConfiguredState && process.env.SMTP_HOST) {
      this.initTransporter();
    }
    return this.isConfiguredState;
  }

  public getSmtpPublicConfig(): {
    configured: boolean;
    host?: string;
    port?: number;
    from?: string;
    secure?: boolean;
    message: string;
  } {
    const host = process.env.SMTP_HOST?.trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const from = process.env.SMTP_FROM?.trim() || 'ResumeX AI <noreply@resumex.ai>';
    const configured = this.isConfigured();

    return {
      configured,
      host: configured ? host : undefined,
      port: configured ? port : undefined,
      from: configured ? from : undefined,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      message: configured
        ? `SMTP server connected (${host}:${port})`
        : 'Email notifications are not configured.',
    };
  }

  /**
   * Safe recipient masking: "dineshreddy02a@gmail.com" -> "d***a@gmail.com"
   */
  public maskEmail(email: string): string {
    if (!email || !email.includes('@')) return 'unknown';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local.charAt(0)}*@${domain}`;
    }
    return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
  }

  /**
   * Cryptographic recipient hash for safe deduplication without storing plaintext
   */
  private hashRecipient(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 16);
  }

  /**
   * Audit logging for all email attempts without recording secrets, passwords, or tokens.
   */
  private logEmailAttempt(
    notificationType: NotificationType,
    recipient: string,
    success: boolean,
    providerStatus: string,
    errorCode?: string
  ): void {
    const entry: EmailAuditLog = {
      id: `mail-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      notificationType,
      recipientMasked: this.maskEmail(recipient),
      recipientHash: this.hashRecipient(recipient),
      timestamp: new Date().toISOString(),
      providerStatus,
      success,
      errorCode,
    };

    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > EmailService.MAX_LOGS) {
      this.auditLogs.pop();
    }

    // Diagnostic console output without leaking sensitive data
    console.log(
      `[EmailService:Audit] Type: ${entry.notificationType} | Recipient: ${entry.recipientMasked} | Success: ${entry.success} | Status: ${entry.providerStatus}${errorCode ? ` | Code: ${errorCode}` : ''}`
    );
  }

  public getAuditLogs(): EmailAuditLog[] {
    return [...this.auditLogs];
  }

  /**
   * Evaluates if a notification category is allowed by user preferences.
   */
  public isCategoryAllowed(
    notificationType: NotificationType,
    preferences?: EmailNotificationPreferences | null
  ): boolean {
    // If no preferences specified, default to true
    if (!preferences) return true;

    // Master switch
    if (!preferences.enabled) {
      // Security-critical notifications remain enabled independently
      if (notificationType === 'security_session_alert' || notificationType === 'verification' || notificationType === 'password_reset') {
        return preferences.categories?.accountSecurity !== false;
      }
      return false;
    }

    switch (notificationType) {
      case 'security_session_alert':
      case 'account_notification':
      case 'verification':
      case 'password_reset':
        return preferences.categories?.accountSecurity ?? true;
      case 'resume_analysis_completed':
        return preferences.categories?.resumeAnalysis ?? true;
      case 'ai_optimization_completed':
      case 'optimization_applied':
        return preferences.categories?.aiOptimization ?? true;
      case 'job_match_completed':
        return preferences.categories?.jobMatching ?? true;
      default:
        return true;
    }
  }

  /**
   * Send custom ResumeX transactional email notification via SMTP
   */
  public async sendNotification(params: {
    to: string;
    notificationType: NotificationType;
    subject: string;
    html: string;
    text: string;
    preferences?: EmailNotificationPreferences | null;
  }): Promise<EmailDispatchResult> {
    const { to, notificationType, subject, html, text, preferences } = params;

    // 1. Preference check
    if (!this.isCategoryAllowed(notificationType, preferences)) {
      this.logEmailAttempt(notificationType, to, true, 'SKIPPED_USER_PREFERENCE');
      return {
        success: true,
        code: 'NOTIFICATION_SKIPPED',
        message: 'Notification skipped per user preference settings.',
        skipped: true,
      };
    }

    // 2. SMTP configuration check
    if (!this.isConfigured() || !this.transporter) {
      this.logEmailAttempt(notificationType, to, false, 'UNCONFIGURED', 'EMAIL_NOT_CONFIGURED');
      return {
        success: false,
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'Email notifications are not configured.',
      };
    }

    // 3. Dispatch via nodemailer
    const from = process.env.SMTP_FROM?.trim() || 'ResumeX AI Core Ultra <noreply@resumex.ai>';
    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      this.logEmailAttempt(notificationType, to, true, `SENT: ${info.response || 'OK'}`);
      return {
        success: true,
        code: 'EMAIL_SENT',
        message: 'Email notification sent successfully.',
        messageId: info.messageId,
      };
    } catch (err: any) {
      const errorCode = err?.code || 'SMTP_DISPATCH_FAILED';
      const errorMsg = err instanceof Error ? err.message : 'SMTP dispatch failed.';
      this.logEmailAttempt(notificationType, to, false, `ERROR: ${errorMsg}`, errorCode);

      return {
        success: false,
        code: errorCode,
        message: `Failed to deliver email: ${errorMsg}`,
      };
    }
  }

  /**
   * Pre-built notification: Resume Optimization Applied
   */
  public async sendOptimizationAppliedNotification(
    userEmail: string,
    userName: string,
    resumeTitle: string,
    section: string,
    detail: string,
    preferences?: EmailNotificationPreferences | null
  ): Promise<EmailDispatchResult> {
    const subject = `Resume Optimization Applied: "${resumeTitle}" — ResumeX AI`;
    const text = `Hello ${userName},\n\nYour resume "${resumeTitle}" was successfully updated with an AI optimization for the "${section}" section.\n\nSummary of change: ${detail}\n\nYou can review your updated resume at any time in ResumeX AI Core Ultra.\n\nBest regards,\nResumeX AI Team`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171713; background-color: #FAF9F5; border: 1px solid #EAE8E1; border-radius: 12px;">
        <div style="border-bottom: 2px solid #4F5D2F; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #171713; margin: 0; font-size: 20px;">ResumeX AI — Optimization Applied</h2>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #3E3E38;">
          Your resume <strong>"${resumeTitle}"</strong> was just updated with a verified optimization targeting the <strong>${section}</strong> section.
        </p>
        <div style="background-color: #FFFFFF; border: 1px solid #D5D2C7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #4F5D2F; margin-bottom: 6px;">
            Applied Optimization
          </div>
          <div style="font-size: 13px; color: #171713; line-height: 1.5;">
            ${detail}
          </div>
        </div>
        <p style="font-size: 13px; color: #6E6E63; margin-top: 24px; line-height: 1.5;">
          This optimization was validated against candidate records under ResumeTruth zero-fabrication rules.
        </p>
        <div style="border-top: 1px solid #EAE8E1; margin-top: 28px; padding-top: 16px; font-size: 11px; color: #9E9E90;">
          You received this message because email notifications are enabled for your ResumeX AI account. Manage preferences in Settings.
        </div>
      </div>
    `;

    return this.sendNotification({
      to: userEmail,
      notificationType: 'optimization_applied',
      subject,
      html,
      text,
      preferences,
    });
  }

  /**
   * Pre-built notification: Resume ATS Analysis Completed
   */
  public async sendAnalysisCompletedNotification(
    userEmail: string,
    userName: string,
    resumeTitle: string,
    overallScore: number,
    preferences?: EmailNotificationPreferences | null
  ): Promise<EmailDispatchResult> {
    const subject = `ATS Analysis Ready: "${resumeTitle}" scored ${overallScore}/100 — ResumeX AI`;
    const text = `Hello ${userName},\n\nYour ATS simulation and scoring analysis for "${resumeTitle}" is complete.\n\nOverall Score: ${overallScore}/100.\n\nLog in to ResumeX AI Core Ultra to view your full breakdown.\n\nBest regards,\nResumeX AI Team`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #171713; background-color: #FAF9F5; border: 1px solid #EAE8E1; border-radius: 12px;">
        <h2 style="color: #171713; margin: 0 0 16px 0;">ResumeX AI — Analysis Report</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>The 5-engine ATS audit and heuristic simulation for <strong>"${resumeTitle}"</strong> has finished.</p>
        <div style="background-color: #FFFFFF; border: 1px solid #D5D2C7; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center;">
          <div style="font-size: 12px; color: #6E6E63; text-transform: uppercase;">Composite ATS Score</div>
          <div style="font-size: 36px; font-weight: 800; color: #4F5D2F; margin: 8px 0;">${overallScore}<span style="font-size: 18px; color: #6E6E63;">/100</span></div>
        </div>
        <p style="font-size: 12px; color: #9E9E90;">ResumeX AI Core Ultra Automated Notification.</p>
      </div>
    `;

    return this.sendNotification({
      to: userEmail,
      notificationType: 'resume_analysis_completed',
      subject,
      html,
      text,
      preferences,
    });
  }

  /**
   * Backward-compatible verification email for non-Firebase environments
   */
  public async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
    verifyUrl: string
  ): Promise<{ sent: boolean; message: string }> {
    const result = await this.sendNotification({
      to: email,
      notificationType: 'verification',
      subject: 'Verify your ResumeX AI Account',
      text: `Hello ${name},\n\nPlease verify your account: ${verifyUrl}\n\nToken: [SCRUBBED]`,
      html: `<p>Hello ${name},</p><p><a href="${verifyUrl}">Click here to verify your ResumeX AI account</a></p>`,
    });

    return {
      sent: result.success,
      message: result.message,
    };
  }

  /**
   * Backward-compatible password reset email for non-Firebase environments
   */
  public async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
    resetUrl: string
  ): Promise<{ sent: boolean; message: string }> {
    const result = await this.sendNotification({
      to: email,
      notificationType: 'password_reset',
      subject: 'Reset your ResumeX AI Password',
      text: `Hello ${name},\n\nReset your password: ${resetUrl}`,
      html: `<p>Hello ${name},</p><p><a href="${resetUrl}">Click here to reset your password</a></p>`,
    });

    return {
      sent: result.success,
      message: result.message,
    };
  }

  /**
   * Safe dev-only diagnostics inspection of recent audit logs
   */
  public getDevMailbox(): EmailAuditLog[] {
    return this.auditLogs;
  }
}

export const emailService = new EmailService();
