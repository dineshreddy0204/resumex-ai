import React from 'react';
import {
  Layout,
  FileText,
  ShieldCheck,
  Edit3,
  Briefcase,
  TrendingUp,
  GitCompare,
  Cpu,
  Settings,
  Sparkles,
  Plus,
  Upload,
} from 'lucide-react';
import type { NavTab } from './Navbar';
import type { ResumeDocument } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeResume: ResumeDocument | null;
  onUploadClick: () => void;
  onCreateNew: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeResume,
  onUploadClick,
  onCreateNew,
}) => {
  const sections = [
    {
      title: 'WORKSPACE',
      items: [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: Layout },
        { id: 'my-resumes' as NavTab, label: 'My Resumes', icon: FileText },
        { id: 'ats-lab' as NavTab, label: 'ATS Analyzer', icon: ShieldCheck },
        { id: 'builder' as NavTab, label: 'Live Builder', icon: Edit3 },
      ],
    },
    {
      title: 'INTELLIGENCE ENGINES',
      items: [
        { id: 'job-matching' as NavTab, label: 'Job Matching', icon: Briefcase },
        { id: 'career-gap' as NavTab, label: 'Career Gap', icon: TrendingUp },
        { id: 'templates' as NavTab, label: '100+ Templates', icon: FileText },
        { id: 'ab-testing' as NavTab, label: 'A/B Versions', icon: GitCompare },
      ],
    },
    {
      title: 'SYSTEM & BENCHMARK',
      items: [
        { id: 'nlp-eval' as NavTab, label: 'Truth & NLP Eval', icon: Cpu },
        { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
      ],
    },
  ];

  const overallScore = activeResume?.score?.overall ?? activeResume?.atsScore ?? 85;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#EAE8E1] shrink-0 min-h-[calc(100vh-4rem)] p-4 justify-between">
      <div className="space-y-6">
        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="sidebar-upload-btn"
            onClick={onUploadClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[#D5D2C7] bg-[#FAF9F5] text-[#171713] text-xs font-semibold hover:bg-white hover:border-[#4F5D2F] transition shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#4F5D2F]" />
            Upload
          </button>
          <button
            id="sidebar-create-btn"
            onClick={onCreateNew}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#4F5D2F] text-white text-xs font-semibold hover:bg-[#37421F] transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Build
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-5">
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-[#6E6E63] uppercase tracking-wider">
                {sec.title}
              </div>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                        isActive
                          ? 'bg-[#4F5D2F]/10 text-[#4F5D2F] font-semibold shadow-2xs'
                          : 'text-[#6E6E63] hover:text-[#171713] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#4F5D2F]' : 'text-[#6E6E63]'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Status Card */}
      {activeResume && (
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#171713] truncate max-w-[120px]">
              {activeResume.title}
            </span>
            <span className="font-bold text-[#4F5D2F] text-xs">
              {overallScore}/100
            </span>
          </div>
          <div className="w-full bg-[#EAE8E1] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#4F5D2F] h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, overallScore)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#6E6E63]">
            <span>ATS Compatibility</span>
            <span className="text-[#8E6D24] font-medium">Workday / Greenhouse</span>
          </div>
        </div>
      )}
    </aside>
  );
};
