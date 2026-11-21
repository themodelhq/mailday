import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/messages.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AttachmentsService, AttachmentUploadFile } from './attachments.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService, private readonly attachments: AttachmentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id/attachments')
  attachmentsList(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attachments.list(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
    const blocked = /\.(exe|dll|bat|cmd|com|msi|sh|ps1|js|jar|scr|vbs|php)$/i.test(file.originalname);
    if (blocked) return cb(new BadRequestException('This file type is not allowed'), false);
    cb(null, true);
  }}))
  uploadAttachment(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file: AttachmentUploadFile) {
    return this.attachments.upload(user.id, id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('attachments/:attachmentId/download')
  async downloadAttachment(@CurrentUser() user: AuthUser, @Param('attachmentId') id: string, @Res() res: Response) {
    const { attachment, data } = await this.attachments.download(user.id, id);
    const safeName = attachment.originalName.replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', data.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('attachments/:attachmentId')
  removeAttachment(@CurrentUser() user: AuthUser, @Param('attachmentId') id: string) {
    return this.attachments.remove(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.messages.list(user, {
      mailbox: q.mailbox,
      search: q.search,
      page: q.page,
      limit: q.limit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('thread/:threadId')
  thread(@CurrentUser() user: AuthUser, @Param('threadId') threadId: string) {
    return this.messages.getThread(user, threadId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/delivery')
  delivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.getDeliveryStatus(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/delivery/retry')
  retryDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.retryDelivery(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.getById(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    return this.messages.create(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messages.update(user, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/send')
  sendDraft(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { idempotencyKey?: string; scheduledAt?: string }) {
    return this.messages.sendDraft(user, id, body?.idempotencyKey, body?.scheduledAt);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.messages.remove(user, id);
  }
}