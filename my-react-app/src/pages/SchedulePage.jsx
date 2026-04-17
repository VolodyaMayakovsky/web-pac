// src/pages/SchedulePage.jsx
import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

const SchedulePage = ({ user }) => {
  const [schedules, setSchedules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState([]);

  const fetchWithAuth = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    return res.json();
  };

  const loadData = async () => {
    try {
      const [sched, t, prog] = await Promise.all([
        fetchWithAuth('/schedules'),
        fetchWithAuth('/tasks'),
        user.role === 'student' ? fetchWithAuth('/progress') : Promise.resolve([]),
      ]);
      setSchedules(sched);
      setTasks(t);
      if (user.role === 'student') setProgress(prog);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // ... остальной рендер (как в предыдущих версиях, но без вызова authService)
  // Используйте schedules, tasks, progress для отображения

  return (
    <div className="schedule-page">
      <h1>Расписание</h1>
      {/* ваша вёрстка */}
    </div>
  );
};

export default SchedulePage;