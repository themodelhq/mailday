import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RedisService } from '../redis/redis.service';

export interface JwtPayload { sub: string; email: string; username: string; role: string; jti?: string; }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly redis: RedisService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('JWT_SECRET must be configured in production');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret ?? 'local-development-only-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || !payload?.jti) throw new UnauthorizedException('Invalid token');
    const revoked = await this.redis.client.get(`auth:revoked:${payload.jti}`);
    if (revoked) throw new UnauthorizedException('Token revoked');
    return { id: payload.sub, email: payload.email, username: payload.username, role: payload.role };
  }
}
