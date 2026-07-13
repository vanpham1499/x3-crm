import axios from 'axios';

const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function resolveApiUrl() {
  if (typeof window === 'undefined') {
    return CONFIGURED_API_URL;
  }

  try {
    const url = new URL(CONFIGURED_API_URL);
    const localHosts = ['localhost', '127.0.0.1'];

    if (localHosts.includes(url.hostname) && localHosts.includes(window.location.hostname)) {
      url.hostname = window.location.hostname;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return CONFIGURED_API_URL;
  }
}

const API_URL = resolveApiUrl();
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export function initializeCsrfProtection() {
  return axios.get(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    withCredentials: true,
    withXSRFToken: true,
    headers: { Accept: 'application/json' },
  });
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
