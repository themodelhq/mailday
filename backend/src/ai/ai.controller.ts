import { Body, Controller, Post, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiGenerateDto } from './ai.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  async generate(@Body() dto: AiGenerateDto) {
    if (!this.ai.enabled) {
      throw new HttpException('AI is not configured (set ZAI_API_KEY)', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const text = await this.ai.generate(dto.mode, dto.text, {
      subject: dto.subject,
      tone: dto.tone,
    });
    return { text };
  }
}
