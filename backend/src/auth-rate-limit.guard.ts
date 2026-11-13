import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_BUCKETS = 10_000;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const now = Date.now();
    // Use the peer address, never untrusted forwarding headers.
    const key = `${context.getHandler().name}:${request.socket.remoteAddress}`;
    const limit = context.getHandler().name === 'login' ? 20 : 5;
    for (const [key, bucket] of this.buckets) {
      if (bucket.expires <= now) this.buckets.delete(key);
    }
    let bucket = this.buckets.get(key);
    if (!bucket && this.buckets.size < MAX_BUCKETS) {
      bucket = { count: 0, expires: now + WINDOW_MS };
      this.buckets.set(key, bucket);
    }
    // Fail closed when full rather than evicting active limits.
    if (!bucket || bucket.count >= limit) {
      response.setHeader(
        'Retry-After',
        Math.ceil(((bucket?.expires ?? now + WINDOW_MS) - now) / 1000),
      );
      throw new HttpException(
        { success: false, reason: 'Too many attempts. Please try again later.' },
        429,
      );
    }
    bucket.count++;
    return true;
  }
}
