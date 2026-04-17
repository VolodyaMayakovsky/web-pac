// src/services/authService.js
const API_BASE_URL = '/api';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user'));
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    return await response.json();
  }

  async register(userData) {
    const response = await this.request('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    this.setAuth(response.user, response.token);
    return response;
  }

  async login(credentials) {
    const response = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setAuth(response.user, response.token);
    return response;
  }

  async getUser() {
    const response = await this.request('/user');
    this.user = response;
    localStorage.setItem('user', JSON.stringify(response));
    return response;
  }

  async updateUser(userData) {
    const response = await this.request('/user', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    this.user = response;
    localStorage.setItem('user', JSON.stringify(response));
    return response;
  }

  setAuth(user, token) {
    this.user = user;
    this.token = token;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
  }

  logout() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  isAuthenticated() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  getUserData() {
    return this.user;
  }

  // === Методы для работы с расписанием (прокси к apiService, но с авторизацией) ===
  async getSchedules() {
    return this.request('/schedules');
  }

  async createSchedule(scheduleData) {
    return this.request('/schedules', { method: 'POST', body: JSON.stringify(scheduleData) });
  }

  async updateSchedule(id, scheduleData) {
    return this.request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(scheduleData) });
  }

  async deleteSchedule(id) {
    return this.request(`/schedules/${id}`, { method: 'DELETE' });
  }

  // === Задания ===
  async getTasks() {
    return this.request('/tasks');
  }

  async createTask(taskData) {
    return this.request('/tasks', { method: 'POST', body: JSON.stringify(taskData) });
  }

  async updateTaskStatus(id, status) {
    return this.request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  // === Прогресс ===
  async getProgress() {
    return this.request('/progress');
  }
}

export const authService = new AuthService();