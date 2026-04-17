// src/services/api.js
const API_BASE_URL = '/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint);
  }

  async post(endpoint, data) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  async put(endpoint, data) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // === Расписание ===
  async getSchedules() {
    return this.get('/schedules');
  }

  async createSchedule(scheduleData) {
    return this.post('/schedules', scheduleData);
  }

  async updateSchedule(id, scheduleData) {
    return this.put(`/schedules/${id}`, scheduleData);
  }

  async deleteSchedule(id) {
    return this.delete(`/schedules/${id}`);
  }

  // === Задания ===
  async getTasks() {
    return this.get('/tasks');
  }

  async createTask(taskData) {
    return this.post('/tasks', taskData);
  }

  async updateTaskStatus(id, status) {
    return this.patch(`/tasks/${id}/status`, { status });
  }

  // === Прогресс ===
  async getProgress() {
    return this.get('/progress');
  }

  // === Health check ===
  async healthCheck() {
    return this.get('/health');
  }
}

export const apiService = new ApiService();