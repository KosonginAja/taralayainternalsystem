const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = {
  async get(endpoint: string) {
    const res = await fetch(`${API_URL}${endpoint}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post(endpoint: string, data: any) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async put(endpoint: string, data: any) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async del(endpoint: string) {
    const res = await fetch(`${API_URL}${endpoint}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  }
};
