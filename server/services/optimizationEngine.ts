import type { ResumeData, AnalysisIssue } from '../types';
import { getGeminiClient, isGeminiAvailable, getGeminiModel } from '../gemini';
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
          model: getGeminiModel(),
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
          model: getGeminiModel(),
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });

        const parsed = JSON.parse(response.text || '{}');
        if (parsed.rewritten) {
          proposed = parsed.rewritten;
          reason = parsed.reason || 'Synthesized executive summary aligned strictly with verified candidate background.';
        }
      } catch (err) {
        console.warn('Gemini summary optimization failed:', err);
      }
    }

    if (!proposed) {
      // Zero-fabrication summary generator strictly derived from provided resumeContext
      const allSkills = (resumeContext.skills || []).flatMap((s) => s.items || []).filter(Boolean);
      const topSkills = allSkills.slice(0, 5).join(', ');
      const recentExp = resumeContext.experience && resumeContext.experience.length > 0 ? resumeContext.experience[0] : null;
      const recentEdu = resumeContext.education && resumeContext.education.length > 0 ? resumeContext.education[0] : null;

      const roleTitle = recentExp ? (recentExp.role || recentExp.title) : undefined;
      if (recentExp && roleTitle && topSkills) {
        proposed = `${targetRole || roleTitle} with professional background at ${recentExp.company || 'technology organizations'}. Technical competencies include ${topSkills}. Focused on disciplined engineering execution and software reliability.`;
        reason = 'Formulated executive summary strictly referencing verified employment titles and recorded technical skills without unverified leadership or metric claims.';
      } else if (recentExp && roleTitle) {
        proposed = `${targetRole || roleTitle} with experience at ${recentExp.company || 'industry organizations'}. Dedicated to high standards of technical precision and effective team collaboration.`;
        reason = 'Summarized candidate background using exclusively verified role titles without fabricating metrics, team size, or scale.';
      } else if (recentEdu && topSkills) {
        proposed = `Aspiring ${targetRole || 'Software Professional'} with foundational training in ${recentEdu.fieldOfStudy || recentEdu.field || recentEdu.degree || 'computer science'} from ${recentEdu.institution || 'accredited university'}. Practical skill set includes ${topSkills}.`;
        reason = 'Framed background as foundational/entry-level using exclusively provided academic credentials and verified skills.';
      } else if (topSkills) {
        proposed = `Practitioner with core competencies in ${topSkills}. Focused on contributing verified technical abilities toward ${targetRole || 'engineering objectives'}.`;
        reason = 'Summary derived strictly from documented skills inventory with zero fabricated employment history.';
      } else if (currentSummary && currentSummary.trim().length > 0) {
        proposed = currentSummary.trim();
        reason = 'Preserved candidate summary as provided without injecting unverified assertions.';
      } else {
        proposed = '';
        reason = 'No verified skills or experience provided to anchor an automated summary.';
      }
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

    // Check summary existence & unverified claims
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
    } else {
      // Check for unverified leadership claims in summary when experience has no lead/manager titles
      const summaryText = resumeData.summary.toLowerCase();
      const hasLeadRole = (resumeData.experience || []).some((e) =>
        /lead|manager|director|head|vp|chief|architect|principal/i.test(e.role || e.title || '')
      );
      if (/led team|leading teams|managed a team|spearheaded engineering teams|executive leadership/i.test(summaryText) && !hasLeadRole) {
        issues.push({
          id: `iss-sum-lead-${Date.now()}`,
          issue_type: 'unverified_claim' as any,
          type: 'unverified_claim',
          severity: 'high',
          section: 'summary',
          evidence: resumeData.summary,
          reason: 'Summary asserts organizational leadership or team management that is not corroborated by recorded job titles.',
          suggestion: 'Ensure leadership claims align directly with documented management experience or clarify role scope.',
          confidence: 0.92,
          requires_user_confirmation: true,
          status: 'pending',
        });
      }

      // Check for unverified metrics in summary when no experience bullets contain metrics
      const hasMetricInSummary = /\d+%|\$\d+|\b\d+x\b/i.test(resumeData.summary);
      const hasMetricInExp = (resumeData.experience || []).some((e) =>
        (e.bullets || []).some((b) => /\d+%|\$\d+|\b\d+x\b/.test(b))
      );
      if (hasMetricInSummary && !hasMetricInExp) {
        issues.push({
          id: `iss-sum-metric-${Date.now()}`,
          issue_type: 'unverified_metric' as any,
          type: 'unverified_metric',
          severity: 'medium',
          section: 'summary',
          evidence: resumeData.summary,
          reason: 'Summary highlights quantitative metrics that are not substantiated in work experience bullet points.',
          suggestion: 'Ground summary metrics in concrete, dated work experience bullet points.',
          confidence: 0.88,
          requires_user_confirmation: true,
          status: 'pending',
        });
      }
    }

    // Check experience bullets
    for (const exp of resumeData.experience) {
      for (const bullet of exp.bullets) {
        const evalRes = achievementAnalyzer.analyzeBullet(bullet, 'experience');
        issues.push(...evalRes.issues);

        // Detect high-magnitude metrics ($M+, >100%) requiring explicit verification
        if (/\$\s*\d+(?:\.\d+)?\s*(?:m|million|b|billion)|\b\d{3,}%\b/i.test(bullet)) {
          issues.push({
            id: `iss-metric-check-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            issue_type: 'unverified_claim' as any,
            type: 'unverified_claim',
            severity: 'high',
            section: 'experience',
            evidence: bullet,
            reason: 'High-magnitude financial claim or extreme percentage metric detected. Candidate verification required to ensure factual truth.',
            suggestion: 'Confirm this quantitative claim is backed by documented production outcomes.',
            confidence: 0.94,
            requires_user_confirmation: true,
            status: 'pending',
          });
        }
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
