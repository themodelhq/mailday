import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AttachmentsService } from './attachments.service';
import { OutboundWorker } from './outbound.worker';

@Module({
  providers: [MessagesService, OutboundWorker, AttachmentsService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
