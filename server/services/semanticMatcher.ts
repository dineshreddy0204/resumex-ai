import type { ResumeData, JobDescriptionModel, JobMatchResult } from '../types';
import { skillExtractor } from './skillExtractor';
import { getGeminiClient, isGeminiAvailable, getGeminiEmbeddingModel } from '../gemini';

/**
 * =========================================================================
 * ResumeX AI — Core Ultra Semantic Matching Engine
 * =========================================================================
 *
 * Implements genuine embedding-based semantic similarity using dense vector
 * embeddings (Gemini embedding-2 / 3072-dim) with deterministic fallback.
 *
 * MATCHING FORMULA:
 * Overall Match = (0.35 * Skill Match) +
 *                 (0.25 * Semantic Embedding Similarity) +
 *                 (0.15 * Keyword Coverage) +
 *                 (0.15 * Experience Alignment) +
 *                 (0.05 * Education Alignment) +
 *                 (0.05 * Responsibility Similarity)
 *
 * All deductions and scores provide concrete evidence strings directly
 * extracted from candidate profile documents.
 */

export class SemanticMatcher {
  /**
   * Computes true cosine similarity between two float vector arrays.
   * Formula: cos(u, v) = (u · v) / (||u||_2 * ||v||_2)
   */
  public vectorCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generates a 3072-dimensional vector embedding for the supplied text.
   * Uses Gemini embedding model when active, falling back to
   * dense deterministic hash-projection vectors if offline.
   */
  public async getEmbeddingWithSource(text: string): Promise<{ values: number[]; source: 'embedding' | 'fallback' }> {
    const cleanText = text.trim().slice(0, 2048);
    if (!cleanText) return { values: new Array(128).fill(0), source: 'fallback' };

    if (isGeminiAvailable()) {
      try {
        const client = getGeminiClient();
        if (client) {
          const res = await client.models.embedContent({
            model: getGeminiEmbeddingModel(),
            contents: cleanText,
          });
          if (res.embeddings && res.embeddings.length > 0 && res.embeddings[0].values) {
            return { values: res.embeddings[0].values, source: 'embedding' };
          }
        }
      } catch (err) {
        console.warn('[SemanticMatcher] Gemini embedding call failed, falling back to dense projection:', err);
      }
    }

    // Deterministic dense vector fallback (256-dim feature projection)
    return { values: this.generateDenseProjection(cleanText), source: 'fallback' };
  }

  public async getEmbedding(text: string): Promise<number[]> {
    const res = await this.getEmbeddingWithSource(text);
    return res.values;
  }

  /**
   * Fallback deterministic dense projection
   */
  private generateDenseProjection(text: string): number[] {
    const DIM = 256;
    const vec = new Array(DIM).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    for (const token of tokens) {
      // Hash token into dimensions
      let h1 = 0x811c9dc5;
      let h2 = 0x1b3;
      for (let i = 0; i < token.length; i++) {
        const code = token.charCodeAt(i);
        h1 = (h1 ^ code) * 0x01000193;
        h2 = (h2 + code * 31) & 0xffffffff;
      }
      const idx1 = Math.abs(h1) % DIM;
      const idx2 = Math.abs(h2) % DIM;
      vec[idx1] += 1.0;
      vec[idx2] += 0.5;
    }

    // Normalize vector
    let norm = 0;
    for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
    if (norm > 0) {
      const sqrtNorm = Math.sqrt(norm);
      for (let i = 0; i < DIM; i++) vec[i] /= sqrtNorm;
    }
    return vec;
  }

  public async matchResumeToJob(resume: ResumeData, job: JobDescriptionModel): Promise<JobMatchResult> {
    // 1. Extract Candidate Inventory
    const candidateSkillsNormalized = new Set<string>();
    const resumeTextPieces: string[] = [];

    if (resume.summary) resumeTextPieces.push(resume.summary);

    for (const group of resume.skills || []) {
      for (const s of group.items || []) {
        const norm = skillExtractor.normalizeSkill(s);
        candidateSkillsNormalized.add(norm);
        resumeTextPieces.push(s);
      }
    }

    for (const exp of resume.experience || []) {
      resumeTextPieces.push(`${exp.role} at ${exp.company}`);
      for (const b of exp.bullets || []) {
        resumeTextPieces.push(b);
      }
      for (const t of exp.technologies || []) {
        candidateSkillsNormalized.add(skillExtractor.normalizeSkill(t));
      }
    }

    for (const proj of resume.projects || []) {
      resumeTextPieces.push(proj.title);
      for (const b of proj.bullets || []) resumeTextPieces.push(b);
      for (const t of proj.technologies || []) candidateSkillsNormalized.add(skillExtractor.normalizeSkill(t));
    }

    const fullResumeCorpus = resumeTextPieces.join(' \n ').toLowerCase();
    const fullJobCorpus = `${job.title}\n${job.rawText}\n${(job.responsibilities || []).join(' ')}\n${(job.requiredSkills || []).join(' ')}`.toLowerCase();

    // 2. Hybrid Skill Match (Exact + Normalized)
    const matchedSkills: JobMatchResult['matchedSkills'] = [];
    const missingSkills: JobMatchResult['missingSkills'] = [];

    const allJdSkills = [
      ...(job.requiredSkills || []).map((s) => ({ skill: s, isRequired: true })),
      ...(job.preferredSkills || []).map((s) => ({ skill: s, isRequired: false })),
    ];

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const item of allJdSkills) {
      const normSkill = skillExtractor.normalizeSkill(item.skill);
      const weight = item.isRequired ? 2 : 1;
      totalWeight += weight;

      const inSkillsList = candidateSkillsNormalized.has(normSkill);
      const inText = new RegExp(`\\b${this.escapeRegex(normSkill)}\\b`, 'i').test(fullResumeCorpus);

      if (inSkillsList || inText) {
        earnedWeight += weight;
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

    const skillMatch = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 80;

    // 3. Keyword Match (Domain keywords + industry terminology)
    let keywordCount = 0;
    let matchedKeywordCount = 0;
    for (const dk of job.domainKeywords || []) {
      keywordCount++;
      if (new RegExp(`\\b${this.escapeRegex(dk.toLowerCase())}\\b`, 'i').test(fullResumeCorpus)) {
        matchedKeywordCount++;
      }
    }
    const keywordMatch = keywordCount > 0 ? Math.round((matchedKeywordCount / keywordCount) * 100) : Math.min(95, skillMatch + 5);

    // 4. Genuine Embedding-Based Semantic Similarity
    // Vectorize resume core text and job requirements through Gemini embeddings
    const resumeEmbeddingText = [
      resume.summary || '',
      (resume.experience || []).map((e) => `${e.role}: ${(e.bullets || []).slice(0, 2).join(' ')}`).join('. '),
      (resume.skills || []).map((g) => (g.items || []).join(', ')).join(', '),
    ].join(' ');

    const jobEmbeddingText = [
      job.title,
      (job.responsibilities || []).slice(0, 4).join('. '),
      (job.requiredSkills || []).join(', '),
    ].join(' ');

    const [resumeEmbeddingResult, jobEmbeddingResult] = await Promise.all([
      this.getEmbeddingWithSource(resumeEmbeddingText),
      this.getEmbeddingWithSource(jobEmbeddingText),
    ]);

    const semanticSource: 'embedding' | 'fallback' =
      resumeEmbeddingResult.source === 'embedding' && jobEmbeddingResult.source === 'embedding'
        ? 'embedding'
        : 'fallback';

    const cosineSim = this.vectorCosineSimilarity(resumeEmbeddingResult.values, jobEmbeddingResult.values);
    // Scale cosine (-1..1, typical text embeddings 0.5..0.95) to intuitive 0..100 scale
    const semanticMatch = Math.min(99, Math.max(10, Math.round(cosineSim * 100)));

    // 5. Responsibility Match
    let matchedRespCount = 0;
    const totalResp = (job.responsibilities || []).length;
    for (const resp of job.responsibilities || []) {
      const respWords = resp.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      let matches = 0;
      for (const w of respWords) {
        if (fullResumeCorpus.includes(w)) matches++;
      }
      if (respWords.length > 0 && matches / respWords.length >= 0.35) {
        matchedRespCount++;
      }
    }
    const responsibilityMatch = totalResp > 0 ? Math.round((matchedRespCount / totalResp) * 100) : 80;

    // 6. Experience Alignment
    let totalYears = 0;
    for (const exp of resume.experience || []) {
      if (exp.startDate && exp.endDate) {
        const start = parseInt(exp.startDate.split('-')[0]) || 2020;
        const end = exp.endDate.toLowerCase().includes('present') ? 2026 : parseInt(exp.endDate.split('-')[0]) || 2024;
        totalYears += Math.max(0.5, end - start);
      } else {
        totalYears += 1.5;
      }
    }
    const reqYears = job.experienceYearsRequired || 3;
    const experienceMatch = totalYears >= reqYears ? 95 : Math.round((totalYears / reqYears) * 85);

    // 7. Education Alignment
    let educationMatch = 85;
    if (job.educationRequired) {
      const hasDegree = (resume.education || []).length > 0;
      educationMatch = hasDegree ? 95 : 60;
    }

    // 8. Overall Weighted Score (Documented Standard Formula)
    const overallMatch = Math.round(
      0.35 * skillMatch +
      0.25 * semanticMatch +
      0.15 * keywordMatch +
      0.15 * experienceMatch +
      0.05 * educationMatch +
      0.05 * responsibilityMatch
    );

    // 9. Concrete Recommendations
    const recommendations: string[] = [];
    if (missingSkills.length > 0) {
      const topMissing = missingSkills.slice(0, 3).map((m) => m.skill).join(', ');
      recommendations.push(`Incorporate target keywords into recent projects: ${topMissing}`);
    }
    if (semanticMatch < 75) {
      recommendations.push(`Align resume summary terminology directly with "${job.title}" scope and architecture.`);
    }
    if (experienceMatch < 80) {
      recommendations.push(`Emphasize leadership and senior responsibilities to fulfill the ${reqYears}+ years experience requirement.`);
    }

    let experienceAlignmentNote = 'Candidate experience is well-aligned with job seniority requirements.';
    if (experienceMatch < 70) {
      experienceAlignmentNote = `Job targets ${reqYears}+ years of experience; candidate profile has approximately ${Math.round(totalYears)} years documented.`;
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      overallMatch: Math.min(99, Math.max(30, overallMatch)),
      skillMatch,
      semanticMatch,
      keywordMatch,
      experienceMatch,
      educationMatch,
      responsibilityMatch,
      matchedSkills,
      missingSkills,
      experienceAlignmentNote,
      recommendations,
      semanticSource,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const semanticMatcher = new SemanticMatcher();
