import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfilesService } from './profiles.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.interface';
import { UserRole, ProfileStatus } from '../../common/enums';
import {
  IngestTextDto,
  IngestResponseDto,
  IngestionStatusDto,
} from './dto/ingest.dto';
import { LinkedInIngestDto } from './dto/linkedin-ingest.dto';
import {
  UpdateProfileDto,
  ApproveProfileDto,
  RejectProfileDto,
} from './dto/review-profile.dto';
import {
  HrTargetDto,
  HrIngestTextDto,
  HrLinkedInIngestDto,
} from './dto/hr-ingest.dto';
import { BulkImportService } from './services/bulk-import.service';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly bulkImportService: BulkImportService,
  ) {}

  // ── Ingestion ─────────────────────────────────────────────────────────────

  /**
   * POST /profiles/ingest/pdf
   * Employee uploads their resume PDF.
   * Returns immediately with an uploadId for status polling.
   */
  @Post('ingest/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('resume', {
      storage: memoryStorage(),           // keep in memory; no disk I/O needed
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  ingestPdf(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<IngestResponseDto> {
    return this.profilesService.ingestPdf(file, user.sub);
  }

  /**
   * POST /profiles/ingest/text
   * Employee pastes LinkedIn profile or plain text.
   */
  @Post('ingest/text')
  @HttpCode(HttpStatus.ACCEPTED)
  ingestText(
    @Body() dto: IngestTextDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IngestResponseDto> {
    return this.profilesService.ingestText(dto.text, user.sub);
  }

  /**
   * POST /profiles/ingest/linkedin
   * Employee imports their LinkedIn profile via URL + optional pasted text.
   * The backend attempts to fetch the public profile; if blocked, the frontend
   * falls back to a guided copy-paste flow and passes `text` directly.
   */
  @Post('ingest/linkedin')
  @HttpCode(HttpStatus.ACCEPTED)
  ingestLinkedIn(
    @Body() dto: LinkedInIngestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<IngestResponseDto> {
    return this.profilesService.ingestLinkedIn(dto.url, dto.text, user.sub);
  }


  /**
   * GET /profiles/ingest/status/:uploadId
   * Poll to track background processing progress (0–100%).
   */
  @Get('ingest/status/:uploadId')
  getIngestionStatus(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<IngestionStatusDto> {
    return this.profilesService.getIngestionStatus(uploadId, user.sub);
  }

  // ── Employee: own profile ──────────────────────────────────────────────────

  /**
   * GET /profiles/me
   * Returns the authenticated employee's full profile.
   */
  @Get('me')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.profilesService.getMyProfile(user.sub);
  }

  /**
   * PUT /profiles/me
   * Employee manually edits their own profile fields.
   */
  @Put('me')
  updateMyProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.profilesService.updateMyProfile(user.sub, dto);
  }

  /**
   * POST /profiles/me/submit
   * Employee submits their profile for HR approval.
   */
  @Post('me/submit')
  @HttpCode(HttpStatus.OK)
  submitForApproval(@CurrentUser() user: JwtPayload) {
    return this.profilesService.submitForApproval(user.sub);
  }

  // ── HR: profile management ─────────────────────────────────────────────────

  /**
   * GET /profiles?status=pending&page=1&limit=20
   * HR: paginated list of all profiles, optionally filtered by status.
   */
  @Get()
  @Roles(UserRole.HR)
  listProfiles(
    @Query('status') status?: ProfileStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.profilesService.listProfiles(status, +page, +limit);
  }

  /**
   * GET /profiles/:id
   * HR: full profile detail including all relations.
   */
  @Get(':id')
  @Roles(UserRole.HR)
  getProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profilesService.getProfileById(id);
  }

  /**
   * PUT /profiles/:id
   * HR edits an employee's profile on their behalf.
   */
  @Put(':id')
  @Roles(UserRole.HR)
  updateProfileByHr(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateProfileByIdAsHr(id, dto);
  }

  /**
   * DELETE /profiles/:id
   * HR permanently deletes a profile and all related data.
   */
  @Delete(':id')
  @Roles(UserRole.HR)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profilesService.deleteProfile(id);
  }

  /**
   * PUT /profiles/:id/approve
   * HR approves a pending profile — it becomes searchable immediately.
   */
  @Put(':id/approve')
  @Roles(UserRole.HR)
  approveProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveProfileDto,
    @CurrentUser() reviewer: JwtPayload,
  ) {
    return this.profilesService.approveProfile(id, reviewer.sub, dto);
  }

  /**
   * PUT /profiles/:id/reject
   * HR rejects a profile with a mandatory reason.
   */
  @Put(':id/reject')
  @Roles(UserRole.HR)
  rejectProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectProfileDto,
    @CurrentUser() reviewer: JwtPayload,
  ) {
    return this.profilesService.rejectProfile(id, reviewer.sub, dto);
  }

  // ── HR: single-employee upload ─────────────────────────────────────────────

  /**
   * POST /profiles/hr/ingest/pdf
   * HR uploads a PDF resume on behalf of a specific employee (by email).
   * Creates an employee account with password 'demo1234' if it doesn't exist.
   */
  @Post('hr/ingest/pdf')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.HR)
  @UseInterceptors(
    FileInterceptor('resume', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  hrIngestPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: HrTargetDto,
  ) {
    return this.profilesService.hrIngestPdf(file, dto.targetEmail, dto.targetName);
  }

  /**
   * POST /profiles/hr/ingest/text
   * HR pastes resume text for a specific employee.
   */
  @Post('hr/ingest/text')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.HR)
  hrIngestText(@Body() dto: HrIngestTextDto) {
    return this.profilesService.hrIngestText(dto.text, dto.targetEmail, dto.targetName);
  }

  /**
   * POST /profiles/hr/ingest/linkedin
   * HR imports a LinkedIn profile (URL or paste) for a specific employee.
   */
  @Post('hr/ingest/linkedin')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.HR)
  hrIngestLinkedIn(@Body() dto: HrLinkedInIngestDto) {
    return this.profilesService.hrIngestLinkedIn(
      dto.url,
      dto.text,
      dto.targetEmail,
      dto.targetName,
    );
  }

  // ── HR: bulk CSV/XLSX import ───────────────────────────────────────────────

  /**
   * POST /profiles/hr/bulk-import
   * HR uploads a CSV or XLSX file to batch-create employee accounts and profiles.
   * Each row is parsed, validated, an employee account created (password: demo1234),
   * and the profile queued for AI processing.
   */
  @Post('hr/bulk-import')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.HR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  bulkImport(@UploadedFile() file: Express.Multer.File) {
    return this.bulkImportService.processBulkImport(file);
  }
}
