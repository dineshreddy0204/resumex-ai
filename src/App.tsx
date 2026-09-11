import React, { useState, useEffect } from 'react';
import type {
  User,
  UserProfile,
  ResumeDocument,
  ResumeData,
  AnalysisIssue,
  AtsSimulationResult,
  TemplateDefinition,
} from './types';
import { api } from './services/api';
import { Navbar, type NavTab } from './components/Navbar';
import { DashboardView } from './components/views/DashboardView';
import { AtsLabView } from './components/views/AtsLabView';
import { JobMatchingView } from './components/views/JobMatchingView';
import { CareerGapView } from './components/views/CareerGapView';
import { LiveBuilderView } from './components/views/LiveBuilderView';
import { VersionComparisonView } from './components/views/VersionComparisonView';
import { TemplateGalleryView } from './components/views/TemplateGalleryView';
import { NlpEvaluationView } from './components/views/NlpEvaluationView';
import { Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeDocument | null>(null);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [issues, setIssues] = useState<AnalysisIssue[]>([]);
  const [atsResult, setAtsResult] = useState<AtsSimulationResult | null>(null);
  const [geminiActive, setGeminiActive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      // 1. Health check
      const health = await api.checkHealth().catch(() => ({ status: 'ok', geminiEnabled: false }));
      setGeminiActive(health.geminiEnabled);

      // 2. Auth: Check if token exists, otherwise perform demo login
      let currentUser: User | null = null;
      if (api.getToken()) {
        try {
          const me = await api.getMe();
          setUser(me.user);
          setProfile(me.profile);
          currentUser = me.user;
        } catch {
          // Token invalid, do demo login
          const demo = await api.demoLogin();
          setUser(demo.user);
          setProfile(demo.profile);
          currentUser = demo.user;
        }
      } else {
        const demo = await api.demoLogin();
        setUser(demo.user);
        setProfile(demo.profile);
        currentUser = demo.user;
      }

      // 3. Load Templates
      const tmplRes = await api.getTemplates().catch(() => ({ count: 0, templates: [] }));
      setTemplates(tmplRes.templates);

      // 4. Load Resumes
      if (currentUser) {
        await refreshResumes();
      }
    } catch (err: any) {
      console.error('App init error:', err);
      setErrorNotice('Failed to initialize session. Reconnecting...');
    } finally {
      setLoading(false);
    }
  };

  const refreshResumes = async () => {
    try {
      const list = await api.getResumes();
      setResumes(list);
      if (list.length > 0) {
        // If current active resume is in the list, keep it; otherwise set first
        const currentId = activeResume?.id;
        const found = currentId ? list.find((r) => r.id === currentId) : null;
        const target = found || list[0];
        setActiveResume(target);
        await loadResumeAnalysis(target.id);
      } else {
        setActiveResume(null);
        setIssues([]);
        setAtsResult(null);
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
    }
  };

  const loadResumeAnalysis = async (resumeId: string) => {
    try {
      const details = await api.getResume(resumeId);
      setIssues(details.issues);
      // Run analysis to refresh ATS scores
      const ana = await api.analyzeResume(resumeId);
      setAtsResult(ana.ats);
    } catch (err) {
      console.error('Failed to load resume analysis:', err);
    }
  };

  const handleSelectResume = async (res: ResumeDocument) => {
    setActiveResume(res);
    await loadResumeAnalysis(res.id);
  };

  const handleUploadResume = async (payload: {
    fileBase64?: string;
    fileName?: string;
    mimeType?: string;
    rawText?: string;
  }) => {
    setLoading(true);
    try {
      const res = await api.uploadResume(payload);
      await refreshResumes();
      setActiveResume(res.resume);
      setIssues(res.issues);
      setAtsResult(res.atsAnalysis);
      setActiveTab('ats-lab');
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateResume = async (data: ResumeData, title?: string, templateId?: string) => {
    if (!activeResume) return;
    try {
      const res = await api.updateResume(activeResume.id, data, title, templateId);
      setActiveResume(res.resume);
      // Update in list
      setResumes(resumes.map((r) => (r.id === res.resume.id ? res.resume : r)));
      await loadResumeAnalysis(res.resume.id);
    } catch (err: any) {
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteResume = async (id: string) => {
    try {
      await api.deleteResume(id);
      await refreshResumes();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleIssueAction = async (issueId: string, action: 'accepted' | 'rejected') => {
    if (!activeResume) return;
    try {
      const res = await api.updateIssueStatus(activeResume.id, issueId, action);
      setIssues(issues.map((i) => (i.id === issueId ? res.issue : i)));
    } catch (err: any) {
      alert(`Failed to update issue: ${err.message}`);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    if (!activeResume) return;
    await handleUpdateResume(activeResume.data, activeResume.title, templateId);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setProfile(null);
    setResumes([]);
    setActiveResume(null);
  };

  const handleSwitchDemo = async () => {
    setLoading(true);
    try {
      const demo = await api.demoLogin();
      setUser(demo.user);
      setProfile(demo.profile);
      await refreshResumes();
    } finally {
      setLoading(false);
    }
  };

  if (loading && !activeResume) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 p-0.5 animate-spin">
          <div className="w-full h-full bg-slate-950 rounded-[10px]" />
        </div>
        <div className="text-sm font-bold text-white mt-4">Initializing ResumeX AI Core Ultra</div>
        <p className="text-xs text-slate-400 mt-1">Bootstrapping NLP engines & deterministic scoring models...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onSwitchDemo={handleSwitchDemo}
        geminiActive={geminiActive}
      />

      {/* Global Error Banner */}
      {errorNotice && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-4 py-2 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="text-xs text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            resumes={resumes}
            activeResume={activeResume}
            onSelectResume={handleSelectResume}
            onUpload={handleUploadResume}
            onNavigate={(tab) => setActiveTab(tab as NavTab)}
            onDeleteResume={handleDeleteResume}
            issues={issues}
            loading={loading}
          />
        )}

        {activeTab === 'ats-lab' && (
          <AtsLabView
            resume={activeResume}
            atsResult={atsResult}
            issues={issues}
            onIssueAction={handleIssueAction}
            onNavigate={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'job-matching' && (
          <JobMatchingView
            resume={activeResume}
            onNavigate={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'career-gap' && (
          <CareerGapView
            resume={activeResume}
            onNavigate={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'builder' && (
          <LiveBuilderView
            resume={activeResume}
            onUpdateResume={handleUpdateResume}
            templates={templates}
          />
        )}

        {activeTab === 'ab-testing' && (
          <VersionComparisonView
            resume={activeResume}
            onNavigate={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'templates' && (
          <TemplateGalleryView
            resume={activeResume}
            onSelectTemplate={handleSelectTemplate}
            onNavigate={(tab) => setActiveTab(tab as NavTab)}
          />
        )}

        {activeTab === 'nlp-eval' && <NlpEvaluationView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-slate-500 text-xs text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-bold text-slate-300">ResumeX AI — Core Ultra</span> • Deterministic ATS Simulation & Zero-Hallucination AI Platform
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Isolated Multi-Tenant Security</span>
            <span>•</span>
            <span>Anti-Hallucination Policy Active</span>
            <span>•</span>
            <span>100+ Production Templates</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
