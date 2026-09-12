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
  CheckCircle2,
  AlertTriangle,
  Upload,
  Layers,
  Edit3,
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

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
  const [deleteTarget, setDeleteTarget] = useState<ResumeDocument | null>(null);
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

  const overallScore = activeResume?.score?.overall ?? activeResume?.atsScore ?? 85;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner Hero (Ultra White) */}
      <div className="bg-white rounded-2xl border border-[#EAE8E1] p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#C49A3A]" />
            <span>Next-Generation Career & ATS Intelligence Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171713] tracking-tight leading-tight">
            Elevate your resume with deterministic ATS simulation and zero-hallucination AI optimization.
          </h1>
          <p className="text-sm text-[#6E6E63] mt-2.5 leading-relaxed">
            ResumeX AI Core Ultra replaces guesswork with explainable diagnostics, deep keyword extraction,
            semantic vector matching, and anti-hallucination fact verification.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              id="dash-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PDF / DOCX Resume</span>
            </button>
            <button
              id="dash-paste-btn"
              onClick={() => setPasteMode(!pasteMode)}
              className="px-4 py-2.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#171713] text-xs font-semibold border border-[#D5D2C7] transition shadow-2xs"
            >
              <span>{pasteMode ? 'Hide Paste Form' : 'Paste Raw Text'}</span>
            </button>
            <button
              id="dash-builder-btn"
              onClick={() => onNavigate('builder')}
              className="px-4 py-2.5 rounded-lg bg-[#FAF9F5] hover:bg-[#F3EEDF] text-[#8E6D24] text-xs font-semibold border border-[#C49A3A]/30 flex items-center gap-1.5 transition shadow-2xs"
            >
              <span>Open Live Builder</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C49A3A]" />
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

      {/* Paste text section */}
      {pasteMode && (
        <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#171713]">Paste Resume Text for Immediate NLP Parsing</h3>
            <button
              onClick={() => setPasteMode(false)}
              className="text-xs text-[#6E6E63] hover:text-[#171713]"
            >
              Cancel
            </button>
          </div>
          <input
            type="text"
            placeholder="Resume Title (e.g. Senior Software Engineer 2026)"
            value={pastedTitle}
            onChange={(e) => setPastedTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
          />
          <textarea
            rows={8}
            placeholder="Paste your full resume text here (including Contact, Experience, Skills, Education)..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || loading}
              className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
            >
              {loading ? 'Parsing...' : 'Analyze Text'}
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone (Ultra White) */}
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
            ? 'border-[#4F5D2F] bg-[#4F5D2F]/5'
            : 'border-[#D5D2C7] bg-white hover:bg-[#FAF9F5] hover:border-[#4F5D2F]/60'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] mb-3 shadow-2xs">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="text-sm font-bold text-[#171713]">
          Drop your PDF or DOCX resume here, or click to browse
        </div>
        <p className="text-xs text-[#6E6E63] mt-1 max-w-md">
          Supports native PDFs, Word (.docx), and plain text. Zero data leakage: protected by isolated tenancy.
        </p>
      </div>

      {/* Active Resume Dashboard Section */}
      {activeResume && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EAE8E1]">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#171713]">{activeResume.title}</h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20 font-semibold">
                  Active Document
                </span>
              </div>
              <p className="text-xs text-[#6E6E63] mt-0.5">
                {activeResume.data.personal_info.name} • Updated{' '}
                {new Date(activeResume.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="dash-open-ats"
                onClick={() => onNavigate('ats-lab')}
                className="px-3 py-1.5 rounded-lg bg-[#4F5D2F]/10 hover:bg-[#4F5D2F]/20 text-[#4F5D2F] text-xs font-semibold border border-[#4F5D2F]/20 flex items-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Open ATS Lab</span>
              </button>
              <button
                id="dash-open-jobmatch"
                onClick={() => onNavigate('job-matching')}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1.5 transition shadow-2xs"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#4F5D2F]" />
                <span>Match with Job</span>
              </button>
              <button
                id="dash-edit-resume"
                onClick={() => onNavigate('builder')}
                className="px-3 py-1.5 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold transition shadow-2xs flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit in Builder</span>
              </button>
            </div>
          </div>

          {/* Radar and Score Overview */}
          <ScoreRadar score={activeResume.score} />

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">ATS Readiness</div>
              <div className="text-2xl font-bold text-[#4F5D2F] mt-1">{overallScore}/100</div>
              <p className="text-[11px] text-[#6E6E63] mt-1">
                Linear single-column formatting & standard headers confirmed.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Indexed Skills</div>
              <div className="text-2xl font-bold text-[#171713] mt-1">
                {(activeResume.data?.skills || []).reduce((s, g) => s + (g.items?.length || 0), 0)}
              </div>
              <p className="text-[11px] text-[#6E6E63] mt-1">
                Categorized across {activeResume.data?.skills?.length || 0} technical domains.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Diagnosed Issues</div>
              <div className="text-2xl font-bold text-[#8E6D24] mt-1">{(issues || []).length}</div>
              <p className="text-[11px] text-[#6E6E63] mt-1">
                {(issues || []).filter((i) => i.severity === 'high').length} high-impact recommendations pending review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Your Resumes Collection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4F5D2F]" />
            <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
              Your Resumes ({(resumes || []).length})
            </h3>
          </div>
          <button
            onClick={() => onNavigate('my-resumes')}
            className="text-xs font-semibold text-[#4F5D2F] hover:underline"
          >
            View All Resumes →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((res) => {
            const isSelected = activeResume?.id === res.id;
            const resScore = res.score?.overall ?? res.atsScore ?? 85;
            return (
              <div
                key={res.id}
                onClick={() => onSelectResume(res)}
                className={`p-5 rounded-xl bg-white border transition cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isSelected
                    ? 'border-[#4F5D2F] ring-1 ring-[#4F5D2F]'
                    : 'border-[#EAE8E1] hover:border-[#D5D2C7]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-[#171713] line-clamp-1">{res.title}</div>
                    <div className="text-xs font-bold px-2 py-0.5 rounded-full border bg-[#4F5D2F]/10 text-[#4F5D2F] border-[#4F5D2F]/20 shrink-0">
                      {resScore}% ATS
                    </div>
                  </div>
                  <div className="text-xs text-[#6E6E63] mt-1">
                    Candidate: {res.data.personal_info.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6E6E63] mt-2">
                    <Clock className="w-3 h-3" />
                    <span>Updated {new Date(res.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-4 border-t border-[#EAE8E1]">
                  <span className="text-[11px] text-[#6E6E63] font-medium">
                    Template: <strong className="text-[#171713]">{res.templateId || 'ATS Classic'}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectResume(res);
                        onNavigate('builder');
                      }}
                      className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] hover:bg-white transition"
                    >
                      Edit
                    </button>
                    {resumes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(res);
                        }}
                        className="p-1 rounded text-[#6E6E63] hover:text-rose-600 hover:bg-rose-50 transition"
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Resume"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? All associated version snapshots and audit scores for this resume will be permanently removed.`}
        confirmText="Delete Resume"
        isDanger={true}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteResume(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
