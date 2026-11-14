import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

// Checking, incrementing, and setting expiry must be atomic across replicas.
export const AUTH_RATE_LIMIT_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('PTTL', KEYS[1])}
`;

@Injectable()
export class AuthRateLimitStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthRateLimitStore.name);
  private readonly client = createClient({
    url: process.env['REDIS_URL'] || 'redis://127.0.0.1:6379',
    disableOfflineQueue: true,
    commandOptions: { timeout: 5000 },
    socket: { connectTimeout: 5000 },
  });

  constructor() {
    this.client.on('error', () => this.logger.error('Auth rate-limit Redis connection error'));
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async consume(key: string, limit: number, windowMs: number) {
    if (!this.client.isReady) throw new Error('Redis is unavailable');
    const result = (await this.client.eval(AUTH_RATE_LIMIT_SCRIPT, {
      keys: [`supermarket:auth-rate-limit:${key}`],
      arguments: [String(limit), String(windowMs)],
    })) as [number, number];
    return { allowed: result[0] === 1, retryAfter: Math.max(1, Math.ceil(result[1] / 1000)) };
  }

  onModuleDestroy() {
    if (this.client.isOpen) this.client.destroy();
  }
}
