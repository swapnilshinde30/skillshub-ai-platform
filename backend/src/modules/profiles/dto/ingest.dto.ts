import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Used for POST /profiles/ingest/text — LinkedIn paste or plain text */
export class IngestTextDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(200, { message: 'Resume text must be at least 200 characters' })
  @MaxLength(50_000, { message: 'Resume text must be under 50,000 characters' })
  text: string;
}

/** Returned immediately from both ingest endpoints while processing runs async */
export class IngestResponseDto {
  uploadId: string;
  status: 'processing';
  message: string;
}

/** Returned by GET /profiles/ingest/status/:uploadId */
export class IngestionStatusDto {
  uploadId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;          // 0–100 from BullMQ job progress
  profileId: string | null;
  errorMessage: string | null;
  processingTimeMs: number | null;
}
