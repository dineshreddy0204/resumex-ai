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
  ShieldCheck,
  Layers,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
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
      <div className="text-center py-20 bg-white rounded-2xl border border-[#EAE8E1] p-8 max-w-lg mx-auto shadow-xs">
        <FileText className="w-12 h-12 text-[#6E6E63] mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#171713]">No Active Resume Selected</h3>
        <p className="text-xs text-[#6E6E63] mt-1">Please select or create a resume from the dashboard to edit.</p>
      </div>
    );
  }

  const [formData, setFormData] = useState<ResumeData>(JSON.parse(JSON.stringify(resume.data)));
  const [resumeTitle, setResumeTitle] = useState(resume.title);
  const [selectedTemplateId, setSelectedTemplateId] = useState(resume.templateId || 'ats-classic');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Accordion collapsed state for sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    contact: false,
    summary: false,
    experience: false,
    skills: false,
    education: false,
  });

  // AI Optimization modal state
  const [optimizingBullet, setOptimizingBullet] = useState<{ expIdx: number; bulletIdx: number } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<OptimizationSuggestion | null>(null);
  const [userTruthConfirmed, setUserTruthConfirmed] = useState(false);
  const [optimizingSummary, setOptimizingSummary] = useState(false);

  const printContainerRef = useRef<HTMLDivElement>(null);

  const currentTemplate =
    templates.find((t) => t.id === selectedTemplateId) ||
    MASTER_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
    MASTER_TEMPLATES[0];

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
    } catch (err: any) {
      setToastMessage(err.message || 'Optimization request failed.');
      setTimeout(() => setToastMessage(null), 3000);
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
        formData.experience[0]?.role || 'Senior Software Engineer'
      );
      setActiveSuggestion(res.suggestion);
    } catch (err: any) {
      setToastMessage(err.message || 'Summary optimization failed.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setOptimizingSummary(false);
    }
  };

  // --- Exporting ---
  const [exportingDocx, setExportingDocx] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [validatingExport, setValidatingExport] = useState(false);
  const [exportValidation, setExportValidation] = useState<any | null>(null);

  const parseHexColor = (hex: string): [number, number, number] => {
    const clean = (hex || '#171713').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const handleOpenExportModal = async () => {
    setShowExportModal(true);
    setValidatingExport(true);
    try {
      const res = await api.validateExport(formData);
      setExportValidation(res.validation);
    } catch {
      setExportValidation(null);
    } finally {
      setValidatingExport(false);
    }
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'letter',
    });

    const primaryRgb = parseHexColor(currentTemplate.primaryColor || '#0f172a');
    const secondaryRgb = parseHexColor(currentTemplate.secondaryColor || '#475569');
    const accentRgb = parseHexColor(currentTemplate.accentColor || '#0284c7');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = 46;

    const checkPageBreak = (neededHeight: number) => {
      if (cursorY + neededHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    // 1. Candidate Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    const name = formData.personal_info?.name || 'Candidate Name';
    const isCentered = currentTemplate.headerStyle === 'centered';
    if (isCentered) {
      doc.text(name, pageWidth / 2, cursorY, { align: 'center' });
    } else {
      doc.text(name, margin, cursorY);
    }
    cursorY += 16;

    // 2. Contact Details
    const contactParts: string[] = [];
    if (formData.personal_info?.email) contactParts.push(formData.personal_info.email);
    if (formData.personal_info?.phone) contactParts.push(formData.personal_info.phone);
    if (formData.personal_info?.location) contactParts.push(formData.personal_info.location);
    if (formData.personal_info?.linkedin) contactParts.push(formData.personal_info.linkedin);
    if (formData.personal_info?.github) contactParts.push(formData.personal_info.github);

    if (contactParts.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
      const contactStr = contactParts.join('   •   ');
      if (isCentered) {
        doc.text(contactStr, pageWidth / 2, cursorY, { align: 'center' });
      } else {
        doc.text(contactStr, margin, cursorY);
      }
      cursorY += 14;
    }

    // Top Divider
    doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.setLineWidth(1);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 16;

    const renderSectionHeader = (title: string) => {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(title.toUpperCase(), margin, cursorY);
      cursorY += 4;
      doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 12;
    };

    // 3. Professional Summary
    if (formData.summary && formData.summary.trim()) {
      renderSectionHeader('Professional Summary');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(40, 40, 40);
      const splitSummary = doc.splitTextToSize(formData.summary.trim(), contentWidth);
      checkPageBreak(splitSummary.length * 12 + 8);
      doc.text(splitSummary, margin, cursorY);
      cursorY += splitSummary.length * 12 + 10;
    }

    // 4. Skills
    if (formData.skills && formData.skills.length > 0) {
      renderSectionHeader('Technical Skills & Expertise');
      for (const group of formData.skills) {
        if (!group.items || group.items.length === 0) continue;
        checkPageBreak(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        const catLabel = `${group.category}: `;
        doc.text(catLabel, margin, cursorY);
        const catWidth = doc.getTextWidth(catLabel);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const itemsStr = group.items.join(', ');
        const splitItems = doc.splitTextToSize(itemsStr, contentWidth - catWidth);
        doc.text(splitItems, margin + catWidth, cursorY);
        cursorY += splitItems.length * 12 + 2;
      }
      cursorY += 6;
    }

    // 5. Work Experience
    if (formData.experience && formData.experience.length > 0) {
      renderSectionHeader('Professional Experience');
      for (const exp of formData.experience) {
        checkPageBreak(36);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(exp.role || 'Role', margin, cursorY);

        const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
        if (dateRange) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          doc.text(dateRange, pageWidth - margin, cursorY, { align: 'right' });
        }
        cursorY += 12;

        if (exp.company) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          const compLoc = [exp.company, exp.location].filter(Boolean).join('  •  ');
          doc.text(compLoc, margin, cursorY);
          cursorY += 12;
        }

        for (const bullet of exp.bullets || []) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(40, 40, 40);
          const splitBullet = doc.splitTextToSize(bullet, contentWidth - 14);
          checkPageBreak(splitBullet.length * 11 + 4);
          doc.text('•', margin + 2, cursorY);
          doc.text(splitBullet, margin + 12, cursorY);
          cursorY += splitBullet.length * 11 + 3;
        }
        cursorY += 6;
      }
    }

    // 6. Projects
    if (formData.projects && formData.projects.length > 0) {
      renderSectionHeader('Key Projects');
      for (const proj of formData.projects) {
        checkPageBreak(24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(proj.title, margin, cursorY);

        if (proj.technologies && proj.technologies.length > 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          doc.text(`[${proj.technologies.join(', ')}]`, pageWidth - margin, cursorY, { align: 'right' });
        }
        cursorY += 12;

        for (const bullet of proj.bullets || []) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(40, 40, 40);
          const splitBullet = doc.splitTextToSize(bullet, contentWidth - 14);
          checkPageBreak(splitBullet.length * 11 + 4);
          doc.text('•', margin + 2, cursorY);
          doc.text(splitBullet, margin + 12, cursorY);
          cursorY += splitBullet.length * 11 + 3;
        }
        cursorY += 4;
      }
    }

    // 7. Education
    if (formData.education && formData.education.length > 0) {
      renderSectionHeader('Education');
      for (const edu of formData.education) {
        checkPageBreak(24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(edu.degree || 'Degree', margin, cursorY);

        const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
        if (eduDates) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          doc.text(eduDates, pageWidth - margin, cursorY, { align: 'right' });
        }
        cursorY += 12;

        if (edu.institution) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          const line = [edu.institution, edu.fieldOfStudy, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join('  •  ');
          doc.text(line, margin, cursorY);
          cursorY += 12;
        }
      }
    }

    // 8. Certifications
    if (formData.certifications && formData.certifications.length > 0) {
      renderSectionHeader('Certifications');
      for (const cert of formData.certifications) {
        checkPageBreak(16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        const certLine = `•  ${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}`;
        const splitCert = doc.splitTextToSize(certLine, contentWidth);
        doc.text(splitCert, margin, cursorY);
        cursorY += splitCert.length * 11 + 2;
      }
    }

    doc.save(`${(formData.personal_info?.name || resumeTitle).replace(/\s+/g, '_')}_ResumeX.pdf`);
    setToastMessage('Formatted PDF downloaded successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      const blob = await api.exportDocx(formData, selectedTemplateId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(formData.personal_info?.name || resumeTitle).replace(/\s+/g, '_')}_ResumeX.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage('Word Document (.docx) downloaded successfully.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setToastMessage(err.message || 'DOCX export failed.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setExportingDocx(false);
    }
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
    setToastMessage('Plain text file downloaded.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Experience handlers
  const handleAddExperience = () => {
    setFormData({
      ...formData,
      experience: [
        {
          id: `exp-${Date.now()}`,
          company: 'Company / Organization',
          role: 'Role Title',
          startDate: '2023',
          endDate: 'Present',
          bullets: ['Spearheaded engineering deliverables and collaborated across multidisciplinary teams.'],
        },
        ...formData.experience,
      ],
    });
  };

  const handleAddBullet = (expIdx: number) => {
    const updated = { ...formData };
    updated.experience[expIdx].bullets.push('Architected resilient sub-system improving performance metrics.');
    setFormData(updated);
  };

  const handleRemoveBullet = (expIdx: number, bulletIdx: number) => {
    const updated = { ...formData };
    updated.experience[expIdx].bullets.splice(bulletIdx, 1);
    setFormData(updated);
  };

  // Approximate content density / page budget calculation
  const totalBullets = formData.experience.reduce((acc, e) => acc + e.bullets.length, 0);
  const totalWords = (formData.summary?.split(/\s+/).length || 0) + totalBullets * 18;
  const pageCapacity = Math.min(100, Math.round((totalWords / 450) * 100));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#C49A3A]/40 text-xs text-[#8E6D24] font-medium flex items-center justify-between shadow-xs">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-[#6E6E63]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={resumeTitle}
            onChange={(e) => setResumeTitle(e.target.value)}
            className="text-sm font-bold text-[#171713] bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F] w-64"
          />

          {/* Template Quick Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6E6E63]">Template:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="text-xs bg-white border border-[#D5D2C7] text-[#171713] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F] max-w-xs font-medium"
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
            <span className="text-xs text-[#4F5D2F] font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved!
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1.5 transition shadow-2xs"
            title="Download formatted PDF matching active template"
          >
            <Download className="w-3.5 h-3.5 text-[#4F5D2F]" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportDocx}
            disabled={exportingDocx}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
            title="Download Microsoft Word .docx matching active template"
          >
            <FileText className="w-3.5 h-3.5 text-[#0284c7]" />
            <span>{exportingDocx ? 'Exporting...' : 'DOCX'}</span>
          </button>

          <button
            onClick={handleOpenExportModal}
            className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] hover:bg-white text-[#6E6E63] hover:text-[#171713] text-xs font-semibold border border-[#EAE8E1] flex items-center gap-1.5 transition shadow-2xs"
            title="Perform pre-export ATS safety check and review diagnostics"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#4F5D2F]" />
            <span>Pre-Export Check</span>
          </button>

          <button
            onClick={handleExportPlainText}
            className="px-3 py-1.5 rounded-lg bg-[#FAF9F5] hover:bg-white text-[#6E6E63] hover:text-[#171713] text-xs font-semibold border border-[#EAE8E1] flex items-center gap-1.5 transition shadow-2xs"
            title="Download plain text stream"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plain Text</span>
          </button>
        </div>
      </div>

      {/* Pre-Export Quality & ATS Safety Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#EAE8E1] max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EAE8E1] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#4F5D2F]" />
                <h3 className="text-base font-bold text-[#171713]">Pre-Export Readiness Check</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-[#6E6E63] hover:text-[#171713] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validatingExport ? (
              <div className="py-12 text-center text-xs text-[#6E6E63]">
                Validating layout structure, contact identity, and ATS scanner safety...
              </div>
            ) : exportValidation ? (
              <div className="space-y-4">
                {/* Score badge */}
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#6E6E63] font-medium">ATS Export Readiness Score</div>
                    <div className="text-2xl font-black text-[#4F5D2F] mt-0.5">
                      {exportValidation.atsScore}%
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      exportValidation.isValid
                        ? 'bg-[#4F5D2F]/10 text-[#4F5D2F] border-[#4F5D2F]/30'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {exportValidation.isValid ? 'READY FOR EXPORT' : 'BLOCKERS DETECTED'}
                  </span>
                </div>

                {/* Validation Checks */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase text-[#6E6E63] tracking-wider">
                    Diagnostic Checks
                  </div>
                  {exportValidation.checks?.map((chk: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-start justify-between text-xs gap-3"
                    >
                      <div className="flex items-start gap-2">
                        {chk.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-[#4F5D2F] mt-0.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#C49A3A] mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-[#171713]">{chk.name}</div>
                          <div className="text-[#6E6E63] text-[11px] mt-0.5">{chk.details}</div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          chk.passed
                            ? 'bg-[#4F5D2F]/10 text-[#4F5D2F]'
                            : 'bg-[#C49A3A]/15 text-[#8E6D24]'
                        }`}
                      >
                        {chk.passed ? 'PASS' : 'WARN'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Blockers & Warnings */}
                {exportValidation.blockers?.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Critical Export Blockers:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {exportValidation.blockers.map((b: string, i: number) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {exportValidation.warnings?.length > 0 && (
                  <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#C49A3A]/40 text-xs text-[#8E6D24] space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-[#C49A3A]" />
                      Advisory Warnings:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {exportValidation.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Download Actions inside Modal */}
                <div className="pt-2 border-t border-[#EAE8E1] flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => {
                      handleExportPdf();
                      setShowExportModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExportDocx();
                      setShowExportModal(false);
                    }}
                    disabled={exportingDocx}
                    className="px-4 py-2 rounded-lg bg-white hover:bg-[#FAF9F5] text-[#171713] text-xs font-semibold border border-[#D5D2C7] flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0284c7]" />
                    <span>Download DOCX</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExportPlainText();
                      setShowExportModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#FAF9F5] hover:bg-[#EAE8E1] text-[#6E6E63] hover:text-[#171713] text-xs font-semibold border border-[#EAE8E1] flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Plain Text</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Two-Pane Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Editor Pane (6 cols) */}
        <div className="lg:col-span-6 space-y-4 max-h-[85vh] overflow-y-auto pr-2">
          {/* Section 1: Personal Info */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() => toggleSection('contact')}
            >
              <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                Contact & Identity Details
              </h3>
              {collapsedSections.contact ? (
                <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
              )}
            </div>

            {!collapsedSections.contact && (
              <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
                <div>
                  <label className="text-[11px] text-[#6E6E63] font-medium">Full Name</label>
                  <input
                    type="text"
                    value={formData.personal_info.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal_info: { ...formData.personal_info, name: e.target.value },
                      })
                    }
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#6E6E63] font-medium">Email Address</label>
                  <input
                    type="email"
                    value={formData.personal_info.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal_info: { ...formData.personal_info, email: e.target.value },
                      })
                    }
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#6E6E63] font-medium">Phone</label>
                  <input
                    type="text"
                    value={formData.personal_info.phone || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal_info: { ...formData.personal_info, phone: e.target.value },
                      })
                    }
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#6E6E63] font-medium">Location (City, State)</label>
                  <input
                    type="text"
                    value={formData.personal_info.location || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personal_info: { ...formData.personal_info, location: e.target.value },
                      })
                    }
                    className="w-full mt-0.5 px-2.5 py-1.5 bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Professional Summary */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleSection('summary')}
              >
                <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                  Professional Summary
                </h3>
                {collapsedSections.summary ? (
                  <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
                )}
              </div>
              <button
                onClick={handleTriggerOptimizeSummary}
                disabled={optimizingSummary}
                className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-[#F3EEDF] text-[#8E6D24] text-[11px] font-semibold border border-[#C49A3A]/30 flex items-center gap-1 transition shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-[#C49A3A]" />
                <span>{optimizingSummary ? 'Optimizing...' : 'AI Refine'}</span>
              </button>
            </div>
            {!collapsedSections.summary && (
              <textarea
                rows={4}
                value={formData.summary || ''}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="w-full px-2.5 py-2 text-xs bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F] leading-relaxed mt-2"
              />
            )}
          </div>

          {/* Section 3: Work Experience */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleSection('experience')}
              >
                <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                  Work Experience ({formData.experience.length})
                </h3>
                {collapsedSections.experience ? (
                  <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
                )}
              </div>
              <button
                onClick={handleAddExperience}
                className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-white text-[#171713] text-[11px] font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-[#4F5D2F]" />
                <span>Add Position</span>
              </button>
            </div>

            {!collapsedSections.experience && (
              <div className="space-y-4">
                {formData.experience.map((exp, expIdx) => (
                  <div key={exp.id} className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-[#6E6E63] font-medium">Role Title</label>
                        <input
                          type="text"
                          value={exp.role}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.experience[expIdx].role = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#6E6E63] font-medium">Company</label>
                        <input
                          type="text"
                          value={exp.company}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.experience[expIdx].company = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#6E6E63] font-medium">Dates</label>
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
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                    </div>

                    {/* Bullet points list */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-center text-[11px] text-[#6E6E63]">
                        <span>Accomplishment Bullets</span>
                        <button
                          onClick={() => handleAddBullet(expIdx)}
                          className="text-[#4F5D2F] hover:underline font-semibold flex items-center gap-0.5"
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
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                          />
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              title="Optimize bullet with ResumeTruth Verification"
                              onClick={() => handleTriggerOptimizeBullet(expIdx, bIdx)}
                              className="p-1 rounded bg-[#FAF9F5] hover:bg-[#F3EEDF] text-[#8E6D24] border border-[#C49A3A]/30 transition"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#C49A3A]" />
                            </button>
                            {exp.bullets.length > 1 && (
                              <button
                                onClick={() => handleRemoveBullet(expIdx, bIdx)}
                                className="p-1 rounded text-[#6E6E63] hover:text-rose-600 hover:bg-rose-50 transition"
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
            )}
          </div>
        </div>

        {/* Right Live Preview Pane (6 cols) */}
        <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-[#EAE8E1] shadow-xs sticky top-20 max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#EAE8E1]">
            <div className="flex items-center gap-1.5 text-xs text-[#171713] font-semibold">
              <Eye className="w-3.5 h-3.5 text-[#4F5D2F]" />
              <span>Live Render Canvas ({currentTemplate.name})</span>
            </div>
            {/* Real-time page budget indicator */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-[#6E6E63]">Page Capacity:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full ${
                  pageCapacity <= 95
                    ? 'bg-[#4F5D2F]/10 text-[#4F5D2F]'
                    : 'bg-[#C49A3A]/15 text-[#8E6D24]'
                }`}
              >
                Page 1 • {pageCapacity}%
              </span>
            </div>
          </div>

          <div className="border border-[#EAE8E1] rounded shadow-xs overflow-hidden">
            <ResumeRenderer
              data={formData}
              template={currentTemplate}
              containerRef={printContainerRef}
            />
          </div>
        </div>
      </div>

      {/* ResumeTruth Anti-Hallucination Confirmation Modal */}
      {activeSuggestion && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#EAE8E1] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#EAE8E1] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713]">Controlled AI Optimization</h3>
              </div>
              <button
                onClick={() => setActiveSuggestion(null)}
                className="text-[#6E6E63] hover:text-[#171713]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ResumeTruth Verdict Banner */}
            <div
              className={`p-3 rounded-lg text-xs border ${
                activeSuggestion.truthCheckVerdict === 'PASS'
                  ? 'bg-[#4F5D2F]/10 text-[#4F5D2F] border-[#4F5D2F]/30'
                  : 'bg-[#FAF9F5] text-[#8E6D24] border-[#C49A3A]/40'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                ResumeTruth Anti-Hallucination Status:{' '}
                {activeSuggestion.truthCheckVerdict === 'PASS'
                  ? 'VERIFIED COMPLIANT'
                  : 'CANDIDATE CONFIRMATION REQUIRED'}
              </div>
              <div className="text-[11px] mt-1 opacity-90">{activeSuggestion.reason}</div>
            </div>

            {/* Before vs After */}
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-bold text-[#6E6E63] text-[11px]">Original Text:</span>
                <div className="p-2.5 rounded bg-[#FAF9F5] text-[#6E6E63] border border-[#EAE8E1] line-through">
                  {activeSuggestion.before}
                </div>
              </div>

              <div>
                <span className="font-bold text-[#4F5D2F] text-[11px]">Proposed Optimization:</span>
                <div className="p-2.5 rounded bg-white text-[#171713] border border-[#4F5D2F]/40 font-medium">
                  {activeSuggestion.after}
                </div>
              </div>
            </div>

            {/* If unverified claims exist, prompt candidate */}
            {activeSuggestion.truthQuestion && (
              <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#C49A3A]/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#8E6D24] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Verification Prompt:</span>
                </div>
                <p className="text-[#6E6E63]">{activeSuggestion.truthQuestion}</p>
                <label className="flex items-center gap-2 text-[#171713] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={userTruthConfirmed}
                    onChange={(e) => setUserTruthConfirmed(e.target.checked)}
                    className="rounded text-[#4F5D2F] focus:ring-[#4F5D2F]"
                  />
                  <span className="text-[11px] font-medium">
                    I verify that this metric or tool accurately reflects my true experience.
                  </span>
                </label>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE8E1]">
              <button
                onClick={() => setActiveSuggestion(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#6E6E63] hover:text-[#171713]"
              >
                Reject
              </button>
              <button
                onClick={handleApplySuggestion}
                disabled={activeSuggestion.truthCheckVerdict !== 'PASS' && !userTruthConfirmed}
                className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
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
