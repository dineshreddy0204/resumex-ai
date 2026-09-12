import React, { useState } from 'react';
import type { ResumeDocument } from '../../types';
import {
  FileText,
  Plus,
  Upload,
  ExternalLink,
  Trash2,
  Copy,
  Download,
  ShieldCheck,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface MyResumesViewProps {
  resumes: ResumeDocument[];
  activeResume: ResumeDocument | null;
  onSelectResume: (resume: ResumeDocument) => void;
  onCreateNew: () => void;
  onUploadClick: () => void;
  onDeleteResume: (resumeId: string) => Promise<void>;
  onNavigateTab: (tab: any) => void;
}

export const MyResumesView: React.FC<MyResumesViewProps> = ({
  resumes,
  activeResume,
  onSelectResume,
  onCreateNew,
  onUploadClick,
  onDeleteResume,
  onNavigateTab,
}) => {
  const [deleteTarget, setDeleteTarget] = useState<ResumeDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteResume(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#EAE8E1] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">My Resumes</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20">
              {resumes.length} {resumes.length === 1 ? 'Document' : 'Documents'}
            </span>
          </div>
          <p className="text-sm text-[#6E6E63]">
            Manage your ATS-optimized resume variants, version branches, and job-tailored documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="upload-resume-btn-myresumes"
            onClick={onUploadClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D5D2C7] bg-white text-[#171713] text-sm font-medium hover:bg-[#FAF9F5] transition shadow-xs"
          >
            <Upload className="w-4 h-4 text-[#4F5D2F]" />
            Upload PDF / DOCX
          </button>
          <button
            id="create-resume-btn-myresumes"
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4F5D2F] text-white text-sm font-medium hover:bg-[#37421F] transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Build from Scratch
          </button>
        </div>
      </div>

      {/* Resumes Grid */}
      {resumes.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D5D2C7] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center mx-auto text-[#4F5D2F]">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-[#171713]">No resumes created yet</h3>
          <p className="text-sm text-[#6E6E63] max-w-sm mx-auto">
            Upload your current PDF/DOCX resume for immediate ATS diagnostics, or construct a pristine, verified resume with our live builder.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onUploadClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#4F5D2F] text-white text-sm font-medium hover:bg-[#37421F] transition shadow-xs"
            >
              <Upload className="w-4 h-4" />
              Upload Resume
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {resumes.map((resume) => {
            const isActive = activeResume?.id === resume.id;
            const overallScore = resume.score?.overall ?? resume.atsScore ?? 85;
            const scoreColor =
              overallScore >= 85
                ? 'text-[#4F5D2F] bg-[#4F5D2F]/10 border-[#4F5D2F]/20'
                : overallScore >= 70
                ? 'text-[#C49A3A] bg-[#C49A3A]/10 border-[#C49A3A]/20'
                : 'text-rose-700 bg-rose-50 border-rose-200';

            return (
              <div
                key={resume.id}
                id={`resume-card-${resume.id}`}
                className={`bg-white rounded-xl border p-5 transition relative flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isActive ? 'border-[#4F5D2F] ring-1 ring-[#4F5D2F]' : 'border-[#EAE8E1] hover:border-[#D5D2C7]'
                }`}
              >
                {/* Header Badge */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#171713] text-base leading-tight line-clamp-1">
                          {resume.title || 'Untitled Resume'}
                        </h3>
                        <p className="text-xs text-[#6E6E63] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Updated {new Date(resume.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 shrink-0 ${scoreColor}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{overallScore}/100 ATS</span>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap gap-2 my-3 text-xs text-[#6E6E63]">
                    <span className="px-2 py-0.5 rounded bg-[#FAF9F5] border border-[#EAE8E1]">
                      Template: {resume.templateId || 'ATS Classic'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#FAF9F5] border border-[#EAE8E1]">
                      {resume.data?.experience?.length || 0} Experiences
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#FAF9F5] border border-[#EAE8E1]">
                      {resume.data?.skills?.reduce((acc, g) => acc + (g.items?.length || 0), 0) || 0} Skills
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 border-t border-[#EAE8E1] flex items-center justify-between gap-2 mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      id={`open-builder-${resume.id}`}
                      onClick={() => {
                        onSelectResume(resume);
                        onNavigateTab('builder');
                      }}
                      className="px-3 py-1.5 rounded-md bg-[#4F5D2F] text-white text-xs font-medium hover:bg-[#37421F] transition flex items-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      id={`open-ats-${resume.id}`}
                      onClick={() => {
                        onSelectResume(resume);
                        onNavigateTab('ats-lab');
                      }}
                      className="px-3 py-1.5 rounded-md border border-[#D5D2C7] bg-white text-[#171713] text-xs font-medium hover:bg-[#FAF9F5] transition flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#4F5D2F]" />
                      Audit
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      id={`delete-resume-${resume.id}`}
                      onClick={() => setDeleteTarget(resume)}
                      className="p-1.5 rounded-md text-[#6E6E63] hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Resume"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Resume"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? All associated version snapshots and audit scores for this resume will be permanently removed.`}
        confirmText="Delete Resume"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
