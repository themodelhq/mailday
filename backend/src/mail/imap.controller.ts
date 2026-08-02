import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ImapService } from './imap.service';
import { ConnectImapDto } from './imap.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('mail/imap')
@UseGuards(JwtAuthGuard)
export class ImapController {
  constructor(private readonly imap: ImapService) {}

  @Post()
  connect(@CurrentUser() user: AuthUser, @Body() dto: ConnectImapDto) {
    return this.imap.connectAccount(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.imap.listAccounts(user);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imap.removeAccount(user, id);
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imap.syncAccount(user, id);
  }
}
