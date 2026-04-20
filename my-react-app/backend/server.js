import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3001;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'edu_platform',
  password: 'your_password',   // измените
  port: 5432,
});

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ DB error:', err));

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'edu-platform-secret-key-change-me';

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

const isTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Только преподаватель' });
  next();
};

// ========== Аутентификация ==========
app.post('/api/register', async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email уже используется' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role`,
      [email, hashed, firstName, lastName, role || 'student']
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(400).json({ error: 'Неверный email или пароль' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/user', authenticateToken, async (req, res) => {
  const { firstName, lastName } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET first_name=$1, last_name=$2
       WHERE id=$3 RETURNING id, email, first_name, last_name, role`,
      [firstName, lastName, req.user.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// ========== Расписание ==========
app.get('/api/schedules', authenticateToken, async (req, res) => {
  try {
    let query;
    if (req.user.role === 'teacher') {
      query = 'SELECT * FROM schedules WHERE user_id = $1 ORDER BY day_of_week, start_time';
      const result = await pool.query(query, [req.user.userId]);
      res.json(result.rows);
    } else {
      query = 'SELECT * FROM schedules ORDER BY day_of_week, start_time';
      const result = await pool.query(query);
      res.json(result.rows);
    }
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения расписания' });
  }
});

app.post('/api/schedules', authenticateToken, isTeacher, async (req, res) => {
  const { title, day_of_week, start_time, end_time, location } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO schedules (user_id, title, day_of_week, start_time, end_time, location)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.userId, title, day_of_week, start_time, end_time, location]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания занятия' });
  }
});

app.delete('/api/schedules/:id', authenticateToken, isTeacher, async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT user_id FROM schedules WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Занятие не найдено' });
    if (check.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Не ваше занятие' });

    await pool.query('DELETE FROM schedules WHERE id = $1', [id]);
    res.json({ message: 'Занятие удалено' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// ========== Задания ==========
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'teacher') {
      query = 'SELECT * FROM tasks WHERE created_by = $1 ORDER BY deadline';
      params = [req.user.userId];
    } else {
      query = 'SELECT * FROM tasks WHERE student_id = $1 ORDER BY deadline';
      params = [req.user.userId];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

app.post('/api/tasks', authenticateToken, isTeacher, async (req, res) => {
  const { title, course_name, deadline, student_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, course_name, deadline, created_by, student_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, course_name, deadline, req.user.userId, student_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка создания задания' });
  }
});

app.patch('/api/tasks/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!task.rows.length) return res.status(404).json({ error: 'Задание не найдено' });
    if (req.user.role === 'student' && task.rows[0].student_id !== req.user.userId) {
      return res.status(403).json({ error: 'Это не ваше задание' });
    }
    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'Статус обновлён' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

// ========== Прогресс ==========
app.get('/api/progress', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Только для студентов' });
  try {
    const tasks = await pool.query(
      'SELECT course_name, status FROM tasks WHERE student_id = $1',
      [req.user.userId]
    );
    const courses = {};
    for (const t of tasks.rows) {
      if (!courses[t.course_name]) courses[t.course_name] = { total: 0, completed: 0 };
      courses[t.course_name].total++;
      if (t.status === 'completed') courses[t.course_name].completed++;
    }
    const result = Object.entries(courses).map(([name, data]) => ({
      course_name: name,
      total_tasks: data.total,
      completed_tasks: data.completed,
      percent: data.total ? Math.round((data.completed / data.total) * 100) : 0
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения прогресса' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Edu server running on port ${port}`);
});