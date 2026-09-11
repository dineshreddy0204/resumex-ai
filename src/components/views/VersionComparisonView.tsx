import React, { useState, useEffect } from 'react';
import type { ResumeDocument, ResumeVersion, JobDescriptionModel } from '../../types';
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
    } catch (err) {
      alert('Failed to create version checkpoint.');
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
      <div className="text-center py-20 bg-slate-900 rounded-xl border border-slate-800">
        <GitCompare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Resume Selected</h3>
        <p className="text-xs text-slate-400 mt-1">Select a resume to compare version variations and A/B score gains.</p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const verA = versions.find((v) => v.id === versionAId);
  const verB = versions.find((v) => v.id === versionBId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Resume Versioning & A/B Testing</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare score deltas, keyword changes, and ATS safety improvements between revision checkpoints.
          </p>
        </div>

        <button
          onClick={() => setShowNewVersionModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save Version Checkpoint</span>
        </button>
      </div>

      {/* Version Selector Bar */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Version A (Baseline)
              </label>
              <select
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 min-w-[200px]"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionName} (Score: {v.score?.overall ?? 0}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="text-slate-500 self-end pb-2 font-bold text-sm">VS</div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Version B (Variant)
              </label>
              <select
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 min-w-[200px]"
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
            className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
          >
            <GitCompare className="w-4 h-4" />
            <span>{loadingCompare ? 'Evaluating Deltas...' : 'Compare A/B Versions'}</span>
          </button>
        </div>
      </div>

      {/* Comparison Results Display */}
      {comparison && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/60 border border-slate-800 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Evaluation Verdict
              </span>
              <h3 className="text-lg font-bold text-white mt-1">{comparison.recommendationVerdict}</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {comparison.alignmentExplanation}
              </p>
            </div>

            <div className="flex items-center gap-4 text-center">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">Overall Delta</div>
                <div
                  className={`text-2xl font-black mt-0.5 ${
                    comparison.overallScoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {comparison.overallScoreDelta >= 0 ? `+${comparison.overallScoreDelta}` : comparison.overallScoreDelta}%
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">ATS Delta</div>
                <div
                  className={`text-2xl font-black mt-0.5 ${
                    comparison.atsScoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {comparison.atsScoreDelta >= 0 ? `+${comparison.atsScoreDelta}` : comparison.atsScoreDelta}%
                </div>
              </div>
            </div>
          </div>

          {/* Dimension Delta Breakdown Table */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Dimensional Score Comparison
            </h3>

            <div className="divide-y divide-slate-800/80">
              {comparison.dimensionDeltas.map((dim: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{dim.dimension}</span>
                  <div className="flex items-center gap-6">
                    <span className="text-slate-400">
                      Ver A: <strong className="text-slate-300">{dim.scoreA}%</strong>
                    </span>
                    <span className="text-slate-400">
                      Ver B: <strong className="text-slate-300">{dim.scoreB}%</strong>
                    </span>
                    <span
                      className={`font-bold w-16 text-right ${
                        dim.delta > 0
                          ? 'text-emerald-400'
                          : dim.delta < 0
                          ? 'text-rose-400'
                          : 'text-slate-500'
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
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Version Checkpoint Archive ({versions.length})
          </h3>
        </div>

        <div className="space-y-2.5">
          {versions.map((v) => (
            <div
              key={v.id}
              className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{v.versionName}</span>
                  <span className="text-[10px] text-slate-500">
                    ({new Date(v.createdAt).toLocaleDateString()})
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{v.changeSummary}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Overall: <strong className="text-emerald-400">{v.score?.overall ?? 0}%</strong></div>
                  <div className="text-[10px] text-slate-500">ATS: {v.atsScore ?? 0}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Save Current Resume as Named Version</h3>
            <div>
              <label className="text-xs text-slate-400">Version Name</label>
              <input
                type="text"
                placeholder="e.g. Tailored for Cloud Architect / V3"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Change Summary / Notes</label>
              <textarea
                rows={3}
                placeholder="What was changed in this version?"
                value={newVersionSummary}
                onChange={(e) => setNewVersionSummary(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={!newVersionName.trim()}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50 transition"
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
