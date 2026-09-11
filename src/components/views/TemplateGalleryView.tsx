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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <Layout className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">
              100+ Precision Template Configurations
            </h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Typographic hierarchies, calibrated spacing densities, and certified ATS-compliant layouts.
          </p>
        </div>

        <div className="text-xs text-[#6E6E63]">
          Displaying <strong className="text-[#171713]">{filteredTemplates.length}</strong> available configurations
        </div>
      </div>

      {/* Filters and Search */}
      <div className="p-4 rounded-xl bg-white border border-[#EAE8E1] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeCategory === cat
                  ? 'bg-[#4F5D2F] text-white shadow-xs'
                  : 'bg-[#FAF9F5] text-[#6E6E63] hover:text-[#171713] border border-[#EAE8E1]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#6E6E63] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search templates, fonts, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
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
              className={`p-5 rounded-xl bg-white border transition flex flex-col justify-between shadow-xs ${
                isActive
                  ? 'border-[#4F5D2F] ring-2 ring-[#4F5D2F]/20'
                  : 'border-[#EAE8E1] hover:border-[#D5D2C7]'
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#171713]">{tmpl.name}</h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF9F5] text-[#4F5D2F] border border-[#EAE8E1] mt-1 inline-block">
                      {tmpl.category}
                    </span>
                  </div>

                  {/* Color Swatch */}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: tmpl.primaryColor }}
                      title={`Primary: ${tmpl.primaryColor}`}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: tmpl.accentColor }}
                      title={`Accent: ${tmpl.accentColor}`}
                    />
                  </div>
                </div>

                <p className="text-xs text-[#6E6E63] mt-2.5 leading-relaxed">{tmpl.description}</p>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#EAE8E1] text-[11px] text-[#6E6E63]">
                  <div>
                    Layout: <strong className="text-[#171713] capitalize">{tmpl.layout.replace('-', ' ')}</strong>
                  </div>
                  <div>
                    Density: <strong className="text-[#171713] capitalize">{tmpl.spacingDensity}</strong>
                  </div>
                  <div>
                    Font: <strong className="text-[#171713] capitalize">{tmpl.fontFamily.replace('font-', '')}</strong>
                  </div>
                  <div>
                    Bullets: <strong className="text-[#171713] capitalize">{tmpl.bulletStyle}</strong>
                  </div>
                </div>

                {/* Tags */}
                {tmpl.tags && tmpl.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {tmpl.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[#FAF9F5] text-[#6E6E63] border border-[#EAE8E1]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="pt-4 mt-4 border-t border-[#EAE8E1] flex items-center justify-between">
                {isActive ? (
                  <span className="text-xs font-semibold text-[#4F5D2F] flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Currently Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(tmpl.id)}
                    disabled={applyingId === tmpl.id}
                    className="w-full py-2 rounded-lg bg-[#FAF9F5] hover:bg-[#4F5D2F] text-[#171713] hover:text-white text-xs font-semibold border border-[#D5D2C7] hover:border-[#4F5D2F] transition text-center shadow-2xs"
                  >
                    {applyingId === tmpl.id ? 'Applying...' : 'Apply Configuration'}
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
