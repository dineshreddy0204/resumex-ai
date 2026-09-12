import React from 'react';
import type { ResumeData, TemplateDefinition } from '../types';
import { Mail, Phone, MapPin, Globe, Linkedin, Github } from 'lucide-react';

interface ResumeRendererProps {
  data: ResumeData;
  template: TemplateDefinition;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export const ResumeRenderer: React.FC<ResumeRendererProps> = ({
  data,
  template,
  containerRef,
  className = '',
}) => {
  const { personal_info, summary, skills, experience, education, projects, certifications, achievements } = data;

  const fontClass = template.fontFamily || 'font-sans';
  const densityClass =
    template.spacingDensity === 'compact'
      ? 'space-y-3'
      : template.spacingDensity === 'spacious'
      ? 'space-y-6'
      : 'space-y-4';

  const headingDividerStyle: React.CSSProperties = {
    borderColor: template.accentColor,
  };

  const accentTextStyle: React.CSSProperties = {
    color: template.accentColor,
  };

  const primaryTextStyle: React.CSSProperties = {
    color: template.primaryColor,
  };

  const bulletSymbol =
    template.bulletStyle === 'hyphen'
      ? '–'
      : template.bulletStyle === 'square'
      ? '▪'
      : template.bulletStyle === 'arrow'
      ? '›'
      : '•';

  return (
    <div
      ref={containerRef}
      id="resume-render-canvas"
      className={`bg-white text-slate-800 p-8 sm:p-10 rounded shadow-sm border border-slate-200 transition-all ${fontClass} ${className}`}
      style={{
        backgroundColor: template.backgroundColor || '#ffffff',
        minHeight: '1000px',
      }}
    >
      {/* 1. Header Section */}
      <header
        className={`mb-6 pb-4 ${
          template.headerStyle === 'centered'
            ? 'text-center'
            : template.headerStyle === 'banner'
            ? 'bg-slate-50 p-4 rounded -mx-4 border-l-4'
            : template.headerStyle === 'bordered'
            ? 'border-b-2 pb-4'
            : 'text-left'
        }`}
        style={template.headerStyle === 'banner' ? { borderLeftColor: template.accentColor } : {}}
      >
        <h1
          className="text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={primaryTextStyle}
        >
          {personal_info?.name || 'Your Full Name'}
        </h1>

        <div
          className={`flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-600 ${
            template.headerStyle === 'centered' ? 'justify-center' : 'justify-start'
          }`}
        >
          {personal_info?.email && (
            <div className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{personal_info.email}</span>
            </div>
          )}
          {personal_info?.phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{personal_info.phone}</span>
            </div>
          )}
          {personal_info?.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{personal_info.location}</span>
            </div>
          )}
          {personal_info?.linkedin && (
            <div className="flex items-center gap-1">
              <Linkedin className="w-3.5 h-3.5 text-slate-400" />
              <a
                href={personal_info.linkedin}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                LinkedIn
              </a>
            </div>
          )}
          {personal_info?.github && (
            <div className="flex items-center gap-1">
              <Github className="w-3.5 h-3.5 text-slate-400" />
              <a
                href={personal_info.github}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                GitHub
              </a>
            </div>
          )}
          {personal_info?.portfolio && (
            <div className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <a
                href={personal_info.portfolio}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                Portfolio
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Main Body Layout */}
      {template.layout === 'two-column-left' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="md:col-span-1 space-y-5 border-r border-slate-200 pr-4">
            {/* Skills */}
            {skills && skills.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900 mb-2" style={accentTextStyle}>
                  Technical Skills
                </h2>
                <div className="space-y-2 text-xs">
                  {skills.map((group, idx) => (
                    <div key={idx}>
                      <span className="font-semibold text-slate-800">{group.category}: </span>
                      <span className="text-slate-600">{(group.items || []).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {education && education.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900 mb-2" style={accentTextStyle}>
                  Education
                </h2>
                <div className="space-y-2 text-xs">
                  {education.map((edu) => (
                    <div key={edu.id}>
                      <div className="font-semibold text-slate-800">{edu.degree}</div>
                      <div className="text-slate-600">{edu.institution}</div>
                      <div className="text-[11px] text-slate-400">
                        {edu.startDate} – {edu.endDate}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Certifications */}
            {certifications && certifications.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900 mb-2" style={accentTextStyle}>
                  Certifications
                </h2>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {certifications.map((cert) => (
                    <div key={cert.id}>
                      <div className="font-medium text-slate-800">{cert.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {cert.issuer} • {cert.date}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Main Column */}
          <div className={`md:col-span-2 ${densityClass}`}>
            {summary && (
              <section>
                <h2 className="text-xs uppercase tracking-wider font-bold mb-1.5" style={accentTextStyle}>
                  Professional Summary
                </h2>
                <p className="text-xs leading-relaxed text-slate-700">{summary}</p>
              </section>
            )}

            {/* Experience */}
            {experience && experience.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider font-bold mb-2 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                  Experience
                </h2>
                <div className="space-y-3.5">
                  {experience.map((exp) => (
                    <div key={exp.id}>
                      <div className="flex justify-between items-baseline">
                        <div className="font-semibold text-xs text-slate-900">{exp.role}</div>
                        <div className="text-[11px] font-medium text-slate-500">
                          {exp.startDate} – {exp.endDate}
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 font-medium mb-1">{exp.company}</div>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {(exp.bullets || []).map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-1.5">
                            <span className="text-slate-400 select-none">{bulletSymbol}</span>
                            <span className="leading-snug">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Projects */}
            {projects && projects.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider font-bold mb-2 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                  Key Projects
                </h2>
                <div className="space-y-3">
                  {projects.map((proj) => (
                    <div key={proj.id}>
                      <div className="flex justify-between items-baseline">
                        <div className="font-semibold text-xs text-slate-900">{proj.title}</div>
                        {proj.link && (
                          <a href={proj.link} target="_blank" rel="noreferrer" className="text-[11px] text-sky-600 hover:underline">
                            View Project
                          </a>
                        )}
                      </div>
                      {proj.technologies && proj.technologies.length > 0 && (
                        <div className="text-[11px] text-slate-500 mb-1">
                          Stack: {proj.technologies.join(', ')}
                        </div>
                      )}
                      <ul className="space-y-1 text-xs text-slate-700">
                        {(proj.bullets || []).map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-1.5">
                            <span className="text-slate-400 select-none">{bulletSymbol}</span>
                            <span className="leading-snug">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      ) : (
        /* Standard Single-Column Layout (ATS Safe Default) */
        <div className={densityClass}>
          {/* Summary */}
          {summary && (
            <section>
              <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Professional Summary</h2>
              </div>
              <p className="text-xs leading-relaxed text-slate-700">{summary}</p>
            </section>
          )}

          {/* Technical Skills */}
          {skills && skills.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Technical Skills</h2>
              </div>
              <div className="space-y-1 text-xs text-slate-700">
                {skills.map((group, idx) => (
                  <div key={idx}>
                    <span className="font-semibold text-slate-900">{group.category}: </span>
                    <span className="text-slate-700">{(group.items || []).join(', ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {experience && experience.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Professional Experience</h2>
              </div>
              <div className="space-y-4">
                {experience.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex justify-between items-baseline">
                      <div className="font-bold text-xs text-slate-900">
                        {exp.role} <span className="font-normal text-slate-600">| {exp.company}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600">
                        {exp.startDate} – {exp.endDate}
                      </div>
                    </div>
                    {exp.location && <div className="text-[11px] text-slate-500 mb-1">{exp.location}</div>}
                    <ul className="space-y-1.5 mt-1 text-xs text-slate-700">
                      {(exp.bullets || []).map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2">
                          <span className="text-slate-400 select-none font-bold">{bulletSymbol}</span>
                          <span className="leading-snug">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    {exp.technologies && exp.technologies.length > 0 && (
                      <div className="text-[11px] text-slate-500 mt-1 pl-4">
                        <span className="font-medium">Technologies:</span> {exp.technologies.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Key Projects */}
          {projects && projects.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Key Technical Projects</h2>
              </div>
              <div className="space-y-3">
                {projects.map((proj) => (
                  <div key={proj.id}>
                    <div className="flex justify-between items-baseline">
                      <div className="font-bold text-xs text-slate-900">
                        {proj.title}
                        {proj.technologies && proj.technologies.length > 0 && (
                          <span className="font-normal text-slate-500 text-[11px]"> ({proj.technologies.join(', ')})</span>
                        )}
                      </div>
                      {proj.link && (
                        <a href={proj.link} target="_blank" rel="noreferrer" className="text-[11px] text-sky-600 hover:underline">
                          Repository / Link
                        </a>
                      )}
                    </div>
                    <ul className="space-y-1 mt-1 text-xs text-slate-700">
                      {(proj.bullets || []).map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2">
                          <span className="text-slate-400 select-none font-bold">{bulletSymbol}</span>
                          <span className="leading-snug">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {education && education.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Education</h2>
              </div>
              <div className="space-y-2">
                {education.map((edu) => (
                  <div key={edu.id} className="flex justify-between items-baseline text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{edu.degree}</span> –{' '}
                      <span className="text-slate-700">{edu.institution}</span>
                      {edu.gpa && <span className="text-slate-500 text-[11px]"> (GPA: {edu.gpa})</span>}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600">
                      {edu.startDate} – {edu.endDate}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certifications */}
          {certifications && certifications.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Certifications & Licenses</h2>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
                {certifications.map((cert) => (
                  <div key={cert.id}>
                    <span className="font-semibold text-slate-900">{cert.name}</span>{' '}
                    <span className="text-slate-500">({cert.issuer} • {cert.date})</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Achievements */}
          {achievements && achievements.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-slate-200" style={headingDividerStyle}>
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-900">Key Honors & Achievements</h2>
              </div>
              <ul className="space-y-1 text-xs text-slate-700">
                {achievements.map((ach) => (
                  <li key={ach.id} className="flex items-start gap-2">
                    <span className="text-slate-400 select-none font-bold">{bulletSymbol}</span>
                    <span>
                      <strong className="text-slate-900">{ach.title}:</strong> {ach.description}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
