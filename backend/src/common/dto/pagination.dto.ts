import { IsOptional, IsInt, Min, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsIn([10, 20, 50, 100])
  limit = 20;

  @IsOptional()
  @IsString()
  mailbox?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
