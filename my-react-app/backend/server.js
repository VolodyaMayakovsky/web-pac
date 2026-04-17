// backend/server.js
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
  database: 'edu_platform',     // ваша БД
  password: 'your_password',    // укажите пароль
  port: 5432,
});

pool.on('connect', () => console.log('✅ Подключение к PostgreSQL установлено'));
pool.on('error', (err) => console.error('❌ Ошибка БД:', err));

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-super-secret-key-change-me';

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

// ========== Аутентификация и пользователи ==========
app.post('/api/register', async (req, res) => {
  const { email, password, firstName, lastName, middleName, phone, address, role } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email уже занят' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, middle_name, phone, address, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, middle_name, phone, address, role, created_at`,
      [email, hashed, firstName, lastName, middleName, phone, address, role || 'student']
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
      'SELECT id, email, first_name, last_name, middle_name, phone, address, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/user', authenticateToken, async (req, res) => {
  const { firstName, lastName, middleName, phone, address } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET first_name=$1, last_name=$2, middle_name=$3, phone=$4, address=$5, updated_at=CURRENT_TIMESTAMP
       WHERE id=$6 RETURNING id, email, first_name, last_name, middle_name, phone, address, role`,
      [firstName, lastName, middleName, phone, address, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// ========== Расписание (CRUD) ==========
// Получить расписание для текущего пользователя (или все, если преподаватель)
app.get('/api/schedules', authenticateToken, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'teacher') {
      // Преподаватель видит все расписания, которые он создал (или можно все)
      query = 'SELECT * FROM schedules WHERE user_id = $1 ORDER BY day_of_week, start_time';
      params = [req.user.userId];
    } else {
      // Студент видит расписания, где group_name совпадает с его группой (пока упрощённо – все расписания)
      // Для демо – все расписания (позже привяжите группу студента)
      query = 'SELECT * FROM schedules ORDER BY day_of_week, start_time';
      params = [];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения расписания' });
  }
});

// Создать занятие (только преподаватель)
app.post('/api/schedules', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ только преподавателям' });
  const { title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO schedules (user_id, title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.userId, title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания занятия' });
  }
});

// Обновить занятие (только преподаватель – владелец)
app.put('/api/schedules/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ только преподавателям' });
  const { id } = req.params;
  const { title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name } = req.body;
  try {
    const check = await pool.query('SELECT user_id FROM schedules WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Занятие не найдено' });
    if (check.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Не ваше занятие' });

    const result = await pool.query(
      `UPDATE schedules SET title=$1, description=$2, lesson_type=$3, day_of_week=$4, start_time=$5, end_time=$6,
       location=$7, teacher_name=$8, group_name=$9, updated_at=CURRENT_TIMESTAMP
       WHERE id=$10 RETURNING *`,
      [title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// Удалить занятие (только преподаватель – владелец)
app.delete('/api/schedules/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ только преподавателям' });
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT user_id FROM schedules WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Занятие не найдено' });
    if (check.rows[0].user_id !== req.user.userId) return res.status(403).json({ error: 'Не ваше занятие' });

    await pool.query('DELETE FROM schedules WHERE id = $1', [id]);
    res.json({ message: 'Занятие удалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// ========== Задания ==========
// Получить задания для студента (его личные или для его группы)
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'teacher') {
      // Преподаватель видит задания, которые создал
      query = 'SELECT * FROM tasks WHERE created_by = $1 ORDER BY deadline ASC';
      params = [req.user.userId];
    } else {
      // Студент: задания, назначенные лично ему или для его группы (упрощённо – все задания)
      query = 'SELECT * FROM tasks WHERE student_id = $1 OR group_name IS NOT NULL ORDER BY deadline ASC';
      params = [req.user.userId];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

// Создать задание (только преподаватель)
app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Доступ только преподавателям' });
  const { course_name, title, description, deadline, student_id, group_name } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tasks (course_name, title, description, deadline, created_by, student_id, group_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [course_name, title, description, deadline, req.user.userId, student_id || null, group_name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания задания' });
  }
});

// Обновить статус задания (студент может отметить выполненным)
app.patch('/api/tasks/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'pending', 'in_progress', 'completed'
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!task.rows.length) return res.status(404).json({ error: 'Задание не найдено' });
    const taskData = task.rows[0];
    // Студент может менять статус только своих заданий
    if (req.user.role === 'student' && taskData.student_id !== req.user.userId) {
      return res.status(403).json({ error: 'Это не ваше задание' });
    }
    const result = await pool.query(
      'UPDATE tasks SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

// ========== Прогресс (автоматический расчёт) ==========
app.get('/api/progress', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Только для студентов' });
  try {
    // Получаем все задания студента и считаем выполненные
    const tasks = await pool.query(
      'SELECT course_name, status FROM tasks WHERE student_id = $1 OR group_name IS NOT NULL',
      [req.user.userId]
    );
    const progressMap = new Map(); // course_name -> {total, completed}
    for (const task of tasks.rows) {
      const course = task.course_name;
      if (!progressMap.has(course)) progressMap.set(course, { total: 0, completed: 0 });
      const data = progressMap.get(course);
      data.total++;
      if (task.status === 'completed') data.completed++;
    }
    const result = [];
    for (const [course, data] of progressMap.entries()) {
      const percent = data.total ? (data.completed / data.total) * 100 : 0;
      result.push({
        course_name: course,
        total_tasks: data.total,
        completed_tasks: data.completed,
        percent_complete: parseFloat(percent.toFixed(2))
      });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения прогресса' });
  }
});

// ========== Health check ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'PostgreSQL', timestamp: new Date() });
});

app.listen(port, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${port}`);
});