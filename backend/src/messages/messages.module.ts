import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AttachmentsService } from './attachments.service';
import { OutboundWorker } from './outbound.worker';
import { AttachmentScanner } from './attachment-scanner.service';

@Module({
  providers: [MessagesService, OutboundWorker, AttachmentsService, AttachmentScanner],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
