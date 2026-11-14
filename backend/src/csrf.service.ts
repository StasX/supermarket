import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CookieResponse, SessionRequest } from './contracts';

@Injectable()
export class CsrfService {
  create(session = '') {
    const nonce = randomBytes(32).toString('hex');
    return `${nonce}.${this.signature(nonce, session)}`;
  }

  private signature(nonce: string, session: string) {
    const key = readFileSync(
      process.env['JWT_KEY_PATH'] || join(__dirname, '..', 'src', 'key.pem'),
    );
    return createHmac('sha256', key)
      .update(JSON.stringify(['csrf-v1', session, nonce]))
      .digest('hex');
  }

  valid(token: unknown, session = '') {
    if (
      typeof token !== 'string' ||
      token.length !== 129 ||
      !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)
    )
      return false;
    const [nonce, signature] = token.split('.') as [string, string];
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(this.signature(nonce, session), 'hex'),
    );
  }

  issue(response: CookieResponse, session = '') {
    response.cookie('XSRF-TOKEN', this.create(session), {
      httpOnly: false,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method || '')) return true;
    const reject = () => {
      throw new HttpException(
        { success: false, reason: 'Invalid CSRF token or request origin.' },
        403,
      );
    };
    if (request.headers['sec-fetch-site'] === 'cross-site') return reject();
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    if (origin || referer) {
      try {
        const source = new URL(origin || referer!);
        const trusted = process.env['CSRF_TRUSTED_ORIGINS']
          ?.split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        if (
          !['http:', 'https:'].includes(source.protocol) ||
          (trusted?.length
            ? !trusted.includes(source.origin)
            : source.host !== request.headers.host)
        )
          return reject();
      } catch {
        return reject();
      }
    }
    const cookie = request.cookies?.['XSRF-TOKEN'];
    const header = request.headers['x-xsrf-token'];
    const session = request.cookies?.SESSIONID;
    if (
      typeof cookie !== 'string' ||
      cookie !== header ||
      !this.csrf.valid(header, typeof session === 'string' ? session : '')
    )
      return reject();
    return true;
  }
}
