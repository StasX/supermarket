import { SessionRequest } from '../types/contracts';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../services/auth.service';

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
    const authenticated = await this.auth.authenticate(request.cookies?.SESSIONID);
    const role = this.reflector.get('role', context.getHandler());
    if (!authenticated) {
      throw new HttpException({ success: false }, 401);
    }
    const { user, session } = authenticated;
    if (role !== undefined && user.role !== role) {
      throw new HttpException({ success: false }, 403);
    }
    request.user_data = user;
    request.authSession = session;
    return true;
  }
}
