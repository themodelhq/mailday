import { Controller, Post, Body, Headers } from '@nestjs/common';
import { BounceService, BouncePayload } from './bounce.service';

@Controller('webhooks/delivery')
export class BounceController {
  constructor(private readonly bounce: BounceService) {}

  @Post('bounce')
  receive(@Headers('x-mailday-bounce-token') token: string | undefined, @Body() payload: BouncePayload) {
    return this.bounce.receive(token, payload);
  }
}
