import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { UsersService } from '../../users/users.service';
import { ProfilesService } from '../profiles.service';
import { UserRole } from '../../../common/enums';
import type { BulkImportResultDto, BulkImportRowResult } from '../dto/hr-ingest.dto';

interface CsvRow {
  name?: string;
  email?: string;
  title?: string;
  years_experience?: string | number;
  skills?: string;
  education?: string;
  certifications?: string;
  projects?: string;
  summary?: string;
}

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
  ) {}

  async processBulkImport(
    file: Express.Multer.File,
  ): Promise<BulkImportResultDto> {
    const rows = this.parseFile(file);

    const result: BulkImportResultDto = {
      total: rows.length,
      created: 0,
      queued: 0,
      failed: 0,
      rows: [],
    };

    for (const row of rows) {
      const name  = String(row.name  ?? '').trim();
      const email = String(row.email ?? '').trim().toLowerCase();

      if (!name || !email || !email.includes('@')) {
        result.failed++;
        result.rows.push({
          name: name || '(missing)',
          email: email || '(missing)',
          status: 'failed',
          error: 'name and email are required',
          isNewAccount: false,
        });
        continue;
      }

      const rowResult = await this.processRow(row, name, email);
      result.rows.push(rowResult);

      if (rowResult.status === 'queued') result.queued++;
      else result.failed++;
    }

    result.created = result.rows.filter((r) => r.isNewAccount).length;
    return result;
  }

  private async processRow(
    row: CsvRow,
    name: string,
    email: string,
  ): Promise<BulkImportRowResult> {
    try {
      let isNewAccount = false;
      let user = await this.usersService.findByEmail(email);

      if (!user) {
        const passwordHash = await bcrypt.hash('demo1234', 12);
        user = await this.usersService.create({
          name,
          email,
          passwordHash,
          role: UserRole.EMPLOYEE,
        });
        isNewAccount = true;
        this.logger.log(`Created employee account: ${email}`);
      } else {
        this.logger.log(`Existing account found for ${email} — re-ingesting profile`);
      }

      const rawText  = this.buildResumeText(row, name, email);
      const response = await this.profilesService.enqueueIngestion(
        user.id,
        `bulk-import-${email}.txt`,
        rawText,
      );

      return { name, email, status: 'queued', uploadId: response.uploadId, isNewAccount };
    } catch (err) {
      const error = (err as Error).message;
      this.logger.error(`Bulk import failed for ${email}: ${error}`);
      return { name, email, status: 'failed', error, isNewAccount: false };
    }
  }

  private parseFile(file: Express.Multer.File): CsvRow[] {
    try {
      let workbook: XLSX.WorkBook;

      if (
        file.mimetype === 'text/csv' ||
        file.originalname.toLowerCase().endsWith('.csv')
      ) {
        workbook = XLSX.read(file.buffer.toString('utf8'), { type: 'string' });
      } else {
        workbook = XLSX.read(file.buffer, { type: 'buffer' });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json<CsvRow>(sheet, { defval: '' });

      if (rows.length === 0) {
        throw new BadRequestException('The file contains no data rows');
      }
      if (rows.length > 200) {
        throw new BadRequestException('Maximum 200 employees per import batch');
      }

      return rows;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Could not parse file: ${(err as Error).message}`);
    }
  }

  // Build a rich resume-like text so Claude can extract structured data
  private buildResumeText(row: CsvRow, name: string, email: string): string {
    const lines: string[] = ['=== EMPLOYEE PROFILE IMPORT (BULK CSV) ==='];

    lines.push(`Name: ${name}`, `Email: ${email}`);

    if (row.title)            lines.push(`Title: ${row.title}`);
    if (row.years_experience) lines.push(`Years of Experience: ${row.years_experience}`);

    if (row.summary?.toString().trim()) {
      lines.push('', 'PROFESSIONAL SUMMARY:', row.summary.toString().trim());
    }

    if (row.skills?.toString().trim()) {
      lines.push('', 'SKILLS:');
      row.skills
        .toString()
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => lines.push(`- ${s}`));
    }

    if (row.education?.toString().trim()) {
      lines.push('', 'EDUCATION:');
      row.education
        .toString()
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((e) => lines.push(`- ${e}`));
    }

    if (row.certifications?.toString().trim()) {
      lines.push('', 'CERTIFICATIONS:');
      row.certifications
        .toString()
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((c) => lines.push(`- ${c}`));
    }

    if (row.projects?.toString().trim()) {
      lines.push('', 'PROJECTS:');
      row.projects
        .toString()
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((p) => lines.push(`- ${p}`));
    }

    return lines.join('\n');
  }
}
