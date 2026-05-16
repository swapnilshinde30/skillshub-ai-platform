import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Query must be at least 3 characters' })
  @MaxLength(500, { message: 'Query must be under 500 characters' })
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number = 10;
}
