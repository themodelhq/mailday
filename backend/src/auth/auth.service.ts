import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { RegisterDto, LoginDto, RefreshDto } from './dto/auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private async issueTokens(
    userId: string,
    email: string,
    username: string,
    role: string,
  ): Promise<TokenPair> {
    const jti = uuid();
    const accessToken = this.jwt.sign(
      { sub: userId, email, username, role },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
      },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId, email, username, role, jti },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, token: jti, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email or username already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        displayName: dto.displayName ?? dto.username,
      },
    });
    this.logger.log(`Registered user ${user.email}`);
    return this.issueTokens(user.id, user.email, user.username, user.role);
  }

  async validateUser(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.validateUser(dto.identifier, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user.id, user.email, user.username, user.role);
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    let payload: { sub: string; email: string; username: string; role: string; jti: string };
    try {
      payload = this.jwt.verify(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      }) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { token: payload.jti },
    });
    if (!record) throw new UnauthorizedException('Refresh token revoked');
    if (record.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { token: payload.jti } }).catch(() => null);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { token: payload.jti } });
    await this.redis.invalidatePrefix(`messages:${payload.sub}:`);
    return this.issueTokens(payload.sub, payload.email, payload.username, payload.role);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      }) as { jti?: string };
      if (payload?.jti) {
        await this.prisma.refreshToken.delete({ where: { token: payload.jti } }).catch(() => null);
      }
    } catch {
      // already invalid
    }
    return { success: true };
  }
}
