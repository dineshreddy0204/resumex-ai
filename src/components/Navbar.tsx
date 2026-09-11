import React from 'react';
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
} from 'lucide-react';
import type { User } from '../types';

export type NavTab =
  | 'dashboard'
  | 'ats-lab'
  | 'job-matching'
  | 'career-gap'
  | 'builder'
  | 'ab-testing'
  | 'templates'
  | 'nlp-eval';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User | null;
  onLogout: () => void;
  onSwitchDemo: () => void;
  geminiActive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  user,
  onLogout,
  onSwitchDemo,
  geminiActive,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Layout },
    { id: 'ats-lab', label: 'ATS Intelligence Lab', icon: ShieldCheck },
    { id: 'job-matching', label: 'Job Matching', icon: Briefcase },
    { id: 'career-gap', label: 'Career Gap', icon: TrendingUp },
    { id: 'builder', label: 'Live Builder', icon: Edit3 },
    { id: 'ab-testing', label: 'A/B Versioning', icon: GitCompare },
    { id: 'templates', label: '100+ Templates', icon: FileText },
    { id: 'nlp-eval', label: 'NLP Benchmark', icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div
            id="brand-logo"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-sm shadow-sky-500/20 group-hover:shadow-sky-500/40 transition">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <span className="text-sky-400 font-extrabold text-lg tracking-tighter">RX</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white group-hover:text-sky-300 transition">
                  ResumeX AI
                </span>
                <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Core Ultra
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                ATS Simulation • Semantic Matching • Career Engine
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status & User Actions */}
          <div className="flex items-center gap-3">
            {/* Engine status indicator */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                geminiActive
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>{geminiActive ? 'Gemini AI Ready' : 'Deterministic Hybrid'}</span>
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-medium text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-slate-400">{user.email}</div>
                </div>
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-demo-login"
                onClick={onSwitchDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-sm transition"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Demo Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex lg:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap font-medium transition ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
