import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { OutboundWorker } from './outbound.worker';

@Module({
  providers: [MessagesService, OutboundWorker],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
