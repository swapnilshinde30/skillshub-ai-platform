import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../common/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../dto/jwt-payload.interface';

/**
 * Checks that the authenticated user holds one of the roles listed
 * in @Roles(...) on the route handler or controller class.
 *
 * Must be used after JwtAuthGuard so that req.user is already populated.
 * Register both guards together or apply globally.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)   ← route level
 *   @Roles(UserRole.HR)
 *   @Get('profiles')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — any authenticated user may proceed
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
