import { skillExtractor } from './skillExtractor';
import type { JobDescriptionModel } from '../types';

export class JdAnalyzer {
  public parseJobDescription(rawText: string, title?: string, company?: string): Omit<JobDescriptionModel, 'id' | 'userId' | 'createdAt'> {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    // 1. Title detection if not provided
    let detectedTitle = title || '';
    if (!detectedTitle && lines.length > 0) {
      for (const line of lines.slice(0, 5)) {
        if (/role:|position:|title:/i.test(line)) {
          detectedTitle = line.replace(/^(?:role|position|title)[:\s-]+/i, '').trim();
          break;
        } else if (line.length < 50 && !line.includes('@') && !line.includes('http')) {
          detectedTitle = line;
          break;
        }
      }
    }
    if (!detectedTitle) detectedTitle = 'Software Engineering Role';

    // 2. Extract Skills with context
    const allExtractedSkills = skillExtractor.extractSkills(rawText);

    // Differentiate Required vs Preferred
    const requiredSkills: string[] = [];
    const preferredSkills: string[] = [];

    let currentContext: 'general' | 'required' | 'preferred' = 'general';

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (/requirements|required|qualifications|must have|what you'll need|minimum qualifications/i.test(lower)) {
        currentContext = 'required';
      } else if (/nice to have|preferred|bonus|plus|desirable|what will set you apart/i.test(lower)) {
        currentContext = 'preferred';
      }

      const lineSkills = skillExtractor.extractSkills(line);
      for (const s of lineSkills) {
        if (currentContext === 'preferred') {
          if (!preferredSkills.includes(s.normalizedName)) preferredSkills.push(s.normalizedName);
        } else {
          if (!requiredSkills.includes(s.normalizedName)) requiredSkills.push(s.normalizedName);
        }
      }
    }

    // Fallback: distribute extracted skills if sections weren't clearly demarcated
    if (requiredSkills.length === 0 && allExtractedSkills.length > 0) {
      const splitPoint = Math.ceil(allExtractedSkills.length * 0.7);
      for (let i = 0; i < allExtractedSkills.length; i++) {
        if (i < splitPoint) {
          requiredSkills.push(allExtractedSkills[i].normalizedName);
        } else {
          preferredSkills.push(allExtractedSkills[i].normalizedName);
        }
      }
    }

    // 3. Extract Responsibilities
    const responsibilities: string[] = [];
    let inRespBlock = false;
    for (const line of lines) {
      if (/responsibilities|what you'll do|duties|the role/i.test(line)) {
        inRespBlock = true;
        continue;
      }
      if (inRespBlock) {
        if (/requirements|qualifications|about you|benefits/i.test(line)) {
          inRespBlock = false;
        } else if (/^[•\-\*\▪\◦\–\—\>]\s+/.test(line) || line.length > 20) {
          responsibilities.push(line.replace(/^[•\-\*\▪\◦\–\—\>]\s*/, '').trim());
          if (responsibilities.length >= 8) break;
        }
      }
    }

    // 4. Extract Experience Years
    let experienceYears = 3;
    const expMatch = rawText.match(/(\d+)\+?\s*(?:-\s*(\d+))?\s*(?:years|yrs)\b/i);
    if (expMatch) {
      experienceYears = parseInt(expMatch[1], 10);
    }

    // 5. Seniority Level
    let seniorityLevel: JobDescriptionModel['seniorityLevel'] = 'Mid';
    const textLower = rawText.toLowerCase();
    if (/intern|graduate|fresher|entry-level|junior|jr\./i.test(textLower)) {
      seniorityLevel = 'Entry';
    } else if (/lead|staff|principal|architect|director|vp|head of/i.test(textLower)) {
      seniorityLevel = textLower.includes('principal') || textLower.includes('director') ? 'Executive' : 'Lead';
    } else if (/senior|sr\./i.test(textLower)) {
      seniorityLevel = 'Senior';
    }

    // 6. Education
    let educationRequired: string | undefined;
    const eduMatch = rawText.match(/(?:bachelor|master|ph\.?d|degree in [a-zA-Z\s]+|bs|ms)\b[^\n.]*/i);
    if (eduMatch) {
      educationRequired = eduMatch[0].trim();
    }

    // 7. Domain Keywords
    const domainKeywords = [
      'Distributed Systems',
      'Microservices',
      'Cloud Architecture',
      'Scalability',
      'High-Throughput',
      'Security',
      'CI/CD Automation',
      'Agile',
      'Code Review',
    ].filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(rawText));

    return {
      title: detectedTitle,
      company: company || 'Hiring Organization',
      rawText,
      requiredSkills,
      preferredSkills,
      responsibilities,
      experienceYearsRequired: experienceYears,
      seniorityLevel,
      educationRequired,
      domainKeywords,
    };
  }
}

export const jdAnalyzer = new JdAnalyzer();
