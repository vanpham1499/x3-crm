export interface User {
  id: number;
  code: string;
  name: string;
  email: string;
  roleId?: number;
  role: string;
  phone?: string;
  avatar?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type UserFilters = {
  keyword: string;
  role_id: string;
  is_active: string;
};

export type RoleOption = {
  id: number;
  name: string;
  description?: string;
};
