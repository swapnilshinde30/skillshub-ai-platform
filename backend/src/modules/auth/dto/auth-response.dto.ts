import { UserRole } from '../../../common/enums';

export class AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
}

export class AuthResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
