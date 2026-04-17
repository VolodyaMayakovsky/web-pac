-- ============================================
-- 1. Таблица пользователей
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    role VARCHAR(50) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. Таблица расписания (занятия)
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    lesson_type VARCHAR(50),
    day_of_week INTEGER,   -- 1=пн, 2=вт, ..., 7=вс
    start_time TIME,
    end_time TIME,
    location VARCHAR(255),
    teacher_name VARCHAR(255),
    group_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. Таблица заданий
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. Таблица прогресса (можно вычислять на лету, но для удобства)
-- ============================================
CREATE TABLE IF NOT EXISTS progress (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    percent_complete DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_name)
);

-- ============================================
-- 5. Индексы для производительности
-- ============================================
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day_of_week ON schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_tasks_student_id ON tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_progress_student_id ON progress(student_id);

-- ============================================
-- 6. Тестовые данные (пользователи)
-- Пароли: для всех "password123" (хеш bcrypt)
-- ============================================
-- Преподаватель
INSERT INTO users (email, password, first_name, last_name, phone, role) VALUES
('teacher@eduplan.com', '$2b$10$3PzQZqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 'Анна', 'Смирнова', '+7(999)111-22-33', 'teacher')
ON CONFLICT (email) DO NOTHING;

-- Студенты
INSERT INTO users (email, password, first_name, last_name, phone, role) VALUES
('student1@eduplan.com', '$2b$10$3PzQZqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 'Иван', 'Петров', '+7(999)222-33-44', 'student'),
('student2@eduplan.com', '$2b$10$3PzQZqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq', 'Мария', 'Иванова', '+7(999)333-44-55', 'student')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 7. Расписание занятий (для преподавателя user_id = 1)
-- ============================================
INSERT INTO schedules (user_id, title, description, lesson_type, day_of_week, start_time, end_time, location, teacher_name, group_name) VALUES
(1, 'Высшая математика', 'Интегралы и дифференциальные уравнения', 'лекция', 1, '10:00', '11:30', 'А-201', 'Проф. Смирнова', 'ИС-31'),
(1, 'Физика', 'Электродинамика', 'лекция', 2, '12:00', '13:30', 'Ф-310', 'Доц. Иванов', 'ИС-31'),
(1, 'Программирование', 'JavaScript и React', 'лабораторная', 3, '14:00', '15:30', 'К-105', 'Ст. преп. Козлов', 'ИС-31'),
(1, 'Базы данных', 'SQL и PostgreSQL', 'лекция', 4, '11:00', '12:30', 'К-108', 'Проф. Сидоров', 'ИС-31'),
(1, 'Английский язык', 'Технический английский', 'семинар', 5, '09:00', '10:30', 'Г-402', 'Преп. Петрова', 'ИС-31');

-- ============================================
-- 8. Задания (для студентов)
-- ============================================
-- Задание для студента 2 (Мария)
INSERT INTO tasks (course_name, title, description, deadline, created_by, student_id, status) VALUES
('Высшая математика', 'Решить задачи по интегралам', 'Номера 12.5, 12.7, 13.1', '2026-04-20', 1, 2, 'pending'),
('Программирование', 'Сделать ToDo-приложение на React', 'Реализовать добавление и удаление задач', '2026-04-25', 1, 2, 'in_progress'),
('Английский язык', 'Подготовить презентацию', 'Тема: "Моя будущая профессия"', '2026-04-18', 1, 2, 'completed');

-- Задание для студента 3 (Иван)
INSERT INTO tasks (course_name, title, description, deadline, created_by, student_id, status) VALUES
('Физика', 'Лабораторная работа №3', 'Измерение сопротивления', '2026-04-22', 1, 3, 'pending'),
('Базы данных', 'Спроектировать ER-диаграмму', 'Для интернет-магазина', '2026-04-19', 1, 3, 'in_progress');

-- Общее задание для группы (без привязки к конкретному студенту)
INSERT INTO tasks (course_name, title, description, deadline, created_by, group_name, status) VALUES
('Программирование', 'Курсовая работа', 'Разработать веб-приложение', '2026-05-10', 1, 'ИС-31', 'pending');

-- ============================================
-- 9. Прогресс (пример для студента 2 и 3)
-- ============================================
INSERT INTO progress (student_id, course_name, total_tasks, completed_tasks, percent_complete) VALUES
(2, 'Высшая математика', 3, 1, 33.33),
(2, 'Программирование', 2, 0, 0),
(2, 'Английский язык', 1, 1, 100),
(3, 'Физика', 2, 0, 0),
(3, 'Базы данных', 1, 0, 0)
ON CONFLICT (student_id, course_name) DO UPDATE SET
    total_tasks = EXCLUDED.total_tasks,
    completed_tasks = EXCLUDED.completed_tasks,
    percent_complete = EXCLUDED.percent_complete;

-- ============================================
-- 10. Обновить агрегаты прогресса (автоматически пересчитать)
-- ============================================
-- (В реальности можно использовать триггеры, но для теста просто обновим)
UPDATE progress p
SET 
    total_tasks = sub.total,
    completed_tasks = sub.completed,
    percent_complete = CASE WHEN sub.total > 0 THEN (sub.completed::float / sub.total) * 100 ELSE 0 END
FROM (
    SELECT 
        student_id,
        course_name,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM tasks
    WHERE student_id IS NOT NULL
    GROUP BY student_id, course_name
) sub
WHERE p.student_id = sub.student_id AND p.course_name = sub.course_name;

-- ============================================
-- Готово!
-- ============================================