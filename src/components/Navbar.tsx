import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Briefcase,
  TrendingUp,
  Edit3,
  GitCompare,
  Layout,
  Cpu,
  Sparkles,
  LogOut,
  User as UserIcon,
  Upload,
  Settings,
  Menu,
  X,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
} from 'lucide-react';
import type { User, ResumeDocument } from '../types';

export type NavTab =
  | 'dashboard'
  | 'my-resumes'
  | 'ats-lab'
  | 'builder'
  | 'job-matching'
  | 'career-gap'
  | 'templates'
  | 'ab-testing'
  | 'nlp-eval'
  | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User | null;
  onLogout: () => void;
  onSwitchDemo: () => void;
  geminiActive: boolean;
  resumes: ResumeDocument[];
  activeResume: ResumeDocument | null;
  onSelectResume: (resume: ResumeDocument) => void;
  onUploadClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  user,
  onLogout,
  onSwitchDemo,
  geminiActive,
  resumes,
  activeResume,
  onSelectResume,
  onUploadClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [resumeDropdownOpen, setResumeDropdownOpen] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const resumeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (resumeDropdownRef.current && !resumeDropdownRef.current.contains(e.target as Node)) {
        setResumeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; section: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Layout, section: 'Core' },
    { id: 'my-resumes', label: 'My Resumes', icon: FileText, section: 'Core' },
    { id: 'ats-lab', label: 'ATS Analyzer', icon: ShieldCheck, section: 'Core' },
    { id: 'builder', label: 'Live Builder', icon: Edit3, section: 'Core' },
    { id: 'job-matching', label: 'Job Matching', icon: Briefcase, section: 'Analysis' },
    { id: 'career-gap', label: 'Career Gap', icon: TrendingUp, section: 'Analysis' },
    { id: 'templates', label: '100+ Templates', icon: FileText, section: 'Creation' },
    { id: 'ab-testing', label: 'A/B Versions', icon: GitCompare, section: 'Creation' },
    { id: 'nlp-eval', label: 'Truth & NLP Benchmark', icon: Cpu, section: 'System' },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'System' },
  ];

  const overallScore = activeResume?.score?.overall ?? activeResume?.atsScore ?? 85;

  return (
    <>
      {/* Top Application Header */}
      <header className="sticky top-0 z-30 w-full bg-white border-b border-[#EAE8E1] text-[#171713] shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <button
              id="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#6E6E63] hover:text-[#171713] hover:bg-[#FAF9F5] transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div
              id="brand-logo"
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-lg bg-[#4F5D2F] flex items-center justify-center text-white font-black text-sm shadow-xs">
                RX
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-[#171713]">ResumeX AI</span>
                <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30">
                  Core Ultra
                </span>
              </div>
            </div>
          </div>

          {/* Center: Active Resume Switcher Dropdown */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-md mx-4">
            <div className="relative w-full" ref={resumeDropdownRef}>
              <button
                id="active-resume-dropdown-btn"
                onClick={() => setResumeDropdownOpen(!resumeDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-[#EAE8E1] bg-[#FAF9F5] hover:bg-white text-xs font-medium text-[#171713] transition shadow-2xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-[#4F5D2F] shrink-0" />
                  <span className="truncate">
                    {activeResume ? activeResume.title : 'No resume selected'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {activeResume && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#4F5D2F]/10 text-[#4F5D2F]">
                      {overallScore} ATS
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-[#6E6E63]" />
                </div>
              </button>

              {/* Resume Dropdown Menu */}
              {resumeDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl border border-[#EAE8E1] shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#6E6E63] uppercase tracking-wider border-b border-[#EAE8E1]">
                    Candidate Documents ({resumes.length})
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {resumes.map((r) => (
                      <button
                        key={r.id}
                        id={`select-resume-${r.id}`}
                        onClick={() => {
                          onSelectResume(r);
                          setResumeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#FAF9F5] transition ${
                          activeResume?.id === r.id ? 'bg-[#4F5D2F]/10 text-[#4F5D2F] font-semibold' : 'text-[#171713]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{r.title}</span>
                        </div>
                        {activeResume?.id === r.id && <Check className="w-3.5 h-3.5 text-[#4F5D2F]" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[#EAE8E1] p-1.5">
                    <button
                      onClick={() => {
                        setResumeDropdownOpen(false);
                        onUploadClick();
                      }}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-[#4F5D2F] bg-[#FAF9F5] hover:bg-[#4F5D2F]/10 transition flex items-center justify-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload New Resume
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick CTA & User Avatar */}
          <div className="flex items-center gap-3">
            <button
              id="header-upload-btn"
              onClick={onUploadClick}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D5D2C7] bg-white text-[#171713] text-xs font-semibold hover:bg-[#FAF9F5] transition shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-[#4F5D2F]" />
              Upload PDF
            </button>

            {/* Gemini Status Indicator */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                geminiActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title={geminiActive ? 'Gemini AI online' : 'Local NLP pipeline active'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${geminiActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{geminiActive ? 'Gemini AI Online' : 'Local NLP Active'}</span>
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                id="user-menu-btn"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-[#FAF9F5] border border-[#EAE8E1] transition"
              >
                <div className="w-7 h-7 rounded-full bg-[#FAF9F5] border border-[#D5D2C7] flex items-center justify-center text-xs font-bold text-[#4F5D2F]">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <ChevronDown className="w-3 h-3 text-[#6E6E63] mr-1 hidden sm:block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-[#EAE8E1] shadow-lg py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-[#EAE8E1]">
                    <p className="text-xs font-bold text-[#171713] leading-tight">{user?.name || 'Candidate'}</p>
                    <p className="text-[11px] text-[#6E6E63] truncate mt-0.5">{user?.email}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {user?.emailVerified ? (
                        <span className="text-[10px] font-semibold text-[#4F5D2F] bg-[#4F5D2F]/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                          Unverified
                        </span>
                      )}
                      {user?.isDemo && (
                        <span className="text-[10px] font-semibold text-[#8E6D24] bg-[#C49A3A]/15 px-1.5 py-0.5 rounded">
                          Sandbox
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      id="menu-settings-btn"
                      onClick={() => {
                        onSelectTab('settings');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#171713] hover:bg-[#FAF9F5] transition"
                    >
                      <Settings className="w-4 h-4 text-[#6E6E63]" />
                      Account & Security Settings
                    </button>
                    <button
                      id="menu-demo-btn"
                      onClick={() => {
                        onSwitchDemo();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#8E6D24] hover:bg-[#FAF9F5] transition font-medium"
                    >
                      <Sparkles className="w-4 h-4 text-[#C49A3A]" />
                      Switch to Demo Sandbox
                    </button>
                  </div>

                  <div className="border-t border-[#EAE8E1] pt-1">
                    <button
                      id="menu-logout-btn"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white border-r border-[#EAE8E1] p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE8E1]">
              <span className="font-bold text-sm text-[#171713]">Navigation Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-[#6E6E63]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1 overflow-y-auto flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#4F5D2F]/10 text-[#4F5D2F]'
                        : 'text-[#6E6E63] hover:text-[#171713] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};
