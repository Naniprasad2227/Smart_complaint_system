import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

const authApiClient = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');
    const nonRefreshableAuthRoutes = [
      '/auth/login',
      '/auth/signup',
      '/auth/google',
      '/auth/refresh',
      '/auth/login/verify-otp',
      '/auth/login/resend-otp',
    ];

    const shouldTryRefresh =
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !nonRefreshableAuthRoutes.some((route) => requestUrl.includes(route));

    if (!shouldTryRefresh) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const { data } = await authApiClient.post('/auth/refresh', { refreshToken });
      localStorage.setItem('token', data.accessToken || data.token);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken || data.token}`;
      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      return Promise.reject(refreshError);
    }
  }
);

export const authApi = {
  signup: (payload) => api.post('/auth/signup', payload),
  login: (payload) => api.post('/auth/login', payload),
  googleLogin: (idToken) => api.post('/auth/google', { idToken }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  verifyLoginOtp: (payload) => api.post('/auth/login/verify-otp', payload),
  resendLoginOtp: (payload) => api.post('/auth/login/resend-otp', payload),
  refresh: (payload) => api.post('/auth/refresh', payload),
  logout: (payload) => api.post('/auth/logout', payload),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  deleteAccount: () => api.delete('/auth/me'),
  deactivateAccount: (payload) => api.delete('/auth/me', { data: payload || {} }),
  adminDeactivateUser: (userId, payload) => api.patch(`/auth/admin/users/${userId}/deactivate`, payload || {}),
  adminReactivateUser: (userId, payload) => api.patch(`/auth/admin/users/${userId}/reactivate`, payload || { confirm: true }),
  assignAdmin: (payload) => api.post('/auth/admin/assign-admin', payload),
  requestMobileOtp: () => api.post('/auth/mobile/request-otp'),
  verifyMobileOtp: (otp) => api.post('/auth/mobile/verify-otp', { otp }),
};

export const complaintApi = {
  submit: (payload) => api.post('/complaints', payload),
  getMine: () => api.get('/complaints/mine'),
  getAll: () => api.get('/complaints'),
  getById: (id) => api.get(`/complaints/${id}`),
  update: (id, payload) => api.put(`/complaints/${id}`, payload),
  remove: (id) => api.delete(`/complaints/${id}`),
  updateStatus: (id, status) => api.patch(`/complaints/${id}/status`, { status }),
  uploadImage: (id, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/complaints/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAnalytics: () => api.get('/complaints/analytics'),
  getEnhancedAnalytics: () => api.get('/complaints/analytics/enhanced'),
  getSentimentAnalysis: () => api.get('/complaints/analytics/sentiment'),
  getResponseMetrics: () => api.get('/complaints/analytics/response-metrics'),
  chat: (message) => api.post('/complaints/chat', { message }),
  adminCheck: () => api.get('/complaints/admin-check'),
  assignWorker: (complaintId, workerId) =>
    api.patch(`/complaints/${complaintId}/assign-worker`, { workerId }),
  getMyAssignments: () => api.get('/complaints/my-assignments'),
  updateProgress: (id, status, progressNote) =>
    api.patch(`/complaints/${id}/progress`, { status, progressNote }),
  detectImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/complaints/detect-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const adminApi = {
  getAllComplaints: () => api.get('/admin/allComplaints'),
  assignWorker: (complaintId, workerId) => api.put('/admin/assignWorker', { complaintId, workerId }),
  updateStatus: (complaintId, status) => api.put('/admin/updateStatus', { complaintId, status }),
  collectorQuestionLowerAdmins: (payload) => api.post('/admin/collector/question-lower-admins', payload),
};

export const workerPortalApi = {
  getAssignedComplaints: () => api.get('/worker/assignedComplaints'),
  updateStatus: (complaintId, status, progressNote) =>
    api.put('/worker/updateStatus', { complaintId, status, progressNote }),
};

export const workerApi = {
  getAll: (options = {}) => api.get('/workers', { params: options }),
  getSpecialties: () => api.get('/workers/specialties'),
  create: (payload) => api.post('/workers', payload),
  update: (id, payload) => api.patch(`/workers/${id}`, payload),
  reactivate: (id) => api.patch(`/workers/${id}/reactivate`, { confirm: true }),
  remove: (id) => api.delete(`/workers/${id}`),
};

export const notificationApi = {
  getMine: (limit = 25) => api.get('/notifications', { params: { limit } }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export default api;
