import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Cpu,
  CheckCircle2,
  Play,
  Award,
  BarChart2,
  FileCode2,
  RefreshCw,
} from 'lucide-react';

export const NlpEvaluationView: React.FC = () => {
  const [benchmarkReport, setBenchmarkReport] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    runBenchmark();
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    try {
      const res = await api.runEvaluation();
      setBenchmarkReport(res.report);
    } catch (err) {
      console.error('Benchmark execution failed:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE8E1]">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[#4F5D2F]" />
            <h1 className="text-2xl font-bold text-[#171713] tracking-tight">
              NLP Accuracy & Model Benchmarks
            </h1>
          </div>
          <p className="text-xs text-[#6E6E63] mt-1">
            Automated regression and ground-truth validation suite testing Precision, Recall, and F1 extraction rates.
          </p>
        </div>

        <button
          onClick={runBenchmark}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#37421F] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'Evaluating Corpus...' : 'Execute Benchmark'}</span>
        </button>
      </div>

      {running && (
        <div className="text-center py-16 text-xs text-[#6E6E63]">
          Running NLP extraction against labeled test corpora...
        </div>
      )}

      {benchmarkReport && !running && (
        <div className="space-y-6">
          {/* Top Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Skill Extraction F1</div>
              <div className="text-3xl font-black text-[#4F5D2F] mt-1">
                {(benchmarkReport.skillExtractionF1 * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Target ≥ 90.0% threshold</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Section Header Accuracy</div>
              <div className="text-3xl font-black text-[#171713] mt-1">
                {(benchmarkReport.sectionDetectionAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Multi-alias taxonomy matching</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Verb Tiering Accuracy</div>
              <div className="text-3xl font-black text-[#8E6D24] mt-1">
                {(benchmarkReport.verbTieringAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Strong vs weak leadership verbs</div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#EAE8E1] shadow-xs">
              <div className="text-xs font-medium text-[#6E6E63]">Metrics Detection Rate</div>
              <div className="text-3xl font-black text-[#4F5D2F] mt-1">
                {(benchmarkReport.metricQuantificationAccuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-[#6E6E63] mt-1">Percentages, currency, scales</div>
            </div>
          </div>

          {/* Test Samples Table */}
          <div className="p-6 rounded-xl bg-white border border-[#EAE8E1] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-[#4F5D2F]" />
              <h3 className="text-sm font-bold text-[#171713] uppercase tracking-wider">
                Ground-Truth Labeled Test Corpus ({benchmarkReport.testSamples.length} Samples)
              </h3>
            </div>

            <div className="space-y-3">
              {benchmarkReport.testSamples.map((sample: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] space-y-2 text-xs shadow-2xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#171713]">{sample.name}</span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-[#4F5D2F]/10 text-[#4F5D2F] border border-[#4F5D2F]/20 font-semibold">
                      F1 Score: {(sample.f1 * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
                    <div>
                      <span className="text-[#6E6E63] font-semibold">Expected Ground Truth:</span>
                      <div className="text-[#171713] mt-0.5">{sample.groundTruthSkills.join(', ')}</div>
                    </div>
                    <div>
                      <span className="text-[#6E6E63] font-semibold">System Extracted:</span>
                      <div className="text-[#4F5D2F] font-medium mt-0.5">{sample.extractedSkills.join(', ')}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-[#6E6E63] pt-2 border-t border-[#EAE8E1]">
                    <span>Precision: {(sample.precision * 100).toFixed(1)}%</span>
                    <span>Recall: {(sample.recall * 100).toFixed(1)}%</span>
                    <span>Latency: {sample.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
