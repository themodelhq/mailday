import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ImapService } from './imap.service';
import { ImapController } from './imap.controller';

@Global()
@Module({
  providers: [MailService, ImapService],
  controllers: [ImapController],
  exports: [MailService, ImapService],
})
export class MailModule {}
