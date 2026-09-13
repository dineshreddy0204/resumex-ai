import React, { useState, useEffect } from 'react';
import type { ResumeDocument, CareerGapAnalysis } from '../../types';
import { api } from '../../services/api';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Code2,
  ArrowRight,
  ShieldAlert,
  GitPullRequest,
  BookOpen,
  Calendar,
  Compass,
  Check,
  ShieldCheck,
  Briefcase,
  Layers,
  Clock,
} from 'lucide-react';

interface CareerGapViewProps {
  resume: ResumeDocument | null;
  onNavigate: (tab: string) => void;
}

const TARGET_ROLES = [
  'Senior Full-Stack Engineer',
  'Staff / Principal Engineer',
  'Cloud / DevOps Architect',
  'Machine Learning / AI Engineer',
  'Data Platform Engineer',
  'Engineering Manager',
];

const SENIORITY_LEVELS = [
  'Mid-Level (3-5 Years)',
  'Senior (5-8 Years)',
  'Staff / Lead (8-12 Years)',
  'Principal / Director (12+ Years)',
];

const TARGET_INDUSTRIES = [
  'Fintech & Financial Infrastructure',
  'Enterprise SaaS & Cloud Platforms',
  'Healthtech & Bio-Informatics',
  'E-Commerce & High-Frequency Logistics',
  'AI / Machine Learning Systems',
];

export const CareerGapView: React.FC<CareerGapViewProps> = ({ resume, onNavigate }) => {
  const [selectedRole, setSelectedRole] = useState<string>(TARGET_ROLES[0]);
  const [selectedSeniority, setSelectedSeniority] = useState<string>(SENIORITY_LEVELS[1]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>(TARGET_INDUSTRIES[1]);
  const [activeGapTab, setActiveGapTab] = useState<'skills' | 'timeline' | 'leadership' | 'metrics' | 'certs'>('skills');
  const [gapAnalysis, setGapAnalysis] = useState<CareerGapAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resume) {
      loadCareerGap(selectedRole);
    }
  }, [resume, selectedRole, selectedSeniority, selectedIndustry]);

  const loadCareerGap = async (role: string) => {
    if (!resume) return;
    setLoading(true);
    try {
      const res = await api.analyzeCareerGap(resume.id, role);
      setGapAnalysis(res.careerGap);
    } catch (err) {
      console.error('Failed to load career gap:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!resume) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-[#EAE8E1] p-8 max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] mx-auto mb-4">
          <TrendingUp className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#171713]">No Resume Selected</h3>
        <p className="text-xs text-[#6E6E63] mt-1.5 leading-relaxed">
          Please select an active resume to run a career gap diagnostic and skill bridge roadmap.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-5 px-4 py-2 bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold rounded-lg transition shadow-xs"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Curated Open Source Opportunities for career level progression
  const openSourceOpportunities = [
    {
      project: 'Apache Kafka / Redpanda Ecosystem',
      focus: 'High-throughput stream processing & consumer client benchmarking',
      seniorityTarget: 'Senior / Staff Engineer',
      action: 'Contribute consumer group rebalance fixes or benchmark documentation to prove distributed systems fluency.',
    },
    {
      project: 'Kubernetes Operators / CNCF Projects',
      focus: 'Custom resource controllers, CRD validation, and operator reconciliation loops',
      seniorityTarget: 'Cloud / DevOps Architect',
      action: 'Implement a sample Go operator or helm chart test harness and link the merged PR on your resume.',
    },
    {
      project: 'LangChain / LlamaIndex Core',
      focus: 'RAG retrieval evaluation harnesses and vector index connector extensions',
      seniorityTarget: 'Machine Learning / AI Engineer',
      action: 'Author a custom chunking strategy or reranking integration, creating verifiable GitHub contribution proof.',
    },
  ];

  // Tailored 30-60-90 Day Skill Bridge Roadmap
  const roadmapSteps = [
    {
      phase: '30 Days',
      title: 'Foundational Bridge & Evidence Hardening',
      focus: 'Close syntax & tool gaps while extracting dormant production achievements.',
      milestones: [
        'Perform a comprehensive audit of past projects to identify unmentioned tools and technologies.',
        'Refactor resume bullet points to front-load high-impact action verbs and quantified architectural outcomes.',
        'Spin up a clean GitHub repository demonstrating clean TypeScript / Go architecture with automated CI/CD workflows.',
      ],
      deliverable: 'Audited, proof-aligned resume draft + 1 public code architecture repository.',
    },
    {
      phase: '60 Days',
      title: 'Distributed System / Architecture Delivery',
      focus: 'Build high-credibility proof projects demonstrating target seniority scope.',
      milestones: [
        'Deploy a multi-service event-driven prototype using Redis Streams, Docker, and PostgreSQL.',
        'Write an in-depth technical post-mortem / design doc explaining trade-offs, latency limits, and failure modes.',
        'Submit a pull request to a widely recognized open-source tool within your target stack.',
      ],
      deliverable: 'Live production URL + merged public contribution + published engineering design doc.',
    },
    {
      phase: '90 Days',
      title: 'Interview Ready & Strategic Positioning',
      focus: 'Targeted applications with verifiable evidence and executive interview framing.',
      milestones: [
        'Target 15-20 high-fit roles matching your demonstrated project strengths.',
        'Conduct mock system design interviews focusing on scaling bottlenecks, data consistency, and failover.',
        'Align LinkedIn and portfolio artifacts to reflect proven delivery across the complete target scope.',
      ],
      deliverable: 'Screening pass rates exceeding 65% across tier-1 target organizations.',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">Career Gap & Advancement Intelligence</h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Bridging qualifications to your target role through verifiable upskilling, strategic framing, and portfolio proof.
          </p>
        </div>

        {/* Target Role, Seniority, and Industry Pickers */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-[#EAE8E1] rounded-lg p-1 shadow-2xs">
            <span className="text-[11px] text-[#6E6E63] font-medium px-2">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-semibold rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
            >
              {TARGET_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-[#EAE8E1] rounded-lg p-1 shadow-2xs">
            <span className="text-[11px] text-[#6E6E63] font-medium px-2">Level:</span>
            <select
              value={selectedSeniority}
              onChange={(e) => setSelectedSeniority(e.target.value)}
              className="bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-semibold rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
            >
              {SENIORITY_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-[#EAE8E1] rounded-lg p-1 shadow-2xs">
            <span className="text-[11px] text-[#6E6E63] font-medium px-2">Industry:</span>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-semibold rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
            >
              {TARGET_INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ethical Career Guidance Banner (Requirement 11) */}
      <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#4F5D2F]/30 text-xs flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-[#4F5D2F] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-[#171713]">Ethical Career Advancement & Truth Standard</div>
          <p className="text-[#6E6E63] leading-relaxed">
            ResumeX AI never advises candidates to fabricate credentials or claim unworked experience. Real hiring managers and technical loops quickly expose false claims. We focus strictly on <strong>real upskilling</strong>, <strong>rigorous framing of transferable responsibilities</strong>, and <strong>verifiable open-source/project evidence</strong>.
          </p>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-xs text-[#6E6E63]">
          Synthesizing {selectedRole} benchmarks for {selectedSeniority} in {selectedIndustry}...
        </div>
      )}

      {gapAnalysis && !loading && (
        <div className="space-y-6">
          {/* Top KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Strong Proven Competencies</div>
              <div className="text-2xl font-bold text-[#4F5D2F] mt-1">
                {(gapAnalysis.strongSkills || []).length} skills
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Backed by multi-bullet project proof</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Developing (Evidence Gaps)</div>
              <div className="text-2xl font-bold text-[#8E6D24] mt-1">
                {(gapAnalysis.developingSkills || []).length} skills
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Listed but lacking measurable delivery</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Missing Benchmark Skills</div>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {(gapAnalysis.missingSkills || []).length} skills
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Core requirements for target role</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Estimated Transition Time</div>
              <div className="text-2xl font-bold text-[#171713] mt-1">
                60 - 90 Days
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">With structured project delivery</div>
            </div>
          </div>

          {/* Gap Diagnostic Tabs */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE8E1] pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Target Role Qualification Diagnostics
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { id: 'skills', label: 'Missing Skills & Tools' },
                  { id: 'timeline', label: `Timeline Gaps (${gapAnalysis.employmentGaps?.length || 0})` },
                  { id: 'leadership', label: 'Leadership & Scope Gaps' },
                  { id: 'metrics', label: 'Metric Gaps' },
                  { id: 'certs', label: 'Certifications' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveGapTab(tab.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      activeGapTab === tab.id
                        ? 'bg-[#4F5D2F] text-white shadow-2xs'
                        : 'bg-[#FAF9F5] text-[#6E6E63] hover:text-[#171713] border border-[#EAE8E1]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-tab 1: Missing Skills & Tools */}
            {activeGapTab === 'skills' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {gapAnalysis.missingSkills.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs flex justify-between items-start gap-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-[#171713]">{m.skill}</div>
                      <div className="text-[11px] text-[#6E6E63]">{m.importanceReason}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        m.priority === 'High'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30'
                      }`}
                    >
                      {m.priority} Priority
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-tab: Timeline Gaps (>6mo) (Directive 14) */}
            {activeGapTab === 'timeline' && (
              <div className="space-y-4 pt-1">
                {(!gapAnalysis.employmentGaps || gapAnalysis.employmentGaps.length === 0) ? (
                  <div className="p-5 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs text-center space-y-1">
                    <div className="font-bold text-[#171713] flex items-center justify-center gap-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />
                      <span>No Employment Timeline Gaps (&gt; 6 Months) Detected</span>
                    </div>
                    <p className="text-[#6E6E63] max-w-xl mx-auto">
                      Your documented work experience shows continuous employment or brief transitions under 6 months. Standard automated screeners and recruiters flag gaps exceeding 6 months.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {gapAnalysis.employmentGaps.map((gap) => (
                      <div
                        key={gap.id}
                        className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-3 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE8E1] pb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#8E6D24]" />
                            <span className="font-bold text-[#171713] text-sm">
                              {gap.durationMonths} Months Career Interval
                            </span>
                            <span className="text-[#6E6E63] text-xs">
                              ({gap.startDate} — {gap.endDate})
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30">
                            {gap.previousCompany || 'Role'} → {gap.nextCompany || 'Next'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="font-semibold text-[#171713] text-[11px]">Reason & Recruiter Impact:</div>
                            <p className="text-[#6E6E63] text-xs leading-relaxed">{gap.impactAssessment}</p>
                          </div>
                          <div className="space-y-1">
                            <div className="font-semibold text-[#4F5D2F] text-[11px]">Constructive Framing:</div>
                            <p className="text-[#6E6E63] text-xs leading-relaxed">{gap.constructiveFraming}</p>
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-[#EAE8E1] space-y-1">
                          <div className="font-semibold text-[#171713] text-[11px]">Suggested Interview & Summary Phrasing:</div>
                          <p className="text-xs text-[#171713] italic leading-relaxed">
                            "{gap.suggestedPhrasing}"
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[11px] font-medium text-[#6E6E63]">Skills Maintained:</span>
                          {gap.skillsMaintainedOrDeveloped.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded bg-white border border-[#EAE8E1] text-[10px] font-semibold text-[#171713]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="p-2.5 rounded-lg bg-white border border-[#4F5D2F]/20 text-[11px] text-[#6E6E63] flex items-start gap-2">
                          <ShieldCheck className="w-4 h-4 text-[#4F5D2F] shrink-0 mt-0.5" />
                          <span>
                            <strong>Honest Positioning Standard:</strong> {gap.honestPositioningAdvice}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Leadership & Scope Gaps */}
            {activeGapTab === 'leadership' && (
              <div className="space-y-3 pt-1">
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-2">
                  <div className="font-bold text-[#171713] flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-[#4F5D2F]" />
                    <span>Architectural Ownership vs. Individual Task Execution</span>
                  </div>
                  <p className="text-[#6E6E63] leading-relaxed">
                    Senior roles require demonstrating that you defined requirements, chose technical trade-offs, and guided junior engineers, rather than merely picking up assigned JIRA tickets.
                  </p>
                  <div className="text-[#4F5D2F] font-semibold text-[11px]">
                    Recommended Framing: Update 2 bullets to describe how you mentored engineers, conducted architectural code reviews, or resolved technical ambiguity across teams.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-2">
                  <div className="font-bold text-[#171713] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#4F5D2F]" />
                    <span>Cross-Functional Stakeholder Alignment</span>
                  </div>
                  <p className="text-[#6E6E63] leading-relaxed">
                    At the {selectedSeniority} level in {selectedIndustry}, interviewers evaluate your ability to interface with Product, Compliance, and DevOps.
                  </p>
                  <div className="text-[#4F5D2F] font-semibold text-[11px]">
                    Recommended Framing: Highlight past cross-team collaborations, such as aligning security standards with infosec or negotiating API contracts with consumer frontend teams.
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Metric Gaps */}
            {activeGapTab === 'metrics' && (
              <div className="space-y-3 pt-1">
                {gapAnalysis.evidenceGaps.map((gap, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#171713]">{gap.skillOrRequirement}</span>
                      <span className="text-[10px] font-bold text-[#8E6D24] px-2 py-0.5 rounded bg-[#C49A3A]/15 border border-[#C49A3A]/30">
                        Evidence Gap
                      </span>
                    </div>
                    <div className="text-[#6E6E63]">{gap.issue}</div>
                    <div className="text-[#4F5D2F] font-semibold text-[11px]">
                      Action: {gap.recommendedAction}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-tab 4: Recommended Certifications */}
            {activeGapTab === 'certs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#171713]">AWS Certified Solutions Architect – Associate</span>
                    <span className="text-[10px] font-bold text-[#4F5D2F] px-2 py-0.5 rounded bg-[#4F5D2F]/10 border border-[#4F5D2F]/20">
                      High Impact
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6E6E63]">
                    Estimated Prep: 4-6 Weeks. Establishes instant cloud architecture credibility for hiring screening filters.
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#171713]">Certified Kubernetes Administrator (CKA)</span>
                    <span className="text-[10px] font-bold text-[#4F5D2F] px-2 py-0.5 rounded bg-[#4F5D2F]/10 border border-[#4F5D2F]/20">
                      High Impact
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6E6E63]">
                    Estimated Prep: 6-8 Weeks. Practical hands-on command of container orchestration, pods, ingress, and networking.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 30-60-90 Day Skill Bridge Roadmap (Requirement 11) */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#4F5D2F]" />
              <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                30-60-90 Day Skill Bridge Roadmap
              </h3>
            </div>
            <p className="text-xs text-[#6E6E63]">
              A realistic, step-by-step career transition plan designed to build genuine skills and verifiable artifacts.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {roadmapSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] space-y-3 text-xs flex flex-col justify-between shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#4F5D2F] px-2 py-0.5 rounded bg-[#4F5D2F]/10 border border-[#4F5D2F]/20">
                        {step.phase}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-[#171713]">{step.title}</div>
                    <p className="text-[#6E6E63] text-[11px]">{step.focus}</p>

                    <div className="space-y-1.5 pt-1">
                      {step.milestones.map((m, mIdx) => (
                        <div key={mIdx} className="flex items-start gap-1.5 text-[11px] text-[#171713]">
                          <Check className="w-3.5 h-3.5 text-[#4F5D2F] shrink-0 mt-0.5" />
                          <span>{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-[#EAE8E1] text-[11px] mt-2">
                    <strong className="text-[#171713]">Deliverable: </strong>
                    <span className="text-[#6E6E63]">{step.deliverable}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Practical Projects */}
          {gapAnalysis.actionPlan.recommendedProjects && (
            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Recommended Practical Projects to Bridge the Gap
                </h3>
              </div>
              <p className="text-xs text-[#6E6E63]">
                Building and deploying one of these architectures will create verifiable bullet evidence for your resume.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gapAnalysis.actionPlan.recommendedProjects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] space-y-2 text-xs shadow-2xs"
                  >
                    <div className="font-bold text-sm text-[#171713]">{proj.title}</div>
                    <p className="text-[#6E6E63] text-[11px] leading-relaxed">{proj.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.demonstratedSkills.map((s, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20 text-[10px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Open Source Contributions (Requirement 11) */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-[#4F5D2F]" />
              <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                Recommended Open-Source Proof Pathways
              </h3>
            </div>
            <p className="text-xs text-[#6E6E63]">
              Public pull requests and code reviews provide undeniable proof of production engineering capability.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {openSourceOpportunities.map((oss, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] space-y-2 text-xs shadow-2xs"
                >
                  <div className="font-bold text-sm text-[#171713]">{oss.project}</div>
                  <div className="text-[11px] text-[#4F5D2F] font-semibold">{oss.focus}</div>
                  <p className="text-[#6E6E63] text-[11px] leading-relaxed">{oss.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
