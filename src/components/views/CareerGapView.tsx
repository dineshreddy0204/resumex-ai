import React, { useState, useEffect } from 'react';
import type { ResumeDocument, CareerGapAnalysis } from '../../types';
import { api } from '../../services/api';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Code2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface CareerGapViewProps {
  resume: ResumeDocument | null;
  onNavigate: (tab: string) => void;
}

const TARGET_ROLES = [
  'Senior Full-Stack Engineer',
  'Cloud / DevOps Engineer',
  'Machine Learning / AI Engineer',
  'Data Engineer',
];

export const CareerGapView: React.FC<CareerGapViewProps> = ({ resume, onNavigate }) => {
  const [selectedRole, setSelectedRole] = useState<string>(TARGET_ROLES[0]);
  const [gapAnalysis, setGapAnalysis] = useState<CareerGapAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resume) {
      loadCareerGap(selectedRole);
    }
  }, [resume, selectedRole]);

  const loadCareerGap = async (role: string) => {
    if (!resume) return;
    setLoading(true);
    try {
      const res = await api.analyzeCareerGap(resume.id, role);
      setGapAnalysis(res.careerGap);
    } catch (err) {
      console.error('Failed to load career gap:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!resume) {
    return (
      <div className="text-center py-20 bg-slate-900 rounded-xl border border-slate-800">
        <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Resume Selected</h3>
        <p className="text-xs text-slate-400 mt-1">Please select an active resume to run career gap analysis.</p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Career Gap Analysis & Role Roadmap</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Uncovers hidden qualification gaps between your present resume and aspirational engineering roles.
          </p>
        </div>

        {/* Role Picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Target Role:</span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            {TARGET_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-xs text-slate-400">
          Synthesizing role requirements and scanning bullet evidence...
        </div>
      )}

      {gapAnalysis && !loading && (
        <div className="space-y-6">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs font-medium text-slate-400">Strong Proven Competencies</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {gapAnalysis.strongSkills.length} skills
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Backed by multi-bullet project proof</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs font-medium text-slate-400">Developing (Evidence Gaps)</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {gapAnalysis.developingSkills.length} skills
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Mentioned but lacking production impact</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs font-medium text-slate-400">Missing Core Requirements</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {gapAnalysis.missingSkills.length} skills
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Essential for benchmark screening pass</div>
            </div>
          </div>

          {/* Evidence Gaps Alert Box */}
          {gapAnalysis.evidenceGaps && gapAnalysis.evidenceGaps.length > 0 && (
            <div className="p-5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                  Critical Evidence Gaps ({gapAnalysis.evidenceGaps.length})
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                A common reason senior candidates get filtered is listing a buzzword in the skills block
                without demonstrating real architectural delivery in the experience bullets.
              </p>

              <div className="space-y-2 pt-2">
                {gapAnalysis.evidenceGaps.map((gap, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-950/80 border border-amber-500/20 text-xs space-y-1"
                  >
                    <div className="font-bold text-amber-300">{gap.skillOrRequirement}</div>
                    <div className="text-slate-300">{gap.issue}</div>
                    <div className="text-emerald-400 font-medium text-[11px]">
                      Action: {gap.recommendedAction}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills Grid */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Missing Skill Prerequisites for {selectedRole}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gapAnalysis.missingSkills.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs flex justify-between items-start gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-100">{m.skill}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{m.importanceReason}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      m.priority === 'High'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {m.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Real Projects Roadmap */}
          {gapAnalysis.actionPlan.recommendedProjects && (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Recommended Projects to Close the Gap
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Building and deploying one of these architectures will create verifiable bullet evidence for your resume.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapAnalysis.actionPlan.recommendedProjects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs"
                  >
                    <div className="font-bold text-sm text-slate-100">{proj.title}</div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{proj.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.demonstratedSkills.map((s, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
