// src/pages/SchedulePage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './SchedulePage.css';

const API_BASE = 'http://localhost:3001/api';

const SchedulePage = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Ваш существующий fetchWithAuth (без изменений)
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
    setLoading(true);
    setError('');
    try {
      const [sched, t, prog] = await Promise.all([
        fetchWithAuth('/schedules'),
        fetchWithAuth('/tasks'),
        user?.role === 'student' ? fetchWithAuth('/progress') : Promise.resolve([]),
      ]);
      setSchedules(sched);
      setTasks(t);
      if (user?.role === 'student') setProgress(prog);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить данные. Проверьте соединение с сервером.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Вспомогательные функции для календаря
  const getDayName = (dayNum) => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return days[(dayNum - 1) % 7];
  };

  const formatTime = (timeStr) => timeStr?.slice(0, 5) || '';

  const groupByDay = () => {
    const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    schedules.forEach(s => {
      if (grouped[s.day_of_week]) grouped[s.day_of_week].push(s);
    });
    return grouped;
  };

  const isOverdue = (deadline) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(deadline);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  if (loading) return <div className="loading-spinner">Загрузка расписания...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const grouped = groupByDay();

  return (
    <div className="schedule-page">
      <div className="container">
        <div className="page-header">
          <h1>Расписание и задания</h1>
          <div className="role-badge">
            {user?.role === 'student' ? 'Студент' : user?.role === 'teacher' ? 'Преподаватель' : 'Администратор'}
          </div>
        </div>

        <div className="dashboard-grid">
          {/* ========== Виджет календаря ========== */}
          <div className="widget calendar-widget">
            <h3>📅 Ближайшие занятия</h3>
            <div className="calendar-grid">
              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                <div key={day} className="calendar-day">
                  <div className="day-header">{getDayName(day)}</div>
                  <div className="day-events">
                    {grouped[day].length === 0 && <div className="no-event">—</div>}
                    {grouped[day].map(event => (
                      <div key={event.id} className="event-item">
                        <strong>{event.title}</strong>
                        <br />
                        {formatTime(event.start_time)} – {formatTime(event.end_time)}
                        {event.location && <div className="event-location">📍 {event.location}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========== Виджет заданий ========== */}
          <div className="widget assignments-widget">
            <h3>📋 Задания с дедлайнами</h3>
            {tasks.length === 0 ? (
              <p className="empty-message">Нет заданий для отображения</p>
            ) : (
              <div className="tasks-list">
                {tasks.map(task => (
                  <div key={task.id} className={`task-card ${isOverdue(task.deadline) ? 'overdue' : ''}`}>
                    <div className="task-status">
                      {user?.role === 'student' && (
                        <span className={`status-badge status-${task.status || 'pending'}`}>
                          {task.status === 'completed' ? '✅ Выполнено' :
                           task.status === 'in_progress' ? '🔄 В процессе' : '⏳ Ожидает'}
                        </span>
                      )}
                      {user?.role === 'teacher' && (
                        <span className="status-badge status-info">✍️ Создано вами</span>
                      )}
                      {user?.role === 'admin' && (
                        <span className="status-badge status-admin">📊 Общее задание</span>
                      )}
                    </div>
                    <div className="task-content">
                      <h3>{task.title}</h3>
                      <div className="task-meta">
                        <span className="task-course">{task.course_name || 'Без курса'}</span>
                        <span className="task-deadline">
                          📅 {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          {isOverdue(task.deadline) && <span className="overdue-label"> (просрочено)</span>}
                        </span>
                        {user?.role === 'teacher' && task.submissions !== undefined && (
                          <span className="task-submissions">📎 Сдано: {task.submissions}</span>
                        )}
                        {user?.role === 'admin' && (
                          <span className="task-submissions">👥 Для всех курсов</span>
                        )}
                      </div>
                      {task.description && <p className="task-desc">{task.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========== Виджет прогресса ========== */}
          <div className="widget progress-widget">
            <h3>📊 Прогресс обучения</h3>
            {user?.role === 'student' ? (
              progress.length === 0 ? (
                <p className="empty-message">Нет данных о прогрессе</p>
              ) : (
                <div className="progress-overview">
                  <div className="progress-details">
                    {progress.map((item, idx) => (
                      <div key={idx} className="progress-item">
                        <span className="course-name">{item.course_name}</span>
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${item.percent_complete || 0}%` }}></div>
                        </div>
                        <span className="course-percent">{Math.round(item.percent_complete || 0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              // Для преподавателя и администратора – общая статистика
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-value">{tasks.length}</div>
                  <div className="stat-label">Всего заданий</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{tasks.filter(t => t.status === 'completed').length}</div>
                  <div className="stat-label">Выполнено</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {tasks.length ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0}%
                  </div>
                  <div className="stat-label">Средний прогресс</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;