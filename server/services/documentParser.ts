import mammoth from 'mammoth';
import zlib from 'zlib';
import { PDFParse } from 'pdf-parse';
import { getGeminiClient, isGeminiAvailable, getGeminiModel } from '../gemini';

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
  summary: [
    'summary',
    'professional summary',
    'executive summary',
    'career summary',
    'career objective',
    'about me',
    'profile',
    'personal profile',
    'professional profile',
    'biography',
    'overview',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'employment history',
    'work history',
    'career history',
    'professional background',
    'relevant experience',
    'selected experience',
    'experience & employment',
    'employment',
    'industry experience',
  ],
  education: [
    'education',
    'academic background',
    'educational background',
    'academic qualifications',
    'degrees',
    'education & credentials',
    'academic history',
    'education & training',
    'academic credentials',
    'academic qualifications & education',
  ],
  skills: [
    'skills',
    'technical skills',
    'core competencies',
    'skills & abilities',
    'technologies',
    'technical proficiencies',
    'areas of expertise',
    'tools & technologies',
    'technical stack',
    'tech tooling',
    'technical expertise',
    'technical toolbox',
    'key skills',
    'competencies',
    'technical skills & competencies',
  ],
  projects: [
    'projects',
    'key projects',
    'personal projects',
    'technical projects',
    'open source projects',
    'portfolio',
    'selected projects',
    'featured projects',
    'notable projects',
  ],
  certifications: [
    'certifications',
    'licenses',
    'credentials',
    'certifications & licenses',
    'courses & certificates',
    'licenses & certifications',
    'certifications & credentials',
    'professional certifications',
  ],
  achievements: [
    'achievements',
    'key achievements',
    'honors',
    'awards',
    'honors & awards',
    'accomplishments',
    'selected accomplishments',
    'notable accomplishments',
    'accolades',
  ],
  publications: ['publications', 'research', 'papers', 'articles', 'whitepapers', 'presentations'],
};

export class DocumentParser {
  /**
   * Cleans and normalizes UTF-8 text, eliminating non-printable control characters,
   * standardizing typographic dashes, quotes, and bullet symbols.
   */
  public cleanAndNormalizeText(rawText: string): string {
    if (!rawText) return '';

    return rawText
      // Replace non-breaking spaces with standard ASCII space
      .replace(/\u00A0/g, ' ')
      // Replace non-standard whitespace characters with single space
      .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      // Normalize typographic single quotes and apostrophes
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      // Normalize typographic double quotes
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      // Normalize typographic dashes / hyphens
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
      // Normalize diverse bullet characters to standard bullet symbol
      .replace(/^[\t ]*[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u25B8\u2042\u2013\u2014\*]\s*/gm, '• ')
      // Strip control characters (except newline, carriage return, tab)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize carriage returns to standard newlines
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Detects side-by-side columns in multi-column formatted resumes and de-columnizes
   * the text into distinct linear sequences so section headings and contents are not interlaced.
   */
  public deColumnizeText(rawText: string): { text: string; wasDeColumnized: boolean } {
    const lines = rawText.split('\n');
    const columnSplitRegex = /\s{5,}|\t{2,}/;
    let splitCandidateCount = 0;

    for (const line of lines) {
      if (columnSplitRegex.test(line) && line.trim().length > 20) {
        splitCandidateCount++;
      }
    }

    // If more than 20% of lines show distinct wide gutters, de-columnize
    if (splitCandidateCount >= 5 && splitCandidateCount / Math.max(1, lines.length) > 0.15) {
      const leftColumnLines: string[] = [];
      const rightColumnLines: string[] = [];

      for (const line of lines) {
        const parts = line.split(columnSplitRegex);
        if (parts.length >= 2) {
          const left = parts[0].trim();
          const right = parts.slice(1).join(' ').trim();
          if (left) leftColumnLines.push(left);
          if (right) rightColumnLines.push(right);
        } else {
          // If line has no gutter, associate with left column
          if (line.trim()) leftColumnLines.push(line.trim());
        }
      }

      const deColumnized = [...leftColumnLines, '', ...rightColumnLines].join('\n');
      return { text: deColumnized, wasDeColumnized: true };
    }

    return { text: rawText, wasDeColumnized: false };
  }

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
      // 1. Primary extraction via PDFParse
      try {
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        extractedText = pdfData?.text || '';
        pageCount = pdfData?.total || 1;
        await parser.destroy();
      } catch (pdfErr) {
        console.warn('pdf-parse primary parser error, falling back to stream decompressor:', pdfErr);
      }

      // 2. Secondary fallback: direct decompression of PDF FlateDecode streams
      if (!extractedText || extractedText.trim().length < 40) {
        try {
          const streamText = this.extractPdfTextFromStreams(buffer);
          if (streamText && streamText.trim().length >= 40) {
            extractedText = streamText;
          }
        } catch (streamErr) {
          console.warn('Stream decompressor error:', streamErr);
        }
      }

      // 3. Multimodal Vision OCR fallback for image-only/scanned PDFs
      if (!extractedText || extractedText.trim().length < 40) {
        ocrTriggered = true;
        extractedText = await this.performOcrFallback(buffer);
      }
    } else {
      // Default to UTF-8 text
      extractedText = buffer.toString('utf-8');
    }

    // Clean and normalize UTF-8 text (strip control characters, standardize quotes/dashes/bullets)
    let cleanedText = this.cleanAndNormalizeText(extractedText);

    if (!cleanedText || cleanedText.length === 0) {
      throw new Error(
        'Could not extract resume data. Please review the uploaded document.'
      );
    }

    // Detect and de-columnize multi-column layouts to preserve logical section order
    const { text: processedText, wasDeColumnized } = this.deColumnizeText(cleanedText);

    const layout = this.analyzeTextLayout(processedText);
    layout.layoutInfo.detectedPageCountEstimate = pageCount;
    layout.layoutInfo.ocrTriggered = ocrTriggered;
    if (wasDeColumnized) {
      layout.layoutInfo.hasMultiColumnClues = true;
    }
    return layout;
  }

  /**
   * OCR Fallback Service: attempts Gemini multimodal document vision extraction
   * for image-only or scanned PDFs lacking a selectable text layer.
   */
  private async performOcrFallback(buffer: Buffer): Promise<string> {
    // 1. Multimodal OCR via Gemini
    if (isGeminiAvailable()) {
      try {
        const client = getGeminiClient();
        if (client) {
          const resp = await client.models.generateContent({
            model: getGeminiModel(),
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: buffer.toString('base64'),
                    },
                  },
                  {
                    text: 'Perform verbatim OCR transcription of this resume document. Extract all readable text, preserving full sections, candidate contact details, work history bullets, metrics, and technical skills. Return pure extracted text with standard section headings.',
                  },
                ],
              },
            ],
          });

          if (resp.text && resp.text.trim().length > 40) {
            return resp.text.trim();
          }
        }
      } catch (ocrErr) {
        console.warn('[DocumentParser] Multimodal OCR attempt encountered an issue:', ocrErr);
      }
    }

    // 2. Fail gracefully if unreadable — DO NOT return binary bytecode or dummy data!
    throw new Error(
      'Unable to extract readable text from this PDF. Please ensure your PDF is not an image-only scan, or upload a DOCX file or build your resume manually.'
    );
  }

  /**
   * Safe text extraction from decompressed PDF stream chunks (FlateDecode)
   */
  public extractPdfTextFromStreams(buffer: Buffer): string {
    const raw = buffer.toString('latin1');
    const textPieces: string[] = [];

    // Find all stream ... endstream blocks in PDF
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    while ((match = streamRegex.exec(raw)) !== null) {
      const rawStream = Buffer.from(match[1], 'latin1');
      let decompressed = '';
      try {
        decompressed = zlib.inflateSync(rawStream).toString('latin1');
      } catch {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString('latin1');
        } catch {
          decompressed = rawStream.toString('latin1');
        }
      }

      // Extract Tj text operator (string in parentheses)
      const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*T[jJ]/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
        const unescaped = tjMatch[1]
          .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (unescaped.trim().length > 0) {
          textPieces.push(unescaped);
        }
      }

      // Extract TJ array text operator [ (text) -10 (more) ] TJ
      const arrayRegex = /\[(.*?)\]\s*TJ/gi;
      let arrMatch;
      while ((arrMatch = arrayRegex.exec(decompressed)) !== null) {
        const subTj = /\(((?:[^()\\]|\\.)*)\)/g;
        let sMatch;
        let subPiece = '';
        while ((sMatch = subTj.exec(arrMatch[1])) !== null) {
          subPiece += sMatch[1]
            .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');
        }
        if (subPiece.trim().length > 0) {
          textPieces.push(subPiece);
        }
      }
    }

    if (textPieces.length > 0) {
      const joined = textPieces.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (joined.length >= 40) {
        return joined;
      }
    }

    return '';
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
