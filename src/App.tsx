import React, { useState, useEffect, useRef } from 'react';
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
import { firebaseAuthManager } from './services/firebaseAuth';
import { Navbar, type NavTab } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/views/DashboardView';
import { MyResumesView } from './components/views/MyResumesView';
import { AtsLabView } from './components/views/AtsLabView';
import { JobMatchingView } from './components/views/JobMatchingView';
import { CareerGapView } from './components/views/CareerGapView';
import { LiveBuilderView } from './components/views/LiveBuilderView';
import { VersionComparisonView } from './components/views/VersionComparisonView';
import { TemplateGalleryView } from './components/views/TemplateGalleryView';
import { NlpEvaluationView } from './components/views/NlpEvaluationView';
import { SettingsView } from './components/views/SettingsView';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

interface ToastNotice {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

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

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'verify' | 'forgot' | 'reset'>('login');
  const [authModalToken, setAuthModalToken] = useState<string>('');

  // Global Toast notices
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  // Global file input reference
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      // 1. Health check
      const health = await api.checkHealth().catch(() => ({ status: 'ok', geminiEnabled: false }));
      setGeminiActive(health.geminiEnabled);

      // 2. Process URL parameters for Email Verification or Password Reset
      let urlHandledUser: User | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const queryToken = urlParams.get('token');
        const pathname = window.location.pathname;

        if (queryToken && (pathname.includes('verify-email') || urlParams.get('action') === 'verify')) {
          // Immediately sanitize URL to avoid token persistence in history/logs
          window.history.replaceState({}, '', pathname.includes('verify-email') ? '/' : window.location.pathname);
          try {
            const verifyRes = await api.verifyEmail(queryToken.trim());
            setUser(verifyRes.user);
            setProfile(verifyRes.profile);
            urlHandledUser = verifyRes.user;
            showToast('success', verifyRes.message || 'Email verified successfully! Welcome to ResumeX AI.');
          } catch (verifyErr: any) {
            showToast('error', verifyErr.message || 'Verification link is invalid, expired, or already used.');
          }
        } else if (queryToken && (pathname.includes('reset-password') || urlParams.get('action') === 'reset')) {
          window.history.replaceState({}, '', pathname.includes('reset-password') ? '/' : window.location.pathname);
          setAuthModalToken(queryToken.trim());
          setAuthMode('reset');
          setShowAuthModal(true);
        }
      }

      // 2b. Check Firebase Google Redirect sign-in result
      if (!urlHandledUser) {
        try {
          const redirectResult = await firebaseAuthManager.getRedirectAuthResult();
          if (redirectResult) {
            const authRes = await api.googleAuth(redirectResult.idToken);
            setUser(authRes.user);
            setProfile(authRes.profile);
            urlHandledUser = authRes.user;
            showToast('success', `Signed in with Google as ${authRes.user.name || authRes.user.email}`);
          }
        } catch (redirectErr: any) {
          const errCode = redirectErr?.code || 'auth/redirect-error';
          const errMsg = redirectErr?.message || 'Google redirect sign-in failed.';
          console.warn(`[Firebase Auth] Redirect error: ${errCode} | ${errMsg}`);
          showToast('error', `Google sign-in failed (${errCode}): ${errMsg}`);
        }
      }

      // 3. Auth state
      let currentUser: User | null = urlHandledUser;
      if (!currentUser) {
        try {
          const me = await api.getMe();
          setUser(me.user);
          setProfile(me.profile);
          currentUser = me.user;
        } catch {
          // Stale or expired token: clear residual session state
          api.logout().catch(() => {});
          setUser(null);
          setProfile(null);
          currentUser = null;

          // If demo login is enabled in dev, attempt demo login
          try {
            const demo = await api.demoLogin();
            setUser(demo.user);
            setProfile(demo.profile);
            currentUser = demo.user;
          } catch {
            // Normal guest / landing mode
          }
        }
      }

      // 4. Load Templates
      const tmplRes = await api.getTemplates().catch(() => ({ count: 0, templates: [] }));
      setTemplates(tmplRes.templates);

      // 5. Load Resumes
      if (currentUser) {
        await refreshResumes();
      }
    } catch (err: any) {
      console.error('App init error:', err);
      showToast('error', 'Failed to initialize session. Reconnecting...');
    } finally {
      setLoading(false);
    }
  };

  const refreshResumes = async () => {
    try {
      const list = await api.getResumes();
      setResumes(list);
      if (list.length > 0) {
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
    } catch (err: any) {
      const isAuthError =
        err?.message &&
        (err.message.includes('Authentication required') ||
          err.message.includes('UNAUTHORIZED') ||
          err.message.includes('TOKEN_INVALID') ||
          err.message.includes('expired or invalid') ||
          err.message.includes('session has been signed out') ||
          err.message.includes('HTTP 401'));

      if (isAuthError) {
        // Reset auth state cleanly to avoid broken UI state or console error spam
        setUser(null);
        setProfile(null);
        setActiveResume(null);
        setResumes([]);
        api.logout().catch(() => {});

        // Try demo recovery if permitted
        try {
          const demo = await api.demoLogin();
          setUser(demo.user);
          setProfile(demo.profile);
          const list = await api.getResumes();
          setResumes(list);
          if (list.length > 0) {
            setActiveResume(list[0]);
            await loadResumeAnalysis(list[0].id);
          }
        } catch {
          // Graceful transition to unauthenticated landing view
        }
      } else {
        console.error('Failed to load resumes:', err);
      }
    }
  };

  const loadResumeAnalysis = async (resumeId: string) => {
    try {
      const details = await api.getResume(resumeId);
      setIssues(details.issues);
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
      showToast('success', `Resume "${res.resume.title}" parsed with ${res.atsAnalysis.overallAtsScore}% ATS score.`);
    } catch (err: any) {
      showToast('error', `Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await handleUploadResume({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
      });
      if (globalFileInputRef.current) {
        globalFileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateResume = async (data: ResumeData, title?: string, templateId?: string) => {
    if (!activeResume) return;
    try {
      const res = await api.updateResume(activeResume.id, data, title, templateId);
      setActiveResume(res.resume);
      setResumes(resumes.map((r) => (r.id === res.resume.id ? res.resume : r)));
      await loadResumeAnalysis(res.resume.id);
      showToast('success', 'Resume changes saved and verified.');
    } catch (err: any) {
      showToast('error', `Save failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteResume = async (id: string) => {
    try {
      await api.deleteResume(id);
      await refreshResumes();
      showToast('info', 'Resume deleted successfully.');
    } catch (err: any) {
      showToast('error', `Delete failed: ${err.message}`);
    }
  };

  const handleCreateNewResume = async () => {
    setLoading(true);
    try {
      const starterData: ResumeData = {
        personal_info: {
          name: user?.name || 'Candidate Name',
          email: user?.email || 'candidate@example.com',
          location: 'San Francisco, CA',
          phone: '(555) 234-5678',
          linkedin: 'https://linkedin.com/in/candidate',
          github: 'https://github.com/candidate',
          portfolio: 'https://candidate.dev',
        },
        summary:
          'Proven Senior Software Engineer with strong track record in distributed architecture, high-throughput microservices, and reliable cloud deployments.',
        skills: [
          {
            category: 'Languages & Core',
            items: ['TypeScript', 'JavaScript', 'Python', 'Go', 'SQL'],
          },
          {
            category: 'Frameworks & Libraries',
            items: ['React', 'Next.js', 'Node.js', 'Express', 'Tailwind CSS'],
          },
          {
            category: 'Cloud & Infrastructure',
            items: ['AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'Redis', 'Kafka', 'CI/CD'],
          },
        ],
        experience: [
          {
            id: `exp-${Date.now()}-1`,
            role: 'Senior Software Engineer',
            company: 'Nexus Technologies',
            location: 'San Francisco, CA',
            startDate: '2022-01',
            endDate: 'Present',
            bullets: [
              'Architected distributed event messaging layer processing 35,000 requests/sec with zero packet loss.',
              'Led migration of critical legacy monolith into Kubernetes microservices, cutting p99 query latency by 42%.',
              'Collaborated with product and security teams to implement end-to-end OAuth2 and RBAC compliance.',
            ],
            technologies: ['TypeScript', 'Kubernetes', 'Kafka', 'PostgreSQL'],
          },
        ],
        education: [
          {
            id: `edu-${Date.now()}-1`,
            degree: 'B.S. in Computer Science',
            institution: 'University of California, Berkeley',
            fieldOfStudy: 'Computer Science',
            startDate: '2016-08',
            endDate: '2020-05',
            gpa: '3.8',
          },
        ],
        projects: [
          {
            id: `proj-${Date.now()}-1`,
            title: 'Cloud Data Pipeline',
            link: 'https://github.com/candidate/pipeline',
            technologies: ['TypeScript', 'Kafka', 'Redis'],
            bullets: [
              'Built scalable stream processing engine aggregating high-frequency analytics in real-time.',
              'Reduced ingestion delay from 12s to under 150ms with backpressure tuning.',
            ],
          },
        ],
        certifications: [
          {
            id: `cert-${Date.now()}-1`,
            name: 'AWS Solutions Architect Associate',
            issuer: 'Amazon Web Services',
            date: '2023',
          },
        ],
        achievements: [
          {
            id: `ach-${Date.now()}-1`,
            title: 'Engineering Excellence Award',
            description: 'Recognized for improving CI/CD deployment cycle times by 65%.',
          },
        ],
      };

      const res = await api.createResume({
        title: 'Software Engineer Resume (New)',
        data: starterData,
        templateId: 'modern-clean',
      });

      await refreshResumes();
      setActiveResume(res.resume);
      await loadResumeAnalysis(res.resume.id);
      setActiveTab('builder');
      showToast('success', 'New resume created and loaded into Live Builder.');
    } catch (err: any) {
      showToast('error', `Failed to create resume: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueAction = async (issueId: string, action: 'accepted' | 'rejected') => {
    if (!activeResume) return;
    try {
      const res = await api.updateIssueStatus(activeResume.id, issueId, action);
      setIssues(issues.map((i) => (i.id === issueId ? res.issue : i)));
      showToast('info', `Optimization suggestion marked as ${action}.`);
    } catch (err: any) {
      showToast('error', `Failed to update issue: ${err.message}`);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    if (!activeResume) return;
    await handleUpdateResume(activeResume.data, activeResume.title, templateId);
    showToast('success', 'Template layout applied to current resume.');
  };

  const handleUpdateProfile = async (updated: Partial<UserProfile>) => {
    try {
      const res = await api.updateProfile(updated);
      setProfile(res.profile);
      showToast('success', 'Profile and target career criteria saved.');
    } catch (err: any) {
      showToast('error', `Profile update failed: ${err.message}`);
    }
  };

  const handleAccountDeleted = () => {
    api.logout();
    setUser(null);
    setProfile(null);
    setResumes([]);
    setActiveResume(null);
    showToast('info', 'Account and personal records deleted.');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setProfile(null);
    setResumes([]);
    setActiveResume(null);
    showToast('info', 'Signed out safely.');
  };

  const handleSwitchDemo = async () => {
    setLoading(true);
    try {
      const demo = await api.demoLogin();
      setUser(demo.user);
      setProfile(demo.profile);
      await refreshResumes();
      showToast('success', 'Switched to Demo Candidate Sandbox.');
    } catch (err: any) {
      showToast('error', `Demo login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // If initial load in progress
  if (loading && !user && !activeResume) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] flex flex-col items-center justify-center text-[#171713]">
        <div className="w-12 h-12 rounded-xl bg-[#4F5D2F] flex items-center justify-center text-white shadow-xs animate-pulse">
          <span className="font-extrabold text-base">RX</span>
        </div>
        <div className="text-sm font-bold text-[#171713] mt-4">Initializing ResumeX AI Core Ultra</div>
        <p className="text-xs text-[#6E6E63] mt-1">Bootstrapping NLP engines & deterministic scoring models...</p>
      </div>
    );
  }

  // If user signed out, show Landing Page
  if (!user) {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setShowAuthModal(true);
          }}
          onTryDemo={handleSwitchDemo}
        />
        <AuthModal
          isOpen={showAuthModal}
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(u, p) => {
            setUser(u);
            setProfile(p);
            setShowAuthModal(false);
            refreshResumes();
            showToast('success', `Welcome, ${u.name}!`);
          }}
          onTryDemo={handleSwitchDemo}
          showToast={showToast}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#171713] flex flex-col font-sans selection:bg-[#4F5D2F]/20 selection:text-[#171713]">
      {/* Hidden Global File Input */}
      <input
        type="file"
        ref={globalFileInputRef}
        onChange={handleGlobalFileInput}
        accept=".pdf,.docx,.txt"
        className="hidden"
      />

      {/* Top Application Header */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onSwitchDemo={handleSwitchDemo}
        geminiActive={geminiActive}
        resumes={resumes}
        activeResume={activeResume}
        onSelectResume={handleSelectResume}
        onUploadClick={() => globalFileInputRef.current?.click()}
      />

      {/* Global Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg text-xs transition-all animate-in slide-in-from-bottom-2 ${
              t.type === 'success'
                ? 'bg-white border-[#4F5D2F]/30 text-[#171713]'
                : t.type === 'error'
                ? 'bg-white border-rose-300 text-rose-900'
                : t.type === 'warning'
                ? 'bg-white border-amber-300 text-amber-900'
                : 'bg-white border-[#EAE8E1] text-[#171713]'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
              {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {t.type === 'info' && <Info className="w-4 h-4 text-[#4F5D2F]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#6E6E63] hover:text-[#171713] shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Body with Desktop Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeResume={activeResume}
          onUploadClick={() => globalFileInputRef.current?.click()}
          onCreateNew={handleCreateNewResume}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
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

          {activeTab === 'my-resumes' && (
            <MyResumesView
              resumes={resumes}
              activeResume={activeResume}
              onSelectResume={handleSelectResume}
              onCreateNew={handleCreateNewResume}
              onUploadClick={() => globalFileInputRef.current?.click()}
              onDeleteResume={handleDeleteResume}
              onNavigateTab={(tab) => setActiveTab(tab as NavTab)}
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

          {activeTab === 'builder' && (
            <LiveBuilderView
              resume={activeResume}
              onUpdateResume={handleUpdateResume}
              templates={templates}
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

          {activeTab === 'templates' && (
            <TemplateGalleryView
              resume={activeResume}
              onSelectTemplate={handleSelectTemplate}
              onNavigate={(tab) => setActiveTab(tab as NavTab)}
            />
          )}

          {activeTab === 'ab-testing' && (
            <VersionComparisonView
              resume={activeResume}
              onNavigate={(tab) => setActiveTab(tab as NavTab)}
              onRestoreVersion={async (restored) => {
                await handleSelectResume(restored);
                await refreshResumes();
                showToast('success', `Restored resume to version state.`);
              }}
            />
          )}

          {activeTab === 'nlp-eval' && <NlpEvaluationView />}

          {activeTab === 'settings' && (
            <SettingsView
              user={user}
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              onAccountDeleted={handleAccountDeleted}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#EAE8E1] bg-white py-4 text-[#6E6E63] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-bold text-[#171713]">ResumeX AI — Core Ultra</span> • Deterministic ATS Simulation & Truth Verification
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#6E6E63]">
            <span>Anti-Hallucination Verified</span>
            <span>•</span>
            <span>100+ Production Templates</span>
            <span>•</span>
            <span>Multi-Tenant Architecture</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal (if opened by user) */}
      <AuthModal
        isOpen={showAuthModal}
        initialMode={authMode}
        initialToken={authModalToken}
        onClose={() => {
          setShowAuthModal(false);
          setAuthModalToken('');
        }}
        onSuccess={(u, p) => {
          setUser(u);
          setProfile(p);
          setShowAuthModal(false);
          setAuthModalToken('');
          refreshResumes();
          showToast('success', `Welcome, ${u.name}!`);
        }}
        onTryDemo={handleSwitchDemo}
        showToast={showToast}
      />
    </div>
  );
}
