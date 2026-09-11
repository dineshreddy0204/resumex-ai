import React from 'react';
import {
  ShieldCheck,
  Briefcase,
  Sparkles,
  TrendingUp,
  FileText,
  GitCompare,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cpu,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onTryDemo: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onTryDemo }) => {
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#171713] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#EAE8E1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 rounded-lg bg-[#4F5D2F] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
              RX
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#171713]">ResumeX AI</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#C49A3A]/15 text-[#8E6D24] border border-[#C49A3A]/30">
                Core Ultra
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-[#6E6E63]">
            <a href="#features" className="hover:text-[#171713] transition">
              ATS Engines
            </a>
            <a href="#truth-engine" className="hover:text-[#171713] transition">
              Fact Verification
            </a>
            <a href="#templates" className="hover:text-[#171713] transition">
              100+ Templates
            </a>
            <a href="#security" className="hover:text-[#171713] transition">
              Security
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="try-demo-nav-btn"
              onClick={onTryDemo}
              className="px-3 py-1.5 rounded-lg border border-[#C49A3A]/40 bg-[#FAF9F5] text-[#8E6D24] text-xs font-semibold hover:bg-[#F3EEDF] transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C49A3A]" />
              Try Demo Sandbox
            </button>
            <button
              id="signin-nav-btn"
              onClick={() => onOpenAuth('login')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#171713] hover:text-[#4F5D2F] transition"
            >
              Sign In
            </button>
            <button
              id="get-started-nav-btn"
              onClick={() => onOpenAuth('signup')}
              className="px-4 py-1.5 rounded-lg bg-[#4F5D2F] text-white text-xs font-semibold hover:bg-[#37421F] transition shadow-xs"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Next-Generation Career & ATS Intelligence Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#171713] tracking-tight leading-[1.12]">
            The Resume Intelligence System Built for Serious Careers
          </h1>

          <p className="text-base sm:text-lg text-[#6E6E63] max-w-2xl mx-auto leading-relaxed">
            Simulate real enterprise ATS parsing engines (Workday, Greenhouse, Lever), run verified hallucination-free optimizations, and calculate precision job matches without guesswork.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              id="hero-get-started-btn"
              onClick={() => onOpenAuth('signup')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#4F5D2F] text-white text-sm font-semibold hover:bg-[#37421F] transition flex items-center justify-center gap-2 shadow-sm"
            >
              Analyze Your Resume Free
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              id="hero-demo-btn"
              onClick={onTryDemo}
              className="w-full sm:w-auto px-6 py-3 rounded-lg border border-[#D5D2C7] bg-white text-[#171713] text-sm font-semibold hover:bg-[#FAF9F5] transition flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#C49A3A]" />
              Explore Demo Candidate (Alex Rivera)
            </button>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#6E6E63]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />
              Zero Fabricated Metrics (ResumeTruth™)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />
              Workday & Greenhouse Simulators
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#4F5D2F]" />
              Relational PostgreSQL Architecture
            </span>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#171713] tracking-tight">
              A Complete Architectural Pipeline
            </h2>
            <p className="text-sm text-[#6E6E63] max-w-xl mx-auto">
              From document ingestion to knowledge graph extraction and vector similarity matching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#171713]">Real ATS Engine Simulation</h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                Test against realistic parsing profiles for Workday, Greenhouse, Lever, and Taleo. Identify tables, columns, graphics, or date formats that trigger recruiter drops.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F]">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#171713]">Semantic Job Matching</h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                N-gram vectorization and cosine similarity evaluate your resume against real job descriptions. Uncover exact keyword gaps and hidden qualification criteria.
              </p>
            </div>

            {/* Feature 3 */}
            <div id="truth-engine" className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#C49A3A]">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#171713]">ResumeTruth™ Verification</h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                Blocks AI hallucination. The engine rejects unverified metrics, degrees, and technologies, ensuring you never present exaggerated claims during interviews.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#171713]">Career Gap Diagnostic</h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                Analyze chronological pauses, skill deficits, and seniority transitions. Generates structured 30-60-90 day bridge strategies to qualify for next-level promotions.
              </p>
            </div>

            {/* Feature 5 */}
            <div id="templates" className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F]">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#171713]">100+ Professional Templates</h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                Curated layouts across Engineering, Product, Executive, Finance, and Research archetypes. Guaranteed strict ATS single-column compliance.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-xl border border-[#EAE8E1] p-6 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] flex items-center justify-center text-[#4F5D2F]">
                <GitCompare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#171713]">A/B Version Comparison</h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                Branch different versions tailored for specific roles. Compare word diffs, ATS deltas, and keyword coverage side-by-side before submitting applications.
              </p>
            </div>
          </div>
        </section>

        {/* Security Banner */}
        <section id="security" className="py-12 bg-white border-y border-[#EAE8E1]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#4F5D2F]" />
                <h3 className="text-base font-bold text-[#171713]">Hardened Security & Isolated Architecture</h3>
              </div>
              <p className="text-xs text-[#6E6E63] max-w-xl">
                Bcrypt password hashing (12 rounds), HMAC-SHA256 authenticated tokens, durable PostgreSQL relational schema, and complete tenant isolation.
              </p>
            </div>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-4 py-2 rounded-lg bg-[#4F5D2F] text-white text-xs font-semibold hover:bg-[#37421F] transition shrink-0"
            >
              Create Secure Account
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#EAE8E1] py-8 text-xs text-[#6E6E63]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#4F5D2F] flex items-center justify-center text-white font-bold text-[10px]">
              RX
            </div>
            <span className="font-semibold text-[#171713]">ResumeX AI — Core Ultra</span>
            <span>• © {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#8E6D24] bg-[#C49A3A]/10 px-2 py-0.5 rounded text-[11px] font-semibold border border-[#C49A3A]/20">
              Enterprise Ready 9.9
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
