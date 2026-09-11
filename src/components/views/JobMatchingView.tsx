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
    try {
      const res = await api.createJob(newJobText, newJobTitle, newJobCompany);
      setJobs([res.job, ...jobs]);
      setSelectedJobId(res.job.id);
      setNewJobText('');
      setNewJobTitle('');
      setNewJobCompany('');
      setShowAddJob(false);
    } catch (err) {
      alert('Failed to parse and save job description.');
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
    try {
      const res = await api.matchJob(selectedJobId, resume.id);
      setMatchResult(res.match);
    } catch (err) {
      console.error('Match failed:', err);
    } finally {
      setLoadingMatch(false);
    }
  };

  if (!resume) {
    return (
      <div className="text-center py-20 bg-slate-900 rounded-xl border border-slate-800">
        <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-200">No Resume Selected for Job Matching</h3>
        <p className="text-xs text-slate-400 mt-1">Select an active resume to evaluate against target job descriptions.</p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Job Matching & Semantic Alignment</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic and semantic cross-referencing between your resume and real target job requirements.
          </p>
        </div>
        <button
          onClick={() => setShowAddJob(!showAddJob)}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddJob ? 'Close Form' : 'Add Target Job'}</span>
        </button>
      </div>

      {/* Add Job Form */}
      {showAddJob && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Paste Job Posting Text</h3>
            <span className="text-xs text-slate-400">Quickly loads required vs preferred skill weights</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-slate-400 self-center mr-1">Load Preset:</span>
            {PRESET_JOBS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(preset)}
                className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
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
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Company Name (e.g. Airbnb)"
              value={newJobCompany}
              onChange={(e) => setNewJobCompany(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <textarea
            rows={7}
            placeholder="Paste full job description text here..."
            value={newJobText}
            onChange={(e) => setNewJobText(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddJob(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateJob}
              disabled={!newJobText.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition"
            >
              Parse & Save Job
            </button>
          </div>
        </div>
      )}

      {/* Target Job Selector Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building className="w-5 h-5 text-slate-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Job Posting</div>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="mt-0.5 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
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
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-indigo-200" />
          <span>{loadingMatch ? 'Analyzing Match...' : 'Calculate Job Match'}</span>
        </button>
      </div>

      {/* Active Job Details Badge */}
      {activeJob && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-slate-400">Required Experience: </span>
            <strong className="text-slate-200">{activeJob.experienceYearsRequired}+ years</strong>
          </div>
          <div>
            <span className="text-slate-400">Seniority Level: </span>
            <strong className="text-slate-200">{activeJob.seniorityLevel}</strong>
          </div>
          <div>
            <span className="text-slate-400">Required Skills ({activeJob.requiredSkills.length}): </span>
            <span className="text-slate-300">{activeJob.requiredSkills.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Match Results Display */}
      {matchResult && (
        <div className="space-y-6">
          {/* Main Match KPI Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 border border-indigo-900/50 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl border shadow-inner ${
                  matchResult.overallMatch >= 80
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : matchResult.overallMatch >= 65
                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                }`}
              >
                {matchResult.overallMatch}%
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Overall Job Match</h3>
                <p className="text-xs text-slate-300 mt-1">{matchResult.experienceAlignmentNote}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Skill Match</div>
                <div className="text-base font-bold text-emerald-400">{matchResult.skillMatch}%</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Semantic</div>
                <div className="text-base font-bold text-indigo-400">{matchResult.semanticMatch}%</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">Keyword</div>
                <div className="text-base font-bold text-sky-400">{matchResult.keywordMatch}%</div>
              </div>
            </div>
          </div>

          {/* Matched vs Missing Skills Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Matched Skills with Evidence */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Matched Skills & Resume Evidence ({matchResult.matchedSkills.length})
                </h3>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {matchResult.matchedSkills.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-400">{m.skill}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {Math.round(m.confidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] leading-snug pl-2 border-l border-emerald-500/30">
                      {m.evidenceInResume}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Skills by Priority */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Missing Skills & Requirements ({matchResult.missingSkills.length})
                </h3>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {matchResult.missingSkills.length === 0 ? (
                  <div className="text-xs text-emerald-400 p-4 bg-emerald-500/10 rounded-lg">
                    100% of target job skill requirements are represented in your resume!
                  </div>
                ) : (
                  matchResult.missingSkills.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{m.skill}</div>
                        <div className="text-[11px] text-slate-500">{m.category || 'Skill'}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.priority === 'High'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Strategic Alignment Recommendations
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {matchResult.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">•</span>
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
