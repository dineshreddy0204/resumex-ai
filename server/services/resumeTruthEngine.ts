import type { ResumeData } from '../types';
import { skillExtractor } from './skillExtractor';

export interface TruthVerificationResult {
  isCompliant: boolean;
  verdict: 'PASS' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
  violations: {
    type: 'invented_metric' | 'invented_skill' | 'invented_company' | 'invented_degree' | 'unsupported_claim';
    claim: string;
    reason: string;
    questionToUser?: string;
  }[];
  cleanOutput: string;
}

export class ResumeTruthEngine {
  /**
   * Validates an AI rewrite against original user-provided text and resume knowledge base.
   */
  public verifyRewrite(originalText: string, proposedText: string, resumeContext: ResumeData): TruthVerificationResult {
    const violations: TruthVerificationResult['violations'] = [];

    // 1. Metric check: detect numbers/percentages in proposed text that did not exist in original
    const origMetrics = this.extractNumericTokens(originalText);
    const propMetrics = this.extractNumericTokens(proposedText);

    for (const propMetric of propMetrics) {
      if (!origMetrics.has(propMetric)) {
        // AI added a new specific number!
        violations.push({
          type: 'invented_metric',
          claim: propMetric,
          reason: `The rewrite introduces a specific metric ("${propMetric}") that does not exist in your source text. ResumeX AI forbids fabricating performance numbers.`,
          questionToUser: `Do you have verified documentation or data confirming "${propMetric}"? If not, replace with a qualitative description or your real metric.`,
        });
      }
    }

    // 2. Skill check: check if proposed text injects completely new technical skills not in resume
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
          reason: `The proposed text mentions "${ps.normalizedName}", which is not part of your verified skills or original bullet.`,
          questionToUser: `Have you actively worked with ${ps.normalizedName} in this role?`,
        });
      }
    }

    // 3. Determine verdict
    let verdict: TruthVerificationResult['verdict'] = 'PASS';
    if (violations.some((v) => v.type === 'invented_metric')) {
      verdict = 'REQUIRES_CONFIRMATION';
    }
    if (violations.length > 2) {
      verdict = 'BLOCKED';
    }

    // Clean output: if unverified metric exists, replace with safe bracketed placeholder
    let cleanOutput = proposedText;
    if (violations.some((v) => v.type === 'invented_metric')) {
      for (const v of violations.filter((vi) => vi.type === 'invented_metric')) {
        cleanOutput = cleanOutput.replace(new RegExp(`\\b${this.escapeRegex(v.claim)}\\b`, 'g'), `[verified ${v.claim} or metric]`);
      }
    }

    return {
      isCompliant: violations.length === 0,
      verdict,
      violations,
      cleanOutput,
    };
  }

  private extractNumericTokens(text: string): Set<string> {
    const set = new Set<string>();
    // Match percentages, dollars, and distinct numbers
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
