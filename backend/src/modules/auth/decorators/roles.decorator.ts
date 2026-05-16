import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../common/enums';

/**
 * Restrict a route to one or more roles.
 * Must be used together with RolesGuard (applied after JwtAuthGuard).
 *
 * Usage:
 *   @Roles(UserRole.HR)
 *   @Get('search')
 *   search() { ... }
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
