# ResumeX AI

> **AI Resume Intelligence, Builder, ATS Optimization & Career Profile Platform**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0.1-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2.3-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.14-38bdf8.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%208.23-336791.svg)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%203.6--Flash-orange.svg)](https://ai.google.dev/)
[![Automated Tests](https://img.shields.io/badge/Tests-68%20Passing%20(17%20Suites)-success.svg)](server/testRunner.ts)

ResumeX AI is a full-stack, enterprise-grade resume intelligence platform engineered for candidates seeking rigorous ATS-style diagnostic analysis, verified resume optimization, and professional document presentation. By synthesizing deterministic document extraction, natural language processing benchmarks, heuristic ATS diagnostic models, and zero-fabrication generative AI rewrites, ResumeX AI provides actionable feedback without inventing qualifications, metrics, or career milestones. The platform features an interactive live builder, version comparison engine, career gap timeline analyzer, job-description matching matrix, and multi-format document exporter (DOCX and PDF).

---

## ✨ Features

### 📄 Resume Intelligence
- **Multi-Format Ingestion**: Upload resumes in PDF (`pdf-parse`), DOCX (`mammoth`), and UTF-8 plain-text formats with strict 10MB memory-buffered limits.
- **De-Columnization & Text Normalization**: Algorithmic de-columnization that identifies multi-column gutters and reads coordinates sequentially, preventing scrambled text blocks.
- **Deterministic Section Extraction**: Robust regex- and heuristic-based parsers identify contact info, professional summaries, work experience, education, skills, and projects without hallucinated fallback defaults.
- **NLP Quality Evaluation**: Scores resumes across four core dimensions: action verb strength, quantified achievement ratio, readability (Flesch reading ease), and keyword fluff density.
- **Achievement Diagnostic**: Evaluates bullet points against Google's X-Y-Z formula (*Accomplished [X] as measured by [Y] by doing [Z]*), CAR (Context-Action-Result), and STAR frameworks.

### 🎯 ATS Intelligence
- **Educational ATS-Style Simulation**: Simulates candidate parsing behavior against heuristic models representing 5 major enterprise ATS architectures: **Workday**, **Greenhouse**, **Taleo**, **Lever**, and **iCIMS**.
- **Keyword Evidence Breakdown**: Dissects keyword occurrences with a canonical technical alias dictionary (e.g., mapping `Postgres` to `PostgreSQL`, `K8s` to `Kubernetes`, `AWS` to `Amazon Web Services`).
- **Formatting & Scanner Safety Audits**: Detects risky layout elements including tables, multi-column blocks, unconventional headers, and graphic artifacts that trigger scanner truncation.
- **Job-Description Matching Matrix**: Compares resumes against uploaded or pasted job descriptions, detailing matched core skills, missing preferred competencies, and domain keyword alignment.

> **Disclaimer**: Vendor-specific ATS scores are educational ATS-style simulations and diagnostic estimates. ResumeX AI does not claim access to proprietary scoring algorithms of Workday, Greenhouse, Lever, Taleo, or iCIMS.

### 💡 AI Optimization & ResumeTruth
- **Zero-Fabrication AI Rewriting**: Powered by Google Gemini (`@google/genai`), transforming weak bullet points into impactful, action-driven statements grounded strictly in the candidate's existing achievements.
- **ResumeTruth Anti-Hallucination Engine**: Verifies rewritten output against the original resume context. Automatically flags unverified percentage increases, invented revenue figures, unmentioned companies, and undeclared degrees with `requires_user_confirmation: true`.
- **Context-Aware Summary Generation**: Produces targeted executive summaries tailored to target job roles using only verified employment background and technical competencies.
- **Flexible Review Workflow**: Candidates can inspect side-by-side before/after diffs, apply selective suggestions with **Fix Selected**, or automatically address verified formatting and wording warnings with **Fix All Safe**.

### 🛠️ Resume Builder
- **Split-Screen Live Editor**: Real-time two-way synchronization between structured field inputs (personal info, experience, education, skills, projects) and the live rendered document.
- **100+ Customizable Resume Configurations**: Built upon 7 master layout archetypes (ATS Classic, ATS Strict, Modern Slate, Minimal Clean, Technical Matrix, Executive Prestige, Creative Product), customizable across typography pairings and color palettes.
- **Multi-Format Export Engine**: Generates clean binary DOCX documents (`docx` package with styled tables and bullet paragraphs) and print-ready PDFs (`jspdf`).
- **Pre-Export Validation Suite**: Diagnostic checks run before export to verify that contact details are complete, bullets are not orphaned, and document length is optimal.
- **Snapshot Versioning**: Creates immutable snapshot checkpoints on every major revision with visual diff comparisons and instant version restoration.

### 🧭 Career Intelligence
- **Career Gap Analysis**: Analyzes employment dates, automatically identifies gaps exceeding 90 days, computes exact duration in months, and suggests professional framing options (e.g., upskilling, caretaking, sabbatical, independent consulting).
- **Skill Gap Matrix**: Highlights high-value missing competencies relative to target job postings and offers targeted learning or project recommendations.
- **Resume-to-JD Semantic Matching**: Combines cosine vector similarity (via Gemini `text-embedding-004`) with token frequency and Jaccard overlap for fallback resilience.

### 🔒 Authentication & Security
- **Email & Password Authentication**: Salted password hashing via `bcryptjs` with a work cost factor of 12 (~250ms hashing latency).
- **Google OAuth 2.0 OIDC**: Server-side cryptographic token verification using `google-auth-library` (`OAuth2Client.verifyIdToken`).
- **HMAC SHA-256 JWT Sessions**: Custom 3-part signed session tokens stored in secure, `HttpOnly`, `SameSite=Lax` cookies.
- **CSRF Token Protection**: Double-submit cookie pattern protecting all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Granular Rate Limiting**: In-memory sliding window limits on authentication (5 req/15 min), AI generation (20 req/min), and file uploads (10 uploads/10 min).
- **File Upload Hardening**: Magic-byte inspection rejecting executables (PE `.exe`, ELF binaries) disguised as documents, path traversal prevention, and filename sanitization.
- **Active Session Management**: View active sessions with IP address and user-agent metadata, single-session revocation, and global logout ("revoke other sessions").
- **IDOR / Ownership Protection**: Strict authorization checks ensuring users can only read, modify, or export resumes and job profiles linked to their user ID.

---

## 🔄 Product Workflow

```mermaid
flowchart TD
    User([User]) --> Auth{Authentication}
    Auth -->|Email & Password / Google OAuth| Dashboard[Candidate Dashboard]

    Dashboard --> UploadFlow[Upload Resume File]
    Dashboard --> BuilderFlow[Live Resume Builder]
    Dashboard --> JDFlow[Job Description Analysis]

    subgraph Analysis_Pipeline [Resume Intelligence Pipeline]
        UploadFlow --> MagicBytes[Magic Byte & MIME Validation]
        MagicBytes --> DocParser[Document Parser: PDF / DOCX / TXT]
        DocParser --> DeColumn[De-Columnization & Layout Normalization]
        DeColumn --> Extractor[Deterministic Resume Extractor]
        Extractor --> NLP[NLP Benchmark Evaluation]
        NLP --> ATSDiag[ATS-Style Diagnostic Scoring]
        ATSDiag --> AchCheck[Achievement & Bullet Formula Checks]
    end

    subgraph Optimization_Pipeline [AI & ResumeTruth]
        AchCheck --> OptEngine[Gemini Optimization Engine]
        OptEngine --> ResumeTruth{ResumeTruth Verification}
        ResumeTruth -->|Verified Improvement| Suggestions[Actionable Suggestions & Diffs]
        ResumeTruth -->|Unverified Claim Detected| UserConfirm[Flag: Requires Candidate Confirmation]
        Suggestions --> Review[Fix Selected / Fix All Safe]
    end

    subgraph Builder_Pipeline [Resume Builder & Export]
        BuilderFlow --> LiveEditor[Split-Screen Editor]
        Review --> LiveEditor
        LiveEditor --> Catalog[100+ Template Style Configurations]
        Catalog --> Versions[Snapshot Version History]
        Versions --> PreExport[Pre-Export Diagnostics]
        PreExport --> ExportPDF[Download PDF]
        PreExport --> ExportDOCX[Download DOCX]
    end

    subgraph Match_Pipeline [Job Matching & Career Insights]
        JDFlow --> JDParsing[JD Entity & Skill Parsing]
        JDParsing --> SemanticMatch[Semantic Vector & Keyword Matching]
        SemanticMatch --> GapAnalysis[Career & Skill Gap Breakdown]
        GapAnalysis --> TargetedTips[Role-Targeted Bullet Recommendations]
        TargetedTips --> LiveEditor
    end
```

---

## 🧠 AI/NLP Pipeline

```mermaid
flowchart LR
    Doc[Document Upload] --> Sec[Security & Magic Bytes]
    Sec --> Parse[Document Parser]
    Parse --> Norm[Layout Normalization]
    Norm --> Extract[Deterministic Extraction]
    Extract --> NLP[NLP Metrics: Flesch, Verbs, Density]
    NLP --> ATS[5-Engine ATS Heuristics]
    ATS --> JD[JD Match & Skill Matrix]
    JD --> Embed[Vector Cosine Similarity]
    Embed --> Gen[Gemini AI Rewriter]
    Gen --> Truth[ResumeTruth Validation]
    Truth --> Output[Actionable Diffs & Exports]
```

1. **Document Upload & Sanitation**: Uploaded buffers are inspected for valid magic bytes (`%PDF`, `PK\x03\x04` for DOCX), sanitized of path traversal characters, and verified against a 10MB threshold.
2. **Text Normalization & De-Columnization**: Converts raw binary payloads into structured plain text, detecting two-column layout boundaries and sorting line sequences to prevent interleaved reading orders.
3. **Deterministic Entity Extraction**: Regex and contextual token parsers extract names, emails, phone numbers, links, job titles, companies, date ranges, degrees, institutions, and classified skills without using placeholder fallbacks.
4. **NLP Quality Evaluation**: Computes mathematical Flesch reading ease scores, calculates action verb ratios against active/passive lexicons, and calculates quantified metric density.
5. **ATS Heuristic Diagnostics**: Tests extracted content against keyword density limits, standard section header matches, font/artifact safety, and contact location standards modeled after enterprise ATS parsers.
6. **Semantic Job Description Matching**: When a job description is supplied, domain keywords and required skills are extracted. The system computes vector embeddings (`text-embedding-004`) to evaluate semantic cosine similarity, with token-overlap fallbacks if embeddings are unreachable.
7. **Gemini Optimization Engine**: Generates elevated bullet points adhering to active voice, standard frameworks (Google X-Y-Z), and the target job profile.
8. **ResumeTruth Verification**: Inspects proposed AI rewrites against the candidate's established facts. Any invented metrics, unknown companies, or phantom degrees are flagged with strict confirmation warnings to protect candidate integrity.

---

## 💻 Tech Stack

### Frontend
- **React 19** (`19.0.1`): Modern functional component architecture with hooks and concurrent rendering.
- **TypeScript** (`5.8.2`): Strict end-to-end type safety across data contracts.
- **Vite** (`6.2.3`): Fast development server and production bundler.
- **Tailwind CSS** (`4.1.14`): Modern utility-first styling with `@tailwindcss/vite`.
- **Motion** (`12.23.24`): Fluid UI transitions, modal animations, and accordion state shifts.
- **Lucide React** (`0.546.0`): Consistent, lightweight SVG icon system.
- **Recharts** (`3.10.1`): Interactive radar and bar charts for visual ATS score breakdowns.
- **Canvas-Confetti** (`1.9.4`): Visual feedback on milestone score achievements.

### Backend
- **Node.js** (`>=20.0.0`): Enterprise JavaScript/TypeScript runtime.
- **Express** (`4.21.2`): HTTP REST API server with middleware architecture.
- **esbuild** (`0.25.0`): High-speed bundler compiling `server.ts` into a self-contained CommonJS artifact (`dist/server.cjs`).
- **express-rate-limit** (`8.7.0`): IP-based rate limiting across authentication, AI generation, and file uploads.
- **multer** (`2.3.0`): Secure in-memory multipart file upload handling.

### Database & Persistence
- **PostgreSQL** (`pg 8.23.0`): Relational persistence layer for users, sessions, resumes, versions, job descriptions, and audit logs.
- **Idempotent Migration Runner**: Automated startup migration engine executing SQL migrations stored in `server/migrations/`.

### AI & Language Processing
- **Google Gen AI SDK** (`@google/genai 2.4.0`): Enterprise Google Gemini integration supporting `gemini-3.6-flash` for bullet/summary generation and `text-embedding-004` for semantic matching.
- **Custom Heuristic NLP Engine**: In-memory tokenization, canonical skill alias resolution, readability grading, and passive voice detection.

### Document Processing & Generation
- **pdf-parse** (`2.4.5`): Server-side PDF binary parsing and text extraction.
- **mammoth** (`1.12.2`): Word document (`.docx`) extraction and HTML/plain-text conversion.
- **docx** (`9.7.1`): Server-side DOCX document generation with custom tables, font styling, and paragraph spacing.
- **jspdf** (`4.2.1`): Client-side and server-side PDF document generation.

### Authentication & Cryptography
- **bcryptjs** (`3.0.3`): Adaptive salted password hashing with work cost factor 12.
- **google-auth-library** (`11.0.2`): Official Google OAuth 2.0 and OpenID Connect ID token validation.
- **Node.js crypto**: Native HMAC SHA-256 for session token generation, CSRF token synthesis, and SHA-256 token hashing.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Client [Browser Client: React 19 + Vite]
        UI[Tailwind CSS & Motion UI]
        Views[10 Application Views: Dashboard, ATS Lab, Builder, etc.]
        State[API Client & CSRF Handshake]
        UI --> Views --> State
    end

    subgraph Gateway [API Gateway & Middleware]
        RateLimit[Rate Limiters: Auth, AI, Upload]
        SecurityHeaders[Security Headers: nosniff, SAMEORIGIN, Request-Id]
        CSRF[CSRF Protection Middleware]
        AuthGuard[Session & Token Authenticator]
        State -->|HTTP / JSON / Cookies| RateLimit
        RateLimit --> SecurityHeaders --> CSRF --> AuthGuard
    end

    subgraph Backend_Services [Express Service Layer]
        AuthService[Auth & Google OIDC Service]
        DocService[Document Parser & Normalizer]
        ExtractorService[Deterministic Resume Extractor]
        ATSService[5-Engine ATS Heuristic Analyzer]
        NLPEvalService[NLP Benchmark Evaluation]
        JDMatchService[JD Analyzer & Semantic Matcher]
        OptEngineService[Optimization & Bullet Rewriter]
        TruthEngineService[ResumeTruth Anti-Hallucination Engine]
        ExportEngineService[DOCX & PDF Export Engine]
        VersionService[Snapshot Versioning Engine]
    end

    AuthGuard --> Backend_Services

    subgraph Data_Layer [PostgreSQL Database]
        Migrations[Schema Migration Runner]
        Tables[(Users, Sessions, Resumes, Versions, Jobs, Exports, Audits)]
        Migrations --> Tables
    end

    subgraph External_AI [External Services]
        Gemini[Google Gemini 3.6-Flash API]
        GeminiEmbed[Gemini text-embedding-004]
        GoogleOIDC[Google Identity Services]
    end

    Backend_Services --> Data_Layer
    OptEngineService --> Gemini
    JDMatchService --> GeminiEmbed
    AuthService --> GoogleOIDC
```

---

## 📁 Project Structure

```
.
├── .env.example                 # Environment configuration template
├── .gitignore                   # Git exclusion rules
├── index.html                   # HTML entry point with metadata tags
├── metadata.json                # AI Studio application configuration
├── package.json                 # Project dependencies and lifecycle scripts
├── server.ts                    # Production entry point bundling Express & Vite static serving
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite configuration with Tailwind CSS and dev API proxy
├── public/                      # Static assets
│   └── assets/
│       └── aistudio/            # AI Studio platform assets
├── server/                      # Server-side TypeScript application
│   ├── api.ts                   # Core Express REST API router & endpoint definitions
│   ├── auth.ts                  # Authentication, JWT cookies, CSRF, and bcrypt utilities
│   ├── db.ts                    # PostgreSQL connection pool and database repository methods
│   ├── gemini.ts                # Centralized Google Gen AI SDK client and model configuration
│   ├── migrationRunner.ts       # Automated idempotent SQL schema migration runner
│   ├── testRunner.ts            # 17-suite standalone test harness
│   ├── types.ts                 # Server-side TypeScript interfaces and models
│   ├── migrations/              # Versioned SQL migration scripts
│   │   ├── 001_initial.sql      # Schema migrations tracking, users table, profile indices
│   │   ├── 002_auth.sql         # Sessions table with token hashing, OAuth accounts
│   │   ├── 003_resume.sql       # Resumes table, resume versions table
│   │   ├── 004_analysis.sql     # Job descriptions, matches, issues, and career gaps
│   │   ├── 005_templates.sql    # Template catalog definition schema
│   │   └── 006_security.sql     # Audit events, export tracking, and security indices
│   └── services/                # Specialized domain service modules
│       ├── achievementAnalyzer.ts  # Google X-Y-Z and STAR achievement diagnostics
│       ├── atsAnalyzer.ts          # 5-engine corporate ATS simulations and alias matching
│       ├── careerGapEngine.ts      # Chronological career gap detection and narrative advice
│       ├── documentParser.ts       # PDF, DOCX, and TXT parsing with de-columnization
│       ├── emailService.ts         # SMTP delivery & development email inspection
│       ├── exportEngine.ts         # DOCX binary and PDF document generation
│       ├── googleAuth.ts           # Cryptographic Google OIDC ID token verification
│       ├── jdAnalyzer.ts           # Job description keyword and competency extractor
│       ├── nlpEvaluation.ts        # Action verbs, readability, and NLP benchmark suite
│       ├── optimizationEngine.ts   # Bullet and summary AI rewriters via Gemini
│       ├── rateLimiter.ts          # Sliding window rate limiters (Auth, AI, Upload)
│       ├── resumeExtractor.ts      # Deterministic entity and contact extraction
│       ├── resumeTruthEngine.ts    # Anti-hallucination and unverified claim validator
│       ├── scoringEngine.ts        # Dynamic multi-dimensional resume scoring engine
│       ├── semanticMatcher.ts      # Vector embedding and keyword matching algorithms
│       ├── skillExtractor.ts       # Categorized technical and soft skills extraction
│       ├── templateEngine.ts       # Template configurations and theme definitions
│       ├── uploadSecurity.ts       # Magic byte inspection and filename sanitization
│       └── versionEngine.ts        # Snapshot version creation and diff restoration
└── src/                         # Frontend React 19 application
    ├── App.tsx                  # Root application component and view router
    ├── main.tsx                 # React DOM mount point
    ├── index.css                # Global styles with Tailwind CSS v4 directives
    ├── types.ts                 # Frontend data types matching server contracts
    ├── vite-env.d.ts            # Vite client environment type declarations
    ├── constants/               # Master template definitions and catalog generator
    │   └── templates.ts         # 7 archetypes and 100+ style configurations
    ├── lib/                     # Client helper utilities
    │   └── tokens.ts            # Visual design tokens and spacing metrics
    ├── services/                # Frontend API client
    │   └── api.ts               # HTTP client handling credentials, CSRF tokens, and errors
    └── components/              # UI components and view controllers
        ├── AuthModal.tsx        # Sign-in, registration, password reset, and Google OAuth
        ├── ConfirmModal.tsx     # Reusable confirmation dialogs
        ├── ErrorBoundary.tsx    # React error boundary component
        ├── LandingPage.tsx      # Feature overview and unauthenticated landing display
        ├── Navbar.tsx           # Global navigation header with user profile actions
        ├── ResumeRenderer.tsx   # Visual resume document renderer with customizable themes
        ├── ScoreRadar.tsx       # Recharts radar chart for 5-axis ATS score display
        ├── Sidebar.tsx          # Navigation sidebar with status badges
        ├── Toast.tsx            # Alert notification provider
        └── views/               # Dedicated application screens
            ├── AtsLabView.tsx           # 5-engine ATS diagnostic simulator and alias inspector
            ├── CareerGapView.tsx        # Employment timeline and career gap narrative advisor
            ├── DashboardView.tsx        # Candidate control center and overview
            ├── JobMatchingView.tsx      # Side-by-side JD comparison and skill matrix
            ├── LiveBuilderView.tsx      # Split-screen editor with real-time preview
            ├── MyResumesView.tsx        # Resume file library and version manager
            ├── NlpEvaluationView.tsx    # NLP benchmark diagnostics and metrics
            ├── SettingsView.tsx         # Account security, session manager, and audit trail
            ├── TemplateGalleryView.tsx  # Catalog of 100+ customizable template styles
            └── VersionComparisonView.tsx # Side-by-side visual diff and version restoration
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js**: Version `20.0.0` or higher
- **npm**: Version `10.0.0` or higher
- **PostgreSQL**: PostgreSQL 14+ instance running locally or hosted on a managed cloud service

### 1. Clone the Repository
```bash
git clone YOUR_REPOSITORY_URL
cd resumex-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the `.env.example` file to create your `.env` configuration:
```bash
cp .env.example .env
```
Edit `.env` and provide your credentials (see the [Environment Variables](#-environment-variables) section below).

### 4. Database Setup
Ensure PostgreSQL is running and accessible via your configured `DATABASE_URL`. When the application boots, the built-in migration runner automatically detects and applies all unapplied SQL migrations in `server/migrations/`.

### 5. Start Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000`.

---

## 🔑 Environment Variables

The table below describes all environment variables supported by ResumeX AI:

| Variable | Type | Environment | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | Server | Application environment (`development`, `production`, `test`). |
| `APP_URL` | String | Server | Canonical base URL of the deployment (e.g. `https://resumex.example.com`). |
| `DATABASE_URL` | String | Server | **Required in production**. PostgreSQL connection URI (`postgresql://user:pass@host:5432/dbname`). |
| `JWT_SECRET` | String | Server | **Required in production** (minimum 32 characters). Secret key used for HMAC SHA-256 session signatures. |
| `GEMINI_API_KEY` | String | Server | Google Gemini API key for AI bullet optimization, summaries, and embeddings. |
| `GEMINI_MODEL` | String | Server | Gemini model identifier for text generation (default: `gemini-3.6-flash`). |
| `GEMINI_EMBEDDING_MODEL` | String | Server | Gemini model identifier for vector embeddings (default: `text-embedding-004`). |
| `GOOGLE_CLIENT_ID` | String | Server | Google OAuth 2.0 Client ID for server-side cryptographic ID token verification. |
| `VITE_GOOGLE_CLIENT_ID` | String | Client | Public Google OAuth Client ID loaded by Vite for Google Identity Services frontend popups. |
| `SMTP_HOST` | String | Server | Optional SMTP host for verification and password reset emails (e.g. `smtp.resend.com`). |
| `SMTP_PORT` | Number | Server | Optional SMTP port (e.g. `587` or `465`). |
| `SMTP_USER` | String | Server | Optional SMTP username. |
| `SMTP_PASS` | String | Server | Optional SMTP password. |
| `SMTP_FROM` | String | Server | Sender email address (default: `noreply@resumex.ai`). |
| `ENABLE_DEMO_LOGIN` | Boolean | Server | Enables demo account login in development mode. **Must remain false in production**. |

### Critical Security Practices
- **Never commit `.env` or secrets to version control**. `.env` is ignored by `.gitignore`.
- **Keep `GEMINI_API_KEY` strictly on the server**. Never prefix the Gemini key with `VITE_`.
- **Enforce a high-entropy `JWT_SECRET`**. The server enforces a minimum 32-character length for `JWT_SECRET` at production boot.
- **Ensure `ENABLE_DEMO_LOGIN=false` in production** to prevent unauthorized demo authentication.

---

## 🛠️ Development & Available Scripts

The project defines the following npm lifecycle scripts in `package.json`:

```bash
# Start the Vite development server with integrated API middleware on port 3000
npm run dev

# Run TypeScript compiler checks across all client and server files without emitting JS
npm run typecheck

# Alias for typecheck, validating type signatures
npm run lint

# Execute the standalone 17-suite automated test suite
npm test

# Full production build: compiles Vite client assets, bundles server with esbuild, and packages migrations
npm run build

# Start the compiled CommonJS server in production mode
npm start

# Preview the built static assets locally using Vite's preview server
npm run preview

# Clean build artifacts (removes dist/ and server.js)
npm run clean
```

---

## 🧪 Testing

The repository includes a comprehensive 17-suite automated test runner (`server/testRunner.ts`) executing standalone integration and unit tests without external test runner bloat.

To execute the test harness:
```bash
npm test
```

### Verified Test Suites & Coverage Areas:
1. **Suite 1: Document Parser & De-Columnization**: Verifies plain text extraction, section discovery, and sequential multi-column reading order preservation.
2. **Suite 2: Deterministic Resume Extraction**: Validates extraction of candidate contact details, roles, and skills without fallback to hardcoded default placeholders.
3. **Suite 3: 5 Corporate ATS Engine Simulations**: Tests scoring outputs for Workday, Greenhouse, Taleo, Lever, and iCIMS heuristic models.
4. **Suite 4: Export Engine Validation & File Generation**: Validates pre-export diagnostic checks and verifies non-empty binary buffer creation for DOCX and PDF formats.
5. **Suite 5: ResumeTruth Anti-Hallucination Engine**: Verifies that fabricated percentages, invented metrics, and unverified credentials trigger rejection flags.
6. **Suite 6: NLP Evaluation Suite Benchmarking**: Validates precision, recall, and F1 scoring (96.5% benchmark threshold) across four NLP dimensions.
7. **Suite 7: File Upload Security & Magic Bytes**: Verifies rejection of executable binaries disguised as PDFs, filename sanitization, and path traversal stripping.
8. **Suite 8: Evidence-Based Dynamic Scoring**: Tests composite score calculation, ATS compatibility scoring, and deduction generation.
9. **Suite 9: Schema Migrations Verification**: Verifies idempotent database migration functionality.
10. **Suite 10: Cookie Auth Token Security & HMAC Validation**: Verifies 3-part HMAC SHA-256 JWT generation, signature verification, tampered token rejection, and bcrypt cost factor 12 hashing.
11. **Suite 11: Google OIDC Token Verification**: Verifies rejection of empty and malformed JWT ID tokens.
12. **Suite 12: Zero-Fabrication AI & Unverified Metric Detection**: Ensures unverified numbers trigger `requires_user_confirmation: true`.
13. **Suite 13: Evidence-Based ATS Corpus & Canonical Aliases**: Tests canonical alias resolution (e.g. `Postgres` $\to$ `PostgreSQL`) and keyword density analysis.
14. **Suite 14: Production Migration Packaging**: Verifies dynamic path resolution for SQL migrations across both dev (`server/migrations`) and production (`dist/migrations`).
15. **Suite 15: CSRF Security & Request Mutation**: Tests blocking of mutating HTTP requests without tokens and acceptance of matching cookie and header tokens.
16. **Suite 16: Binary Executable Rejection**: Tests rejection of Windows PE (`MZ`) and Linux ELF (`\x7fELF`) binaries disguised as text or documents.
17. **Suite 17: Zero-Fabrication Executive Summary**: Validates that AI-generated summaries strictly utilize verified employer records without injecting generic industry clichés.

---

## 🔒 Security Architecture

ResumeX AI treats resumes and candidate career data with strict confidentiality:

- **HttpOnly Cookie Authentication**: Session tokens are transmitted exclusively through `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) cookies, mitigating cross-site scripting (XSS) token theft.
- **CSRF Token Protection**: A dedicated `/api/auth/csrf` endpoint issues cryptographic CSRF tokens stored in a readable cookie. Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a matching `x-csrf-token` header, protecting against cross-site request forgery.
- **Bcrypt Work Factor 12**: Passwords are encrypted with 12 salt rounds, producing a defensive ~250–300ms verification latency to neutralize offline dictionary and brute-force attacks.
- **Multi-Tier Rate Limiting**: Dedicated rate-limiting tiers prevent abuse:
  - Authentication: 5 attempts per 15-minute window per IP.
  - AI Generation: 20 requests per minute per IP to protect quotas and prevent denial-of-wallet attacks.
  - File Uploads: 10 uploads per 10-minute window per IP to defend parser pipelines against resource exhaustion.
- **Magic-Byte Binary Inspection**: File uploads are inspected for authentic file headers (`%PDF` for PDF, `PK\x03\x04` for DOCX). Executable binaries (Windows PE, Linux ELF) are identified and rejected immediately regardless of file extension.
- **In-Memory Storage**: File uploads are buffered in memory via Multer and never written to unmonitored temporary disk directories.
- **IDOR / Resource Ownership Enforced**: Every resume, version, job description, and export request strictly verifies that the target resource belongs to the authenticated `user_id`.
- **Data Privacy Consideration**: Resumes often include personal identifying information (PII) such as personal addresses, phone numbers, and career history. The application architecture ensures that candidate data is isolated by user account.

---

## 🛡️ ResumeTruth & AI Safety

A foundational design tenet of ResumeX AI is **Zero-Fabrication Career Truth**:

### Core Anti-Hallucination Principles
1. **No Invented Metrics**: The AI is strictly prohibited from generating unsupported metrics (e.g., creating a *"40% increase in revenue"* or *"$2.5M budget savings"* if the original resume did not state that achievement).
2. **No Phantom Companies or Degrees**: The system never inserts unmentioned employers, universities, credentials, or certifications into resumes or summaries.
3. **Candidate Confirmation Guardrail**: If an AI rewrite includes a quantified claim that cannot be verified in the source text, it is flagged with:
   ```json
   {
     "requires_user_confirmation": true,
     "unverified_metrics": ["40%"],
     "reason": "Metric was not present in the original bullet. Please confirm before applying."
   }
   ```
4. **Constructive Suggestion over Fabrication**: If an achievement lacks quantifiable results, the system recommends that the candidate provide their actual numbers (e.g., using the Google X-Y-Z formula) rather than fabricating plausible metrics.

---

## ⚖️ ATS Diagnostic Disclaimer

> **Notice**: ResumeX AI provides **ATS-style diagnostic analysis** for educational and candidate preparation purposes only.
>
> Commercial Applicant Tracking Systems (including **Workday**, **Greenhouse**, **Taleo**, **Lever**, and **iCIMS**) use proprietary, vendor-confidential algorithms, private customer parsing configurations, and custom recruiter filter rules. ResumeX AI does not reproduce, license, or claim access to the proprietary source code or internal ranking algorithms of these commercial ATS platforms. Scores and recommendations are heuristic estimates based on industry-standard formatting guidelines and parsing best practices.

---

## 🗄️ Database & Schema Migrations

The application uses PostgreSQL with versioned schema migrations managed by `server/migrationRunner.ts`.

### Schema Architecture
- `001_initial.sql`: Sets up `schema_migrations` audit table, `users` table, and email uniqueness indices.
- `002_auth.sql`: Creates `sessions` table (with SHA-256 token hash storage, IP address, and user agent) and `oauth_accounts` table.
- `003_resume.sql`: Creates `resumes` table (with JSONB parsed data, title, raw text, and ATS score) and `resume_versions` table.
- `004_analysis.sql`: Creates `job_descriptions`, `job_matches`, and career gap tracking tables.
- `005_templates.sql`: Manages resume template configurations and catalog records.
- `006_security.sql`: Creates `exports` tracking table and `audit_events` log table.

### Automatic Migration Execution
Migrations run automatically on server boot via `db.ensureInitialized()`. The runner:
1. Creates the `schema_migrations` table if it does not exist.
2. Reads the migration directory (`dist/migrations` in production, `server/migrations` in development).
3. Executes pending `.sql` files in sequence within transactional client sessions.
4. Records each applied migration to guarantee idempotency.

---

## 📦 Production Deployment

### Production Build Flow
ResumeX AI builds into a self-contained production bundle:
```bash
# 1. Build client assets with Vite and bundle server with esbuild
npm run build

# 2. Launch production Node.js server
npm start
```

### Build Details
- `vite build` outputs optimized frontend assets to `dist/`.
- `esbuild server.ts` bundles all server-side TypeScript code into a single CommonJS artifact (`dist/server.cjs`), keeping external packages out via `--packages=external`.
- The build script packages all SQL files from `server/migrations/*.sql` into `dist/migrations/` so they are available in containerized runtimes.
- `npm start` executes `node dist/server.cjs`, serving the Express API and providing SPA fallback serving from `dist/` on port `3000`.

---

## 📸 Screenshots

| Candidate Dashboard | ATS Lab Diagnostic Simulator |
| :---: | :---: |
| *Add screenshots here* | *Add screenshots here* |

| Split-Screen Live Builder | Job Matching & Skill Gap Matrix |
| :---: | :---: |
| *Add screenshots here* | *Add screenshots here* |

---

## 🔌 API Overview

All API endpoints are prefixed with `/api` and return structured JSON responses.

### 1. Authentication & Session Management
- `GET /api/auth/csrf`: Retrieves a new CSRF token and sets the CSRF cookie.
- `GET /api/auth/config`: Returns active auth methods (`demoLoginEnabled`, `googleAuthEnabled`).
- `POST /api/auth/signup`: Registers a new user account (rate-limited).
- `POST /api/auth/login`: Authenticates with email and password, setting an `HttpOnly` JWT cookie (rate-limited).
- `POST /api/auth/demo-login`: Logs into the pre-seeded demo account (development mode only).
- `POST /api/auth/google`: Authenticates via Google OAuth 2.0 OIDC ID token (rate-limited).
- `POST /api/auth/logout`: Revokes the current session and clears cookies (requires auth).
- `POST /api/auth/change-password`: Updates password and re-hashes with bcrypt (requires auth).
- `GET /api/auth/sessions`: Lists all active user sessions with IP and user-agent details (requires auth).
- `DELETE /api/auth/sessions/:id`: Revokes a specific session (requires auth).
- `DELETE /api/auth/sessions-revoke-others`: Revokes all sessions except the active one (requires auth).
- `POST /api/auth/forgot-password`: Generates a password reset token (rate-limited).
- `POST /api/auth/reset-password`: Consumes a reset token to set a new password (rate-limited).
- `GET /api/auth/me`: Returns the authenticated user's profile and settings (requires auth).
- `DELETE /api/auth/delete-account`: Deletes candidate account and cascades related data (requires auth).

### 2. Resumes & Document Ingestion
- `GET /api/resumes`: Lists all resumes belonging to the authenticated user.
- `POST /api/resumes`: Creates a new resume document from scratch.
- `GET /api/resumes/:id`: Retrieves full resume details and structured data.
- `PUT /api/resumes/:id`: Updates resume content, sections, and metadata.
- `DELETE /api/resumes/:id`: Deletes a resume document.
- `POST /api/resumes/upload`: Uploads a PDF, DOCX, or TXT file with magic-byte validation and parsing (rate-limited).

### 3. Analysis, Scoring & Diagnostics
- `POST /api/resumes/:id/analyze`: Triggers NLP parsing, section extraction, and issue detection.
- `GET /api/resumes/:id/score`: Retrieves the composite score breakdown and deductions.
- `POST /api/resumes/:id/score`: Recomputes real-time ATS diagnostic scores.
- `GET /api/evaluation`: Returns NLP evaluation metrics across reference benchmarks.

### 4. Job Description Matching & Career Insights
- `GET /api/jobs`: Lists saved job descriptions.
- `POST /api/jobs`: Saves a new job description.
- `GET /api/jobs/:id`: Retrieves a specific job description.
- `DELETE /api/jobs/:id`: Deletes a job description.
- `POST /api/jobs/:jobId/match/:resumeId`: Computes match percentage, missing skills, and recommendations.
- `POST /api/career/gap`: Analyzes employment history for gaps (>90 days) and returns framing narratives.

### 5. AI Optimization & ResumeTruth
- `POST /api/resumes/:id/optimize/bullet`: Generates zero-fabrication rewrites for a bullet point (rate-limited).
- `POST /api/resumes/:id/optimize/summary`: Generates an executive summary tailored to a target role (rate-limited).
- `POST /api/resumes/:id/issues/:issueId/action`: Applies or dismisses an identified resume issue.
- `POST /api/resumes/:id/issues/batch-action`: Applies or dismisses multiple issues in a single batch.
- `POST /api/resumes/:id/issues/fix-safe`: Automatically applies all safe formatting, verb, and structure improvements.
- `POST /api/truth/verify`: Evaluates a text revision for unverified metrics or fabricated claims.

### 6. Version Management
- `GET /api/resumes/:id/versions`: Lists all saved historical version snapshots.
- `POST /api/resumes/:id/versions`: Saves a new named snapshot checkpoint.
- `POST /api/resumes/:id/versions/compare`: Computes section-by-section diffs between two versions.
- `POST /api/resumes/:id/versions/:versionId/restore`: Reverts the active resume to a prior version state.

### 7. Templates & Document Exports
- `GET /api/templates`: Lists available template master definitions and categories.
- `GET /api/templates/:id`: Retrieves configuration details for a specific template.
- `POST /api/exports/validate`: Runs pre-export diagnostic validation on resume completeness.
- `POST /api/exports/plain-text`: Exports clean, ATS-safe plain-text format.
- `POST /api/exports/docx`: Generates and downloads a formatted Microsoft Word DOCX file.
- `POST /api/exports/pdf`: Generates and downloads a print-ready PDF document.

### 8. System Health & Observability
- `GET /api/health`: System health probe reporting database connectivity, Gemini status, and uptime.
- `GET /api/ready`: Readiness probe verifying complete database migration initialization.
- `GET /api/audit`: Returns user audit event history (requires auth).

---

## 📊 Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate
    participant UI as React UI (Client)
    participant API as Express API
    participant Parser as Document Parser
    participant DB as PostgreSQL
    participant Gemini as Google Gemini API

    Candidate->>UI: Uploads Resume (PDF / DOCX)
    UI->>API: POST /api/resumes/upload (Multipart)
    API->>API: Validate Magic Bytes & Sanitize Name
    API->>Parser: Parse & De-Columnize Text
    Parser-->>API: Extracted Text & Sections
    API->>API: Extract Entities & Check Formulas
    API->>DB: INSERT into resumes & versions
    API-->>UI: Return Structured ResumeData & Initial Score

    Candidate->>UI: Request AI Bullet Optimization
    UI->>API: POST /api/resumes/:id/optimize/bullet
    API->>Gemini: Prompt with Verified Context & Zero-Fabrication Rules
    Gemini-->>API: Proposed Active Voice Rewrite
    API->>API: ResumeTruth: Verify No New Metrics Fabricated
    API-->>UI: Return Before/After Diff & Verification Status

    Candidate->>UI: Accept Suggestion & Click Download DOCX
    UI->>API: POST /api/exports/docx
    API->>API: Validate Pre-Export Diagnostics
    API->>API: Build Binary DOCX Buffer (docx)
    API-->>UI: Binary File Download Stream (.docx)
    UI-->>Candidate: Formatted Document Received
```

---

## ⚠️ Limitations

- **Proprietary ATS Discrepancies**: Vendor ATS algorithms are proprietary and closed-source. ResumeX AI provides heuristic diagnostic models for educational preparation, not guaranteed ATS scores.
- **Scanned & Flattened PDFs**: The document parser processes digital text streams. Scanned image-only PDFs without an embedded OCR text layer will yield limited extracted text.
- **Embedding Fallback Mode**: If external Gemini embedding services are unreachable or unconfigured, the job-matching engine falls back to deterministic Jaccard token overlap and keyword density matching.
- **Diagnostic Guidance, Not Hiring Guarantees**: Resume quality scores indicate formatting, readability, and keyword alignment. They do not guarantee job interviews or hiring outcomes.
- **Review Requirement**: Candidates must review all AI-assisted rewrites before submission to ensure accuracy and personal authenticity.

---

## 🗺️ Roadmap

The following enhancements represent planned future development:
- [ ] **Client-Side / Server OCR Pipeline**: Integration of an OCR extraction engine (e.g. Tesseract) to support image-only scanned PDFs.
- [ ] **Distributed Cache & Rate Limiter**: Transition from in-memory rate limiting to a Redis-backed token bucket to support multi-instance horizontal scaling.
- [ ] **Real-Time Job Board Sync**: Direct import integrations with public job posting APIs to streamline resume-to-JD matching.
- [ ] **Automated End-to-End Test Suite**: Comprehensive Playwright / Cypress browser automation suite for complete user journey validation.
- [ ] **Expanded Multilingual Parsing**: Support for multi-language resumes with localized section headers and grammar diagnostics.
- [ ] **Fine-Grained Audit Log Export**: Capability for candidates to download a complete security and data mutation audit log as CSV or JSON.

---

## 🤝 Contributing

Contributions to ResumeX AI are welcome. To contribute:

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/my-enhancement
   ```
3. **Commit Your Changes**: Ensure your changes adhere to project conventions.
4. **Run Validation Checks**:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
5. **Push to Your Fork**:
   ```bash
   git push origin feature/my-enhancement
   ```
6. **Open a Pull Request** with a detailed description of your changes.

---

## 📄 License

License: Not yet specified.

---

## 📌 Project Status

**Advanced development / portfolio-ready**

All 17 test suites (68 assertions) are passing, the TypeScript codebase compiles with zero diagnostics (`tsc --noEmit`), and the application builds cleanly for production.

---

## 👤 Author
Name:Pallem Dinesh Kumar Reddy 
github:dineshreddy0204
linkedin:https://www.linkedin.com/in/dinesh-reddy-pallem
