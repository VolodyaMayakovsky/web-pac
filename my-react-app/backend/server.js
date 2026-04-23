const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Настройка подключения к PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pac',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ DB error:', err));

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'edu-platform-secret-key-change-me';
const SALT_ROUNDS = 10;

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ========== РЕГИСТРАЦИЯ ==========
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  if (!['student', 'teacher', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, role]
    );

    const newUser = result.rows[0];
    const token = jwt.sign({ userId: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
      message: 'Регистрация успешна',
      user: newUser,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ========== ЛОГИН ==========
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ========== ДАШБОРД (для виджетов: расписание, задания, прогресс, уведомления) ==========
app.get('/api/dashboard', async (req, res) => {
  const { role } = req.query;
  if (!role || !['student', 'teacher', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid or missing role' });
  }

  try {
    let userId;
    if (role === 'student') userId = 1;
    else if (role === 'teacher') userId = 2;
    else userId = 3;

    // 1. Расписание (занятия на неделю)
    let scheduleQuery = '';
    if (role === 'student') {
      scheduleQuery = `
        SELECT s.day_of_week, s.start_time, s.end_time, c.title as course_title
        FROM schedule s
        JOIN courses c ON s.course_id = c.id
        JOIN enrollments e ON e.course_id = c.id
        WHERE e.student_id = $1
        ORDER BY 
          CASE s.day_of_week
            WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3
            WHEN 'Thu' THEN 4 WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7
          END, s.start_time
      `;
    } else if (role === 'teacher') {
      scheduleQuery = `
        SELECT s.day_of_week, s.start_time, s.end_time, c.title as course_title
        FROM schedule s
        JOIN courses c ON s.course_id = c.id
        WHERE c.teacher_id = $1
        ORDER BY 
          CASE s.day_of_week
            WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3
            WHEN 'Thu' THEN 4 WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7
          END, s.start_time
      `;
    } else {
      scheduleQuery = `
        SELECT s.day_of_week, s.start_time, s.end_time, c.title as course_title
        FROM schedule s
        JOIN courses c ON s.course_id = c.id
        ORDER BY 
          CASE s.day_of_week
            WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3
            WHEN 'Thu' THEN 4 WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7
          END, s.start_time
      `;
    }
    const scheduleRes = await (role === 'admin' ? pool.query(scheduleQuery) : pool.query(scheduleQuery, [userId]));
    const events = scheduleRes.rows;

    // 2. Список заданий с дедлайнами
    let assignmentsQuery = '';
    if (role === 'student') {
      assignmentsQuery = `
        SELECT a.id, a.title, a.due_date, sa.status, sa.grade, c.title as course_title
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON e.course_id = c.id
        LEFT JOIN student_assignments sa ON sa.assignment_id = a.id AND sa.student_id = e.student_id
        WHERE e.student_id = $1
        ORDER BY a.due_date ASC
      `;
    } else if (role === 'teacher') {
      assignmentsQuery = `
        SELECT a.id, a.title, a.due_date, c.title as course_title,
               COUNT(sa.student_id) as submissions
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN student_assignments sa ON sa.assignment_id = a.id
        WHERE c.teacher_id = $1
        GROUP BY a.id, c.title
        ORDER BY a.due_date ASC
      `;
    } else {
      assignmentsQuery = `
        SELECT a.id, a.title, a.due_date, c.title as course_title,
               COUNT(DISTINCT e.student_id) as enrolled_students,
               COUNT(sa.student_id) FILTER (WHERE sa.status = 'submitted' OR sa.status = 'graded') as submitted_count
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN enrollments e ON e.course_id = c.id
        LEFT JOIN student_assignments sa ON sa.assignment_id = a.id
        GROUP BY a.id, c.title
        ORDER BY a.due_date ASC
      `;
    }
    const assignmentsRes = await (role === 'admin' ? pool.query(assignmentsQuery) : pool.query(assignmentsQuery, [userId]));
    const assignments = assignmentsRes.rows;

    // 3. Прогресс выполнения учебного плана
    let progress = 0;
    if (role === 'student') {
      const totalQuery = `SELECT COUNT(*) as total FROM student_assignments WHERE student_id = $1`;
      const doneQuery = `SELECT COUNT(*) as done FROM student_assignments WHERE student_id = $1 AND status IN ('submitted', 'graded')`;
      const totalRes = await pool.query(totalQuery, [userId]);
      const doneRes = await pool.query(doneQuery, [userId]);
      const total = parseInt(totalRes.rows[0].total) || 1;
      const done = parseInt(doneRes.rows[0].done);
      progress = Math.round((done / total) * 100);
    } else if (role === 'teacher') {
      const progressQuery = `
        SELECT AVG(CASE WHEN sa.status IN ('submitted', 'graded') THEN 1 ELSE 0 END) * 100 as avg_progress
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN student_assignments sa ON sa.assignment_id = a.id
        WHERE c.teacher_id = $1
      `;
      const resProg = await pool.query(progressQuery, [userId]);
      progress = Math.round(parseFloat(resProg.rows[0].avg_progress) || 0);
    } else {
      const progressQuery = `
        SELECT AVG(CASE WHEN status IN ('submitted', 'graded') THEN 1 ELSE 0 END) * 100 as global_progress
        FROM student_assignments
      `;
      const resProg = await pool.query(progressQuery);
      progress = Math.round(parseFloat(resProg.rows[0].global_progress) || 0);
    }

    // 4. Уведомления (последние 5)
    const notificationsQuery = `
      SELECT id, message, created_at, is_read
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const notificationsRes = await pool.query(notificationsQuery, [userId]);
    const notifications = notificationsRes.rows;

    res.json({
      role,
      events,
      assignments,
      progress,
      notifications
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ПОЛУЧЕНИЕ ДАННЫХ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ==========
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ========== ЗАПУСК СЕРВЕРА ==========
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Edu server running on port ${port}`);
});