import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

const MIN_TEXT_LENGTH = 100;   // anything shorter is likely a scanned image PDF
const MAX_FILE_SIZE   = 5 * 1024 * 1024;  // 5 MB

@Injectable()
export class PdfExtractorService {
  private readonly logger = new Logger(PdfExtractorService.name);

  async extractText(file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    try {
      const data = await pdfParse(file.buffer, {
        // Limit to first 10 pages — resumes are never 50 pages
        max: 10,
      });

      const text = this.cleanText(data.text);

      if (text.length < MIN_TEXT_LENGTH) {
        throw new BadRequestException(
          'Could not extract readable text from this PDF. ' +
          'It may be a scanned image. Please paste your resume text directly instead.',
        );
      }

      this.logger.log(
        `Extracted ${text.length} chars from "${file.originalname}" (${data.numpages} pages)`,
      );

      return text;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Failed to parse PDF: ${(err as Error).message}. Please ensure the file is not password-protected.`,
      );
    }
  }

  extractFromText(rawText: string): string {
    if (!rawText || rawText.trim().length < MIN_TEXT_LENGTH) {
      throw new BadRequestException('Resume text is too short to extract meaningful data.');
    }
    return this.cleanText(rawText);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File exceeds the 5 MB limit (received ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      );
    }
    const allowed = ['application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Only PDF files are accepted.`,
      );
    }
  }

  private cleanText(raw: string): string {
    return raw
      .replace(/\r\n/g, '\n')                 // normalise line endings
      .replace(/\r/g, '\n')
      .replace(/[^\S\n]+/g, ' ')             // collapse horizontal whitespace
      .replace(/\n{3,}/g, '\n\n')            // collapse excessive blank lines
      .replace(/[^\x20-\x7E\n]/g, ' ')       // remove non-printable chars
      .trim();
  }
}
