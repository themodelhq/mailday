import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';
import { BounceService } from './bounce.service';
import { BounceController } from './bounce.controller';
import { AttachmentScanner } from '../messages/attachment-scanner.service';

@Global()
@Module({
  providers: [MailService, ImapService, InboundService, BounceService, AttachmentScanner],
  controllers: [ImapController, InboundController, BounceController],
  exports: [MailService, ImapService, InboundService, BounceService],
})
export class MailModule {}
