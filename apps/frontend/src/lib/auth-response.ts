import type { User } from '@/types/user';

export type AuthResponseBody =
  | User
  | {
      user?: User;
      data?: User | { user?: User };
    };

export function getAuthUser(body: AuthResponseBody): User | null {
  if ('id' in body) return body;
  if (body.user) return body.user;
  const data = body.data;

  if (!data) return null;
  if ('id' in data) return data;

  return data.user || null;
}
