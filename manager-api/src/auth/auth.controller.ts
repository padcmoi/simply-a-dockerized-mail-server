import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenDto, RootLoginDto } from './dto/root-login.dto';
import {
  OpenApiLogin,
  OpenApiLogout,
  OpenApiLogoutAll,
  OpenApiMe,
  OpenApiRefresh,
} from './auth.openapi';

interface AuthenticatedRequest {
  ip?: string;
  headers?: { 'user-agent'?: string };
  user?: { sub?: string; email?: string; role?: string };
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @OpenApiLogin()
  login(@Body() dto: RootLoginDto, @Req() req: AuthenticatedRequest) {
    return this.auth.loginLocal(dto.email, dto.password, this.ctx(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @OpenApiRefresh()
  refresh(@Body() dto: RefreshTokenDto, @Req() req: AuthenticatedRequest) {
    return this.auth.refreshLocal(dto.refresh_token, this.ctx(req));
  }

  @Post('logout')
  @HttpCode(200)
  @OpenApiLogout()
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refresh_token);
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @OpenApiLogoutAll()
  logoutAll(@Req() req: AuthenticatedRequest) {
    const sub = Number(req.user?.sub);
    return this.auth.logoutAll(sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @OpenApiMe()
  me(@Req() req: AuthenticatedRequest) {
    return { principal: req.user };
  }

  private ctx(req: AuthenticatedRequest) {
    return { ip: req.ip ?? null, userAgent: req.headers?.['user-agent'] ?? null };
  }
}
