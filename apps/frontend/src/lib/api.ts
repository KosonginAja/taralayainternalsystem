import axios from 'axios';

// In production (Vercel), VITE_API_URL should be set to your backend Vercel URL.
// e.g. VITE_API_URL=https://taralaya-backend.vercel.app
// In development, leave it empty and Vite proxy will handle /api -> localhost:3001
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send httpOnly cookies
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Redirect to login if session expired
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
