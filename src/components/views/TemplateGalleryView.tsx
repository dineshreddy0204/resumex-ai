import React, { useState } from 'react';
import type { ResumeDocument, TemplateDefinition } from '../../types';
import { getFullTemplateCatalog } from '../../constants/templates';
import {
  Layout,
  Search,
  Check,
  Sparkles,
  Sliders,
  Filter,
} from 'lucide-react';

interface TemplateGalleryViewProps {
  resume: ResumeDocument | null;
  onSelectTemplate: (templateId: string) => Promise<void>;
  onNavigate: (tab: string) => void;
}

const CATEGORIES = [
  'All',
  'ATS',
  'Modern',
  'Executive',
  'Professional',
  'Technical',
  'Fresher',
  'Creative',
];

export const TemplateGalleryView: React.FC<TemplateGalleryViewProps> = ({
  resume,
  onSelectTemplate,
  onNavigate,
}) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const allTemplates = getFullTemplateCatalog();

  const filteredTemplates = allTemplates.filter((tmpl) => {
    const matchesCategory =
      activeCategory === 'All' || tmpl.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch =
      tmpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tmpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tmpl.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleApply = async (tmplId: string) => {
    setApplyingId(tmplId);
    try {
      await onSelectTemplate(tmplId);
      onNavigate('builder');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layout className="w-6 h-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              100+ Production Template Configurations
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Carefully calibrated typographic hierarchies, spacing densities, and ATS-compliant multi-column variants.
          </p>
        </div>

        <div className="text-xs text-slate-400">
          Showing <strong className="text-slate-200">{filteredTemplates.length}</strong> available templates
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeCategory === cat
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search templates, fonts, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((tmpl) => {
          const isActive = resume?.templateId === tmpl.id;
          return (
            <div
              key={tmpl.id}
              className={`p-5 rounded-xl bg-slate-900 border transition flex flex-col justify-between ${
                isActive
                  ? 'border-sky-500 ring-1 ring-sky-500'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{tmpl.name}</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                      {tmpl.category}
                    </span>
                  </div>

                  {/* Color Swatch */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: tmpl.primaryColor }}
                      title={`Primary: ${tmpl.primaryColor}`}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: tmpl.accentColor }}
                      title={`Accent: ${tmpl.accentColor}`}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{tmpl.description}</p>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div>
                    Layout: <strong className="text-slate-300 capitalize">{tmpl.layout.replace('-', ' ')}</strong>
                  </div>
                  <div>
                    Density: <strong className="text-slate-300 capitalize">{tmpl.spacingDensity}</strong>
                  </div>
                  <div>
                    Font: <strong className="text-slate-300 capitalize">{tmpl.fontFamily.replace('font-', '')}</strong>
                  </div>
                  <div>
                    Bullets: <strong className="text-slate-300 capitalize">{tmpl.bulletStyle}</strong>
                  </div>
                </div>

                {/* Tags */}
                {tmpl.tags && tmpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {tmpl.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 text-slate-400 border border-slate-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
                {isActive ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Currently Applied
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(tmpl.id)}
                    disabled={applyingId === tmpl.id}
                    className="w-full py-2 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white text-xs font-semibold border border-sky-500/30 transition text-center"
                  >
                    {applyingId === tmpl.id ? 'Applying...' : 'Apply to Resume'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
