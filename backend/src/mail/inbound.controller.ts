import { Controller, Post, Headers, Body } from '@nestjs/common';
import { InboundService } from './inbound.service';

@Controller('mail/inbound')
export class InboundController {
  constructor(private readonly inbound: InboundService) {}

  @Post('webhook')
  receive(@Headers('x-mailday-inbound-token') token: string | undefined, @Body() body: any) {
    return this.inbound.receive(token, body);
  }
}
