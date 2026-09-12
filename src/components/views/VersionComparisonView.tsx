import React, { useState, useEffect } from 'react';
import type { ResumeDocument, ResumeVersion } from '../../types';
import { api } from '../../services/api';
import {
  GitCompare,
  Plus,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface VersionComparisonViewProps {
  resume: ResumeDocument | null;
  onNavigate: (tab: string) => void;
  onRestoreVersion?: (restored: ResumeDocument) => Promise<void>;
}

export const VersionComparisonView: React.FC<VersionComparisonViewProps> = ({
  resume,
  onNavigate,
  onRestoreVersion,
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

  // Restore version confirmation dialog
  const [confirmRestoreModal, setConfirmRestoreModal] = useState<ResumeVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

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

  const handleRunComparison = async () => {
    if (!resume || !versionAId || !versionBId) return;
    setLoadingCompare(true);
    try {
      const res = await api.compareVersions(resume.id, versionAId, versionBId);
      setComparison(res.comparison);
    } catch (err) {
      console.error('Comparison failed:', err);
    } finally {
      setLoadingCompare(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!resume || !newVersionName.trim()) return;
    setErrorNotice(null);
    try {
      await api.createVersion(resume.id, newVersionName, newVersionSummary);
      setShowNewVersionModal(false);
      setNewVersionName('');
      setNewVersionSummary('');
      await loadVersions();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to create version checkpoint.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!resume || !confirmRestoreModal) return;
    setIsRestoring(true);
    try {
      const res = await api.restoreVersion(resume.id, confirmRestoreModal.id);
      setRestoreSuccessMessage(`Successfully restored to version "${confirmRestoreModal.versionName}".`);
      setConfirmRestoreModal(null);
      if (onRestoreVersion) {
        await onRestoreVersion(res.resume);
      }
      await loadVersions();
      setTimeout(() => setRestoreSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to restore version.');
    } finally {
      setIsRestoring(false);
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
          Please select an active resume from the dashboard to create versions and run A/B comparative evaluations.
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

  const verA = versions.find((v) => v.id === versionAId);
  const verB = versions.find((v) => v.id === versionBId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">Resume Version Management & A/B Diff</h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Track checkpoints across revisions, evaluate side-by-side metric differences, and restore historical states safely.
          </p>
        </div>

        <button
          onClick={() => setShowNewVersionModal(true)}
          className="px-3.5 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Save Current as Checkpoint</span>
        </button>
      </div>

      {/* Restore Success Notice */}
      {restoreSuccessMessage && (
        <div className="p-4 rounded-xl bg-[#4F5D2F]/10 border border-[#4F5D2F]/30 text-xs text-[#4F5D2F] font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />
          <span>{restoreSuccessMessage}</span>
        </div>
      )}

      {/* Selectors for Version A & B */}
      <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
          A/B Head-to-Head Comparison Setup
        </h3>

        {versions.length < 2 ? (
          <div className="text-xs text-[#6E6E63] p-4 bg-[#FAF9F5] rounded-xl border border-[#EAE8E1] flex items-center justify-between">
            <span>You currently have {versions.length} checkpoint. Save another checkpoint to enable comparative analysis.</span>
            <button
              onClick={() => setShowNewVersionModal(true)}
              className="px-3 py-1.5 rounded-lg bg-[#4F5D2F] text-white text-xs font-semibold shadow-xs"
            >
              Create Second Version
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#171713]">Baseline Version (Version A)</label>
              <select
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="w-full bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionName} ({new Date(v.createdAt).toLocaleDateString()}) - ATS: {v.atsScore ?? 85}%
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#171713]">Candidate Revision (Version B)</label>
              <select
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="w-full bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-semibold rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionName} ({new Date(v.createdAt).toLocaleDateString()}) - ATS: {v.atsScore ?? 85}%
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {versions.length >= 2 && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleRunComparison}
              disabled={loadingCompare || versionAId === versionBId}
              className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{loadingCompare ? 'Evaluating Diff...' : 'Run Comparative Diff'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Comparison Diff Results */}
      {comparison && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Comparative Score & Diagnostic Delta
                </h3>
              </div>
              <div className="text-xs font-semibold text-[#4F5D2F]">
                {comparison.winner === 'versionB'
                  ? 'Version B Outperforms Baseline'
                  : comparison.winner === 'versionA'
                  ? 'Version A Retains Higher Score'
                  : 'Scores are Equivalent'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-2">
                <div className="text-[#6E6E63] font-medium">Overall Quality Delta</div>
                <div className="text-2xl font-bold text-[#171713]">
                  {comparison.scoreDelta > 0 ? `+${comparison.scoreDelta}` : comparison.scoreDelta} pts
                </div>
                <div className="text-[11px] text-[#6E6E63]">
                  Ver A: {comparison.verAScore} | Ver B: {comparison.verBScore}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-2">
                <div className="text-[#6E6E63] font-medium">ATS Compatibility Delta</div>
                <div className="text-2xl font-bold text-[#4F5D2F]">
                  {comparison.atsDelta > 0 ? `+${comparison.atsDelta}` : comparison.atsDelta} pts
                </div>
                <div className="text-[11px] text-[#6E6E63]">
                  Ver A: {comparison.verAAts}% | Ver B: {comparison.verBAts}%
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-2">
                <div className="text-[#6E6E63] font-medium">Keyword Coverage Delta</div>
                <div className="text-2xl font-bold text-[#8E6D24]">
                  {comparison.keywordDelta > 0 ? `+${comparison.keywordDelta}` : comparison.keywordDelta} skills
                </div>
                <div className="text-[11px] text-[#6E6E63]">
                  Target taxonomy match rate
                </div>
              </div>
            </div>
          </div>

          {/* Side by side preview with Restore Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE8E1]">
                <div>
                  <span className="text-xs font-bold text-[#171713]">{verA?.versionName}</span>
                  <div className="text-[10px] text-[#6E6E63]">Version A (Baseline)</div>
                </div>
                {verA && (
                  <button
                    onClick={() => setConfirmRestoreModal(verA)}
                    className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-[#EAE8E1] text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
                  >
                    <RotateCcw className="w-3 h-3 text-[#4F5D2F]" />
                    <span>Restore Version A</span>
                  </button>
                )}
              </div>
              <div className="text-xs space-y-2 text-[#6E6E63]">
                <div><strong>Summary:</strong> {verA?.resumeData?.summary}</div>
                <div>
                  <strong>Experience Bullet Count:</strong>{' '}
                  {(verA?.resumeData?.experience || []).reduce((acc: number, e: any) => acc + (e.bullets?.length || 0), 0)}
                </div>
                <div>
                  <strong>Skill Count:</strong>{' '}
                  {(verA?.resumeData?.skills || []).reduce((acc: number, s: any) => acc + (s.items?.length || 0), 0)}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE8E1]">
                <div>
                  <span className="text-xs font-bold text-[#171713]">{verB?.versionName}</span>
                  <div className="text-[10px] text-[#6E6E63]">Version B (Candidate)</div>
                </div>
                {verB && (
                  <button
                    onClick={() => setConfirmRestoreModal(verB)}
                    className="px-2.5 py-1 rounded bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore Version B</span>
                  </button>
                )}
              </div>
              <div className="text-xs space-y-2 text-[#6E6E63]">
                <div><strong>Summary:</strong> {verB?.resumeData?.summary}</div>
                <div>
                  <strong>Experience Bullet Count:</strong>{' '}
                  {(verB?.resumeData?.experience || []).reduce((acc: number, e: any) => acc + (e.bullets?.length || 0), 0)}
                </div>
                <div>
                  <strong>Skill Count:</strong>{' '}
                  {(verB?.resumeData?.skills || []).reduce((acc: number, s: any) => acc + (s.items?.length || 0), 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version History Archive */}
      <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#4F5D2F]" />
            <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
              Version Checkpoint Archive ({versions.length})
            </h3>
          </div>
          <span className="text-[11px] text-[#6E6E63]">Full Audit Trail</span>
        </div>

        <div className="space-y-2.5">
          {versions.map((v) => (
            <div
              key={v.id}
              className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#171713]">{v.versionName}</span>
                  <span className="text-[10px] text-[#6E6E63]">
                    ({new Date(v.createdAt).toLocaleDateString()} at {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                </div>
                <div className="text-[11px] text-[#6E6E63]">{v.changeSummary}</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[11px] text-[#6E6E63]">
                    Score: <strong className="text-[#4F5D2F]">{v.score?.overall ?? 85}%</strong>
                  </div>
                  <div className="text-[10px] text-[#6E6E63]">ATS: {v.atsScore ?? 85}%</div>
                </div>

                <button
                  onClick={() => setConfirmRestoreModal(v)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1.5 transition shadow-2xs"
                >
                  <RotateCcw className="w-3 h-3 text-[#4F5D2F]" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restore Confirmation Dialog Modal */}
      {confirmRestoreModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#EAE8E1] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-[#171713]">Confirm Resume Version Restore</h3>
            </div>
            <p className="text-xs text-[#6E6E63] leading-relaxed">
              Are you sure you want to restore to <strong>&quot;{confirmRestoreModal.versionName}&quot;</strong> created on {new Date(confirmRestoreModal.createdAt).toLocaleDateString()}?
            </p>
            <p className="text-xs text-[#6E6E63] leading-relaxed">
              Your active resume data and section entries will be replaced with this version&apos;s saved state. You can always revert back using this version history archive.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE8E1]">
              <button
                onClick={() => setConfirmRestoreModal(null)}
                disabled={isRestoring}
                className="px-3.5 py-1.5 rounded-lg text-xs text-[#6E6E63] hover:text-[#171713]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold transition shadow-xs"
              >
                {isRestoring ? 'Restoring State...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              >
              </input>
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
