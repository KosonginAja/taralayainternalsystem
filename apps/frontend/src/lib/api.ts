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
  (res) => {
    // If the server returns HTML instead of JSON, it means the request hit the frontend's index.html fallback
    // This happens in Vercel if VITE_API_URL is missing or the backend is down.
    if (typeof res.data === 'string' && res.data.trim().startsWith('<')) {
      return Promise.reject(new Error('API URL is misconfigured. Received HTML instead of JSON. Please check VITE_API_URL in Vercel.'));
    }
    return res;
  },
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
