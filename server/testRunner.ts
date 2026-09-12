import { nlpEvaluation } from './services/nlpEvaluation';
import { documentParser } from './services/documentParser';
import { resumeExtractor } from './services/resumeExtractor';
import { atsAnalyzer } from './services/atsAnalyzer';
import { exportEngine } from './services/exportEngine';
import { resumeTruthEngine } from './services/resumeTruthEngine';
import type { ResumeData } from './types';

async function runTests() {
  console.log('==========================================');
  console.log('   ResumeX AI — Automated Test Suite     ');
  console.log('==========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (details) console.error(`    Details: ${details}`);
      failed++;
    }
  }

  // --- Test Suite 1: Document Parser & Normalization ---
  console.log('Test Suite 1: Document Parser Normalization & De-Columnization');
  const sampleCorpus = `
Candidate: Jordan Lee
Email: jordan.lee@example.com | Phone: (555) 987-6543 | Location: San Francisco, CA

PROFESSIONAL EXPERIENCE
Senior Software Engineer                                      Acme Cloud Systems
Jan 2022 - Present                                            San Francisco, CA
* Architected distributed message queue reducing latency by 45% across 200 microservices.
* Led a cross-functional team of 6 engineers to launch Kubernetes platform.

EDUCATION
B.S. in Computer Science                                      Stanford University
2018 - 2022                                                   Stanford, CA

TECHNICAL SKILLS
Languages: Python, TypeScript, Go, SQL
Technologies: Docker, Kubernetes, PostgreSQL, AWS, React
`;

  const parsedDoc = await documentParser.parseDocument(Buffer.from(sampleCorpus), 'sample.txt');
  assert(parsedDoc.text.length > 50, 'Parsed text contains content');
  assert(parsedDoc.sections.length >= 3, 'Detected at least 3 standard sections');
  assert(!parsedDoc.layoutInfo.hasMultiColumnClues, 'Single-column text verified as single-column');

  // Multi-column sample de-columnization test
  const twoColSample = `Left Column Item 1          Right Column Item 1
Left Column Item 2          Right Column Item 2
Left Column Item 3          Right Column Item 3`;
  const deCol = documentParser.deColumnizeText(twoColSample);
  assert(deCol.text.includes('Left Column Item 1'), 'De-columnizer preserves left column contents');
  assert(deCol.text.includes('Right Column Item 1'), 'De-columnizer preserves right column contents');

  // --- Test Suite 2: Resume Extraction without Hallucination ---
  console.log('\nTest Suite 2: Resume Extraction (Zero Hardcoded Hallucinations)');
  const extracted = resumeExtractor.extractStructuredResume(parsedDoc);
  assert(extracted.data.personal_info.name.length > 0, 'Extracted candidate name');
  assert(extracted.data.personal_info.email.includes('@'), 'Extracted valid email address');
  assert(extracted.data.experience.length >= 1, 'Extracted experience role');
  assert(extracted.data.skills.length >= 1, 'Extracted skills category');
  assert(
    extracted.data.personal_info.name !== 'Candidate Name',
    'Did not fall back to hallucinated default name "Candidate Name"'
  );

  // --- Test Suite 3: 5-Engine ATS Compatibility Simulation ---
  console.log('\nTest Suite 3: 5 Corporate ATS Engine Simulations');
  const atsRes = atsAnalyzer.analyzeAtsCompatibility(extracted.data);
  assert(atsRes.overallAtsScore >= 50, 'Computed overall ATS score');
  assert(atsRes.engineSimulations !== undefined, 'Engine simulations array populated');
  assert(atsRes.engineSimulations?.length === 5, 'Contains simulations for all 5 enterprise ATS engines');

  const engineNames = atsRes.engineSimulations?.map((e) => e.engine) || [];
  assert(engineNames.includes('Workday'), 'Includes Workday ATS simulation');
  assert(engineNames.includes('Greenhouse'), 'Includes Greenhouse ATS simulation');
  assert(engineNames.includes('Taleo'), 'Includes Taleo ATS simulation');
  assert(engineNames.includes('Lever'), 'Includes Lever ATS simulation');
  assert(engineNames.includes('iCIMS'), 'Includes iCIMS ATS simulation');

  // --- Test Suite 4: Export Engine (DOCX & Plain Text) ---
  console.log('\nTest Suite 4: Export Engine Validation & File Generation');
  const validation = exportEngine.validateForExport(extracted.data);
  assert(validation.isValid, 'Pre-export validation passes for complete resume');
  assert(validation.checks.length >= 4, 'Includes required pre-export diagnostic checks');

  const plainTextExport = exportEngine.generatePlainText(extracted.data);
  assert(plainTextExport.includes('TECHNICAL SKILLS'), 'Plain-text export includes technical skills section');
  assert(plainTextExport.includes(extracted.data.personal_info.email), 'Plain-text export contains candidate contact');

  const docxBuffer = await exportEngine.generateDocx(extracted.data, 'ats-classic');
  assert(docxBuffer instanceof Buffer, 'Generated DOCX as a binary Buffer');
  assert(docxBuffer.length > 1000, `DOCX buffer contains valid file size (${docxBuffer.length} bytes)`);

  // --- Test Suite 5: ResumeTruth Anti-Hallucination Engine ---
  console.log('\nTest Suite 5: ResumeTruth Anti-Hallucination Verification');
  const safeRewrite = resumeTruthEngine.verifyRewrite(
    'Assisted with Python backend services.',
    'Engineered robust Python backend services with microservice architecture.',
    extracted.data
  );
  assert(safeRewrite.isCompliant, 'Allows legitimate structural impact rewrites using verified skills');

  const hallucinatedRewrite = resumeTruthEngine.verifyRewrite(
    'Assisted with database queries.',
    'Managed $50M revenue budget and increased sales by 850%.',
    extracted.data
  );
  assert(
    !hallucinatedRewrite.isCompliant && hallucinatedRewrite.violations.some((v) => v.type === 'fabricated_metric'),
    'Flags unverified invented budget and percentage metrics as fabricated_metric violations'
  );

  // --- Test Suite 6: NLP Evaluation Benchmark Suite ---
  console.log('\nTest Suite 6: NLP Evaluation Suite Benchmarking');
  const evalReport = nlpEvaluation.runEvaluationSuite();
  assert(evalReport.overallF1 >= 80, `NLP benchmark F1 score meets production threshold (${evalReport.overallF1}%)`);
  assert(evalReport.metrics.length === 4, 'Evaluated all 4 NLP metric dimensions');

  console.log('\n==========================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('==========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
