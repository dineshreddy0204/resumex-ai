import type { ResumeData, ExtractedProvenance } from '../types';
import type { ParsedDocumentResult } from './documentParser';
import { skillExtractor } from './skillExtractor';

export class ResumeExtractor {
  public extractStructuredResume(parsed: ParsedDocumentResult): {
    data: ResumeData;
    provenance: ExtractedProvenance[];
  } {
    const rawText = parsed.text;
    const lines = parsed.lines;
    const provenance: ExtractedProvenance[] = [];

    // 1. Personal Information extraction
    const personal_info = this.extractPersonalInfo(lines, parsed.sections, provenance);

    // 2. Summary
    const summary = this.extractSummary(parsed.sections, provenance);

    // 3. Experience
    const experience = this.extractExperience(parsed.sections, lines, provenance);

    // 4. Education
    const education = this.extractEducation(parsed.sections, lines, provenance);

    // 5. Projects
    const projects = this.extractProjects(parsed.sections, lines, provenance);

    // 6. Certifications
    const certifications = this.extractCertifications(parsed.sections, lines, provenance);

    // 7. Achievements
    const achievements = this.extractAchievements(parsed.sections, lines, provenance);

    // 8. Skills - from dedicated skills section + overall text
    const skills = this.extractSkills(parsed.sections, rawText, provenance);

    const data: ResumeData = {
      personal_info,
      summary,
      skills,
      experience,
      education,
      projects,
      certifications,
      achievements,
      links: [
        ...(personal_info.linkedin ? [{ label: 'LinkedIn', url: personal_info.linkedin }] : []),
        ...(personal_info.github ? [{ label: 'GitHub', url: personal_info.github }] : []),
        ...(personal_info.portfolio ? [{ label: 'Portfolio', url: personal_info.portfolio }] : []),
      ],
    };

    return { data, provenance };
  }

  private extractPersonalInfo(
    lines: string[],
    sections: ParsedDocumentResult['sections'],
    provenance: ExtractedProvenance[]
  ): ResumeData['personal_info'] {
    // Look in header section or first 12 lines
    const headerSection = sections.find((s) => s.standardName === 'header');
    const searchLines = headerSection ? headerSection.content : lines.slice(0, 10);
    const searchBlock = searchLines.join(' \n ');

    // Name detection: usually line 0 or line with only 2-3 capitalized words, not an email/phone/url
    let name = 'Candidate Name';
    for (const l of searchLines) {
      const clean = l.replace(/[^a-zA-Z\s]/g, '').trim();
      const words = clean.split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 4 &&
        !l.includes('@') &&
        !l.toLowerCase().includes('curriculum') &&
        !l.toLowerCase().includes('resume') &&
        !l.toLowerCase().includes('http')
      ) {
        name = clean;
        provenance.push({
          field: 'personal_info.name',
          sourceText: l,
          section: 'header',
          confidence: 0.95,
        });
        break;
      }
    }

    // Email
    const emailMatch = searchBlock.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';
    if (email) {
      provenance.push({
        field: 'personal_info.email',
        sourceText: email,
        section: 'header',
        confidence: 0.99,
      });
    }

    // Phone
    const phoneMatch = searchBlock.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0] : '';
    if (phone) {
      provenance.push({
        field: 'personal_info.phone',
        sourceText: phone,
        section: 'header',
        confidence: 0.96,
      });
    }

    // LinkedIn
    const linkedinMatch = searchBlock.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    const linkedin = linkedinMatch ? (linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`) : '';

    // GitHub
    const githubMatch = searchBlock.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
    const github = githubMatch ? (githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`) : '';

    // Portfolio
    const portfolioMatch = searchBlock.match(/(?:https?:\/\/)(?!linkedin|github)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*/i);
    const portfolio = portfolioMatch ? portfolioMatch[0] : '';

    // Location: look for City, State / Country pattern e.g., "San Francisco, CA" or "New York, NY"
    let location = '';
    const locMatch = searchBlock.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?|[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z]+)/);
    if (locMatch) {
      location = locMatch[0].trim();
      provenance.push({
        field: 'personal_info.location',
        sourceText: location,
        section: 'header',
        confidence: 0.9,
      });
    }

    return { name, email, phone, location, linkedin, github, portfolio };
  }

  private extractSummary(sections: ParsedDocumentResult['sections'], provenance: ExtractedProvenance[]): string {
    const summarySec = sections.find((s) => s.standardName === 'summary');
    if (!summarySec || summarySec.content.length === 0) return '';
    const text = summarySec.content.join(' ').trim();
    provenance.push({
      field: 'summary',
      sourceText: text.substring(0, 100) + '...',
      section: 'summary',
      confidence: 0.95,
    });
    return text;
  }

  private extractExperience(
    sections: ParsedDocumentResult['sections'],
    _lines: string[],
    provenance: ExtractedProvenance[]
  ): ResumeData['experience'] {
    const expSec = sections.find((s) => s.standardName === 'experience');
    if (!expSec || expSec.content.length === 0) return [];

    const items: ResumeData['experience'] = [];
    let currentExp: ResumeData['experience'][0] | null = null;

    // Standard date patterns: "2021 - 2024", "Mar 2020 - Present", "05/2019 - 08/2021"
    const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:-|–|—|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current)/i;

    for (const line of expSec.content) {
      const dateMatch = line.match(dateRegex);
      const isBullet = /^[•\-\*\▪\◦\–\—\>]\s+/.test(line);

      if (dateMatch && !isBullet) {
        // New experience item boundary
        if (currentExp) {
          items.push(currentExp);
        }

        const dateRange = dateMatch[0];
        const [startDate, endDate] = dateRange.split(/(?:-|–|—|to)/i).map((s) => s.trim());
        const remainder = line.replace(dateRegex, '').trim();
        const parts = remainder.split(/(?:\||,|–|-|at)\s+/).map((p) => p.trim()).filter(Boolean);

        const role = parts[0] || 'Software Engineer';
        const company = parts[1] || parts[0] || 'Technology Company';

        currentExp = {
          id: `exp-${items.length + 1}`,
          company: company.replace(/[^a-zA-Z0-9\s&.]/g, '').trim(),
          role: role.replace(/[^a-zA-Z0-9\s&.]/g, '').trim(),
          startDate: startDate || '2021',
          endDate: endDate || 'Present',
          bullets: [],
          technologies: [],
        };
      } else if (currentExp) {
        const cleanBullet = line.replace(/^[•\-\*\▪\◦\–\—\>]\s*/, '').trim();
        if (cleanBullet.length > 5) {
          currentExp.bullets.push(cleanBullet);
          // detect tech inside bullet
          const extractedSkills = skillExtractor.extractSkills(cleanBullet);
          for (const s of extractedSkills) {
            if (!currentExp.technologies?.includes(s.normalizedName)) {
              currentExp.technologies?.push(s.normalizedName);
            }
          }
        }
      }
    }

    if (currentExp) {
      items.push(currentExp);
    }

    // Fallback if formatting was dense
    if (items.length === 0 && expSec.content.length > 0) {
      items.push({
        id: 'exp-1',
        company: 'Professional Experience',
        role: 'Role Title',
        startDate: '2021',
        endDate: 'Present',
        bullets: expSec.content.filter((c) => c.length > 10),
      });
    }

    provenance.push({
      field: 'experience',
      sourceText: `Extracted ${items.length} employment roles.`,
      section: 'experience',
      confidence: items.length > 0 ? 0.92 : 0.4,
    });

    return items;
  }

  private extractEducation(
    sections: ParsedDocumentResult['sections'],
    _lines: string[],
    provenance: ExtractedProvenance[]
  ): ResumeData['education'] {
    const eduSec = sections.find((s) => s.standardName === 'education');
    if (!eduSec || eduSec.content.length === 0) return [];

    const items: ResumeData['education'] = [];
    let currentEdu: ResumeData['education'][0] | null = null;

    const degreeKeywords = /(?:Bachelor|Master|B\.S\.|M\.S\.|Ph\.D\.|B\.A\.|M\.A\.|Associate|Diploma|Doctorate)/i;
    const dateRegex = /\b(19\d{2}|20\d{2})\b/g;

    for (const line of eduSec.content) {
      const isDegreeLine = degreeKeywords.test(line);
      const dates = line.match(dateRegex);

      if (isDegreeLine || (dates && !currentEdu)) {
        if (currentEdu) {
          items.push(currentEdu);
        }
        const degMatch = line.match(degreeKeywords);
        const degree = degMatch ? line.trim() : 'Bachelor of Science';
        currentEdu = {
          id: `edu-${items.length + 1}`,
          institution: 'University',
          degree: degree,
          startDate: dates && dates[0] ? dates[0] : '2016',
          endDate: dates && dates[1] ? dates[1] : (dates && dates[0] ? dates[0] : '2020'),
        };
      } else if (currentEdu) {
        if (line.toLowerCase().includes('university') || line.toLowerCase().includes('college') || line.toLowerCase().includes('institute')) {
          currentEdu.institution = line.trim();
        } else if (line.toLowerCase().includes('gpa')) {
          const gpaMatch = line.match(/gpa[:\s]*([0-4]\.\d{1,2})/i);
          if (gpaMatch) currentEdu.gpa = gpaMatch[1];
        }
      }
    }

    if (currentEdu) {
      items.push(currentEdu);
    }

    if (items.length === 0 && eduSec.content.length > 0) {
      items.push({
        id: 'edu-1',
        institution: eduSec.content[0] || 'University',
        degree: eduSec.content[1] || 'Bachelor of Science in Computer Science',
        startDate: '2016',
        endDate: '2020',
      });
    }

    provenance.push({
      field: 'education',
      sourceText: `Extracted ${items.length} educational degrees.`,
      section: 'education',
      confidence: items.length > 0 ? 0.94 : 0.3,
    });

    return items;
  }

  private extractProjects(
    sections: ParsedDocumentResult['sections'],
    _lines: string[],
    provenance: ExtractedProvenance[]
  ): ResumeData['projects'] {
    const projSec = sections.find((s) => s.standardName === 'projects');
    if (!projSec || projSec.content.length === 0) return [];

    const items: ResumeData['projects'] = [];
    let currentProj: ResumeData['projects'][0] | null = null;

    for (const line of projSec.content) {
      const isBullet = /^[•\-\*\▪\◦\–\—\>]\s+/.test(line);
      const isHeaderLike = !isBullet && line.length < 60 && !line.includes('http');

      if (isHeaderLike) {
        if (currentProj) items.push(currentProj);
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        currentProj = {
          id: `proj-${items.length + 1}`,
          title: line.replace(/https?:\/\/[^\s]+/g, '').trim(),
          link: urlMatch ? urlMatch[0] : undefined,
          technologies: [],
          bullets: [],
        };
      } else if (currentProj) {
        const cleanBullet = line.replace(/^[•\-\*\▪\◦\–\—\>]\s*/, '').trim();
        if (cleanBullet.length > 5) {
          currentProj.bullets.push(cleanBullet);
          const detectedSkills = skillExtractor.extractSkills(cleanBullet);
          for (const s of detectedSkills) {
            if (!currentProj.technologies.includes(s.normalizedName)) {
              currentProj.technologies.push(s.normalizedName);
            }
          }
        }
      }
    }

    if (currentProj) items.push(currentProj);

    provenance.push({
      field: 'projects',
      sourceText: `Extracted ${items.length} technical projects.`,
      section: 'projects',
      confidence: 0.9,
    });

    return items;
  }

  private extractCertifications(
    sections: ParsedDocumentResult['sections'],
    _lines: string[],
    provenance: ExtractedProvenance[]
  ): ResumeData['certifications'] {
    const certSec = sections.find((s) => s.standardName === 'certifications');
    if (!certSec || certSec.content.length === 0) return [];

    const items: ResumeData['certifications'] = [];
    for (let i = 0; i < certSec.content.length; i++) {
      const line = certSec.content[i].replace(/^[•\-\*\▪\◦\–\—\>]\s*/, '').trim();
      if (line.length > 3) {
        const parts = line.split(/(?:–|-|\||,)\s*/);
        items.push({
          id: `cert-${i + 1}`,
          name: parts[0]?.trim() || line,
          issuer: parts[1]?.trim() || 'Accredited Authority',
          date: '2023',
        });
      }
    }

    provenance.push({
      field: 'certifications',
      sourceText: `Extracted ${items.length} certifications.`,
      section: 'certifications',
      confidence: 0.92,
    });

    return items;
  }

  private extractAchievements(
    sections: ParsedDocumentResult['sections'],
    _lines: string[],
    provenance: ExtractedProvenance[]
  ): ResumeData['achievements'] {
    const achSec = sections.find((s) => s.standardName === 'achievements');
    if (!achSec || achSec.content.length === 0) return [];

    const items: ResumeData['achievements'] = [];
    for (let i = 0; i < achSec.content.length; i++) {
      const line = achSec.content[i].replace(/^[•\-\*\▪\◦\–\—\>]\s*/, '').trim();
      if (line.length > 10) {
        items.push({
          id: `ach-${i + 1}`,
          title: line.substring(0, 50),
          description: line,
        });
      }
    }

    provenance.push({
      field: 'achievements',
      sourceText: `Extracted ${items.length} achievements.`,
      section: 'achievements',
      confidence: 0.88,
    });

    return items;
  }

  private extractSkills(
    sections: ParsedDocumentResult['sections'],
    rawText: string,
    provenance: ExtractedProvenance[]
  ): ResumeData['skills'] {
    const skillsSec = sections.find((s) => s.standardName === 'skills');
    const targetText = skillsSec ? skillsSec.content.join(' \n ') : rawText;

    const extracted = skillExtractor.extractSkills(targetText);

    // Group by categories
    const categoryMap = new Map<string, Set<string>>();

    for (const item of extracted) {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, new Set());
      }
      categoryMap.get(item.category)!.add(item.normalizedName);
    }

    const result: ResumeData['skills'] = [];
    for (const [category, skillSet] of categoryMap.entries()) {
      result.push({
        category,
        items: Array.from(skillSet),
      });
    }

    provenance.push({
      field: 'skills',
      sourceText: `Extracted ${extracted.length} normalized skills across ${result.length} categories.`,
      section: 'skills',
      confidence: 0.95,
    });

    return result;
  }
}

export const resumeExtractor = new ResumeExtractor();
