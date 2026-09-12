import type { ResumeData, ResumeScoreBreakdown } from '../types';
import { atsAnalyzer } from './atsAnalyzer';
import { achievementAnalyzer } from './achievementAnalyzer';

export interface ScoringWeights {
  contentQuality: number; // 0.15
  atsCompatibility: number; // 0.20
  skills: number; // 0.15
  experience: number; // 0.15
  projects: number; // 0.10
  achievements: number; // 0.10
  grammar: number; // 0.05
  formatting: number; // 0.05
  readability: number; // 0.05
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  contentQuality: 0.15,
  atsCompatibility: 0.2,
  skills: 0.15,
  experience: 0.15,
  projects: 0.1,
  achievements: 0.1,
  grammar: 0.05,
  formatting: 0.05,
  readability: 0.05,
};

export class ScoringEngine {
  private weights: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS };

  public setWeights(newWeights: Partial<ScoringWeights>) {
    this.weights = { ...this.weights, ...newWeights };
  }

  public getWeights(): ScoringWeights {
    return { ...this.weights };
  }

  public calculateResumeScore(resumeData: ResumeData): ResumeScoreBreakdown {
    const deductions: ResumeScoreBreakdown['deductions'] = [];

    // 1. ATS Score
    const atsResult = atsAnalyzer.analyzeAtsCompatibility(resumeData);
    const atsCompatibility = atsResult.overallAtsScore;

    // 2. Skills Dimension Score
    const totalSkills = (resumeData.skills || []).reduce((sum, g) => sum + (g.items?.length || 0), 0);
    let skillsScore = Math.min(98, Math.max(30, 45 + totalSkills * 2.8));
    if (totalSkills < 6) {
      skillsScore = 55;
      deductions.push({
        category: 'Skills',
        reason: 'Low technical skill count. Resumes with fewer than 6 skills miss broad recruiter keyword filters.',
        points: 8,
        recommendation: 'Expand with core programming languages, frameworks, databases, and development tooling.',
      });
    }

    // 3. Experience Dimension Score
    let experienceScore = 50;
    const experienceList = resumeData.experience || [];
    if (experienceList.length === 0) {
      experienceScore = 20;
      deductions.push({
        category: 'Experience',
        reason: 'No work experience entries present.',
        points: 25,
        recommendation: 'Detail at least 1-3 professional or internship roles with dated bullet points.',
      });
    } else {
      let bulletCount = 0;
      let strongVerbCount = 0;
      let quantifiedCount = 0;

      for (const exp of experienceList) {
        for (const bullet of exp.bullets || []) {
          bulletCount++;
          const evaluation = achievementAnalyzer.analyzeBullet(bullet, 'experience');
          if (evaluation.hasStrongActionVerb) strongVerbCount++;
          if (evaluation.hasQuantification) quantifiedCount++;
        }
      }

      const verbRatio = bulletCount > 0 ? strongVerbCount / bulletCount : 0;
      const quantRatio = bulletCount > 0 ? quantifiedCount / bulletCount : 0;

      experienceScore = Math.round(
        60 +
          Math.min(20, experienceList.length * 7) +
          Math.min(15, verbRatio * 20) +
          Math.min(15, quantRatio * 20)
      );

      if (quantRatio < 0.3 && bulletCount > 3) {
        deductions.push({
          category: 'Experience',
          reason: `Low metric density (${Math.round(quantRatio * 100)}% of bullets quantified). Recruiters look for business outcomes.`,
          points: 5,
          recommendation: 'Add quantifiable results (e.g. latency, dollar savings, throughput, or user growth) to key achievements.',
        });
      }
    }
    experienceScore = Math.min(100, Math.max(30, experienceScore));

    // 4. Projects Dimension Score
    let projectsScore = 60;
    if (resumeData.projects && resumeData.projects.length > 0) {
      projectsScore = Math.min(96, 75 + resumeData.projects.length * 7);
    } else {
      projectsScore = 50;
    }

    // 5. Achievements Dimension Score
    let achievementsScore = 70;
    if (resumeData.achievements && resumeData.achievements.length > 0) {
      achievementsScore = Math.min(95, 80 + resumeData.achievements.length * 6);
    }

    // 6. Content Quality Score
    const hasSummary = Boolean(resumeData.summary && resumeData.summary.length > 40);
    const summaryLength = resumeData.summary?.length || 0;
    let contentQuality = 75;
    if (hasSummary && summaryLength > 80 && summaryLength < 450) {
      contentQuality += 15;
    } else if (!hasSummary) {
      contentQuality -= 10;
      deductions.push({
        category: 'Content Quality',
        reason: 'Missing or overly brief professional summary.',
        points: 4,
        recommendation: 'Write a concise 2-3 sentence executive summary framing your seniority, core domain, and key impact.',
      });
    }
    contentQuality = Math.min(98, Math.max(40, contentQuality));

    // 7. Grammar & Polish Score
    let grammarScore = 95;
    // Check for common passive patterns
    let passiveCount = 0;
    for (const exp of experienceList) {
      for (const b of exp.bullets || []) {
        if (/was responsible for|were involved in|helped with/i.test(b)) {
          passiveCount++;
        }
      }
    }
    if (passiveCount > 0) {
      grammarScore -= passiveCount * 3;
      deductions.push({
        category: 'Grammar & Tone',
        reason: `Detected ${passiveCount} instances of passive voice or low-agency phrasing.`,
        points: passiveCount * 3,
        recommendation: 'Replace passive phrases with active verbs in past tense (e.g. "Spearheaded", "Constructed", "Optimized").',
      });
    }
    grammarScore = Math.max(70, grammarScore);

    // 8. Formatting Score
    let formattingScore = 92;
    if (atsResult.fileSafety.columnsDetected) formattingScore -= 6;
    if (atsResult.fileSafety.tablesDetected) formattingScore -= 4;

    // 9. Readability Score (Flesch-Kincaid & sentence length estimate)
    let readabilityScore = 90;
    const totalExpBullets = experienceList.reduce((sum, exp) => sum + (exp.bullets?.length || 0), 0);
    const avgWordsPerBullet =
      experienceList.reduce(
        (sum, exp) => sum + (exp.bullets || []).reduce((bSum, b) => bSum + b.split(/\s+/).length, 0),
        0
      ) / Math.max(1, totalExpBullets);

    if (avgWordsPerBullet > 30) {
      readabilityScore -= 8;
      deductions.push({
        category: 'Readability',
        reason: `Average bullet length is high (${Math.round(avgWordsPerBullet)} words/bullet), making rapid scanning difficult for recruiters.`,
        points: 4,
        recommendation: 'Target 15-24 words per bullet for optimal visual rhythm and cognitive uptake.',
      });
    }

    // Weighted Overall Score Calculation
    const overall = Math.round(
      contentQuality * this.weights.contentQuality +
        atsCompatibility * this.weights.atsCompatibility +
        skillsScore * this.weights.skills +
        experienceScore * this.weights.experience +
        projectsScore * this.weights.projects +
        achievementsScore * this.weights.achievements +
        grammarScore * this.weights.grammar +
        formattingScore * this.weights.formatting +
        readabilityScore * this.weights.readability
    );

    return {
      overall: Math.min(100, Math.max(25, overall)),
      contentQuality,
      atsCompatibility,
      skillsScore,
      experienceScore,
      projectsScore,
      achievementsScore,
      grammarScore,
      formattingScore,
      readabilityScore,
      deductions,
    };
  }
}

export const scoringEngine = new ScoringEngine();
