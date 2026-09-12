import path from 'path';

export interface UploadValidationResult {
  isValid: boolean;
  sanitizedFileName: string;
  detectedFormat: 'pdf' | 'docx' | 'txt';
  detectedMime?: string;
  error?: string;
}

export class UploadSecurity {
  private static readonly MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

  /**
   * Sanitizes a user-provided file name:
   * - Strips path traversal sequences (../, ..\, etc.)
   * - Removes null bytes and control characters
   * - Restricts characters to safe alphanumeric, spaces, dashes, underscores, and dots
   * - Truncates excessively long names
   */
  public static sanitizeFileName(rawName: string): string {
    if (!rawName) return `resume_${Date.now()}.pdf`;

    // 1. Remove null bytes and non-printable control characters
    let cleaned = rawName.replace(/[\x00-\x1f\x7f]/g, '');

    // 2. Strip directory path parts
    cleaned = path.basename(cleaned);

    // 3. Remove traversal patterns
    cleaned = cleaned.replace(/\.{2,}/g, '.');

    // 4. Strip unsafe characters
    cleaned = cleaned.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim();

    // 5. Ensure safe length
    if (cleaned.length > 120) {
      const ext = path.extname(cleaned);
      const base = path.basename(cleaned, ext);
      cleaned = `${base.substring(0, 110)}${ext}`;
    }

    if (!cleaned || cleaned === '.' || cleaned.startsWith('.')) {
      cleaned = `resume_${Date.now()}.pdf`;
    }

    return cleaned;
  }

  /**
   * Validates file size, extension, MIME type, and deep magic bytes inspection.
   */
  public static validateUpload(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): UploadValidationResult {
    const sanitizedFileName = this.sanitizeFileName(fileName);

    // 1. Check size
    if (!buffer || buffer.length === 0) {
      return {
        isValid: false,
        sanitizedFileName,
        detectedFormat: 'pdf',
        error: 'Uploaded file is empty.',
      };
    }

    if (buffer.length > this.MAX_SIZE_BYTES) {
      return {
        isValid: false,
        sanitizedFileName,
        detectedFormat: 'pdf',
        error: `File size exceeds the 15MB maximum limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`,
      };
    }

    // 2. Inspect Extension
    const ext = path.extname(sanitizedFileName).toLowerCase();
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    if (!allowedExtensions.includes(ext)) {
      return {
        isValid: false,
        sanitizedFileName,
        detectedFormat: 'pdf',
        error: `Unsupported file extension "${ext}". Allowed formats are PDF (.pdf), Word (.docx), and Plain Text (.txt).`,
      };
    }

    // 3. Inspect Magic Bytes / Signatures
    // PDF Magic Bytes: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D) within first 1024 bytes
    if (ext === '.pdf' || mimeType.includes('pdf')) {
      const headerSnippet = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
      if (!headerSnippet.includes('%PDF-')) {
        return {
          isValid: false,
          sanitizedFileName,
          detectedFormat: 'pdf',
          error: 'Corrupt or spoofed file: The file does not have a valid PDF header signature (%PDF-).',
        };
      }
      return {
        isValid: true,
        sanitizedFileName,
        detectedFormat: 'pdf',
        detectedMime: 'application/pdf',
      };
    }

    // DOCX Magic Bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04) ZIP signature + document verification
    if (ext === '.docx' || mimeType.includes('wordprocessingml') || mimeType.includes('officedocument')) {
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x50 ||
        buffer[1] !== 0x4b ||
        buffer[2] !== 0x03 ||
        buffer[3] !== 0x04
      ) {
        return {
          isValid: false,
          sanitizedFileName,
          detectedFormat: 'docx',
          error: 'Corrupt or spoofed file: The Word document does not match standard DOCX/ZIP archive signatures.',
        };
      }

      // Check for Word document content string or [Content_Types].xml in raw zip bytes
      const zipString = buffer.toString('latin1');
      const hasContentTypes = zipString.includes('[Content_Types].xml') || zipString.includes('word/');
      if (!hasContentTypes) {
        return {
          isValid: false,
          sanitizedFileName,
          detectedFormat: 'docx',
          error: 'Invalid DOCX structure: Missing required OpenXML document definitions.',
        };
      }

      return {
        isValid: true,
        sanitizedFileName,
        detectedFormat: 'docx',
        detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }

    // TXT format inspection: must be valid UTF-8 and not contain executable signatures
    if (ext === '.txt' || mimeType.includes('text/plain')) {
      // Reject Windows PE executable ('MZ' - 0x4D, 0x5A) or Linux ELF ('\x7fELF' - 0x7F, 0x45, 0x4C, 0x46)
      if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
        return {
          isValid: false,
          sanitizedFileName,
          detectedFormat: 'txt',
          error: 'Malicious upload blocked: Windows executable binary signature detected.',
        };
      }

      if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
        return {
          isValid: false,
          sanitizedFileName,
          detectedFormat: 'txt',
          error: 'Malicious upload blocked: Linux ELF binary signature detected.',
        };
      }

      // Check ratio of non-printable control characters
      let nonPrintableCount = 0;
      const sampleSize = Math.min(buffer.length, 4096);
      for (let i = 0; i < sampleSize; i++) {
        const byte = buffer[i];
        // Allow newline (10), carriage return (13), tab (9), and standard printable range (32-126)
        if (byte < 9 || (byte > 10 && byte < 13) || (byte > 13 && byte < 32) || byte === 127) {
          nonPrintableCount++;
        }
      }

      if (sampleSize > 0 && nonPrintableCount / sampleSize > 0.05) {
        return {
          isValid: false,
          sanitizedFileName,
          detectedFormat: 'txt',
          error: 'Text file contains excessive binary control characters. Please upload standard UTF-8 text.',
        };
      }

      return {
        isValid: true,
        sanitizedFileName,
        detectedFormat: 'txt',
        detectedMime: 'text/plain',
      };
    }

    return {
      isValid: false,
      sanitizedFileName,
      detectedFormat: 'pdf',
      error: 'Unrecognized file type or unsupported format.',
    };
  }
}
