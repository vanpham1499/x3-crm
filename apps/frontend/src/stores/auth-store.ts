import { create } from 'zustand';
import type { User } from '@/types/user';

interface AuthStore {
  user: User | null;
  token: string | null;
  initialized: boolean;
  setAuth: (user: User | null, token: string) => void;
  logout: () => void;
  init: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  initialized: false,

  init: () => {
    if (typeof window === 'undefined') {
      set({ initialized: true });
      return;
    }

    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');

    if (!token) {
      set({ user: null, token: null, initialized: true });
      return;
    }

    if (!userStr) {
      set({ user: null, token, initialized: true });
      return;
    }

    try {
      set({ token, user: JSON.parse(userStr), initialized: true });
    } catch {
      try {
        localStorage.removeItem('user');
      } catch {}
      set({ user: null, token, initialized: true });
    }
  },

  setAuth: (user, token) => {
    localStorage.setItem('access_token', token);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
    set({ user, token, initialized: true });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    set({ user: null, token: null, initialized: true });
  },
}));
