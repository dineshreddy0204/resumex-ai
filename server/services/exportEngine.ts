import type { ResumeData } from '../types';
import { atsAnalyzer } from './atsAnalyzer';
import { MASTER_TEMPLATES } from './templateEngine';
import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';

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

  /**
   * Generates a fully-styled, professional Word Document (.docx) matching
   * the user's selected resume template typography, colors, and layout structure.
   */
  public async generateDocx(data: ResumeData, templateId: string = 'ats-classic'): Promise<Buffer> {
    const template = MASTER_TEMPLATES.find((t) => t.id === templateId) || MASTER_TEMPLATES[0];

    // Clean hex colors (remove '#' if present)
    const primaryHex = (template.primaryColor || '#0f172a').replace('#', '');
    const secondaryHex = (template.secondaryColor || '#475569').replace('#', '');
    const accentHex = (template.accentColor || '#0284c7').replace('#', '');

    const children: Paragraph[] = [];

    // 1. Candidate Name (Header)
    children.push(
      new Paragraph({
        alignment: template.headerStyle === 'centered' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: data.personal_info?.name || 'Candidate Name',
            bold: true,
            size: 36, // 18pt
            color: primaryHex,
          }),
        ],
      })
    );

    // 2. Contact Information Block
    const contactParts: string[] = [];
    if (data.personal_info?.email) contactParts.push(data.personal_info.email);
    if (data.personal_info?.phone) contactParts.push(data.personal_info.phone);
    if (data.personal_info?.location) contactParts.push(data.personal_info.location);
    if (data.personal_info?.linkedin) contactParts.push(data.personal_info.linkedin);
    if (data.personal_info?.github) contactParts.push(data.personal_info.github);
    if (data.personal_info?.portfolio) contactParts.push(data.personal_info.portfolio);

    if (contactParts.length > 0) {
      children.push(
        new Paragraph({
          alignment: template.headerStyle === 'centered' ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: contactParts.join('  •  '),
              size: 20, // 10pt
              color: secondaryHex,
            }),
          ],
        })
      );
    }

    const createSectionHeader = (title: string): Paragraph => {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        border: {
          bottom: {
            color: accentHex,
            space: 4,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        children: [
          new TextRun({
            text: title.toUpperCase(),
            bold: true,
            size: 22, // 11pt
            color: primaryHex,
          }),
        ],
      });
    };

    // 3. Professional Summary
    if (data.summary && data.summary.trim()) {
      children.push(createSectionHeader('Professional Summary'));
      children.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: data.summary,
              size: 21,
              color: '1e293b',
            }),
          ],
        })
      );
    }

    // 4. Technical Skills
    if (data.skills && data.skills.length > 0) {
      children.push(createSectionHeader('Skills & Competencies'));
      for (const skillGroup of data.skills) {
        if (skillGroup.items && skillGroup.items.length > 0) {
          children.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: `${skillGroup.category}: `,
                  bold: true,
                  size: 21,
                  color: primaryHex,
                }),
                new TextRun({
                  text: skillGroup.items.join(', '),
                  size: 21,
                  color: '334155',
                }),
              ],
            })
          );
        }
      }
    }

    // 5. Work Experience
    if (data.experience && data.experience.length > 0) {
      children.push(createSectionHeader('Work Experience'));
      for (const exp of data.experience) {
        const titleLineParts: string[] = [];
        if (exp.role) titleLineParts.push(exp.role);
        if (exp.company) titleLineParts.push(exp.company);
        const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');

        children.push(
          new Paragraph({
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: exp.role || 'Role',
                bold: true,
                size: 22,
                color: primaryHex,
              }),
              new TextRun({
                text: exp.company ? `  |  ${exp.company}` : '',
                bold: true,
                size: 21,
                color: secondaryHex,
              }),
              new TextRun({
                text: dateRange ? ` (${dateRange})` : '',
                italics: true,
                size: 20,
                color: secondaryHex,
              }),
            ],
          })
        );

        if (exp.location) {
          children.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: exp.location,
                  italics: true,
                  size: 19,
                  color: secondaryHex,
                }),
              ],
            })
          );
        }

        for (const bullet of exp.bullets || []) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: bullet,
                  size: 20,
                  color: '1e293b',
                }),
              ],
            })
          );
        }
      }
    }

    // 6. Projects
    if (data.projects && data.projects.length > 0) {
      children.push(createSectionHeader('Key Projects'));
      for (const proj of data.projects) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: proj.title,
                bold: true,
                size: 21,
                color: primaryHex,
              }),
              new TextRun({
                text: proj.technologies && proj.technologies.length > 0 ? ` [${proj.technologies.join(', ')}]` : '',
                italics: true,
                size: 19,
                color: secondaryHex,
              }),
            ],
          })
        );

        for (const bullet of proj.bullets || []) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: bullet,
                  size: 20,
                  color: '1e293b',
                }),
              ],
            })
          );
        }
      }
    }

    // 7. Education
    if (data.education && data.education.length > 0) {
      children.push(createSectionHeader('Education'));
      for (const edu of data.education) {
        const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
        children.push(
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [
              new TextRun({
                text: edu.degree || 'Degree',
                bold: true,
                size: 21,
                color: primaryHex,
              }),
              new TextRun({
                text: edu.institution ? `  |  ${edu.institution}` : '',
                size: 21,
                color: secondaryHex,
              }),
              new TextRun({
                text: eduDates ? ` (${eduDates})` : '',
                italics: true,
                size: 19,
                color: secondaryHex,
              }),
            ],
          })
        );
        if (edu.gpa) {
          children.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: `GPA: ${edu.gpa}`,
                  size: 19,
                  color: secondaryHex,
                }),
              ],
            })
          );
        }
      }
    }

    // 8. Certifications
    if (data.certifications && data.certifications.length > 0) {
      children.push(createSectionHeader('Certifications'));
      for (const cert of data.certifications) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: cert.name,
                bold: true,
                size: 20,
                color: primaryHex,
              }),
              new TextRun({
                text: cert.issuer ? ` — ${cert.issuer}` : '',
                size: 20,
                color: secondaryHex,
              }),
              new TextRun({
                text: cert.date ? ` (${cert.date})` : '',
                italics: true,
                size: 19,
                color: secondaryHex,
              }),
            ],
          })
        );
      }
    }

    // 9. Achievements
    if (data.achievements && data.achievements.length > 0) {
      children.push(createSectionHeader('Key Achievements'));
      for (const ach of data.achievements) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${ach.title}: `,
                bold: true,
                size: 20,
                color: primaryHex,
              }),
              new TextRun({
                text: ach.description,
                size: 20,
                color: '1e293b',
              }),
            ],
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720, // 0.5 inch
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Generates a fully-styled, professional PDF matching
   * the user's selected resume template typography, colors, and layout structure.
   */
  public async generatePdf(data: ResumeData, templateId: string = 'ats-classic'): Promise<Buffer> {
    const template = MASTER_TEMPLATES.find((t) => t.id === templateId) || MASTER_TEMPLATES[0];
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36; // 0.5 inch in pt
    const contentWidth = pageWidth - margin * 2;
    let cursorY = margin;

    const checkPageBreak = (neededHeight: number) => {
      if (cursorY + neededHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    const hexToRgb = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '');
      const num = parseInt(clean, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    const primaryRgb = hexToRgb(template.primaryColor || '#0f172a');
    const secondaryRgb = hexToRgb(template.secondaryColor || '#475569');
    const accentRgb = hexToRgb(template.accentColor || '#0284c7');

    const fontName = template.fontFamily?.includes('serif')
      ? 'times'
      : template.fontFamily?.includes('mono')
      ? 'courier'
      : 'helvetica';

    // 1. Header Name
    doc.setFont(fontName, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    const name = data.personal_info?.name || 'Candidate Name';
    if (template.headerStyle === 'centered') {
      doc.text(name, pageWidth / 2, cursorY, { align: 'center' });
    } else {
      doc.text(name, margin, cursorY);
    }
    cursorY += 20;

    // 2. Contact details
    const contactParts: string[] = [];
    if (data.personal_info?.email) contactParts.push(data.personal_info.email);
    if (data.personal_info?.phone) contactParts.push(data.personal_info.phone);
    if (data.personal_info?.location) contactParts.push(data.personal_info.location);
    if (data.personal_info?.linkedin) contactParts.push(data.personal_info.linkedin);
    if (data.personal_info?.github) contactParts.push(data.personal_info.github);

    if (contactParts.length > 0) {
      doc.setFont(fontName, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
      const contactLine = contactParts.join('  •  ');
      if (template.headerStyle === 'centered') {
        doc.text(contactLine, pageWidth / 2, cursorY, { align: 'center' });
      } else {
        doc.text(contactLine, margin, cursorY);
      }
      cursorY += 16;
    }

    const renderSectionHeader = (title: string) => {
      checkPageBreak(30);
      cursorY += 8;
      doc.setFont(fontName, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.text(title.toUpperCase(), margin, cursorY);
      cursorY += 4;
      doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.setLineWidth(1);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 14;
    };

    // Summary
    if (data.summary && data.summary.trim()) {
      renderSectionHeader('Professional Summary');
      doc.setFont(fontName, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      const splitSummary = doc.splitTextToSize(data.summary, contentWidth);
      checkPageBreak(splitSummary.length * 13);
      doc.text(splitSummary, margin, cursorY);
      cursorY += splitSummary.length * 13 + 6;
    }

    // Skills
    if (data.skills && data.skills.length > 0) {
      renderSectionHeader('Technical Skills');
      for (const skillGroup of data.skills) {
        if (!skillGroup.items || skillGroup.items.length === 0) continue;
        checkPageBreak(16);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        const catText = `${skillGroup.category}: `;
        doc.text(catText, margin, cursorY);
        const catWidth = doc.getTextWidth(catText);

        doc.setFont(fontName, 'normal');
        doc.setTextColor(50, 50, 50);
        const itemsText = skillGroup.items.join(', ');
        const splitItems = doc.splitTextToSize(itemsText, contentWidth - catWidth);
        doc.text(splitItems, margin + catWidth, cursorY);
        cursorY += splitItems.length * 12 + 2;
      }
    }

    // Experience
    if (data.experience && data.experience.length > 0) {
      renderSectionHeader('Work Experience');
      for (const exp of data.experience) {
        checkPageBreak(30);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(exp.role || 'Role', margin, cursorY);

        const dateRange = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
        if (dateRange) {
          doc.setFont(fontName, 'italic');
          doc.setFontSize(9);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          doc.text(dateRange, pageWidth - margin, cursorY, { align: 'right' });
        }
        cursorY += 13;

        if (exp.company) {
          doc.setFont(fontName, 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          const compLoc = [exp.company, exp.location].filter(Boolean).join('  •  ');
          doc.text(compLoc, margin, cursorY);
          cursorY += 13;
        }

        for (const bullet of exp.bullets || []) {
          doc.setFont(fontName, 'normal');
          doc.setFontSize(9);
          doc.setTextColor(40, 40, 40);
          const splitBullet = doc.splitTextToSize(bullet, contentWidth - 14);
          checkPageBreak(splitBullet.length * 12 + 4);
          doc.text('•', margin + 2, cursorY);
          doc.text(splitBullet, margin + 12, cursorY);
          cursorY += splitBullet.length * 12 + 3;
        }
        cursorY += 6;
      }
    }

    // Education
    if (data.education && data.education.length > 0) {
      renderSectionHeader('Education');
      for (const edu of data.education) {
        checkPageBreak(24);
        doc.setFont(fontName, 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(edu.degree || 'Degree', margin, cursorY);

        const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
        if (eduDates) {
          doc.setFont(fontName, 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          doc.text(eduDates, pageWidth - margin, cursorY, { align: 'right' });
        }
        cursorY += 12;

        if (edu.institution) {
          doc.setFont(fontName, 'normal');
          doc.setFontSize(9);
          doc.setTextColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
          const line = [edu.institution, edu.fieldOfStudy, edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join('  •  ');
          doc.text(line, margin, cursorY);
          cursorY += 12;
        }
      }
    }

    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }
}

export const exportEngine = new ExportEngine();
