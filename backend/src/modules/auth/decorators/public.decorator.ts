import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route or controller as publicly accessible.
 * JwtAuthGuard checks this metadata and skips token validation when present.
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   login() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
