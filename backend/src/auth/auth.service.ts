import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { RegisterDto, LoginDto, RefreshDto } from './dto/auth.dto';

export interface TokenPair { accessToken: string; refreshToken: string; }

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  // A precomputed-at-startup hash keeps unknown/inactive account checks close to the
  // cost of a real password check, reducing account-enumeration timing signals.
  private readonly dummyPasswordHash = bcrypt.hash('MailDayDummyPasswordNotForLogin!', 12);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private async issueTokens(userId: string, email: string, username: string, role: string, db: Prisma.TransactionClient | PrismaService = this.prisma): Promise<TokenPair> {
    const jti = uuid();
    const accessJti = uuid();
    const sessionVersion = Number(await this.redis.client.get(`auth:session-version:${userId}`) ?? 0);
    const accessToken = this.jwt.sign(
      { sub: userId, email, username, role, jti: accessJti, sv: sessionVersion },
      { secret: this.config.get<string>('JWT_SECRET'), expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m' },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId, email, username, role, jti },
      { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d' },
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.refreshToken.create({ data: { userId, token: jti, expiresAt } });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<TokenPair> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) throw new ConflictException('Email or username already in use');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user;
    try {
      user = await this.prisma.user.create({
        data: { email, username, passwordHash, displayName: dto.displayName?.trim() || username },
      });
    } catch (error) {
      // A concurrent registration may pass the lookup but lose the unique constraint race.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email or username already in use');
      }
      throw error;
    }
    this.logger.log('Registered new account');
    return this.issueTokens(user.id, user.email, user.username, user.role);
  }

  async validateUser(identifier: string, password: string) {
    const normalized = identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: normalized.toLowerCase() }, { username: normalized.toLowerCase() }] },
    });
    if (!user || user.isActive === false) {
      await bcrypt.compare(password, await this.dummyPasswordHash);
      return null;
    }
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
      payload = this.jwt.verify(dto.refreshToken, { secret: this.config.get<string>('JWT_REFRESH_SECRET') }) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const record = await this.prisma.refreshToken.findUnique({ where: { token: payload.jti } });
    if (!record) throw new UnauthorizedException('Refresh token revoked');
    if (record.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { token: payload.jti } }).catch(() => null);
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      throw new UnauthorizedException('Account is unavailable');
    }
    // Atomically consume the old refresh token and create its replacement.
    // A concurrent request can consume it only once.
    const tokens = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshToken.deleteMany({ where: { token: payload.jti, userId: payload.sub } });
      if (consumed.count !== 1) throw new UnauthorizedException('Refresh token already used');
      return this.issueTokens(user.id, user.email, user.username, user.role, tx);
    });
    await this.redis.invalidatePrefix(`messages:${payload.sub}:`);
    return tokens;
  }

  async logoutAll(userId: string): Promise<{ success: boolean }> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.redis.client.incr(`auth:session-version:${userId}`);
    return { success: true };
  }

  async logout(refreshToken: string, accessToken: string): Promise<{ success: boolean }> {
    try {
      const refreshPayload = this.jwt.verify(refreshToken, { secret: this.config.get<string>('JWT_REFRESH_SECRET') }) as { jti?: string };
      if (refreshPayload?.jti) await this.prisma.refreshToken.delete({ where: { token: refreshPayload.jti } }).catch(() => null);
    } catch { /* already invalid */ }
    try {
      const accessPayload = this.jwt.verify(accessToken, { secret: this.config.get<string>('JWT_SECRET') }) as { jti?: string; exp?: number };
      if (accessPayload?.jti && accessPayload.exp) {
        const ttl = Math.max(1, accessPayload.exp - Math.floor(Date.now() / 1000));
        await this.redis.client.set(`auth:revoked:${accessPayload.jti}`, '1', 'EX', ttl);
      }
    } catch { /* access token will naturally expire */ }
    return { success: true };
  }
}
