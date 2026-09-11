import type { ResumeData, JobDescriptionModel, JobMatchResult } from '../types';
import { skillExtractor } from './skillExtractor';

export class SemanticMatcher {
  /**
   * Compute Cosine Similarity between two term-frequency/n-gram vector representations.
   * Formula: cos(A, B) = (A · B) / (||A|| * ||B||)
   */
  public calculateCosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [term, valA] of vecA.entries()) {
      normA += valA * valA;
      const valB = vecB.get(term);
      if (valB !== undefined) {
        dotProduct += valA * valB;
      }
    }

    for (const valB of vecB.values()) {
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Vectorize text into sub-linear TF n-gram features
   */
  public vectorizeText(text: string): Map<string, number> {
    const vec = new Map<string, number>();
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Unigrams
    for (const token of tokens) {
      vec.set(token, (vec.get(token) || 0) + 1);
    }

    // Bigrams (for contextual concepts like "distributed systems", "ci cd", etc.)
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      vec.set(bigram, (vec.get(bigram) || 0) + 1.5);
    }

    // Apply sub-linear scaling: 1 + ln(tf)
    const scaledVec = new Map<string, number>();
    for (const [k, count] of vec.entries()) {
      scaledVec.set(k, 1 + Math.log(count));
    }
    return scaledVec;
  }

  public matchResumeToJob(resume: ResumeData, job: JobDescriptionModel): JobMatchResult {
    // 1. Gather all candidate skills and raw texts for corpus
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
    const fullJobCorpus = `${job.title}\n${job.rawText}\n${job.responsibilities.join(' ')}\n${job.requiredSkills.join(' ')}`.toLowerCase();

    // 2. Hybrid Skill Match (Exact + Normalized)
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
          confidence: inSkillsList && inText ? 0.98 : 0.90,
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

    // 4. Vector Cosine Semantic Match
    const resumeVec = this.vectorizeText(fullResumeCorpus);
    const jobVec = this.vectorizeText(fullJobCorpus);
    const rawCosine = this.calculateCosineSimilarity(resumeVec, jobVec);
    // Scale cosine score typically ranging 0.35-0.85 in document retrieval to a 0-100 index
    const semanticMatch = Math.min(99, Math.max(40, Math.round((rawCosine / 0.75) * 100)));

    // 5. Experience Match
    let candidateYears = 0;
    for (const exp of resume.experience) {
      const start = parseInt((exp.startDate.match(/\d{4}/) || ['2020'])[0], 10);
      const end = exp.endDate.toLowerCase().includes('present')
        ? new Date().getFullYear()
        : parseInt((exp.endDate.match(/\d{4}/) || [String(start + 1)])[0], 10);
      candidateYears += Math.max(1, end - start);
    }
    candidateYears = Math.min(15, Math.max(1, candidateYears));

    let experienceMatch = 100;
    let experienceAlignmentNote = `Matches required ${job.experienceYearsRequired}+ years of engineering experience (Candidate has ~${candidateYears} years).`;

    if (candidateYears < job.experienceYearsRequired) {
      const gap = job.experienceYearsRequired - candidateYears;
      experienceMatch = Math.max(50, Math.round(100 - gap * 15));
      experienceAlignmentNote = `Job requires ${job.experienceYearsRequired}+ years; candidate profile demonstrates ~${candidateYears} years (${gap} year delta).`;
    }

    // 6. Education Match
    let educationMatch = 100;
    if (job.educationRequired) {
      const hasDegree = resume.education.some(
        (e) => /bachelor|master|degree|b\.s|m\.s|phd/i.test(e.degree) || /computer science|engineering/i.test(e.fieldOfStudy || '')
      );
      educationMatch = hasDegree ? 100 : 75;
    }

    // 7. Responsibility Match
    let respMatches = 0;
    for (const resp of job.responsibilities) {
      const tokens = resp.split(/\s+/).filter((t) => t.length > 4);
      let matchedTokenCount = 0;
      for (const tok of tokens) {
        if (fullResumeCorpus.includes(tok.toLowerCase())) matchedTokenCount++;
      }
      if (tokens.length > 0 && matchedTokenCount / tokens.length > 0.28) {
        respMatches++;
      }
    }
    const responsibilityMatch = job.responsibilities.length > 0 ? Math.round((respMatches / job.responsibilities.length) * 100) : 88;

    // Overall Hybrid Weighted Match
    const overallMatch = Math.round(
      skillMatch * 0.35 +
        semanticMatch * 0.25 +
        keywordMatch * 0.15 +
        experienceMatch * 0.15 +
        educationMatch * 0.05 +
        responsibilityMatch * 0.05
    );

    // Actionable recommendations based on real delta
    const recommendations: string[] = [];
    const highPriorityMissing = missingSkills.filter((m) => m.priority === 'High');
    if (highPriorityMissing.length > 0) {
      recommendations.push(
        `High Priority: Incorporate verified experience with ${highPriorityMissing.slice(0, 3).map((s) => s.skill).join(', ')} into your project or experience bullets.`
      );
    }
    if (semanticMatch < 75) {
      recommendations.push(
        `Vector Cosine Alignment (${semanticMatch}%): Strengthen domain terminology in summary and projects to mirror the position's architectural keywords.`
      );
    }
    if (responsibilityMatch < 80) {
      recommendations.push(
        'Align phrasing: Tailor 1-2 bullet points to directly reflect core job responsibilities (e.g. distributed systems, API architecture).'
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
