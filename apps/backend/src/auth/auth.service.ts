import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Sai mật khẩu');
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role, code: user.code, name: user.name };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, code: user.code, name: user.name, email: user.email, role: user.role, phone: user.phone },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findOne(userId)).email,
    );
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, hashed);
    return { message: 'Đổi mật khẩu thành công' };
  }

  getProfile(userId: string) {
    return this.usersService.findOne(userId);
  }
}
