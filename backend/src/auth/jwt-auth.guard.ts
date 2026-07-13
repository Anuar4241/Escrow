import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser, USER_ROLES, UserRole } from './auth-user';
import { IS_PUBLIC_KEY } from './auth.constants';
interface TokenPayload {
  sub?: string;
  roles?: unknown;
}
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Bearer token is required');
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
      });
      if (
        !payload.sub ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          payload.sub,
        )
      )
        throw new UnauthorizedException('Token subject must be a user UUID');
      const roles = Array.isArray(payload.roles)
        ? [
            ...new Set(
              payload.roles.filter(
                (role): role is UserRole =>
                  typeof role === 'string' &&
                  (USER_ROLES as readonly string[]).includes(role),
              ),
            ),
          ]
        : [];
      request.user = { id: payload.sub, roles };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
