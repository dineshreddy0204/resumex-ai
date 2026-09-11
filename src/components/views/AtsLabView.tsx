import React, { useState } from 'react';
import type { ResumeDocument, AtsSimulationResult, AnalysisIssue } from '../../types';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCheck,
  Columns,
  Table,
  Zap,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

interface AtsLabViewProps {
  resume: ResumeDocument | null;
  atsResult: AtsSimulationResult | null;
  issues: AnalysisIssue[];
  onIssueAction: (issueId: string, action: 'accepted' | 'rejected') => Promise<void>;
  onNavigate: (tab: string) => void;
}

export const AtsLabView: React.FC<AtsLabViewProps> = ({
  resume,
  atsResult,
  issues,
  onIssueAction,
  onNavigate,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [actingIssueId, setActingIssueId] = useState<string | null>(null);

  if (!resume || !atsResult) {
    return (
      <div className="text-center py-20 bg-slate-900 rounded-xl border border-slate-800">
        <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Resume Selected for ATS Simulation</h3>
        <p className="text-xs text-slate-400 mt-1">Please select or upload a resume from the dashboard first.</p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const filteredIssues = issues.filter((iss) => {
    if (filterSeverity === 'all') return true;
    return iss.severity === filterSeverity;
  });

  const handleAction = async (issueId: string, action: 'accepted' | 'rejected') => {
    setActingIssueId(issueId);
    try {
      await onIssueAction(issueId, action);
    } finally {
      setActingIssueId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">ATS Intelligence & Simulation Lab</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulates algorithmic parser behavior across Taleo, Workday, Greenhouse, and Lever ATS systems.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('builder')}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>Fix in Live Editor</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main ATS Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Overall ATS Score</div>
          <div
            className={`text-3xl font-black mt-1 ${
              atsResult.overallAtsScore >= 80
                ? 'text-emerald-400'
                : atsResult.overallAtsScore >= 65
                ? 'text-sky-400'
                : 'text-amber-400'
            }`}
          >
            {atsResult.overallAtsScore}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Weighted parser pass likelihood</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Keyword Coverage</div>
          <div className="text-3xl font-black text-emerald-400 mt-1">{atsResult.keywordCoverage}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Standard technical terms</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Formatting Safety</div>
          <div className="text-3xl font-black text-sky-400 mt-1">{atsResult.formattingSafety}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Linear extraction fidelity</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Semantic Alignment</div>
          <div className="text-3xl font-black text-indigo-400 mt-1">{atsResult.semanticAlignment}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Contextual phrasing strength</div>
        </div>
      </div>

      {/* Section Detection & Formatting Safety Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Detection Matrix */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Section Detection Taxonomy
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Standard Heading Validation</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {atsResult.sectionDetection.map((sec, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {sec.detected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-200">{sec.section}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Heading: &quot;{sec.headingUsed}&quot;</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sec.detected
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {sec.detected ? 'DETECTED' : 'MISSING'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Layout & File Safety Analysis */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Layout & Machine Readability
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Stream Parser Risk</span>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-200">Machine Readability Layer</div>
                <div className="text-[11px] text-slate-400">Digital text extraction vs raster scan</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  atsResult.fileSafety.isMachineReadable
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                    : 'text-rose-400 bg-rose-500/10 border border-rose-500/30'
                }`}
              >
                {atsResult.fileSafety.isMachineReadable ? '100% Vector Text' : 'Scan Risk'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-200">Multi-Column Layout Risk</div>
                <div className="text-[11px] text-slate-400">Detects parallel text flow interleaving</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  atsResult.fileSafety.columnsDetected
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                    : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                }`}
              >
                {atsResult.fileSafety.columnsDetected ? 'Multi-Column (Risk)' : 'Safe (Linear)'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-200">Embedded Tables Risk</div>
                <div className="text-[11px] text-slate-400">Checks for HTML/DOCX grid structures</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  atsResult.fileSafety.tablesDetected
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30'
                    : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                }`}
              >
                {atsResult.fileSafety.tablesDetected ? 'Tables Found' : 'Clean (No Tables)'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-200">Standard Font Safety</div>
                <div className="text-[11px] text-slate-400">Verified system-safe typeface indices</div>
              </div>
              <span className="px-2.5 py-1 rounded-full font-bold text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                {atsResult.fileSafety.fontSafetyScore}% Safe
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Major Deductions Table */}
      {atsResult.majorDeductions && atsResult.majorDeductions.length > 0 && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Major ATS Deductions & Penalties
            </h3>
          </div>

          <div className="space-y-3">
            {atsResult.majorDeductions.map((ded, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-slate-950/80 border border-rose-950/60 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      -{ded.penalty} pts
                    </span>
                    <span className="font-bold text-slate-100">{ded.factor}</span>
                  </div>
                  <p className="text-slate-300">{ded.explanation}</p>
                  <div className="text-emerald-400 font-medium pt-1">Recommended Fix: {ded.fix}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues Diagnostic Feed */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Diagnosed Issues ({issues.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Action verb weaknesses, missing metrics, and scannability improvements.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {['all', 'high', 'medium', 'low'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition ${
                  filterSeverity === sev
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No issues matching current filter.
            </div>
          ) : (
            filteredIssues.map((iss) => (
              <div
                key={iss.id}
                className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        iss.severity === 'high'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : iss.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {iss.severity}
                    </span>
                    <span className="font-semibold text-slate-200 capitalize">
                      {iss.issue_type.replace('_', ' ')}
                    </span>
                    <span className="text-slate-500">• Section: {iss.section}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] ${
                        iss.status === 'accepted'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : iss.status === 'rejected'
                          ? 'text-slate-500 bg-slate-800'
                          : 'text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      Status: {iss.status}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-slate-900 text-slate-300 font-mono text-[11px] border border-slate-800/80">
                    &quot;{iss.evidence}&quot;
                  </div>

                  <p className="text-slate-300">{iss.reason}</p>
                  <div className="text-sky-300 font-medium">Suggestion: {iss.suggestion}</div>
                </div>

                {iss.status === 'pending' && (
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(iss.id, 'accepted')}
                      disabled={actingIssueId === iss.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1 transition"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleAction(iss.id, 'rejected')}
                      disabled={actingIssueId === iss.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                    >
                      <X className="w-3 h-3" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
