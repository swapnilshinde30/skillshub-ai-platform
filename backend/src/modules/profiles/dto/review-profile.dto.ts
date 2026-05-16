import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProficiencyLevel, SkillCategory } from '../../../common/enums';

export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(SkillCategory)
  category: SkillCategory;

  @IsEnum(ProficiencyLevel)
  proficiency: ProficiencyLevel;

  @IsNumber()
  @Min(0)
  @Max(50)
  yearsExp: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  impact?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateCertificationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  issueDate?: string;
}

export class UpdateEducationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  degree: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsString()
  @IsNotEmpty()
  institution: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  startYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2100)
  endYear?: number;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  yearsTotal?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSkillDto)
  skills?: UpdateSkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProjectDto)
  projects?: UpdateProjectDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateCertificationDto)
  certifications?: UpdateCertificationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateEducationDto)
  education?: UpdateEducationDto[];
}

export class ApproveProfileDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectProfileDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
