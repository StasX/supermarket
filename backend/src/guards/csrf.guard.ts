import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { SessionRequest } from '../types/contracts';
import { CsrfService } from '../services/csrf.service';

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
