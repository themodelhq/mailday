import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SearchModule } from './search/search.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { CommonModule } from './common/common.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    RedisModule,
    SearchModule,
    MailModule,
    AuthModule,
    UsersModule,
    MessagesModule,
    AdminModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
