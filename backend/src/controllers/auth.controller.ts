import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthRateLimitGuard } from '../guards/auth-rate-limit.guard';
import { CsrfGuard } from '../guards/csrf.guard';
import { Public, SessionGuard } from '../guards/session.guard';
import { AuthService } from '../services/auth.service';
import { CsrfService } from '../services/csrf.service';
import { CookieResponse, LoginInput, SessionRequest, SignupInput } from '../types/contracts';

@Controller()
@UseGuards(SessionGuard, CsrfGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
  ) {}

  @Public()
  @Get('csrf-token')
  csrfToken(@Req() request: SessionRequest, @Res({ passthrough: true }) response: CookieResponse) {
    response.setHeader('Cache-Control', 'no-store');
    const session = request.cookies?.SESSIONID;
    this.csrf.issue(response, typeof session === 'string' ? session : '');
    return { success: true };
  }

  @Public()
  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  login(@Body() body: LoginInput, @Res({ passthrough: true }) response: CookieResponse) {
    return this.auth.login(body, response);
  }

  @Public()
  @Post('check-signup')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  checkSignup(@Body() body: Pick<SignupInput, 'email' | 'id'>) {
    return this.auth.checkSignup(body);
  }

  @Public()
  @Post('sign-up')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  signup(@Body() body: SignupInput) {
    return this.auth.signup(body);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    await this.auth.revoke(request.authSession);
    response.clearCookie('SESSIONID', { path: '/' });
    this.csrf.issue(response);
    return { success: true };
  }

  @Get('reconect')
  reconnect(@Req() request: SessionRequest) {
    const user = request.user_data;
    return {
      success: true,
      role: user.role,
      name: user.name,
      user: user._id,
      address: user.address,
      isReturning: user.isReturning,
    };
  }
}
