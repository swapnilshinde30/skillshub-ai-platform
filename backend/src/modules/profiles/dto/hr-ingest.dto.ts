import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class HrTargetDto {
  @IsEmail({}, { message: 'Please provide a valid employee email address' })
  targetEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetName?: string;
}

export class HrIngestTextDto extends HrTargetDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(50, { message: 'Resume text must be at least 50 characters' })
  @MaxLength(50_000)
  text: string;
}

export class HrLinkedInIngestDto extends HrTargetDto {
  @IsOptional()
  @ValidateIf((o) => o.url !== undefined && o.url !== '')
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @MinLength(100)
  @MaxLength(50_000)
  text?: string;
}

export interface BulkImportRowResult {
  name: string;
  email: string;
  status: 'queued' | 'skipped' | 'failed';
  uploadId?: string;
  error?: string;
  isNewAccount: boolean;
}

export interface BulkImportResultDto {
  total: number;
  created: number;
  queued: number;
  failed: number;
  rows: BulkImportRowResult[];
}
