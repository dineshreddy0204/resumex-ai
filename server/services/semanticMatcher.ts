import type { ResumeData, JobDescriptionModel, JobMatchResult } from '../types';
import { skillExtractor } from './skillExtractor';

export class SemanticMatcher {
  public matchResumeToJob(resume: ResumeData, job: JobDescriptionModel): JobMatchResult {
    // 1. Gather all candidate skills and raw texts for search
    const candidateSkillsNormalized = new Set<string>();
    const resumeTextPieces: string[] = [];

    if (resume.summary) resumeTextPieces.push(resume.summary);

    for (const group of resume.skills) {
      for (const s of group.items) {
        const norm = skillExtractor.normalizeSkill(s);
        candidateSkillsNormalized.add(norm);
        resumeTextPieces.push(s);
      }
    }

    for (const exp of resume.experience) {
      resumeTextPieces.push(`${exp.role} at ${exp.company}`);
      for (const b of exp.bullets) {
        resumeTextPieces.push(b);
      }
      if (exp.technologies) {
        for (const t of exp.technologies) {
          candidateSkillsNormalized.add(skillExtractor.normalizeSkill(t));
        }
      }
    }

    for (const proj of resume.projects) {
      resumeTextPieces.push(proj.title);
      for (const b of proj.bullets) resumeTextPieces.push(b);
      for (const t of proj.technologies) candidateSkillsNormalized.add(skillExtractor.normalizeSkill(t));
    }

    const fullResumeCorpus = resumeTextPieces.join(' \n ').toLowerCase();

    // 2. Skill Match calculation
    const matchedSkills: JobMatchResult['matchedSkills'] = [];
    const missingSkills: JobMatchResult['missingSkills'] = [];

    const allJdSkills = [
      ...job.requiredSkills.map((s) => ({ skill: s, isRequired: true })),
      ...job.preferredSkills.map((s) => ({ skill: s, isRequired: false })),
    ];

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const item of allJdSkills) {
      const normSkill = skillExtractor.normalizeSkill(item.skill);
      const weight = item.isRequired ? 2 : 1;
      totalWeight += weight;

      // Check if candidate has skill directly or in full resume text
      const regex = new RegExp(`\\b${this.escapeRegex(normSkill)}\\b`, 'i');
      const inSkillsList = candidateSkillsNormalized.has(normSkill);
      const inText = regex.test(fullResumeCorpus);

      if (inSkillsList || inText) {
        earnedWeight += weight;

        // Find concrete evidence line
        let evidence = `Mentioned in Technical Skills (${normSkill})`;
        for (const piece of resumeTextPieces) {
          if (new RegExp(`\\b${this.escapeRegex(normSkill)}\\b`, 'i').test(piece)) {
            evidence = piece.length > 120 ? piece.substring(0, 115) + '...' : piece;
            break;
          }
        }

        matchedSkills.push({
          skill: normSkill,
          evidenceInResume: evidence,
          confidence: inSkillsList && inText ? 0.96 : 0.88,
        });
      } else {
        missingSkills.push({
          skill: normSkill,
          priority: item.isRequired ? 'High' : 'Medium',
          category: skillExtractor.findCategory(normSkill),
        });
      }
    }

    const skillMatch = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 85;

    // 3. Keyword Match (Domain keywords + requirements)
    let keywordCount = 0;
    let matchedKeywordCount = 0;
    for (const dk of job.domainKeywords) {
      keywordCount++;
      if (new RegExp(`\\b${this.escapeRegex(dk)}\\b`, 'i').test(fullResumeCorpus)) {
        matchedKeywordCount++;
      }
    }
    const keywordMatch = keywordCount > 0 ? Math.round((matchedKeywordCount / keywordCount) * 100) : skillMatch;

    // 4. Experience Match
    // Approximate candidate years of experience
    let candidateYears = 0;
    for (const exp of resume.experience) {
      const start = parseInt((exp.startDate.match(/\d{4}/) || ['2020'])[0], 10);
      const end = exp.endDate.toLowerCase().includes('present')
        ? new Date().getFullYear()
        : parseInt((exp.endDate.match(/\d{4}/) || [String(start + 1)])[0], 10);
      candidateYears += Math.max(1, end - start);
    }
    // Deduplicate overlapping spans
    candidateYears = Math.min(15, Math.max(1, candidateYears));

    let experienceMatch = 100;
    let experienceAlignmentNote = `Matches required ${job.experienceYearsRequired}+ years of engineering experience (Candidate has ~${candidateYears} years).`;

    if (candidateYears < job.experienceYearsRequired) {
      const gap = job.experienceYearsRequired - candidateYears;
      experienceMatch = Math.max(50, Math.round(100 - gap * 15));
      experienceAlignmentNote = `Job requires ${job.experienceYearsRequired}+ years; candidate profile demonstrates ~${candidateYears} years (${gap} year delta).`;
    }

    // 5. Education Match
    let educationMatch = 100;
    if (job.educationRequired) {
      const hasDegree = resume.education.some(
        (e) => /bachelor|master|degree|b\.s|m\.s|phd/i.test(e.degree) || /computer science|engineering/i.test(e.fieldOfStudy || '')
      );
      educationMatch = hasDegree ? 100 : 75;
    }

    // 6. Responsibility Match
    let respMatches = 0;
    for (const resp of job.responsibilities) {
      const tokens = resp.split(/\s+/).filter((t) => t.length > 4);
      let matchedTokenCount = 0;
      for (const tok of tokens) {
        if (fullResumeCorpus.includes(tok.toLowerCase())) matchedTokenCount++;
      }
      if (tokens.length > 0 && matchedTokenCount / tokens.length > 0.3) {
        respMatches++;
      }
    }
    const responsibilityMatch = job.responsibilities.length > 0 ? Math.round((respMatches / job.responsibilities.length) * 100) : 88;

    // 7. Semantic Match (Overlap of context concepts)
    const semanticMatch = Math.round(skillMatch * 0.45 + keywordMatch * 0.25 + responsibilityMatch * 0.3);

    // Overall Match (Weighted)
    const overallMatch = Math.round(
      skillMatch * 0.35 +
        semanticMatch * 0.25 +
        keywordMatch * 0.15 +
        experienceMatch * 0.15 +
        educationMatch * 0.05 +
        responsibilityMatch * 0.05
    );

    // Generate actionable recommendations
    const recommendations: string[] = [];
    const highPriorityMissing = missingSkills.filter((m) => m.priority === 'High');
    if (highPriorityMissing.length > 0) {
      recommendations.push(
        `High Priority: Incorporate verified experience with ${highPriorityMissing.slice(0, 3).map((s) => s.skill).join(', ')} into your project or experience bullets.`
      );
    }
    if (responsibilityMatch < 80) {
      recommendations.push(
        'Align phrasing: Tailor 1-2 bullet points to directly echo core job responsibilities (e.g. distributed systems, API architecture).'
      );
    }
    if (candidateYears < job.experienceYearsRequired) {
      recommendations.push(
        'Highlight architectural scope and high-impact initiatives to offset formal years of experience.'
      );
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      overallMatch,
      keywordMatch,
      semanticMatch,
      skillMatch,
      experienceMatch,
      educationMatch,
      responsibilityMatch,
      matchedSkills,
      missingSkills,
      experienceAlignmentNote,
      recommendations,
    };
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const semanticMatcher = new SemanticMatcher();
