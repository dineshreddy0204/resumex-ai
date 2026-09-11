import React, { useState, useEffect } from 'react';
import type { ResumeDocument, ResumeVersion } from '../../types';
import { api } from '../../services/api';
import {
  GitCompare,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface VersionComparisonViewProps {
  resume: ResumeDocument | null;
  onNavigate: (tab: string) => void;
}

export const VersionComparisonView: React.FC<VersionComparisonViewProps> = ({
  resume,
  onNavigate,
}) => {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [versionAId, setVersionAId] = useState<string>('');
  const [versionBId, setVersionBId] = useState<string>('');
  const [comparison, setComparison] = useState<any | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  // New version dialog
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionSummary, setNewVersionSummary] = useState('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (resume) {
      loadVersions();
    }
  }, [resume]);

  const loadVersions = async () => {
    if (!resume) return;
    try {
      const list = await api.getVersions(resume.id);
      setVersions(list);
      if (list.length >= 2) {
        setVersionAId(list[0].id);
        setVersionBId(list[1].id);
      } else if (list.length === 1) {
        setVersionAId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  };

  const handleCreateVersion = async () => {
    if (!resume || !newVersionName.trim()) return;
    setErrorNotice(null);
    try {
      const res = await api.createVersion(
        resume.id,
        newVersionName,
        newVersionSummary || 'Manual version snapshot.'
      );
      setVersions([res.version, ...versions]);
      setShowNewVersionModal(false);
      setNewVersionName('');
      setNewVersionSummary('');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to create version checkpoint.');
    }
  };

  const handleRunComparison = async () => {
    if (!resume || !versionAId || !versionBId) return;
    setLoadingCompare(true);
    try {
      const res = await api.compareVersions(resume.id, versionAId, versionBId);
      setComparison(res.comparison);
    } catch (err) {
      console.error('Comparison error:', err);
    } finally {
      setLoadingCompare(false);
    }
  };

  if (!resume) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-[#EAE8E1] p-8 max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] mx-auto mb-4">
          <GitCompare className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#171713]">No Resume Selected</h3>
        <p className="text-xs text-[#6E6E63] mt-1.5 leading-relaxed">
          Select an active resume to compare version variations, dimensional deltas, and A/B score gains.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-5 px-4 py-2 bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold rounded-lg transition shadow-xs"
        >
          Go to Dashboard
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
            <GitCompare className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">Resume Versioning & A/B Testing</h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Compare score deltas, keyword density, and ATS safety improvements across revision checkpoints.
          </p>
        </div>

        <button
          onClick={() => setShowNewVersionModal(true)}
          className="px-3.5 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save Version Checkpoint</span>
        </button>
      </div>

      {/* Version Selector Bar */}
      <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div>
              <label className="text-[11px] font-bold text-[#6E6E63] uppercase tracking-wider block mb-1">
                Version A (Baseline)
              </label>
              <select
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F] min-w-[200px]"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionName} (Score: {v.score?.overall ?? 0}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[#6E6E63] self-end pb-2 font-bold text-xs uppercase tracking-widest">VS</div>

            <div>
              <label className="text-[11px] font-bold text-[#6E6E63] uppercase tracking-wider block mb-1">
                Version B (Variant)
              </label>
              <select
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-medium rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F] min-w-[200px]"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionName} (Score: {v.score?.overall ?? 0}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleRunComparison}
            disabled={!versionAId || !versionBId || loadingCompare}
            className="px-5 py-2.5 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition disabled:opacity-50"
          >
            <GitCompare className="w-4 h-4 text-[#C49A3A]" />
            <span>{loadingCompare ? 'Evaluating Deltas...' : 'Compare A/B Versions'}</span>
          </button>
        </div>
      </div>

      {/* Comparison Results Display */}
      {comparison && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FAF9F5] text-[#4F5D2F] border border-[#EAE8E1]">
                Evaluation Verdict
              </span>
              <h3 className="text-base font-bold text-[#171713] mt-1.5">{comparison.recommendationVerdict}</h3>
              <p className="text-xs text-[#6E6E63] mt-1 max-w-2xl leading-relaxed">
                {comparison.alignmentExplanation}
              </p>
            </div>

            <div className="flex items-center gap-4 text-center">
              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] min-w-[100px]">
                <div className="text-[10px] text-[#6E6E63] uppercase font-semibold">Overall Delta</div>
                <div
                  className={`text-2xl font-black mt-0.5 ${
                    comparison.overallScoreDelta >= 0 ? 'text-[#4F5D2F]' : 'text-rose-700'
                  }`}
                >
                  {comparison.overallScoreDelta >= 0 ? `+${comparison.overallScoreDelta}` : comparison.overallScoreDelta}%
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] min-w-[100px]">
                <div className="text-[10px] text-[#6E6E63] uppercase font-semibold">ATS Delta</div>
                <div
                  className={`text-2xl font-black mt-0.5 ${
                    comparison.atsScoreDelta >= 0 ? 'text-[#4F5D2F]' : 'text-rose-700'
                  }`}
                >
                  {comparison.atsScoreDelta >= 0 ? `+${comparison.atsScoreDelta}` : comparison.atsScoreDelta}%
                </div>
              </div>
            </div>
          </div>

          {/* Dimension Delta Breakdown Table */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
              Dimensional Score Comparison
            </h3>

            <div className="divide-y divide-[#EAE8E1]">
              {comparison.dimensionDeltas.map((dim: any, i: number) => (
                <div key={i} className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#171713]">{dim.dimension}</span>
                  <div className="flex items-center gap-6">
                    <span className="text-[#6E6E63]">
                      Ver A: <strong className="text-[#171713]">{dim.scoreA}%</strong>
                    </span>
                    <span className="text-[#6E6E63]">
                      Ver B: <strong className="text-[#171713]">{dim.scoreB}%</strong>
                    </span>
                    <span
                      className={`font-bold w-16 text-right ${
                        dim.delta > 0
                          ? 'text-[#4F5D2F]'
                          : dim.delta < 0
                          ? 'text-rose-700'
                          : 'text-[#6E6E63]'
                      }`}
                    >
                      {dim.delta > 0 ? `+${dim.delta}%` : dim.delta < 0 ? `${dim.delta}%` : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Version History Archive */}
      <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#4F5D2F]" />
          <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
            Version Checkpoint Archive ({versions.length})
          </h3>
        </div>

        <div className="space-y-2.5">
          {versions.map((v) => (
            <div
              key={v.id}
              className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#171713]">{v.versionName}</span>
                  <span className="text-[10px] text-[#6E6E63]">
                    ({new Date(v.createdAt).toLocaleDateString()})
                  </span>
                </div>
                <div className="text-[11px] text-[#6E6E63] mt-0.5">{v.changeSummary}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-[#6E6E63]">
                    Overall: <strong className="text-[#4F5D2F]">{v.score?.overall ?? 0}%</strong>
                  </div>
                  <div className="text-[10px] text-[#6E6E63]">ATS: {v.atsScore ?? 0}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#EAE8E1] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-[#171713]">Save Current Resume as Named Version</h3>
            {errorNotice && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {errorNotice}
              </div>
            )}
            <div>
              <label className="text-xs text-[#6E6E63] font-medium">Version Name</label>
              <input
                type="text"
                placeholder="e.g. Tailored for Stripe / Backend V3"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6E6E63] font-medium">Change Summary / Revision Notes</label>
              <textarea
                rows={3}
                placeholder="What was modified or optimized in this revision?"
                value={newVersionSummary}
                onChange={(e) => setNewVersionSummary(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE8E1]">
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-[#6E6E63] hover:text-[#171713]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={!newVersionName.trim()}
                className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
              >
                Save Version Checkpoint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
