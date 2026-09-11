import type { ResumeData, AnalysisIssue } from '../types';
import { getGeminiClient, isGeminiAvailable } from '../gemini';
import { resumeTruthEngine } from './resumeTruthEngine';
import { achievementAnalyzer } from './achievementAnalyzer';

export interface OptimizationSuggestion {
  id: string;
  issueId?: string;
  section: string;
  fieldId?: string;
  before: string;
  after: string;
  reason: string;
  confidence: number;
  requires_user_confirmation: boolean;
  truthCheckVerdict: 'PASS' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
  truthQuestion?: string;
}

export class OptimizationEngine {
  /**
   * Optimize a specific bullet point using Action + Technology + Task + Result framework
   */
  public async rewriteBullet(
    bullet: string,
    roleTitle: string,
    company: string,
    resumeContext: ResumeData
  ): Promise<OptimizationSuggestion> {
    const gemini = getGeminiClient();

    let proposedText = '';
    let reason = '';

    if (isGeminiAvailable() && gemini) {
      try {
        const prompt = `You are the ResumeX AI Core Ultra Optimization Engine.
You must adhere strictly to the ResumeTruth Anti-Hallucination Policy:
- NEVER invent new numbers, metrics, percentages, dollar figures, or technologies that do not exist in the source bullet.
- If the original bullet has no metric, improve action verb strength, technical clarity, and task specificity, and DO NOT fabricate a number.
- Use the structure: Strong Action Verb + Technical Context / Tool + Task + Qualitative Result.

Original bullet: "${bullet}"
Role: "${roleTitle}" at "${company}"

Respond in strict JSON with:
{
  "rewritten": "...",
  "reason": "..."
}`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.rewritten) {
          proposedText = parsed.rewritten;
          reason = parsed.reason || 'Elevated action verb and technical specificity without inventing unsupported claims.';
        }
      } catch (err) {
        console.warn('Gemini optimization call failed, falling back to deterministic rewrite:', err);
      }
    }

    // Deterministic Rule-Based Fallback
    if (!proposedText) {
      const evalResult = achievementAnalyzer.analyzeBullet(bullet);
      proposedText = this.deterministicRewrite(bullet);
      reason = evalResult.hasStrongActionVerb
        ? 'Refined phrasing and structural flow while preserving verified facts.'
        : 'Replaced weak or passive opening with authoritative action verb and clear technical context.';
    }

    // Pass through ResumeTruth verification layer!
    const truthCheck = resumeTruthEngine.verifyRewrite(bullet, proposedText, resumeContext);

    return {
      id: `opt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      section: 'experience',
      before: bullet,
      after: truthCheck.cleanOutput,
      reason,
      confidence: 0.94,
      requires_user_confirmation: truthCheck.verdict !== 'PASS',
      truthCheckVerdict: truthCheck.verdict,
      truthQuestion: truthCheck.violations[0]?.questionToUser,
    };
  }

  /**
   * Deterministic NLP rule-based rewrite that never hallucinates
   */
  private deterministicRewrite(bullet: string): string {
    let clean = bullet.trim();

    // Replace weak phrases
    clean = clean.replace(/^worked on\s+/i, 'Engineered solutions for ');
    clean = clean.replace(/^helped with\s+/i, 'Facilitated the execution of ');
    clean = clean.replace(/^responsible for\s+/i, 'Spearheaded and maintained ');
    clean = clean.replace(/^assisted in\s+/i, 'Collaborated to implement ');
    clean = clean.replace(/^handled\s+/i, 'Managed and optimized ');
    clean = clean.replace(/^did\s+/i, 'Delivered ');

    // Capitalize first letter
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    // Ensure trailing period
    if (!clean.endsWith('.')) clean += '.';

    return clean;
  }

  /**
   * Improve executive summary
   */
  public async optimizeSummary(currentSummary: string, targetRole: string, resumeContext: ResumeData): Promise<OptimizationSuggestion> {
    const gemini = getGeminiClient();
    let proposed = '';
    let reason = '';

    if (isGeminiAvailable() && gemini) {
      try {
        const prompt = `Elevate this professional resume summary for a target role of "${targetRole}".
Adhere strictly to ResumeTruth: Do NOT invent companies, degrees, or unmentioned skills.
Original summary: "${currentSummary}"
Known skills: ${resumeContext.skills.flatMap((s) => s.items).join(', ')}

Return JSON:
{
  "rewritten": "...",
  "reason": "..."
}`;

        const response = await gemini.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.rewritten) {
          proposed = parsed.rewritten;
          reason = parsed.reason;
        }
      } catch (err) {
        console.warn('Gemini summary optimization failed:', err);
      }
    }

    if (!proposed) {
      proposed = `Targeted ${targetRole} with proven background in scalable software delivery, robust technical architecture, and cross-functional leadership. Experienced in deploying resilient systems with high availability and measurable team velocity.`;
      reason = 'Structured executive summary to directly address target role competencies with authoritative professional tone.';
    }

    const truthCheck = resumeTruthEngine.verifyRewrite(currentSummary, proposed, resumeContext);

    return {
      id: `opt-sum-${Date.now()}`,
      section: 'summary',
      before: currentSummary,
      after: truthCheck.cleanOutput,
      reason,
      confidence: 0.92,
      requires_user_confirmation: true,
      truthCheckVerdict: truthCheck.verdict,
    };
  }

  /**
   * Run full issue detection across the resume
   */
  public detectAllIssues(resumeData: ResumeData): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    // Check summary
    if (!resumeData.summary || resumeData.summary.length < 50) {
      issues.push({
        id: `iss-sum-${Date.now()}`,
        issue_type: 'missing_section',
        severity: 'medium',
        section: 'summary',
        evidence: resumeData.summary || 'Empty summary',
        reason: 'Professional summary is missing or too short to anchor candidate seniority.',
        suggestion: 'Add a 2-3 sentence executive summary highlighting core domain experience and value proposition.',
        confidence: 0.95,
        requires_user_confirmation: true,
        status: 'pending',
      });
    }

    // Check experience bullets
    for (const exp of resumeData.experience) {
      for (const bullet of exp.bullets) {
        const evalRes = achievementAnalyzer.analyzeBullet(bullet, 'experience');
        issues.push(...evalRes.issues);
      }
    }

    // Check projects
    if (!resumeData.projects || resumeData.projects.length === 0) {
      issues.push({
        id: `iss-proj-${Date.now()}`,
        issue_type: 'missing_section',
        severity: 'low',
        section: 'projects',
        evidence: '0 projects listed',
        reason: 'Technical projects validate practical tool application outside corporate boundaries.',
        suggestion: 'Add 1-2 notable projects with links and technology tags.',
        confidence: 0.9,
        requires_user_confirmation: true,
        status: 'pending',
      });
    }

    return issues;
  }
}

export const optimizationEngine = new OptimizationEngine();
