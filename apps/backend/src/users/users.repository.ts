import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../common/repository/base.repository';

export const USER_SELECT = {
  id: true,
  code: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  protected readonly notFoundMessage = 'Nhân viên không tồn tại';

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  protected get delegate() {
    return this.prisma.user;
  }

  findAll(search?: string): Promise<Omit<User, 'password'>[]> {
    return this.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: USER_SELECT,
      orderBy: { code: 'asc' },
    });
  }

  findByIdSafe(id: string): Promise<Omit<User, 'password'>> {
    return super.findById(id, USER_SELECT);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findFirst({ where: { email } });
  }

  existsByEmailOrCode(email: string, code: string): Promise<User | null> {
    return this.findFirst({ where: { OR: [{ email }, { code }] } });
  }

  createUser(data: any): Promise<Omit<User, 'password'>> {
    return this.create(data, USER_SELECT);
  }

  updateUser(id: string, data: any): Promise<Omit<User, 'password'>> {
    return this.update(id, data, USER_SELECT);
  }

  updatePassword(id: string, hashedPassword: string): Promise<Omit<User, 'password'>> {
    return this.delegate.update({
      where: { id },
      data: { password: hashedPassword },
      select: USER_SELECT,
    });
  }

  deactivate(id: string): Promise<Omit<User, 'password'>> {
    return this.update(id, { isActive: false }, USER_SELECT);
  }

  countByRole() {
    return this.prisma.user.groupBy({
      by: ['role'],
      where: { isActive: true },
      _count: true,
    });
  }
}
