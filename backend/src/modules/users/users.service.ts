import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../../common/enums';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const exists = await this.repo.findOneBy({ email: input.email });
    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.repo.create({
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role ?? UserRole.EMPLOYEE,
    });

    return this.repo.save(user);
  }

  /** Standard lookup — passwordHash excluded via select:false on the column */
  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Explicitly selects passwordHash for authentication.
   * The column has select:false so a normal find() won't include it.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.passwordHash')
      .getOne();
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.repo.update(id, { lastLoginAt: new Date() });
  }
}
