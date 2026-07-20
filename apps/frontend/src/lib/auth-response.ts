import type { User } from '@/types/user';

type ProfileEnvelope = {
  user?: User;
  permissions?: string[];
};

export type AuthResponseBody =
  | User
  | (ProfileEnvelope & {
      data?: User | ProfileEnvelope;
    });

function withPermissions(user: User | null, permissions?: string[]): User | null {
  if (!user || !permissions) return user;

  return { ...user, permissions };
}

export function getAuthUser(body: AuthResponseBody): User | null {
  if ('id' in body) return body;
  if (body.user) return withPermissions(body.user, body.permissions);
  const data = body.data;

  if (!data) return null;
  if ('id' in data) return data;

  return withPermissions(data.user || null, data.permissions);
}
