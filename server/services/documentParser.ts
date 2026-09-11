import mammoth from 'mammoth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export interface ParsedDocumentResult {
  text: string;
  lines: string[];
  sections: {
    name: string;
    standardName: string;
    content: string[];
    startIndex: number;
    endIndex: number;
  }[];
  layoutInfo: {
    lineCount: number;
    characterCount: number;
    isMachineReadable: boolean;
    hasMultiColumnClues: boolean;
    hasTableClues: boolean;
    bulletCount: number;
    detectedPageCountEstimate: number;
    ocrTriggered?: boolean;
  };
}

const SECTION_TAXONOMY: Record<string, string[]> = {
  summary: ['summary', 'professional summary', 'executive summary', 'career objective', 'about me', 'profile', 'personal profile'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'work history', 'career history'],
  education: ['education', 'academic background', 'educational background', 'academic qualifications', 'degrees', 'education & credentials'],
  skills: ['skills', 'technical skills', 'core competencies', 'skills & abilities', 'technologies', 'technical proficiencies', 'areas of expertise', 'tools & technologies'],
  projects: ['projects', 'key projects', 'personal projects', 'technical projects', 'open source projects', 'portfolio'],
  certifications: ['certifications', 'licenses', 'credentials', 'certifications & licenses', 'courses & certificates'],
  achievements: ['achievements', 'key achievements', 'honors', 'awards', 'honors & awards', 'accomplishments'],
  publications: ['publications', 'research', 'papers', 'articles', 'whitepapers'],
};

export class DocumentParser {
  /**
   * Parse text from either raw text, base64 payload, or buffer
   */
  public async parseDocument(buffer: Buffer, mimeType: string, fileName?: string): Promise<ParsedDocumentResult> {
    let extractedText = '';
    let pageCount = 1;
    let ocrTriggered = false;

    if (mimeType.includes('wordprocessingml') || fileName?.endsWith('.docx')) {
      try {
        const docxResult = await mammoth.extractRawText({ buffer });
        extractedText = docxResult.value;
      } catch (err) {
        console.error('Mammoth docx parse error:', err);
        extractedText = buffer.toString('utf-8');
      }
    } else if (mimeType.includes('pdf') || fileName?.endsWith('.pdf')) {
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || '';
        pageCount = pdfData.numpages || 1;
      } catch (pdfErr) {
        console.warn('pdf-parse primary parser error, using stream fallback:', pdfErr);
        extractedText = this.extractPdfTextFallback(buffer);
      }

      // OCR Fallback Pipeline check
      if (!extractedText || extractedText.trim().length < 40) {
        ocrTriggered = true;
        extractedText = await this.performOcrFallback(buffer);
      }
    } else {
      // Default to UTF-8
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error(
        'The uploaded document contains no extractable text. Please ensure it is a digital PDF or DOCX file rather than a scanned image.'
      );
    }

    const layout = this.analyzeTextLayout(extractedText);
    layout.layoutInfo.detectedPageCountEstimate = pageCount;
    layout.layoutInfo.ocrTriggered = ocrTriggered;
    return layout;
  }

  /**
   * OCR Fallback Service abstraction
   */
  private async performOcrFallback(buffer: Buffer): Promise<string> {
    // Check if buffer contains stream text or standard fallback
    const fallbackText = this.extractPdfTextFallback(buffer);
    if (fallbackText && fallbackText.trim().length > 50) {
      return fallbackText;
    }
    // If truly an image-only scan
    throw new Error(
      'Document appears to be a scanned image or photograph without an accessible text layer. ResumeX AI requires machine-readable text for accurate ATS scoring and semantic entity extraction. Please upload an exported PDF or DOCX.'
    );
  }

  /**
   * Safe text extraction from PDF stream chunks
   */
  public extractPdfTextFallback(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    const textPieces: string[] = [];

    // Look for BT ... ET stream blocks (standard PDF text representation)
    const streamRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = streamRegex.exec(raw)) !== null) {
      const block = match[1];
      // Extract string literals in parentheses (text) or hex <...>
      const strRegex = /\((.*?)\)\s*T[jJ]|\<([0-9a-fA-F]+)\>\s*T[jJ]/g;
      let textMatch;
      while ((textMatch = strRegex.exec(block)) !== null) {
        if (textMatch[1]) {
          // unescape standard PDF escape characters
          const unescaped = textMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');
          textPieces.push(unescaped);
        } else if (textMatch[2]) {
          // Hex string
          try {
            const hexBuf = Buffer.from(textMatch[2], 'hex');
            textPieces.push(hexBuf.toString('utf-8'));
          } catch {
            // ignore
          }
        }
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join(' ').replace(/\s{2,}/g, ' ');
    }

    // Fallback: extract any printable strings longer than 3 chars
    const printable = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    const sanitized = printable.replace(/\s{2,}/g, ' ').trim();
    if (sanitized.length > 50) {
      return sanitized;
    }

    throw new Error('Scanned document detected: PDF contains no digital text layer. OCR or digital PDF required.');
  }

  /**
   * Layout analysis and section boundary discovery
   */
  public analyzeTextLayout(rawText: string): ParsedDocumentResult {
    const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const sections: ParsedDocumentResult['sections'] = [];
    let currentSection: ParsedDocumentResult['sections'][0] | null = null;

    let bulletCount = 0;
    let tableClues = 0;
    let multiColumnClues = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // Detect bullet points
      if (/^[•\-\*\▪\◦\–\—\>]\s+/.test(line)) {
        bulletCount++;
      }

      // Detect table / column clues (multiple tabs, wide spacing, pipes)
      if (line.includes('|') || /\t/.test(line) || /\s{4,}/.test(line)) {
        if (line.includes('|')) tableClues++;
        if (/\s{5,}/.test(line)) multiColumnClues++;
      }

      // Check if line is a section heading
      const detectedCategory = this.identifySectionHeading(line);
      if (detectedCategory) {
        if (currentSection) {
          currentSection.endIndex = i - 1;
          sections.push(currentSection);
        }
        currentSection = {
          name: line,
          standardName: detectedCategory,
          content: [],
          startIndex: i,
          endIndex: i,
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      } else {
        // Content before first section is typically personal information / header
        if (!sections.some((s) => s.standardName === 'header')) {
          currentSection = {
            name: 'Contact & Header',
            standardName: 'header',
            content: [line],
            startIndex: i,
            endIndex: i,
          };
        } else {
          sections[0].content.push(line);
        }
      }
    }

    if (currentSection) {
      currentSection.endIndex = rawLines.length - 1;
      sections.push(currentSection);
    }

    const characterCount = rawText.length;
    const isMachineReadable = characterCount > 150 && rawLines.length >= 8;
    const pageEstimate = Math.max(1, Math.ceil(rawLines.length / 55));

    return {
      text: rawText,
      lines: rawLines,
      sections,
      layoutInfo: {
        lineCount: rawLines.length,
        characterCount,
        isMachineReadable,
        hasMultiColumnClues: multiColumnClues > 4,
        hasTableClues: tableClues > 3,
        bulletCount,
        detectedPageCountEstimate: pageEstimate,
      },
    };
  }

  public identifySectionHeading(line: string): string | null {
    // Only headings under 60 characters
    if (line.length > 60) return null;
    const cleaned = line.replace(/[^a-zA-Z0-9\s]/g, '').trim().toLowerCase();

    for (const [standardKey, aliases] of Object.entries(SECTION_TAXONOMY)) {
      if (aliases.includes(cleaned)) {
        return standardKey;
      }
    }
    return null;
  }
}

export const documentParser = new DocumentParser();
