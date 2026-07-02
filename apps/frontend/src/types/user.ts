export interface User {
  id: string;
  code: string;
  name: string;
  email: string;
  roleId?: string;
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
  id: string;
  name: string;
  description?: string;
};
