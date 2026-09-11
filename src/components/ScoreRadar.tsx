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

  const getScoreColor = (val: number) => {
    if (val >= 85) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (val >= 70) return 'text-sky-400 border-sky-500/30 bg-sky-500/10';
    if (val >= 55) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getBarColor = (val: number) => {
    if (val >= 85) return 'bg-emerald-500';
    if (val >= 70) return 'bg-sky-500';
    if (val >= 55) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Overall Score */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-xl flex items-center justify-center border font-black text-2xl shadow-inner ${getScoreColor(
              safeScore.overall ?? 0
            )}`}
          >
            {safeScore.overall ?? 0}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Overall Resume Score</h3>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                100-Point Formula
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic weighted evaluation across 9 core hiring dimensions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
          {(safeScore.overall ?? 0) >= 80 ? (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>High Recruiter Screening Pass Rate</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              <AlertCircle className="w-4 h-4" />
              <span>Optimization Opportunities Found</span>
            </div>
          )}
        </div>
      </div>

      {/* Dimensional Breakdown Progress Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dimensions.map((dim, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition"
          >
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-medium text-slate-200">{dim.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">({dim.weight})</span>
                <span className="font-bold text-slate-100">{dim.value}%</span>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Deductions & Root Causes ({safeScore.deductions.length})
            </h4>
          </div>
          <div className="space-y-2.5">
            {safeScore.deductions.map((ded, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      -{ded.points} pts
                    </span>
                    <span className="font-semibold text-slate-200">{ded.category}:</span>
                    <span className="text-slate-300">{ded.reason}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-700">
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
