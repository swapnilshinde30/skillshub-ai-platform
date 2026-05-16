import { IsString, IsOptional, IsInt, IsUUID, IsArray, Min, Max, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  projectName: string;

  @IsString()
  @IsOptional()
  projectDescription?: string;
}

export class AddRoleDto {
  @IsString()
  @MinLength(2)
  roleTitle: string;

  @IsString()
  @MinLength(10)
  requirements: string;

  @IsInt()
  @Min(1)
  @Max(3)
  @IsOptional()
  priority?: number;

  /** How many employees are needed for this role */
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  headcount?: number;
}

export class AssignRoleDto {
  @IsUUID()
  profileId: string;
}

export class SetSelectionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  profileIds: string[];
}

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  projectName?: string;

  @IsString()
  @IsOptional()
  projectDescription?: string;
}
