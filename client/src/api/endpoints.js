import { apiRequest } from './client.js';

export const employeesApi = {
  list: (params, signal) =>
    apiRequest('/employees', { params, signal }),
  options: (signal) =>
    apiRequest('/employees/options', { signal }),
  getById: (id, signal) =>
    apiRequest(`/employees/${id}`, { signal }),
  getTasks: (id, signal) =>
    apiRequest(`/employees/${id}/tasks`, { signal }),
  create: (body) =>
    apiRequest('/employees', { method: 'POST', body }),
  update: (id, body) =>
    apiRequest(`/employees/${id}`, { method: 'PUT', body }),
  remove: (id) =>
    apiRequest(`/employees/${id}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (params, signal) =>
    apiRequest('/tasks', { params, signal }),
  getById: (id, signal) =>
    apiRequest(`/tasks/${id}`, { signal }),
  create: (body) =>
    apiRequest('/tasks', { method: 'POST', body }),
  update: (id, body) =>
    apiRequest(`/tasks/${id}`, { method: 'PUT', body }),
  updateStatus: (id, status) =>
    apiRequest(`/tasks/${id}/status`, { method: 'PUT', body: { status } }),
  remove: (id) =>
    apiRequest(`/tasks/${id}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  getSummary: (signal) =>
    apiRequest('/dashboard', { signal }),
  getMeta: (signal) =>
    apiRequest('/meta', { signal }),
};
