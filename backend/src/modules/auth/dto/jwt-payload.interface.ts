import { UserRole } from '../../../common/enums';

export interface JwtPayload {
  /** User UUID — standard JWT "subject" claim */
  sub: string;
  email: string;
  role: UserRole;
}
