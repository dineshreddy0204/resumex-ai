import type { ResumeVersion, JobDescriptionModel } from '../types';
import { semanticMatcher } from './semanticMatcher';

export interface VersionComparisonResult {
  versionA: ResumeVersion;
  versionB: ResumeVersion;
  overallScoreDelta: number;
  atsScoreDelta: number;
  jdMatchScoreDelta?: number;
  dimensionDeltas: {
    dimension: string;
    scoreA: number;
    scoreB: number;
    delta: number;
  }[];
  changedSections: string[];
  recommendationVerdict: string;
  alignmentExplanation: string;
}

export class VersionEngine {
  public async compareVersions(
    verA: ResumeVersion,
    verB: ResumeVersion,
    targetJob?: JobDescriptionModel
  ): Promise<VersionComparisonResult> {
    const scoreAOverall = verA.score?.overall ?? 0;
    const scoreBOverall = verB.score?.overall ?? 0;
    const overallDelta = scoreBOverall - scoreAOverall;
    const atsDelta = (verB.atsScore ?? 0) - (verA.atsScore ?? 0);

    // Optional JD matching comparison
    let jdMatchDelta: number | undefined;
    if (targetJob) {
      const matchA = await semanticMatcher.matchResumeToJob(verA.resumeData, targetJob);
      const matchB = await semanticMatcher.matchResumeToJob(verB.resumeData, targetJob);
      jdMatchDelta = (matchB.overallMatch ?? 0) - (matchA.overallMatch ?? 0);
    }

    const dimensionDeltas = [
      {
        dimension: 'Overall Resume Score',
        scoreA: scoreAOverall,
        scoreB: scoreBOverall,
        delta: overallDelta,
      },
      {
        dimension: 'ATS Compatibility',
        scoreA: verA.atsScore ?? 0,
        scoreB: verB.atsScore ?? 0,
        delta: atsDelta,
      },
      {
        dimension: 'Content Quality',
        scoreA: verA.score?.contentQuality ?? 0,
        scoreB: verB.score?.contentQuality ?? 0,
        delta: (verB.score?.contentQuality ?? 0) - (verA.score?.contentQuality ?? 0),
      },
      {
        dimension: 'Skills Density',
        scoreA: verA.score?.skillsScore ?? 0,
        scoreB: verB.score?.skillsScore ?? 0,
        delta: (verB.score?.skillsScore ?? 0) - (verA.score?.skillsScore ?? 0),
      },
      {
        dimension: 'Experience Impact',
        scoreA: verA.score?.experienceScore ?? 0,
        scoreB: verB.score?.experienceScore ?? 0,
        delta: (verB.score?.experienceScore ?? 0) - (verA.score?.experienceScore ?? 0),
      },
      {
        dimension: 'Readability & Polish',
        scoreA: verA.score?.readabilityScore ?? 0,
        scoreB: verB.score?.readabilityScore ?? 0,
        delta: (verB.score?.readabilityScore ?? 0) - (verA.score?.readabilityScore ?? 0),
      },
    ];

    // Detect changed sections
    const changedSections: string[] = [];
    if (JSON.stringify(verA.resumeData.summary) !== JSON.stringify(verB.resumeData.summary)) {
      changedSections.push('Professional Summary');
    }
    if (JSON.stringify(verA.resumeData.skills) !== JSON.stringify(verB.resumeData.skills)) {
      changedSections.push('Technical Skills');
    }
    if (JSON.stringify(verA.resumeData.experience) !== JSON.stringify(verB.resumeData.experience)) {
      changedSections.push('Work Experience');
    }
    if (JSON.stringify(verA.resumeData.projects) !== JSON.stringify(verB.resumeData.projects)) {
      changedSections.push('Projects');
    }

    let recommendationVerdict = 'Tie';
    let alignmentExplanation = '';

    if (overallDelta > 0 || (jdMatchDelta && jdMatchDelta > 0)) {
      recommendationVerdict = `${verB.versionName} is objectively better optimized.`;
      alignmentExplanation = `Version "${verB.versionName}" shows +${overallDelta} overall score improvement${
        jdMatchDelta !== undefined ? ` and +${jdMatchDelta}% closer semantic alignment to the target job description` : ''
      }. Bullet metrics and ATS formatting safety are higher.`;
    } else if (overallDelta < 0) {
      recommendationVerdict = `${verA.versionName} retains stronger baseline characteristics.`;
      alignmentExplanation = `Version "${verA.versionName}" maintains higher structural completeness. Check whether recent edits inadvertently removed core keywords or compressed sections.`;
    } else {
      recommendationVerdict = 'Both versions demonstrate comparable metric ratings.';
      alignmentExplanation = 'Both versions score identically on primary dimensions. Select based on personal stylistic preference.';
    }

    return {
      versionA: verA,
      versionB: verB,
      overallScoreDelta: overallDelta,
      atsScoreDelta: atsDelta,
      jdMatchScoreDelta: jdMatchDelta,
      dimensionDeltas,
      changedSections,
      recommendationVerdict,
      alignmentExplanation,
    };
  }
}

export const versionEngine = new VersionEngine();
