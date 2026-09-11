import React, { useState, useRef } from 'react';
import type { ResumeDocument, AnalysisIssue } from '../../types';
import { ScoreRadar } from '../ScoreRadar';
import {
  UploadCloud,
  FileText,
  ShieldCheck,
  Briefcase,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Plus,
  Clock,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface DashboardViewProps {
  resumes: ResumeDocument[];
  activeResume: ResumeDocument | null;
  onSelectResume: (res: ResumeDocument) => void;
  onUpload: (payload: { fileBase64?: string; fileName?: string; mimeType?: string; rawText?: string }) => Promise<void>;
  onNavigate: (tab: string) => void;
  onDeleteResume: (id: string) => void;
  issues: AnalysisIssue[];
  loading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  resumes,
  activeResume,
  onSelectResume,
  onUpload,
  onNavigate,
  onDeleteResume,
  issues,
  loading,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await onUpload({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    await onUpload({
      rawText: pastedText,
      fileName: pastedTitle.trim() ? `${pastedTitle.trim()}.txt` : 'Direct Text Input.txt',
    });
    setPastedText('');
    setPasteMode(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 p-6 sm:p-8 shadow-lg">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Next-Generation Career & ATS Intelligence Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Elevate your resume with deterministic ATS simulation and zero-hallucination AI optimization.
          </h1>
          <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">
            ResumeX AI Core Ultra replaces guessing with explainable diagnostics, deep keyword extraction,
            semantic job matching, and anti-hallucination truth verification.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload PDF / DOCX Resume</span>
            </button>
            <button
              onClick={() => setPasteMode(!pasteMode)}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <span>{pasteMode ? 'Hide Paste Form' : 'Paste Raw Text'}</span>
            </button>
            <button
              onClick={() => onNavigate('builder')}
              className="px-4 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition"
            >
              <span>Open Live Builder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,.txt"
        className="hidden"
      />

      {/* Paste text modal / section */}
      {pasteMode && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200">Paste Resume Text for Immediate NLP Parsing</h3>
            <button
              onClick={() => setPasteMode(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            placeholder="Resume Title (e.g. Senior Software Engineer 2026)"
            value={pastedTitle}
            onChange={(e) => setPastedTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
          />
          <textarea
            rows={8}
            placeholder="Paste your full resume text here (including Contact, Experience, Skills, Education)..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || loading}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50 transition"
            >
              {loading ? 'Parsing...' : 'Analyze Text'}
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
          dragOver
            ? 'border-sky-400 bg-sky-500/10'
            : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-sky-400 mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="text-sm font-bold text-slate-200">
          Drop your PDF or DOCX resume here, or click to browse
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Supports native PDFs, Word (.docx), and plain text. Zero data leakage: protected by isolated tenancy.
        </p>
      </div>

      {/* Active Resume Dashboard Section */}
      {activeResume ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{activeResume.title}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Active Analysis Target
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeResume.data.personal_info.name} • Updated{' '}
                {new Date(activeResume.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('ats-lab')}
                className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-xs font-semibold border border-sky-500/30 flex items-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Open ATS Lab</span>
              </button>
              <button
                onClick={() => onNavigate('job-matching')}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1.5 transition"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Match with Job</span>
              </button>
              <button
                onClick={() => onNavigate('builder')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <span>Edit Resume</span>
              </button>
            </div>
          </div>

          {/* Radar and Score Overview */}
          <ScoreRadar score={activeResume.score} />

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs font-medium text-slate-400">ATS Readiness</div>
              <div className="text-2xl font-bold text-sky-400 mt-1">{activeResume.atsScore}/100</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Linear single-column formatting & standard headers detected.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs font-medium text-slate-400">Indexed Skills</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {activeResume.data.skills.reduce((s, g) => s + g.items.length, 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Categorized across {activeResume.data.skills.length} technical domains.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs font-medium text-slate-400">Diagnosed Issues</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{issues.length}</div>
              <p className="text-[11px] text-slate-500 mt-1">
                {issues.filter((i) => i.severity === 'high').length} high-impact recommendations pending review.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Your Resumes Collection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Your Resumes ({resumes.length})
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((res) => {
            const isSelected = activeResume?.id === res.id;
            return (
              <div
                key={res.id}
                onClick={() => onSelectResume(res)}
                className={`p-4 rounded-xl bg-slate-900 border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500 shadow-md shadow-sky-500/10 ring-1 ring-sky-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-sm text-slate-100 line-clamp-1">{res.title}</div>
                    {(() => {
                      const overall = res.score?.overall ?? res.atsScore ?? 85;
                      return (
                        <div
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            overall >= 80
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                          }`}
                        >
                          {overall}%
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Candidate: {res.data.personal_info.name}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-2">
                    <Clock className="w-3 h-3" />
                    <span>Updated {new Date(res.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 font-medium">
                    ATS Score: <strong className="text-slate-200">{res.atsScore ?? res.score?.atsCompatibility ?? 85}%</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectResume(res);
                        onNavigate('builder');
                      }}
                      className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      Edit
                    </button>
                    {resumes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${res.title}"?`)) {
                            onDeleteResume(res.id);
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
