import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool, type PoolClient } from 'pg';
import { hashPassword, verifyPassword } from './auth';
import type {
  User,
  UserProfile,
  ResumeData,
  ResumeVersion,
  JobDescriptionModel,
  JobMatchResult,
  ResumeScoreBreakdown,
  AnalysisIssue,
  AuditEvent,
  CareerGapAnalysis,
} from './types';

export interface StoredResume {
  id: string;
  userId: string;
  profileId: string;
  title: string;
  rawText?: string;
  fileType?: string;
  fileName?: string;
  data: ResumeData;
  score?: ResumeScoreBreakdown;
  atsScore?: number;
  templateId: string;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export class DatabaseEngine {
  private pgPool: Pool;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: DATABASE_URL environment variable is required in production.');
      }
      console.warn('[Database] WARNING: DATABASE_URL is not set. Database operations will require DATABASE_URL.');
    }

    this.pgPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });

    this.pgPool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected error on idle client:', err);
    });

    // Graceful shutdown
    const cleanup = async () => {
      try {
        await this.pgPool.end();
        console.log('[PostgreSQL] Pool has successfully drained.');
      } catch (err) {
        console.error('[PostgreSQL] Error closing pool:', err);
      }
    };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    // Trigger schema bootstrap
    this.ensureInitialized().catch((err) => {
      console.error('[Database] Bootstrap error:', err);
    });
  }

  public getPool(): Pool {
    return this.pgPool;
  }

  /**
   * Automatically bootstrap schema & default seed data into PostgreSQL
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const client = await this.pgPool.connect();
      try {
        // 1. Run schema DDL if tables missing
        const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const sql = fs.readFileSync(schemaPath, 'utf-8');
          await client.query(sql);
        }

        // 2. Ensure column migrations and compatibility tables
        await client.query('ALTER TABLE resumes ADD COLUMN IF NOT EXISTS data_json JSONB;');
        await client.query('ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS seniority_level VARCHAR(64) DEFAULT \'Mid\';');
        await client.query('ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS location VARCHAR(255);');
        await client.query('ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS education_required BOOLEAN DEFAULT TRUE;');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;');
        await client.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;');

        // Ensure audit_logs exists alongside audit_events
        await client.query(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(128) NOT NULL,
            entity_type VARCHAR(64),
            entity_id VARCHAR(64),
            resource_type VARCHAR(64),
            resource_id VARCHAR(64),
            details_json JSONB,
            ip_address VARCHAR(64),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Ensure session and token security tables exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            ip_address VARCHAR(64),
            user_agent TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            is_revoked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
          CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

          CREATE TABLE IF NOT EXISTS oauth_accounts (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(32) NOT NULL,
            provider_user_id VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            profile_json JSONB,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(provider, provider_user_id)
          );
          CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_pw_reset_token_hash ON password_reset_tokens(token_hash);

          CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_email_verify_token_hash ON email_verification_tokens(token_hash);
        `);

        // 3. Ensure demo account exists in PostgreSQL
        await this.seedDemoUser(client);

        this.isInitialized = true;
        console.log('[PostgreSQL] Database persistence layer fully initialized.');
      } finally {
        client.release();
      }
    })();

    return this.initPromise;
  }

  private async seedDemoUser(client: PoolClient): Promise<void> {
    const demoEmail = 'alex.rivera.demo@resumex.ai';
    // Check if demo user already exists, but continue to ensure child resources (jobs, matches, audit) are present
    const demoUserId = 'demo-user-101';
    const demoPasswordHash = await hashPassword('DemoPass2026!');
    const now = new Date().toISOString();

    // 1. Create demo user
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, email_verified, is_demo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $5)
       ON CONFLICT (email) DO NOTHING`,
      [demoUserId, 'Alex Rivera (Demo)', demoEmail, demoPasswordHash, now]
    );

    // 2. Create demo profile
    const demoProfileId = 'demo-profile-1';
    await client.query(
      `INSERT INTO profiles (id, user_id, title, target_role, years_of_experience, location, bio, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        demoProfileId,
        demoUserId,
        'Senior Full-Stack Engineer',
        'Staff Software Engineer',
        6,
        'San Francisco, CA',
        'Experienced engineer specializing in distributed systems and modern web applications.',
        now,
      ]
    );

    // 3. Create demo resume
    const demoResumeId = 'demo-resume-1';
    const demoVersionId = 'demo-version-1';
    const demoResumeData: ResumeData = {
      personal_info: {
        name: 'Alex Rivera',
        email: 'alex.rivera.dev@gmail.com',
        phone: '+1 (415) 890-2341',
        location: 'San Francisco, CA',
        linkedin: 'https://linkedin.com/in/alexrivera-cloud',
        github: 'https://github.com/alexrivera-tech',
      },
      summary:
        'Performance-driven Senior Full-Stack Engineer with 6+ years of experience architecting distributed microservices, scalable React/TypeScript web apps, and resilient event-driven systems on AWS. Champion of clean code, automated CI/CD pipelines, and high-throughput real-time data flows.',
      skills: [
        {
          category: 'Languages & Core',
          items: ['TypeScript', 'JavaScript (ESNext)', 'Python', 'Go', 'SQL', 'HTML5/CSS3'],
        },
        {
          category: 'Frontend Architecture',
          items: ['React', 'Next.js', 'Redux Toolkit', 'Tailwind CSS', 'Vite', 'GraphQL', 'WebSockets'],
        },
        {
          category: 'Backend & Cloud Infrastructure',
          items: ['Node.js', 'Express', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS (Lambda, ECS, S3, RDS)'],
        },
        {
          category: 'DevOps, Testing & Tooling',
          items: ['CI/CD (GitHub Actions)', 'Terraform', 'Jest', 'Cypress', 'Git', 'Agile/Scrum'],
        },
      ],
      experience: [
        {
          id: 'exp-1',
          company: 'HyperScale Networks',
          role: 'Senior Full-Stack Engineer',
          location: 'San Francisco, CA',
          startDate: '2022-03',
          endDate: 'Present',
          current: true,
          bullets: [
            'Architected distributed event-driven microservices processing 45,000 requests/sec with Node.js, Go, and Kafka, slashing API p99 latency by 38%.',
            'Led frontend modernization migrating legacy monolith to React 18 and Next.js, elevating Lighthouse performance scores from 54 to 96.',
            'Engineered real-time telemetry dashboard using WebSockets and Redis Pub/Sub, cutting customer incident response time by 42%.',
            'Mentored 6 junior engineers and spearheaded automated testing standards, driving unit and end-to-end code coverage to 91%.',
          ],
          technologies: ['TypeScript', 'React', 'Go', 'Node.js', 'Kafka', 'Redis', 'AWS'],
        },
        {
          id: 'exp-2',
          company: 'Apex Data Systems',
          role: 'Full-Stack Software Engineer',
          location: 'San Jose, CA',
          startDate: '2019-06',
          endDate: '2022-02',
          current: false,
          bullets: [
            'Designed and built multi-tenant SaaS analytics platform utilizing React, Express, PostgreSQL, and AWS ECS serving 120,000 active users.',
            'Optimized complex relational SQL queries and indexed database tables, reducing median dashboard query latency from 3.2s to 180ms.',
            'Configured robust CI/CD deployment pipelines using GitHub Actions and Docker, reducing release cycle duration from 4 days to 35 minutes.',
          ],
          technologies: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
        },
      ],
      projects: [
        {
          id: 'proj-1',
          title: 'CloudMesh — Distributed Observability Engine',
          role: 'Creator & Lead Developer',
          technologies: ['Go', 'TypeScript', 'React', 'eBPF', 'Docker'],
          link: 'https://github.com/alexrivera-tech/cloudmesh',
          bullets: [
            'Developed open-source zero-instrumentation network topology monitor adopted by 1,400+ GitHub stars and 200+ active enterprise deployments.',
            'Constructed low-overhead kernel event interceptor delivering under 1.2% CPU utilization overhead under peak network saturation.',
          ],
        },
      ],
      education: [
        {
          id: 'edu-1',
          institution: 'University of California, Berkeley',
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          startDate: '2015',
          endDate: '2019',
          gpa: '3.82',
        },
      ],
      certifications: [
        {
          id: 'cert-1',
          name: 'AWS Certified Solutions Architect – Associate',
          issuer: 'Amazon Web Services',
          date: '2023',
          issueDate: '2023',
        },
      ],
      achievements: [
        {
          id: 'ach-1',
          title: 'Engineering Excellence Award',
          description: 'Recognized for highest infrastructure stability achievement and zero-downtime database migration at HyperScale Networks.',
          date: '2023',
          metric: 'Zero Downtime',
        },
      ],
    };

    const initialScore: ResumeScoreBreakdown = {
      overall: 88,
      contentQuality: 89,
      atsCompatibility: 91,
      skillsScore: 92,
      experienceScore: 89,
      projectsScore: 86,
      achievementsScore: 85,
      grammarScore: 94,
      formattingScore: 92,
      readabilityScore: 90,
      deductions: [],
    };

    // Insert demo resume
    await client.query(
      `INSERT INTO resumes (id, user_id, profile_id, title, raw_text, file_type, file_name, template_id, current_version_id, ats_score, score_json, data_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        demoResumeId,
        demoUserId,
        demoProfileId,
        'Staff Full-Stack Engineer — Production Resume',
        'Alex Rivera - Senior Full-Stack Engineer...',
        'application/json',
        'Alex_Rivera_Resume.pdf',
        'ats-classic',
        demoVersionId,
        91,
        JSON.stringify(initialScore),
        JSON.stringify(demoResumeData),
        now,
      ]
    );

    // Insert demo version
    await client.query(
      `INSERT INTO resume_versions (id, resume_id, user_id, version_name, resume_data_json, score_json, ats_score, change_summary, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        demoVersionId,
        demoResumeId,
        demoUserId,
        'v1.0 — Initial Verified Master',
        JSON.stringify(demoResumeData),
        JSON.stringify(initialScore),
        91,
        'Initial verified master resume.',
        now,
      ]
    );

    // Normalize relational tables for demo resume
    await this.syncNormalizedTables(client, demoResumeId, demoResumeData);

    // 4. Insert sample target job description for demo user
    const demoJobId = 'demo-job-1';
    await client.query(
      `INSERT INTO job_descriptions (id, user_id, title, company, location, raw_text, required_skills_json, preferred_skills_json, domain_keywords_json, responsibilities_json, experience_years_required, seniority_level, education_required, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        demoJobId,
        demoUserId,
        'Staff Cloud & Distributed Systems Engineer',
        'Stripe',
        'San Francisco, CA (Hybrid)',
        'Stripe is seeking a Staff Cloud & Distributed Systems Engineer to lead the architecture of high-throughput payment settlement microservices processing millions of financial events daily. Requirements: 5+ years of experience with TypeScript, Go, PostgreSQL, Distributed Systems, Kubernetes, AWS, and Kafka.',
        JSON.stringify(['TypeScript', 'Go', 'PostgreSQL', 'Distributed Systems', 'Kubernetes', 'AWS', 'Kafka']),
        JSON.stringify(['Redis', 'Docker', 'GraphQL', 'CI/CD']),
        JSON.stringify(['microservices', 'settlement', 'distributed', 'high-throughput', 'slas', 'latency']),
        JSON.stringify([
          'Architect high-throughput payment settlement microservices processing millions of financial events.',
          'Scale distributed relational and event stores to handle 99.999% uptime SLAs.',
          'Lead technical design reviews and mentor senior engineering personnel across teams.',
        ]),
        5,
        'Senior',
        now,
      ]
    );

    // 5. Seed audit trail entry (both audit_events and audit_logs)
    await client.query(
      `INSERT INTO audit_events (id, user_id, action, resource_type, resource_id, details_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        'audit-init-1',
        demoUserId,
        'USER_INITIALIZED',
        'user',
        demoUserId,
        JSON.stringify({ note: 'Demo environment provisioned with verified resume and target role.' }),
        now,
      ]
    );

    await client.query(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, resource_type, resource_id, details_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        'audit-init-1',
        demoUserId,
        'USER_INITIALIZED',
        'user',
        demoUserId,
        'user',
        demoUserId,
        JSON.stringify({ note: 'Demo environment provisioned with verified resume and target role.' }),
        now,
      ]
    );
  }

  /**
   * Decomposes structured ResumeData into normalized PostgreSQL tables:
   * resume_sections, skills, experiences, projects, education, certifications, achievements
   */
  private async syncNormalizedTables(client: PoolClient, resumeId: string, data: ResumeData): Promise<void> {
    // 1. Clear old child rows for this resume
    await client.query('DELETE FROM resume_sections WHERE resume_id = $1', [resumeId]);
    await client.query('DELETE FROM skills WHERE resume_id = $1', [resumeId]);
    await client.query('DELETE FROM experiences WHERE resume_id = $1', [resumeId]);
    await client.query('DELETE FROM projects WHERE resume_id = $1', [resumeId]);
    await client.query('DELETE FROM education WHERE resume_id = $1', [resumeId]);
    await client.query('DELETE FROM certifications WHERE resume_id = $1', [resumeId]);
    await client.query('DELETE FROM achievements WHERE resume_id = $1', [resumeId]);

    // 2. Sections
    const sections = [
      { type: 'personal_info', title: 'Contact Information', order: 0, content: data.personal_info },
      { type: 'summary', title: 'Professional Summary', order: 1, content: { summary: data.summary } },
      { type: 'skills', title: 'Technical Skills', order: 2, content: data.skills },
      { type: 'experience', title: 'Work Experience', order: 3, content: data.experience },
      { type: 'projects', title: 'Key Projects', order: 4, content: data.projects },
      { type: 'education', title: 'Education', order: 5, content: data.education },
      { type: 'certifications', title: 'Certifications', order: 6, content: data.certifications },
      { type: 'achievements', title: 'Achievements', order: 7, content: data.achievements },
    ];

    for (const sec of sections) {
      await client.query(
        `INSERT INTO resume_sections (id, resume_id, section_type, display_title, order_index, is_visible, content_json)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
        [crypto.randomUUID(), resumeId, sec.type, sec.title, sec.order, JSON.stringify(sec.content)]
      );
    }

    // 3. Skills
    for (const group of data.skills || []) {
      for (const item of group.items || []) {
        await client.query(
          `INSERT INTO skills (id, resume_id, category, name, proficiency, confidence)
           VALUES ($1, $2, $3, $4, 'Proficient', 1.0)`,
          [crypto.randomUUID(), resumeId, group.category || 'General', item]
        );
      }
    }

    // 4. Experiences
    for (const exp of data.experience || []) {
      await client.query(
        `INSERT INTO experiences (id, resume_id, company, role, location, start_date, end_date, is_current, bullets_json, technologies_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          crypto.randomUUID(),
          resumeId,
          exp.company || 'Unknown',
          exp.role || 'Contributor',
          exp.location || '',
          exp.startDate || '',
          exp.endDate || '',
          Boolean(exp.current),
          JSON.stringify(exp.bullets || []),
          JSON.stringify(exp.technologies || []),
        ]
      );
    }

    // 5. Projects
    for (const proj of data.projects || []) {
      await client.query(
        `INSERT INTO projects (id, resume_id, title, role, link, bullets_json, technologies_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          crypto.randomUUID(),
          resumeId,
          proj.title || 'Project',
          proj.role || '',
          proj.link || '',
          JSON.stringify(proj.bullets || []),
          JSON.stringify(proj.technologies || []),
        ]
      );
    }

    // 6. Education
    for (const edu of data.education || []) {
      await client.query(
        `INSERT INTO education (id, resume_id, institution, degree, field_of_study, start_date, end_date, gpa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          resumeId,
          edu.institution || '',
          edu.degree || '',
          edu.field || '',
          edu.startDate || '',
          edu.endDate || '',
          edu.gpa || '',
        ]
      );
    }

    // 7. Certifications
    for (const cert of data.certifications || []) {
      await client.query(
        `INSERT INTO certifications (id, resume_id, name, issuer, issue_date, link)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), resumeId, cert.name || '', cert.issuer || '', cert.issueDate || '', cert.link || '']
      );
    }

    // 8. Achievements
    for (const ach of data.achievements || []) {
      await client.query(
        `INSERT INTO achievements (id, resume_id, title, description, date, metric)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), resumeId, ach.title || '', ach.description || '', ach.date || '', ach.metric || '']
      );
    }
  }

  // --- PASSWORD & CRYPTO UTILITIES ---
  public async hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }

  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return verifyPassword(password, hash);
  }

  // --- AUDIT LOGGING ---
  public async logAudit(
    userId: string | null,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.ensureInitialized();
    const eventId = crypto.randomUUID();
    const detailsJson = details ? JSON.stringify(details) : null;
    try {
      await this.pgPool.query(
        `INSERT INTO audit_events (id, user_id, action, resource_type, resource_id, details_json, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [eventId, userId, action, resourceType, resourceId || null, detailsJson, ipAddress || null]
      );
      await this.pgPool.query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, resource_type, resource_id, details_json, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [eventId, userId, action, resourceType, resourceId || null, resourceType, resourceId || null, detailsJson, ipAddress || null]
      );
    } catch (err) {
      console.error('[Audit] Failed to record audit event:', err);
    }
  }

  public async getAuditEvents(userId: string): Promise<AuditEvent[]> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, user_id as "userId", action, resource_type as "resourceType", resource_id as "resourceId", details_json as details, created_at as timestamp
       FROM audit_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [userId]
    );
    return res.rows;
  }

  // --- USER MANAGEMENT & SECURITY ---
  public async createUser(
    name: string,
    email: string,
    password: string
  ): Promise<{ user: User; verificationToken: string }> {
    await this.ensureInitialized();
    const cleanEmail = email.toLowerCase().trim();

    const existing = await this.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    // Cryptographically secure token (single-use, stored as SHA-256 hash, expires in 24 hours)
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const passwordHash = await this.hashPassword(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert user
      const userRes = await client.query(
        `INSERT INTO users (id, name, email, password_hash, email_verified, verification_token, verification_token_expires_at, is_demo, created_at, updated_at)
         VALUES ($1, $2, $3, $4, FALSE, $5, $6, FALSE, $7, $7)
         RETURNING id, name, email, password_hash as "passwordHash", email_verified as "emailVerified", is_demo as "isDemo", created_at as "createdAt"`,
        [userId, name, cleanEmail, passwordHash, hashedToken, expiresAt, now]
      );

      // 2. Insert neutral profile defaults (Requirement 7: Neutral defaults, never fabricated)
      const profileId = crypto.randomUUID();
      await client.query(
        `INSERT INTO profiles (id, user_id, title, target_role, years_of_experience, location, created_at, updated_at)
         VALUES ($1, $2, 'Professional Profile', '', 0, '', $3, $3)`,
        [profileId, userId, now]
      );

      await client.query('COMMIT');

      const user = userRes.rows[0];
      await this.logAudit(user.id, 'USER_SIGNUP', 'User', user.id, { email: cleanEmail });

      return { user, verificationToken: rawVerificationToken };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async verifyEmailToken(rawToken: string): Promise<User> {
    await this.ensureInitialized();
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date().toISOString();

    const res = await this.pgPool.query(
      `SELECT id, name, email, password_hash as "passwordHash", email_verified as "emailVerified", verification_token_expires_at as "expiresAt", is_demo as "isDemo"
       FROM users WHERE verification_token = $1`,
      [hashedToken]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid or already used verification token.');
    }

    const userRow = res.rows[0];
    if (userRow.expiresAt && new Date(userRow.expiresAt).getTime() < Date.now()) {
      throw new Error('Verification token has expired. Please request a new verification email.');
    }

    await this.pgPool.query(
      `UPDATE users
       SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userRow.id]
    );

    await this.logAudit(userRow.id, 'EMAIL_VERIFIED', 'User', userRow.id);

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      passwordHash: userRow.passwordHash,
      emailVerified: true,
      isDemo: userRow.isDemo,
      createdAt: now,
    };
  }

  public async createPasswordResetToken(email: string): Promise<{ resetToken: string; expiresAt: string } | null> {
    await this.ensureInitialized();
    const cleanEmail = email.toLowerCase().trim();
    const user = await this.getUserByEmail(cleanEmail);
    if (!user) {
      // Do not reveal whether user exists
      return null;
    }

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await this.pgPool.query(
      `UPDATE users
       SET reset_token = $1, reset_token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [hashedToken, expiresAt, user.id]
    );

    await this.logAudit(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id);

    return { resetToken: rawResetToken, expiresAt };
  }

  public async resetPasswordWithToken(rawToken: string, newPassword: string): Promise<User> {
    await this.ensureInitialized();
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const res = await this.pgPool.query(
      `SELECT id, name, email, reset_token_expires_at as "expiresAt", is_demo as "isDemo"
       FROM users WHERE reset_token = $1`,
      [hashedToken]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid or expired password reset token.');
    }

    const userRow = res.rows[0];
    if (userRow.expiresAt && new Date(userRow.expiresAt).getTime() < Date.now()) {
      throw new Error('Password reset token has expired. Please request a new reset link.');
    }

    const newHash = await this.hashPassword(newPassword);

    await this.pgPool.query(
      `UPDATE users
       SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [newHash, userRow.id]
    );

    await this.logAudit(userRow.id, 'PASSWORD_RESET_COMPLETED', 'User', userRow.id);

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      passwordHash: newHash,
      emailVerified: true,
      isDemo: userRow.isDemo,
      createdAt: new Date().toISOString(),
    };
  }

  public async createOrLinkGoogleUser(payload: { email: string; name: string }): Promise<User> {
    await this.ensureInitialized();
    const cleanEmail = payload.email.toLowerCase().trim();
    let user = await this.getUserByEmail(cleanEmail);

    if (!user) {
      const dummyPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await this.hashPassword(dummyPassword);
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const res = await client.query(
          `INSERT INTO users (id, name, email, password_hash, email_verified, is_demo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, FALSE, $5, $5)
           RETURNING id, name, email, password_hash as "passwordHash", email_verified as "emailVerified", is_demo as "isDemo", created_at as "createdAt"`,
          [userId, payload.name || cleanEmail.split('@')[0], cleanEmail, passwordHash, now]
        );

        await client.query(
          `INSERT INTO profiles (id, user_id, title, target_role, years_of_experience, location, created_at, updated_at)
           VALUES ($1, $2, 'Professional Profile', '', 0, '', $3, $3)`,
          [crypto.randomUUID(), userId, now]
        );

        await client.query('COMMIT');
        user = res.rows[0];
        await this.logAudit(user!.id, 'GOOGLE_OAUTH_SIGNUP', 'User', user!.id);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      await this.pgPool.query('UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [user.id]);
      user.emailVerified = true;
      await this.logAudit(user.id, 'GOOGLE_OAUTH_LOGIN', 'User', user.id);
    }

    return user!;
  }

  public async deleteUserAccount(userId: string): Promise<void> {
    await this.ensureInitialized();
    await this.pgPool.query('DELETE FROM users WHERE id = $1', [userId]);
    await this.logAudit(userId, 'USER_DELETED', 'User', userId);
  }

  public async getUserById(id: string): Promise<User | undefined> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, name, email, password_hash as "passwordHash", email_verified as "emailVerified", is_demo as "isDemo", created_at as "createdAt"
       FROM users WHERE id = $1`,
      [id]
    );
    return res.rows[0];
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ensureInitialized();
    const clean = email.toLowerCase().trim();
    const res = await this.pgPool.query(
      `SELECT id, name, email, password_hash as "passwordHash", email_verified as "emailVerified", is_demo as "isDemo", created_at as "createdAt"
       FROM users WHERE LOWER(email) = $1`,
      [clean]
    );
    return res.rows[0];
  }

  // --- SESSIONS & MULTI-DEVICE AUTH ---
  public async createSession(
    userId: string,
    tokenHash: string,
    ipAddress?: string,
    userAgent?: string,
    expiresAt?: Date
  ): Promise<{ id: string; userId: string; expiresAt: string }> {
    await this.ensureInitialized();
    const id = crypto.randomUUID();
    const expiry = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date().toISOString();

    await this.pgPool.query(
      `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, is_revoked, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $7)
       ON CONFLICT (token_hash) DO UPDATE SET updated_at = $7, is_revoked = FALSE`,
      [id, userId, tokenHash, ipAddress || 'unknown', userAgent || 'unknown', expiry.toISOString(), now]
    );

    return { id, userId, expiresAt: expiry.toISOString() };
  }

  public async isSessionRevoked(tokenHash: string): Promise<boolean> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT is_revoked, expires_at FROM sessions WHERE token_hash = $1`,
      [tokenHash]
    );
    if (res.rows.length === 0) {
      return false; // Session not explicitly revoked or created prior to session tracking
    }
    const session = res.rows[0];
    if (session.is_revoked) return true;
    if (new Date(session.expires_at).getTime() < Date.now()) return true;
    return false;
  }

  public async getUserSessions(
    userId: string,
    currentTokenHash?: string
  ): Promise<Array<{ id: string; ipAddress: string; userAgent: string; createdAt: string; expiresAt: string; isCurrent: boolean }>> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, ip_address as "ipAddress", user_agent as "userAgent", created_at as "createdAt", expires_at as "expiresAt", token_hash as "tokenHash"
       FROM sessions
       WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      ipAddress: row.ipAddress || 'unknown',
      userAgent: row.userAgent || 'unknown',
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isCurrent: Boolean(currentTokenHash && row.tokenHash === currentTokenHash),
    }));
  }

  public async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `UPDATE sessions SET is_revoked = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
      [sessionId, userId]
    );
    if (res.rows.length > 0) {
      await this.logAudit(userId, 'SESSION_REVOKED', 'Session', sessionId);
      return true;
    }
    return false;
  }

  public async revokeAllSessions(userId: string, exceptTokenHash?: string): Promise<number> {
    await this.ensureInitialized();
    let query = `UPDATE sessions SET is_revoked = TRUE, updated_at = NOW() WHERE user_id = $1 AND is_revoked = FALSE`;
    const params: any[] = [userId];

    if (exceptTokenHash) {
      query += ` AND token_hash != $2`;
      params.push(exceptTokenHash);
    }

    const res = await this.pgPool.query(query, params);
    await this.logAudit(userId, 'ALL_SESSIONS_REVOKED', 'Session', userId);
    return res.rowCount || 0;
  }

  public async changeUserPassword(userId: string, currentPass: string, newPass: string): Promise<boolean> {
    await this.ensureInitialized();
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found.');

    const isMatch = await this.verifyPassword(currentPass, user.passwordHash);
    if (!isMatch) throw new Error('Incorrect current password.');

    const newHash = await this.hashPassword(newPass);
    await this.pgPool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    await this.logAudit(userId, 'PASSWORD_CHANGED', 'User', userId);
    return true;
  }

  public async createOrLinkOAuthAccount(
    userId: string,
    provider: string,
    providerUserId: string,
    email?: string,
    profileJson?: any
  ): Promise<void> {
    await this.ensureInitialized();
    await this.pgPool.query(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, profile_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (provider, provider_user_id) DO UPDATE
       SET email = EXCLUDED.email, profile_json = EXCLUDED.profile_json`,
      [crypto.randomUUID(), userId, provider, providerUserId, email || null, profileJson ? JSON.stringify(profileJson) : null]
    );
  }

  // --- PROFILES ---
  public async getProfileByUserId(userId: string): Promise<UserProfile | undefined> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, user_id as "userId", title, target_role as "targetRole", years_of_experience as "yearsOfExperience", location, bio
       FROM profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return res.rows[0];
  }

  public async getProfilesByUser(userId: string): Promise<UserProfile[]> {
    const p = await this.getProfileByUserId(userId);
    return p ? [p] : [];
  }

  public async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    await this.ensureInitialized();
    const existing = await this.getProfileByUserId(userId);
    const now = new Date().toISOString();

    if (!existing) {
      const id = crypto.randomUUID();
      const res = await this.pgPool.query(
        `INSERT INTO profiles (id, user_id, title, target_role, years_of_experience, location, bio, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING id, user_id as "userId", title, target_role as "targetRole", years_of_experience as "yearsOfExperience", location, bio`,
        [
          id,
          userId,
          updates.title || 'Professional Profile',
          updates.targetRole || '',
          updates.yearsOfExperience || 0,
          updates.location || '',
          updates.bio || null,
          now,
        ]
      );
      return res.rows[0];
    }

    const title = updates.title !== undefined ? updates.title : existing.title;
    const targetRole = updates.targetRole !== undefined ? updates.targetRole : existing.targetRole;
    const yearsOfExp = updates.yearsOfExperience !== undefined ? updates.yearsOfExperience : existing.yearsOfExperience;
    const location = updates.location !== undefined ? updates.location : existing.location;
    const bio = updates.bio !== undefined ? updates.bio : existing.bio;

    const res = await this.pgPool.query(
      `UPDATE profiles
       SET title = $1, target_role = $2, years_of_experience = $3, location = $4, bio = $5, updated_at = NOW()
       WHERE user_id = $6
       RETURNING id, user_id as "userId", title, target_role as "targetRole", years_of_experience as "yearsOfExperience", location, bio`,
      [title, targetRole, yearsOfExp, location, bio, userId]
    );

    return res.rows[0];
  }

  // --- RESUME OPERATIONS ---
  public async getResumesByUser(userId: string): Promise<StoredResume[]> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, user_id as "userId", profile_id as "profileId", title, raw_text as "rawText",
              file_type as "fileType", file_name as "fileName", template_id as "templateId",
              current_version_id as "currentVersionId", ats_score as "atsScore",
              score_json as score, data_json as data, created_at as "createdAt", updated_at as "updatedAt"
       FROM resumes
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    return res.rows.map((row) => this.hydrateStoredResume(row));
  }

  public async getResumeById(id: string, userId?: string): Promise<StoredResume | undefined> {
    await this.ensureInitialized();
    let query = `SELECT id, user_id as "userId", profile_id as "profileId", title, raw_text as "rawText",
                        file_type as "fileType", file_name as "fileName", template_id as "templateId",
                        current_version_id as "currentVersionId", ats_score as "atsScore",
                        score_json as score, data_json as data, created_at as "createdAt", updated_at as "updatedAt"
                 FROM resumes WHERE id = $1`;
    const params: (string | undefined)[] = [id];

    if (userId) {
      query += ` AND user_id = $2`;
      params.push(userId);
    }

    const res = await this.pgPool.query(query, params);
    if (res.rows.length === 0) return undefined;
    return this.hydrateStoredResume(res.rows[0]);
  }

  public async getResume(userId: string, resumeId: string): Promise<StoredResume> {
    const res = await this.getResumeById(resumeId, userId);
    if (!res) {
      throw new Error(`Resume ${resumeId} not found or access unauthorized.`);
    }
    return res;
  }

  private hydrateStoredResume(row: any): StoredResume {
    const data = row.data || {
      personal_info: { name: '', email: '', phone: '', location: '' },
      summary: '',
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      achievements: [],
    };

    const score = row.score || {
      overall: row.atsScore || 85,
      contentQuality: 85,
      atsCompatibility: row.atsScore || 85,
      skillsScore: 85,
      experienceScore: 85,
      projectsScore: 85,
      achievementsScore: 85,
      grammarScore: 90,
      formattingScore: 90,
      readabilityScore: 88,
      deductions: [],
    };

    return {
      id: row.id,
      userId: row.userId,
      profileId: row.profileId || '',
      title: row.title || 'Untitled Resume',
      rawText: row.rawText,
      fileType: row.fileType,
      fileName: row.fileName,
      data,
      score,
      atsScore: row.atsScore || 85,
      templateId: row.templateId || 'ats-classic',
      currentVersionId: row.currentVersionId || '',
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  public async saveResume(
    userId: string,
    data: ResumeData,
    title?: string,
    templateId?: string,
    rawText?: string,
    fileType?: string,
    fileName?: string
  ): Promise<StoredResume> {
    await this.ensureInitialized();
    const id = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const profile = await this.getProfileByUserId(userId);
    const profileId = profile?.id || null;

    const initialScore: ResumeScoreBreakdown = {
      overall: 85,
      contentQuality: 85,
      atsCompatibility: 85,
      skillsScore: 85,
      experienceScore: 85,
      projectsScore: 85,
      achievementsScore: 85,
      grammarScore: 90,
      formattingScore: 90,
      readabilityScore: 88,
      deductions: [],
    };

    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert into resumes
      await client.query(
        `INSERT INTO resumes (id, user_id, profile_id, title, raw_text, file_type, file_name, template_id, current_version_id, ats_score, score_json, data_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 85, $10, $11, $12, $12)`,
        [
          id,
          userId,
          profileId,
          title || 'Untitled Resume',
          rawText || null,
          fileType || 'application/pdf',
          fileName || 'resume.pdf',
          templateId || 'ats-classic',
          versionId,
          JSON.stringify(initialScore),
          JSON.stringify(data),
          now,
        ]
      );

      // 2. Insert initial version
      await client.query(
        `INSERT INTO resume_versions (id, resume_id, user_id, version_name, resume_data_json, score_json, ats_score, change_summary, is_active, created_at)
         VALUES ($1, $2, $3, 'v1.0 — Initial Structured Resume', $4, $5, 85, 'Initial structured extraction and baseline setup.', TRUE, $6)`,
        [versionId, id, userId, JSON.stringify(data), JSON.stringify(initialScore), now]
      );

      // 3. Populate normalized relational tables
      await this.syncNormalizedTables(client, id, data);

      await client.query('COMMIT');

      const saved = await this.getResume(userId, id);
      await this.logAudit(userId, 'RESUME_CREATED', 'Resume', id, { title: saved.title });
      return saved;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateResumeData(
    userId: string,
    resumeId: string,
    data: ResumeData,
    title?: string,
    templateId?: string
  ): Promise<StoredResume> {
    await this.ensureInitialized();
    const existing = await this.getResume(userId, resumeId);

    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');

      let query = `UPDATE resumes SET data_json = $1, updated_at = NOW()`;
      const params: any[] = [JSON.stringify(data)];
      let idx = 2;

      if (title) {
        query += `, title = $${idx++}`;
        params.push(title);
      }
      if (templateId) {
        query += `, template_id = $${idx++}`;
        params.push(templateId);
      }

      query += ` WHERE id = $${idx++} AND user_id = $${idx++}`;
      params.push(resumeId, userId);

      await client.query(query, params);

      // Re-sync normalized tables
      await this.syncNormalizedTables(client, resumeId, data);

      await client.query('COMMIT');

      await this.logAudit(userId, 'RESUME_UPDATED', 'Resume', resumeId);
      return await this.getResume(userId, resumeId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateResumeScores(
    userId: string,
    resumeId: string,
    score: ResumeScoreBreakdown,
    atsScore?: number
  ): Promise<StoredResume> {
    await this.ensureInitialized();
    await this.pgPool.query(
      `UPDATE resumes
       SET score_json = $1, ats_score = COALESCE($2, ats_score), updated_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [JSON.stringify(score), atsScore !== undefined ? atsScore : null, resumeId, userId]
    );
    return await this.getResume(userId, resumeId);
  }

  public async deleteResume(userId: string, resumeId: string): Promise<void> {
    await this.ensureInitialized();
    // Verify ownership
    await this.getResume(userId, resumeId);
    await this.pgPool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
    await this.logAudit(userId, 'RESUME_DELETED', 'Resume', resumeId);
  }

  // --- VERSIONING ---
  public async getVersions(userId: string, resumeId: string): Promise<ResumeVersion[]> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId); // Verify ownership

    const res = await this.pgPool.query(
      `SELECT id, resume_id as "resumeId", version_name as "versionName",
              resume_data_json as "resumeData", resume_data_json as data,
              score_json as score, ats_score as "atsScore", change_summary as "changeSummary",
              created_at as "createdAt"
       FROM resume_versions
       WHERE resume_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [resumeId, userId]
    );

    return res.rows.map((row, index, arr) => ({
      id: row.id,
      resumeId: row.resumeId,
      versionNumber: arr.length - index,
      versionName: row.versionName,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      resumeData: row.resumeData,
      data: row.resumeData,
      score: row.score,
      atsScore: row.atsScore,
      changeSummary: row.changeSummary,
    }));
  }

  public async createVersion(
    userId: string,
    resumeId: string,
    versionName: string,
    data: ResumeData,
    score?: ResumeScoreBreakdown,
    atsScore?: number,
    changeSummary?: string,
    targetJobScore?: number,
    targetJobId?: string
  ): Promise<ResumeVersion> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId);

    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.pgPool.query(
      `INSERT INTO resume_versions (id, resume_id, user_id, version_name, resume_data_json, score_json, ats_score, change_summary, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9)`,
      [
        versionId,
        resumeId,
        userId,
        versionName,
        JSON.stringify(data),
        score ? JSON.stringify(score) : null,
        atsScore ?? 85,
        changeSummary || 'Controlled version checkpoint.',
        now,
      ]
    );

    await this.pgPool.query('UPDATE resumes SET current_version_id = $1, updated_at = NOW() WHERE id = $2', [
      versionId,
      resumeId,
    ]);

    return {
      id: versionId,
      resumeId,
      versionNumber: 1,
      versionName,
      createdAt: now,
      resumeData: data,
      data,
      score: score || {
        overall: 85,
        contentQuality: 85,
        atsCompatibility: atsScore ?? 85,
        skillsScore: 85,
        experienceScore: 85,
        projectsScore: 85,
        achievementsScore: 85,
        grammarScore: 90,
        formattingScore: 90,
        readabilityScore: 88,
        deductions: [],
      },
      atsScore: atsScore ?? 85,
      changeSummary: changeSummary || 'Version snapshot created.',
      targetJobScore,
      targetJobId,
    };
  }

  public async restoreVersion(userId: string, resumeId: string, versionId: string): Promise<StoredResume> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId); // Verify ownership

    const vRes = await this.pgPool.query(
      `SELECT resume_data_json, version_name
       FROM resume_versions
       WHERE id = $1 AND resume_id = $2 AND user_id = $3`,
      [versionId, resumeId, userId]
    );

    if (vRes.rows.length === 0) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const versionData: ResumeData = vRes.rows[0].resume_data_json;
    const versionName: string = vRes.rows[0].version_name;

    const restoredResume = await this.updateResumeData(
      userId,
      resumeId,
      versionData
    );

    await this.pgPool.query(
      `UPDATE resumes SET current_version_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [versionId, resumeId, userId]
    );

    await this.logAudit(userId, 'VERSION_RESTORED', 'Resume', resumeId, {
      versionId,
      versionName,
    });

    return restoredResume;
  }

  // --- ISSUES & SUGGESTIONS ---
  public async getIssues(userId: string, resumeId: string): Promise<AnalysisIssue[]> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId);

    const res = await this.pgPool.query(
      `SELECT id, section, issue_type as "type", severity, evidence, reason, suggestion, confidence, status
       FROM analysis_issues
       WHERE resume_id = $1
       ORDER BY created_at ASC`,
      [resumeId]
    );

    return res.rows;
  }

  public async setIssues(userId: string, resumeId: string, issues: AnalysisIssue[]): Promise<void> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId);

    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM analysis_issues WHERE resume_id = $1', [resumeId]);

      for (const iss of issues) {
        await client.query(
          `INSERT INTO analysis_issues (id, resume_id, section, issue_type, severity, evidence, reason, suggestion, confidence, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            iss.id || crypto.randomUUID(),
            resumeId,
            iss.section || 'experience',
            iss.type || 'bullet_weak_impact',
            iss.severity || 'medium',
            iss.evidence || '',
            iss.reason || '',
            iss.suggestion || '',
            iss.confidence || 0.95,
            iss.status || 'pending',
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateIssueStatus(
    userId: string,
    resumeId: string,
    issueId: string,
    status: 'pending' | 'accepted' | 'rejected'
  ): Promise<AnalysisIssue> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId);

    const res = await this.pgPool.query(
      `UPDATE analysis_issues
       SET status = $1
       WHERE id = $2 AND resume_id = $3
       RETURNING id, section, issue_type as "type", severity, evidence, reason, suggestion, confidence, status`,
      [status, issueId, resumeId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Issue ${issueId} not found.`);
    }

    return res.rows[0];
  }

  // --- JOB DESCRIPTIONS & MATCHES ---
  public async getJobDescriptions(userId: string): Promise<JobDescriptionModel[]> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, user_id as "userId", title, company, location, raw_text as "rawText",
              required_skills_json as "requiredSkills", preferred_skills_json as "preferredSkills",
              responsibilities_json as responsibilities, experience_years_required as "experienceYearsRequired",
              seniority_level as "seniorityLevel",
              domain_keywords_json as "domainKeywords", created_at as "createdAt"
       FROM job_descriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      company: r.company || 'Unknown',
      location: r.location || '',
      rawText: r.rawText,
      requiredSkills: r.requiredSkills || [],
      preferredSkills: r.preferredSkills || [],
      responsibilities: r.responsibilities || [],
      experienceYearsRequired: r.experienceYearsRequired || 3,
      seniorityLevel: (r.seniorityLevel as any) || 'Mid',
      domainKeywords: r.domainKeywords || [],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));
  }

  public async getJobDescription(userId: string, jobId: string): Promise<JobDescriptionModel> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT id, user_id as "userId", title, company, location, raw_text as "rawText",
              required_skills_json as "requiredSkills", preferred_skills_json as "preferredSkills",
              responsibilities_json as responsibilities, experience_years_required as "experienceYearsRequired",
              seniority_level as "seniorityLevel",
              domain_keywords_json as "domainKeywords", created_at as "createdAt"
       FROM job_descriptions
       WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Job description ${jobId} not found or unauthorized.`);
    }

    const r = res.rows[0];
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      company: r.company || 'Unknown',
      location: r.location || '',
      rawText: r.rawText,
      requiredSkills: r.requiredSkills || [],
      preferredSkills: r.preferredSkills || [],
      responsibilities: r.responsibilities || [],
      experienceYearsRequired: r.experienceYearsRequired || 3,
      seniorityLevel: (r.seniorityLevel as any) || 'Mid',
      domainKeywords: r.domainKeywords || [],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
  }

  public async saveJobDescription(userId: string, job: Partial<JobDescriptionModel>): Promise<JobDescriptionModel> {
    await this.ensureInitialized();
    const id = job.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await this.pgPool.query(
      `INSERT INTO job_descriptions (id, user_id, title, company, location, raw_text, required_skills_json, preferred_skills_json, domain_keywords_json, responsibilities_json, experience_years_required, seniority_level, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title, company = EXCLUDED.company, location = EXCLUDED.location, raw_text = EXCLUDED.raw_text,
           required_skills_json = EXCLUDED.required_skills_json, preferred_skills_json = EXCLUDED.preferred_skills_json,
           domain_keywords_json = EXCLUDED.domain_keywords_json, responsibilities_json = EXCLUDED.responsibilities_json,
           seniority_level = EXCLUDED.seniority_level`,
      [
        id,
        userId,
        job.title || 'Target Job Description',
        job.company || 'Company',
        job.location || '',
        job.rawText || '',
        JSON.stringify(job.requiredSkills || []),
        JSON.stringify(job.preferredSkills || []),
        JSON.stringify(job.domainKeywords || []),
        JSON.stringify(job.responsibilities || []),
        job.experienceYearsRequired || 3,
        job.seniorityLevel || 'Mid',
        now,
      ]
    );

    return await this.getJobDescription(userId, id);
  }

  public async saveJobMatch(userId: string, resumeId: string, jobId: string, match: JobMatchResult): Promise<void> {
    await this.ensureInitialized();
    await this.getResume(userId, resumeId);
    await this.getJobDescription(userId, jobId);

    const matchId = crypto.randomUUID();
    await this.pgPool.query(
      `INSERT INTO job_matches (id, resume_id, job_id, user_id, overall_match, skill_match, semantic_match, keyword_match, experience_match, education_match, responsibility_match, matched_skills_json, missing_skills_json, recommendations_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        matchId,
        resumeId,
        jobId,
        userId,
        match.overallMatch,
        match.skillMatch,
        match.semanticMatch,
        match.keywordMatch,
        match.experienceMatch,
        match.educationMatch,
        match.responsibilityMatch,
        JSON.stringify(match.matchedSkills || []),
        JSON.stringify(match.missingSkills || []),
        JSON.stringify(match.recommendations || []),
      ]
    );
  }

  // --- CAREER GAPS ---
  public async saveCareerGap(userId: string, targetRole: string, gap: CareerGapAnalysis): Promise<void> {
    await this.ensureInitialized();
    const id = crypto.randomUUID();
    await this.pgPool.query(
      `INSERT INTO career_gaps (id, user_id, target_role, analysis_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [id, userId, targetRole, JSON.stringify(gap)]
    );
  }

  public async getCareerGap(userId: string, targetRole: string): Promise<CareerGapAnalysis | undefined> {
    await this.ensureInitialized();
    const res = await this.pgPool.query(
      `SELECT analysis_json FROM career_gaps
       WHERE user_id = $1 AND target_role = $2
       ORDER BY updated_at DESC LIMIT 1`,
      [userId, targetRole]
    );
    return res.rows[0]?.analysis_json;
  }
}

export const db = new DatabaseEngine();
