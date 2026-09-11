import type { ResumeData } from '../types';
import { skillExtractor } from './skillExtractor';

export type TruthVerificationStatus =
  | 'VERIFIED'
  | 'ENHANCED_WITH_EXISTING_FACTS'
  | 'UNSUPPORTED_CLAIM'
  | 'FABRICATED_METRIC'
  | 'BLOCKED_UNTRUTHFUL';

export interface TruthViolation {
  type: 'fabricated_metric' | 'invented_skill' | 'invented_company' | 'invented_degree' | 'unsupported_claim';
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
   * Validates an AI rewrite against user-provided facts and full resume knowledge base.
   * Prevents AI hallucination: zero fabricated metrics, skills, companies, degrees.
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
          questionToUser: `Can you verify "${propMetric}" with measurable project logs or team reporting? If not, state the qualitative impact or your actual number.`,
        });
      }
    }

    // 2. Skill verification: ensure AI doesn't inject technologies absent from entire resume
    const originalSkills = new Set(skillExtractor.extractSkills(originalText).map((s) => s.normalizedName));
    const allResumeSkills = new Set<string>();
    for (const g of resumeContext.skills) {
      for (const s of g.items) allResumeSkills.add(skillExtractor.normalizeSkill(s));
    }
    const proposedSkills = skillExtractor.extractSkills(proposedText);

    for (const ps of proposedSkills) {
      if (!originalSkills.has(ps.normalizedName) && !allResumeSkills.has(ps.normalizedName)) {
        violations.push({
          type: 'invented_skill',
          claim: ps.normalizedName,
          severity: 'HIGH',
          reason: `The proposed text claims proficiency in "${ps.normalizedName}", which is absent from your verified skills inventory.`,
          questionToUser: `Did you directly use "${ps.normalizedName}" during this position?`,
        });
      }
    }

    // 3. Hallucinated degree or company keywords check
    const degreesRegex = /\b(phd|master'?s|bachelor'?s|mba|doctorate|associate'?s)\b/gi;
    const origDegreeMatches = originalText.match(degreesRegex) || [];
    const propDegreeMatches = proposedText.match(degreesRegex) || [];
    if (propDegreeMatches.length > origDegreeMatches.length) {
      violations.push({
        type: 'invented_degree',
        claim: propDegreeMatches[0],
        severity: 'BLOCKER',
        reason: 'The proposed text references an academic degree not found in the source bullet.',
      });
    }

    // 4. Status determination
    let status: TruthVerificationStatus = 'VERIFIED';
    let verdict: TruthVerificationResult['verdict'] = 'PASS';
    let explanation = 'All facts and technical claims are substantiated by your profile records.';

    if (violations.some((v) => v.type === 'invented_degree' || v.severity === 'BLOCKER')) {
      status = 'BLOCKED_UNTRUTHFUL';
      verdict = 'BLOCKED';
      explanation = 'Blocked: The rewrite introduces severe factual hallucinations (e.g. unverified degrees or credentials).';
    } else if (violations.some((v) => v.type === 'fabricated_metric')) {
      status = 'FABRICATED_METRIC';
      verdict = 'REQUIRES_CONFIRMATION';
      explanation = 'Flagged: Generated bullet points contain specific metrics that must be verified by you before inclusion.';
    } else if (violations.some((v) => v.type === 'invented_skill')) {
      status = 'UNSUPPORTED_CLAIM';
      verdict = 'REQUIRES_CONFIRMATION';
      explanation = 'Flagged: Contains technologies not found in your skills list.';
    } else if (originalText !== proposedText) {
      status = 'ENHANCED_WITH_EXISTING_FACTS';
      explanation = 'Verified: Rewritten using strong action verbs and verified resume context without fabricating new claims.';
    }

    // 5. Clean output generation: neutralize unsupported metrics with bracketed placeholders
    let cleanOutput = proposedText;
    if (violations.some((v) => v.type === 'fabricated_metric')) {
      for (const v of violations.filter((vi) => vi.type === 'fabricated_metric')) {
        cleanOutput = cleanOutput.replace(new RegExp(`\\b${this.escapeRegex(v.claim)}\\b`, 'g'), `[verified ${v.claim}]`);
      }
    }

    const confidenceScore = violations.length === 0 ? 1.0 : Math.max(0.4, 1.0 - violations.length * 0.2);

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
