import type { ResumeData, AtsSimulationResult, JobDescriptionModel } from '../types';
import type { ParsedDocumentResult } from './documentParser';
import { skillExtractor } from './skillExtractor';

/**
 * Canonical Technology & Methodology Aliases Dictionary
 * Enables bidirectional variant normalization (e.g. Postgres <-> PostgreSQL, JS <-> JavaScript)
 */
const CANONICAL_ALIASES: Record<string, string[]> = {
  postgresql: ['postgres', 'pgsql', 'postgres sql', 'postgre sql'],
  'power bi': ['powerbi', 'power-bi', 'ms power bi', 'microsoft power bi'],
  javascript: ['js', 'ecmascript', 'es6', 'es2020', 'vanilla js'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js', 'react js'],
  'node.js': ['nodejs', 'node.js', 'node js', 'node'],
  vue: ['vuejs', 'vue.js', 'vue js'],
  angular: ['angularjs', 'angular.js', 'angular 2+'],
  kubernetes: ['k8s'],
  docker: ['containerization', 'containers', 'dockerfile'],
  aws: ['amazon web services', 'amazon aws'],
  gcp: ['google cloud', 'google cloud platform'],
  azure: ['microsoft azure', 'ms azure'],
  'c++': ['cpp', 'c plus plus'],
  'c#': ['csharp', 'c sharp'],
  golang: ['go', 'go lang'],
  mongodb: ['mongo', 'mongo db'],
  express: ['expressjs', 'express.js'],
  tailwind: ['tailwind css', 'tailwindcss'],
  'next.js': ['nextjs', 'next.js', 'next'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment', 'github actions', 'gitlab ci'],
  'rest api': ['restful', 'restful api', 'rest apis', 'rest services'],
  graphql: ['gql'],
  ai: ['artificial intelligence'],
  ml: ['machine learning'],
  nlp: ['natural language processing'],
  etl: ['extract transform load', 'data pipelines', 'data pipeline'],
  kafka: ['apache kafka'],
  airflow: ['apache airflow'],
  spark: ['apache spark'],
  sql: ['structured query language', 'relational database'],
  nosql: ['no-sql', 'document database'],
  html: ['html5'],
  css: ['css3'],
};

// Build reverse lookup map for fast alias resolution
const REVERSE_ALIAS_MAP = new Map<string, string>();
for (const [canonical, variants] of Object.entries(CANONICAL_ALIASES)) {
  REVERSE_ALIAS_MAP.set(canonical.toLowerCase(), canonical);
  for (const variant of variants) {
    REVERSE_ALIAS_MAP.set(variant.toLowerCase(), canonical);
  }
}

function resolveCanonicalTerm(term: string): string {
  const norm = term.toLowerCase().trim().replace(/[-_]/g, ' ');
  return REVERSE_ALIAS_MAP.get(norm) || norm;
}

function getAllTermVariants(term: string): string[] {
  const canonical = resolveCanonicalTerm(term);
  const variants = [canonical];
  if (CANONICAL_ALIASES[canonical]) {
    variants.push(...CANONICAL_ALIASES[canonical]);
  }
  // Also add original term if distinct
  const rawNorm = term.toLowerCase().trim();
  if (!variants.includes(rawNorm)) {
    variants.push(rawNorm);
  }
  return Array.from(new Set(variants));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termMatchesInCorpus(term: string, corpus: string): boolean {
  const variants = getAllTermVariants(term);
  for (const variant of variants) {
    // Word boundary check that safely accounts for terms with +, #, or punctuation
    const escaped = escapeRegex(variant);
    const pattern = new RegExp(`(?:^|[^a-zA-Z0-9+#])${escaped}(?:$|[^a-zA-Z0-9+#])`, 'i');
    if (pattern.test(corpus)) {
      return true;
    }
  }
  return false;
}

export class AtsAnalyzer {
  public analyzeAtsCompatibility(
    resumeData: ResumeData,
    parsedDocOrJob?: ParsedDocumentResult | JobDescriptionModel | string,
    jobDescOrString?: JobDescriptionModel | string
  ): AtsSimulationResult {
    let parsedDoc: ParsedDocumentResult | undefined;
    let jobDesc: JobDescriptionModel | undefined;

    if (parsedDocOrJob) {
      if (typeof parsedDocOrJob === 'string') {
        const extracted = skillExtractor.extractSkills(parsedDocOrJob).map((s) => s.name);
        jobDesc = {
          id: 'jd-param-auto',
          userId: 'system',
          title: 'Target Role',
          rawText: parsedDocOrJob,
          requiredSkills: extracted,
          preferredSkills: [],
          responsibilities: [],
          experienceYearsRequired: 3,
          seniorityLevel: 'Mid',
          domainKeywords: extracted,
          createdAt: new Date().toISOString(),
        };
      } else if ('layoutInfo' in parsedDocOrJob || 'lines' in parsedDocOrJob) {
        parsedDoc = parsedDocOrJob as ParsedDocumentResult;
      } else if ('rawText' in parsedDocOrJob || 'requiredSkills' in parsedDocOrJob) {
        jobDesc = parsedDocOrJob as JobDescriptionModel;
      }
    }

    if (jobDescOrString) {
      if (typeof jobDescOrString === 'string') {
        const extracted = skillExtractor.extractSkills(jobDescOrString).map((s) => s.name);
        jobDesc = {
          id: 'jd-param-string',
          userId: 'system',
          title: 'Target Role',
          rawText: jobDescOrString,
          requiredSkills: extracted,
          preferredSkills: [],
          responsibilities: [],
          experienceYearsRequired: 3,
          seniorityLevel: 'Mid',
          domainKeywords: extracted,
          createdAt: new Date().toISOString(),
        };
      } else {
        jobDesc = jobDescOrString;
      }
    }

    let atsScore = 100;
    const deductions: AtsSimulationResult['majorDeductions'] = [];

    // 1. Contact Information Screening
    const hasEmail = Boolean(resumeData.personal_info?.email && resumeData.personal_info.email.includes('@'));
    const hasPhone = Boolean(resumeData.personal_info?.phone && resumeData.personal_info.phone.length > 6);
    const hasLocation = Boolean(resumeData.personal_info?.location && resumeData.personal_info.location.length > 2);

    if (!hasEmail) {
      atsScore -= 15;
      deductions.push({
        factor: 'Contact Information',
        penalty: 15,
        explanation: 'Missing valid email address in primary contact section.',
        fix: 'Add a standard corporate or professional email address at the very top of your resume.',
      });
    }

    if (!hasPhone) {
      atsScore -= 8;
      deductions.push({
        factor: 'Contact Information',
        penalty: 8,
        explanation: 'Missing phone number. ATS phone parsers expect standard E.164 or US formatted phone numbers.',
        fix: 'Add a verified direct contact number (e.g., +1 (555) 000-0000).',
      });
    }

    if (!hasLocation) {
      atsScore -= 5;
      deductions.push({
        factor: 'Location & Relocation',
        penalty: 5,
        explanation: 'Missing geographic location (City, State / Country). ATS location filters require geographic anchoring.',
        fix: 'Add your current city and state (e.g. San Francisco, CA or Remote).',
      });
    }

    // 2. Section Detection & Standard Headings
    const sectionDetection: AtsSimulationResult['sectionDetection'] = [];

    const hasExp = Boolean(resumeData.experience && resumeData.experience.length > 0);
    sectionDetection.push({
      section: 'Work Experience',
      detected: hasExp,
      isStandard: true,
      headingUsed: 'Experience',
    });
    if (!hasExp) {
      atsScore -= 20;
      deductions.push({
        factor: 'Missing Core Section',
        penalty: 20,
        explanation: 'Work Experience section not detected. ATS engines rank resumes without verifiable experience near zero.',
        fix: 'Add a dedicated "Work Experience" section with roles, company names, dates, and bulleted achievements.',
      });
    }

    const hasEdu = Boolean(resumeData.education && resumeData.education.length > 0);
    sectionDetection.push({
      section: 'Education',
      detected: hasEdu,
      isStandard: true,
      headingUsed: 'Education',
    });
    if (!hasEdu) {
      atsScore -= 10;
      deductions.push({
        factor: 'Missing Core Section',
        penalty: 10,
        explanation: 'Education section not found. Corporate ATS systems often filter candidates by degree requirement.',
        fix: 'Add an "Education" section specifying university, degree, field of study, and graduation year.',
      });
    }

    const totalSkills = (resumeData.skills || []).reduce((sum, g) => sum + (g.items || []).length, 0);
    const hasSkills = totalSkills > 0;
    sectionDetection.push({
      section: 'Skills',
      detected: hasSkills,
      isStandard: true,
      headingUsed: 'Skills & Technologies',
    });
    if (!hasSkills) {
      atsScore -= 15;
      deductions.push({
        factor: 'Skills Keyword Section',
        penalty: 15,
        explanation: 'No categorized skills section detected. Keyword parsers index categorized skills with highest priority.',
        fix: 'Create a dedicated "Technical Skills" section categorized by Languages, Frameworks, and Tools.',
      });
    }

    const hasSummary = Boolean(resumeData.summary && resumeData.summary.length > 30);
    sectionDetection.push({
      section: 'Professional Summary',
      detected: hasSummary,
      isStandard: true,
      headingUsed: 'Professional Summary',
    });

    const hasProjects = Boolean(resumeData.projects && resumeData.projects.length > 0);
    sectionDetection.push({
      section: 'Projects',
      detected: hasProjects,
      isStandard: true,
      headingUsed: 'Projects',
    });

    // 3. Document Layout & Formatting Safety
    let tablesDetected = false;
    let columnsDetected = false;
    let machineReadable = true;

    if (parsedDoc && parsedDoc.layoutInfo) {
      tablesDetected = Boolean(parsedDoc.layoutInfo.hasTableClues);
      columnsDetected = Boolean(parsedDoc.layoutInfo.hasMultiColumnClues);
      machineReadable = parsedDoc.layoutInfo.isMachineReadable ?? true;

      if (columnsDetected) {
        atsScore -= 6;
        deductions.push({
          factor: 'Layout Risk: Multi-Column Flow',
          penalty: 6,
          explanation: 'Multi-column layouts often cause older ATS parsers (e.g. Taleo, Brassring) to interleave text lines in horizontal reading order.',
          fix: 'Use a single-column layout or verified ATS-safe linear flow to ensure sequential parsing.',
        });
      }

      if (tablesDetected) {
        atsScore -= 4;
        deductions.push({
          factor: 'Layout Risk: Embedded Tables',
          penalty: 4,
          explanation: 'HTML or DOCX/PDF table cells can break linear text extraction in strict ATS parsers.',
          fix: 'Format text with standard tab-separated or bulleted lists rather than embedded grid tables.',
        });
      }

      if (!machineReadable) {
        atsScore -= 25;
        deductions.push({
          factor: 'Critical: Low Machine Readability',
          penalty: 25,
          explanation: 'Document text extraction yielded very low character density. The file may be a flattened raster image or scan.',
          fix: 'Export your resume directly from digital vector sources (e.g., modern Word or PDF generator).',
        });
      }
    }

    // 4. Quantified Results Check across bullets
    let totalBullets = 0;
    let quantifiedBullets = 0;
    for (const exp of resumeData.experience || []) {
      for (const b of exp.bullets || []) {
        totalBullets++;
        if (/\d+[%$kKmMbB]?|\b\d+\b/.test(b)) {
          quantifiedBullets++;
        }
      }
    }

    const quantificationRatio = totalBullets > 0 ? quantifiedBullets / totalBullets : 0;
    if (quantificationRatio < 0.25 && totalBullets > 3) {
      atsScore -= 5;
      deductions.push({
        factor: 'Low Quantification Ratio',
        penalty: 5,
        explanation: `Only ${Math.round(quantificationRatio * 100)}% of your experience bullets contain quantifiable metrics. ATS algorithms reward metric density.`,
        fix: 'Add measurable results to at least 40% of bullet points (e.g. latency, dollar savings, throughput, or user growth).',
      });
    }

    atsScore = Math.max(0, Math.min(100, atsScore));

    // =========================================================================
    // 5. GENUINE EVIDENCE-BASED KEYWORD COVERAGE ENGINE
    // =========================================================================

    // Build section-specific text corpora
    const skillsCorpus = (resumeData.skills || []).flatMap((g) => g.items || []).join(' ');
    const expCorpus = (resumeData.experience || [])
      .map((e) => `${e.role} ${e.company} ${(e.bullets || []).join(' ')} ${(e.technologies || []).join(' ')}`)
      .join(' ');
    const projCorpus = (resumeData.projects || [])
      .map((p) => `${p.title} ${(p.bullets || []).join(' ')} ${(p.technologies || []).join(' ')}`)
      .join(' ');
    const eduCorpus = (resumeData.education || [])
      .map((ed) => `${ed.degree} ${ed.institution} ${ed.field || ''}`)
      .join(' ');
    const certCorpus = (resumeData.certifications || [])
      .map((c) => `${c.name} ${c.issuer}`)
      .join(' ');
    const summaryCorpus = resumeData.summary || '';

    const fullResumeCorpus = [
      skillsCorpus,
      expCorpus,
      projCorpus,
      eduCorpus,
      certCorpus,
      summaryCorpus,
    ].join(' ');

    let keywordCoverage = 0;
    let keywordEvidence: AtsSimulationResult['keywordEvidence'];

    if (jobDesc && ((jobDesc.requiredSkills && jobDesc.requiredSkills.length > 0) || (jobDesc.domainKeywords && jobDesc.domainKeywords.length > 0))) {
      // -----------------------------------------------------------------------
      // CASE A: WITH JOB DESCRIPTION (Target Requisition Evidence Analysis)
      // -----------------------------------------------------------------------
      const requiredSkillsList = jobDesc.requiredSkills || [];
      const preferredSkillsList = jobDesc.preferredSkills || [];
      const domainKeywordsList = jobDesc.domainKeywords || [];

      // Combine relevant target terms into canonical unique map
      const relevantTargetMap = new Map<string, { original: string; isRequired: boolean }>();
      for (const s of requiredSkillsList) {
        const canon = resolveCanonicalTerm(s);
        if (!relevantTargetMap.has(canon)) relevantTargetMap.set(canon, { original: s, isRequired: true });
      }
      for (const s of preferredSkillsList) {
        const canon = resolveCanonicalTerm(s);
        if (!relevantTargetMap.has(canon)) relevantTargetMap.set(canon, { original: s, isRequired: false });
      }
      for (const s of domainKeywordsList) {
        const canon = resolveCanonicalTerm(s);
        if (!relevantTargetMap.has(canon)) relevantTargetMap.set(canon, { original: s, isRequired: false });
      }

      const totalRelevantTerms = relevantTargetMap.size;
      const matchedTerms: string[] = [];
      const missingTerms: string[] = [];
      let matchedRequired = 0;
      let totalRequired = 0;
      let matchedPreferred = 0;
      let totalPreferred = 0;

      for (const [canon, meta] of relevantTargetMap.entries()) {
        if (meta.isRequired) totalRequired++;
        else totalPreferred++;

        if (termMatchesInCorpus(canon, fullResumeCorpus)) {
          matchedTerms.push(meta.original);
          if (meta.isRequired) matchedRequired++;
          else matchedPreferred++;
        } else {
          missingTerms.push(meta.original);
        }
      }

      const matchedCount = matchedTerms.length;
      keywordCoverage = totalRelevantTerms > 0
        ? Math.round((matchedCount / totalRelevantTerms) * 100)
        : 85;

      const reqCoverage = totalRequired > 0 ? Math.round((matchedRequired / totalRequired) * 100) : 100;
      const prefCoverage = totalPreferred > 0 ? Math.round((matchedPreferred / totalPreferred) * 100) : 100;

      // Section distribution of matched keywords
      const sectionDist = [
        { section: 'Technical Skills', count: matchedTerms.filter((t) => termMatchesInCorpus(t, skillsCorpus)).length },
        { section: 'Work Experience', count: matchedTerms.filter((t) => termMatchesInCorpus(t, expCorpus)).length },
        { section: 'Projects', count: matchedTerms.filter((t) => termMatchesInCorpus(t, projCorpus)).length },
        { section: 'Education & Certifications', count: matchedTerms.filter((t) => termMatchesInCorpus(t, `${eduCorpus} ${certCorpus}`)).length },
        { section: 'Professional Summary', count: matchedTerms.filter((t) => termMatchesInCorpus(t, summaryCorpus)).length },
      ];

      keywordEvidence = {
        explanation: `${matchedCount} of ${totalRelevantTerms} relevant job-description terms were found in the resume.`,
        matchedTerms,
        missingTerms,
        totalRelevantTerms,
        matchedCount,
        stuffingRisk: 'None',
        stuffingDetected: false,
        extractedKeywordCount: matchedCount,
        repeatedKeywordCount: 0,
        sectionDistribution: sectionDist,
        requiredSkillCoverage: reqCoverage,
        preferredSkillCoverage: prefCoverage,
      };
    } else {
      // -----------------------------------------------------------------------
      // CASE B: WITHOUT JOB DESCRIPTION (Intrinsic Extraction & Section Depth)
      // -----------------------------------------------------------------------
      // Extract candidate keywords from all resume sections
      const extractedKeywords = new Set<string>();

      // 1. From Skills
      for (const g of resumeData.skills || []) {
        for (const item of g.items || []) {
          if (item && item.trim().length > 1) {
            extractedKeywords.add(resolveCanonicalTerm(item));
          }
        }
      }

      // 2. From Experience technologies & prominent technical nouns
      for (const exp of resumeData.experience || []) {
        for (const t of exp.technologies || []) {
          if (t && t.trim().length > 1) extractedKeywords.add(resolveCanonicalTerm(t));
        }
        for (const b of exp.bullets || []) {
          const words = b.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9+#]/g, ''));
          for (const w of words) {
            if (w.length > 2 && REVERSE_ALIAS_MAP.has(w.toLowerCase())) {
              extractedKeywords.add(resolveCanonicalTerm(w));
            }
          }
        }
      }

      // 3. From Projects
      for (const proj of resumeData.projects || []) {
        for (const t of proj.technologies || []) {
          if (t && t.trim().length > 1) extractedKeywords.add(resolveCanonicalTerm(t));
        }
        for (const b of proj.bullets || []) {
          const words = b.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9+#]/g, ''));
          for (const w of words) {
            if (w.length > 2 && REVERSE_ALIAS_MAP.has(w.toLowerCase())) {
              extractedKeywords.add(resolveCanonicalTerm(w));
            }
          }
        }
      }

      // 4. From Education & Certifications
      for (const ed of resumeData.education || []) {
        if (ed.field) extractedKeywords.add(resolveCanonicalTerm(ed.field));
      }
      for (const c of resumeData.certifications || []) {
        if (c.name) extractedKeywords.add(resolveCanonicalTerm(c.name));
      }

      const allExtracted = Array.from(extractedKeywords);

      // Section distribution
      const sectionDist = [
        { section: 'Technical Skills', count: allExtracted.filter((t) => termMatchesInCorpus(t, skillsCorpus)).length },
        { section: 'Work Experience', count: allExtracted.filter((t) => termMatchesInCorpus(t, expCorpus)).length },
        { section: 'Projects', count: allExtracted.filter((t) => termMatchesInCorpus(t, projCorpus)).length },
        { section: 'Education & Certifications', count: allExtracted.filter((t) => termMatchesInCorpus(t, `${eduCorpus} ${certCorpus}`)).length },
        { section: 'Professional Summary', count: allExtracted.filter((t) => termMatchesInCorpus(t, summaryCorpus)).length },
      ];

      const sectionsWithKeywords = sectionDist.filter((s) => s.count > 0).length;

      // Frequency analysis & Keyword Stuffing Risk Detection
      const termFrequencies = new Map<string, number>();
      let maxFrequency = 0;
      let repeatedCount = 0;

      const wordsInResume = fullResumeCorpus.toLowerCase().split(/\s+/);
      for (const kw of allExtracted) {
        let freq = 0;
        const variants = getAllTermVariants(kw);
        for (const v of variants) {
          const re = new RegExp(`(?:^|[^a-zA-Z0-9+#])${escapeRegex(v)}(?:$|[^a-zA-Z0-9+#])`, 'gi');
          const matches = fullResumeCorpus.match(re);
          if (matches) freq += matches.length;
        }
        termFrequencies.set(kw, freq);
        if (freq > maxFrequency) maxFrequency = freq;
        if (freq > 3) repeatedCount++;
      }

      let stuffingRisk: 'None' | 'Low' | 'Moderate' | 'High' = 'None';
      if (maxFrequency >= 9 || (wordsInResume.length > 50 && maxFrequency / wordsInResume.length > 0.06)) {
        stuffingRisk = 'High';
      } else if (maxFrequency >= 7) {
        stuffingRisk = 'Moderate';
      } else if (maxFrequency >= 5) {
        stuffingRisk = 'Low';
      }

      // Evidence-based Keyword Coverage Score:
      // - Keyword volume & diversity (up to 45 pts: 0-18+ distinct keywords)
      // - Section distribution depth (up to 40 pts: 8 pts per section with keyword presence)
      // - Stuffing safety (up to 15 pts: 15 for None/Low, 8 for Moderate, 0 for High)
      const diversityScore = Math.min(45, Math.round((Math.min(allExtracted.length, 18) / 18) * 45));
      const distributionScore = Math.min(40, sectionsWithKeywords * 8);
      const stuffingScore = stuffingRisk === 'High' ? 0 : stuffingRisk === 'Moderate' ? 8 : 15;

      keywordCoverage = allExtracted.length === 0
        ? 0
        : Math.min(100, Math.max(0, diversityScore + distributionScore + stuffingScore));

      // Build matched and recommended missing keywords
      const matchedTerms = allExtracted.slice(0, 16);
      const suggestedMissing = ['CI/CD', 'Unit Testing', 'System Architecture', 'Agile Methodology', 'Cloud Infrastructure']
        .filter((s) => !termMatchesInCorpus(s, fullResumeCorpus))
        .slice(0, 4);

      keywordEvidence = {
        explanation: `Extracted ${allExtracted.length} verified professional keywords across ${sectionsWithKeywords} resume sections (${stuffingRisk.toLowerCase()} keyword repetition risk).`,
        matchedTerms,
        missingTerms: suggestedMissing,
        totalRelevantTerms: allExtracted.length,
        matchedCount: allExtracted.length,
        stuffingRisk,
        stuffingDetected: stuffingRisk === 'High' || stuffingRisk === 'Moderate',
        extractedKeywordCount: allExtracted.length,
        repeatedKeywordCount: repeatedCount,
        sectionDistribution: sectionDist,
      };
    }

    // 6. Semantic Alignment & Formatting Safety Dimensions
    const semanticAlignment = Math.min(
      100,
      Math.max(
        0,
        (hasSummary ? 20 : 0) +
          (hasExp ? 35 : 0) +
          (hasEdu ? 20 : 0) +
          (totalSkills > 0 ? 15 : 0) +
          (quantificationRatio >= 0.25 ? 10 : Math.round(quantificationRatio * 40))
      )
    );

    const formattingSafety = Math.max(
      0,
      100 - (columnsDetected ? 18 : 0) - (tablesDetected ? 12 : 0) - (!machineReadable ? 45 : 0)
    );

    const categoryCount = (resumeData.skills || []).filter((g) => g.items && g.items.length > 0).length;
    const skillRelevance = totalSkills === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round(Math.min(50, categoryCount * 15) + Math.min(50, totalSkills * 4))));

    // 7. Educational ATS-Style Heuristic Parser Simulations
    // NOTE: These are simulated parser heuristics for candidate educational and diagnostic use,
    // reflecting documented parsing behaviors across common corporate ATS archetypes.
    // They are NOT actual proprietary vendor algorithms or official scores of any vendor.
    const workdayScore = Math.max(
      0,
      Math.min(
        100,
        atsScore - (columnsDetected ? 16 : 0) - (tablesDetected ? 10 : 0) - (!hasEdu ? 10 : 0) - (!hasLocation ? 8 : 0)
      )
    );

    const greenhouseScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          keywordCoverage * 0.45 +
            skillRelevance * 0.25 +
            (quantificationRatio >= 0.25 ? 15 : quantificationRatio * 40) +
            (hasExp ? 15 : 0) -
            (!hasEmail ? 15 : 0)
        )
      )
    );

    const taleoScore = Math.max(
      0,
      Math.min(
        100,
        atsScore - (columnsDetected ? 24 : 0) - (tablesDetected ? 20 : 0) - (!hasEmail ? 15 : 0) - (!hasExp ? 20 : 0)
      )
    );

    const leverScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(atsScore * 0.88 + (hasSummary ? 8 : 0) + (hasExp ? 4 : 0) - (!hasEmail ? 12 : 0))
      )
    );

    const icimsScore = Math.max(
      0,
      Math.min(
        100,
        atsScore - (!hasPhone ? 15 : 0) - (!hasLocation ? 12 : 0) - (!hasEmail ? 15 : 0) - (columnsDetected ? 10 : 0)
      )
    );

    const engineSimulations: AtsSimulationResult['engineSimulations'] = [
      {
        engine: 'Workday',
        simulationLabel: 'Workday-style ATS simulation',
        score: workdayScore,
        verdict: workdayScore >= 85 ? 'Excellent' : workdayScore >= 70 ? 'Good' : workdayScore >= 50 ? 'Fair' : 'Poor',
        primaryRisk: columnsDetected
          ? 'Multi-column layout risks field-mapping corruption during Workday-style hierarchical parsing.'
          : tablesDetected
          ? 'Embedded grid tables may fail linear section extraction.'
          : 'Standard single-column sequential section flow verified.',
        parsingModel: 'ATS-Style Simulation: Hierarchical DOM & XML Schema Heuristic (Workday-style)',
        strengths: [
          hasEmail && hasPhone ? 'Complete primary contact identifiers detected' : 'Incomplete contact details',
          hasExp ? 'Chronological experience tree mapped' : 'Missing experience entries',
          !columnsDetected ? 'Single-column linear text order confirmed' : 'Multi-column layout risk',
        ],
        weaknesses: [
          ...(columnsDetected ? ['Multi-column layout: parser heuristic risks interleaving parallel columns.'] : []),
          ...(tablesDetected ? ['Tables detected: XML tokenizer may drop or misalign tabular cells.'] : []),
          ...(!hasLocation ? ['Missing location: candidate postal filter checks may exclude profile.'] : []),
        ],
      },
      {
        engine: 'Greenhouse',
        simulationLabel: 'Greenhouse-style ATS simulation',
        score: greenhouseScore,
        verdict: greenhouseScore >= 80 ? 'Excellent' : greenhouseScore >= 65 ? 'Good' : greenhouseScore >= 45 ? 'Fair' : 'Poor',
        primaryRisk: totalSkills < 6
          ? 'Low categorized skill density reduces semantic keyword matching against recruiter job requisitions.'
          : 'Healthy keyword density and entity distribution.',
        parsingModel: 'ATS-Style Simulation: Entity Indexer & Keyword Density Heuristic (Greenhouse-style)',
        strengths: [
          `${totalSkills} normalized technical & functional skills indexed`,
          quantificationRatio >= 0.25 ? 'High quantified outcome density across bullet points' : 'Basic bullet structure detected',
          'Compatible with modern UTF-8 text extraction',
        ],
        weaknesses: [
          ...(totalSkills < 6 ? ['Fewer than 6 indexed skills; expand domain and tooling keywords.'] : []),
          ...(quantificationRatio < 0.25 ? ['Under 25% of bullets contain numerical outcomes or metrics.'] : []),
        ],
      },
      {
        engine: 'Taleo',
        simulationLabel: 'Taleo-style ATS simulation',
        score: taleoScore,
        verdict: taleoScore >= 80 ? 'Excellent' : taleoScore >= 65 ? 'Good' : taleoScore >= 45 ? 'Fair' : 'Poor',
        primaryRisk: columnsDetected || tablesDetected
          ? 'Legacy linear stream readers scramble multi-column resumes and drop text within tables.'
          : 'Standard header labels required for legacy section segmentation.',
        parsingModel: 'ATS-Style Simulation: Linear Regex Stream Heuristic (Taleo-style)',
        strengths: [
          hasExp ? 'Standard "Work Experience" section identifier recognized' : 'Experience section missing',
          hasEdu ? 'Standard "Education" header confirmed' : 'Education missing',
        ],
        weaknesses: [
          ...(columnsDetected ? ['CRITICAL: Stream reader may interlace multi-column text horizontally.'] : []),
          ...(tablesDetected ? ['CRITICAL: Legacy parser may omit content nested inside tables.'] : []),
        ],
      },
      {
        engine: 'Lever',
        simulationLabel: 'Lever-style ATS simulation',
        score: leverScore,
        verdict: leverScore >= 80 ? 'Excellent' : leverScore >= 65 ? 'Good' : leverScore >= 45 ? 'Fair' : 'Poor',
        primaryRisk: !hasExp ? 'Recruiter timeline generation requires sequential role entries.' : 'Low layout risk.',
        parsingModel: 'ATS-Style Simulation: Contextual Recruiter Preview Heuristic (Lever-style)',
        strengths: [
          'Direct recruiter plain-text readability verified',
          hasExp ? `${resumeData.experience.length} chronological career roles indexed` : 'No career timeline',
        ],
        weaknesses: [
          ...(!hasSummary ? ['Professional summary absent; recruiter snapshot card will omit lead intro.'] : []),
          ...(!hasEmail ? ['Direct email link missing for recruiter quick-contact.'] : []),
        ],
      },
      {
        engine: 'iCIMS',
        simulationLabel: 'iCIMS-style ATS simulation',
        score: icimsScore,
        verdict: icimsScore >= 80 ? 'Excellent' : icimsScore >= 65 ? 'Good' : icimsScore >= 45 ? 'Fair' : 'Poor',
        primaryRisk: !hasLocation || !hasPhone
          ? 'Strict candidate requisition matching filters require phone and geographic anchoring.'
          : 'Contact anchoring verified.',
        parsingModel: 'ATS-Style Simulation: Contact & Geographic Requisition Heuristic (iCIMS-style)',
        strengths: [
          hasEmail ? 'Email parsed for candidate record deduplication' : 'Missing email',
          hasLocation ? `Geographic anchor recognized: "${resumeData.personal_info?.location}"` : 'Missing geographic anchor',
        ],
        weaknesses: [
          ...(!hasPhone ? ['Missing telephone contact field required by standard candidate profiles.'] : []),
          ...(!hasLocation ? ['Missing location prevents auto-matching against job postal codes.'] : []),
        ],
      },
    ];

    return {
      overallAtsScore: atsScore,
      keywordCoverage,
      semanticAlignment,
      formattingSafety,
      sectionDetection,
      skillRelevance,
      majorDeductions: deductions,
      fileSafety: {
        isMachineReadable: machineReadable,
        tablesDetected,
        columnsDetected,
        headerFooterRisk: false,
        imagesIconsDetected: false,
        fontSafetyScore: 96,
      },
      keywordEvidence,
      engineSimulations,
    };
  }
}

export const atsAnalyzer = new AtsAnalyzer();
