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
  Cpu,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

interface AtsLabViewProps {
  resume: ResumeDocument | null;
  atsResult: AtsSimulationResult | null;
  issues: AnalysisIssue[];
  onIssueAction: (issueId: string, action: 'accepted' | 'rejected') => Promise<void>;
  onNavigate: (tab: string) => void;
}

type AtsEngine = 'workday' | 'greenhouse' | 'lever' | 'taleo';

export const AtsLabView: React.FC<AtsLabViewProps> = ({
  resume,
  atsResult,
  issues,
  onIssueAction,
  onNavigate,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [actingIssueId, setActingIssueId] = useState<string | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<AtsEngine>('workday');

  if (!resume || !atsResult) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-[#EAE8E1] p-8 max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#171713]">No Resume Selected for ATS Simulation</h3>
        <p className="text-xs text-[#6E6E63] mt-1.5 leading-relaxed">
          Please select or upload a resume from the dashboard to run deep algorithmic parser simulations.
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

  // Engine-specific simulated characteristics
  const engineProfiles: Record<
    AtsEngine,
    {
      name: string;
      vendor: string;
      simulatedScore: number;
      tableTolerance: 'Fail' | 'Partial' | 'Pass';
      columnTolerance: 'Fail' | 'Partial' | 'Pass';
      dateParserStatus: 'Pass' | 'Risk';
      parserMode: string;
      notes: string;
    }
  > = {
    workday: {
      name: 'Workday Human Capital Management',
      vendor: 'Workday, Inc.',
      simulatedScore: Math.min(100, Math.max(40, atsResult.overallAtsScore - (atsResult.fileSafety.tablesDetected ? 18 : 2))),
      tableTolerance: 'Fail',
      columnTolerance: 'Fail',
      dateParserStatus: 'Pass',
      parserMode: 'Sequential DOM Tokenizer & Strict Lexer',
      notes: 'Collapses double-column layouts horizontally. Drops text framed inside floating table cells.',
    },
    greenhouse: {
      name: 'Greenhouse Recruiting',
      vendor: 'Greenhouse Software',
      simulatedScore: Math.min(100, Math.max(45, atsResult.overallAtsScore + 2)),
      tableTolerance: 'Partial',
      columnTolerance: 'Partial',
      dateParserStatus: 'Pass',
      parserMode: 'Linear NLP Entity Extraction',
      notes: 'Preserves linear stream reading. High affinity for standard skills taxonomy and action verbs.',
    },
    lever: {
      name: 'Lever Talent Relationship Management',
      vendor: 'Lever / Employ Inc.',
      simulatedScore: Math.min(100, Math.max(50, atsResult.overallAtsScore + 4)),
      tableTolerance: 'Partial',
      columnTolerance: 'Pass',
      dateParserStatus: 'Pass',
      parserMode: 'N-Gram Vector Frequency & Candidate Tagging',
      notes: 'Robust plain text extractor. Tags candidates based on raw frequency of technical credentials.',
    },
    taleo: {
      name: 'Oracle Taleo Enterprise Edition',
      vendor: 'Oracle Corporation',
      simulatedScore: Math.min(100, Math.max(35, atsResult.overallAtsScore - 12)),
      tableTolerance: 'Fail',
      columnTolerance: 'Fail',
      dateParserStatus: 'Risk',
      parserMode: 'Legacy Hierarchical XML Tree Builder',
      notes: 'Extremely rigid section header rules. Rejects unconventional date formatting (e.g. "Summer 2024").',
    },
  };

  const activeProfile = engineProfiles[selectedEngine];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">ATS Simulation & Parser Lab</h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Simulates algorithmic parser behavior across Workday, Greenhouse, Lever, and Oracle Taleo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('builder')}
            className="px-3.5 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <span>Fix in Live Builder</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Engine Selection Tabs */}
      <div className="bg-white rounded-xl border border-[#EAE8E1] p-2 shadow-xs">
        <div className="text-[11px] font-bold text-[#6E6E63] uppercase tracking-wider px-3 py-1.5">
          Select Corporate ATS Engine Profile
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
          {(['workday', 'greenhouse', 'lever', 'taleo'] as AtsEngine[]).map((engKey) => {
            const prof = engineProfiles[engKey];
            const isSelected = selectedEngine === engKey;
            return (
              <button
                key={engKey}
                onClick={() => setSelectedEngine(engKey)}
                className={`p-3 rounded-lg text-left border transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#4F5D2F] bg-[#FAF9F5] shadow-2xs'
                    : 'border-[#EAE8E1] bg-white hover:border-[#D5D2C7]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs capitalize text-[#171713]">{engKey}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        prof.simulatedScore >= 80
                          ? 'bg-[#4F5D2F]/10 text-[#4F5D2F]'
                          : prof.simulatedScore >= 65
                          ? 'bg-[#C49A3A]/15 text-[#8E6D24]'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {prof.simulatedScore}%
                    </span>
                  </div>
                  <p className="text-[10px] text-[#6E6E63] mt-0.5 truncate">{prof.vendor}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Engine Diagnostics Breakdown Card */}
      <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAE8E1]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#171713]">{activeProfile.name}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF9F5] text-[#6E6E63] border border-[#EAE8E1]">
                {activeProfile.parserMode}
              </span>
            </div>
            <p className="text-xs text-[#6E6E63] mt-1">{activeProfile.notes}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-[#6E6E63] font-semibold uppercase">Engine Pass Likelihood</div>
              <div className="text-2xl font-black text-[#4F5D2F]">{activeProfile.simulatedScore}%</div>
            </div>
          </div>
        </div>

        {/* Engine-specific parser tolerances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs">
            <div className="text-[#6E6E63] text-[11px]">Table Cell Tolerance</div>
            <div className="font-bold text-[#171713] mt-1 flex items-center gap-1.5">
              {activeProfile.tableTolerance === 'Fail' ? (
                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Strict Drop Risk (No Tables Allowed)
                </span>
              ) : activeProfile.tableTolerance === 'Partial' ? (
                <span className="text-[#8E6D24] bg-[#C49A3A]/15 border border-[#C49A3A]/30 px-2 py-0.5 rounded text-[10px] font-bold">
                  Partial Parsing Support
                </span>
              ) : (
                <span className="text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/20 px-2 py-0.5 rounded text-[10px] font-bold">
                  Pass (Flattened Stream)
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs">
            <div className="text-[#6E6E63] text-[11px]">Two-Column Interleaving Risk</div>
            <div className="font-bold text-[#171713] mt-1 flex items-center gap-1.5">
              {activeProfile.columnTolerance === 'Fail' ? (
                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Critical Multi-Column Drop Risk
                </span>
              ) : (
                <span className="text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/20 px-2 py-0.5 rounded text-[10px] font-bold">
                  Linear Flow Preserved
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs">
            <div className="text-[#6E6E63] text-[11px]">Chronological Date Extractor</div>
            <div className="font-bold text-[#171713] mt-1 flex items-center gap-1.5">
              {activeProfile.dateParserStatus === 'Risk' ? (
                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Requires MM/YYYY Format
                </span>
              ) : (
                <span className="text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/20 px-2 py-0.5 rounded text-[10px] font-bold">
                  Robust Date Entity Recognition
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Detection & Formatting Safety Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Detection Matrix */}
        <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#4F5D2F]" />
              <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                Section Detection Taxonomy
              </h3>
            </div>
            <span className="text-[11px] text-[#6E6E63]">Standard Heading Validation</span>
          </div>

          <div className="divide-y divide-[#EAE8E1]">
            {atsResult.sectionDetection.map((sec, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {sec.detected ? (
                    <CheckCircle2 className="w-4 h-4 text-[#4F5D2F] shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-semibold text-[#171713]">{sec.section}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#6E6E63] text-[11px]">Heading: &quot;{sec.headingUsed}&quot;</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sec.detected
                        ? 'bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {sec.detected ? 'DETECTED' : 'MISSING'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Layout & Machine Readability */}
        <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-[#4F5D2F]" />
              <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                Layout & Machine Readability
              </h3>
            </div>
            <span className="text-[11px] text-[#6E6E63]">Stream Parser Risk</span>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-[#171713]">Machine Readability Layer</div>
                <div className="text-[11px] text-[#6E6E63]">Digital text extraction vs raster scan</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  atsResult.fileSafety.isMachineReadable
                    ? 'text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/30'
                    : 'text-rose-700 bg-rose-50 border border-rose-200'
                }`}
              >
                {atsResult.fileSafety.isMachineReadable ? '100% Vector Text' : 'Scan Risk'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-[#171713]">Multi-Column Layout Risk</div>
                <div className="text-[11px] text-[#6E6E63]">Detects parallel text flow interleaving</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  atsResult.fileSafety.columnsDetected
                    ? 'text-[#8E6D24] bg-[#C49A3A]/15 border border-[#C49A3A]/30'
                    : 'text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/30'
                }`}
              >
                {atsResult.fileSafety.columnsDetected ? 'Multi-Column (Risk)' : 'Safe (Linear Single-Column)'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-[#171713]">Embedded Tables Risk</div>
                <div className="text-[11px] text-[#6E6E63]">Checks for HTML/DOCX grid structures</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                  atsResult.fileSafety.tablesDetected
                    ? 'text-[#8E6D24] bg-[#C49A3A]/15 border border-[#C49A3A]/30'
                    : 'text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/30'
                }`}
              >
                {atsResult.fileSafety.tablesDetected ? 'Tables Found (Risk)' : 'Clean (No Tables)'}
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-[#171713]">Standard Font Safety</div>
                <div className="text-[11px] text-[#6E6E63]">Verified system-safe typeface indices</div>
              </div>
              <span className="px-2.5 py-1 rounded-full font-bold text-[11px] text-[#4F5D2F] bg-[#4F5D2F]/10 border border-[#4F5D2F]/30">
                {atsResult.fileSafety.fontSafetyScore}% Safe
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Major Deductions Table */}
      {atsResult.majorDeductions && atsResult.majorDeductions.length > 0 && (
        <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
              Major ATS Deductions & Parser Penalties
            </h3>
          </div>

          <div className="space-y-3">
            {atsResult.majorDeductions.map((ded, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-rose-100 text-rose-700 border border-rose-200">
                      -{ded.penalty} pts
                    </span>
                    <span className="font-bold text-[#171713]">{ded.factor}</span>
                  </div>
                  <p className="text-[#6E6E63]">{ded.explanation}</p>
                  <div className="text-[#4F5D2F] font-semibold pt-1">Recommended Fix: {ded.fix}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues Diagnostic Feed */}
      <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
              Diagnosed Issues ({issues.length})
            </h3>
            <p className="text-xs text-[#6E6E63] mt-0.5">
              Action verb weaknesses, missing metrics, and readability recommendations.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {['all', 'high', 'medium', 'low'].map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition ${
                  filterSeverity === sev
                    ? 'bg-[#4F5D2F] text-white'
                    : 'bg-[#FAF9F5] text-[#6E6E63] hover:text-[#171713] border border-[#EAE8E1]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#6E6E63]">
              No issues matching current filter.
            </div>
          ) : (
            filteredIssues.map((iss) => (
              <div
                key={iss.id}
                className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs shadow-2xs"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        iss.severity === 'high'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : iss.severity === 'medium'
                          ? 'bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30'
                          : 'bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20'
                      }`}
                    >
                      {iss.severity}
                    </span>
                    <span className="font-semibold text-[#171713] capitalize">
                      {iss.issue_type.replace('_', ' ')}
                    </span>
                    <span className="text-[#6E6E63]">• Section: {iss.section}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        iss.status === 'accepted'
                          ? 'text-[#4F5D2F] bg-[#4F5D2F]/10'
                          : iss.status === 'rejected'
                          ? 'text-[#6E6E63] bg-white border border-[#EAE8E1]'
                          : 'text-[#8E6D24] bg-[#C49A3A]/15'
                      }`}
                    >
                      Status: {iss.status}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-white text-[#171713] font-mono text-[11px] border border-[#EAE8E1]">
                    &quot;{iss.evidence}&quot;
                  </div>

                  <p className="text-[#6E6E63]">{iss.reason}</p>
                  <div className="text-[#4F5D2F] font-semibold">Suggestion: {iss.suggestion}</div>
                </div>

                {iss.status === 'pending' && (
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(iss.id, 'accepted')}
                      disabled={actingIssueId === iss.id}
                      className="px-3 py-1.5 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleAction(iss.id, 'rejected')}
                      disabled={actingIssueId === iss.id}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#6E6E63] hover:text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
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
