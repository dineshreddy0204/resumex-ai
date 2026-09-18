import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { ResumeDocument, TemplateDefinition, OptimizationSuggestion, ResumeData, TargetFieldIdentifier } from '../../types';
import { ResumeRenderer } from '../ResumeRenderer';
import { api } from '../../services/api';
import { MASTER_TEMPLATES, getFullTemplateCatalog } from '../../constants/templates';
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

  // Sync internal state whenever active resume updates (e.g., following PDF upload or refresh)
  useEffect(() => {
    if (resume && resume.data) {
      setFormData(JSON.parse(JSON.stringify(resume.data)));
      setResumeTitle(resume.title || 'Untitled Resume');
      setSelectedTemplateId(resume.templateId || 'ats-classic');
    }
  }, [resume?.id, resume?.updatedAt, JSON.stringify(resume?.data)]);

  // Accordion collapsed state for sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    contact: false,
    summary: false,
    experience: false,
    skills: false,
    education: false,
    projects: false,
    certifications: false,
    achievements: false,
  });

  // AI Optimization modal state
  const [optimizingBullet, setOptimizingBullet] = useState<{ expIdx: number; bulletIdx: number } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<OptimizationSuggestion | null>(null);
  const [userTruthConfirmed, setUserTruthConfirmed] = useState(false);
  const [optimizingSummary, setOptimizingSummary] = useState(false);

  const printContainerRef = useRef<HTMLDivElement>(null);

  const allTemplates = useMemo(() => {
    return templates && templates.length > 0 ? templates : getFullTemplateCatalog();
  }, [templates]);

  const currentTemplate =
    allTemplates.find((t) => t.id === selectedTemplateId) ||
    MASTER_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
    MASTER_TEMPLATES[0];

  const templateCategories = useMemo(() => {
    const cats: Record<string, TemplateDefinition[]> = {};
    for (const tmpl of allTemplates) {
      if (!cats[tmpl.category]) cats[tmpl.category] = [];
      cats[tmpl.category].push(tmpl);
    }
    return cats;
  }, [allTemplates]);

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
    const exp = formData.experience[expIdx];
    const bullet = exp.bullets[bulletIdx];
    const role = exp.role;
    const company = exp.company;
    const entityId = exp.id;

    setOptimizingBullet({ expIdx, bulletIdx });
    setUserTruthConfirmed(false);

    try {
      const res = await api.optimizeBullet(resume.id, bullet, role, company, entityId, bulletIdx);
      const suggestion: OptimizationSuggestion = {
        ...res.suggestion,
        target: {
          section: 'experience',
          id: entityId,
          bulletIdx,
          expIdx,
        },
        originalText: bullet,
        proposedText: res.suggestion.proposedText || res.suggestion.after,
      };
      setActiveSuggestion(suggestion);
    } catch (err: any) {
      setToastMessage(err.message || 'Optimization request failed.');
      setTimeout(() => setToastMessage(null), 3000);
      setOptimizingBullet(null);
    }
  };

  const handleTriggerOptimizeProjectBullet = async (projIdx: number, bulletIdx: number) => {
    const proj = formData.projects[projIdx];
    const bullet = proj.bullets[bulletIdx];

    setOptimizingBullet(null);
    setUserTruthConfirmed(false);

    try {
      const res = await api.optimizeProjectBullet(
        resume.id,
        bullet,
        proj.title,
        proj.technologies,
        proj.id,
        bulletIdx
      );
      const suggestion: OptimizationSuggestion = {
        ...res.suggestion,
        target: {
          section: 'projects',
          id: proj.id,
          bulletIdx,
          projIdx,
        },
        originalText: bullet,
        proposedText: res.suggestion.proposedText || res.suggestion.after,
      };
      setActiveSuggestion(suggestion);
    } catch (err: any) {
      setToastMessage(err.message || 'Project optimization request failed.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleApplySuggestion = async () => {
    if (!activeSuggestion) return;

    // Check if blocked by ResumeTruth verification
    if (activeSuggestion.truthStatus === 'BLOCKED') {
      setToastMessage('Cannot apply optimization: proposal contains unverified claims that violate ResumeTruth rules.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    if (activeSuggestion.requires_user_confirmation && !userTruthConfirmed) {
      setToastMessage('Please confirm candidate accuracy before applying this change.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const proposedValue = activeSuggestion.after || activeSuggestion.proposedText;
    if (!proposedValue) return;

    const updatedFormData: ResumeData = JSON.parse(JSON.stringify(formData));
    let appliedSection = 'General';
    let appliedDetail = '';

    const target =
      typeof activeSuggestion.target === 'object' && activeSuggestion.target !== null
        ? (activeSuggestion.target as TargetFieldIdentifier)
        : null;
    const targetSection = target?.section || activeSuggestion.section;

    if (targetSection === 'summary') {
      updatedFormData.summary = proposedValue;
      appliedSection = 'Professional Summary';
      appliedDetail = `Updated executive summary: "${proposedValue.substring(0, 80)}..."`;
    } else if (targetSection === 'projects') {
      const projIdx =
        target?.projIdx !== undefined
          ? target.projIdx
          : target?.id
          ? updatedFormData.projects?.findIndex((p) => p.id === target.id)
          : -1;
      const bIdx = target?.bulletIdx ?? 0;

      if (projIdx !== undefined && projIdx >= 0 && updatedFormData.projects?.[projIdx]?.bullets) {
        updatedFormData.projects[projIdx].bullets[bIdx] = proposedValue;
        const pTitle = updatedFormData.projects[projIdx].title || 'Project';
        appliedSection = `Projects (${pTitle})`;
        appliedDetail = `Optimized project bullet ${bIdx + 1}: "${proposedValue.substring(0, 75)}..."`;
      }
    } else {
      // Experience section
      const expIdx =
        target?.expIdx !== undefined
          ? target.expIdx
          : optimizingBullet?.expIdx !== undefined
          ? optimizingBullet.expIdx
          : target?.id
          ? updatedFormData.experience?.findIndex((e) => e.id === target.id)
          : 0;
      const bIdx = target?.bulletIdx ?? optimizingBullet?.bulletIdx ?? 0;

      if (expIdx !== undefined && expIdx >= 0 && updatedFormData.experience?.[expIdx]?.bullets) {
        updatedFormData.experience[expIdx].bullets[bIdx] = proposedValue;
        const role = updatedFormData.experience[expIdx].role || updatedFormData.experience[expIdx].company || 'Experience';
        appliedSection = `Experience (${role})`;
        appliedDetail = `Optimized accomplishment bullet ${bIdx + 1}: "${proposedValue.substring(0, 75)}..."`;
      }
    }

    // 1. Immediately update local state so Live Builder preview reflects changes
    setFormData(updatedFormData);
    setActiveSuggestion(null);
    setOptimizingBullet(null);
    setUserTruthConfirmed(false);

    // 2. Persist to database via onUpdateResume
    try {
      setSaving(true);
      await onUpdateResume(updatedFormData, resumeTitle, selectedTemplateId);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);

      // 3. Dispatch secondary non-blocking email notification
      try {
        const notifRes = await api.sendOptimizationNotification({
          resumeTitle: resumeTitle || resume.title || 'Resume',
          section: appliedSection,
          detail: appliedDetail,
        });

        if (notifRes.code === 'EMAIL_SENT' || (notifRes.success && !notifRes.skipped)) {
          setToastMessage('Optimization applied to resume. Email notification sent.');
        } else if (notifRes.code === 'NOTIFICATION_SKIPPED') {
          setToastMessage('Optimization applied to resume.');
        } else if (notifRes.code === 'EMAIL_NOT_CONFIGURED') {
          setToastMessage('Resume updated. (Email notifications not configured)');
        } else {
          setToastMessage('Resume updated, but email notification could not be sent.');
        }
      } catch {
        setToastMessage('Resume updated, but email notification could not be sent.');
      }
      setTimeout(() => setToastMessage(null), 3500);
    } catch (saveErr: any) {
      setToastMessage(`Failed to save optimization: ${saveErr.message || 'Database error'}`);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // --- AI Summary Optimization ---
  const handleTriggerOptimizeSummary = async () => {
    setOptimizingSummary(true);
    setUserTruthConfirmed(false);
    try {
      const topRole = formData.experience?.[0]?.role || '';
      const currentText = formData.summary || '';
      const res = await api.optimizeSummary(
        resume.id,
        currentText,
        topRole
      );
      const original = currentText.trim();
      const suggestion: OptimizationSuggestion = {
        ...res.suggestion,
        target: {
          section: 'summary',
        },
        originalText: original || '(No existing summary)',
        proposedText: res.suggestion.proposedText || res.suggestion.after,
      };
      setActiveSuggestion(suggestion);
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

    doc.save(`${(formData.personal_info?.name || resumeTitle || 'Resume').replace(/\s+/g, '_')}_ResumeX.pdf`);
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
      a.download = `${(formData.personal_info?.name || resumeTitle || 'Resume').replace(/\s+/g, '_')}_ResumeX.docx`;
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
    a.download = `${(resumeTitle || 'Resume').replace(/\s+/g, '_')}.txt`;
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

  // Education handlers
  const handleAddEducation = () => {
    setFormData({
      ...formData,
      education: [
        {
          id: `edu-${Date.now()}`,
          degree: 'Degree / Program',
          institution: 'Institution / University',
          fieldOfStudy: 'Field of Study',
          startDate: '2020',
          endDate: '2024',
        },
        ...(formData.education || []),
      ],
    });
  };

  const handleRemoveEducation = (eduIdx: number) => {
    const updated = { ...formData };
    updated.education = (updated.education || []).filter((_, idx) => idx !== eduIdx);
    setFormData(updated);
  };

  // Skills handlers
  const handleAddSkillCategory = () => {
    setFormData({
      ...formData,
      skills: [
        ...(formData.skills || []),
        {
          category: 'Technical Skills',
          items: ['Skill 1', 'Skill 2'],
        },
      ],
    });
  };

  const handleRemoveSkillCategory = (catIdx: number) => {
    const updated = { ...formData };
    updated.skills = (updated.skills || []).filter((_, idx) => idx !== catIdx);
    setFormData(updated);
  };

  const handleAddSkillItem = (catIdx: number, itemText: string) => {
    const clean = itemText.trim();
    if (!clean) return;
    const updated = { ...formData };
    if (!updated.skills[catIdx].items.includes(clean)) {
      updated.skills[catIdx].items.push(clean);
      setFormData(updated);
    }
  };

  const handleRemoveSkillItem = (catIdx: number, itemIdx: number) => {
    const updated = { ...formData };
    updated.skills[catIdx].items.splice(itemIdx, 1);
    setFormData(updated);
  };

  // Projects handlers
  const handleAddProject = () => {
    setFormData({
      ...formData,
      projects: [
        {
          id: `proj-${Date.now()}`,
          title: 'Project Name',
          link: '',
          technologies: ['TypeScript', 'React'],
          bullets: ['Engineered resilient architecture that streamlined critical workflows.'],
        },
        ...(formData.projects || []),
      ],
    });
  };

  const handleRemoveProject = (projIdx: number) => {
    const updated = { ...formData };
    updated.projects = (updated.projects || []).filter((_, idx) => idx !== projIdx);
    setFormData(updated);
  };

  const handleAddProjectBullet = (projIdx: number) => {
    const updated = { ...formData };
    if (!updated.projects[projIdx].bullets) updated.projects[projIdx].bullets = [];
    updated.projects[projIdx].bullets.push('Spearheaded key project capability with observable metrics.');
    setFormData(updated);
  };

  const handleRemoveProjectBullet = (projIdx: number, bulletIdx: number) => {
    const updated = { ...formData };
    updated.projects[projIdx].bullets.splice(bulletIdx, 1);
    setFormData(updated);
  };

  // Certifications handlers
  const handleAddCertification = () => {
    setFormData({
      ...formData,
      certifications: [
        {
          id: `cert-${Date.now()}`,
          name: 'Certificate Name',
          issuer: 'Certifying Body',
          date: new Date().getFullYear().toString(),
        },
        ...(formData.certifications || []),
      ],
    });
  };

  const handleRemoveCertification = (certIdx: number) => {
    const updated = { ...formData };
    updated.certifications = (updated.certifications || []).filter((_, idx) => idx !== certIdx);
    setFormData(updated);
  };

  // Approximate content density / page budget calculation
  const totalBullets = (formData.experience || []).reduce((acc, e) => acc + (e.bullets?.length || 0), 0);
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
              {Object.entries(templateCategories).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {(items as TemplateDefinition[]).map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </optgroup>
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
                  Work Experience ({(formData.experience || []).length})
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
                {(formData.experience || []).map((exp, expIdx) => (
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

                      {(exp.bullets || []).map((bullet, bIdx) => (
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
                            {(exp.bullets || []).length > 1 && (
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

          {/* Section 4: Skills & Competencies */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleSection('skills')}
              >
                <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                  Skills & Technical Domains ({(formData.skills || []).length} categories)
                </h3>
                {collapsedSections.skills ? (
                  <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
                )}
              </div>
              <button
                onClick={handleAddSkillCategory}
                className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-white text-[#171713] text-[11px] font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-[#4F5D2F]" />
                <span>Add Category</span>
              </button>
            </div>

            {!collapsedSections.skills && (
              <div className="space-y-3">
                {(formData.skills || []).map((cat, catIdx) => (
                  <div key={catIdx} className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={cat.category}
                        onChange={(e) => {
                          const updated = { ...formData };
                          updated.skills[catIdx].category = e.target.value;
                          setFormData(updated);
                        }}
                        placeholder="Category Name (e.g. Languages & Frameworks)"
                        className="font-semibold text-xs text-[#171713] bg-white border border-[#D5D2C7] rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                      />
                      <button
                        onClick={() => handleRemoveSkillCategory(catIdx)}
                        className="p-1 rounded text-[#6E6E63] hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Skill tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(cat.items || []).map((item, itemIdx) => (
                        <span
                          key={itemIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#D5D2C7] text-xs text-[#171713]"
                        >
                          <span>{item}</span>
                          <button
                            onClick={() => handleRemoveSkillItem(catIdx, itemIdx)}
                            className="text-[#6E6E63] hover:text-rose-600 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add skill input */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="Add skill (press Enter or comma)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const val = (e.currentTarget.value || '').trim();
                            if (val) {
                              handleAddSkillItem(catIdx, val);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                        className="text-xs bg-white border border-[#D5D2C7] rounded px-2 py-1 text-[#171713] w-56 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                      />
                      <span className="text-[10px] text-[#6E6E63]">Type and press Enter</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Education */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleSection('education')}
              >
                <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                  Education ({(formData.education || []).length})
                </h3>
                {collapsedSections.education ? (
                  <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
                )}
              </div>
              <button
                onClick={handleAddEducation}
                className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-white text-[#171713] text-[11px] font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-[#4F5D2F]" />
                <span>Add Education</span>
              </button>
            </div>

            {!collapsedSections.education && (
              <div className="space-y-3">
                {(formData.education || []).map((edu, eduIdx) => (
                  <div key={edu.id} className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-[#6E6E63] font-medium">Degree / Program</label>
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.education[eduIdx].degree = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-[#6E6E63] font-medium">Institution / University</label>
                          <button
                            onClick={() => handleRemoveEducation(eduIdx)}
                            className="text-[#6E6E63] hover:text-rose-600 transition p-0.5"
                            title="Remove Education"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.education[eduIdx].institution = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#6E6E63] font-medium">Field of Study</label>
                        <input
                          type="text"
                          value={edu.fieldOfStudy || ''}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.education[eduIdx].fieldOfStudy = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#6E6E63] font-medium">GPA / Honors</label>
                        <input
                          type="text"
                          value={edu.gpa || ''}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.education[eduIdx].gpa = e.target.value;
                            setFormData(updated);
                          }}
                          placeholder="e.g. 3.8/4.0"
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-[#6E6E63] font-medium">Dates (Start - End)</label>
                        <input
                          type="text"
                          value={`${edu.startDate || ''} - ${edu.endDate || ''}`}
                          onChange={(e) => {
                            const updated = { ...formData };
                            const [s, end] = e.target.value.split('-');
                            updated.education[eduIdx].startDate = s?.trim() || edu.startDate;
                            updated.education[eduIdx].endDate = end?.trim() || edu.endDate;
                            setFormData(updated);
                          }}
                          placeholder="2018 - 2022"
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6: Projects */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleSection('projects')}
              >
                <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                  Technical Projects ({(formData.projects || []).length})
                </h3>
                {collapsedSections.projects ? (
                  <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
                )}
              </div>
              <button
                onClick={handleAddProject}
                className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-white text-[#171713] text-[11px] font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-[#4F5D2F]" />
                <span>Add Project</span>
              </button>
            </div>

            {!collapsedSections.projects && (
              <div className="space-y-3">
                {(formData.projects || []).map((proj, projIdx) => (
                  <div key={proj.id} className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-[#6E6E63] font-medium">Project Name</label>
                        <input
                          type="text"
                          value={proj.title}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.projects[projIdx].title = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-[#6E6E63] font-medium">Link / URL</label>
                          <button
                            onClick={() => handleRemoveProject(projIdx)}
                            className="text-[#6E6E63] hover:text-rose-600 transition p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={proj.link || ''}
                          onChange={(e) => {
                            const updated = { ...formData };
                            updated.projects[projIdx].link = e.target.value;
                            setFormData(updated);
                          }}
                          placeholder="https://..."
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                    </div>

                    {/* Bullets */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-center text-[11px] text-[#6E6E63]">
                        <span>Project Bullets</span>
                        <button
                          onClick={() => handleAddProjectBullet(projIdx)}
                          className="text-[#4F5D2F] hover:underline font-semibold flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> Add bullet
                        </button>
                      </div>
                      {(proj.bullets || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2">
                          <textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => {
                              const updated = { ...formData };
                              updated.projects[projIdx].bullets[bIdx] = e.target.value;
                              setFormData(updated);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                          />
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              title="Optimize project bullet with ResumeTruth Verification"
                              onClick={() => handleTriggerOptimizeProjectBullet(projIdx, bIdx)}
                              className="p-1 rounded bg-[#FAF9F5] hover:bg-[#F3EEDF] text-[#8E6D24] border border-[#C49A3A]/30 transition"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#C49A3A]" />
                            </button>
                            {(proj.bullets || []).length > 1 && (
                              <button
                                onClick={() => handleRemoveProjectBullet(projIdx, bIdx)}
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

          {/* Section 7: Certifications */}
          <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toggleSection('certifications')}
              >
                <h3 className="text-xs font-bold text-[#171713] uppercase tracking-wider">
                  Certifications ({(formData.certifications || []).length})
                </h3>
                {collapsedSections.certifications ? (
                  <ChevronDown className="w-4 h-4 text-[#6E6E63]" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-[#6E6E63]" />
                )}
              </div>
              <button
                onClick={handleAddCertification}
                className="px-2.5 py-1 rounded bg-[#FAF9F5] hover:bg-white text-[#171713] text-[11px] font-semibold border border-[#D5D2C7] flex items-center gap-1 transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-[#4F5D2F]" />
                <span>Add Certificate</span>
              </button>
            </div>

            {!collapsedSections.certifications && (
              <div className="space-y-3">
                {(formData.certifications || []).map((cert, cIdx) => (
                  <div key={cert.id} className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-[#6E6E63] font-medium">Name</label>
                        <input
                          type="text"
                          value={cert.name}
                          onChange={(e) => {
                            const updated = { ...formData };
                            if (!updated.certifications) updated.certifications = [];
                            updated.certifications[cIdx].name = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#6E6E63] font-medium">Issuer</label>
                        <input
                          type="text"
                          value={cert.issuer}
                          onChange={(e) => {
                            const updated = { ...formData };
                            if (!updated.certifications) updated.certifications = [];
                            updated.certifications[cIdx].issuer = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-[#6E6E63] font-medium">Date</label>
                          <button
                            onClick={() => handleRemoveCertification(cIdx)}
                            className="text-[#6E6E63] hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={cert.date}
                          onChange={(e) => {
                            const updated = { ...formData };
                            if (!updated.certifications) updated.certifications = [];
                            updated.certifications[cIdx].date = e.target.value;
                            setFormData(updated);
                          }}
                          className="w-full mt-0.5 px-2 py-1 bg-white border border-[#D5D2C7] rounded text-[#171713] text-xs focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
                        />
                      </div>
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
              className={`p-3.5 rounded-xl text-xs border ${
                activeSuggestion.truthStatus === 'BLOCKED'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : activeSuggestion.truthStatus === 'PASS' || activeSuggestion.truthCheckVerdict === 'PASS'
                  ? 'bg-[#4F5D2F]/10 text-[#4F5D2F] border-[#4F5D2F]/30'
                  : 'bg-[#FAF9F5] text-[#8E6D24] border-[#C49A3A]/40'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-xs">
                {activeSuggestion.truthStatus === 'BLOCKED' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                ResumeTruth Verification:{' '}
                {activeSuggestion.truthStatus === 'BLOCKED'
                  ? 'PROPOSAL BLOCKED (Fabrication Detected)'
                  : activeSuggestion.truthStatus === 'PASS' || activeSuggestion.truthCheckVerdict === 'PASS'
                  ? 'VERIFIED COMPLIANT (Zero-Fabrication)'
                  : 'CANDIDATE CONFIRMATION REQUIRED'}
              </div>
              <div className="text-[11px] mt-1.5 opacity-90 leading-relaxed">
                {activeSuggestion.violationsExplanation || activeSuggestion.reason}
              </div>
            </div>

            {/* Flagged Violations Breakdown */}
            {activeSuggestion.truthViolations && activeSuggestion.truthViolations.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs space-y-1.5">
                <div className="font-semibold text-amber-900 text-[11px] uppercase tracking-wider">
                  Verification Items:
                </div>
                {activeSuggestion.truthViolations.map((v, i) => (
                  <div key={i} className="text-amber-800 text-[11px] flex items-start gap-1.5">
                    <span className="font-mono font-bold shrink-0 bg-amber-200/80 px-1 py-0.5 rounded text-[10px]">
                      [{v.type.replace('_', ' ').toUpperCase()}]
                    </span>
                    <span>{v.message || v.reason || v.claim}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Before vs After */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-[#6E6E63] text-[11px] block mb-1">Original Text:</span>
                <div className="p-2.5 rounded-lg bg-[#FAF9F5] text-[#6E6E63] border border-[#EAE8E1]">
                  {(() => {
                    const orig = (activeSuggestion.originalText ?? activeSuggestion.before ?? '').trim();
                    if (!orig || orig === 'No existing content' || orig === '(No existing summary)') {
                      return (
                        <span className="italic text-[#9E9E90]">
                          (No existing content in this section — verified optimization will be inserted)
                        </span>
                      );
                    }
                    return <span className="line-through">{orig}</span>;
                  })()}
                </div>
              </div>

              <div>
                <span className="font-bold text-[#4F5D2F] text-[11px] block mb-1">Proposed Optimization:</span>
                <div className="p-2.5 rounded-lg bg-white text-[#171713] border border-[#4F5D2F]/40 font-medium leading-relaxed">
                  {activeSuggestion.proposedText || activeSuggestion.after}
                </div>
              </div>
            </div>

            {/* If unverified claims exist, prompt candidate */}
            {(activeSuggestion.truthQuestion || (activeSuggestion.truthViolations && activeSuggestion.truthViolations.length > 0)) && (
              <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#C49A3A]/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-[#8E6D24] font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Candidate Verification Required:</span>
                </div>
                <p className="text-[#6E6E63] leading-relaxed">
                  {activeSuggestion.truthQuestion || 'Please verify that the proposed phrasing accurately reflects your verifiable skills and background.'}
                </p>
                <label className="flex items-start gap-2 text-[#171713] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={userTruthConfirmed}
                    onChange={(e) => setUserTruthConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-[#4F5D2F] focus:ring-[#4F5D2F]"
                  />
                  <span className="text-[11px] font-medium leading-snug">
                    I verify that this information accurately represents my true experience and qualifications.
                  </span>
                </label>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE8E1]">
              <button
                onClick={() => {
                  setActiveSuggestion(null);
                  setUserTruthConfirmed(false);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs text-[#6E6E63] hover:text-[#171713] transition font-medium"
              >
                Reject
              </button>
              <button
                onClick={handleApplySuggestion}
                disabled={
                  activeSuggestion.truthStatus === 'BLOCKED' ||
                  (activeSuggestion.truthStatus === 'REQUIRES_CONFIRMATION' && !userTruthConfirmed) ||
                  (activeSuggestion.requires_user_confirmation && !userTruthConfirmed)
                }
                className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
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
