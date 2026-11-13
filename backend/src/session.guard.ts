import { SessionRequest } from './contracts';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

export const Public = () => SetMetadata('public', true);
export const Role = (role: number) => SetMetadata('role', role);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.get('public', context.getHandler())) {
      return true;
    }
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const user = await this.auth.authenticate(request.cookies?.SESSIONID);
    const role = this.reflector.get('role', context.getHandler());
    if (!user || (role !== undefined && user.role !== role)) {
      // Preserve the legacy JSON contract used by the AngularJS client.
      throw new HttpException({ success: false }, 200);
    }
    request.user_data = user;
    return true;
  }
}
