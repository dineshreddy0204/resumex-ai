import type { ResumeData } from '../types';
import { atsAnalyzer } from './atsAnalyzer';

export interface PreExportValidation {
  isValid: boolean;
  warnings: string[];
  blockers: string[];
  atsScore: number;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

export class ExportEngine {
  public validateForExport(data: ResumeData): PreExportValidation {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const checks: PreExportValidation['checks'] = [];

    // 1. Contact check
    const hasName = Boolean(data.personal_info?.name && data.personal_info.name.trim().length > 1);
    const hasEmail = Boolean(data.personal_info?.email && data.personal_info.email.includes('@'));
    const contactPassed = hasName && hasEmail;
    checks.push({
      name: 'Primary Contact Details',
      passed: contactPassed,
      details: contactPassed ? 'Valid name and email detected.' : 'Missing candidate name or email address.',
    });
    if (!contactPassed) blockers.push('Candidate name and email are mandatory for export.');

    // 2. Experience check
    const hasExp = data.experience && data.experience.length > 0;
    checks.push({
      name: 'Work Experience Structure',
      passed: hasExp,
      details: hasExp ? `${data.experience.length} experience roles documented.` : 'No work experience entries listed.',
    });
    if (!hasExp) warnings.push('Resume contains 0 employment history entries.');

    // 3. Education check
    const hasEdu = data.education && data.education.length > 0;
    checks.push({
      name: 'Education Credentials',
      passed: hasEdu,
      details: hasEdu ? `${data.education.length} degree entries listed.` : 'No academic history provided.',
    });
    if (!hasEdu) warnings.push('Missing education section.');

    // 4. Skills check
    const skillCount = data.skills.reduce((sum, g) => sum + g.items.length, 0);
    const hasSkills = skillCount >= 4;
    checks.push({
      name: 'Technical Keyword Volume',
      passed: hasSkills,
      details: `${skillCount} skills indexed across categories.`,
    });
    if (!hasSkills) warnings.push('Fewer than 4 skills listed, reducing ATS keyword match potential.');

    // 5. Overflow estimation
    let totalLinesEstimate = 8; // header
    totalLinesEstimate += Math.ceil((data.summary?.length || 0) / 90);
    for (const exp of data.experience) {
      totalLinesEstimate += 2 + exp.bullets.length;
    }
    for (const proj of data.projects) {
      totalLinesEstimate += 1 + proj.bullets.length;
    }
    totalLinesEstimate += data.education.length * 2;
    totalLinesEstimate += data.skills.length * 2;

    const pageCountEstimate = Math.ceil(totalLinesEstimate / 48);
    const overflowPassed = totalLinesEstimate <= 100;
    checks.push({
      name: 'Page Density & Overflow',
      passed: overflowPassed,
      details: `Estimated ~${pageCountEstimate} standard page(s) (${totalLinesEstimate} visual lines).`,
    });
    if (pageCountEstimate > 2) {
      warnings.push('Resume length may exceed standard 2 pages on default print margins.');
    }

    const atsRes = atsAnalyzer.analyzeAtsCompatibility(data);

    return {
      isValid: blockers.length === 0,
      warnings,
      blockers,
      atsScore: atsRes.overallAtsScore,
      checks,
    };
  }

  /**
   * Generates a clean ATS-friendly plain-text version suitable for plain-text upload or terminal viewing
   */
  public generatePlainText(data: ResumeData): string {
    const lines: string[] = [];

    // Header
    lines.push(data.personal_info.name.toUpperCase());
    const contacts: string[] = [];
    if (data.personal_info.email) contacts.push(data.personal_info.email);
    if (data.personal_info.phone) contacts.push(data.personal_info.phone);
    if (data.personal_info.location) contacts.push(data.personal_info.location);
    lines.push(contacts.join(' | '));

    const links: string[] = [];
    if (data.personal_info.linkedin) links.push(`LinkedIn: ${data.personal_info.linkedin}`);
    if (data.personal_info.github) links.push(`GitHub: ${data.personal_info.github}`);
    if (data.personal_info.portfolio) links.push(`Portfolio: ${data.personal_info.portfolio}`);
    if (links.length > 0) lines.push(links.join(' | '));

    lines.push('');

    // Summary
    if (data.summary) {
      lines.push('PROFESSIONAL SUMMARY');
      lines.push('--------------------');
      lines.push(data.summary);
      lines.push('');
    }

    // Skills
    if (data.skills.length > 0) {
      lines.push('TECHNICAL SKILLS');
      lines.push('----------------');
      for (const g of data.skills) {
        lines.push(`${g.category}: ${g.items.join(', ')}`);
      }
      lines.push('');
    }

    // Experience
    if (data.experience.length > 0) {
      lines.push('WORK EXPERIENCE');
      lines.push('---------------');
      for (const exp of data.experience) {
        lines.push(`${exp.role} - ${exp.company} (${exp.startDate} - ${exp.endDate})`);
        if (exp.location) lines.push(`Location: ${exp.location}`);
        for (const b of exp.bullets) {
          lines.push(`  * ${b}`);
        }
        if (exp.technologies && exp.technologies.length > 0) {
          lines.push(`    Technologies: ${exp.technologies.join(', ')}`);
        }
        lines.push('');
      }
    }

    // Projects
    if (data.projects && data.projects.length > 0) {
      lines.push('KEY PROJECTS');
      lines.push('------------');
      for (const proj of data.projects) {
        lines.push(`${proj.title}${proj.link ? ` [${proj.link}]` : ''}`);
        if (proj.technologies && proj.technologies.length > 0) {
          lines.push(`Technologies: ${proj.technologies.join(', ')}`);
        }
        for (const b of proj.bullets) {
          lines.push(`  * ${b}`);
        }
        lines.push('');
      }
    }

    // Education
    if (data.education.length > 0) {
      lines.push('EDUCATION');
      lines.push('---------');
      for (const edu of data.education) {
        lines.push(`${edu.degree} - ${edu.institution} (${edu.startDate} - ${edu.endDate})`);
        if (edu.fieldOfStudy) lines.push(`Field: ${edu.fieldOfStudy}`);
        if (edu.gpa) lines.push(`GPA: ${edu.gpa}`);
      }
      lines.push('');
    }

    // Certifications
    if (data.certifications && data.certifications.length > 0) {
      lines.push('CERTIFICATIONS');
      lines.push('--------------');
      for (const cert of data.certifications) {
        lines.push(`* ${cert.name} - ${cert.issuer} (${cert.date})`);
      }
      lines.push('');
    }

    // Achievements
    if (data.achievements && data.achievements.length > 0) {
      lines.push('ACHIEVEMENTS');
      lines.push('------------');
      for (const ach of data.achievements) {
        lines.push(`* ${ach.title}: ${ach.description}`);
      }
    }

    return lines.join('\n');
  }
}

export const exportEngine = new ExportEngine();
