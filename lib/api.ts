import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token') || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const setToken = (token: string) => {
  Cookies.set('token', token, { expires: 7 });
  localStorage.setItem('token', token);
};

export const getToken = () => {
  return Cookies.get('token') || localStorage.getItem('token');
};

export const clearToken = () => {
  Cookies.remove('token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const setUser = (user: any) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
};

export const SOCKET_URL = API_URL;
