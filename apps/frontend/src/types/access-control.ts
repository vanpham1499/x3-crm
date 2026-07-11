export type Permission = {
  id: number;
  code: string;
  name: string;
  module: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Role = {
  id: number;
  name: string;
  description?: string | null;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
};

export type RoleFilters = {
  keyword: string;
};

export type PermissionFilters = {
  keyword: string;
  module: string;
};
