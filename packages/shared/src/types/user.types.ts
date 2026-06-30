export enum UserRole {
  ADMIN = 'ADMIN',
  LEADER = 'LEADER',
  EMPLOYEE = 'EMPLOYEE',
  ACCOUNTANT = 'ACCOUNTANT',
  SALES = 'SALES',
}

export interface IUser {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuthPayload {
  sub: string;
  email: string;
  role: UserRole;
  code: string;
  name: string;
}
