import React, { useState, useEffect } from 'react';
import type { ResumeDocument, JobDescriptionModel, JobMatchResult } from '../../types';
import { api } from '../../services/api';
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Building,
  Target,
  AlertTriangle,
} from 'lucide-react';

interface JobMatchingViewProps {
  resume: ResumeDocument | null;
  onNavigate: (tab: string) => void;
}

const PRESET_JOBS = [
  {
    title: 'Senior Full-Stack Engineer',
    company: 'Stripe',
    text: `About the Role:
Stripe is looking for a Senior Full-Stack Engineer to scale our global billing infrastructure.
Requirements:
- 5+ years of experience with TypeScript, React, and Node.js
- Strong proficiency in PostgreSQL, Redis, and distributed systems
- Deep experience with AWS, Docker, Kubernetes, and CI/CD pipelines
- Proven track record designing high-throughput REST APIs and microservices
- Bachelor's degree in Computer Science or equivalent practical experience
Nice to have:
- Experience with GraphQL, Terraform, and event-driven architecture with Kafka
- Contributions to open-source developer tooling`,
  },
  {
    title: 'Staff Cloud Solutions Architect',
    company: 'Google Cloud Platform',
    text: `About the Role:
Design enterprise-grade distributed cloud infrastructures for Fortune 500 customers.
Requirements:
- 8+ years experience in cloud infrastructure, Kubernetes, and Terraform
- Expertise in AWS, GCP, or Azure multi-region high availability architectures
- Deep understanding of Linux internals, Prometheus, Grafana, and observability
- Strong background in Python or Go for automation tooling
Nice to have:
- Certifications in Google Cloud Professional Cloud Architect or AWS Solutions Architect
- Experience with zero-trust networking and SOC2 compliance`,
  },
  {
    title: 'Senior Machine Learning Engineer',
    company: 'OpenAI Ecosystem Partner',
    text: `About the Role:
Deploy state-of-the-art Generative AI and retrieval-augmented generation systems.
Requirements:
- 4+ years building production ML systems using Python, PyTorch, and FastAPI
- Hands-on experience with LLMs, NLP, and Vector Databases (Pinecone, Chroma, pgvector)
- Experience containerizing models with Docker and orchestrating on Kubernetes
Nice to have:
- Experience fine-tuning models with PEFT/LoRA
- Experience with Apache Spark and Airflow pipelines`,
  },
];

export const JobMatchingView: React.FC<JobMatchingViewProps> = ({ resume, onNavigate }) => {
  const [jobs, setJobs] = useState<JobDescriptionModel[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [newJobText, setNewJobText] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobCompany, setNewJobCompany] = useState('');
  const [showAddJob, setShowAddJob] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const list = await api.getJobs();
      setJobs(list);
      if (list.length > 0 && !selectedJobId) {
        setSelectedJobId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const handleCreateJob = async () => {
    if (!newJobText.trim()) return;
    setErrorNotice(null);
    try {
      const res = await api.createJob(newJobText, newJobTitle, newJobCompany);
      setJobs([res.job, ...jobs]);
      setSelectedJobId(res.job.id);
      setNewJobText('');
      setNewJobTitle('');
      setNewJobCompany('');
      setShowAddJob(false);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to parse and save job posting.');
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_JOBS[0]) => {
    setNewJobTitle(preset.title);
    setNewJobCompany(preset.company);
    setNewJobText(preset.text);
    setShowAddJob(true);
  };

  const handleRunMatch = async () => {
    if (!resume || !selectedJobId) return;
    setLoadingMatch(true);
    setErrorNotice(null);
    try {
      const res = await api.matchJob(selectedJobId, resume.id);
      setMatchResult(res.match);
    } catch (err: any) {
      setErrorNotice(err.message || 'Match calculation failed.');
    } finally {
      setLoadingMatch(false);
    }
  };

  if (!resume) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-[#EAE8E1] p-8 max-w-lg mx-auto shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] mx-auto mb-4">
          <Briefcase className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#171713]">No Resume Selected for Job Matching</h3>
        <p className="text-xs text-[#6E6E63] mt-1.5 leading-relaxed">
          Select an active resume to evaluate vector cosine similarity against target job descriptions.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-5 px-4 py-2 bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold rounded-lg transition shadow-xs"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const activeJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">Job Matching & Semantic Alignment</h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Deterministic N-gram extraction and vector similarity cross-referencing against target job postings.
          </p>
        </div>
        <button
          onClick={() => setShowAddJob(!showAddJob)}
          className="px-3.5 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddJob ? 'Close Form' : 'Add Target Job'}</span>
        </button>
      </div>

      {errorNotice && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Add Job Form */}
      {showAddJob && (
        <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#171713]">Paste Job Posting Description</h3>
            <span className="text-xs text-[#6E6E63]">Extracts required vs preferred qualifications</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs text-[#6E6E63] font-medium mr-1">Load Preset Archetype:</span>
            {PRESET_JOBS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(preset)}
                className="px-2.5 py-1 rounded-md text-xs bg-[#FAF9F5] hover:bg-white text-[#171713] border border-[#D5D2C7] transition shadow-2xs font-medium"
              >
                {preset.title} ({preset.company})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Job Title (e.g. Senior Backend Engineer)"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
            />
            <input
              type="text"
              placeholder="Company Name (e.g. Stripe, Airbnb)"
              value={newJobCompany}
              onChange={(e) => setNewJobCompany(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
            />
          </div>

          <textarea
            rows={7}
            placeholder="Paste full job description text here..."
            value={newJobText}
            onChange={(e) => setNewJobText(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-[#FAF9F5] border border-[#D5D2C7] rounded-lg text-[#171713] focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddJob(false)}
              className="px-3.5 py-2 rounded-lg text-xs text-[#6E6E63] hover:text-[#171713]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateJob}
              disabled={!newJobText.trim()}
              className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
            >
              Parse & Save Job Model
            </button>
          </div>
        </div>
      )}

      {/* Target Job Selector Bar */}
      <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F] shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#6E6E63] uppercase tracking-wider">Target Job Posting</div>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="mt-1 bg-[#FAF9F5] border border-[#D5D2C7] text-[#171713] text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#4F5D2F]"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company} ({j.experienceYearsRequired}+ yrs, {j.seniorityLevel})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleRunMatch}
          disabled={loadingMatch || !selectedJobId}
          className="px-5 py-2.5 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-[#C49A3A]" />
          <span>{loadingMatch ? 'Computing Vector Match...' : 'Calculate Job Match'}</span>
        </button>
      </div>

      {/* Active Job Details Badge */}
      {activeJob && (
        <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#EAE8E1] flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-[#6E6E63]">Required Experience: </span>
            <strong className="text-[#171713]">{activeJob.experienceYearsRequired}+ years</strong>
          </div>
          <div>
            <span className="text-[#6E6E63]">Seniority Level: </span>
            <strong className="text-[#171713] capitalize">{activeJob.seniorityLevel}</strong>
          </div>
          <div>
            <span className="text-[#6E6E63]">Key Required Skills ({(activeJob.requiredSkills || []).length}): </span>
            <span className="text-[#171713] font-medium">{(activeJob.requiredSkills || []).join(', ')}</span>
          </div>
        </div>
      )}

      {/* Match Results Display */}
      {matchResult && (
        <div className="space-y-6">
          {/* Main Match KPI Card */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-20 h-20 rounded-xl flex items-center justify-center font-black text-3xl border shadow-2xs ${
                  matchResult.overallMatch >= 80
                    ? 'text-[#4F5D2F] bg-[#4F5D2F]/10 border-[#4F5D2F]/30'
                    : matchResult.overallMatch >= 65
                    ? 'text-[#8E6D24] bg-[#C49A3A]/15 border-[#C49A3A]/30'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}
              >
                {matchResult.overallMatch}%
              </div>
              <div>
                <h3 className="text-base font-bold text-[#171713]">Overall Job Fit Assessment</h3>
                <p className="text-xs text-[#6E6E63] mt-1">{matchResult.experienceAlignmentNote}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center w-full sm:w-auto">
              <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] min-w-[90px]">
                <div className="text-[10px] text-[#6E6E63] uppercase font-semibold">Skill Match</div>
                <div className="text-base font-bold text-[#4F5D2F] mt-0.5">{matchResult.skillMatch}%</div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] min-w-[90px]">
                <div className="text-[10px] text-[#6E6E63] uppercase font-semibold">Semantic</div>
                <div className="text-base font-bold text-[#171713] mt-0.5">{matchResult.semanticMatch}%</div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] min-w-[90px]">
                <div className="text-[10px] text-[#6E6E63] uppercase font-semibold">Keyword</div>
                <div className="text-base font-bold text-[#8E6D24] mt-0.5">{matchResult.keywordMatch}%</div>
              </div>
            </div>
          </div>

          {/* Matched vs Missing Skills Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Matched Skills with Evidence */}
            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Matched Skills & Document Evidence ({(matchResult.matchedSkills || []).length})
                </h3>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {(matchResult.matchedSkills || []).map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#4F5D2F]">{m.skill}</span>
                      <span className="text-[10px] text-[#6E6E63] font-mono">
                        {Math.round(m.confidence * 100)}% match confidence
                      </span>
                    </div>
                    <div className="text-[#6E6E63] text-[11px] leading-snug pl-2 border-l border-[#4F5D2F]/30">
                      {m.evidenceInResume}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Skills by Priority */}
            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C49A3A]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Missing Skills & Gaps ({(matchResult.missingSkills || []).length})
                </h3>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(matchResult.missingSkills || []).length === 0 ? (
                  <div className="text-xs text-[#4F5D2F] p-4 bg-[#4F5D2F]/10 rounded-lg border border-[#4F5D2F]/20 font-semibold">
                    100% of target job skill requirements are present in your resume!
                  </div>
                ) : (
                  (matchResult.missingSkills || []).map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#171713]">{m.skill}</div>
                        <div className="text-[11px] text-[#6E6E63]">{m.category || 'Skill Requirement'}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.priority === 'High'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30'
                        }`}
                      >
                        {m.priority} Priority
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actionable Tailoring Recommendations */}
          {matchResult.recommendations && matchResult.recommendations.length > 0 && (
            <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                  Strategic Alignment Recommendations
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-[#6E6E63]">
                {matchResult.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#4F5D2F] font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
