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
    };
  }
}

export const atsAnalyzer = new AtsAnalyzer();
