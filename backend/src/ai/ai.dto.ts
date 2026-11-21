import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AiMode, AiTone } from './ai.service';

export class AiGenerateDto {
  @IsEnum(['draft', 'reply', 'summarize', 'rewrite'])
  mode: AiMode;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @IsOptional()
  @IsEnum(['professional', 'friendly', 'short', 'expand'])
  tone?: AiTone;
}
