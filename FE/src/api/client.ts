import axios from 'axios';

const defaultApiBase = 'http://127.0.0.1:8021/api';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});
