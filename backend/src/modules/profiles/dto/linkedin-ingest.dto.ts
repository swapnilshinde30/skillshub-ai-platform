import { IsString, IsUrl, MinLength, MaxLength, IsOptional, ValidateIf } from 'class-validator';

export class LinkedInIngestDto {
  /** LinkedIn profile URL — required when submitting via URL-only path */
  @IsOptional()
  @ValidateIf((o) => o.url !== undefined && o.url !== '')
  @IsUrl({ require_protocol: true }, { message: 'Please provide a valid LinkedIn profile URL' })
  url?: string;

  /** Profile text — required when submitting via paste path */
  @IsOptional()
  @IsString()
  @MinLength(100, { message: 'Profile text must be at least 100 characters' })
  @MaxLength(50_000, { message: 'Profile text must be under 50,000 characters' })
  text?: string;
}
