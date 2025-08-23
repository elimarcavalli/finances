import axios from 'axios';
import { getAuthToken, removeAuthToken } from './utils/auth';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8002',
});

// Interceptor para adicionar token JWT a todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para lidar com respostas de erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeAuthToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;