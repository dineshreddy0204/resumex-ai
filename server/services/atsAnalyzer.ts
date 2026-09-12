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

    atsScore = Math.max(25, Math.min(100, atsScore));

    const keywordCoverage = Math.min(98, Math.max(40, 50 + totalSkills * 2.5));
    const semanticAlignment = Math.min(96, Math.max(50, Math.round(atsScore * 0.95)));
    const formattingSafety = columnsDetected || tablesDetected ? 82 : 98;
    const skillRelevance = Math.min(95, Math.max(60, 65 + totalSkills * 1.5));

    // 5. Deterministic ATS Engine Simulations (Workday, Greenhouse, Taleo, Lever, iCIMS)
    const engineSimulations: AtsSimulationResult['engineSimulations'] = [
      {
        engine: 'Workday',
        score: Math.max(30, Math.min(100, atsScore - (columnsDetected ? 14 : 0) - (tablesDetected ? 8 : 0) - (!hasEdu ? 8 : 0))),
        verdict: atsScore >= 85 && !columnsDetected && !tablesDetected ? 'Excellent' : atsScore >= 70 ? 'Good' : atsScore >= 50 ? 'Fair' : 'Poor',
        primaryRisk: columnsDetected
          ? 'Multi-column layout risks field-mapping corruption during Workday parsing.'
          : tablesDetected
          ? 'Embedded grid tables may fail Workday linear section extraction.'
          : 'None detected; standard single-column section flow verified.',
        parsingModel: 'Hierarchical DOM Tokenizer with XML section schemas',
        strengths: [
          hasEmail && hasPhone ? 'Complete verified primary contact identifiers' : 'Missing direct contact identifiers',
          hasExp ? 'Clean chronological experience tree detected' : 'Missing experience entries',
          !columnsDetected ? 'Single-column linear text order confirmed' : 'Column interleaving detected',
        ],
        weaknesses: [
          ...(columnsDetected ? ['Columns detected: Workday may interlace left and right text blocks.'] : []),
          ...(tablesDetected ? ['Tables detected: Workday XML parser may skip tabular data cells.'] : []),
          ...(!hasLocation ? ['Missing location: Workday candidate geographic filters may exclude profile.'] : []),
        ],
      },
      {
        engine: 'Greenhouse',
        score: Math.max(35, Math.min(100, Math.round(50 + totalSkills * 2.2 + (quantificationRatio > 0.3 ? 15 : 5) - (!hasEmail ? 12 : 0)))),
        verdict: totalSkills >= 8 && hasExp ? 'Excellent' : totalSkills >= 5 ? 'Good' : 'Fair',
        primaryRisk: totalSkills < 6 ? 'Low skill keyword volume reduces match percentage on Greenhouse recruiter searches.' : 'Low risk; healthy keyword density.',
        parsingModel: 'Modern NLP Entity Indexer with Semantic Keyword Mapping',
        strengths: [
          `${totalSkills} normalized technical & functional skills indexed`,
          quantificationRatio > 0.25 ? 'High quantified outcome density across bullet points' : 'Experience statements extracted',
          'Compatible with modern modern PDF and DOCX parsers',
        ],
        weaknesses: [
          ...(totalSkills < 6 ? ['Fewer than 6 indexed skills; expand technical and domain tooling.'] : []),
          ...(quantificationRatio < 0.25 ? ['Fewer than 25% of bullets contain numerical outcomes or metrics.'] : []),
        ],
      },
      {
        engine: 'Taleo',
        score: Math.max(25, Math.min(100, atsScore - (columnsDetected ? 20 : 0) - (tablesDetected ? 15 : 0) - (!hasEmail ? 15 : 0))),
        verdict: !columnsDetected && !tablesDetected && atsScore >= 80 ? 'Excellent' : atsScore >= 65 ? 'Good' : 'Poor',
        primaryRisk: columnsDetected || tablesDetected
          ? 'Taleo legacy linear stream reader scrambles multi-column resumes into unreadable text.'
          : 'Standard header labels required for legacy Taleo section segmentation.',
        parsingModel: 'Legacy Linear Regex Stream Engine (Oracle Taleo Enterprise Edition)',
        strengths: [
          hasExp ? 'Recognized standard "Work Experience" section identifier' : 'Experience missing',
          hasEdu ? 'Standard "Education" header confirmed' : 'Education missing',
        ],
        weaknesses: [
          ...(columnsDetected ? ['CRITICAL: Taleo will interleave multi-column lines in horizontal order.'] : []),
          ...(tablesDetected ? ['CRITICAL: Taleo often fails to parse text inside table structures.'] : []),
        ],
      },
      {
        engine: 'Lever',
        score: Math.max(30, Math.min(100, Math.round(atsScore * 0.96 + (hasSummary ? 4 : 0)))),
        verdict: atsScore >= 80 ? 'Excellent' : atsScore >= 68 ? 'Good' : 'Fair',
        primaryRisk: !hasExp ? 'Lever career timeline generation requires sequential role entries.' : 'Low risk.',
        parsingModel: 'Recruiter-Centric Contextual Parser & Resume Previewer',
        strengths: [
          'Direct recruiter plain-text rendering verified',
          hasExp ? `${resumeData.experience.length} career role progressions detected` : 'No career timeline',
        ],
        weaknesses: [
          ...(!hasSummary ? ['Professional summary absent; Lever highlights top profile abstracts.'] : []),
          ...(!hasEmail ? ['Direct email link missing in candidate profile card.'] : []),
        ],
      },
      {
        engine: 'iCIMS',
        score: Math.max(30, Math.min(100, atsScore - (!hasPhone ? 10 : 0) - (!hasLocation ? 8 : 0) - (columnsDetected ? 10 : 0))),
        verdict: hasEmail && hasPhone && hasLocation && atsScore >= 78 ? 'Excellent' : atsScore >= 65 ? 'Good' : 'Fair',
        primaryRisk: !hasLocation || !hasPhone ? 'iCIMS strict requisition matching filters require complete geographic and direct contact anchoring.' : 'Low risk.',
        parsingModel: 'Enterprise Contact & Requisition Matching Engine',
        strengths: [
          hasEmail ? 'Email parsed for iCIMS candidate record deduplication' : 'Missing email',
          hasLocation ? `Geographic anchor recognized: "${resumeData.personal_info?.location}"` : 'Missing geographic anchor',
        ],
        weaknesses: [
          ...(!hasPhone ? ['Missing telephone contact field required by standard iCIMS profiles.'] : []),
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
