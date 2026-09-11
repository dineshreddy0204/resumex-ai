import type { AnalysisIssue } from '../types';

export interface BulletEvaluation {
  text: string;
  section: string;
  hasStrongActionVerb: boolean;
  actionVerb: string | null;
  verbTier: 'strong' | 'moderate' | 'weak' | 'none';
  hasQuantification: boolean;
  quantifiedMetrics: string[];
  hasTechnicalContext: boolean;
  hasOutcome: boolean;
  qualityScore: number; // 0-100
  issues: AnalysisIssue[];
  suggestedImprovement?: string;
}

const STRONG_ACTION_VERBS = [
  'accelerated',
  'achieved',
  'architected',
  'automated',
  'championed',
  'delivered',
  'eliminated',
  'engineered',
  'established',
  'executed',
  'generated',
  'headed',
  'implemented',
  'improved',
  'increased',
  'launched',
  'maximized',
  'mentored',
  'minimized',
  'optimized',
  'orchestrated',
  'outperformed',
  'overhauled',
  'pioneered',
  'reduced',
  'restructured',
  'scaled',
  'spearheaded',
  'standardized',
  'streamlined',
  'surpassed',
  'transformed',
];

const MODERATE_ACTION_VERBS = [
  'built',
  'created',
  'designed',
  'developed',
  'led',
  'maintained',
  'managed',
  'organized',
  'produced',
  'programmed',
  'published',
  'resolved',
  'tested',
  'trained',
  'updated',
  'wrote',
];

const WEAK_ACTION_VERBS = [
  'worked on',
  'helped with',
  'responsible for',
  'assisted in',
  'participated in',
  'contributed to',
  'tasked with',
  'handled',
  'did',
  'looked into',
  'tried to',
  'dealt with',
  'involved in',
];

// Patterns for quantifiable metrics
const QUANTIFICATION_PATTERNS = [
  /\b\d+(?:\.\d+)?%\b/g, // 40%, 12.5%
  /\$\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:k|m|b|million|billion|thousand))?\b/gi, // $1.2M, $50k
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|b|million|billion|thousand)\b/gi, // 4.2M, 50k
  /\b(?:sub-)?\d+(?:\.\d+)?\s*(?:ms|s|seconds|minutes|hours)\b/gi, // 80ms, 2.5s
  /\b\d+\s*(?:active users|users|clients|customers|requests|transactions|events\/sec|qps|rps)\b/gi,
  /\b(?:reduced|increased|boosted|slashed|accelerated)\s+by\s+\d+/gi,
];

export class AchievementAnalyzer {
  public analyzeBullet(bullet: string, section: string = 'experience'): BulletEvaluation {
    const trimmed = bullet.trim();
    const lower = trimmed.toLowerCase();
    const issues: AnalysisIssue[] = [];

    // 1. Action Verb Detection
    let verbTier: BulletEvaluation['verbTier'] = 'none';
    let actionVerb: string | null = null;

    for (const weak of WEAK_ACTION_VERBS) {
      if (lower.startsWith(weak) || lower.includes(`was ${weak}`) || lower.includes(`were ${weak}`)) {
        verbTier = 'weak';
        actionVerb = weak;
        break;
      }
    }

    if (verbTier === 'none') {
      for (const strong of STRONG_ACTION_VERBS) {
        if (new RegExp(`^${strong}\\b`, 'i').test(lower)) {
          verbTier = 'strong';
          actionVerb = strong;
          break;
        }
      }
    }

    if (verbTier === 'none') {
      for (const mod of MODERATE_ACTION_VERBS) {
        if (new RegExp(`^${mod}\\b`, 'i').test(lower)) {
          verbTier = 'moderate';
          actionVerb = mod;
          break;
        }
      }
    }

    // 2. Quantification Check
    const metrics: string[] = [];
    for (const pattern of QUANTIFICATION_PATTERNS) {
      const matches = trimmed.match(pattern);
      if (matches) {
        metrics.push(...matches);
      }
    }
    const hasQuantification = metrics.length > 0;

    // 3. Technical Context & Outcome
    const hasTechnicalContext = /(?:using|via|in|with|built on|leveraging|through)\s+[A-Za-z0-9+#.]+/i.test(trimmed) ||
      /\b(?:React|Node|Python|SQL|AWS|Docker|Kubernetes|TypeScript|API|Go|CI\/CD)\b/i.test(trimmed);

    const hasOutcome = /(?:resulting in|yielding|saving|enabling|improving|reducing|increasing|driving|to achieve)\b/i.test(trimmed) ||
      hasQuantification;

    // Calculate score
    let score = 50;
    if (verbTier === 'strong') score += 20;
    else if (verbTier === 'moderate') score += 10;
    else if (verbTier === 'weak') score -= 20;

    if (hasQuantification) score += 25;
    if (hasTechnicalContext) score += 10;
    if (hasOutcome) score += 15;
    score = Math.min(100, Math.max(20, score));

    // Generate specific issues & recommendations
    if (verbTier === 'weak') {
      issues.push({
        id: `weak-verb-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        issue_type: 'weak_bullet',
        severity: 'high',
        section,
        evidence: trimmed,
        reason: `Begins with passive or low-impact phrasing ("${actionVerb}"). Weak verbs diminish the candidate's ownership.`,
        suggestion: 'Replace with an authoritative action verb like "Architected", "Engineered", "Optimized", or "Delivered".',
        confidence: 0.95,
        requires_user_confirmation: true,
        status: 'pending',
      });
    }

    if (!hasQuantification && trimmed.length > 40) {
      issues.push({
        id: `missing-metric-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        issue_type: 'missing_metric',
        severity: 'medium',
        section,
        evidence: trimmed,
        reason: 'Missing measurable outcome or quantified business/technical impact. Recruiter screening algorithms favor quantified achievements.',
        suggestion: 'Add a measurable result if available (e.g. latency improvement, percentage efficiency gain, or revenue impact).',
        confidence: 0.9,
        requires_user_confirmation: true,
        status: 'pending',
      });
    }

    if (trimmed.length > 220) {
      issues.push({
        id: `overlong-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        issue_type: 'overlong_sentence',
        severity: 'low',
        section,
        evidence: trimmed.substring(0, 70) + '...',
        reason: 'Bullet exceeds 220 characters, reducing reader scan speed and scannability on ATS screens.',
        suggestion: 'Split into two focused achievement bullets or tighten verbose phrasing.',
        confidence: 0.92,
        requires_user_confirmation: true,
        status: 'pending',
      });
    }

    return {
      text: trimmed,
      section,
      hasStrongActionVerb: verbTier === 'strong',
      actionVerb,
      verbTier,
      hasQuantification,
      quantifiedMetrics: metrics,
      hasTechnicalContext,
      hasOutcome,
      qualityScore: score,
      issues,
    };
  }
}

export const achievementAnalyzer = new AchievementAnalyzer();
