import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/users.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }
}
