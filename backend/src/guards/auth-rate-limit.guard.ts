import { SessionRequest, CookieResponse } from '../types/contracts';
import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { AuthRateLimitStore } from '../stores/auth-rate-limit.store';

const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly store: AuthRateLimitStore) {}

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<SessionRequest>();
    const response = http.getResponse<CookieResponse>();
    // Use the peer address, never untrusted forwarding headers.
    const key = `${context.getHandler().name}:${request.socket.remoteAddress}`;
    const limit = context.getHandler().name === 'login' ? 20 : 5;
    let result;
    try {
      result = await this.store.consume(key, limit, WINDOW_MS);
    } catch {
      response.setHeader('Retry-After', 5);
      throw new HttpException(
        {
          success: false,
          reason: 'Authentication temporarily unavailable. Please try again later.',
        },
        503,
      );
    }
    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfter);
      throw new HttpException(
        { success: false, reason: 'Too many attempts. Please try again later.' },
        429,
      );
    }
    return true;
  }
}
