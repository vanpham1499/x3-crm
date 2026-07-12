import { create } from 'zustand';
import axios from 'axios';
import { getAuthUser, type AuthResponseBody } from '@/lib/auth-response';
import { api } from '@/services/api/client';
import type { User } from '@/types/user';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'unavailable';

interface AuthStore {
  user: User | null;
  status: AuthStatus;
  setAuth: (user: User) => void;
  logout: () => Promise<void>;
  init: () => Promise<void>;
  verify: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  status: 'checking',

  init: async () => {
    if (typeof window === 'undefined') {
      set({ user: null, status: 'checking' });
      return;
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    set({ status: 'checking' });

    try {
      const response = await api.get<AuthResponseBody>('/auth/me');
      const user = getAuthUser(response.data);

      if (!user?.id) {
        set({ user: null, status: 'unauthenticated' });
        return;
      }

      set({ user, status: 'authenticated' });
    } catch (error) {
      const unauthorized = axios.isAxiosError(error) && error.response?.status === 401;
      set({ user: null, status: unauthorized ? 'unauthenticated' : 'unavailable' });
    }
  },

  verify: async () => {
    try {
      const response = await api.get<AuthResponseBody>('/auth/me');
      const user = getAuthUser(response.data);

      set({
        user,
        status: user?.id ? 'authenticated' : 'unauthenticated',
      });
    } catch (error) {
      const unauthorized = axios.isAxiosError(error) && error.response?.status === 401;
      set({ user: null, status: unauthorized ? 'unauthenticated' : 'unavailable' });
    }
  },

  setAuth: (user) => {
    set({ user, status: 'authenticated' });
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null, status: 'unauthenticated' });
  },
}));
