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
      <div className="text-center py-20 bg-white rounded-2xl border border-[#EAE8E1] p-8 max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] mx-auto mb-4">
          <TrendingUp className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#171713]">No Resume Selected</h3>
        <p className="text-xs text-[#6E6E63] mt-1.5 leading-relaxed">
          Please select an active resume to run a career gap diagnostic and skill bridge roadmap.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-5 px-4 py-2 bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold rounded-lg transition shadow-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">Career Gap Analysis & Roadmap</h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Uncovers hidden qualification gaps between your present resume and aspirational engineering positions.
          </p>
        </div>

        {/* Target Role Picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6E6E63] font-medium">Target Role:</span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
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
        <div className="text-center py-12 text-xs text-[#6E6E63]">
          Synthesizing role requirements and scanning bullet evidence...
        </div>
      )}

      {gapAnalysis && !loading && (
        <div className="space-y-6">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Strong Proven Competencies</div>
              <div className="text-2xl font-bold text-[#4F5D2F] mt-1">
                {gapAnalysis.strongSkills.length} skills
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Backed by multi-bullet project proof</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Developing (Evidence Gaps)</div>
              <div className="text-2xl font-bold text-[#8E6D24] mt-1">
                {gapAnalysis.developingSkills.length} skills
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Mentioned but lacking production impact metrics</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Missing Core Requirements</div>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {gapAnalysis.missingSkills.length} skills
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Essential for benchmark screening pass</div>
            </div>
          </div>

          {/* Evidence Gaps Alert Box */}
          {gapAnalysis.evidenceGaps && gapAnalysis.evidenceGaps.length > 0 && (
            <div className="p-6 rounded-xl bg-[#FAF9F5] border border-[#C49A3A]/40 space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#8E6D24]" />
                <h3 className="text-sm font-bold text-[#8E6D24] uppercase tracking-wider">
                  Critical Evidence Gaps ({gapAnalysis.evidenceGaps.length})
                </h3>
              </div>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                A common reason senior candidates get filtered is listing keywords in the skills block
                without demonstrating real architectural delivery in the experience bullets.
              </p>

              <div className="space-y-2 pt-2">
                {gapAnalysis.evidenceGaps.map((gap, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg bg-white border border-[#EAE8E1] text-xs space-y-1 shadow-2xs"
                  >
                    <div className="font-bold text-[#171713]">{gap.skillOrRequirement}</div>
                    <div className="text-[#6E6E63]">{gap.issue}</div>
                    <div className="text-[#4F5D2F] font-semibold text-[11px]">
                      Action: {gap.recommendedAction}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills Grid */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                Missing Skill Prerequisites for {selectedRole}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gapAnalysis.missingSkills.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs flex justify-between items-start gap-2 shadow-2xs"
                >
                  <div>
                    <div className="font-bold text-[#171713]">{m.skill}</div>
                    <div className="text-[11px] text-[#6E6E63] mt-0.5">{m.importanceReason}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      m.priority === 'High'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30'
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
            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Recommended Practical Projects to Bridge the Gap
                </h3>
              </div>
              <p className="text-xs text-[#6E6E63]">
                Building and deploying one of these architectures will create verifiable bullet evidence for your resume.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapAnalysis.actionPlan.recommendedProjects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] space-y-2 text-xs shadow-2xs"
                  >
                    <div className="font-bold text-sm text-[#171713]">{proj.title}</div>
                    <p className="text-[#6E6E63] text-[11px] leading-relaxed">{proj.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.demonstratedSkills.map((s, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20 text-[10px] font-medium"
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
