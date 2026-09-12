import React from 'react';
import type { ResumeScoreBreakdown } from '../types';
import { AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';

interface ScoreRadarProps {
  score?: ResumeScoreBreakdown;
  compact?: boolean;
}

const DEFAULT_SCORE: ResumeScoreBreakdown = {
  overall: 0,
  contentQuality: 0,
  atsCompatibility: 0,
  skillsScore: 0,
  experienceScore: 0,
  projectsScore: 0,
  achievementsScore: 0,
  grammarScore: 0,
  formattingScore: 0,
  readabilityScore: 0,
  deductions: [],
};

export const ScoreRadar: React.FC<ScoreRadarProps> = ({ score, compact = false }) => {
  const safeScore = score || DEFAULT_SCORE;

  const dimensions = [
    { label: 'ATS Compatibility', value: safeScore.atsCompatibility ?? 0, weight: '20%' },
    { label: 'Content Quality', value: safeScore.contentQuality ?? 0, weight: '15%' },
    { label: 'Skills Density', value: safeScore.skillsScore ?? 0, weight: '15%' },
    { label: 'Experience Impact', value: safeScore.experienceScore ?? 0, weight: '15%' },
    { label: 'Technical Projects', value: safeScore.projectsScore ?? 0, weight: '10%' },
    { label: 'Quantified Achievements', value: safeScore.achievementsScore ?? 0, weight: '10%' },
    { label: 'Readability & Scan Speed', value: safeScore.readabilityScore ?? 0, weight: '5%' },
    { label: 'Grammar & Tone', value: safeScore.grammarScore ?? 0, weight: '5%' },
    { label: 'Formatting Safety', value: safeScore.formattingScore ?? 0, weight: '5%' },
  ];

  const overall = safeScore.overall ?? 0;

  const getScoreBadge = (val: number) => {
    if (val >= 85) return 'text-[#4F5D2F] border-[#4F5D2F]/30 bg-[#4F5D2F]/10';
    if (val >= 70) return 'text-[#C49A3A] border-[#C49A3A]/30 bg-[#C49A3A]/10';
    return 'text-rose-700 border-rose-200 bg-rose-50';
  };

  const getBarColor = (val: number) => {
    if (val >= 85) return 'bg-[#4F5D2F]';
    if (val >= 70) return 'bg-[#C49A3A]';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Overall Score */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-xl flex items-center justify-center border font-black text-2xl shadow-2xs ${getScoreBadge(
              overall
            )}`}
          >
            {overall}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#171713]">Deterministic Resume Quality Score</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FAF9F5] text-[#6E6E63] border border-[#EAE8E1]">
                100-Point Formula
              </span>
            </div>
            <p className="text-xs text-[#6E6E63] mt-0.5">
              Weighted mathematical scoring across 9 core hiring dimensions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
          {overall >= 80 ? (
            <div className="flex items-center gap-1.5 text-[#4F5D2F] bg-[#4F5D2F]/10 px-3 py-1.5 rounded-lg border border-[#4F5D2F]/20 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>High Recruiter Screening Pass Rate</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#8E6D24] bg-[#C49A3A]/15 px-3 py-1.5 rounded-lg border border-[#C49A3A]/30 font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>Optimization Opportunities Identified</span>
            </div>
          )}
        </div>
      </div>

      {/* Dimensional Breakdown Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dimensions.map((dim, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg bg-white border border-[#EAE8E1] shadow-2xs hover:border-[#D5D2C7] transition"
          >
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-medium text-[#171713]">{dim.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#6E6E63]">({dim.weight})</span>
                <span className="font-bold text-[#171713]">{dim.value}%</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-[#FAF9F5] border border-[#EAE8E1] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getBarColor(dim.value)}`}
                style={{ width: `${dim.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Major Deductions Section */}
      {!compact && safeScore.deductions && safeScore.deductions.length > 0 && (
        <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-[#C49A3A]" />
            <h4 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
              Diagnostic Deductions & Root Causes ({safeScore.deductions?.length || 0})
            </h4>
          </div>
          <div className="space-y-2.5">
            {safeScore.deductions.map((ded, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      -{ded.points} pts
                    </span>
                    <span className="font-semibold text-[#171713]">{ded.category}:</span>
                    <span className="text-[#6E6E63]">{ded.reason}</span>
                  </div>
                  <div className="text-[11px] text-[#4F5D2F] pl-2 border-l border-[#D5D2C7] font-medium">
                    Fix: {ded.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
