/**
 * EXAMPLE: How to use auth guards, role checks, and the @CurrentUser decorator.
 * This file is documentation — not a real module.
 *
 * Because JwtAuthGuard and RolesGuard are registered globally in AppModule,
 * you never need to import or apply them per-route. You only use decorators.
 */

import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtPayload } from '../dto/jwt-payload.interface';
import { UserRole } from '../../../common/enums';

@Controller('example')
export class ExampleController {

  // ── 1. Public route — no token needed ─────────────────────────────────────
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ── 2. Any authenticated user ──────────────────────────────────────────────
  // No @Public(), no @Roles() → JWT required, any role allowed
  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtPayload) {
    // user = { sub: uuid, email: '...', role: 'employee' | 'hr' }
    return { message: `Welcome ${user.email}` };
  }

  // ── 3. HR only ─────────────────────────────────────────────────────────────
  // Returns 403 if the token belongs to an employee
  @Roles(UserRole.HR)
  @Get('admin-stats')
  adminStats(@CurrentUser() user: JwtPayload) {
    return { requestedBy: user.sub };
  }

  // ── 4. Employee only ───────────────────────────────────────────────────────
  @Roles(UserRole.EMPLOYEE)
  @Post('upload-resume')
  uploadResume(@CurrentUser('sub') userId: string, @Body() body: unknown) {
    // @CurrentUser('sub') extracts just the user ID string
    return { userId };
  }

  // ── 5. Multiple roles allowed ──────────────────────────────────────────────
  @Roles(UserRole.HR, UserRole.EMPLOYEE)
  @Get('shared-resource')
  sharedResource(@CurrentUser() user: JwtPayload) {
    return { role: user.role };
  }

  // ── 6. Controller-level role restriction ───────────────────────────────────
  // Apply @Roles() to the class itself — all routes in this controller
  // inherit the restriction unless overridden at method level.
  // Example (not shown here to avoid conflict):
  //
  //   @Roles(UserRole.HR)
  //   @Controller('hr')
  //   class HrController { ... }
}
