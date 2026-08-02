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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './admin.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query() q: PaginationDto) {
    return this.admin.listUsers(q.page, q.limit, q.search);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(id, dto.role, dto.isActive);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string) {
    return this.admin.removeUser(id);
  }

  @Get('messages')
  messages(@Query() q: PaginationDto) {
    return this.admin.listMessages(q.page, q.limit);
  }
}
