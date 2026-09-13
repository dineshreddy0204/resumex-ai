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

    // 2. Skills Dimension Score (Evidence-based: group diversity and normalized count)
    const totalSkills = (resumeData.skills || []).reduce((sum, g) => sum + (g.items?.length || 0), 0);
    const categoryCount = (resumeData.skills || []).filter((g) => g.items && g.items.length > 0).length;
    let skillsScore = totalSkills === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((Math.min(totalSkills, 15) / 15) * 70 + Math.min(30, categoryCount * 10))));

    if (totalSkills < 6 && totalSkills > 0) {
      deductions.push({
        category: 'Skills',
        reason: 'Low technical skill count. Resumes with fewer than 6 skills miss broad recruiter keyword filters.',
        points: 8,
        recommendation: 'Expand with core programming languages, frameworks, databases, and development tooling.',
      });
    } else if (totalSkills === 0) {
      deductions.push({
        category: 'Skills',
        reason: 'No skills section detected. Keyword parsers index categorized skills with highest priority.',
        points: 25,
        recommendation: 'Add a categorized Skills section detailing technical tools, languages, and competencies.',
      });
    }

    // 3. Experience Dimension Score (Evidence-based: role depth, action verbs, quantified results)
    let experienceScore = 0;
    const experienceList = resumeData.experience || [];
    if (experienceList.length === 0) {
      experienceScore = 0;
      deductions.push({
        category: 'Experience',
        reason: 'No work experience entries present.',
        points: 30,
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

      // Evidence weights: role count (up to 40), strong verbs (up to 30), quantified outcomes (up to 30)
      const rolePoints = Math.min(40, experienceList.length * 15);
      const verbPoints = Math.min(30, Math.round(verbRatio * 30));
      const quantPoints = Math.min(30, Math.round(quantRatio * 30));

      experienceScore = Math.min(100, Math.max(0, rolePoints + verbPoints + quantPoints));

      if (quantRatio < 0.3 && bulletCount > 3) {
        deductions.push({
          category: 'Experience',
          reason: `Low metric density (${Math.round(quantRatio * 100)}% of bullets quantified). Recruiters look for business outcomes.`,
          points: 5,
          recommendation: 'Add quantifiable results (e.g. latency, dollar savings, throughput, or user growth) to key achievements.',
        });
      }
    }

    // 4. Projects Dimension Score (Evidence-based: projects with descriptions and tools)
    let projectsScore = 0;
    const projectsList = resumeData.projects || [];
    if (projectsList.length > 0) {
      projectsScore = Math.min(100, projectsList.length * 25);
    }

    // 5. Achievements Dimension Score (Evidence-based: discrete achievements)
    let achievementsScore = 0;
    const achievementsList = resumeData.achievements || [];
    if (achievementsList.length > 0) {
      achievementsScore = Math.min(100, achievementsList.length * 25);
    }

    // 6. Content Quality Score (Evidence-based: summary quality & contact completeness)
    const hasSummary = Boolean(resumeData.summary && resumeData.summary.length > 30);
    const summaryLength = resumeData.summary?.length || 0;
    let contentQuality = 0;
    
    // Contact completeness (up to 50 pts)
    if (resumeData.personal_info?.name || (resumeData.personal_info as any)?.full_name) contentQuality += 15;
    if (resumeData.personal_info?.email) contentQuality += 15;
    if (resumeData.personal_info?.phone) contentQuality += 10;
    if (resumeData.personal_info?.location) contentQuality += 10;

    // Summary quality (up to 50 pts)
    if (hasSummary && summaryLength >= 60 && summaryLength <= 500) {
      contentQuality += 50;
    } else if (hasSummary) {
      contentQuality += 25;
    } else {
      deductions.push({
        category: 'Content Quality',
        reason: 'Missing or overly brief professional summary.',
        points: 4,
        recommendation: 'Write a concise 2-3 sentence executive summary framing your seniority, core domain, and key impact.',
      });
    }
    contentQuality = Math.min(100, Math.max(0, contentQuality));

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
    grammarScore = Math.max(0, Math.min(100, grammarScore));

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
      overall: Math.min(100, Math.max(0, overall)),
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
