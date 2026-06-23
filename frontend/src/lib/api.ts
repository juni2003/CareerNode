import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Separate long-timeout instance for email sweep (can take 2+ minutes)
const sweepApi = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 300000, // 5 minutes
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('API Error:', err?.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default api;

// ─── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params?: Record<string, any>) => api.get('/jobs', { params }),
  get: (id: string) => api.get(`/jobs/${id}`),
  create: (data: any) => api.post('/jobs', data),
  update: (id: string, data: any) => api.patch(`/jobs/${id}`, data),
  delete: (id: string) => api.delete(`/jobs/${id}`),
  stats: () => api.get('/jobs/stats/count'),
  wipeAll: () => api.delete('/jobs/system/wipe-all'),
  actionNeeded: () => api.get('/jobs/action-needed'),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  volume: () => api.get('/analytics/volume'),
  byRole: () => api.get('/analytics/by-role'),
  workModel: () => api.get('/analytics/work-model'),
  funnel: () => api.get('/analytics/funnel'),
  techTags: () => api.get('/analytics/tech-tags'),
  recentActivity: () => api.get('/analytics/recent-activity'),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiApi = {
  listSessions: () => api.get('/ai/sessions'),
  createSession: (title?: string) => api.post('/ai/sessions', { title }),
  getSession: (id: string) => api.get(`/ai/sessions/${id}`),
  deleteSession: (id: string) => api.delete(`/ai/sessions/${id}`),
  chat: (data: { session_id: string; message: string; job_id?: string; resume_id?: string }) =>
    sweepApi.post('/ai/chat', data),  // Use sweepApi here to allow up to 5 minutes for generation
  checkApplication: (company: string, role: string) =>
    api.get('/ai/check-application', { params: { company, role } }),
};

// ─── Resumes & Projects ───────────────────────────────────────────────────────
export const resumesApi = {
  list: () => api.get('/resumes'),
  get: (id: string) => api.get(`/resumes/${id}`),
  create: (data: any) => api.post('/resumes', data),
  update: (id: string, data: any) => api.patch(`/resumes/${id}`, data),
  delete: (id: string) => api.delete(`/resumes/${id}`),
};

export const projectsApi = {
  list: () => api.get('/projects'),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// ─── Gmail ────────────────────────────────────────────────────────────────────
export const gmailApi = {
  status: () => api.get('/gmail/status'),
  auth: () => api.post('/gmail/auth'),
  // Use the sync endpoint with a 5-minute timeout so it doesn't time out mid-sweep
  sweep: (months: number = 2) => sweepApi.post('/gmail/sweep/sync', { months }),
};

// ─── Radar ────────────────────────────────────────────────────────────────────
export const radarApi = {
  list: (params?: Record<string, any>) => api.get('/radar', { params }),
  updateStatus: (id: string, status: string) => api.patch(`/radar/${id}/status`, { status }),
  convert: (id: string) => api.post(`/radar/${id}/convert`),
  delete: (id: string) => api.delete(`/radar/${id}`),
};
