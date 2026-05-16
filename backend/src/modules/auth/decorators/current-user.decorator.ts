import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../dto/jwt-payload.interface';

/**
 * Extract the authenticated user from the request object.
 * The value is the JwtPayload attached by JwtStrategy.validate().
 *
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentUser() user: JwtPayload) { ... }
 *
 *   // Extract a single field:
 *   @Get('me')
 *   getMe(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
