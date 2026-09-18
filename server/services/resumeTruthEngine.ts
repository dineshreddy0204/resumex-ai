import type { ResumeData } from '../types';
import { skillExtractor } from './skillExtractor';

export type TruthVerificationStatus =
  | 'VERIFIED'
  | 'ENHANCED_WITH_EXISTING_FACTS'
  | 'UNSUPPORTED_CLAIM'
  | 'FABRICATED_METRIC'
  | 'BLOCKED_UNTRUTHFUL';

export interface TruthViolation {
  type:
    | 'fabricated_metric'
    | 'invented_skill'
    | 'invented_company'
    | 'invented_title'
    | 'invented_degree'
    | 'invented_certification'
    | 'unsupported_claim';
  claim: string;
  reason: string;
  questionToUser?: string;
  severity: 'HIGH' | 'MEDIUM' | 'BLOCKER';
}

export interface TruthVerificationResult {
  isCompliant: boolean;
  status: TruthVerificationStatus;
  verdict: 'PASS' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
  confidenceScore: number;
  violations: TruthViolation[];
  cleanOutput: string;
  explanation: string;
}

export class ResumeTruthEngine {
  /**
   * Validates an AI rewrite against user-provided facts and verified resume profile records.
   * STRICT ANTI-HALLUCINATION ENFORCEMENT:
   * AI MUST NEVER invent:
   * - metrics (percentages, revenues, user counts, performance multiples)
   * - employers / companies
   * - job titles
   * - skills / technologies
   * - certifications
   * - degrees
   * - dates
   */
  public verifyRewrite(originalText: string, proposedText: string, resumeContext: ResumeData): TruthVerificationResult {
    const violations: TruthViolation[] = [];

    // 1. Metric verification: detect numbers/percentages in proposed text not present in original
    const origMetrics = this.extractNumericTokens(originalText);
    const propMetrics = this.extractNumericTokens(proposedText);

    for (const propMetric of propMetrics) {
      if (!origMetrics.has(propMetric)) {
        violations.push({
          type: 'fabricated_metric',
          claim: propMetric,
          severity: 'HIGH',
          reason: `The rewrite introduces an unverified metric ("${propMetric}") that does not exist in your source resume. ResumeX AI forbids fabricating performance data.`,
          questionToUser: `Did you actually achieve "${propMetric}"? If verified, please confirm; otherwise provide your exact measured outcome.`,
        });
      }
    }

    // 2. Skill & Technology verification: ensure AI doesn't inject technologies absent from entire resume
    const originalSkills = new Set(skillExtractor.extractSkills(originalText).map((s) => s.normalizedName));
    const allResumeSkills = new Set<string>();
    for (const g of resumeContext.skills || []) {
      for (const s of g.items || []) allResumeSkills.add(skillExtractor.normalizeSkill(s));
    }
    for (const exp of resumeContext.experience || []) {
      for (const t of exp.technologies || []) allResumeSkills.add(skillExtractor.normalizeSkill(t));
    }
    const proposedSkills = skillExtractor.extractSkills(proposedText);

    for (const ps of proposedSkills) {
      if (!originalSkills.has(ps.normalizedName) && !allResumeSkills.has(ps.normalizedName)) {
        violations.push({
          type: 'invented_skill',
          claim: ps.normalizedName,
          severity: 'HIGH',
          reason: `The proposed text claims proficiency in "${ps.normalizedName}", which is absent from your verified skills inventory.`,
          questionToUser: `Did you directly use "${ps.normalizedName}" during this role?`,
        });
      }
    }

    // 3. Hallucinated degree check
    const degreesRegex = /\b(phd|master'?s|bachelor'?s|mba|doctorate|associate'?s|b\.s\.|m\.s\.)\b/gi;
    const origDegreeMatches = originalText.match(degreesRegex) || [];
    const propDegreeMatches = proposedText.match(degreesRegex) || [];
    if (propDegreeMatches.length > origDegreeMatches.length) {
      violations.push({
        type: 'invented_degree',
        claim: propDegreeMatches[0] || 'Unknown degree',
        severity: 'BLOCKER',
        reason: 'The proposed text references an academic degree not found in the source text.',
      });
    }

    // 4. Hallucinated certification check
    const certRegex = /\b(aws certified|pmp|cissp|scrum master|cka|ckad|gcp professional)\b/gi;
    const origCertMatches = originalText.match(certRegex) || [];
    const propCertMatches = proposedText.match(certRegex) || [];
    const userCerts = new Set((resumeContext.certifications || []).map((c) => c.name.toLowerCase()));
    for (const cm of propCertMatches) {
      const lowerCm = cm.toLowerCase();
      if (!origCertMatches.some((oc) => oc.toLowerCase().includes(lowerCm)) && !Array.from(userCerts).some((uc) => uc.includes(lowerCm))) {
        violations.push({
          type: 'invented_certification',
          claim: cm,
          severity: 'BLOCKER',
          reason: `The proposed text introduces an unverified professional credential ("${cm}").`,
          questionToUser: `Have you received the official "${cm}" certification?`,
        });
      }
    }

    // 5. Hallucinated Employer / Company check
    const knownCompanies = new Set((resumeContext.experience || []).map((e) => e.company.toLowerCase()));
    const companyKeywords = proposedText.match(/\b(?:at|for|joined)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\b/g) || [];
    for (const ck of companyKeywords) {
      const companyName = ck.replace(/\b(?:at|for|joined)\s+/i, '').trim().toLowerCase();
      if (companyName.length > 3 && !['scale', 'speed', 'enterprise', 'production'].includes(companyName)) {
        const inOrig = originalText.toLowerCase().includes(companyName);
        const inHistory = Array.from(knownCompanies).some((kc) => kc.includes(companyName));
        if (!inOrig && !inHistory) {
          violations.push({
            type: 'invented_company',
            claim: companyName,
            severity: 'BLOCKER',
            reason: `The proposed text references employer or organization "${companyName}" absent from your work history.`,
            questionToUser: `Did you work at or partner with "${companyName}"?`,
          });
        }
      }
    }

    // 5b. Hallucinated Job Title / Seniority check
    const candidateRoles = (resumeContext.experience || []).map((e) => (e.role || '').toLowerCase());
    const hasSeniorRole = candidateRoles.some((r) =>
      /\b(senior|lead|principal|staff|director|vp|head\s+of|manager|architect|chief)\b/i.test(r)
    );

    const seniorTitleRegex = /\b(senior|lead|principal|staff|director|vp|head of|manager|architect|chief)\s+(?:software\s+engineer|software\s+developer|developer|engineer|full\s*stack\s+developer|data\s+scientist|consultant|architect|manager)\b/gi;
    const propSeniorMatches = proposedText.match(seniorTitleRegex) || [];
    const origSeniorMatches = originalText.match(seniorTitleRegex) || [];

    for (const sm of propSeniorMatches) {
      const lowerSm = sm.toLowerCase();
      const inOrig = origSeniorMatches.some((om) => om.toLowerCase().includes(lowerSm));
      if (!inOrig && !hasSeniorRole) {
        violations.push({
          type: 'invented_title',
          claim: sm,
          severity: 'BLOCKER',
          reason: `The proposed optimization introduces an unsupported seniority title ("${sm}") not backed by your verified work history.`,
          questionToUser: `Have you held the official title "${sm}" in your career?`,
        });
      }
    }

    // 6. Status determination
    let status: TruthVerificationStatus = 'VERIFIED';
    let verdict: TruthVerificationResult['verdict'] = 'PASS';
    let explanation = 'All facts, metrics, and technical claims are verified against your source records.';

    if (violations.some((v) => v.severity === 'BLOCKER')) {
      status = 'BLOCKED_UNTRUTHFUL';
      verdict = 'BLOCKED';
      explanation = 'Optimization rejected because it contains unsupported information.';
    } else if (violations.some((v) => v.type === 'fabricated_metric')) {
      status = 'FABRICATED_METRIC';
      verdict = 'REQUIRES_CONFIRMATION';
      explanation = 'Flagged: Generated text contains unverified metrics that require explicit confirmation.';
    } else if (violations.some((v) => v.type === 'invented_skill')) {
      status = 'UNSUPPORTED_CLAIM';
      verdict = 'REQUIRES_CONFIRMATION';
      explanation = 'Flagged: Contains technologies not present in your verified skill inventory.';
    } else if (originalText !== proposedText) {
      status = 'ENHANCED_WITH_EXISTING_FACTS';
      explanation = 'Verified: Rewritten using strong action verbs and substantiated context without inventing facts.';
    }

    // 7. Clean output generation
    let cleanOutput = proposedText;
    if (violations.some((v) => v.type === 'fabricated_metric')) {
      for (const v of violations.filter((vi) => vi.type === 'fabricated_metric')) {
        cleanOutput = cleanOutput.replace(new RegExp(`\\b${this.escapeRegex(v.claim)}\\b`, 'g'), `[measured ${v.claim}]`);
      }
    }

    const confidenceScore = violations.length === 0 ? 1.0 : Math.max(0.3, 1.0 - violations.length * 0.2);

    return {
      isCompliant: violations.length === 0,
      status,
      verdict,
      confidenceScore,
      violations,
      cleanOutput,
      explanation,
    };
  }

  private extractNumericTokens(text: string): Set<string> {
    const set = new Set<string>();
    const matches = text.match(/\b\d+(?:\.\d+)?%|\$\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:k|m|b|million))?|\b\d+(?:k|m|b|million|thousand)\b|\b\d+\b/gi);
    if (matches) {
      for (const m of matches) {
        set.add(m.toLowerCase().trim());
      }
    }
    return set;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const resumeTruthEngine = new ResumeTruthEngine();
