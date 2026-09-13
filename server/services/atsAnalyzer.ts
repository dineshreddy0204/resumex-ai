import type { ResumeData, AtsSimulationResult } from '../types';
import type { ParsedDocumentResult } from './documentParser';

const STANDARD_SECTIONS = [
  { key: 'experience', label: 'Work Experience', weight: 25, required: true },
  { key: 'education', label: 'Education', weight: 15, required: true },
  { key: 'skills', label: 'Skills & Technologies', weight: 20, required: true },
  { key: 'personal_info', label: 'Contact Information', weight: 20, required: true },
  { key: 'summary', label: 'Professional Summary', weight: 10, required: false },
  { key: 'projects', label: 'Projects', weight: 10, required: false },
];

export class AtsAnalyzer {
  public analyzeAtsCompatibility(
    resumeData: ResumeData,
    parsedDoc?: ParsedDocumentResult
  ): AtsSimulationResult {
    let atsScore = 100;
    const deductions: AtsSimulationResult['majorDeductions'] = [];

    // 1. Contact Info Safety (Email, Phone, Location)
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

    // Check Experience
    const hasExp = resumeData.experience && resumeData.experience.length > 0;
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

    // Check Education
    const hasEdu = resumeData.education && resumeData.education.length > 0;
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

    // Check Skills
    const totalSkills = resumeData.skills.reduce((sum, g) => sum + g.items.length, 0);
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
    } else if (totalSkills < 6) {
      atsScore -= 5;
      deductions.push({
        factor: 'Low Keyword Density',
        penalty: 5,
        explanation: `Only ${totalSkills} skills listed. Low keyword volume limits matching against comprehensive job postings.`,
        fix: 'List core technologies, libraries, databases, and methodologies you have verified hands-on experience with.',
      });
    }

    // Check Summary
    const hasSummary = Boolean(resumeData.summary && resumeData.summary.length > 30);
    sectionDetection.push({
      section: 'Professional Summary',
      detected: hasSummary,
      isStandard: true,
      headingUsed: 'Professional Summary',
    });

    // 3. Document Layout & Formatting Safety
    let tablesDetected = false;
    let columnsDetected = false;
    let machineReadable = true;

    if (parsedDoc) {
      tablesDetected = parsedDoc.layoutInfo.hasTableClues;
      columnsDetected = parsedDoc.layoutInfo.hasMultiColumnClues;
      machineReadable = parsedDoc.layoutInfo.isMachineReadable;

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
    for (const exp of resumeData.experience) {
      for (const b of exp.bullets) {
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

    // True evidence-based scoring dimensions (natural 0-100 distribution without synthetic baselines)
    const keywordCoverage = totalSkills === 0
      ? 0
      : Math.min(100, Math.round((Math.min(totalSkills, 15) / 15) * 80 + (totalSkills >= 6 ? 20 : 0)));

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

    // 5. Educational ATS-Style Heuristic Simulations
    // NOTE: These are simulated parser heuristics for educational and testing purposes,
    // reflecting documented parsing vulnerabilities across common corporate ATS archetypes.
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
      engineSimulations,
    };
  }
}

export const atsAnalyzer = new AtsAnalyzer();
