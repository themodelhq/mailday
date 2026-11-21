import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';
import { AttachmentScanner } from '../messages/attachment-scanner.service';

@Global()
@Module({
  providers: [MailService, ImapService, InboundService, AttachmentScanner],
  controllers: [ImapController, InboundController],
  exports: [MailService, ImapService, InboundService],
})
export class MailModule {}
