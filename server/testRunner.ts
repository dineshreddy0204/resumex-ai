import fs from 'fs';
import path from 'path';
import { nlpEvaluation } from './services/nlpEvaluation';
import { documentParser } from './services/documentParser';
import { resumeExtractor } from './services/resumeExtractor';
import { atsAnalyzer } from './services/atsAnalyzer';
import { exportEngine } from './services/exportEngine';
import { resumeTruthEngine } from './services/resumeTruthEngine';
import { resolveMigrationsDir } from './migrationRunner';
import { UploadSecurity } from './services/uploadSecurity';
import { optimizationEngine } from './services/optimizationEngine';
import { requireCsrf, generateCsrfToken } from './auth';
import type { ResumeData } from './types';

async function runTests() {
  console.log('==========================================');
  console.log('   ResumeX AI — Automated Test Suite     ');
  console.log('==========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
      failed++;
    }
  }

  // --- Test Suite 1: Document Parser & Normalization ---
  console.log('Test Suite 1: Document Parser Normalization & De-Columnization');
  const sampleCorpus = `
Candidate: Jordan Lee
Email: jordan.lee@example.com | Phone: (555) 987-6543 | Location: San Francisco, CA

PROFESSIONAL EXPERIENCE
Senior Software Engineer                                      Acme Cloud Systems
Jan 2022 - Present                                            San Francisco, CA
* Architected distributed message queue reducing latency by 45% across 200 microservices.
* Led a cross-functional team of 6 engineers to launch Kubernetes platform.

EDUCATION
B.S. in Computer Science                                      Stanford University
2018 - 2022                                                   Stanford, CA

TECHNICAL SKILLS
Languages: Python, TypeScript, Go, SQL
Technologies: Docker, Kubernetes, PostgreSQL, AWS, React
`;

  const parsedDoc = await documentParser.parseDocument(Buffer.from(sampleCorpus), 'sample.txt');
  assert(parsedDoc.text.length > 50, 'Parsed text contains content');
  assert(parsedDoc.sections.length >= 3, 'Detected at least 3 standard sections');
  assert(!parsedDoc.layoutInfo.hasMultiColumnClues, 'Single-column text verified as single-column');

  // Multi-column sample de-columnization test
  const twoColSample = `Left Column Item 1          Right Column Item 1
Left Column Item 2          Right Column Item 2
Left Column Item 3          Right Column Item 3`;
  const deCol = documentParser.deColumnizeText(twoColSample);
  assert(deCol.text.includes('Left Column Item 1'), 'De-columnizer preserves left column contents');
  assert(deCol.text.includes('Right Column Item 1'), 'De-columnizer preserves right column contents');

  // --- Test Suite 2: Resume Extraction without Hallucination ---
  console.log('\nTest Suite 2: Resume Extraction (Zero Hardcoded Hallucinations)');
  const extracted = resumeExtractor.extractStructuredResume(parsedDoc);
  assert(extracted.data.personal_info.name.length > 0, 'Extracted candidate name');
  assert(extracted.data.personal_info.email.includes('@'), 'Extracted valid email address');
  assert(extracted.data.experience.length >= 1, 'Extracted experience role');
  assert(extracted.data.skills.length >= 1, 'Extracted skills category');
  assert(
    extracted.data.personal_info.name !== 'Candidate Name',
    'Did not fall back to hallucinated default name "Candidate Name"'
  );

  // --- Test Suite 3: 5-Engine ATS Compatibility Simulation ---
  console.log('\nTest Suite 3: 5 Corporate ATS Engine Simulations');
  const atsRes = atsAnalyzer.analyzeAtsCompatibility(extracted.data);
  assert(atsRes.overallAtsScore >= 50, 'Computed overall ATS score');
  assert(atsRes.engineSimulations !== undefined, 'Engine simulations array populated');
  assert(atsRes.engineSimulations?.length === 5, 'Contains simulations for all 5 enterprise ATS engines');

  const engineNames = atsRes.engineSimulations?.map((e) => e.engine) || [];
  assert(engineNames.includes('Workday'), 'Includes Workday ATS simulation');
  assert(engineNames.includes('Greenhouse'), 'Includes Greenhouse ATS simulation');
  assert(engineNames.includes('Taleo'), 'Includes Taleo ATS simulation');
  assert(engineNames.includes('Lever'), 'Includes Lever ATS simulation');
  assert(engineNames.includes('iCIMS'), 'Includes iCIMS ATS simulation');

  // --- Test Suite 4: Export Engine (DOCX & Plain Text) ---
  console.log('\nTest Suite 4: Export Engine Validation & File Generation');
  const validation = exportEngine.validateForExport(extracted.data);
  assert(validation.isValid, 'Pre-export validation passes for complete resume');
  assert(validation.checks.length >= 4, 'Includes required pre-export diagnostic checks');

  const plainTextExport = exportEngine.generatePlainText(extracted.data);
  assert(plainTextExport.includes('TECHNICAL SKILLS'), 'Plain-text export includes technical skills section');
  assert(plainTextExport.includes(extracted.data.personal_info.email), 'Plain-text export contains candidate contact');

  const docxBuffer = await exportEngine.generateDocx(extracted.data, 'ats-classic');
  assert(docxBuffer instanceof Buffer, 'Generated DOCX as a binary Buffer');
  assert(docxBuffer.length > 1000, `DOCX buffer contains valid file size (${docxBuffer.length} bytes)`);

  const pdfBuffer = await exportEngine.generatePdf(extracted.data, 'ats-classic');
  assert(pdfBuffer instanceof Buffer, 'Generated PDF as a binary Buffer');
  assert(pdfBuffer.length > 1000, `PDF buffer contains valid file size (${pdfBuffer.length} bytes)`);

  // --- Test Suite 5: ResumeTruth Anti-Hallucination Engine ---
  console.log('\nTest Suite 5: ResumeTruth Anti-Hallucination Verification');
  const safeRewrite = resumeTruthEngine.verifyRewrite(
    'Assisted with Python backend services.',
    'Engineered robust Python backend services with microservice architecture.',
    extracted.data
  );
  assert(safeRewrite.isCompliant, 'Allows legitimate structural impact rewrites using verified skills');

  const hallucinatedRewrite = resumeTruthEngine.verifyRewrite(
    'Assisted with database queries.',
    'Managed $50M revenue budget and increased sales by 850%.',
    extracted.data
  );
  assert(
    !hallucinatedRewrite.isCompliant && hallucinatedRewrite.violations.some((v) => v.type === 'fabricated_metric'),
    'Flags unverified invented budget and percentage metrics as fabricated_metric violations'
  );

  // --- Test Suite 6: NLP Evaluation Benchmark Suite ---
  console.log('\nTest Suite 6: NLP Evaluation Suite Benchmarking');
  const evalReport = nlpEvaluation.runEvaluationSuite();
  assert(evalReport.overallF1 >= 80, `NLP benchmark F1 score meets production threshold (${evalReport.overallF1}%)`);
  assert(evalReport.metrics.length === 4, 'Evaluated all 4 NLP metric dimensions');

  // --- Test Suite 7: File Upload Security & Magic Byte Validation ---
  console.log('\nTest Suite 7: Upload Security & Magic Byte Sanitization');
  const { UploadSecurity } = await import('./services/uploadSecurity');
  const validPdfHeader = Buffer.from('%PDF-1.4 sample pdf content test');
  const pdfCheck = UploadSecurity.validateUpload(validPdfHeader, 'my_resume.pdf', 'application/pdf');
  assert(pdfCheck.isValid, 'Accepts authentic PDF file with %PDF magic bytes');
  assert(pdfCheck.sanitizedFileName === 'my_resume.pdf', 'Sanitized clean filename correctly');

  const spoofedPdf = Buffer.from('MZ9000 this is an executable binary');
  const spoofCheck = UploadSecurity.validateUpload(spoofedPdf, 'malicious.pdf', 'application/pdf');
  assert(!spoofCheck.isValid, 'Rejects spoofed executable disguised as PDF');

  const unsafeName = UploadSecurity.sanitizeFileName('../../etc/passwd.docx');
  assert(!unsafeName.includes('..') && !unsafeName.includes('/'), 'Strips path traversal from upload filenames');

  // --- Test Suite 8: Dynamic Scoring Engine ---
  console.log('\nTest Suite 8: Evidence-Based Dynamic Scoring Engine');
  const { scoringEngine } = await import('./services/scoringEngine');
  const resumeScore = scoringEngine.calculateResumeScore(extracted.data);
  assert(resumeScore.overall > 0 && resumeScore.overall <= 100, `Calculates dynamic overall score (${resumeScore.overall}/100)`);
  assert(resumeScore.atsCompatibility >= 0, 'Computes ATS compatibility score component');
  assert(Array.isArray(resumeScore.deductions), 'Populates audit deductions list');

  // --- Test Suite 9: Schema Migration System ---
  console.log('\nTest Suite 9: Schema Migrations Verification');
  const { MigrationRunner } = await import('./migrationRunner');
  assert(typeof MigrationRunner.runMigrations === 'function', 'MigrationRunner exposes idempotent runMigrations function');

  // --- Test Suite 10: Auth Token & Password Hashing Security ---
  console.log('\nTest Suite 10: Cookie Auth Token Security & HMAC Validation');
  const { generateToken, verifyToken, hashPassword, verifyPassword } = await import('./auth');
  const testUser = {
    id: 'usr_sec_101',
    email: 'sec@resumex.ai',
    name: 'Security User',
    passwordHash: 'hash',
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };
  const validToken = generateToken(testUser);
  assert(typeof validToken === 'string' && validToken.split('.').length === 3, 'Issues valid 3-part HMAC SHA-256 JWT token');

  const decoded = verifyToken(validToken);
  assert(decoded?.sub === testUser.id && decoded?.email === testUser.email, 'Cryptographically verifies authentic token');

  const tamperedToken = validToken.slice(0, -5) + 'xxxxx';
  const tamperedDecoded = verifyToken(tamperedToken);
  assert(tamperedDecoded === null, 'Strictly rejects tampered or signature-mismatched token');

  const emptyDecoded = verifyToken('');
  assert(emptyDecoded === null, 'Rejects empty token string');

  const hashedPw = await hashPassword('StrongPassword2026!');
  const pwValid = await verifyPassword('StrongPassword2026!', hashedPw);
  const pwInvalid = await verifyPassword('WrongPassword123', hashedPw);
  assert(pwValid === true, 'Verifies correct password with bcrypt');
  assert(pwInvalid === false, 'Rejects incorrect password with bcrypt');

  // --- Test Suite 11: Google OIDC & Firebase Auth Token Verification & Claim Enforcement ---
  console.log('\nTest Suite 11: Google OIDC & Firebase Auth Validation Constraints');
  const { googleAuthService } = await import('./services/googleAuth');
  let missingTokenError = false;
  try {
    await googleAuthService.verifyIdToken('');
  } catch (err: any) {
    missingTokenError = true;
  }
  assert(missingTokenError, 'Rejects empty ID token');

  let malformedTokenError = false;
  try {
    await googleAuthService.verifyIdToken('not-a-valid-jwt-token');
  } catch (err: any) {
    malformedTokenError = true;
  }
  assert(malformedTokenError, 'Rejects malformed non-JWT token string');

  // Test Firebase ID token with unverified forged signature
  const fakeHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid-123' })).toString('base64url');
  const fakeFirebasePayload = Buffer.from(
    JSON.stringify({
      iss: 'https://securetoken.google.com/massive-tracer-sds98',
      aud: 'massive-tracer-sds98',
      sub: 'forged-user-id',
      email: 'attacker@evil.com',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 10,
    })
  ).toString('base64url');
  const fakeSignature = Buffer.from('unverified_fake_signature_bytes').toString('base64url');
  const forgedFirebaseToken = `${fakeHeader}.${fakeFirebasePayload}.${fakeSignature}`;

  let forgedTokenRejected = false;
  try {
    await googleAuthService.verifyIdToken(forgedFirebaseToken);
  } catch (err: any) {
    forgedTokenRejected = true;
  }
  assert(forgedTokenRejected, 'Strictly rejects forged/unverified Firebase ID token');

  // Test token with unauthorized issuer
  const invalidIssuerPayload = Buffer.from(
    JSON.stringify({
      iss: 'https://evil-unauthorized-issuer.com',
      sub: 'user-1',
      email: 'user@example.com',
    })
  ).toString('base64url');
  const invalidIssuerToken = `${fakeHeader}.${invalidIssuerPayload}.${fakeSignature}`;

  let invalidIssuerRejected = false;
  try {
    await googleAuthService.verifyIdToken(invalidIssuerToken);
  } catch (err: any) {
    invalidIssuerRejected = true;
  }
  assert(invalidIssuerRejected, 'Strictly rejects tokens with unauthorized issuer claim');

  // --- Test Suite 12: Zero-Fabrication AI & Optimization Engine ---
  console.log('\nTest Suite 12: Zero-Fabrication AI & Unverified Metric Detection');
  const { optimizationEngine } = await import('./services/optimizationEngine');
  const testResumeWithFabricatedMetric: ResumeData = {
    personal_info: {
      name: 'Dev Candidate',
      email: 'dev@example.com',
      phone: '555-0100',
      location: 'San Francisco, CA',
    },
    summary: 'Full-stack software developer',
    skills: [{ category: 'Core', items: ['TypeScript', 'Node.js'] }],
    experience: [
      {
        id: 'exp-1',
        company: 'Startup Corp',
        role: 'Software Developer',
        startDate: '2023',
        endDate: '2024',
        bullets: ['Managed $15M revenue and increased conversions by 300% without verification.'],
      },
    ],
    education: [],
    projects: [],
    certifications: [],
    achievements: [],
  };

  const detectedIssues = optimizationEngine.detectAllIssues(testResumeWithFabricatedMetric);
  const unverifiedIssue = detectedIssues.find(
    (i) => i.type === 'unverified_claim' || i.type === 'truth_violation' || i.type === 'fabricated_metric'
  );
  assert(Boolean(unverifiedIssue), 'Detects unverified metric/claim requiring user verification');
  assert(
    unverifiedIssue?.requires_user_confirmation === true,
    'Flags unverified claim with requires_user_confirmation = true to protect candidate truth'
  );

  // --- Test Suite 13: Evidence-Based ATS Corpus Scoring & Canonical Aliases ---
  console.log('\nTest Suite 13: Evidence-Based ATS Corpus Scoring & Canonical Aliases');
  const testAtsEvidenceResume: ResumeData = {
    personal_info: {
      name: 'Evidence Candidate',
      email: 'candidate@example.com',
      phone: '555-9000',
      location: 'Austin, TX',
    },
    summary: 'Senior Cloud Engineer proficient with microservices, Postgres databases, and K8s orchestration.',
    skills: [{ category: 'Data & Infra', items: ['PostgreSQL', 'Kubernetes', 'Go'] }],
    experience: [
      {
        id: 'exp-ev-1',
        company: 'Cloud Corp',
        role: 'Senior Cloud Engineer',
        startDate: '2021',
        endDate: '2024',
        bullets: [
          'Maintained high-throughput postgres clusters with zero downtime across 12 node groups.',
          'Configured automated deployment pipelines for containerized workloads.',
        ],
      },
    ],
    education: [
      {
        id: 'edu-ev-1',
        institution: 'State Tech',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Engineering',
        startDate: '2016',
        endDate: '2020',
      },
    ],
    projects: [],
    certifications: [],
    achievements: [],
  };

  const atsEvidenceResult = atsAnalyzer.analyzeAtsCompatibility(
    testAtsEvidenceResume,
    'Seeking a Senior Cloud Engineer with experience in PostgreSQL, Kubernetes, and Golang.'
  );

  assert(atsEvidenceResult.keywordEvidence !== undefined, 'Returns keywordEvidence breakdown');
  assert(
    (atsEvidenceResult.keywordEvidence?.matchedCount || 0) > 0,
    'Matches keywords using canonical alias dictionary (e.g. Postgres -> PostgreSQL)'
  );
  assert(
    atsEvidenceResult.engineSimulations !== undefined &&
      atsEvidenceResult.engineSimulations.every((s) => s.simulationLabel && s.simulationLabel.includes('ATS simulation')),
    'Labels vendor simulations explicitly as ATS-style heuristic models'
  );
  assert(
    atsEvidenceResult.keywordEvidence?.stuffingDetected === false,
    'Verifies natural keyword density without stuffing false positives'
  );

  // --- Test Suite 14: Production Migration Packaging & Directory Resolution ---
  console.log('\nTest Suite 14: Production Migration Packaging & Directory Resolution');
  const resolvedDir = resolveMigrationsDir();
  assert(fs.existsSync(resolvedDir), 'Resolves migrations directory dynamically', resolvedDir);
  const migrationFiles = fs.readdirSync(resolvedDir).filter((f) => f.endsWith('.sql'));
  assert(migrationFiles.length >= 6, 'Locates all schema migration files in resolved path', `Found: ${migrationFiles.join(', ')}`);
  assert(
    migrationFiles.includes('001_initial.sql') && migrationFiles.includes('002_auth.sql') && migrationFiles.includes('006_security.sql'),
    'Contains 001_initial.sql, 002_auth.sql, and 006_security.sql'
  );

  // --- Test Suite 15: CSRF Middleware Hardening (Zero Test Bypasses) ---
  console.log('\nTest Suite 15: CSRF Security & Request Mutation Protection');
  let csrfStatus: number | null = null;
  let csrfResponse: any = null;
  const mockMutatingReq = {
    method: 'POST',
    path: '/api/resumes/123',
    headers: {},
    cookies: {},
  } as any;
  const mockMutatingRes = {
    status: (code: number) => {
      csrfStatus = code;
      return {
        json: (data: any) => {
          csrfResponse = data;
        },
      };
    },
  } as any;
  let nextTriggered = false;

  requireCsrf(mockMutatingReq, mockMutatingRes, () => {
    nextTriggered = true;
  });

  assert(!nextTriggered, 'Blocks mutating request without CSRF tokens');
  assert(csrfStatus === 403, 'Returns HTTP 403 Forbidden for missing CSRF token');
  assert(
    csrfResponse?.error?.code === 'CSRF_VALIDATION_FAILED',
    'Returns structured CSRF_VALIDATION_FAILED error response'
  );

  // Valid CSRF check
  const testToken = generateCsrfToken();
  const validReq = {
    method: 'POST',
    path: '/api/resumes/123',
    headers: { 'x-csrf-token': testToken, cookie: `resumex_csrf=${testToken}` },
  } as any;
  let validNextTriggered = false;
  requireCsrf(validReq, mockMutatingRes, () => {
    validNextTriggered = true;
  });
  assert(validNextTriggered, 'Accepts mutating request with matching CSRF cookie and header');

  // --- Test Suite 16: Binary Executable Rejection & Magic Byte Inspection ---
  console.log('\nTest Suite 16: Upload Security & Executable Binary Payload Rejection');
  const fakeWinExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
  const winExeResult = UploadSecurity.validateUpload(fakeWinExe, 'resume.txt', 'text/plain');
  assert(!winExeResult.isValid, 'Rejects Windows PE binary executable payload (.exe masked as .txt)');
  assert(winExeResult.error?.includes('Windows executable binary signature detected') === true, 'Correctly reports executable signature violation');

  const fakeElf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]); // \x7fELF header
  const elfResult = UploadSecurity.validateUpload(fakeElf, 'notes.txt', 'text/plain');
  assert(!elfResult.isValid, 'Rejects Linux ELF binary executable disguised as text');

  const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB > 10MB limit
  const oversizedResult = UploadSecurity.validateUpload(oversizedBuffer, 'huge.pdf', 'application/pdf');
  assert(!oversizedResult.isValid, 'Rejects file exceeding 10MB maximum limit');

  // --- Test Suite 17: Zero-Fabrication AI & Unsupported Claim Prevention ---
  console.log('\nTest Suite 17: Zero-Fabrication Summary & Content Truth Verification');
  const minimalResume: ResumeData = {
    personal_info: { name: 'Taylor Swift', email: 'taylor@example.com', phone: '', location: '' },
    summary: '',
    experience: [
      {
        id: 'exp-1',
        role: 'Full-Stack Developer',
        company: 'Stripe',
        location: 'San Francisco, CA',
        startDate: '2021',
        endDate: 'Present',
        bullets: ['Built payment APIs'],
      },
    ],
    education: [],
    skills: [{ category: 'Languages', items: ['TypeScript', 'Node.js'] }],
    projects: [],
    certifications: [],
    achievements: [],
  };

  const summaryGenResult = await optimizationEngine.optimizeSummary(
    '',
    'Senior Software Engineer',
    minimalResume
  );
  assert(
    !summaryGenResult.after.includes('technology organizations'),
    'Does not inject "technology organizations" placeholder'
  );
  assert(
    !summaryGenResult.after.includes('industry organizations'),
    'Does not inject "industry organizations" placeholder'
  );
  assert(
    !summaryGenResult.after.includes('accredited university'),
    'Does not inject "accredited university" placeholder'
  );
  assert(
    summaryGenResult.after.includes('Stripe'),
    'Uses actual verified company from resume context'
  );
  assert(
    summaryGenResult.after.includes('TypeScript'),
    'Uses actual verified skills from resume context'
  );

  console.log('\n==========================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('==========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
