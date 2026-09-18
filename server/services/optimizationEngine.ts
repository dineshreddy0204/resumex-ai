import type { ResumeData, AnalysisIssue, OptimizationSuggestion } from '../types';
import { getGeminiClient, isGeminiAvailable, getGeminiModel } from '../gemini';
import { resumeTruthEngine } from './resumeTruthEngine';
import { achievementAnalyzer } from './achievementAnalyzer';

export class OptimizationEngine {
  /**
   * Deterministic, zero-fabrication rewrite that replaces weak openings
   * with authoritative action verbs without inventing numbers or metrics.
   */
  public deterministicRewrite(bullet: string): string {
    const trimmed = bullet.trim();
    if (!trimmed) return trimmed;

    let rewritten = trimmed
      .replace(/^responsible for\s+(managing|leading|developing|building|creating|writing|designing|implementing)/i, (_m, p1) => {
        return p1.charAt(0).toUpperCase() + p1.slice(1);
      })
      .replace(/^responsible for\s+/i, 'Led ')
      .replace(/^helped (to\s+)?/i, 'Collaborated to ')
      .replace(/^worked on\s+/i, 'Engineered ')
      .replace(/^assisted with\s+/i, 'Contributed to ')
      .replace(/^tasked with\s+/i, 'Executed ')
      .replace(/^participated in\s+/i, 'Contributed directly to ')
      .replace(/^duties included\s+/i, 'Delivered ');

    rewritten = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);

    if (!rewritten.endsWith('.')) {
      rewritten += '.';
    }

    return rewritten;
  }

  /**
   * Optimize a specific bullet point using Action + Technology + Task + Result framework
   */
  public async rewriteBullet(
    bullet: string,
    roleTitle: string,
    company: string,
    resumeContext: ResumeData,
    entityId?: string,
    bulletIdx?: number
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
      fieldId: entityId ? `exp-${entityId}-b${bulletIdx ?? 0}` : undefined,
      target: {
        section: 'experience',
        id: entityId,
        bulletIdx,
      },
      originalText: bullet,
      proposedText: truthCheck.cleanOutput,
      before: bullet,
      after: truthCheck.cleanOutput,
      reason,
      confidence: 0.94,
      requires_user_confirmation: truthCheck.verdict !== 'PASS',
      truthCheckVerdict: truthCheck.verdict,
      truthStatus: truthCheck.status,
      truthViolations: truthCheck.violations,
      violationsExplanation: truthCheck.explanation,
      truthQuestion: truthCheck.violations[0]?.questionToUser,
    };
  }

  /**
   * Rewrite project bullet without hallucination
   */
  public async rewriteProjectBullet(
    bullet: string,
    projectTitle: string,
    technologies: string[],
    resumeContext: ResumeData,
    projectId?: string,
    bulletIdx?: number
  ): Promise<OptimizationSuggestion> {
    const gemini = getGeminiClient();
    let proposedText = '';
    let reason = '';

    if (isGeminiAvailable() && gemini) {
      try {
        const prompt = `Optimize this project bullet for "${projectTitle}" using technologies [${technologies.join(', ')}].
Adhere strictly to ResumeTruth:
- NEVER invent new numbers, percentages, or unmentioned technologies.
- Improve action verbs, architectural clarity, and task outcomes.

Original bullet: "${bullet}"

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
          proposedText = parsed.rewritten;
          reason = parsed.reason || 'Enhanced project impact and architectural clarity.';
        }
      } catch (err) {
        console.warn('Gemini project bullet optimization failed:', err);
      }
    }

    if (!proposedText) {
      proposedText = this.deterministicRewrite(bullet);
      reason = 'Strengthened action verb and technical phrasing using verified project facts.';
    }

    const truthCheck = resumeTruthEngine.verifyRewrite(bullet, proposedText, resumeContext);

    return {
      id: `opt-proj-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      section: 'projects',
      fieldId: projectId ? `proj-${projectId}-b${bulletIdx ?? 0}` : undefined,
      target: {
        section: 'projects',
        id: projectId,
        bulletIdx,
      },
      originalText: bullet,
      proposedText: truthCheck.cleanOutput,
      before: bullet,
      after: truthCheck.cleanOutput,
      reason,
      confidence: 0.94,
      requires_user_confirmation: truthCheck.verdict !== 'PASS',
      truthCheckVerdict: truthCheck.verdict,
      truthStatus: truthCheck.status,
      truthViolations: truthCheck.violations,
      violationsExplanation: truthCheck.explanation,
      truthQuestion: truthCheck.violations[0]?.questionToUser,
    };
  }

  /**
   * Improve executive summary
   */
  public async optimizeSummary(currentSummary: string, rawTargetRole: string, resumeContext: ResumeData): Promise<OptimizationSuggestion> {
    const gemini = getGeminiClient();
    let proposed = '';
    let reason = '';

    // Check if candidate actually has verified senior roles in history
    const candidateRoles = (resumeContext.experience || []).map((e) => (e.role || '').toLowerCase());
    const hasSeniorRole = candidateRoles.some((r) =>
      /\b(senior|lead|principal|staff|director|vp|head\s+of|manager|architect|chief)\b/i.test(r)
    );

    // Sanitize targetRole: if candidate has no senior experience, do not synthesize an unearned Senior title
    let targetRole = (rawTargetRole || '').trim();
    if (!targetRole) {
      targetRole = resumeContext.experience?.[0]?.role || 'Software Engineer';
    }
    if (!hasSeniorRole) {
      targetRole = targetRole.replace(/\b(senior|lead|principal|staff|director|vp|head\s+of|chief)\s+/gi, '').trim();
      if (!targetRole) targetRole = 'Software Engineer';
    }

    const displayOriginal = (currentSummary || '').trim() || 'No existing content';

    if (isGeminiAvailable() && gemini) {
      try {
        const companies = (resumeContext.experience || []).map((e) => `${e.role || e.title || 'Role'} at ${e.company || 'Organization'}`).filter(Boolean).join('; ');
        const prompt = `Elevate this professional resume summary for a target role of "${targetRole}".
Adhere strictly to Zero-Fabrication and ResumeTruth:
- Do NOT invent companies, degrees, unmentioned skills, or metrics.
- Only reference verified employment background and technical competencies provided below.
Original summary: "${currentSummary || 'None provided'}"
Known experience: ${companies || 'None specified'}
Known skills: ${(resumeContext.skills || []).flatMap((s) => s.items).join(', ')}

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
      const companyClause = recentExp && recentExp.company ? ` at ${recentExp.company}` : '';
      if (recentExp && roleTitle && topSkills) {
        proposed = `${targetRole || roleTitle} with professional background${companyClause}. Technical competencies include ${topSkills}. Focused on disciplined engineering execution and software reliability.`;
        reason = 'Formulated executive summary strictly referencing verified employment titles and recorded technical skills without unverified leadership or metric claims.';
      } else if (recentExp && roleTitle) {
        proposed = `${targetRole || roleTitle} with experience${companyClause}. Dedicated to high standards of technical precision.`;
        reason = 'Summarized candidate background using exclusively verified role titles without fabricating metrics, team size, or scale.';
      } else if (recentEdu && topSkills) {
        const fieldClause = recentEdu.fieldOfStudy || recentEdu.degree ? ` in ${recentEdu.fieldOfStudy || recentEdu.degree}` : '';
        const instClause = recentEdu.institution ? ` from ${recentEdu.institution}` : '';
        proposed = `Aspiring ${targetRole || 'Software Professional'} with academic background${fieldClause}${instClause}. Practical skill set includes ${topSkills}.`;
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

    const truthCheck = resumeTruthEngine.verifyRewrite(currentSummary || '', proposed, resumeContext);

    return {
      id: `opt-sum-${Date.now()}`,
      section: 'summary',
      fieldId: 'summary',
      target: {
        section: 'summary',
      },
      originalText: displayOriginal,
      proposedText: truthCheck.cleanOutput,
      before: displayOriginal,
      after: truthCheck.cleanOutput,
      reason,
      confidence: 0.92,
      requires_user_confirmation: truthCheck.verdict !== 'PASS',
      truthCheckVerdict: truthCheck.verdict,
      truthStatus: truthCheck.status,
      truthViolations: truthCheck.violations,
      violationsExplanation: truthCheck.explanation,
      truthQuestion: truthCheck.violations[0]?.questionToUser,
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
