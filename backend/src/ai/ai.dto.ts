import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AiMode, AiTone } from './ai.service';

export class AiGenerateDto {
  @IsEnum(['draft', 'reply', 'summarize', 'rewrite'])
  mode: AiMode;

  @IsString()
  @MinLength(1)
  text: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsEnum(['professional', 'friendly', 'short', 'expand'])
  tone?: AiTone;
}
