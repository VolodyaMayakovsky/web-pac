// backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

// Подключение к вашей базе данных "pac"
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pac',           // ← ваша база данных
  password: '',              // без пароля
  port: 5432,
});

pool.connect()
  .then(() => console.log('✅ Успешно подключено к PostgreSQL'))
  .catch(err => console.error('❌ Ошибка подключения к БД:', err));

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'eduplan-secure-key-2024';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется токен доступа' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Токен недействителен' });
    req.user = decoded;
    next();
  });
};

const isTeacher = (u) => u.role === 'teacher';
const isAdmin = (u) => u.role === 'admin';
const isStudent = (u) => u.role === 'student';

// ========== АВТОРИЗАЦИЯ ==========
app.post('/api/register', async (req, res) => {
  const { email, password, name, role = 'student' } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, пароль и имя обязательны' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const parts = name.trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, email, first_name, last_name, role`,
      [email, hashedPassword, firstName, lastName, role]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userData } = user;
    res.json({ user: userData, token });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, middle_name, phone, address, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.put('/api/user', authenticateToken, async (req, res) => {
  const { firstName, lastName, middleName, phone, address } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        middle_name = COALESCE($3, middle_name),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address)
       WHERE id = $6
       RETURNING id, email, first_name, last_name, middle_name, phone, address, role`,
      [firstName, lastName, middleName, phone, address, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ========== РАСПИСАНИЕ ==========
app.get('/api/schedules', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM schedules';
    const params = [];
    if (isTeacher(req.user)) {
      query += ' WHERE user_id = $1';
      params.push(req.user.id);
    }
    query += ' ORDER BY day_of_week, start_time';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения расписания' });
  }
});

app.post('/api/schedules', authenticateToken, async (req, res) => {
  if (isStudent(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
  const { title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name } = req.body;
  if (!title || !day_of_week || !start_time || !end_time)
    return res.status(400).json({ error: 'title, day_of_week, start_time, end_time обязательны' });

  try {
    const userId = isTeacher(req.user) ? req.user.id : req.body.user_id;
    if (!userId) return res.status(400).json({ error: 'Не указан преподаватель (user_id)' });

    const result = await pool.query(
      `INSERT INTO schedules (user_id, title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [userId, title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания занятия' });
  }
});

app.put('/api/schedules/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const schedule = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
    if (schedule.rows.length === 0) return res.status(404).json({ error: 'Занятие не найдено' });
    if (!isAdmin(req.user) && schedule.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Недостаточно прав' });

    const { title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name } = req.body;
    const result = await pool.query(
      `UPDATE schedules SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        lesson_type = COALESCE($3, lesson_type),
        day_of_week = COALESCE($4, day_of_week),
        start_time = COALESCE($5, start_time),
        end_time = COALESCE($6, end_time),
        location = COALESCE($7, location),
        teacher_name = COALESCE($8, teacher_name),
        group_name = COALESCE($9, group_name)
       WHERE id = $10 RETURNING *`,
      [title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления занятия' });
  }
});

app.delete('/api/schedules/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const schedule = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
    if (schedule.rows.length === 0) return res.status(404).json({ error: 'Занятие не найдено' });
    if (!isAdmin(req.user) && schedule.rows[0].user_id !== req.user.id)
      return res.status(403).json({ error: 'Недостаточно прав' });

    await pool.query('DELETE FROM schedules WHERE id = $1', [id]);
    res.json({ message: 'Занятие удалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления занятия' });
  }
});

// ========== ЗАДАНИЯ ==========
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM tasks';
    const params = [];
    if (isStudent(req.user)) {
      query += ' WHERE student_id = $1';
      params.push(req.user.id);
    } else if (isTeacher(req.user)) {
      query += ' WHERE created_by = $1';
      params.push(req.user.id);
    }
    query += ' ORDER BY deadline';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  if (isStudent(req.user)) return res.status(403).json({ error: 'Недостаточно прав' });
  const { course_name, title, description, deadline, student_id, group_name, status = 'pending' } = req.body;
  if (!course_name || !title || !deadline)
    return res.status(400).json({ error: 'course_name, title, deadline обязательны' });

  try {
    const result = await pool.query(
      `INSERT INTO tasks (course_name, title, description, deadline, status, created_by, student_id, group_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [course_name, title, description, deadline, status, req.user.id, student_id, group_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания задания' });
  }
});

app.patch('/api/tasks/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Укажите новый статус' });

  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Задание не найдено' });
    const t = task.rows[0];
    if (isStudent(req.user) && t.student_id !== req.user.id)
      return res.status(403).json({ error: 'Недостаточно прав' });
    if (isTeacher(req.user) && t.created_by !== req.user.id)
      return res.status(403).json({ error: 'Недостаточно прав' });

    const result = await pool.query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Задание не найдено' });
    if (!isAdmin(req.user) && task.rows[0].created_by !== req.user.id)
      return res.status(403).json({ error: 'Недостаточно прав' });

    const { course_name, title, description, deadline, student_id, group_name, status } = req.body;
    const result = await pool.query(
      `UPDATE tasks SET
        course_name = COALESCE($1, course_name),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        deadline = COALESCE($4, deadline),
        student_id = COALESCE($5, student_id),
        group_name = COALESCE($6, group_name),
        status = COALESCE($7, status),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [course_name, title, description, deadline, student_id, group_name, status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления задания' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Задание не найдено' });
    if (!isAdmin(req.user) && task.rows[0].created_by !== req.user.id)
      return res.status(403).json({ error: 'Недостаточно прав' });

    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ message: 'Задание удалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
});

// ========== ПРОГРЕСС ==========
app.get('/api/progress', authenticateToken, async (req, res) => {
  if (!isStudent(req.user)) return res.status(403).json({ error: 'Только студенты могут просматривать прогресс' });
  try {
    const result = await pool.query('SELECT * FROM progress WHERE student_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения прогресса' });
  }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: !!pool });
});

// ========== ЗАПУСК ==========
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});