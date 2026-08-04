import type { AuthResponseBody } from '@/lib/auth-response';
import { api } from '@/services/api/client';

export type UpdateCurrentProfilePayload = {
  name: string;
  phone: string;
  avatar: string;
};

export type ChangeCurrentPasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export async function updateCurrentProfile(payload: UpdateCurrentProfilePayload) {
  const response = await api.patch<AuthResponseBody>('/auth/profile', payload);
  return response.data;
}

export async function changeCurrentPassword(payload: ChangeCurrentPasswordPayload) {
  const response = await api.put<{ message: string }>('/auth/change-password', payload);
  return response.data;
}
