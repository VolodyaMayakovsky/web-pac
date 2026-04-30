// src/pages/SchedulePage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './SchedulePage.css';

const SchedulePage = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Параллельная загрузка через axios (токен уже в заголовках)
      const [schedRes, tasksRes, progRes] = await Promise.all([
        axios.get('/api/schedules'),
        axios.get('/api/tasks'),
        user?.role === 'student' ? axios.get('/api/progress') : Promise.resolve({ data: [] }),
      ]);
      setSchedules(schedRes.data);
      setTasks(tasksRes.data);
      if (user?.role === 'student') setProgress(progRes.data);
    } catch (err) {
      console.error('Ошибка загрузки расписания:', err);
      setError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Вспомогательные функции
  const getDayName = (dayNum) => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return days[(dayNum - 1) % 7];
  };

  const formatTime = (timeStr) => timeStr?.slice(0, 5) || '';

  const groupedSchedules = () => {
    const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    schedules.forEach((s) => {
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

  const statusLabel = (status) => {
    switch (status) {
      case 'completed':
        return '✅ Выполнено';
      case 'in_progress':
        return '🔄 В процессе';
      default:
        return '⏳ Ожидает';
    }
  };

  if (loading) {
    return (
      <div className="schedule-page">
        <div className="schedule-loading">
          <div className="loading-spinner" />
          <p>Загружаем ваше расписание...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="schedule-page">
        <div className="schedule-error">{error}</div>
      </div>
    );
  }

  const grouped = groupedSchedules();

  return (
    <div className="schedule-page">
      <div className="container">
        {/* Шапка страницы */}
        <header className="schedule-header">
          <div>
            <h1 className="schedule-title">
              <span className="title-icon">📅</span> Расписание
            </h1>
            <p className="schedule-subtitle">
              {user?.role === 'student' && 'Твои занятия и задания на неделю'}
              {user?.role === 'teacher' && 'Управление расписанием и заданиями'}
              {user?.role === 'admin' && 'Общая нагрузка по платформе'}
            </p>
          </div>
          <div className="role-badge">
            {user?.role === 'student'
              ? 'Студент'
              : user?.role === 'teacher'
              ? 'Преподаватель'
              : 'Администратор'}
          </div>
        </header>

        {/* Основная сетка виджетов */}
        <div className="dashboard-grid">
          {/* Календарь занятий */}
          <section className="widget calendar-widget">
            <h2 className="widget-title">
              <span className="widget-icon">🗓️</span> Ближайшие занятия
            </h2>
            <div className="calendar-grid">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div key={day} className="calendar-day">
                  <div className="day-header">{getDayName(day)}</div>
                  <div className="day-events">
                    {grouped[day].length === 0 && <div className="no-event">—</div>}
                    {grouped[day].map((event) => (
                      <div key={event.id} className="event-card">
                        <div className="event-title">{event.title}</div>
                        <div className="event-time">
                          {formatTime(event.start_time)} – {formatTime(event.end_time)}
                        </div>
                        {event.location && (
                          <div className="event-location">
                            <span>📍</span> {event.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Задания с дедлайнами */}
          <section className="widget assignments-widget">
            <h2 className="widget-title">
              <span className="widget-icon">📋</span>
              {user?.role === 'student' && 'Мои задания'}
              {user?.role === 'teacher' && 'Мои задания для студентов'}
              {user?.role === 'admin' && 'Все задания платформы'}
            </h2>
            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <p>Заданий пока нет</p>
              </div>
            ) : (
              <div className="tasks-list">
                {tasks.map((task) => (
                  <article
                    key={task.id}
                    className={`task-card ${isOverdue(task.deadline) ? 'overdue' : ''}`}
                  >
                    <div className="task-status">
                      <span className={`status-badge status-${task.status || 'pending'}`}>
                        {statusLabel(task.status)}
                      </span>
                    </div>
                    <div className="task-content">
                      <h3 className="task-name">{task.title}</h3>
                      <div className="task-meta">
                        <span className="task-course">{task.course_name}</span>
                        <span
                          className={`task-deadline ${isOverdue(task.deadline) ? 'deadline-overdue' : ''}`}
                        >
                          📅 {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          {isOverdue(task.deadline) && (
                            <span className="overdue-label">Просрочено</span>
                          )}
                        </span>
                      </div>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Прогресс обучения */}
          <section className="widget progress-widget">
            <h2 className="widget-title">
              <span className="widget-icon">📊</span>
              {user?.role === 'student' ? 'Мой прогресс' : 'Общая статистика'}
            </h2>

            {user?.role === 'student' ? (
              progress.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📈</div>
                  <p>Нет данных для отображения</p>
                </div>
              ) : (
                <div className="progress-list">
                  {progress.map((item) => (
                    <div key={item.course_name} className="progress-item">
                      <div className="progress-header">
                        <span className="course-name">{item.course_name}</span>
                        <span className="progress-percent">
                          {Math.round(item.percent_complete || 0)}%
                        </span>
                      </div>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${item.percent_complete || 0}%` }}
                        />
                      </div>
                      <div className="progress-stats">
                        <span>
                          {item.completed_tasks}/{item.total_tasks} заданий
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">{tasks.length}</span>
                  <span className="stat-label">Всего заданий</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {tasks.filter((t) => t.status === 'completed').length}
                  </span>
                  <span className="stat-label">Выполнено</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {tasks.length
                      ? Math.round(
                          (tasks.filter((t) => t.status === 'completed').length /
                            tasks.length) *
                            100
                        )
                      : 0}
                    %
                  </span>
                  <span className="stat-label">Общий прогресс</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;