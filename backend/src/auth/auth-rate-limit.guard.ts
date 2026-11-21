import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimitService } from './rate-limit.service';

export interface RateLimitOptions { limit: number; windowSeconds: number; bucket: string; }

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const options = context.getHandler().name === 'register'
      ? { limit: 5, windowSeconds: 60, bucket: 'register' }
      : context.getHandler().name === 'login'
        ? { limit: 10, windowSeconds: 60, bucket: 'login' }
        : { limit: 20, windowSeconds: 60, bucket: 'refresh' };
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `mailday:auth-rate:${options.bucket}:${ip}`;
    const result = await this.rateLimit.consume(key, options.limit, options.windowSeconds);
    res.setHeader('X-RateLimit-Limit', String(options.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException('Too many authentication requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
