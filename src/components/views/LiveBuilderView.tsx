import React, { useState, useRef } from 'react';
import type { ResumeDocument, TemplateDefinition, OptimizationSuggestion, ResumeData } from '../../types';
import { ResumeRenderer } from '../ResumeRenderer';
import { api } from '../../services/api';
import { MASTER_TEMPLATES } from '../../constants/templates';
import { jsPDF } from 'jspdf';
import {
  Save,
  Download,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
  Eye,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LiveBuilderViewProps {
  resume: ResumeDocument | null;
  onUpdateResume: (data: ResumeData, title?: string, templateId?: string) => Promise<void>;
  templates: TemplateDefinition[];
}

export const LiveBuilderView: React.FC<LiveBuilderViewProps> = ({
  resume,
  onUpdateResume,
  templates,
}) => {
  if (!resume) {
    return (
      <div className="text-center py-20 text-slate-400">
        No active resume selected.
      </div>
    );
  }

  const [formData, setFormData] = useState<ResumeData>(JSON.parse(JSON.stringify(resume.data)));
  const [resumeTitle, setResumeTitle] = useState(resume.title);
  const [selectedTemplateId, setSelectedTemplateId] = useState(resume.templateId || 'ats-classic');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // AI Optimization modal / state
  const [optimizingBullet, setOptimizingBullet] = useState<{ expIdx: number; bulletIdx: number } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<OptimizationSuggestion | null>(null);
  const [userTruthConfirmed, setUserTruthConfirmed] = useState(false);
  const [optimizingSummary, setOptimizingSummary] = useState(false);

  const printContainerRef = useRef<HTMLDivElement>(null);

  const currentTemplate =
    templates.find((t) => t.id === selectedTemplateId) ||
    MASTER_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
    MASTER_TEMPLATES[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateResume(formData, resumeTitle, selectedTemplateId);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  // --- AI Bullet Optimization with ResumeTruth Verification ---
  const handleTriggerOptimizeBullet = async (expIdx: number, bulletIdx: number) => {
    const bullet = formData.experience[expIdx].bullets[bulletIdx];
    const role = formData.experience[expIdx].role;
    const company = formData.experience[expIdx].company;

    setOptimizingBullet({ expIdx, bulletIdx });
    setUserTruthConfirmed(false);

    try {
      const res = await api.optimizeBullet(resume.id, bullet, role, company);
      setActiveSuggestion(res.suggestion);
    } catch (err) {
      alert('Optimization call failed.');
      setOptimizingBullet(null);
    }
  };

  const handleApplySuggestion = () => {
    if (!activeSuggestion || !optimizingBullet) return;
    const { expIdx, bulletIdx } = optimizingBullet;

    const updated = { ...formData };
    updated.experience[expIdx].bullets[bulletIdx] = activeSuggestion.after;
    setFormData(updated);

    setActiveSuggestion(null);
    setOptimizingBullet(null);
  };

  // --- AI Summary Optimization ---
  const handleTriggerOptimizeSummary = async () => {
    setOptimizingSummary(true);
    try {
      const res = await api.optimizeSummary(
        resume.id,
        formData.summary || '',
        'Senior Software Engineer'
      );
      setActiveSuggestion(res.suggestion);
    } catch (err) {
      alert('Summary optimization failed.');
    } finally {
      setOptimizingSummary(false);
    }
  };

  // --- Exporting ---
  const handleExportPdf = () => {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'letter',
    });

    const plain = api.exportPlainText(formData).then((res) => {
      // Create high-readability PDF
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(res.plainText, 540);
      doc.text(splitText, 36, 40);
      doc.save(`${resumeTitle.replace(/\s+/g, '_')}.pdf`);
    });
  };

  const handleExportPlainText = async () => {
    const res = await api.exportPlainText(formData);
    const blob = new Blob([res.plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resumeTitle.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Field helpers
  const handleAddExperience = () => {
    setFormData({
      ...formData,
      experience: [
        {
          id: `exp-${Date.now()}`,
          company: 'New Company',
          role: 'Role Title',
          startDate: '2022',
          endDate: 'Present',
          bullets: ['Engineered high-throughput solutions resulting in measurable team velocity.'],
        },
        ...formData.experience,
      ],
    });
  };

  const handleAddBullet = (expIdx: number) => {
    const updated = { ...formData };
    updated.experience[expIdx].bullets.push('Architected scalable component with active unit and integration tests.');
    setFormData(updated);
  };

  const handleRemoveBullet = (expIdx: number, bulletIdx: number) => {
    const updated = { ...formData };
    updated.experience[expIdx].bullets.splice(bulletIdx, 1);
    setFormData(updated);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={resumeTitle}
            onChange={(e) => setResumeTitle(e.target.value)}
            className="text-sm font-bold text-white bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 w-64"
          />

          {/* Template Quick Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Template:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="text-xs bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 max-w-xs"
            >
              {MASTER_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} ({tmpl.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedNotice && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved!
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleExportPlainText}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Plain Text</span>
          </button>
        </div>
      </div>

      {/* Two-Pane Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Editor Pane (5 cols) */}
        <div className="lg:col-span-6 space-y-6 max-h-[85vh] overflow-y-auto pr-2">
          {/* Personal Info */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Contact & Header</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400">Full Name</label>
                <input
                  type="text"
                  value={formData.personal_info.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal_info: { ...formData.personal_info, name: e.target.value },
                    })
                  }
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Email Address</label>
                <input
                  type="email"
                  value={formData.personal_info.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal_info: { ...formData.personal_info, email: e.target.value },
                    })
                  }
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Phone</label>
                <input
                  type="text"
                  value={formData.personal_info.phone || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal_info: { ...formData.personal_info, phone: e.target.value },
                    })
                  }
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Location (City, State)</label>
                <input
                  type="text"
                  value={formData.personal_info.location || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal_info: { ...formData.personal_info, location: e.target.value },
                    })
                  }
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Professional Summary */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Professional Summary</h3>
              <button
                onClick={handleTriggerOptimizeSummary}
                disabled={optimizingSummary}
                className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[11px] font-semibold border border-sky-500/20 flex items-center gap-1 transition"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>{optimizingSummary ? 'Optimizing...' : 'AI Refine'}</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={formData.summary || ''}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed"
            />
          </div>

          {/* Work Experience */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Work Experience ({formData.experience.length})
              </h3>
              <button
                onClick={handleAddExperience}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" />
                <span>Add Role</span>
              </button>
            </div>

            <div className="space-y-4">
              {formData.experience.map((exp, expIdx) => (
                <div key={exp.id} className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400">Role Title</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => {
                          const updated = { ...formData };
                          updated.experience[expIdx].role = e.target.value;
                          setFormData(updated);
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => {
                          const updated = { ...formData };
                          updated.experience[expIdx].company = e.target.value;
                          setFormData(updated);
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Dates</label>
                      <input
                        type="text"
                        value={`${exp.startDate} - ${exp.endDate}`}
                        onChange={(e) => {
                          const updated = { ...formData };
                          const [s, end] = e.target.value.split('-');
                          updated.experience[expIdx].startDate = s?.trim() || exp.startDate;
                          updated.experience[expIdx].endDate = end?.trim() || exp.endDate;
                          setFormData(updated);
                        }}
                        className="w-full mt-0.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  {/* Bullet points list */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Bullets (Action + Metric + Impact)</span>
                      <button
                        onClick={() => handleAddBullet(expIdx)}
                        className="text-sky-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add bullet
                      </button>
                    </div>

                    {exp.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.experience[expIdx].bullets[bIdx] = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-sky-500"
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            title="AI Optimize with ResumeTruth Anti-Hallucination Policy"
                            onClick={() => handleTriggerOptimizeBullet(expIdx, bIdx)}
                            className="p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          {exp.bullets.length > 1 && (
                            <button
                              onClick={() => handleRemoveBullet(expIdx, bIdx)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Live Preview Pane (6 cols) */}
        <div className="lg:col-span-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800 sticky top-20 max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Live Render Canvas ({currentTemplate.name})</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Auto-Refreshes</span>
          </div>

          <ResumeRenderer
            data={formData}
            template={currentTemplate}
            containerRef={printContainerRef}
          />
        </div>
      </div>

      {/* ResumeTruth Anti-Hallucination Confirmation Modal */}
      {activeSuggestion && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-white">Controlled AI Optimization</h3>
              </div>
              <button
                onClick={() => setActiveSuggestion(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ResumeTruth Verdict Banner */}
            <div
              className={`p-3 rounded-lg text-xs border ${
                activeSuggestion.truthCheckVerdict === 'PASS'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
            >
              <div className="font-bold">
                ResumeTruth Anti-Hallucination Status:{' '}
                {activeSuggestion.truthCheckVerdict === 'PASS'
                  ? 'VERIFIED COMPLIANT'
                  : 'REQUIRES CANDIDATE CONFIRMATION'}
              </div>
              <div className="text-[11px] mt-0.5">{activeSuggestion.reason}</div>
            </div>

            {/* Before vs After */}
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-slate-400 text-[11px]">Original Text:</span>
                <div className="p-2.5 rounded bg-slate-950 text-slate-400 border border-slate-800 line-through">
                  {activeSuggestion.before}
                </div>
              </div>

              <div>
                <span className="font-bold text-emerald-400 text-[11px]">Proposed Optimization:</span>
                <div className="p-2.5 rounded bg-slate-950 text-emerald-200 border border-emerald-500/40">
                  {activeSuggestion.after}
                </div>
              </div>
            </div>

            {/* If unverified claims exist, prompt candidate */}
            {activeSuggestion.truthQuestion && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Verification Prompt:</span>
                </div>
                <p className="text-slate-300">{activeSuggestion.truthQuestion}</p>
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={userTruthConfirmed}
                    onChange={(e) => setUserTruthConfirmed(e.target.checked)}
                    className="rounded border-slate-700 text-sky-600 focus:ring-0"
                  />
                  <span className="text-[11px]">
                    I verify that this information accurately reflects my work and contains no fabricated metrics.
                  </span>
                </label>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setActiveSuggestion(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Reject
              </button>
              <button
                onClick={handleApplySuggestion}
                disabled={activeSuggestion.truthCheckVerdict !== 'PASS' && !userTruthConfirmed}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50 transition"
              >
                Apply to Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
