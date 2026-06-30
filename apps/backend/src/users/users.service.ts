import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  findAll(search?: string) {
    return this.usersRepo.findAll(search);
  }

  findOne(id: string) {
    return this.usersRepo.findByIdSafe(id);
  }

  findByEmail(email: string) {
    return this.usersRepo.findByEmail(email);
  }

  async create(dto: CreateUserDto) {
    const exists = await this.usersRepo.existsByEmailOrCode(dto.email, dto.code);
    if (exists) throw new ConflictException('Email hoặc mã nhân viên đã tồn tại');

    const password = await bcrypt.hash(dto.password, 10);
    return this.usersRepo.createUser({ ...dto, password });
  }

  update(id: string, dto: UpdateUserDto) {
    return this.usersRepo.updateUser(id, dto);
  }

  remove(id: string) {
    return this.usersRepo.deactivate(id);
  }

  updatePassword(id: string, hashedPassword: string) {
    return this.usersRepo.updatePassword(id, hashedPassword);
  }

  async getStats() {
    const [total, byRole] = await Promise.all([
      this.usersRepo.count({ isActive: true }),
      this.usersRepo.countByRole(),
    ]);
    return { total, byRole };
  }
}
